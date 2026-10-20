export interface SessionKV {
	get(key: string, type: "text"): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
}

export const SESSION_COOKIE = "__Host-firefly_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

type StoredSession = {
	kind: "firefly-admin-session";
	createdAt: number;
	expiresAt: number;
	// Proof bound to both this token and the current admin password.
	// Rotating the admin password invalidates every existing session.
	authTag: string;
};

function base64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

export async function hashText(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return base64Url(new Uint8Array(digest));
}

export async function sessionStorageKey(token: string): Promise<string> {
	return "session:" + (await hashText(token));
}

export function getSessionToken(request: Request): string | null {
	const cookie = request.headers.get("Cookie");
	if (!cookie) return null;
	for (const part of cookie.split(";")) {
		const separator = part.indexOf("=");
		if (separator < 0) continue;
		if (part.slice(0, separator).trim() === SESSION_COOKIE) {
			const token = part.slice(separator + 1).trim();
			return /^[A-Za-z0-9_-]{40,50}$/.test(token) ? token : null;
		}
	}
	return null;
}

export function createSessionToken(): string {
	return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function adminSessionAuthTag(token: string, adminPassword: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(adminPassword),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const proof = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode("firefly-admin-session:v2:" + token),
	);
	return base64Url(new Uint8Array(proof));
}

export async function storeAdminSession(
	store: SessionKV,
	token: string,
	adminPassword: string,
): Promise<void> {
	const now = Date.now();
	const session: StoredSession = {
		kind: "firefly-admin-session",
		createdAt: now,
		expiresAt: now + SESSION_TTL_SECONDS * 1000,
		authTag: await adminSessionAuthTag(token, adminPassword),
	};
	await store.put(await sessionStorageKey(token), JSON.stringify(session), {
		expirationTtl: SESSION_TTL_SECONDS,
	});
}

export async function validateAdminSession(
	store: SessionKV,
	token: string,
	adminPassword: string,
): Promise<boolean> {
	const key = await sessionStorageKey(token);
	const raw = await store.get(key, "text");
	if (!raw) return false;
	let session: StoredSession;
	try {
		session = JSON.parse(raw) as StoredSession;
	} catch {
		await store.delete(key);
		return false;
	}
	if (
		session.kind !== "firefly-admin-session" ||
		typeof session.expiresAt !== "number" ||
		session.expiresAt <= Date.now() ||
		typeof session.authTag !== "string" ||
		session.authTag !== (await adminSessionAuthTag(token, adminPassword))
	) {
		await store.delete(key);
		return false;
	}
	return true;
}

export function sessionCookie(
	token: string,
	maxAge = SESSION_TTL_SECONDS,
): string {
	return [
		SESSION_COOKIE + "=" + token,
		"Path=/",
		"HttpOnly",
		"Secure",
		"SameSite=Strict",
		"Max-Age=" + String(maxAge),
	].join("; ");
}

export async function clearAdminSession(
	store: SessionKV | undefined,
	token: string | null,
): Promise<void> {
	if (store && token) await store.delete(await sessionStorageKey(token));
}
