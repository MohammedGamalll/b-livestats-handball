import { useEffect } from "react";
import { useGameStore } from "@/lib/gameStore";
import { subscribeLiveState } from "@/lib/liveStorage";

export default function LiveStoreSync() {
  useEffect(() => {
    const refresh = () => void useGameStore.persist.rehydrate();
    const unsub = subscribeLiveState(refresh);
    const onHide = () => {
      const s = useGameStore.getState();
      if (s.clockRunning) s.stopClock();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      unsub();
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);
  return null;
}
