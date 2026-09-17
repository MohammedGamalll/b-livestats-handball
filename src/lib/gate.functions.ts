function api() {
  const electronAPI = window.electronAPI;
  if (!electronAPI) {
    throw new Error("Desktop API is unavailable. Launch the app with Electron.");
  }
  return electronAPI;
}

export async function isUnlocked() {
  if (typeof window === "undefined" || !window.electronAPI) {
    return { unlocked: false };
  }
  return api().isUnlocked();
}

export async function unlockSite({ data }: { data: { password: string } }) {
  return api().unlockSite(data);
}

export async function lockSite() {
  return api().lockSite();
}
