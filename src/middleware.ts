import { defineMiddleware } from "astro:middleware";

type AccessEnv = {
	CF_ACCESS_TEAM_DOMAIN?: string;
	CF_ACCESS_AUD?: string;
};

type AccessClaims = {
	iss?: string;
	aud?: string | string[];
	exp?: number;
	nbf?: number;
};

type AccessJwk = JsonWebKey & { kid?: string; alg?: string };

let cachedKeys: { expiresAt: number; keys: AccessJwk[] } | undefined;

function decodeBase64Url(value: string): Uint8Array {
	const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(segment: string): T {
	return JSON.parse(new TextDecoder().decode(decodeBase64Url(segment))) as T;
}

async function getAccessKeys(issuer: string): Promise<AccessJwk[]> {
	if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;

	const response = await fetch(`${issuer}/cdn-cgi/access/certs`);
	if (!response.ok) {
		throw new Error("Cloudflare Access public keys are unavailable");
	}

	const data = (await response.json()) as { keys?: AccessJwk[] };
	if (!Array.isArray(data.keys) || data.keys.length === 0) {
		throw new Error("Cloudflare Access returned no public keys");
	}

	cachedKeys = { keys: data.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
	return data.keys;
}

async function verifyAccessJwt(
	token: string,
	issuer: string,
	audience: string,
): Promise<boolean> {
	const parts = token.split(".");
	if (parts.length !== 3) return false;

	try {
		const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
		const claims = decodeJson<AccessClaims>(parts[1]);
		if (header.alg !== "RS256" || !header.kid) return false;
		if (
			claims.iss !== issuer ||
			typeof claims.exp !== "number" ||
			claims.exp <= Date.now() / 1000
		) {
			return false;
		}
		if (typeof claims.nbf === "number" && claims.nbf > Date.now() / 1000) {
			return false;
		}

		const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
		if (!audiences.includes(audience)) return false;

		const jwk = (await getAccessKeys(issuer)).find(
			(key) => key.kid === header.kid,
		);
		if (!jwk) return false;

		const publicKey = await crypto.subtle.importKey(
			"jwk",
			jwk,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["verify"],
		);
		const signature = decodeBase64Url(parts[2]);
		const signatureBuffer = new ArrayBuffer(signature.byteLength);
		new Uint8Array(signatureBuffer).set(signature);

		return crypto.subtle.verify(
			"RSASSA-PKCS1-v1_5",
			publicKey,
			signatureBuffer,
			new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
		);
	} catch {
		return false;
	}
}

function plainResponse(message: string, status: number): Response {
	return new Response(message, {
		status,
		headers: {
			"content-type": "text/plain; charset=utf-8",
			"cache-control": "no-store",
			"x-content-type-options": "nosniff",
			"referrer-policy": "no-referrer",
			"x-frame-options": "DENY",
			"content-security-policy": "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
			"permissions-policy": "camera=(), microphone=(), geolocation=()",
			"cross-origin-opener-policy": "same-origin",
		},
	});
}

export const onRequest = defineMiddleware(async (context, next) => {
	const pathname = context.url.pathname;
	const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
	const isAdminApi =
		pathname === "/api/admin" || pathname.startsWith("/api/admin/");
	if (!isAdminPage && !isAdminApi) return next();

	const env = (context.locals as { runtime?: { env?: AccessEnv } }).runtime?.env;
	const teamDomain = env?.CF_ACCESS_TEAM_DOMAIN?.trim()
		.replace(/^https?:\/\//, "")
		.replace(/\/$/, "");
	const audience = env?.CF_ACCESS_AUD?.trim();

	// Fail closed: never serve the admin interface if Access is not configured.
	if (!teamDomain || !audience) {
		return plainResponse(
			"Firefly admin is locked: configure CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD, " +
				"and protect both /admin/* and /api/admin/* with Cloudflare Access.",
			503,
		);
	}

	const issuer = `https://${teamDomain}`;
	const token = context.request.headers.get("CF-Access-Jwt-Assertion");
	if (!token) {
		if (isAdminApi) {
			return plainResponse(
				"Unauthorized: Cloudflare Access identity is required.",
				401,
			);
		}
		const login = new URL(
			`/cdn-cgi/access/login/${encodeURIComponent(audience)}`,
			context.url.origin,
		);
		login.searchParams.set("redirect_url", context.url.href);
		return Response.redirect(login.toString(), 302);
	}

	if (!(await verifyAccessJwt(token, issuer, audience))) {
		return plainResponse(
			"Forbidden: a valid Cloudflare Access identity is required.",
			403,
		);
	}

	const response = await next();
	const headers = new Headers(response.headers);
	headers.set("cache-control", "private, no-store");
	headers.set("x-content-type-options", "nosniff");
	headers.set("referrer-policy", "no-referrer");
	headers.set("x-frame-options", "DENY");
	headers.set(
		"content-security-policy",
		"frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
	);
	headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
	headers.set("cross-origin-opener-policy", "same-origin");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
});
