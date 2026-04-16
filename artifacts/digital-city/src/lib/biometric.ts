// WebAuthn-based biometric authentication — zero external dependencies
// Uses the browser's built-in platform authenticator (Touch ID / Face ID / fingerprint)

const STORE_KEY = "sanad_biometric_v2";

interface BiometricStore {
  credentialId: string;   // base64url-encoded credential ID
  sessionJson: string;    // serialised DcSession to restore
}

// ── Encode / decode helpers ──────────────────────────────────────────────────
function b64uEncode(buf: ArrayBuffer): string {
  let str = "";
  new Uint8Array(buf).forEach(b => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function b64uDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Returns true if the browser supports platform authenticators at all. */
export function isBiometricSupported(): boolean {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials?.create &&
    navigator.credentials?.get
  );
}

/** Async check — returns true only if a platform authenticator is actually present. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** True if the user has already registered a biometric credential on this device. */
export function hasBiometricRegistered(): boolean {
  return !!localStorage.getItem(STORE_KEY);
}

/**
 * Register a platform authenticator credential.
 * The serialised session is stored alongside the credential ID — biometric
 * auth simply proves the user is present, then returns the stored session.
 */
export async function registerBiometric(sessionJson: string): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId    = crypto.getRandomValues(new Uint8Array(16));

  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: "سند · Sanad",
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: "sanad-user",
          displayName: "Sanad",
        },
        pubKeyCredParams: [
          { alg: -7,   type: "public-key" },  // ES256
          { alg: -257, type: "public-key" },  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;

    const record: BiometricStore = {
      credentialId: b64uEncode(credential.rawId),
      sessionJson,
    };
    localStorage.setItem(STORE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Authenticate using the registered credential.
 * Returns the stored sessionJson string on success, null otherwise.
 */
export async function authenticateWithBiometric(): Promise<string | null> {
  const raw = localStorage.getItem(STORE_KEY);
  if (!raw) return null;

  try {
    const record: BiometricStore = JSON.parse(raw);
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credId    = b64uDecode(record.credentialId);

    const result = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ id: credId, type: "public-key" }],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!result) return null;
    return record.sessionJson;
  } catch {
    return null;
  }
}

/** Remove the stored biometric credential (e.g. on logout). */
export function clearBiometric(): void {
  localStorage.removeItem(STORE_KEY);
}
