import { Link } from "@tanstack/react-router";

export function MatchReportLinks({ matchId, className }: { matchId: string; className?: string }) {
  return (
    <span className={className ?? "inline-flex items-center gap-2"}>
      <Link
        to="/stats"
        search={{ matchId }}
        className="text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:underline"
      >
        Box Score
      </Link>
      <Link
        to="/quarters"
        search={{ matchId }}
        className="text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:underline"
      >
        Quarters
      </Link>
      <Link
        to="/gk-report"
        search={{ matchId }}
        className="text-[10px] font-bold uppercase tracking-wider text-blue-700 hover:underline"
      >
        Goalkeeper
      </Link>
    </span>
  );
}
