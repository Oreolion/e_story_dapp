/** Resolve only canonical uploads owned by the domain user, never an arbitrary URL. */
export function ownedAudioPath(value: string, ownerId: string): string | null {
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(ownerId)) return null;
    const prefix = `/storage/v1/object/public/story-audio/${ownerId}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const file = url.pathname.slice(prefix.length);
    // Uploads use one server-generated filename. Reject traversal and encoded separators.
    if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(file) || file.includes("..")) return null;
    return `${ownerId}/${file}`;
  } catch {
    return null;
  }
}
