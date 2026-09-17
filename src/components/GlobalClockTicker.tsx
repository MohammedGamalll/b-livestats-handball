import { useEffect } from "react";

import { useGameStore } from "@/lib/gameStore";

export default function GlobalClockTicker() {
  const clockRunning = useGameStore((s) => s.clockRunning);
  const tick = useGameStore((s) => s.tick);

  useEffect(() => {
    if (!clockRunning) return;
    const timer = window.setInterval(() => tick(), 1000);
    return () => window.clearInterval(timer);
  }, [clockRunning, tick]);

  return null;
}