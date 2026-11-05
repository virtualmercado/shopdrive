/** Mercado Pago's signed manifest uses URL data.id, never notification JSON. */
export async function verifyMercadoPagoSignature(req: Request, secret: string): Promise<boolean> {
  const signature = req.headers.get('x-signature');
  if (!signature || !secret) return false;
  const fields = new Map<string, string>();
  for (const part of signature.split(',')) {
    const match = /^\s*(ts|v1)\s*=\s*([^\s,]+)\s*$/.exec(part);
    if (!match || fields.has(match[1])) return false;
    fields.set(match[1], match[2]);
  }
  const ts = fields.get('ts');
  const hash = fields.get('v1');
  if (!ts || !/^\d+$/.test(ts) || !hash || !/^[a-fA-F0-9]{64}$/.test(hash)) return false;
  const url = new URL(req.url);
  if (url.searchParams.getAll('data.id').length > 1) return false;
  const id = url.searchParams.get('data.id');
  const requestId = req.headers.get('x-request-id');
  // Truly absent fields are omitted, as specified by Mercado Pago.
  // Current official Node SDK preserves case (Mercado Pago sdk-nodejs PR #439).
  const manifest = `${id === null ? '' : `id:${id};`}${requestId === null ? '' : `request-id:${requestId};`}ts:${ts};`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = new Uint8Array(hash.match(/.{2}/g)?.map(value => parseInt(value, 16)) ?? []);
  // WebCrypto performs HMAC verification without a string equality comparison.
  return crypto.subtle.verify('HMAC', key, bytes, encoder.encode(manifest));
}