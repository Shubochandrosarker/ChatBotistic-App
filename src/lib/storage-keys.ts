// Browser-storage keys, namespaced to the Chatbotistic brand.
//
// These were previously prefixed `wpistic-`. Renaming them outright
// would have silently reset every existing user: anyone on the dark
// theme would be flipped back to light, the onboarding checklist would
// reappear on an established org, and every notification would show as
// unseen again. So each key carries the name it used to have, and reads
// fall back to it once before the value is re-homed under the new name.

export interface NamespacedKey {
  /** Current key. All writes go here. */
  key: string;
  /** Pre-rebrand key, read once if `key` is absent. */
  legacy: string;
}

export const THEME_KEY: NamespacedKey = {
  key: "chatbotistic-theme",
  legacy: "wpistic-theme",
};

export const NOTIFS_SEEN_KEY: NamespacedKey = {
  key: "chatbotistic-notifs-seen",
  legacy: "wpistic-notifs-seen",
};

export const ONBOARDING_DISMISSED_KEY: NamespacedKey = {
  key: "chatbotistic-onboarding-dismissed",
  legacy: "wpistic-onboarding-dismissed",
};

/**
 * Read a namespaced key, transparently adopting any value left behind
 * under the pre-rebrand name. The migration is write-through: once a
 * legacy value is found it is copied to the new key and the old one is
 * removed, so the fallback path runs at most once per browser.
 *
 * Safe to call when storage is unavailable (Safari private mode, an
 * embedded webview with cookies blocked) — returns null rather than
 * throwing.
 */
export function readNamespaced({ key, legacy }: NamespacedKey): string | null {
  try {
    const current = window.localStorage.getItem(key);
    if (current !== null) return current;

    const inherited = window.localStorage.getItem(legacy);
    if (inherited !== null) {
      window.localStorage.setItem(key, inherited);
      window.localStorage.removeItem(legacy);
    }
    return inherited;
  } catch {
    return null;
  }
}

/** Write a namespaced key, ignoring storage failures. */
export function writeNamespaced({ key }: NamespacedKey, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the preference just won't persist.
  }
}
