const { attributeGoalkeepers, keeperByNo, summarizeTeamShots } = require("../electron/gk.cjs");

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function makeShot(id, half, action, extra = {}) {
  return {
    id: String(id),
    ts: id,
    team: 2,
    action,
    half,
    clock: half === 1 ? "20:00" : "15:00",
    ...extra,
  };
}

function buildLog() {
  const log = [];
  let id = 1;
  const push = (half, action, extra) => {
    log.push(makeShot(id++, half, action, extra));
  };
  for (let i = 0; i < 6; i++) push(1, "GOAL");
  for (let i = 0; i < 4; i++) push(1, "SHOT SAVED");
  push(1, "SHOT MISSED", { missZone: "POST" });
  push(1, "SHOT MISSED", { missZone: "WIDE" });
  for (let i = 0; i < 7; i++) push(2, "GOAL");
  for (let i = 0; i < 12; i++) push(2, "SHOT SAVED");
  push(2, "SHOT MISSED", { missZone: "LEFT_CROSSBAR" });
  push(2, "SHOT MISSED", { missZone: "OVER" });
  push(2, "SHOT MISSED", { missZone: "WIDE" });
  return log;
}

const team = {
  name: "Ours",
  color: "#111",
  players: [
    { no: "96", name: "Sara", surname: "", position: "GK", onCourt: false },
    { no: "1", name: "Lubna", surname: "", position: "GK", onCourt: true },
  ],
};

const logNoSub = buildLog();
const totals = summarizeTeamShots(logNoSub, 2);
if (totals.goals !== 13 || totals.saves !== 16 || totals.posts !== 2 || totals.off !== 3 || totals.total !== 34) {
  fail(`team shot totals ${JSON.stringify(totals)} expected 13/16/2/3 total 34`);
}

const reportNoSub = attributeGoalkeepers(team, logNoSub, 1, { halves: 2, halfLength: 30 });
const sara = keeperByNo(reportNoSub, "96");
const lubna = keeperByNo(reportNoSub, "1");
if (!sara || sara.conceded !== 6 || sara.saves !== 4 || sara.posts !== 1) {
  fail(`H1 Sara expected 6G/4S/1P got ${JSON.stringify(sara && { g: sara.conceded, s: sara.saves, p: sara.posts, periods: sara.periodsPlayed })}`);
}
if (!lubna || lubna.conceded !== 7 || lubna.saves !== 12 || lubna.posts !== 1) {
  fail(`H2 Lubna expected 7G/12S/1P got ${JSON.stringify(lubna && { g: lubna.conceded, s: lubna.saves, p: lubna.posts, periods: lubna.periodsPlayed })}`);
}
if (sara.shotEvents.some((e) => e.half !== 1)) fail("Sara has non-H1 events");
if (lubna.shotEvents.some((e) => e.half !== 2)) fail("Lubna has non-H2 events");
if (sara.faced + lubna.faced !== 29) fail(`faced ${sara.faced + lubna.faced} expected 29 (off-frame not faced)`);

const logWithSub = [
  ...logNoSub,
  { id: "sub", ts: 50, team: 1, action: "SUBSTITUTION", playerNo: "1↔96", half: 2, clock: "30:00" },
];
const reportSub = attributeGoalkeepers(team, logWithSub, 1, { halves: 2, halfLength: 30 });
const sara2 = keeperByNo(reportSub, "96");
const lubna2 = keeperByNo(reportSub, "1");
if (!sara2 || sara2.conceded !== 6 || sara2.saves !== 4) fail("directed sub still must give H1 to #96");
if (!lubna2 || lubna2.conceded !== 7 || lubna2.saves !== 12) fail("directed sub still must give H2 to #1");

function shot(id, half, clock, action, extra = {}) {
  return { id: String(id), ts: id, team: 2, action, half, clock, ...extra };
}

const team3 = {
  name: "Sharks",
  color: "#1565c0",
  players: [
    { no: "1", name: "Seif", surname: "El-Din", position: "GK", onCourt: false },
    { no: "12", name: "Hossam", surname: "Fathy", position: "GK", onCourt: false },
    { no: "16", name: "Badr", surname: "Maher", position: "GK", onCourt: true },
    { no: "2", name: "Marwan", surname: "Said", position: "LW", onCourt: true },
  ],
};

