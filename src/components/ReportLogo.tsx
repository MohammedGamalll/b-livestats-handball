import logoAsset from "@/assets/b-livestats-logo.png";

export function ReportLogo({ className = "", size = "sm" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const imgCls = size === "lg" ? "h-28 w-28" : size === "md" ? "h-16 w-16" : "h-8 w-8";
  const textCls = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img src={logoAsset} alt="b Livestats" className={`${imgCls} object-contain`} />
      <span className={`${textCls} font-semibold tracking-widest`}>b Livestats</span>
    </div>
  );
}
