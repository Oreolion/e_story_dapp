import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

function detectAvatarType(buffer: Buffer): { contentType: string; extension: string } | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e &&
    buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a &&
    buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    buffer.slice(0, 4).toString("ascii") === "RIFF" &&
    buffer.slice(8, 12).toString("ascii") === "WEBP"
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return null;
}

function isOwnedAvatarUrl(value: string, userId: string): boolean {
  try {
    const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    const avatarUrl = new URL(value);
    const expectedPrefix = `/storage/v1/object/public/avatars/${userId}/avatar.`;
    return avatarUrl.origin === storageOrigin && avatarUrl.pathname.startsWith(expectedPrefix);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const userId = await resolveUserId(authResult);
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Image must be 5 MB or smaller" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detected = detectAvatarType(buffer);
    if (!detected) {
      return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const path = `${userId}/avatar.${detected.extension}`;
    const { error: uploadError } = await admin.storage
      .from("avatars")
      .upload(path, buffer, {
        contentType: detected.contentType,
        cacheControl: "3600",
        upsert: true,
      });
    if (uploadError) {
      console.error("[PROFILE_POST] avatar upload failed:", uploadError);
      return NextResponse.json({ error: "Avatar upload failed" }, { status: 500 });
    }

    const { data: publicUrl } = admin.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await admin
      .from("users")
      .update({ avatar: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (updateError) {
      console.error("[PROFILE_POST] avatar profile update failed:", updateError);
      return NextResponse.json({ error: "Avatar update failed" }, { status: 500 });
    }

    const staleAvatarPaths = ["jpg", "png", "webp"]
      .filter((extension) => extension !== detected.extension)
      .map((extension) => `${userId}/avatar.${extension}`);
    const { error: staleAvatarError } = await admin.storage
      .from("avatars")
      .remove(staleAvatarPaths);
    if (staleAvatarError) {
      console.warn("[PROFILE_POST] stale avatar cleanup failed:", staleAvatarError.message);
    }

    return NextResponse.json({ success: true, url: avatarUrl });
  } catch (error) {
    console.error("[PROFILE_POST] unexpected error:", error);
    return NextResponse.json({ error: "Avatar upload failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(request);
    if (isAuthError(authResult)) return authResult;
    const authenticatedUserId = await resolveUserId(authResult);

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
    const authenticatedUserId = await resolveUserId(authResult);

    const updates = await request.json();

    // Validate and sanitize updates — only allow safe fields
    const allowedFields = ['name', 'bio', 'avatar'];
    const validUpdates: Record<string, string> = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key) && typeof updates[key] === "string") {
        if (key === "avatar") {
          if (!isOwnedAvatarUrl(updates[key], authenticatedUserId)) {
            return NextResponse.json({ error: "Invalid avatar URL" }, { status: 400 });
          }
          validUpdates.avatar = updates[key];
        } else {
          const maxLength = key === "name" ? 100 : 500;
          validUpdates[key] = updates[key].trim().slice(0, maxLength);
        }
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
