const timestamp =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export type FeedCursor = { created_at: string | null; id: string };
export function encodeFeedCursor(row: FeedCursor) {
  return Buffer.from(
    JSON.stringify({ created_at: row.created_at, id: row.id }),
  ).toString("base64url");
}
export function feedPageInput(params: URLSearchParams) {
  const size = params.get("limit") ?? "20";
  const scope = params.get("scope") ?? "latest";
  const search = (params.get("q") ?? "").trim();
  if (
    !/^(?:[1-9]|[1-4]\d|50)$/.test(size) ||
    !["latest", "following", "trending"].includes(scope) ||
    search.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(search)
  )
    throw new Error("Invalid feed request");
  let cursor: FeedCursor | null = null;
  const raw = params.get("cursor");
  if (raw) {
    if (raw.length > 400 || !/^[\w-]+$/.test(raw))
      throw new Error("Invalid cursor");
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      !value ||
      Object.keys(value).length !== 2 ||
      (value.created_at !== null &&
        (typeof value.created_at !== "string" ||
          !timestamp.test(value.created_at) ||
          !Number.isFinite(Date.parse(value.created_at)))) ||
      typeof value.id !== "string" ||
      !uuid.test(value.id)
    )
      throw new Error("Invalid cursor");
    cursor = value as FeedCursor;
  }
  return { limit: Number(size), scope, search, cursor };
}

export function cursorFilter(cursor: FeedCursor) {
  // Both fields have been validated; do not interpolate arbitrary PostgREST syntax.
  if (cursor.created_at === null)
    return `and(created_at.is.null,id.lt.${cursor.id}),created_at.not.is.null`;
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}

export function feedSearchFilter(search: string) {
  // A literal, case-insensitive regex preserves title/body substring search.
  // Escape regex operators, then quote the PostgREST value (including quotes
  // and backslashes). Never interpolate unquoted search text into .or().
  const literal = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = JSON.stringify(literal);
  return `title.imatch.${value},content.imatch.${value}`;
}
