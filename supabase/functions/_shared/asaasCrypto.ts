// Server-side only cryptographic helpers for future Asaas subaccount credentials.
// AES-256-GCM payload: v1.<96-bit IV>.<ciphertext>.<128-bit authTag>, Base64URL.

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const IV_BYTES = 12;
const TAG_BYTES = 16;
const VERSION = "v1";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_base64url");
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) result[index] = binary.charCodeAt(index);
  return result;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(left.length + right.length);
  result.set(left);
  result.set(right, left.length);
  return result;
}

async function importMasterKey(masterSecret: string): Promise<CryptoKey> {
  if (masterSecret.length < 32) throw new Error("ASAAS_CRYPTO_INVALID_MASTER_KEY");
  // The stored random secret is hashed once to obtain exactly 256 key bits; no password/store derivation.
  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(masterSecret));
  return await crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSubaccountApiKey(apiKey: string, masterSecret: string): Promise<string> {
  if (!apiKey || apiKey.length > 4096) throw new Error("ASAAS_CRYPTO_INVALID_INPUT");
  const key = await importMasterKey(masterSecret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, encoder.encode(apiKey)));
  const ciphertext = encrypted.slice(0, -TAG_BYTES);
  const authTag = encrypted.slice(-TAG_BYTES);
  return [VERSION, bytesToBase64Url(iv), bytesToBase64Url(ciphertext), bytesToBase64Url(authTag)].join(".");
}

export async function decryptSubaccountApiKey(payload: string, masterSecret: string): Promise<string> {
  try {
    const [version, ivText, ciphertextText, authTagText, extra] = payload.split(".");
    if (version !== VERSION || extra !== undefined || !ivText || !ciphertextText || !authTagText) {
      throw new Error("ASAAS_CRYPTO_INVALID_PAYLOAD");
    }
    const iv = base64UrlToBytes(ivText);
    const ciphertext = base64UrlToBytes(ciphertextText);
    const authTag = base64UrlToBytes(authTagText);
    if (iv.length !== IV_BYTES || authTag.length !== TAG_BYTES || ciphertext.length === 0) {
      throw new Error("ASAAS_CRYPTO_INVALID_PAYLOAD");
    }
    const key = await importMasterKey(masterSecret);
    const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, concatBytes(ciphertext, authTag));
    return decoder.decode(clear);
  } catch (error) {
    if (error instanceof Error && error.message === "ASAAS_CRYPTO_INVALID_MASTER_KEY") throw error;
    if (error instanceof Error && error.message === "ASAAS_CRYPTO_INVALID_PAYLOAD") throw error;
    throw new Error("ASAAS_CRYPTO_INTEGRITY_ERROR");
  }
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintSubaccountApiKey(apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("ASAAS_FINGERPRINT_INVALID_INPUT");
  return `sha256:${toHex(await sha256Bytes(apiKey))}`;
}

export function generateWebhookAuthToken(): string {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashWebhookAuthToken(token: string): Promise<string> {
  if (!token) throw new Error("ASAAS_WEBHOOK_TOKEN_INVALID_INPUT");
  return toHex(await sha256Bytes(token));
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index % left.length] ?? 0) ^ (right[index % right.length] ?? 0);
  }
  return difference === 0;
}

export async function verifyWebhookAuthToken(receivedToken: string, expectedSha256Hex: string): Promise<boolean> {
  if (!receivedToken || !/^[a-f0-9]{64}$/i.test(expectedSha256Hex)) return false;
  const receivedHash = await sha256Bytes(receivedToken);
  const expectedHash = Uint8Array.from(expectedSha256Hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  return constantTimeBytesEqual(receivedHash, expectedHash);
}
