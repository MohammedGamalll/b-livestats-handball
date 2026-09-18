function parseSubNos(raw) {
  if (!raw) return [];
  if (String(raw).includes("↔")) return String(raw).split("↔").map((s) => s.trim()).filter(Boolean);
  return [String(raw).trim()].filter(Boolean);
}

function parseSubPair(raw) {
  const parts = parseSubNos(raw);
  if (parts.length >= 2) return { inNo: parts[0], outNo: parts[1] };
  if (parts.length === 1) return { inNo: parts[0] };
  return {};
}

function isPersonalJersey(raw) {
  const s = String(raw || "").trim();
  return !!s && !s.includes("↔");
}

function eventMentionsPlayer(raw, no) {
  const want = String(no || "").trim();
  if (!want) return false;
  return parseSubNos(raw).includes(want);
}

function maxPeriodFromEvents(events, minHalves) {
  let max = Math.max(1, minHalves || 2);
  for (const e of events || []) {
    const h = eventHalf(e);
    if (h && h > max) max = h;
  }
  return max;
}

function eventHalf(e) {
  const h = Number(e?.half);
  return Number.isFinite(h) && h >= 1 ? h : undefined;
}

function isGkPosition(pos) {
  const r = String(pos || "").trim().toUpperCase();
  return r === "GK" || r === "GOALKEEPER" || r.startsWith("GK");
}

function isPostMiss(e) {
  if (e.action !== "SHOT MISSED") return false;
  const z = String(e.missZone || e.subtype || "").toUpperCase();
  return z === "POST" || z === "LEFT_CROSSBAR" || z === "RIGHT_CROSSBAR";
}

function isOffFrameMiss(e) {
  if (e.action !== "SHOT MISSED") return false;
  if (e.subtype === "SAVE" || e.subtype === "BLOCK") return false;
  return !isPostMiss(e);
}

function classifyGkShot(e) {
  if (e.subtype === "EMPTY GOAL") return null;
  if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) return "save";
  if (e.action === "GOAL" || e.action === "7M") return "goal";
  if (isPostMiss(e)) return "post";
  return null;
}

function eventElapsedSec(e, halfLength, otLength, halves) {
  const [mm, ss] = String(e.clock || "00:00").split(":").map((v) => parseInt(v, 10) || 0);
  const clockSec = mm * 60 + ss;
  const half = eventHalf(e);
  if (half == null) return clockSec;
  let elapsedBefore = 0;
  for (let h = 1; h < half; h++) elapsedBefore += (h > halves ? otLength : halfLength) * 60;
  const thisLen = (half > halves ? otLength : halfLength) * 60;
  const inPeriod = e.clockElapsed
    ? Math.min(thisLen, Math.max(0, clockSec))
    : Math.max(0, thisLen - clockSec);
  return elapsedBefore + inPeriod;
}

function emptyKeeper(p) {
  return {
    no: String(p.no).trim(),
    name: `${p.name || ""} ${p.surname || ""}`.trim(),
    saves: 0,
    conceded: 0,
    posts: 0,
    faced: 0,
    savePct: 0,
    seconds: 0,
    minutes: 0,
    periodsPlayed: [],
    shareOfTeamSaves: 0,
    shareOfTeamFaced: 0,
    shotEvents: [],
  };
}

function rosterGks(team) {
  const players = Array.isArray(team?.players) ? team.players : [];
  const named = players.filter((p) => p.no && isGkPosition(p.position));
  if (named.length) return named;
  return players.filter((p) => p.no && (p.no === "1" || p.no === "12" || p.no === "16"));
}

function endOnCourt(team) {
  const players = Array.isArray(team?.players) ? team.players : [];
  return new Set(
    players.filter((p) => p.onCourt === true && !p.excluded).map((p) => String(p.no).trim()).filter(Boolean),
  );
}

function sortEvents(log, halfLength, otLength, halves) {
  return [...(log || [])]
    .map((e) => ({ e, t: eventElapsedSec(e, halfLength, otLength, halves), ts: e.ts || 0, half: eventHalf(e) ?? 0 }))
    .sort((a, b) => a.half - b.half || a.t - b.t || a.ts - b.ts);
}

function applyDirectedSub(onCourt, raw, reverse) {
  const { inNo, outNo } = parseSubPair(raw);
  if (inNo && outNo) {
    const enter = reverse ? outNo : inNo;
    const leave = reverse ? inNo : outNo;
    onCourt.delete(leave);
    onCourt.add(enter);
    return;
  }
  const only = inNo || outNo;
  if (!only) return;
  if (onCourt.has(only)) onCourt.delete(only);
  else onCourt.add(only);
}

