import { useEffect } from "react";

import { useGameStore } from "@/lib/gameStore";

export default function GlobalClockTicker() {
  const clockRunning = useGameStore((s) => s.clockRunning);
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    if (!clockRunning) return;
    tick();
    const timer = window.setInterval(() => tick(), 250);
    return () => window.clearInterval(timer);
  }, [clockRunning, tick]);

  return null;
}