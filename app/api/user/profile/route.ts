import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const admin = createSupabaseAdminClient();

    // Fetch real user profile
    const { data: user, error } = await admin
      .from("users")
      .select("*")
      .eq("id", authenticatedUserId)
      .single();

    if (error || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch story count
    const { count: storyCount } = await admin
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("author_id", authenticatedUserId);

    // Build profile response (omit sensitive fields)
    const profile = {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      wallet_address: user.wallet_address,
      bio: user.bio || null,
      badges: user.badges || [],
      auth_provider: user.auth_provider,
      is_onboarded: user.is_onboarded,
      google_id: user.google_id || null,
      subscription_plan: user.subscription_plan || "free",
      subscription_expires_at: user.subscription_expires_at || null,
      followers_count: user.followers_count || 0,
      stats: {
        stories: storyCount || 0,
      },
      joinDate: user.created_at,
      lastActive: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      user: profile,
      data: profile,
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = authResult;

    const updates = await request.json();

    // Validate and sanitize updates — only allow safe fields
    const allowedFields = ['name', 'bio', 'avatar'];
    const validUpdates: Record<string, string> = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key) && typeof updates[key] === "string") {
        validUpdates[key] = updates[key].slice(0, 500); // Limit field length
      }
    }

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: updatedProfile, error } = await admin
      .from("users")
      .update(validUpdates)
      .eq("id", authenticatedUserId)
      .select()
      .single();

    if (error) {
      console.error("[PROFILE] Update error:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedProfile,
      message: 'Profile updated successfully!'
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
