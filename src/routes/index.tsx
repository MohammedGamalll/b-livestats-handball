import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import splashAsset from "@/assets/livestats-splash.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "B LiveStats — Handball Statistics" },
      { name: "description", content: "Live handball game statistics, rosters, and scoring." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const nav = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => nav({ to: "/home" }), 450);
  };

  return (
    <div
      className={`min-h-screen w-full bg-black flex items-center justify-center overflow-hidden transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100 animate-fade-in"
      }`}
    >
      <div className="relative aspect-[948/626] max-w-full max-h-screen w-[min(100vw,calc(100vh*948/626))]">
        <img
          src={splashAsset}
          alt=""
          className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none"
          draggable={false}
        />
        {/* Invisible hotspot centered on the b-logo in the image */}
        <button
          type="button"
          aria-label="Enter B LiveStats"
          onClick={enter}
          className="group absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[54%] w-[16%] aspect-square rounded-full cursor-pointer focus:outline-none"
        >
          <span className="absolute inset-0 rounded-full ring-0 group-hover:ring-4 group-focus:ring-4 ring-white/25 transition-all" />
          <span className="absolute inset-0 rounded-full animate-ping bg-white/5 opacity-60 group-hover:opacity-100" />
        </button>
      </div>
    </div>
  );
}
