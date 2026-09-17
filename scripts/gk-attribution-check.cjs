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

if (process.exitCode) {
  console.error("gk attribution check failed");
  process.exit(1);
}
console.log("gk attribution check passed: 34 shots (13/16/2/3), H1=#96, H2=#1, off-frame not faced");
