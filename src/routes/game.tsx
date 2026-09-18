import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar, MenuItem, MenuLink } from "@/components/TopBar";
import { AppFooter } from "@/components/AppFooter";
import { HandballCourt } from "@/components/HandballCourt";
import { LiveStatsStrip } from "@/components/LiveStatsStrip";
import { ShootoutPanel } from "@/components/ShootoutPanel";
import { GoalPicker } from "@/components/GoalPicker";
import { ActionMenu, ACTION_GROUP_LABEL, type ActionPick } from "@/components/ActionMenu";
import { useGameStore, formatClock, periodLengthSec } from "@/lib/gameStore";
import type { MissZone } from "@/lib/gameStore";
import { STARTERS_REQUIRED, type ActionType } from "@/lib/handball";
import { downloadCsv, logToCsv } from "@/lib/exportCsv";
import { isPenaltyShot, penaltySpotForTeam, classifyShotZone, type CourtGeoZone } from "@/lib/court";
import { ConfirmSituationModal, type ConfirmResult } from "@/components/ConfirmSituationModal";
import { detectCurrentStrength, type DetectedStrength } from "@/lib/strength";
import { saveMatch as saveMatchFn } from "@/lib/db.functions";
import { sfx } from "@/lib/audio";
import { Printer, BarChart3, Monitor, ListOrdered } from "lucide-react";


export const Route = createFileRoute("/game")({
  component: GamePage,
});

