import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const { title, content, mood, tags, hasAudio, audioUrl, parentStoryId } = await request.json();

    // Validate input
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient();

    // Get user's wallet address for the story
    const { data: user, error: userError } = await admin
      .from("users")
      .select("wallet_address")
      .eq("id", authenticatedUserId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Insert story into database
    const { data: story, error: insertError } = await admin
      .from("stories")
      .insert({
        author_id: authenticatedUserId,
        author_wallet: user.wallet_address,
        title: title || `Journal Entry ${new Date().toLocaleDateString()}`,
        content,
        mood: mood || 'neutral',
        tags: tags || [],
        has_audio: !!hasAudio,
        audio_url: audioUrl || null,
        likes: 0,
        comments_count: 0,
        shares: 0,
        ...(parentStoryId ? { parent_story_id: parentStoryId } : {}),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[JOURNAL/SAVE] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to save journal entry' },
        { status: 500 }
      );
    }

    // Trigger AI analysis in the background (fire and forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const authHeader = request.headers.get("Authorization");
      fetch(`${appUrl}/api/ai/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          storyId: story.id,
          storyText: content,
        }),
      }).catch(err => console.error("[JOURNAL/SAVE] Analysis trigger failed:", err));
    } catch {
      // Non-critical: analysis can be retried later
    }

    // Trigger CRE verification in the background (fire and forget)
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const authHeader = request.headers.get("Authorization");
      if (authHeader) {
        fetch(`${appUrl}/api/cre/trigger`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ storyId: story.id }),
        }).catch(err => console.error("[JOURNAL/SAVE] CRE trigger failed:", err));
      }
    } catch {
      // Non-critical: verification can be triggered manually later
    }

    return NextResponse.json({
      success: true,
      data: story,
      message: 'Journal entry saved successfully!'
    });

  } catch (error) {
    console.error('Error saving journal entry:', error);
    return NextResponse.json(
      { error: 'Failed to save journal entry' },
      { status: 500 }
    );
  }
}
