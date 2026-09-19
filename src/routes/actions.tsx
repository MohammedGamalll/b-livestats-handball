import { createFileRoute, Navigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/gameStore";
import { ReportLogo } from "@/components/ReportLogo";
import { AppFooter } from "@/components/AppFooter";
import type { LogEntry, MissZone } from "@/lib/gameStore";
import {
  MADE_SUBTYPES,
  FOUL_SUBTYPES,
  MISSED_SUBTYPES,
  TURNOVER_SUBTYPES,
  type ActionType,
} from "@/lib/handball";
import { Trash2, Pencil, X, Check, Crosshair, Target } from "lucide-react";
import { HandballCourt } from "@/components/HandballCourt";
import { GoalPicker } from "@/components/GoalPicker";
import { isPenaltyShot, penaltySpotForTeam, classifyShotZoneOrOverride, type CourtGeoZone } from "@/lib/court";
import { buildSituationTimeline, strengthLabel } from "@/lib/strength";
import { eventMentionsPlayer } from "@/lib/gkAttribution";


export const Route = createFileRoute("/actions")({
  component: ActionsPage,
});

const ALL_ACTIONS: ActionType[] = [
  "GOAL", "SHOT MISSED", "SHOT SAVED", "7M", "ASSIST", "STEAL", "TURNOVER",
  "BLOCK", "YELLOW", "2-MIN", "RED", "FOUL", "TIMEOUT", "THROW-OFF", "SUBSTITUTION", "COACH",
];

const SUBTYPES_BY_ACTION: Record<string, readonly string[]> = {
  GOAL: MADE_SUBTYPES,
  "SHOT MISSED": MISSED_SUBTYPES,
  BLOCK: MISSED_SUBTYPES,
  FOUL: FOUL_SUBTYPES,
  "2-MIN": FOUL_SUBTYPES,
  YELLOW: FOUL_SUBTYPES,
  RED: FOUL_SUBTYPES,
  "7M": FOUL_SUBTYPES,
  TURNOVER: TURNOVER_SUBTYPES,
};

const SHOT_ACTIONS = new Set(["GOAL", "SHOT MISSED", "SHOT SAVED", "7M"]);
const MISS_ZONES: MissZone[] = ["LEFT_CORNER", "RIGHT_CORNER", "LEFT_CROSSBAR", "RIGHT_CROSSBAR", "POST"];
const ZONE_OPTIONS: CourtGeoZone[] = ["6m", "9m", "7m", "Wing"];
const DEFENSE_OPTIONS: NonNullable<LogEntry["defense"]>[] = ["6/0", "5/1", "4/2", "3/3", "M2M", "5/0", "4/1", "EMPTY"];
const STRENGTH_PRESETS: { label: string; attack: number; defend: number }[] = [
  { label: "6v6", attack: 6, defend: 6 },
  { label: "6v5", attack: 6, defend: 5 },
  { label: "6v4", attack: 6, defend: 4 },
  { label: "5v6", attack: 5, defend: 6 },
  { label: "5v5", attack: 5, defend: 5 },
  { label: "5v4", attack: 5, defend: 4 },
  { label: "7v6", attack: 7, defend: 6 },
  { label: "7v5", attack: 7, defend: 5 },
  { label: "6v7", attack: 6, defend: 7 },
  { label: "4v6", attack: 4, defend: 6 },
];

function ActionsPage() {
  const setupComplete = useGameStore((s) => s.setupComplete);
  const log = useGameStore((s) => s.log);
  const team1 = useGameStore((s) => s.team1);
  const team2 = useGameStore((s) => s.team2);
  const team1Direction = useGameStore((s) => s.team1Direction);
  const info = useGameStore((s) => s.info);
  const updateLogEntry = useGameStore((s) => s.updateLogEntry);
  const deleteLogEntry = useGameStore((s) => s.deleteLogEntry);

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<LogEntry>>({});
  const [filter, setFilter] = useState<"all" | 1 | 2>("all");
  const [playerFilter, setPlayerFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [subtypeFilter, setSubtypeFilter] = useState<string>("all");
  const [halfFilter, setHalfFilter] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");
  const [pickStep, setPickStep] = useState<"court" | "goal" | null>(null);

  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());
  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useGameStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  const situationTimeline = useMemo(
    () => buildSituationTimeline(team1, team2, log, {
      halfLength: info.halfLength, otLength: info.otLength, halves: info.halves,
    }),
    [team1, team2, log, info.halfLength, info.otLength, info.halves],
  );

  if (!hydrated) return null;
  if (!setupComplete) return <Navigate to="/" />;

  const startEdit = (e: LogEntry) => {
    setEditing(e.id);
    setDraft({ ...e });
  };
  const cancelEdit = () => { setEditing(null); setDraft({}); setPickStep(null); };
  const saveEdit = (id: string) => {
    const source = log.find((e) => e.id === id);
    if (!source) return;
    const next = { ...source, ...draft } as LogEntry;
    const patch: Partial<LogEntry> = { ...draft };

    // If action switched to a non-shot type, clear shot-only fields
    const nextAction = String(next.action);
    if (!SHOT_ACTIONS.has(nextAction)) {
      patch.x = undefined;
      patch.y = undefined;
      patch.goalX = undefined;
      patch.goalY = undefined;
      patch.missZone = undefined;
      patch.zone = undefined;
      patch.fastBreak = undefined;
    }
    // Snap penalty shots to the penalty spot
    if (isPenaltyShot(next)) {
      const spot = penaltySpotForTeam(next.team, team1Direction, next.x);
      patch.x = spot.x;
      patch.y = spot.y;
    }
    updateLogEntry(id, patch);
    cancelEdit();
  };

  const playerOptions: Array<{ id: string; no: string; name: string; surname: string; _t?: 1 | 2 }> =
    filter === 1 ? team1.players.map((p) => ({ ...p })) :
    filter === 2 ? team2.players.map((p) => ({ ...p })) :
    [
      ...team1.players.map((p) => ({ ...p, _t: 1 as const })),
      ...team2.players.map((p) => ({ ...p, _t: 2 as const })),
    ];

  const subtypeOptions = actionFilter !== "all" ? SUBTYPES_BY_ACTION[actionFilter] : undefined;

  const filtered = log.filter((e) => {
    if (filter !== "all" && e.team !== filter) return false;
    if (playerFilter !== "all") {
      const hit =
        eventMentionsPlayer(e.playerNo, playerFilter) ||
        e.assistNo === playerFilter ||
        e.involverNo === playerFilter ||
        e.reboundNo === playerFilter;
      if (!hit) return false;
    }
    if (actionFilter !== "all" && e.action !== actionFilter) return false;
    if (subtypeFilter !== "all" && (e.subtype ?? "") !== subtypeFilter) return false;
    if (halfFilter !== "all" && String(e.half) !== halfFilter) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      const hay = `${e.action} ${e.subtype ?? ""} ${e.playerNo ?? ""} ${e.missZone ?? ""} ${e.clock ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const resetFilters = () => {
    setFilter("all"); setPlayerFilter("all"); setActionFilter("all");
    setSubtypeFilter("all"); setHalfFilter("all"); setSearchText("");
  };

  const chipStrength = (e: LogEntry): string | null => {
    const sr = situationTimeline.get(e.id);
    const attack = e.strengthAttack ?? sr?.attackField;
    const defend = e.strengthDefend ?? sr?.defendField;
    const emptyAttack = e.strengthAttackEmpty ?? sr?.emptyAttack ?? false;
    if (attack == null || defend == null) return null;
    return strengthLabel(attack, defend, emptyAttack);
  };
  const chipZone = (e: LogEntry): string | null => {
    const isShotLike = SHOT_ACTIONS.has(String(e.action));
    if (!isShotLike) return null;
    return classifyShotZoneOrOverride(e) ?? null;
  };

  const setDraftField = <K extends keyof LogEntry>(key: K, value: LogEntry[K] | undefined) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[oklch(0.97_0.005_260)] p-6">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">ACTIONS LOG · تعديل</h1>
            <div className="text-xs text-muted-foreground">
              {filtered.length} of {log.length} action{log.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex justify-center"><ReportLogo /></div>
          <div className="flex items-center gap-2 justify-end">
            <Link to="/game" className="h-9 px-3 bg-muted text-xs font-bold uppercase flex items-center">Back to Game</Link>
          </div>
        </div>


        <div className="bg-white border p-3 mb-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold uppercase text-muted-foreground w-12">Team</span>
            <button onClick={() => { setFilter("all"); setPlayerFilter("all"); }} className={`h-8 px-3 text-xs font-bold uppercase ${filter === "all" ? "bg-topbar text-white" : "bg-muted"}`}>All</button>
            <button onClick={() => { setFilter(1); setPlayerFilter("all"); }} className={`h-8 px-3 text-xs font-bold uppercase ${filter === 1 ? "text-white" : "bg-muted"}`} style={filter === 1 ? { background: team1.color } : undefined}>{team1.name || "Team 1"}</button>
            <button onClick={() => { setFilter(2); setPlayerFilter("all"); }} className={`h-8 px-3 text-xs font-bold uppercase ${filter === 2 ? "text-white" : "bg-muted"}`} style={filter === 2 ? { background: team2.color } : undefined}>{team2.name || "Team 2"}</button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-bold uppercase text-muted-foreground w-12">Player</span>
            <select value={playerFilter} onChange={(e) => setPlayerFilter(e.target.value)} className="h-8 border px-2 text-xs min-w-[180px]">
              <option value="all">All players</option>
              {playerOptions.map((p) => (
                <option key={`${p._t ?? "x"}-${p.id}`} value={p.no}>
                  {p._t ? `[${p._t === 1 ? (team1.shortCode || "T1") : (team2.shortCode || "T2")}] ` : ""}#{p.no} {p.name} {p.surname}
                </option>
              ))}
            </select>

            <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">Action</span>
            <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setSubtypeFilter("all"); }} className="h-8 border px-2 text-xs">
              <option value="all">All actions</option>
              {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>

            {subtypeOptions && (
              <>
                <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">Subtype</span>
                <select value={subtypeFilter} onChange={(e) => setSubtypeFilter(e.target.value)} className="h-8 border px-2 text-xs">
                  <option value="all">All</option>
                  {subtypeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </>
            )}

            <span className="text-[10px] font-bold uppercase text-muted-foreground ml-2">Period</span>
            <select value={halfFilter} onChange={(e) => setHalfFilter(e.target.value)} className="h-8 border px-2 text-xs">
              <option value="all">All</option>
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">EX1</option>
              <option value="4">EX2</option>
              <option value="5">EX3</option>
              <option value="6">EX4</option>
              <option value="7">PEN</option>
            </select>

            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search…"
              className="h-8 border px-2 text-xs flex-1 min-w-[140px]"
            />

            <button onClick={resetFilters} className="h-8 px-3 bg-muted text-xs font-bold uppercase">Reset</button>
          </div>
        </div>

        <div className="bg-white border divide-y">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No actions yet.</div>
          )}
          {filtered.map((e) => {
            const team = e.team === 1 ? team1 : e.team === 2 ? team2 : null;
            const isEditing = editing === e.id;

            return (
              <div key={e.id}>
                <div className="px-3 py-2 grid grid-cols-[110px_140px_1fr_auto] items-center gap-3 text-sm">
                  <div className="text-[11px] text-muted-foreground font-mono">
                    H{e.half} · {e.clock}
                  </div>
                  <div className="flex items-center gap-2">
                    {team && <span className="w-2 h-4 inline-block" style={{ background: team.color }} />}
                    <span className="text-xs">{team?.shortCode || team?.name || (e.team ? `Team ${e.team}` : "—")}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">{e.action}</span>
                    {e.subtype && <span className="text-[11px] uppercase px-2 py-0.5 bg-muted rounded">{e.subtype}</span>}
                    {e.playerNo && <span className="text-muted-foreground text-xs">#{e.playerNo}</span>}
                    {e.missZone && <span className="text-[10px] text-muted-foreground">{e.missZone}</span>}
                    {(() => {
                      const z = chipZone(e);
                      return z ? <span className="text-[10px] uppercase px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">{z}</span> : null;
                    })()}
                    {(() => {
                      const s = chipStrength(e);
                      return s ? <span className="text-[10px] uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">{s}</span> : null;
                    })()}
                    {e.defense && <span className="text-[10px] uppercase px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">DEF {e.defense}</span>}
                    {e.fastBreak && <span className="text-[10px] uppercase px-1.5 py-0.5 bg-accent-red/10 text-accent-red rounded font-bold">FB</span>}
                    {e.assistNo && <span className="text-[10px] text-muted-foreground">AST #{e.assistNo}</span>}
                    {e.reboundNo && <span className="text-[10px] text-muted-foreground">REB #{e.reboundNo}</span>}
                    {e.involverNo && <span className="text-[10px] text-muted-foreground">vs #{e.involverNo}</span>}
                  </div>
                  <div className="flex gap-1">
                    {isEditing ? (
                      <button onClick={cancelEdit} className="h-8 px-2 bg-muted text-xs flex items-center gap-1"><X className="h-3 w-3" /> Close</button>
                    ) : (
                      <>
                        <button onClick={() => startEdit(e)} className="h-8 w-8 bg-muted hover:bg-accent-orange hover:text-white flex items-center justify-center" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                        <button
                          onClick={() => { if (confirm("Delete this action?")) deleteLogEntry(e.id); }}
                          className="h-8 w-8 bg-muted hover:bg-accent-red hover:text-white flex items-center justify-center"
                          title="Delete"
                        ><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <EditPanel
                    draft={draft}
                    entry={e}
                    team1={team1}
                    team2={team2}
                    setDraftField={setDraftField}
                    onPickCourt={() => setPickStep("court")}
                    onPickGoal={() => setPickStep("goal")}
                    onSave={() => saveEdit(e.id)}
                    onCancel={cancelEdit}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: pick origin on court */}
      {pickStep === "court" && editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPickStep(null)}>
          <div className="bg-white rounded shadow-2xl max-w-4xl w-full p-4" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold uppercase tracking-wider">Click on the court — shot origin</div>
              <button onClick={() => setPickStep(null)} className="text-xl leading-none">×</button>
            </div>
            <HandballCourt
              shots={log.filter((e) => (isPenaltyShot(e) || e.x != null) && e.id !== editing)}
              team1Color={team1.color}
              team2Color={team2.color}
              team1Direction={team1Direction}
              pending
              onCourtClick={(x, y) => {
                setDraft((d) => ({ ...d, x, y }));
                setPickStep("goal");
              }}
            />
          </div>
        </div>
      )}

      {/* Step 2: pick placement in goal mouth */}
      <GoalPicker
        open={pickStep === "goal"}
        mode="placement"
        action={String(draft.action || "")}
        onCancel={() => setPickStep(null)}
        onPlace={(gx, gy) => {
          setDraft((d) => ({ ...d, goalX: gx, goalY: gy }));
          setPickStep(null);
        }}
      />
      <AppFooter variant="light" className="mt-auto" />
    </div>
  );
}

interface EditPanelProps {
  draft: Partial<LogEntry>;
  entry: LogEntry;
  team1: ReturnType<typeof useGameStore.getState>["team1"];
  team2: ReturnType<typeof useGameStore.getState>["team2"];
  setDraftField: <K extends keyof LogEntry>(key: K, value: LogEntry[K] | undefined) => void;
  onPickCourt: () => void;
  onPickGoal: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function EditPanel({ draft, entry, team1, team2, setDraftField, onPickCourt, onPickGoal, onSave, onCancel }: EditPanelProps) {
  const currentTeam = (draft.team ?? entry.team) as 1 | 2 | null;
  const ownPlayers = currentTeam === 1 ? team1.players : currentTeam === 2 ? team2.players : [];
  const oppPlayers = currentTeam === 1 ? team2.players : currentTeam === 2 ? team1.players : [];
  const currentAction = String(draft.action ?? entry.action);
  const subOptions = SUBTYPES_BY_ACTION[currentAction];
  const isShot = SHOT_ACTIONS.has(currentAction);

  const attackVal = draft.strengthAttack ?? entry.strengthAttack;
  const defendVal = draft.strengthDefend ?? entry.strengthDefend;
  const emptyAttackVal = draft.strengthAttackEmpty ?? entry.strengthAttackEmpty ?? false;
  const zoneVal = draft.zone ?? entry.zone;
  const defenseVal = draft.defense ?? entry.defense;
  const missZoneVal = draft.missZone ?? entry.missZone;

  return (
    <div className="bg-slate-50 border-t px-4 py-4 space-y-4">
      {/* Basics */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Basics</div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Team</div>
            <select
              value={String(draft.team ?? entry.team ?? "")}
              onChange={(ev) => {
                const val = ev.target.value ? (Number(ev.target.value) as 1 | 2) : undefined;
                setDraftField("team", val ?? null);
                // reset player refs when team changes
                setDraftField("playerNo", "");
                setDraftField("assistNo", undefined);
                setDraftField("reboundNo", undefined);
                setDraftField("involverNo", undefined);
              }}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              <option value="1">{team1.name || "Team 1"}</option>
              <option value="2">{team2.name || "Team 2"}</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Player #</div>
            <select
              value={draft.playerNo ?? entry.playerNo ?? ""}
              onChange={(ev) => setDraftField("playerNo", ev.target.value || undefined)}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              {ownPlayers.map((p) => (
                <option key={p.id} value={p.no}>#{p.no} {p.name} {p.surname}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Action</div>
            <select
              value={String(draft.action ?? entry.action)}
              onChange={(ev) => { setDraftField("action", ev.target.value as ActionType); setDraftField("subtype", ""); }}
              className="h-8 border px-2 text-xs font-bold w-full"
            >
              {ALL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Subtype</div>
            <select
              value={draft.subtype ?? entry.subtype ?? ""}
              onChange={(ev) => setDraftField("subtype", ev.target.value || undefined)}
              disabled={!subOptions}
              className="h-8 border px-2 text-xs w-full disabled:bg-muted"
            >
              <option value="">—</option>
              {subOptions?.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Period</div>
            <select
              value={String(draft.half ?? entry.half)}
              onChange={(ev) => setDraftField("half", Number(ev.target.value))}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">EX1</option>
              <option value="4">EX2</option>
              <option value="5">EX3</option>
              <option value="6">EX4</option>
              <option value="7">PEN</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Clock</div>
            <input
              value={draft.clock ?? entry.clock ?? ""}
              onChange={(ev) => setDraftField("clock", ev.target.value)}
              placeholder="MM:SS"
              className="h-8 border px-2 text-xs w-full font-mono"
            />
          </label>
        </div>
      </section>

      {/* Involved players */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Involved Players</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Assist (own team)</div>
            <select
              value={draft.assistNo ?? entry.assistNo ?? ""}
              onChange={(ev) => setDraftField("assistNo", ev.target.value || undefined)}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              {ownPlayers.map((p) => (
                <option key={p.id} value={p.no}>#{p.no} {p.name} {p.surname}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Rebound #</div>
            <select
              value={draft.reboundNo ?? entry.reboundNo ?? ""}
              onChange={(ev) => setDraftField("reboundNo", ev.target.value || undefined)}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              {[...team1.players.map((p) => ({ ...p, _t: 1 as const })), ...team2.players.map((p) => ({ ...p, _t: 2 as const }))].map((p) => (
                <option key={`${p._t}-${p.id}`} value={p.no}>[{p._t === 1 ? (team1.shortCode || "T1") : (team2.shortCode || "T2")}] #{p.no} {p.name}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Rebound Team</div>
            <select
              value={String(draft.reboundTeam ?? entry.reboundTeam ?? "")}
              onChange={(ev) => setDraftField("reboundTeam", ev.target.value ? (Number(ev.target.value) as 1 | 2) : undefined)}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              <option value="1">{team1.name || "Team 1"}</option>
              <option value="2">{team2.name || "Team 2"}</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase">
            <div className="mb-1">Opponent involved</div>
            <select
              value={draft.involverNo ?? entry.involverNo ?? ""}
              onChange={(ev) => setDraftField("involverNo", ev.target.value || undefined)}
              className="h-8 border px-2 text-xs w-full"
            >
              <option value="">—</option>
              {oppPlayers.map((p) => (
                <option key={p.id} value={p.no}>#{p.no} {p.name} {p.surname}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* Shot details */}
      {isShot && (
        <section>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Shot Details</div>
          <div className="flex flex-wrap gap-2 items-center mb-2">
            <button onClick={onPickCourt} className="h-8 px-3 bg-accent-orange text-white text-xs font-bold flex items-center gap-1"><Crosshair className="h-3 w-3" /> Court Origin</button>
            <button onClick={onPickGoal} className="h-8 px-3 bg-accent-orange text-white text-xs font-bold flex items-center gap-1"><Target className="h-3 w-3" /> Goal Placement</button>
            <label className="ml-2 flex items-center gap-1 text-[11px] font-bold uppercase">
              <input
                type="checkbox"
                checked={draft.fastBreak ?? entry.fastBreak ?? false}
                onChange={(ev) => setDraftField("fastBreak", ev.target.checked || undefined)}
              />
              Fast Break
            </label>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="text-[10px] font-bold uppercase">
              <div className="mb-1">Miss Zone</div>
              <select
                value={missZoneVal ?? ""}
                onChange={(ev) => setDraftField("missZone", (ev.target.value || undefined) as MissZone | undefined)}
                className="h-8 border px-2 text-xs w-full"
              >
                <option value="">—</option>
                {MISS_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase">
              <div className="mb-1">Zone Override</div>
              <select
                value={zoneVal ?? ""}
                onChange={(ev) => setDraftField("zone", (ev.target.value || undefined) as CourtGeoZone | undefined)}
                className="h-8 border px-2 text-xs w-full"
              >
                <option value="">Auto (geometry)</option>
                {ZONE_OPTIONS.map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </label>
            <div className="text-[10px] font-bold uppercase col-span-2">
              <div className="mb-1">Coordinates</div>
              <div className="text-[11px] font-mono text-muted-foreground">
                court: {draft.x?.toFixed(2) ?? entry.x?.toFixed(2) ?? "—"}, {draft.y?.toFixed(2) ?? entry.y?.toFixed(2) ?? "—"}
                {" · "}goal: {draft.goalX?.toFixed(2) ?? entry.goalX?.toFixed(2) ?? "—"}, {draft.goalY?.toFixed(2) ?? entry.goalY?.toFixed(2) ?? "—"}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Strength Situation */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
          <span>Strength Situation Override</span>
          <button
            onClick={() => {
              setDraftField("strengthAttack", undefined);
              setDraftField("strengthDefend", undefined);
              setDraftField("strengthAttackEmpty", undefined);
              setDraftField("strengthDefendEmpty", undefined);
            }}
            className="text-[10px] font-bold uppercase text-accent-red hover:underline normal-case"
          >
            Clear override (use auto)
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {STRENGTH_PRESETS.map((p) => {
            const active = attackVal === p.attack && defendVal === p.defend;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => { setDraftField("strengthAttack", p.attack); setDraftField("strengthDefend", p.defend); }}
                className={`h-9 rounded border-2 text-xs font-extrabold ${active ? "bg-black text-white border-black" : "bg-white text-black border-black/30 hover:border-black"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <label className="mt-2 inline-flex items-center gap-2 text-[11px] font-bold uppercase bg-accent-red/10 text-accent-red px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={emptyAttackVal}
            onChange={(ev) => setDraftField("strengthAttackEmpty", ev.target.checked || undefined)}
          />
          Empty Goal (Attacking Team)
        </label>
      </section>

      {/* Defense */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Defense Formation</div>
        <div className="flex flex-wrap gap-2">
          {DEFENSE_OPTIONS.map((opt) => {
            const active = defenseVal === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setDraftField("defense", active ? undefined : opt)}
                className={`h-9 px-3 rounded border-2 text-xs font-bold ${active ? "bg-accent-orange text-white border-accent-orange" : "bg-white text-black border-black/30 hover:border-black"}`}
              >
                {opt}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setDraftField("defense", undefined)}
            className="h-9 px-3 rounded border-2 border-dashed border-black/30 text-xs font-bold hover:border-black"
          >
            Clear
          </button>
        </div>
      </section>

      <div className="flex gap-2 pt-2 border-t">
        <button onClick={onSave} className="h-9 px-4 bg-tab-done text-white text-xs font-bold uppercase flex items-center gap-1"><Check className="h-3 w-3" /> Save & Update Reports</button>
        <button onClick={onCancel} className="h-9 px-4 bg-muted text-xs font-bold uppercase flex items-center gap-1"><X className="h-3 w-3" /> Cancel</button>
      </div>
    </div>
  );
}