function GamePage() {
  const setupComplete = useGameStore((s) => s.setupComplete);
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const score1 = useGameStore((s) => s.score1);
  const score2 = useGameStore((s) => s.score2);
  const possession = useGameStore((s) => s.possession);
  const setPossession = useGameStore((s) => s.setPossession);
  const clockSec = useGameStore((s) => s.clockSec);
  const clockRunning = useGameStore((s) => s.clockRunning);
  const startClock = useGameStore((s) => s.startClock);
  const stopClock = useGameStore((s) => s.stopClock);
  const setClockSec = useGameStore((s) => s.setClockSec);
  const setHalf = useGameStore((s) => s.setHalf);
  const half = useGameStore((s) => s.half);
  const team1Direction = useGameStore((s) => s.team1Direction);
  const logAction = useGameStore((s) => s.logAction);
  
  const log = useGameStore((s) => s.log);
  const reset = useGameStore((s) => s.reset);
  const info = useGameStore((s) => s.info);
  const periodLen = periodLengthSec(half, info.halves, info.halfLength, info.otLength);
  const periodOver = clockSec >= periodLen;
  const timeouts1 = useGameStore((s) => s.timeouts1);
  const timeouts2 = useGameStore((s) => s.timeouts2);
  const suspensions1 = useGameStore((s) => s.suspensions1);
  const suspensions2 = useGameStore((s) => s.suspensions2);
  const activeSuspensions = useGameStore((s) => s.activeSuspensions);
  const undoLast = useGameStore((s) => s.undoLast);
  const nav = useNavigate();
  const formation1 = useGameStore((s) => s.formation1);
  const formation2 = useGameStore((s) => s.formation2);
  const setFormationPos = useGameStore((s) => s.setFormationPos);
  const clearFormation = useGameStore((s) => s.clearFormation);
  const autoArrangeFormation = useGameStore((s) => s.autoArrangeFormation);
  const setPlayer = useGameStore((s) => s.setPlayer);
  const saveMatchServer = saveMatchFn;

  const [pregameOpen, setPregameOpen] = useState(false);
  const [pregameMins, setPregameMins] = useState("0");
  const [selected, setSelected] = useState<{ team: 1 | 2; no: string } | null>(null);
  // After picking a sub-action from the 4-button menu, we await a court click for the origin.
  const [pendingPick, setPendingPick] = useState<ActionPick | null>(null);
  // After court click for a shot, we hold the origin and open the goal picker.
  const [shotOrigin, setShotOrigin] = useState<{ team: 1 | 2; no: string; action: ActionType; subtype: string; x: number; y: number; mode: "placement" | "miss"; fb: boolean; zone?: CourtGeoZone } | null>(null);
  // Follow-up player picker after an event is logged.
  const [followUp, setFollowUp] = useState<{ kind: "assist" | "rebound" | "involver"; entryId: string; team: 1 | 2; bothTeams?: boolean } | null>(null);
  const [lastDefense, setLastDefense] = useState<NonNullable<import("@/lib/gameStore").LogEntry["defense"]> | null>(null);
  const updateLogEntry = useGameStore((s) => s.updateLogEntry);
  const [heatmap, setHeatmap] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [shootoutOpen, setShootoutOpen] = useState(false);
  const shootoutRounds = useGameStore((s) => s.shootoutRounds);
  const [timeoutPickerOpen, setTimeoutPickerOpen] = useState(false);
  // For BLOCK flow: after picking blocker from opponent, we remember it and open the court picker.
  const [blockerPickerOpen, setBlockerPickerOpen] = useState<{ shooterTeam: 1 | 2; shooterNo: string; fb: boolean } | null>(null);
  const [pendingBlockerNo, setPendingBlockerNo] = useState<string | null>(null);
  // Single merged confirmation (zone + strength + defense) opened after every scorable action.
  const [pendingConfirm, setPendingConfirm] = useState<
    | { entryId: string; teamN: 1 | 2; isShot: boolean; detectedZone: CourtGeoZone | null; detectedStrength: DetectedStrength }
    | null
  >(null);

  // Open the merged situation-confirmation modal for a freshly logged event.
  const openConfirm = (entryId: string, teamN: 1 | 2, opts: { isShot: boolean; detectedZone: CourtGeoZone | null }) => {
    const s = useGameStore.getState();
    const detected = detectCurrentStrength(s.team1, s.team2, teamN);
    setPendingConfirm({ entryId, teamN, isShot: opts.isShot, detectedZone: opts.detectedZone, detectedStrength: detected });
  };

  

  // play buzzer when the period clock reaches its length (00 → 30)
  const prevClock = useRef(clockSec);
  useEffect(() => {
    if (prevClock.current < periodLen && clockSec >= periodLen && soundOn) sfx.buzzer();
    prevClock.current = clockSec;
  }, [clockSec, periodLen, soundOn]);

  // play goal/card sounds when log grows
  const prevLogLen = useRef(log.length);
  useEffect(() => {
    if (log.length > prevLogLen.current && soundOn) {
      const last = log[0];
      if (last) {
        if (last.action === "GOAL" || last.action === "7M") sfx.goal();
        else if (last.action === "SHOT MISSED") sfx.miss();
        else if (last.action === "YELLOW" || last.action === "2-MIN" || last.action === "RED" || last.action === "BLUE") sfx.card();
        else if (last.action === "TIMEOUT") sfx.whistle();
      }
    }
    prevLogLen.current = log.length;
  }, [log, soundOn]);


  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (clockRunning) stopClock(); else if (!periodOver) startClock();
      } else if (e.key === "z" || e.key === "Z") {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); undoLast(); }
      }
      else if (e.key === "a" || e.key === "A") { if (selected) { logAction({ team: selected.team, playerNo: selected.no, action: "ASSIST" }); setSelected(null); } }
      else if (e.key === "t" || e.key === "T") { logAction({ team: selected?.team || possession || 1, action: "TIMEOUT" }); }
      else if (e.key === "p" || e.key === "P") { setPossession(possession === 1 ? 2 : 1); }
      else if (e.key === "h" || e.key === "H") { setHeatmap((v) => !v); }
      else if (e.key === "Escape") { setPendingPick(null); setSelected(null); setShotOrigin(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockRunning, clockSec, periodOver, selected, possession]);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated && !setupComplete) void nav({ to: "/" });
  }, [hydrated, setupComplete, nav]);

  if (!hydrated) return null;
  if (!setupComplete) return null;

  // Map the 4-button action menu pick into a flow:
  // - MADE   → wait for court click → goal placement
  // - MISSED → wait for court click → goal placement (where ball ended in mouth)
  // - FOUL   → log immediately (mapped to existing actions when possible)
  // - TURN OVER → log immediately as TURNOVER with subtype
  const handlePick = (pick: ActionPick) => {
    // BLOCK: require a shooter, then first prompt for the blocker (opponent team).
    if (pick.group === "MISSED" && pick.subtype === "BLOCK") {
      if (!selected) return;
      setBlockerPickerOpen({ shooterTeam: selected.team, shooterNo: selected.no, fb: pick.fb || false });
      return;
    }
    // Require a pre-selected player (clicked jersey card). Otherwise ignore.
    if (!selected) return;
    processPick(pick, selected);
  };



  const processPick = (pick: ActionPick, player: { team: 1 | 2; no: string }) => {
    const teamN = player.team;
    const no = player.no;
    // MADE + PENALTY → skip court click; open goal picker (placement) directly at the 7m spot; on pick → 7M goal.
    if (pick.group === "MADE" && pick.subtype === "PENALTY") {
      const spot = penaltySpotForTeam(teamN, team1Direction);
      setShotOrigin({ team: teamN, no, action: "7M", subtype: "PENALTY", x: spot.x, y: spot.y, mode: "placement", fb: pick.fb || false, zone: "7m" });
      return;
    }
    // MISSED + PENALTY → skip court click; open goal picker directly; then prompt for opponent fouler.
    if (pick.group === "MISSED" && pick.subtype === "PENALTY") {
      const spot = penaltySpotForTeam(teamN, team1Direction);
      setShotOrigin({ team: teamN, no, action: "SHOT MISSED", subtype: "PENALTY", x: spot.x, y: spot.y, mode: "miss", fb: pick.fb || false, zone: "7m" });
      return;
    }
    if (pick.group === "MADE" || pick.group === "MISSED") {
      setPendingPick(pick);
      return;
    }
    if (pick.group === "FOUL") {
      const map: Record<string, ActionType> = {
        "2M": "2-MIN",
        "YELLOW CARD": "YELLOW",
        "RED CARD": "RED",
        "BLUE CARD": "BLUE",
      };
      // FOUL → 7M is a foul that awarded a penalty; does NOT count as a goal.
      const action: ActionType = map[pick.subtype] || "FOUL";
      logAction({ team: teamN, playerNo: no, action, subtype: pick.subtype });
      setTimeout(() => {
        const last = useGameStore.getState().log[0];
        if (last) {
          setFollowUp({ kind: "involver", entryId: last.id, team: teamN });
          openConfirm(last.id, teamN, { isShot: false, detectedZone: null });
        }
      }, 0);
      setSelected(null);
      return;
    }
    if (pick.group === "TURNOVER") {
      logAction({ team: teamN, playerNo: no, action: "TURNOVER", subtype: pick.subtype });
      setTimeout(() => {
        const last = useGameStore.getState().log[0];
        if (!last) return;
        if (pick.subtype === "BAD PASS" || pick.subtype === "BALL HANDLING") {
          setFollowUp({ kind: "involver", entryId: last.id, team: teamN });
        }
        openConfirm(last.id, teamN, { isShot: false, detectedZone: null });
      }, 0);
      setSelected(null);
      return;
    }
  };

  // Step 1: user clicks on court. Zone auto-classified; final override happens in the merged confirm modal.
  const handleCourtClick = (x: number, y: number) => {
    if (!pendingPick) return;
    const detected = classifyShotZone({ action: "GOAL", x, y }) as CourtGeoZone | null;
    // BLOCK: no goal-frame picker — log immediately, then open merged confirmation.
    if (pendingPick.group === "MISSED" && pendingPick.subtype === "BLOCK") {
      const teamN: 1 | 2 = selected?.team ?? (possession || 1);
      const no = selected?.no ?? "";
      const fb = pendingPick.fb || false;
      logAction({
        team: teamN,
        playerNo: no,
        action: "SHOT MISSED",
        subtype: "BLOCK",
        x, y,
        fastBreak: fb,
        involverNo: pendingBlockerNo || undefined,
        zone: detected ?? undefined,
      });
      setTimeout(() => {
        const last = useGameStore.getState().log[0];
        if (last) {
          setFollowUp({ kind: "rebound", entryId: last.id, team: teamN, bothTeams: true });
          openConfirm(last.id, teamN, { isShot: true, detectedZone: detected });
        }
      }, 0);
      setPendingPick(null);
      setPendingBlockerNo(null);
      setSelected(null);
      return;
    }
    if (!selected) return;
    let action: ActionType;
    let mode: "placement" | "miss" = "placement";
    if (pendingPick.group === "MADE") {
      action = pendingPick.subtype === "PENALTY" ? "7M" : "GOAL";
    } else {
      // All MISSED subtypes except BLOCK show the goal frame in miss/zone mode, then prompt for rebound.
      if (pendingPick.subtype === "SAVE") action = "SHOT SAVED";
      else action = "SHOT MISSED";
      mode = "miss";
    }
    setShotOrigin({
      team: selected.team,
      no: selected.no,
      action,
      subtype: pendingPick.subtype,
      x, y, mode,
      fb: pendingPick.fb || false,
      zone: detected ?? undefined,
    });
    setPendingPick(null);
  };

  // Step 2: user picks goal placement
  const finishShotPlacement = (gx: number, gy: number) => {
    if (!shotOrigin) return;
    const teamN = shotOrigin.team;
    const isGoal = shotOrigin.action === "GOAL" || shotOrigin.action === "7M";
    logAction({
      team: teamN,
      playerNo: shotOrigin.no,
      action: shotOrigin.action,
      subtype: shotOrigin.subtype,
      x: shotOrigin.x,
      y: shotOrigin.y,
      goalX: gx,
      goalY: gy,
      fastBreak: shotOrigin.fb,
      zone: shotOrigin.zone,
    });
    const detectedZone = shotOrigin.zone ?? null;
    setTimeout(() => {
      const last = useGameStore.getState().log[0];
      if (last) {
        setFollowUp({ kind: isGoal ? "assist" : "rebound", entryId: last.id, team: teamN, bothTeams: !isGoal && shotOrigin.subtype === "BLOCK" });
        openConfirm(last.id, teamN, { isShot: true, detectedZone });
      }
    }, 0);
    setShotOrigin(null);
    setSelected(null);
  };

  function coordsToMissZone(gx: number, gy: number): MissZone {
    // Map a clicked position on the goal image to the legacy miss zones.
    if (gy <= 0.23) return gx < 0.5 ? "LEFT_CROSSBAR" : "RIGHT_CROSSBAR";
    if (gx <= 0.22) return "LEFT_CORNER";
    if (gx >= 0.78) return "RIGHT_CORNER";
    return "POST";
  }

  // Step 2 (miss): user clicks on goal image to mark where ball missed, then prompt for rebound.
  const finishMissZone = (gx: number, gy: number) => {
    if (!shotOrigin) return;
    const zone = coordsToMissZone(gx, gy);
    logAction({
      team: shotOrigin.team,
      playerNo: shotOrigin.no,
      action: shotOrigin.action,
      subtype: shotOrigin.subtype,
      x: shotOrigin.x,
      y: shotOrigin.y,
      goalX: gx,
      goalY: gy,
      missZone: zone,
      fastBreak: shotOrigin.fb,
      zone: shotOrigin.zone,
    });
    const teamN = shotOrigin.team;
    const isPenalty = shotOrigin.subtype === "PENALTY";
    const detectedZone = shotOrigin.zone ?? null;
    setTimeout(() => {
      const last = useGameStore.getState().log[0];
      if (last) {
        setFollowUp({ kind: isPenalty ? "involver" : "rebound", entryId: last.id, team: teamN, bothTeams: !isPenalty });
        openConfirm(last.id, teamN, { isShot: true, detectedZone });
      }
    }, 0);
    setShotOrigin(null);
    setSelected(null);
  };


  // Substitution: clicking a bench player while a starter from same team is selected swaps them.
  const handleBenchClick = (team: 1 | 2, benchPlayerId: string) => {
    const t = team === 1 ? team1 : team2;
    const inPlayer = t.players.find((p) => p.id === benchPlayerId);
    if (!inPlayer || inPlayer.excluded) return;
    const playingCount = t.players.filter((p) => p.onCourt).length;
    // If no starter selected:
    if (!selected || selected.team !== team) {
      // Auto-promote to fill an empty slot when the lineup is short (e.g. after RED/BLUE).
      if (playingCount < STARTERS_REQUIRED) {
        setPlayer(team, inPlayer.id, { onCourt: true });
        logAction({ team, playerNo: inPlayer.no, action: "SUBSTITUTION" });
        setSelected(null);
        return;
      }
      // Otherwise just select the bench player for other actions.
      setSelected({ team, no: inPlayer.no });
      return;
    }
    const outPlayer = t.players.find((p) => p.no === selected.no && p.onCourt);
    if (!outPlayer) {
      setSelected({ team, no: inPlayer.no });
      return;
    }
    setPlayer(team, outPlayer.id, { onCourt: false });
    setPlayer(team, inPlayer.id, { onCourt: true });
    logAction({ team, playerNo: `${inPlayer.no}↔${outPlayer.no}`, action: "SUBSTITUTION" });
    setSelected(null);
  };

  const finishMatch = async (opts?: { withShootout?: boolean }) => {
    if (!confirm("Finish match and save final score to tournament standings?")) return;
    const st = useGameStore.getState();
    const so1 = opts?.withShootout ? st.shootoutRounds.reduce((a, r) => a + (r.t1 === "G" ? 1 : 0), 0) : null;
    const so2 = opts?.withShootout ? st.shootoutRounds.reduce((a, r) => a + (r.t2 === "G" ? 1 : 0), 0) : null;
    try {
      await saveMatchServer({
        data: {
          info: {
            competition: info.competition,
            season: info.season,
            date: info.date || new Date().toISOString().slice(0, 10),
            venue: info.venue, city: info.city, country: info.country,
            halves: info.halves, halfLength: info.halfLength,
          },
          team1, team2,
          score1, score2,
          shootout1: so1, shootout2: so2,
          log,
        },
      });
      useGameStore.getState().reset();
      nav({ to: "/" });
    } catch (e) {
      alert("Failed to save match: " + (e as Error).message);
    }
  };


  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)]">
      <TopBar
        actions={
          <>
            <button onClick={() => window.open("/actions", "_blank")} className="flex items-center gap-2 hover:text-accent-orange"><ListOrdered className="h-3 w-3" /> Action Log</button>
            <button onClick={() => window.open("/scoreboard", "_blank")} className="flex items-center gap-2 hover:text-accent-orange"><Monitor className="h-3 w-3" /> Scoreboard View</button>
            <button onClick={() => window.open("/stats", "_blank")} className="flex items-center gap-2 hover:text-accent-orange"><BarChart3 className="h-3 w-3" /> Box Score</button>
            <button onClick={() => window.open("/stats?print=1", "_blank")} className="flex items-center gap-2 hover:text-accent-orange"><Printer className="h-3 w-3" /> Quick Print</button>
          </>
        }
        menu={
          <>
            <MenuItem label="File">
              <MenuLink onClick={() => exportGame()}>Export Game (JSON)</MenuLink>
              <MenuLink onClick={() => downloadCsv(`b-livestats-log-${Date.now()}.csv`, logToCsv(log, team1, team2))}>Export Log (CSV)</MenuLink>
              <MenuLink onClick={() => { if (confirm("Remove all data and start a new game?")) { useGameStore.getState().reset(); nav({ to: "/setup" }); } }}>Remove Data &amp; New Game</MenuLink>
              <MenuLink onClick={() => nav({ to: "/" })}>Home Screen</MenuLink>
              <MenuLink onClick={() => nav({ to: "/settings" })}>Settings / Backup</MenuLink>
            </MenuItem>

            <MenuItem label="Game">
              <MenuLink>System Check</MenuLink>
              <MenuLink onClick={() => nav({ to: "/setup/game-info" })}>Edit Game Information</MenuLink>
              <MenuLink onClick={() => nav({ to: "/setup/teams" })}>Edit Teams</MenuLink>
              <MenuLink onClick={() => nav({ to: "/setup/players" })}>Edit Players</MenuLink>
              
              <MenuLink onClick={() => useGameStore.getState().swapTeams()}>Switch Team Sides</MenuLink>
              <MenuLink onClick={() => setHalf(half + 1)} disabled={half >= info.halves}>Setup Half</MenuLink>
              <MenuLink onClick={() => logAction({ team: possession || 1, action: "THROW-OFF" })}>Throw-off</MenuLink>
              <MenuLink onClick={() => setTimeoutPickerOpen(true)}>Time Out</MenuLink>
              <MenuLink onClick={() => setShootoutOpen(true)}>Penalty Shootout (7-Meter)</MenuLink>
              <MenuLink onClick={() => setSoundOn((v) => !v)}>{soundOn ? "Mute Sounds 🔇" : "Enable Sounds 🔊"}</MenuLink>
              <MenuLink onClick={() => undoLast()}>Undo Last (Ctrl+Z)</MenuLink>
              <MenuLink onClick={() => finishMatch()}>Finish &amp; Save to Tournament</MenuLink>
            </MenuItem>
            <MenuItem label="Reports">
              <MenuLink onClick={() => nav({ to: "/actions" })}>Edit Actions Log</MenuLink>
              <MenuLink onClick={() => window.open("/stats", "_blank")}>Box Score / Stats</MenuLink>
              <MenuLink onClick={() => window.open("/quarters", "_blank")}>Quarters</MenuLink>
              <MenuLink onClick={() => window.open("/scoreboard", "_blank")}>Public Scoreboard</MenuLink>
              <MenuLink onClick={() => window.open("/standings", "_blank")}>Tournament Standings</MenuLink>
            </MenuItem>
          </>
        }
      />


      <div className="flex-1 grid grid-cols-1">
        <div className="p-2 space-y-2">
          {/* clock + action toolbar row */}
          <div className="flex items-center justify-center gap-3 bg-white border py-1 px-2">
            <div className="flex items-center gap-3">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold">{
                (() => {
                  const reg = info.halves;
                  if (half <= reg) return half === 1 ? "1st" : half === 2 ? "2st" : `${half}th`;
                  const exNum = half - reg;
                  if (exNum >= 1 && exNum <= 4) return `EX${exNum}`;
                  return "pen";
                })()
              }</div>
              <div className="flex flex-col leading-none">
                <button onClick={() => setClockSec(clockSec + 60)} className="text-[10px] hover:text-accent-orange">▲</button>
                <button onClick={() => setClockSec(Math.max(0, clockSec - 60))} className="text-[10px] hover:text-accent-orange">▼</button>
              </div>
              <div className="px-3 h-7 flex items-center bg-white text-black font-mono text-sm font-black uppercase tracking-wider">
                {formatClock(clockSec)}
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const reg = info.halves;
                  const maxExHalf = reg + 4;
                  if (!periodOver) return null;
                  if (half < reg) {
                    return (
                      <button onClick={() => setHalf(half + 1)} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">
                        {`START HALF ${half + 1}`}
                      </button>
                    );
                  }
                  if (half >= reg && half < maxExHalf) {
                    if (score1 === score2) {
                      const nextEx = half - reg + 1;
                      return (
                        <>
                          <button
                            onClick={() => setHalf(half + 1)}
                            className="px-3 h-7 bg-accent-orange text-white font-semibold text-xs"
                          >
                            {`EXTRA TIME ${nextEx} (5 MIN)`}
                          </button>
                          <button onClick={() => setShootoutOpen(true)} className="px-3 h-7 bg-accent-red text-white font-semibold text-xs">PENALTY SHOOTOUT</button>
                          <button onClick={() => finishMatch()} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">END</button>
                        </>
                      );
                    }
                    return (
                      <button onClick={() => finishMatch()} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">END MATCH</button>
                    );
                  }

                  if (half === maxExHalf) {
                    if (score1 === score2) {
                      return (
                        <>
                          <button onClick={() => setShootoutOpen(true)} className="px-3 h-7 bg-accent-orange text-white font-semibold text-xs">PENALTY SHOOTOUT</button>
                          <button onClick={() => finishMatch()} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">END</button>
                        </>
                      );
                    }
                    return (
                      <button onClick={() => finishMatch()} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">END MATCH</button>
                    );
                  }
                  return (
                    <button onClick={() => finishMatch()} className="px-3 h-7 bg-tab-done text-white font-semibold text-xs">END MATCH</button>
                  );
                })()}
                {!periodOver && (
                  <button
                    onClick={() => (clockRunning ? stopClock() : startClock())}
                    className={`px-3 h-7 text-white font-semibold text-xs disabled:opacity-40 ${clockRunning ? "bg-accent-orange" : "bg-accent-red"}`}
                  >
                    {clockRunning ? "STOP" : "START CLOCK"}
                  </button>
                )}
              </div>
            </div>
          </div>
          {pendingPick && (
            <div className="text-[10px] uppercase font-bold text-center text-accent-orange bg-white border-x border-b py-0.5">
              {ACTION_GROUP_LABEL[pendingPick.group]}: {pendingPick.subtype} · click court
            </div>
          )}


          {/* score row */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
            <TeamScore n={1} team={team1} score={score1} shootout={shootoutRounds.reduce((a, r) => a + (r.t1 === "G" ? 1 : 0), 0)} poss={possession === 1} onPoss={() => setPossession(1)} />
            <div className="flex items-center justify-center px-1 gap-2">
              <button
                onClick={() => setTimeoutPickerOpen(true)}
                className="h-8 px-2 bg-accent-orange text-white font-bold text-[10px] uppercase tracking-wider rounded flex items-center gap-1 hover:bg-accent-orange/90"
                title="Team Time Out"
              >
                TIME OUT
              </button>
            </div>
            <TeamScore n={2} team={team2} score={score2} shootout={shootoutRounds.reduce((a, r) => a + (r.t2 === "G" ? 1 : 0), 0)} poss={possession === 2} onPoss={() => setPossession(2)} align="right" />
          </div>

          <LiveStatsStrip />

          {/* playing area */}
          <div className="grid grid-cols-[1.2fr_8fr_1.2fr] gap-1.5">
            <TeamPanel n={1} team={team1} timeouts={timeouts1} suspensions={suspensions1} activeSuspensions={activeSuspensions} selected={selected} setSelected={setSelected} onBenchClick={handleBenchClick} />

            <div className="border bg-panel handball-court-bg p-2 flex flex-col">
              <div className="flex items-center justify-between mb-1 px-1 gap-2 flex-wrap">
                <ActionMenu
                  horizontal
                  split
                  groups={["MADE", "MISSED", "FOUL", "TURNOVER"]}
                  showTimeout={false}
                  onPick={handlePick}
                  pendingLabel={null}
                />
                <div className="flex items-center gap-1">
                  <button onClick={() => { autoArrangeFormation(1); autoArrangeFormation(2); }} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted hover:bg-tab-done hover:text-white" title="Place starters using the saved lineup (or defaults)">Auto Lineup</button>
                  <button onClick={() => { useGameStore.getState().saveLineupTemplate(1); useGameStore.getState().saveLineupTemplate(2); }} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted hover:bg-tab-done hover:text-white" title="Save current player positions as the Auto Lineup template">Save Lineup</button>
                  <button onClick={() => useGameStore.getState().swapTeams()} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted hover:bg-accent-orange hover:text-white" title="Swap teams sides">Switch</button>
                  <button onClick={() => { clearFormation(1); clearFormation(2); }} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-muted hover:bg-accent-red hover:text-white" title="Remove all tokens from the court">Clear</button>
                  <button
                    onClick={() => setHeatmap((v) => !v)}
                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${heatmap ? "bg-accent-orange text-white" : "bg-muted text-foreground"}`}
                  >
                    Heatmap {heatmap ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
              <div className="flex-1 relative flex items-center justify-center">
                <HandballCourt
                  className="w-full"
                  shots={log.filter((e) => e.half === half && (isPenaltyShot(e) || e.x != null))}
                  team1Color={team1.color}
                  team2Color={team2.color}
                  team1Direction={team1Direction}
                  pending={!!pendingPick}
                  heatmap={heatmap}
                  onCourtClick={handleCourtClick}
                  formation={[
                    ...Object.entries(formation1).map(([pid, pos]) => {
                      const pl = team1.players.find((p) => p.id === pid);
                      if (!pl) return null;
                      return { team: 1 as const, playerId: pid, no: pl.no, name: `${pl.name} ${pl.surname}`.trim(), color: team1.color, x: pos.x, y: pos.y, isGK: pl.position === "GK" };
                    }).filter(Boolean) as any[],
                    ...Object.entries(formation2).map(([pid, pos]) => {
                      const pl = team2.players.find((p) => p.id === pid);
                      if (!pl) return null;
                      return { team: 2 as const, playerId: pid, no: pl.no, name: `${pl.name} ${pl.surname}`.trim(), color: team2.color, x: pos.x, y: pos.y, isGK: pl.position === "GK" };
                    }).filter(Boolean) as any[],
                  ]}
                  onPlayerDrop={(playerId, team, x, y) => {
                    // ensure the player is marked as on-court
                    const t = team === 1 ? team1 : team2;
                    const pl = t.players.find((p) => p.id === playerId);
                    if (pl && !pl.onCourt) setPlayer(team, playerId, { onCourt: true });
                    setFormationPos(team, playerId, { x, y });
                  }}
                  onPlayerRemove={(playerId, team) => setFormationPos(team, playerId, null)}
                  onPlayerSelect={(_pid, team, no) => setSelected({ team, no })}
                  selectedPlayerId={selected ? (selected.team === 1 ? team1.players.find((p) => p.no === selected.no)?.id : team2.players.find((p) => p.no === selected.no)?.id) ?? null : null}
                />
              </div>
            </div>

            
            <TeamPanel n={2} team={team2} timeouts={timeouts2} suspensions={suspensions2} activeSuspensions={activeSuspensions} selected={selected} setSelected={setSelected} onBenchClick={handleBenchClick} align="right" />
          </div>
        </div>

      </div>


      {pregameOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white p-8 w-[460px]">
            <div className="bg-muted px-3 py-2 -mx-8 -mt-8 mb-6 text-accent-orange font-bold uppercase tracking-wider text-sm">Pregame Countdown</div>
            <p className="text-center mb-4">How many minutes left until<br/>the start of the game?</p>
            <input type="number" value={pregameMins} onChange={(e) => setPregameMins(e.target.value)} className="w-full border h-12 px-3 text-lg" />
            <div className="flex flex-col gap-2 mt-6">
              <button onClick={() => { setClockSec(Math.max(0, +pregameMins) * 60); setPregameOpen(false); }} className="h-12 bg-topbar text-white font-semibold tracking-wider">SET</button>
              <button onClick={() => setPregameOpen(false)} className="h-12 bg-topbar text-white font-semibold tracking-wider">DISMISS</button>
            </div>
          </div>
        </div>
      )}
      <ShootoutPanel open={shootoutOpen} onClose={() => setShootoutOpen(false)} onFinish={() => finishMatch({ withShootout: true })} />
      <GoalPicker
        open={!!shotOrigin}
        mode={shotOrigin?.mode || "placement"}
        action={shotOrigin?.action || ""}
        onCancel={() => setShotOrigin(null)}
        onPlace={finishShotPlacement}
        onMiss={finishMissZone}
      />

      <ConfirmSituationModal
        open={!!pendingConfirm}
        isShot={!!pendingConfirm?.isShot}
        detectedZone={pendingConfirm?.detectedZone ?? null}
        detectedStrength={pendingConfirm?.detectedStrength ?? null}
        lastDefense={lastDefense}
        onCancel={() => setPendingConfirm(null)}
        onConfirm={(result: ConfirmResult) => {
          if (pendingConfirm) {
            const patch: Parameters<typeof updateLogEntry>[1] = {
              strengthAttack: result.attack,
              strengthDefend: result.defend,
              strengthAttackEmpty: result.emptyAttack,
            };
            if (result.zone) patch.zone = result.zone;
            if (result.defense) patch.defense = result.defense;
            updateLogEntry(pendingConfirm.entryId, patch);
            if (result.defense) setLastDefense(result.defense);
          }
          setPendingConfirm(null);
        }}
      />



      {/* Timeout team picker */}
      {timeoutPickerOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white p-8 w-[420px]">
            <div className="bg-muted px-3 py-2 -mx-8 -mt-8 mb-6 text-accent-orange font-bold uppercase tracking-wider text-sm">Time Out — Choose Team</div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => { logAction({ team: 1, action: "TIMEOUT" }); setTimeoutPickerOpen(false); }}
                className="flex-1 h-16 text-white font-bold text-lg uppercase tracking-wider"
                style={{ background: team1.color || "#666" }}
              >
                {team1.name || "Team 1"}
              </button>
              <button
                onClick={() => { logAction({ team: 2, action: "TIMEOUT" }); setTimeoutPickerOpen(false); }}
                className="flex-1 h-16 text-white font-bold text-lg uppercase tracking-wider"
                style={{ background: team2.color || "#666" }}
              >
                {team2.name || "Team 2"}
              </button>
            </div>
            <button onClick={() => setTimeoutPickerOpen(false)} className="w-full h-12 mt-4 bg-muted text-foreground font-semibold tracking-wider">Cancel</button>
          </div>
        </div>
      )}
      {/* Blocker picker — pick opponent player who made the block, before court placement */}
      {blockerPickerOpen && (() => {
        const shooterTeam = blockerPickerOpen.shooterTeam;
        const oppN: 1 | 2 = shooterTeam === 1 ? 2 : 1;
        const oppTeam = oppN === 1 ? team1 : team2;
        const players = oppTeam.players.filter((p) => p.onCourt);
        const cancel = () => { setBlockerPickerOpen(null); setPendingBlockerNo(null); };
        const pick = (no: string) => {
          setPendingBlockerNo(no);
          setPendingPick({ group: "MISSED", subtype: "BLOCK", fb: blockerPickerOpen.fb });
          setBlockerPickerOpen(null);
        };
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={cancel}>
            <div className="bg-white p-4 w-[440px] max-w-[95vw]" onClick={(e) => e.stopPropagation()}>
              <div className="px-3 py-2 -mx-4 -mt-4 mb-3 text-white font-bold uppercase tracking-wider text-sm" style={{ background: oppTeam.color || "#666" }}>
                BLOCK — اختر اللاعب الذي عمل البلوك
              </div>
              <div className="grid grid-cols-4 gap-2">
                {players.map((p) => (
                  <button key={p.id} onClick={() => pick(p.no)} className="h-14 text-white font-bold text-lg rounded hover:opacity-90" style={{ background: oppTeam.color || "#666" }} title={`${p.no} ${p.name || ""}`}>
                    {p.no || "—"}
                  </button>
                ))}
                {players.length === 0 && (
                  <div className="col-span-4 text-xs text-muted-foreground text-center py-4">No players on court</div>
                )}
              </div>
              <button onClick={cancel} className="w-full h-9 mt-3 bg-muted text-foreground text-xs font-semibold uppercase tracking-wider">Cancel</button>
            </div>
          </div>
        );
      })()}






      {/* Follow-up player picker for Assist / Rebound / Involver */}
      {followUp && (() => {
        const isInvolver = followUp.kind === "involver";
        const bothTeams = followUp.kind === "rebound" && followUp.bothTeams;
        const pickerTeam = isInvolver ? (followUp.team === 1 ? 2 : 1) : followUp.team;
        const teamsToShow: { n: 1 | 2; t: typeof team1 }[] = bothTeams
          ? [{ n: 1, t: team1 }, { n: 2, t: team2 }]
          : [{ n: pickerTeam, t: pickerTeam === 1 ? team1 : team2 }];
        const title = followUp.kind === "assist" ? "ASSIST — اختر اللاعب" : followUp.kind === "rebound" ? "REBOUND — اختر اللاعب" : "INVOLVER — اختر اللاعب من الفريق الآخر";
        const pick = (no: string, teamN: 1 | 2) => {
          if (followUp.kind === "assist") {
            updateLogEntry(followUp.entryId, { assistNo: no });
            logAction({ team: followUp.team, playerNo: no, action: "ASSIST" });
          } else if (followUp.kind === "rebound") {
            updateLogEntry(followUp.entryId, { reboundNo: no, reboundTeam: teamN });
            // Emit an explicit REBOUND log entry so it shows up immediately after the primary action.
            logAction({ team: teamN, playerNo: no, action: "REBOUND" });
          } else {
            updateLogEntry(followUp.entryId, { involverNo: no });
            // Log the opposing involver (fouled/caused turnover) as its own action.
            const involverTeam: 1 | 2 = followUp.team === 1 ? 2 : 1;
            logAction({ team: involverTeam, playerNo: no, action: "INVOLVER" });
          }
          setFollowUp(null);
        };
        const skip = () => { setFollowUp(null); };
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={skip}>
            <div className={`bg-white p-4 ${bothTeams ? "w-[900px]" : "w-[440px]"} max-w-[95vw]`} onClick={(e) => e.stopPropagation()}>
              <div className={`px-3 py-2 -mx-4 -mt-4 mb-3 font-bold uppercase tracking-wider text-sm ${bothTeams ? "bg-muted text-foreground" : "text-white"}`} style={bothTeams ? undefined : { background: teamsToShow[0].t.color || "#666" }}>
                {title}
              </div>
              <div className={`grid gap-4 ${bothTeams ? "grid-cols-2" : "grid-cols-1"}`}>
                {teamsToShow.map(({ n, t }) => {
                  const eligible = t.players.filter((p) => p.playing !== false && !p.excluded);
                  const on = eligible.filter((p) => p.onCourt);
                  const bench = eligible.filter((p) => !p.onCourt);
                  const renderBtn = (p: (typeof t.players)[number], dim = false) => (
                    <button key={p.id} onClick={() => pick(p.no, n)} className={`h-14 text-white font-bold text-lg rounded hover:opacity-90 ${dim ? "opacity-80" : ""}`} style={{ background: t.color || "#666" }} title={`${p.no} ${p.name || ""}`}>
                      {p.no || "—"}
                    </button>
                  );
                  return (
                    <div key={n}>
                      <div className="px-2 py-1 mb-2 text-white font-bold text-xs uppercase tracking-wider" style={{ background: t.color || "#666" }}>
                        {t.name || `Team ${n}`}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {on.map((p) => renderBtn(p))}
                        {bench.length > 0 && (
                          <>
                            <div className="col-span-4 text-[10px] uppercase tracking-wider font-bold text-muted-foreground pt-1">Bench</div>
                            {bench.map((p) => renderBtn(p, true))}
                          </>
                        )}
                        {on.length === 0 && bench.length === 0 && (
                          <div className="col-span-4 text-xs text-muted-foreground text-center py-4">No eligible players</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={skip} className="w-full h-9 mt-3 bg-muted text-foreground text-xs font-semibold uppercase tracking-wider">Skip</button>
            </div>
          </div>
        );
      })()}

      {/* Defense picker is now merged into ConfirmSituationModal. */}

      <AppFooter variant="light" />
    </div>
  );
}

function exportGame() {
  const state = useGameStore.getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `b-livestats-game-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function TeamScore({ n, team, score, shootout = 0, poss, onPoss, onTimeout, align = "left" }: any) {
  const timeoutBtn = onTimeout ? (
    <button
      onClick={onTimeout}
      className="h-7 px-2 text-[10px] uppercase font-bold tracking-wider bg-accent-orange text-white hover:bg-accent-orange/90 rounded"
      title="Team Time Out"
    >
      TIME OUT
    </button>
  ) : null;
  const hasGK = team.players?.some((p: any) => (p.position || "").toUpperCase() === "GK" && p.onCourt);
  const anyGK = team.players?.some((p: any) => (p.position || "").toUpperCase() === "GK");
  const emptyGoal = anyGK && !hasGK;
  const emptyBadge = emptyGoal ? (
    <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-accent-red text-white rounded animate-pulse" title="No goalkeeper on court">EMPTY GOAL</span>
  ) : null;
  return (
    <div className="border bg-white relative overflow-hidden flex items-center px-2 py-1.5 gap-2" style={{ borderLeft: align === "left" ? `6px solid ${team.color}` : undefined, borderRight: align === "right" ? `6px solid ${team.color}` : undefined }}>
      {align === "left" ? (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold tracking-wide truncate flex items-center gap-2">{team.name || `Team ${n}`}{emptyBadge}</div>
          </div>
          {timeoutBtn}
          <button onClick={onPoss} className={`h-5 px-1.5 text-[10px] uppercase font-bold ${poss ? "bg-tab-done text-white" : "bg-muted text-muted-foreground"}`}>POSS</button>
          <div className="flex items-baseline gap-1">
            <div className="text-2xl font-bold tabular-nums w-14 text-center">{score}</div>
            {shootout > 0 && <div className="text-sm font-bold text-accent-orange tabular-nums">({shootout})</div>}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-baseline gap-1 justify-end">
            {shootout > 0 && <div className="text-sm font-bold text-accent-orange tabular-nums">({shootout})</div>}
            <div className="text-2xl font-bold tabular-nums w-14 text-center">{score}</div>
          </div>
          <button onClick={onPoss} className={`h-5 px-1.5 text-[10px] uppercase font-bold ${poss ? "bg-tab-done text-white" : "bg-muted text-muted-foreground"}`}>POSS</button>
          {timeoutBtn}
          <div className="flex-1 min-w-0 text-right">
            <div className="text-sm font-bold tracking-wide truncate flex items-center gap-2 justify-end">{emptyBadge}{team.name || `Team ${n}`}</div>
          </div>
        </>
      )}
    </div>
  );
}

function TeamPanel({ n, team, timeouts, suspensions, activeSuspensions = [], selected, setSelected, onBenchClick, align = "left" }: any) {
  const setPlayer = useGameStore((s) => s.setPlayer);
  const logAction = useGameStore((s) => s.logAction);
  const setupComplete = useGameStore((s) => s.setupComplete);
  const playing = team.players.filter((p: any) => p.onCourt);
  const bench = team.players.filter((p: any) => p.playing && !p.onCourt);
  const teamSusp = activeSuspensions.filter((su: any) => su.team === n);
  const [dragOver, setDragOver] = useState<"starters" | "bench" | null>(null);

  const onDragStart = (e: React.DragEvent, playerId: string, from: "starters" | "bench") => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ playerId, from, team: n }));
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropTo = (e: React.DragEvent, target: "starters" | "bench", targetPlayerId?: string) => {
    e.preventDefault();
    setDragOver(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain")) as { playerId: string; from: "starters" | "bench"; team: number };
      if (data.team !== n || data.playerId === targetPlayerId) return;
      if (data.from === target && !targetPlayerId) return;
      const inPlayer = team.players.find((p: any) => p.id === data.playerId);
      const outPlayer = targetPlayerId ? team.players.find((p: any) => p.id === targetPlayerId) : undefined;
      if (target === "starters") {
        if (targetPlayerId) {
          setPlayer(n, targetPlayerId, { onCourt: false });
          setPlayer(n, data.playerId, { onCourt: true, playing: true });
          if (setupComplete && inPlayer && outPlayer) {
            logAction({ team: n as 1 | 2, playerNo: `${inPlayer.no}↔${outPlayer.no}`, action: "SUBSTITUTION" });
          }
        } else {
          if (playing.length >= STARTERS_REQUIRED) return;
          setPlayer(n, data.playerId, { onCourt: true, playing: true });
          if (setupComplete && inPlayer) {
            logAction({ team: n as 1 | 2, playerNo: inPlayer.no, action: "SUBSTITUTION" });
          }
        }
      } else {
        setPlayer(n, data.playerId, { onCourt: false });
        if (setupComplete && inPlayer) {
          logAction({ team: n as 1 | 2, playerNo: inPlayer.no, action: "SUBSTITUTION" });
        }
      }
    } catch {}
  };
  const allowDrop = (e: React.DragEvent, zone: "starters" | "bench") => {
    e.preventDefault();
    setDragOver(zone);
  };

  return (
    <div className="border bg-white p-1">
      {teamSusp.length > 0 && (
        <div className={`flex flex-wrap gap-1 mb-1 ${align === "right" ? "justify-end" : ""}`}>
          {teamSusp.map((su: any) => (
            <div key={su.id} className="flex items-center gap-1 bg-accent-red/90 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
              <span>#{su.playerNo}</span>
              <span className="font-mono tabular-nums">{formatClock(su.remainingSec)}</span>
            </div>
          ))}
        </div>
      )}
      <div
        onDragOver={(e) => allowDrop(e, "starters")}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => onDropTo(e, "starters")}
        className={`grid grid-cols-2 gap-0.5 p-0.5 rounded transition-colors ${dragOver === "starters" ? "bg-accent-orange/10 ring-2 ring-accent-orange/40" : ""}`}
      >
        {playing.slice(0, STARTERS_REQUIRED).map((p: any) => {
          const isSel = selected?.team === n && selected?.no === p.no;
          return (
            <button
              key={p.id}
              draggable
              onDragStart={(e) => onDragStart(e, p.id, "starters")}
              onDragOver={(e) => allowDrop(e, "starters")}
              onDrop={(e) => { e.stopPropagation(); onDropTo(e, "starters", p.id); }}
              onClick={() => setSelected(isSel ? null : { team: n, no: p.no })}
              className={`h-16 font-bold text-2xl text-white cursor-grab active:cursor-grabbing ${isSel ? "ring-2 ring-accent-orange" : ""}`}
              style={{ background: team.color || "#666" }}
              title={`${p.no} ${p.name || ""} — drag to bench`}
            >
              {p.no || "—"}
            </button>
          );
        })}
        {playing.length < STARTERS_REQUIRED && (
          <div className="col-span-2 text-[9px] text-muted-foreground text-center py-1">
            Drop {STARTERS_REQUIRED - playing.length} player{STARTERS_REQUIRED - playing.length > 1 ? "s" : ""} here
          </div>
        )}
      </div>

      <div className="mt-1 px-1 py-0.5 bg-muted text-[9px] font-bold uppercase text-center">
        Bench {selected?.team === n && playing.some((p: any) => p.no === selected?.no) && (
          <span className="text-accent-orange normal-case"> · اضغط بديل للتبديل</span>
        )}
      </div>
      <div
        onDragOver={(e) => allowDrop(e, "bench")}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => onDropTo(e, "bench")}
        className={`grid grid-cols-3 gap-0.5 p-0.5 mt-0.5 min-h-[32px] rounded transition-colors ${dragOver === "bench" ? "bg-accent-orange/10 ring-2 ring-accent-orange/40" : ""}`}
      >
        {bench.map((p: any) => {
          const isSel = selected?.team === n && selected?.no === p.no;
          const subReady = selected?.team === n && playing.some((pl: any) => pl.no === selected?.no);
          const excluded = !!p.excluded;
          const susp = teamSusp.find((su: any) => su.playerNo === p.no);
          return (
            <div key={p.id} className="relative">
              {susp && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-accent-red text-white text-[9px] font-bold font-mono tabular-nums px-1.5 py-0.5 rounded shadow">
                  {formatClock(susp.remainingSec)}
                </div>
              )}
              <button
                draggable={!excluded}
                onDragStart={(e) => !excluded && onDragStart(e, p.id, "bench")}
                onClick={() => !excluded && onBenchClick?.(n, p.id)}
                disabled={excluded}
                className={`w-full h-12 flex flex-col items-center justify-center leading-tight font-bold border transition-colors px-1 ${
                  excluded
                    ? "bg-red-100 text-red-700 line-through cursor-not-allowed opacity-60 border-red-400"
                    : isSel
                    ? "ring-2 ring-accent-orange bg-muted cursor-grab active:cursor-grabbing"
                    : subReady
                    ? "bg-tab-done/20 hover:bg-tab-done hover:text-white border-tab-done cursor-grab active:cursor-grabbing"
                    : "bg-muted text-foreground hover:bg-accent-orange/20 cursor-grab active:cursor-grabbing"
                }`}
                title={excluded ? `#${p.no} — مطرود` : subReady ? `Click to sub in #${p.no} for #${selected?.no}` : `Drag #${p.no} ${p.name || ""} onto the lineup`}
              >
                <span className="text-base leading-none">{p.no || "—"}</span>
                {(p.name || p.surname) && (
                  <span className="text-[9px] font-semibold truncate max-w-full opacity-80">
                    {(p.name || "") + (p.surname ? " " + p.surname : "")}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {bench.length === 0 && (
          <div className="col-span-3 text-[9px] text-muted-foreground text-center py-1">No bench players</div>
        )}
      </div>
    </div>
  );
}

