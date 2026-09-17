// Simple Web Audio sounds — no asset files needed.
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType = "sine", gain = 0.18) {
  const ac = getCtx();
  if (!ac) return;
  if (ac.state === "suspended") ac.resume().catch(() => {});
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime);
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.02);
}

export const sfx = {
  goal: () => { tone(880, 0.12, "triangle"); setTimeout(() => tone(1320, 0.18, "triangle"), 90); },
  miss: () => tone(220, 0.18, "sawtooth", 0.12),
  whistle: () => { tone(1500, 0.08, "square", 0.12); setTimeout(() => tone(1800, 0.12, "square", 0.1), 80); },
  buzzer: () => { tone(180, 0.6, "square", 0.22); setTimeout(() => tone(180, 0.6, "square", 0.22), 650); },
  card: () => tone(300, 0.25, "square", 0.15),
  deny: () => { tone(260, 0.18, "square", 0.18); setTimeout(() => tone(160, 0.28, "square", 0.2), 160); },
};

