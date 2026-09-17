import { Phone } from "lucide-react";

export type AppFooterVariant = "light" | "dark" | "report";

const base =
  "py-4 text-center text-[11px] tracking-wide uppercase leading-relaxed";

const variants: Record<AppFooterVariant, string> = {
  light: `${base} text-muted-foreground`,
  dark: `${base} text-white/50`,
  report: `${base} text-neutral-500 border-t border-neutral-200 mt-6 pt-4`,
};

export function AppFooter({
  variant = "light",
  className = "",
}: {
  variant?: AppFooterVariant;
  className?: string;
}) {
  return (
    <footer className={`${variants[variant]} ${className}`}>
      <div className="font-semibold mb-1">Created by PIXEL 01 للبرمجيات</div>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <a href="tel:01034029665" className="inline-flex items-center gap-1 hover:underline hover:opacity-80">
          <Phone className="h-3 w-3" /> 01034029665
        </a>
        <span className="opacity-40">|</span>
        <a href="tel:01044802022" className="inline-flex items-center gap-1 hover:underline hover:opacity-80">
          <Phone className="h-3 w-3" /> 01044802022
        </a>
      </div>
    </footer>
  );
}
