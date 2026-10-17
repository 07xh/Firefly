const COOKIE_NAME = "__Host-firefly_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AdminAuthEnv = {
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

type SessionPayload = {
  sub: "admin";
  iat: number;
  exp: number;
};

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function getCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === COOKIE_NAME) {
      return item.slice(separator + 1).trim();
    }
  }
  return null;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function getAdminAuthEnv(locals: unknown): AdminAuthEnv {
  return (locals as { runtime?: { env?: AdminAuthEnv } }).runtime?.env ?? {};
}

export function authConfigReady(env: AdminAuthEnv): boolean {
  return typeof env.ADMIN_PASSWORD === "string" &&
    env.ADMIN_PASSWORD.length >= 12 &&
    typeof env.ADMIN_SESSION_SECRET === "string" &&
    new TextEncoder().encode(env.ADMIN_SESSION_SECRET).length >= 32;
}

export async function passwordMatches(
  supplied: string,
  expected: string,
): Promise<boolean> {
  // Compare fixed-size digests to avoid a direct early-exit string comparison.
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

export async function createSessionToken(
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: SessionPayload = {
    sub: "admin",
    iat: nowSeconds,
    exp: nowSeconds + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    new TextEncoder().encode(encodedPayload),
  );
  return encodedPayload + "." + base64UrlEncode(new Uint8Array(signature));
}

export async function isValidSession(
  request: Request,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const token = getCookie(request);
  if (!token || token.length > 2048) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  try {
    const signature = base64UrlDecode(parts[1]);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      signature,
      new TextEncoder().encode(parts[0]),
    );
    if (!validSignature) return false;
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[0])),
    ) as Partial<SessionPayload>;
    return payload.sub === "admin" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= nowSeconds + 60 &&
      payload.exp > nowSeconds &&
      payload.exp - payload.iat === SESSION_TTL_SECONDS;
  } catch {
    return false;
  }
}

export async function sessionCookie(secret: string): Promise<string> {
  const token = await createSessionToken(secret);
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isSameOriginRequest(request: Request, url: URL): boolean {
  return request.headers.get("Origin") === url.origin;
}

export function jsonResponse(data: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    },
  });
}
