// Hosted per-person signature images.
//
// Gmail and the new Outlook / Outlook on the web drop or refuse `data:` images in a pasted
// signature, so the copied HTML must point at real https URLs. Fixed artwork (official and DSP
// banners, LinkedIn icon) ships as static files with the page; this module only handles images
// that differ per person: the profile photo and a custom banner.
//
// Images live in Workers KV (free plan, no payment method needed) under their SHA-256, so a
// repeated upload is stored once, URLs never change, and they can be cached forever. KV is
// eventually consistent: a new image can take up to about a minute to be readable outside the
// region it was uploaded from, so a missing key is answered with no-store to avoid caching it.

export const IMAGE_PATH_PREFIX = '/img/';
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: number[] }> = {
  'image/png': { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  'image/jpeg': { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
};
const KEY_RE = /^[0-9a-f]{64}\.(png|jpg)$/;

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function detectType(bytes: Uint8Array): string | null {
  for (const [type, { magic }] of Object.entries(TYPES)) {
    if (magic.every((b, i) => bytes[i] === b)) return type;
  }
  return null;
}

/** POST /api/images — body is the raw PNG or JPEG. Returns { url }. Caller must be signed in. */
export async function uploadImage(req: Request, kv: KVNamespace, origin: string): Promise<Response> {
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BYTES) return error('too_large', 413);
  const body = await req.arrayBuffer();
  if (body.byteLength === 0) return error('empty', 400);
  if (body.byteLength > MAX_BYTES) return error('too_large', 413);

  // Trust the bytes, not the header: only real PNG/JPEG files are stored.
  const type = detectType(new Uint8Array(body, 0, Math.min(body.byteLength, 8)));
  if (!type) return error('unsupported_type', 415);

  const key = `${hex(await crypto.subtle.digest('SHA-256', body))}.${TYPES[type].ext}`;
  // Skip the write when the same image is already stored (free plan: 1,000 writes a day).
  const existing = await kv.get(key, 'stream');
  if (existing) await existing.cancel();
  else await kv.put(key, body, { metadata: { contentType: type } });
  return new Response(JSON.stringify({ url: `${origin}${IMAGE_PATH_PREFIX}${key}` }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** GET /img/<sha256>.<ext> — public, immutable. */
export async function serveImage(pathname: string, kv: KVNamespace): Promise<Response> {
  const key = pathname.slice(IMAGE_PATH_PREFIX.length);
  if (!KEY_RE.test(key)) return new Response('Not found', { status: 404 });
  const { value, metadata } = await kv.getWithMetadata<{ contentType?: string }>(key, 'stream');
  if (value === null) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(value, {
    headers: {
      'Content-Type': metadata?.contentType ?? (key.endsWith('.png') ? 'image/png' : 'image/jpeg'),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function error(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