function applyTeamSub(onCourt, raw, permanentlyOut) {
  const blocked = (no) => !no || (permanentlyOut && permanentlyOut.has(no));
  const { inNo, outNo } = parseSubPair(raw);
  if (inNo && outNo) {
    if (!blocked(outNo)) onCourt.delete(outNo);
    if (!blocked(inNo)) onCourt.add(inNo);
    return;
  }
  const only = inNo || outNo;
  if (blocked(only)) return;
  applyDirectedSub(onCourt, raw, false);
}

function reconstructKickoffOnCourt(team, log, teamN, halfLength, otLength, halves) {
  const onCourt = endOnCourt(team);
  const reverse = [...sortEvents(log, halfLength, otLength, halves)].reverse();
  for (const { e } of reverse) {
    if (e.team !== teamN || e.action !== "SUBSTITUTION") continue;
    applyDirectedSub(onCourt, e.playerNo, true);
  }
  if (onCourt.size === 0) {
    const gks = rosterGks(team).sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
    if (gks[0]?.no) onCourt.add(String(gks[0].no).trim());
    for (const p of team.players || []) {
      if (onCourt.size >= 7) break;
      const n = String(p.no || "").trim();
      if (n && !onCourt.has(n)) onCourt.add(n);
    }
  }
  return onCourt;
}

function rosterGkNos(gks) {
  return (gks || []).map((g) => String(g.no).trim()).filter(Boolean);
}

function pickActiveGk(onCourt, rosterOrder, prev) {
  const present = (rosterOrder || []).filter((no) => onCourt.has(no));
  if (!present.length) return "";
  if (present.length === 1) return present[0];
  if (prev && present.includes(prev)) return prev;
  return present[0];
}

function activeAfterSub(onCourt, gkNos, rosterOrder, prev, raw) {
  const { inNo } = parseSubPair(raw);
  if (inNo && gkNos.has(inNo) && onCourt.has(inNo)) return inNo;
  return pickActiveGk(onCourt, rosterOrder, prev);
}

function isGkSub(e, teamN, gkNos) {
  if (e.team !== teamN || e.action !== "SUBSTITUTION") return false;
  return parseSubNos(e.playerNo).some((n) => gkNos.has(n));
}

function setCourtGk(onCourt, gkNos, next) {
  if (!next) return;
  for (const no of [...onCourt]) {
    if (gkNos.has(no) && no !== next) onCourt.delete(no);
  }
  onCourt.add(next);
}

function periodAtSec(sec, halfLength, otLength, halves) {
  let t = 0;
  let h = 1;
  for (;;) {
    const len = (h > halves ? otLength : halfLength) * 60;
    if (sec < t + len || h > halves + 8) return h;
    t += len;
    h++;
  }
}

function addPlayTime(keepers, gkNow, from, until, cfg) {
  const dt = Math.max(0, until - from);
  if (!dt || !gkNow.length) return;
  for (const no of gkNow) {
    const row = keepers.get(no);
    if (!row) continue;
    row.seconds += dt;
    const startP = periodAtSec(from, cfg.halfLength, cfg.otLength, cfg.halves);
    const endP = periodAtSec(Math.max(from, until - 1), cfg.halfLength, cfg.otLength, cfg.halves);
    for (let p = startP; p <= endP; p++) {
      if (!row.periodsPlayed.includes(p)) row.periodsPlayed.push(p);
    }
  }
}

function creditShot(row, e, kind, half) {
  if (!row) return;
  if (kind === "save") row.saves++;
  else if (kind === "goal") row.conceded++;
  else row.posts++;
  if (half >= 1 && !row.periodsPlayed.includes(half)) row.periodsPlayed.push(half);
  row.shotEvents.push({
    eventId: e.id,
    half,
    action: kind === "post" ? "SHOT MISSED" : kind === "save" ? "SHOT SAVED" : e.action,
    kind,
    goalX: e.goalX,
    goalY: e.goalY,
    missZone: e.missZone,
  });
}

function finalize(team, keepers) {
  const list = [...keepers.values()].sort((a, b) => (Number(a.no) || 0) - (Number(b.no) || 0));
  const teamSaves = list.reduce((a, k) => a + k.saves, 0);
  const teamConceded = list.reduce((a, k) => a + k.conceded, 0);
  const teamPosts = list.reduce((a, k) => a + k.posts, 0);
  const teamFaced = teamSaves + teamConceded;
  for (const k of list) {
    k.faced = k.saves + k.conceded;
    k.savePct = k.faced > 0 ? (k.saves / k.faced) * 100 : 0;
    k.minutes = Math.round(k.seconds / 60);
    k.periodsPlayed.sort((a, b) => a - b);
    k.shareOfTeamSaves = teamSaves > 0 ? (k.saves / teamSaves) * 100 : 0;
    k.shareOfTeamFaced = teamFaced > 0 ? (k.faced / teamFaced) * 100 : 0;
  }
  return {
    teamName: team.name || "",
    teamColor: team.color || "#111",
    teamSaves,
    teamConceded,
    teamPosts,
    teamFaced,
    teamSavePct: teamFaced > 0 ? (teamSaves / teamFaced) * 100 : 0,
    keepers: list,
  };
}

