import { useState, useRef, useEffect, type ReactNode } from "react";
import logoAsset from "@/assets/b-livestats-logo.png";

export function TopBar({ menu, actions }: { menu?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex h-11 items-center justify-between bg-black px-4 text-topbar-foreground text-sm font-medium tracking-wide select-none">
      <div className="flex items-center gap-8">{menu}</div>
      {/* Center: action buttons (replaced former logo position) */}
      <div className="flex items-center gap-4 text-white text-xs">{actions}</div>
      {/* Right: logo (static, not a link) */}
      <div className="flex items-center">
        <img src={logoAsset} alt="b Livestats" className="h-11 w-11 object-contain" />
        <span className="text-xs font-semibold tracking-widest">b Livestats</span>
      </div>
    </div>
  );
}

export function MenuItem({ label, children }: { label: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`px-2 py-1 uppercase ${open ? "text-accent-orange" : "hover:text-accent-orange"}`}
      >
        {label}
      </button>
      {children && open && (
        <div className="absolute left-0 top-full z-40 min-w-[220px] bg-topbar py-2 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuLink({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full px-4 py-2 text-left text-topbar-foreground hover:bg-white/10 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
