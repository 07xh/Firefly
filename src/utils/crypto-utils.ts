import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

/**
 * Encrypt rendered HTML with AES-256-GCM using a PBKDF2-derived key.
 * Fresh random salt and IV are generated on every build so updating an
 * article never reuses a GCM nonce under the same password-derived key.
 *
 * Output format: base64(salt[16] + iv[12] + authTag[16] + ciphertext)
 */
export function encryptContent(
	html: string,
	password: string,
	_slug: string,
): string {
	const salt = randomBytes(SALT_LENGTH);
	const iv = randomBytes(IV_LENGTH);
	const key = pbkdf2Sync(
		password,
		salt,
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		"sha256",
	);

	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const encrypted = Buffer.concat([
		cipher.update(html, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();

	const result = Buffer.concat([salt, iv, authTag, encrypted]);
	return result.toString("base64");
}
