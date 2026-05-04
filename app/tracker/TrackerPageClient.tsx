"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Plus,
  Sparkles,
  Loader2,
  Trash2,
  Sun,
  PenLine,
  CalendarCheck
} from "lucide-react";

// FIX: Components are at Root (Up 2 levels: tasks -> app -> root)
import { useAuth } from "../../components/AuthProvider";
import { useBrowserSupabase } from "@/app/hooks/useBrowserSupabase";

import { useBackgroundMode } from "@/contexts/BackgroundContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const MOODS = [
  { label: "Great", icon: "🌞", value: "great" },
  { label: "Good", icon: "🙂", value: "good" },
  { label: "Okay", icon: "😐", value: "okay" },
  { label: "Tough", icon: "🌧️", value: "tough" },
];

export default function TasksPage() {
  const { profile: authInfo, getAccessToken, isLoading: isAuthLoading } = useAuth();
  const supabase = useBrowserSupabase();

  // Set background mode for this page
  useBackgroundMode('tracker');

  // Helper to get auth headers for API calls
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getAccessToken();
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [getAccessToken]);

  // Data State
  const [habits, setHabits] = useState<any[]>([]);
  const [dailyLog, setDailyLog] = useState<any>(null);
  
  // UI State
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [dailyNote, setDailyNote] = useState("");
  const [currentMood, setCurrentMood] = useState("good");

  const todayStr = new Date().toISOString().split('T')[0];

  // --- Fetch Data via API (bypasses RLS issues for wallet-auth users) ---
  useEffect(() => {
    if (isAuthLoading || !authInfo?.id || !supabase) return;

    const loadData = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(`/api/habits?user_id=${authInfo.id}&date=${todayStr}`, { headers });
        if (!res.ok) {
          console.error("Failed to load tracker data:", res.status);
          return;
        }
        const { habits: habitsData, dailyLog: logData } = await res.json();

        setHabits(habitsData || []);

        if (logData) {
            setDailyLog(logData);
            setDailyNote(logData.notes || "");
            setCurrentMood(logData.mood || "good");
        } else {
            setDailyLog({ completed_habit_ids: [], notes: "", mood: "good" });
        }
      } catch (e) {
        console.error("Load error", e);
      }
    };

    loadData();
  }, [authInfo?.id, todayStr, getAccessToken, isAuthLoading, supabase]);

  // --- Autosave Helper (via API to bypass RLS) ---
  const saveLogState = async (updates: any) => {
    if (!authInfo?.id) return;

    setDailyLog((prev: any) => ({ ...prev, ...updates }));

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/habits", {
        method: "PUT",
        headers,
        body: JSON.stringify({
          user_id: authInfo.id,
          date: todayStr,
          completed_habit_ids: dailyLog?.completed_habit_ids || [],
          notes: dailyNote,
          mood: currentMood,
          ...updates,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error("Autosave failed:", err.error);
      }
    } catch (error) {
      console.error("Autosave failed:", error);
    }
  };

  // --- Actions ---

 const handleAddHabit = async () => {
  if (!newHabitTitle.trim()) return;
  if (!authInfo?.id) return toast.error("Sign in required");

  setIsAdding(true);

  try {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/habits", {
      method: "POST",
      headers,
      body: JSON.stringify({ user_id: authInfo.id, title: newHabitTitle })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || "Failed to add habit");
    }

    const { habit } = await res.json();
    setHabits([...habits, habit]);
    setNewHabitTitle("");
    toast.success("Habit added");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add habit";
    toast.error(message);
  } finally {
    setIsAdding(false);
  }
};


  const handleDeleteHabit = async (id: string) => {
    setHabits(habits.filter(h => h.id !== id)); // Optimistic
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/habits?id=${id}`, { method: "DELETE", headers });
      if (!res.ok) {
        console.error("Delete failed");
      }
      toast.success("Habit removed");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to remove habit");
    }
  };

  const toggleHabit = async (habitId: string) => {
    if (!dailyLog) return;

    const currentCompleted = new Set(dailyLog.completed_habit_ids || []);
    if (currentCompleted.has(habitId)) {
        currentCompleted.delete(habitId);
    } else {
        currentCompleted.add(habitId);
    }

    const newCompletedArray = Array.from(currentCompleted);
    saveLogState({ completed_habit_ids: newCompletedArray });
  };

  // --- Journal Generation ---

  const handleAutoJournal = async () => {
    if (isGenerating) return;
    if (!authInfo?.id) return toast.error("Sign in required");

    // Save state before generating
    await saveLogState({ notes: dailyNote, mood: currentMood });

    setIsGenerating(true);

    try {
        const completedList = habits
            .filter(h => dailyLog?.completed_habit_ids?.includes(h.id))
            .map(h => h.title).join(", ");

        const missedList = habits
            .filter(h => !dailyLog?.completed_habit_ids?.includes(h.id))
            .map(h => h.title).join(", ");

        const prompt = `
          Write a short, personal journal entry for today (${todayStr}).

          Context:
          - Mood: ${currentMood}
          - Completed Tasks: ${completedList || "Just relaxing"}
          - Untouched Tasks: ${missedList || "None"}
          - My Notes: "${dailyNote}"

          Instructions:
          - Weave these facts into a cohesive narrative.
          - Be reflective but concise (max 150 words).
          - Use "I" statements.
        `;

        const headers = await getAuthHeaders();
        const enhanceRes = await fetch("/api/ai/enhance", {
             method: "POST",
             headers,
             body: JSON.stringify({ text: prompt })
        });

        if (!enhanceRes.ok) throw new Error("AI generation failed");
        const { text: generatedEntry } = await enhanceRes.json();

        const saveRes = await fetch("/api/journal/save", {
            method: "POST",
            headers,
            body: JSON.stringify({
                title: `Daily Log: ${new Date().toLocaleDateString()}`,
                content: generatedEntry,
                mood: currentMood,
                tags: ["auto-generated", "daily-tracker"],
            }),
        });

        if (!saveRes.ok) {
            const err = await saveRes.json();
            throw new Error(err.error || "Failed to save journal");
        }

        toast.success("Journal Created!");

    } catch (err) {
        console.error(err);
        toast.error("Failed to generate journal");
    } finally {
        setIsGenerating(false);
    }
  };

  const completionRate = habits.length > 0 
    ? Math.round(((dailyLog?.completed_habit_ids?.length || 0) / habits.length) * 100) 
    : 0;

  if (!authInfo?.id) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
            <CalendarCheck className="w-12 h-12 text-purple-600" />
            <h2 className="text-2xl font-semibold">Daily Tracker</h2>
            <p className="text-gray-500">Sign in to track your day.</p>
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b pb-6 dark:border-gray-800">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                   <span className="text-4xl">📝</span> Daily Command Center
                </h1>
                <p className="text-gray-500 mt-2">Track habits, log thoughts, and let AI write your story.</p>
            </div>
            <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-gray-400 uppercase tracking-wide">Today&apos;s Progress</p>
                <div className="flex items-end gap-2 justify-end">
                    <span className="text-4xl font-bold text-emerald-600">{completionRate}%</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LEFT COLUMN: Habits */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Progress Card (Mobile Only) */}
                <div className="md:hidden">
                    <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100">
                        <CardContent className="pt-6 flex items-center justify-between">
                            <span className="font-semibold text-emerald-800 dark:text-emerald-200">Daily Progress</span>
                            <span className="text-2xl font-bold text-emerald-600">{completionRate}%</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Habits List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500"/> Habits
                        </h3>
                        <Badge variant="outline">{dailyLog?.completed_habit_ids?.length || 0} / {habits.length}</Badge>
                    </div>

                    <AnimatePresence>
                        {habits.map((habit) => {
                            const isCompleted = dailyLog?.completed_habit_ids?.includes(habit.id);
                            return (
                                <motion.div 
                                    key={habit.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="group"
                                >
                                    <div 
                                        className={`
                                            flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer
                                            ${isCompleted 
                                                ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800' 
                                                : 'bg-white border-gray-200 hover:border-purple-300 dark:bg-gray-900 dark:border-gray-800'
                                            }
                                        `}
                                        onClick={() => toggleHabit(habit.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`
                                                w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                                                ${isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'}
                                            `}>
                                                {isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                                            </div>
                                            <span className={`font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100'}`}>
                                                {habit.title}
                                            </span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteHabit(habit.id); }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>

                    {/* Add New Habit */}
                    <div className="flex gap-3 pt-2">
                        <Input 
                            placeholder="Add a new habit (e.g. Drink Water)" 
                            value={newHabitTitle}
                            onChange={(e) => setNewHabitTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
                            className="bg-gray-50 dark:bg-gray-900"
                        />
                        <Button onClick={handleAddHabit} variant="secondary" disabled={isAdding}>
                            {isAdding ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Context & AI */}
            <div className="space-y-6">
                
                {/* Mood Selector */}
                <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Sun className="w-4 h-4 text-orange-500"/> How was today?
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-4 gap-2">
                            {MOODS.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => {
                                        setCurrentMood(m.value);
                                        saveLogState({ mood: m.value });
                                    }}
                                    className={`
                                        flex flex-col items-center justify-center p-2 rounded-lg transition-all
                                        ${currentMood === m.value ? 'bg-white shadow-sm ring-2 ring-purple-400 scale-105' : 'hover:bg-white/50'}
                                    `}
                                >
                                    <span className="text-2xl mb-1">{m.icon}</span>
                                    <span className="text-[10px] font-medium uppercase text-gray-500">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Notes */}
                <Card className="border-0 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                            <PenLine className="w-4 h-4 text-blue-500"/> Daily Brain Dump
                        </CardTitle>
                        <CardDescription>Jot down raw thoughts. AI will refine them.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea 
                            placeholder="I felt productive today, but struggled with..."
                            className="min-h-[120px] resize-none bg-gray-50 dark:bg-gray-900 border-0 focus-visible:ring-1"
                            value={dailyNote}
                            onChange={(e) => setDailyNote(e.target.value)}
                            onBlur={() => saveLogState({ notes: dailyNote })} // Auto-save on focus lost
                        />
                    </CardContent>
                </Card>

                {/* Generator */}
                <div className="pt-4">
                    <Button 
                        onClick={handleAutoJournal} 
                        disabled={isGenerating}
                        className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] transition-all"
                    >
                        {isGenerating ? (
                            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Writing...</>
                        ) : (
                            <><Sparkles className="w-5 h-5 mr-2" /> Generate Journal</>
                        )}
                    </Button>
                    <p className="text-xs text-center text-gray-400 mt-3">
                        Creates a Story entry from your completed habits & notes.
                    </p>
                </div>

            </div>
        </div>
    </div>
  );
}