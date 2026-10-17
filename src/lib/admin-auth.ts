const COOKIE_NAME = "__Host-firefly_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_KEY_PREFIX = "firefly-admin-session:";

export type AdminSessionStore = {
	get(key: string): Promise<string | null>;
	put(
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	): Promise<void>;
	delete(key: string): Promise<void>;
};

export type AdminAuthEnv = {
	ADMIN_PASSWORD?: string;
	SESSION?: AdminSessionStore;
};

type ReadyAdminAuthEnv = AdminAuthEnv & {
	ADMIN_PASSWORD: string;
	SESSION: AdminSessionStore;
};

type SessionRecord = {
	sub: "admin";
	createdAt: number;
	expiresAt: number;
};

function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (let i = 0; i < bytes.length; i += 0x8000) {
		binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	}
	return btoa(binary)
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}

function getCookieToken(request: Request): string | null {
	const cookieHeader = request.headers.get("Cookie") ?? "";
	for (const item of cookieHeader.split(";")) {
		const separator = item.indexOf("=");
		if (separator < 0) continue;
		if (item.slice(0, separator).trim() === COOKIE_NAME) {
			const token = item.slice(separator + 1).trim();
			return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
		}
	}
	return null;
}

async function sessionKey(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	const hex = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
	return SESSION_KEY_PREFIX + hex;
}

export function getAdminAuthEnv(locals: unknown): AdminAuthEnv {
	return (locals as { runtime?: { env?: AdminAuthEnv } }).runtime?.env ?? {};
}

export function authConfigReady(
	env: AdminAuthEnv,
): env is ReadyAdminAuthEnv {
	return (
		typeof env.ADMIN_PASSWORD === "string" &&
		env.ADMIN_PASSWORD.length >= 12 &&
		typeof env.SESSION?.get === "function" &&
		typeof env.SESSION.put === "function" &&
		typeof env.SESSION.delete === "function"
	);
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
	for (let i = 0; i < left.length; i++) {
		difference |= left[i] ^ right[i];
	}
	return difference === 0;
}

export async function createSessionCookie(
	store: AdminSessionStore,
	nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
	const random = crypto.getRandomValues(new Uint8Array(32));
	const token = base64UrlEncode(random);
	const record: SessionRecord = {
		sub: "admin",
		createdAt: nowSeconds,
		expiresAt: nowSeconds + SESSION_TTL_SECONDS,
	};
	await store.put(
		await sessionKey(token),
		JSON.stringify(record),
		{ expirationTtl: SESSION_TTL_SECONDS },
	);
	return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

export async function isValidSession(
	request: Request,
	store: AdminSessionStore,
	nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
	const token = getCookieToken(request);
	if (!token) return false;

	try {
		const recordText = await store.get(await sessionKey(token));
		if (!recordText) return false;
		const record = JSON.parse(recordText) as Partial<SessionRecord>;
		return (
			record.sub === "admin" &&
			typeof record.createdAt === "number" &&
			typeof record.expiresAt === "number" &&
			record.createdAt <= nowSeconds + 60 &&
			record.expiresAt > nowSeconds &&
			record.expiresAt - record.createdAt === SESSION_TTL_SECONDS
		);
	} catch {
		return false;
	}
}

export async function revokeSession(
	request: Request,
	store: AdminSessionStore,
): Promise<void> {
	const token = getCookieToken(request);
	if (!token) return;
	try {
		await store.delete(await sessionKey(token));
	} catch {
		// The cookie is cleared even if KV is temporarily unavailable.
	}
}

export function clearSessionCookie(): string {
	return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isSameOriginRequest(request: Request, url: URL): boolean {
	return request.headers.get("Origin") === url.origin;
}

export function jsonResponse(
	data: unknown,
	status = 200,
	extraHeaders: HeadersInit = {},
): Response {
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
