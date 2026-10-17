// Dependency-free upload bounds shared by the media service, Convex and web.

// Cloudflare caps one proxied request body at 100 MB, and every upload to
// Convex storage crosses it. Checked before an upload URL is minted so an
// oversized file creates no server state (R21 keeps masters at 16-bit for
// the same reason).
export const MAX_UPLOAD_BYTES = 95_000_000;
