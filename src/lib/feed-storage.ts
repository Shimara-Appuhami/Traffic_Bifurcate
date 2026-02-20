const STORAGE_KEY = "traffic-bifurcate-feed";

export type PersistedFeedSnapshot = {
  site?: string;
  rootUrl: string;
  generatedAt?: string | null;
  json: string;
  xml: string;
  savedAt: string;
};

export function saveFeedSnapshot(snapshot: PersistedFeedSnapshot) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore quota or availability errors.
  }
}

export function loadFeedSnapshot(): PersistedFeedSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedFeedSnapshot) : null;
  } catch {
    return null;
  }
}

export function clearFeedSnapshot() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
