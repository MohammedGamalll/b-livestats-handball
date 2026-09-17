import type { ReactNode } from "react";

export function SetupPanel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bls-panel overflow-hidden ${className}`}>
      <div className="bls-panel-header flex items-center justify-between pl-6">
        <div>
          <div className="text-base font-semibold text-foreground tracking-tight">{title}</div>
          {subtitle && (
            <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
          )}
        </div>
        {actions}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="bls-section-title">{children}</h3>;
}
