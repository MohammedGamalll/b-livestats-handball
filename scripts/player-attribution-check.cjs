const {
  applyDirectedSub,
  applyTeamSub,
  parseSubNos,
  isPersonalJersey,
  eventMentionsPlayer,
  maxPeriodFromEvents,
} = require("../electron/gk.cjs");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) fail(`${msg}: got ${a} expected ${b}`);
}

// Directed 12↔1 with 7 already on court must drop #1 and add #12 (toggle-in-first cannot).
const seven = new Set(["1", "2", "3", "4", "5", "6", "7"]);
applyDirectedSub(seven, "12↔1", false);
if (!seven.has("12") || seven.has("1") || seven.size !== 7) {
  fail(`directed sub at 7 on court got ${[...seven].join(",")}`);
}

function toggleSub(onCourt, raw) {
  parseSubNos(raw).forEach((no) => {
    if (onCourt.has(no)) onCourt.delete(no);
    else if (onCourt.size < 7) onCourt.add(no);
  });
}
const tog = new Set(["1", "2", "3", "4", "5", "6", "7"]);
toggleSub(tog, "12↔1");
if (tog.has("12")) fail("sanity: old toggle must fail to add incoming #12 at 7 on court");

// Permanently-out player must not re-enter; outgoing still leaves.
const court = new Set(["9", "10", "11", "13", "14", "15", "16"]);
const banned = new Set(["8"]);
applyTeamSub(court, "8↔16", banned);
if (court.has("8") || court.has("16") || court.size !== 6) {
  fail(`blocked incoming #8 must not enter, got ${[...court].join(",")}`);
}
applyTeamSub(court, "22↔9", banned);
if (!court.has("22") || court.has("9")) fail(`applyTeamSub 22↔9 got ${[...court].join(",")}`);

if (!eventMentionsPlayer("12↔1", "12") || !eventMentionsPlayer("12↔1", "1")) {
  fail("sub pair must mention both jersey numbers");
}
if (eventMentionsPlayer("12↔1", "16")) fail("sub pair must not mention unrelated jersey");
if (isPersonalJersey("12↔1")) fail("12↔1 is not a personal jersey");
if (!isPersonalJersey("8")) fail("#8 is a personal jersey");

const otLog = [
  { half: 1, action: "GOAL", playerNo: "8" },
  { half: 2, action: "GOAL", playerNo: "9" },
  { half: 3, action: "GOAL", playerNo: "8" },
  { half: 4, action: "7M", playerNo: "9" },
];
eq(maxPeriodFromEvents(otLog, 2), 4, "OT max period");
eq(maxPeriodFromEvents([{ half: 1 }, { half: 2 }], 2), 2, "regulation max period");
eq(maxPeriodFromEvents([{ half: undefined }, {}], 2), 2, "missing half must not collapse to 1 extra period");

// Box-score style credit: events stay on event.playerNo across sub / H1-only / OT.
function creditGoals(log, teamN) {
  const map = new Map();
  for (const e of log) {
    if (e.team !== teamN || (e.action !== "GOAL" && e.action !== "7M")) continue;
    if (!isPersonalJersey(e.playerNo)) continue;
    map.set(e.playerNo, (map.get(e.playerNo) || 0) + 1);
  }
  return Object.fromEntries(map);
}

const fieldLog = [
  { team: 1, action: "GOAL", playerNo: "8", half: 1 },
  { team: 1, action: "SUBSTITUTION", playerNo: "19↔8", half: 1 },
  { team: 1, action: "GOAL", playerNo: "19", half: 1 },
  { team: 1, action: "GOAL", playerNo: "8", half: 2 },
  { team: 1, action: "7M", playerNo: "8", half: 3 },
  { team: 1, action: "GOAL", playerNo: "11", half: 1 },
];
eq(creditGoals(fieldLog, 1), { "8": 3, "19": 1, "11": 1 }, "goals stay on jersey after sub / H1 / OT");

const h1Only = [
  { team: 1, action: "GOAL", playerNo: "5", half: 1 },
  { team: 1, action: "SHOT SAVED", playerNo: "5", half: 1 },
  { team: 1, action: "SUBSTITUTION", playerNo: "17↔5", half: 2 },
  { team: 1, action: "GOAL", playerNo: "17", half: 2 },
];
eq(creditGoals(h1Only, 1), { "5": 1, "17": 1 }, "H1-only scorer keeps the goal after being subbed");

if (process.exitCode) {
  console.error("player attribution check failed");
} else {
  console.log("player attribution check passed: directed sub at 7, H1-only, OT, jersey-stable goals");
}
