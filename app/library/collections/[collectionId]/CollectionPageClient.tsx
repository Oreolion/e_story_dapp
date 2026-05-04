"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { useBackgroundMode } from "@/contexts/BackgroundContext";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  FolderOpen,
  FileText,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  Globe,
  Lock,
} from "lucide-react";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { StoryCollection } from "@/app/types/index";

export default function CollectionPageClient() {
  const router = useRouter();
  const params = useParams();
  const collectionId = params.collectionId as string;
  const { getAccessToken } = useAuth();

  useBackgroundMode("library");

  const [collection, setCollection] = useState<StoryCollection | null>(null);
  const [stories, setStories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add stories from user's library
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [userStories, setUserStories] = useState<any[]>([]);
  const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const fetchCollection = async () => {
    const token = await getAccessToken();
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/stories/collections/${collectionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setCollection(data.collection);
      setStories(data.stories || []);
    } catch {
      toast.error("Failed to load collection");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (collectionId) fetchCollection();
  }, [collectionId]);

  const handleEdit = async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/stories/collections/${collectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: editTitle, description: editDesc }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Collection updated");
      setIsEditOpen(false);
      fetchCollection();
    } catch {
      toast.error("Failed to update collection");
    }
  };

  const handleRemoveStory = async (storyId: string) => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/stories/collections/${collectionId}/stories`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ story_id: storyId }),
      });
      if (!res.ok) throw new Error("Failed to remove");
      toast.success("Story removed from collection");
      fetchCollection();
    } catch {
      toast.error("Failed to remove story");
    }
  };

  const handleOpenAdd = async () => {
    const token = await getAccessToken();
    if (!token) return;
    try {
      const res = await fetch("/api/stories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const { stories: all } = await res.json();
        // Filter out stories already in this collection
        const existingIds = new Set(stories.map((s: any) => s.id));
        setUserStories((all || []).filter((s: any) => !existingIds.has(s.id)));
      }
    } catch {
      // ignore
    }
    setSelectedAdd(new Set());
    setIsAddOpen(true);
  };

  const handleAddStories = async () => {
    if (selectedAdd.size === 0) return;
    const token = await getAccessToken();
    if (!token) return;
    setIsAdding(true);
    try {
      const res = await fetch(`/api/stories/collections/${collectionId}/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ story_ids: Array.from(selectedAdd) }),
      });
      if (!res.ok) throw new Error("Failed to add");
      toast.success(`Added ${selectedAdd.size} stories`);
      setIsAddOpen(false);
      fetchCollection();
    } catch {
      toast.error("Failed to add stories");
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <BrandedLoader size="md" message="Loading collection..." />
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Collection not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/library")}>
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/library")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Library
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditTitle(collection.title);
              setEditDesc(collection.description || "");
              setIsEditOpen(true);
            }}
          >
            <Edit className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenAdd}>
            <Plus className="w-4 h-4 mr-1" /> Add Stories
          </Button>
        </div>
      </div>

      {/* Collection Info */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="card-elevated rounded-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-[hsl(var(--memory-500)/0.1)]">
                <FolderOpen className="w-6 h-6 text-[hsl(var(--memory-500))]" />
              </div>
              <div>
                <CardTitle className="text-2xl">{collection.title}</CardTitle>
                {collection.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{collection.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{collection.story_count} {collection.story_count === 1 ? "story" : "stories"}</span>
                  <Badge variant="outline" className="text-xs">
                    {collection.is_public ? (
                      <><Globe className="w-3 h-3 mr-1" /> Public</>
                    ) : (
                      <><Lock className="w-3 h-3 mr-1" /> Private</>
                    )}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Stories List */}
      {stories.length === 0 ? (
        <Card className="card-elevated rounded-xl">
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="w-12 h-12 mx-auto text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              No stories in this collection yet. Add some from your library.
            </p>
            <Button variant="outline" onClick={handleOpenAdd}>
              <Plus className="w-4 h-4 mr-2" /> Add Stories
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {stories.map((story: any, index: number) => (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.03 }}
              >
                <Card
                  className="card-elevated rounded-xl cursor-pointer hover:shadow-lg transition-all group"
                  onClick={() => router.push(`/story/${story.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="text-sm font-bold text-gray-400 w-6 text-center">{index + 1}</div>
                    <div className="p-2 rounded-lg bg-[hsl(var(--memory-500)/0.1)] flex-shrink-0">
                      <FileText className="w-4 h-4 text-[hsl(var(--memory-500))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-[hsl(var(--memory-500))] transition-colors">
                        {story.title || "Untitled"}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(story.story_date || story.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStory(story.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Edit Collection Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={!editTitle.trim()}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Stories Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Stories to Collection</DialogTitle>
            <DialogDescription>
              Select stories from your library to add.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-2 space-y-2">
            {userStories.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No more stories to add.</p>
            ) : (
              userStories.map((s: any) => {
                const isSelected = selectedAdd.has(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      const next = new Set(selectedAdd);
                      if (next.has(s.id)) next.delete(s.id);
                      else next.add(s.id);
                      setSelectedAdd(next);
                    }}
                    className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                      isSelected
                        ? "border-[hsl(var(--memory-500))] bg-[hsl(var(--memory-500)/0.05)]"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? "bg-[hsl(var(--memory-500))] border-[hsl(var(--memory-500))]" : "border-gray-300"
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                          {s.title || "Untitled"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(s.story_date || s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddStories}
              disabled={selectedAdd.size === 0 || isAdding}
              className="bg-gradient-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))]"
            >
              {isAdding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add {selectedAdd.size} {selectedAdd.size === 1 ? "Story" : "Stories"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
