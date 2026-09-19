import type { StateStorage } from "zustand/middleware";

const CHANNEL = "b-livestats-sync";

function persistRevOf(raw: string | null): number {
  if (!raw) return -1;
  try {
    const parsed = JSON.parse(raw) as { state?: { persistRev?: number } };
    return parsed.state?.persistRev ?? 0;
  } catch {
    return -1;
  }
}

function logFingerprint(raw: string | null): string {
  if (!raw) return "";
  try {
    const log = (JSON.parse(raw) as { state?: { log?: unknown } }).state?.log ?? [];
    return JSON.stringify(log);
  } catch {
    return "";
  }
}

export function shouldWrite(incoming: string, existing: string | null): boolean {
  if (!existing) return true;
  const nextRev = persistRevOf(incoming);
  const prevRev = persistRevOf(existing);
  if (nextRev < prevRev) return false;
  if (nextRev > prevRev) return true;
  return logFingerprint(incoming) === logFingerprint(existing);
}

function notifyPeers() {
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage("changed");
    ch.close();
  } catch {
    /* ignore */
  }
}

function browserStorage(): StateStorage {
  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name);
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        const existing = localStorage.getItem(name);
        if (!shouldWrite(value, existing)) return;
        localStorage.setItem(name, value);
        notifyPeers();
      } catch {
        /* quota / private mode */
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
}

function electronStorage(): StateStorage {
  const api = window.electronAPI!;
  return {
    getItem: (name) => api.getLiveState(name),
    setItem: async (name, value) => {
      await api.setLiveState(name, value);
    },
    removeItem: (name) => api.removeLiveState(name),
  };
}

export function createLiveStateStorage(): StateStorage {
  if (typeof window !== "undefined" && window.electronAPI?.getLiveState) {
    return electronStorage();
  }
  return browserStorage();
}

export function subscribeLiveState(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const unsubs: Array<() => void> = [];

  if (window.electronAPI?.onLiveStateChanged) {
    unsubs.push(window.electronAPI.onLiveStateChanged(onChange));
  }

  const onStorage = (e: StorageEvent) => {
    if (e.key === "b-livestats") onChange();
  };
  window.addEventListener("storage", onStorage);
  unsubs.push(() => window.removeEventListener("storage", onStorage));

  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = () => onChange();
    unsubs.push(() => ch.close());
  } catch {
    /* ignore */
  }

  return () => {
    for (const u of unsubs) u();
  };
}
