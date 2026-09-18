import { useQuery } from "@tanstack/react-query";
import { getMatchDetail } from "@/lib/db.functions";
import { useGameStore, type TeamSetup } from "@/lib/gameStore";
import { maxPeriodFromEvents } from "@/lib/gkAttribution";

const emptyTeam: TeamSetup = {
  name: "",
  shortName: "",
  shortCode: "",
  longCode: "",
  color: "#00a040",
  coaches: [],
  players: [],
};

export function useMatchReport(matchId?: string) {
  const liveSetupComplete = useGameStore((s) => s.setupComplete);
  const liveTeam1 = useGameStore((s) => s.team1);
  const liveTeam2 = useGameStore((s) => s.team2);
  const liveScore1 = useGameStore((s) => s.score1);
  const liveScore2 = useGameStore((s) => s.score2);
  const liveLog = useGameStore((s) => s.log);
  const liveInfo = useGameStore((s) => s.info);
  const liveHalf = useGameStore((s) => s.half);
  const liveTeam1Direction = useGameStore((s) => s.team1Direction);
  const liveHalfDirections = useGameStore((s) => s.halfDirections);
  const liveTimeouts1 = useGameStore((s) => s.timeouts1);
  const liveTimeouts2 = useGameStore((s) => s.timeouts2);
  const liveShootoutRounds = useGameStore((s) => s.shootoutRounds);

  const q = useQuery({
    queryKey: ["match-detail", matchId],
    queryFn: () => getMatchDetail({ data: { id: matchId! } }),
    enabled: Boolean(matchId),
  });

  const archived = Boolean(matchId);
  const loading = archived && q.isLoading;
  const missing = archived && !q.isLoading && !q.data;
  const ready = archived ? Boolean(q.data) : liveSetupComplete;

  const log = archived ? q.data?.log ?? [] : liveLog;
  const team1 = archived ? q.data?.team1 ?? emptyTeam : liveTeam1;
  const team2 = archived ? q.data?.team2 ?? emptyTeam : liveTeam2;
  const score1 = archived ? q.data?.score1 ?? 0 : liveScore1;
  const score2 = archived ? q.data?.score2 ?? 0 : liveScore2;
  const info = archived ? q.data?.info ?? liveInfo : liveInfo;
  const timeouts1 = archived
    ? log.filter((e) => e.team === 1 && e.action === "TIMEOUT").length
    : liveTimeouts1;
  const timeouts2 = archived
    ? log.filter((e) => e.team === 2 && e.action === "TIMEOUT").length
    : liveTimeouts2;
  const shootoutRounds = archived ? [] : liveShootoutRounds;
  const team1Direction = archived ? "left" as const : liveTeam1Direction;
  const halfDirections = archived ? {} : liveHalfDirections;
  const half = archived
    ? maxPeriodFromEvents(log, info.halves || 2)
    : liveHalf;

  return {
    archived,
    loading,
    missing,
    ready,
    team1,
    team2,
    score1,
    score2,
    log,
    info,
    timeouts1,
    timeouts2,
    shootoutRounds,
    team1Direction,
    halfDirections,
    half,
  };
}
