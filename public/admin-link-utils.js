const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const UNSAFE_MARKUP_CHARACTERS = /[<>"'\\\\]/;

/**
 * Accept only ordinary web links and safe links relative to the current site.
 * Return a normalized address, or null when the value should not be inserted.
 */
export function normalizeEditorLinkAddress(value) {
  const address = String(value ?? "").trim();
  if (!address || address.length > 2048 || CONTROL_CHARACTERS.test(address)
    || UNSAFE_MARKUP_CHARACTERS.test(address)) {
    return null;
  }

  if (/^https?:\/\//i.test(address)) {
    try {
      const parsed = new URL(address);
      if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname) {
        return parsed.href;
      }
    } catch {
      // The address will be rejected below.
    }
    return null;
  }

  if (/^mailto:/i.test(address)) {
    const destination = address.slice(7);
    return destination.includes("@") && !/\s/.test(destination) ? address : null;
  }

  if (/^tel:/i.test(address)) {
    const number = address.slice(4);
    if (!/^\+?[0-9().\-\s]+$/.test(number)) return null;
    return "tel:" + number.replace(/\s+/g, "");
  }

  if (/^#[^\s<>"]+$/.test(address) && address !== "#") return address;
  if (/^\/(?!\/)[^\s<>"]*$/.test(address)) return address;
  if (/^(?:\.{1,2})\/[^\s<>"]+$/.test(address)) return address;
  return null;
}