const log3 = [
  shot(1, 1, "20:00", "GOAL"),
  shot(2, 1, "18:00", "SHOT SAVED"),
  { id: "s1", ts: 10, team: 1, action: "SUBSTITUTION", playerNo: "12↔1", half: 1, clock: "10:00" },
  shot(3, 1, "08:00", "SHOT SAVED"),
  shot(4, 1, "07:00", "GOAL"),
  { id: "s2", ts: 20, team: 1, action: "SUBSTITUTION", playerNo: "16↔12", half: 2, clock: "25:00" },
  shot(5, 2, "20:00", "GOAL"),
  shot(6, 2, "15:00", "SHOT SAVED"),
  shot(7, 2, "10:00", "SHOT SAVED"),
];

const report3 = attributeGoalkeepers(team3, log3, 1, { halves: 2, halfLength: 30 });
const g1 = keeperByNo(report3, "1");
const g12 = keeperByNo(report3, "12");
const g16 = keeperByNo(report3, "16");
if (!g1 || g1.conceded !== 1 || g1.saves !== 1) {
  fail(`#1 H1 starter expected 1G/1S got ${JSON.stringify(g1 && { g: g1.conceded, s: g1.saves, p: g1.posts, periods: g1.periodsPlayed })}`);
}
if (!g12 || g12.conceded !== 1 || g12.saves !== 1) {
  fail(`#12 after first sub expected 1G/1S got ${JSON.stringify(g12 && { g: g12.conceded, s: g12.saves, periods: g12.periodsPlayed })}`);
}
if (!g16 || g16.conceded !== 1 || g16.saves !== 2) {
  fail(`#16 H2 expected 1G/2S got ${JSON.stringify(g16 && { g: g16.conceded, s: g16.saves, periods: g16.periodsPlayed })}`);
}

const team3end1 = {
  name: "Sharks",
  players: [
    { no: "1", position: "GK", onCourt: true },
    { no: "12", position: "GK", onCourt: false },
    { no: "16", position: "GK", onCourt: false },
  ],
};
const log3noSub = [shot(1, 1, "20:00", "GOAL"), shot(2, 2, "15:00", "SHOT SAVED")];
const report3noSub = attributeGoalkeepers(team3end1, log3noSub, 1, { halves: 2, halfLength: 30 });
const n1 = keeperByNo(report3noSub, "1");
const n12 = keeperByNo(report3noSub, "12");
const n16 = keeperByNo(report3noSub, "16");
if (!n1 || n1.conceded !== 1 || n1.saves !== 1) fail("3 GKs no sub: all shots stay with the on-court keeper");
if (!n12 || n12.faced !== 0) fail("3 GKs no sub: #12 must not receive the old 2-GK H1 heuristic");
if (!n16 || n16.faced !== 0) fail("3 GKs no sub: #16 must stay at zero if they never entered");

const teamToggle = {
  name: "Sharks",
  players: [
    { no: "1", position: "GK", onCourt: true },
    { no: "12", position: "GK", onCourt: false },
    { no: "16", position: "GK", onCourt: true },
  ],
};
const logToggle = [
  shot(1, 1, "20:00", "GOAL"),
  { id: "t16", ts: 10, team: 1, action: "SUBSTITUTION", playerNo: "16", half: 1, clock: "10:00" },
  shot(2, 1, "05:00", "SHOT SAVED"),
  shot(3, 1, "04:00", "SHOT SAVED"),
];
const reportToggle = attributeGoalkeepers(teamToggle, logToggle, 1, { halves: 2, halfLength: 30 });
const t1 = keeperByNo(reportToggle, "1");
const t16 = keeperByNo(reportToggle, "16");
if (!t1 || t1.conceded !== 1 || t1.saves !== 0) {
  fail(`toggle-in #16 must not dump later shots on lowest number #1, got ${JSON.stringify(t1 && { g: t1.conceded, s: t1.saves })}`);
}
if (!t16 || t16.saves !== 2 || t16.conceded !== 0) {
  fail(`toggle-in #16 expected 2 saves, got ${JSON.stringify(t16 && { g: t16.conceded, s: t16.saves })}`);
}

if (process.exitCode) {
  console.error("gk attribution check failed");
  process.exit(1);
}
console.log("gk attribution check passed: 34 shots (13/16/2/3), H1=#96, H2=#1; 3-GK rotation and toggle-in credit the keeper in net");