function attributeGoalkeepers(team, log, teamN, opts) {
  const halves = opts?.halves || 2;
  const halfLength = opts?.halfLength || 30;
  const otLength = opts?.otLength || 5;
  const cfg = { halves, halfLength, otLength };
  const gks = rosterGks(team);
  const gkNos = new Set(gks.map((g) => String(g.no).trim()));
  const keepers = new Map();
  for (const g of gks) keepers.set(String(g.no).trim(), emptyKeeper(g));
  const opp = teamN === 1 ? 2 : 1;
  const timed = sortEvents(log, halfLength, otLength, halves);
  let maxHalf = halves;
  for (const e of log || []) {
    const h = eventHalf(e);
    if (h != null && h > maxHalf) maxHalf = h;
  }
  let matchEnd = 0;
  for (let h = 1; h <= maxHalf; h++) matchEnd += (h > halves ? otLength : halfLength) * 60;

  const kickoff = reconstructKickoffOnCourt(team, log, teamN, halfLength, otLength, halves);
  const rosterOrder = rosterGkNos(gks);
  const anySub = (log || []).some((e) => isGkSub(e, teamN, gkNos));
  const useHalfHeuristic = gks.length === 2 && !anySub;
  const endGk = pickActiveGk(endOnCourt(team), rosterOrder);
  const kickoffGk = pickActiveGk(kickoff, rosterOrder);
  const otherGk = rosterOrder.find((n) => n && n !== endGk) || "";

  let onCourt = new Set(kickoff);
  let activeGk = kickoffGk;
  if (useHalfHeuristic && otherGk && endGk && otherGk !== endGk) {
    setCourtGk(onCourt, gkNos, otherGk);
    activeGk = otherGk;
  }

  let lastT = 0;
  let currentHalf = 1;

  for (const { e, t } of timed) {
    const h = eventHalf(e);
    if (h != null && h > currentHalf) {
      addPlayTime(keepers, activeGk ? [activeGk] : [], lastT, t, cfg);
      lastT = t;
      if (useHalfHeuristic && h > 1 && endGk) {
        setCourtGk(onCourt, gkNos, endGk);
        activeGk = endGk;
      }
      currentHalf = h;
    }

    addPlayTime(keepers, activeGk ? [activeGk] : [], lastT, t, cfg);
    lastT = t;

    if (e.team === teamN && e.action === "SUBSTITUTION") {
      applyDirectedSub(onCourt, e.playerNo, false);
      activeGk = activeAfterSub(onCourt, gkNos, rosterOrder, activeGk, e.playerNo);
    } else if (
      e.team === teamN &&
      (e.action === "2-MIN" || e.action === "RED" || e.action === "BLUE") &&
      e.playerNo &&
      gkNos.has(e.playerNo)
    ) {
      onCourt.delete(e.playerNo);
      if (e.playerNo === activeGk) activeGk = pickActiveGk(onCourt, rosterOrder);
    }

    if (e.team === opp) {
      const kind = classifyGkShot(e);
      if (kind && activeGk) creditShot(keepers.get(activeGk), e, kind, h ?? currentHalf);
    }
  }
  addPlayTime(keepers, activeGk ? [activeGk] : [], lastT, matchEnd, cfg);
  return finalize(team, keepers);
}

function keeperByNo(report, no) {
  const k = String(no || "").trim();
  return (report.keepers || []).find((g) => g.no === k);
}

function summarizeTeamShots(log, shootingTeam) {
  let goals = 0;
  let saves = 0;
  let posts = 0;
  let off = 0;
  for (const e of log || []) {
    if (e.team !== shootingTeam) continue;
    if (e.action === "GOAL" || e.action === "7M") goals++;
    else if (e.action === "SHOT SAVED" || (e.action === "SHOT MISSED" && e.subtype === "SAVE")) saves++;
    else if (isPostMiss(e)) posts++;
    else if (isOffFrameMiss(e)) off++;
  }
  return { goals, saves, posts, off, total: goals + saves + posts + off };
}

module.exports = {
  attributeGoalkeepers,
  keeperByNo,
  isGkPosition,
  classifyGkShot,
  eventHalf,
  summarizeTeamShots,
  isOffFrameMiss,
  isPostMiss,
  parseSubNos,
  parseSubPair,
  isPersonalJersey,
  eventMentionsPlayer,
  maxPeriodFromEvents,
  applyDirectedSub,
  applyTeamSub,
};
