// Guest browsing mode — stored in sessionStorage so it clears when the tab closes.
const GUEST_KEY = "sanad_guest_mode";

/** Activate guest mode (user chose "Browse as Guest"). */
export function setGuestMode(): void {
  sessionStorage.setItem(GUEST_KEY, "1");
}

/** Is the current visitor in guest mode? */
export function isGuestMode(): boolean {
  return sessionStorage.getItem(GUEST_KEY) === "1";
}

/** Clear guest mode (e.g. when the user logs in). */
export function clearGuestMode(): void {
  sessionStorage.removeItem(GUEST_KEY);
}
