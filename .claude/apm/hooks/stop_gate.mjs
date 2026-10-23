#!/usr/bin/env node
// Stop hook. Refuses to let a turn end while the mission's state isn't backed
// by evidence on the current tree:
//   - status "active": the work isn't closed (ask the user via awaiting_input,
//     or close with an honest status);
//   - a closed status whose evidence no longer holds (files changed after it
//     was declared, or the declaration's rule fails now).
// No mission, or an archived one: the turn ends normally.
// To avoid trapping a session, it gives way after 3 consecutive blocks and
// says so on stderr; any mission.mjs set/start resets the count.

import fs from "node:fs";
import { canDeclare, files, fingerprint, loadMission, projectRoot } from "../lib.mjs";

const MAX_BLOCKS = 3;
let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {}

const root = projectRoot();
const F = files(root);
const m = loadMission(root);

function allow() {
  try {
    fs.unlinkSync(F.stopCounter);
  } catch {}
  process.exit(0);
}

function block(reason) {
  let n = 0;
  try {
    n = Number(fs.readFileSync(F.stopCounter, "utf8")) || 0;
  } catch {}
  if (n >= MAX_BLOCKS) {
    console.error(`APM stop gate: giving way after ${MAX_BLOCKS} blocks. Unresolved: ${reason}`);
    allow();
  }
  try {
    fs.writeFileSync(F.stopCounter, String(n + 1));
  } catch {}
  process.stdout.write(JSON.stringify({ decision: "block", reason: `APM stop gate: ${reason}` }));
  process.exit(0);
}

if (!m || input.disable_apm) allow();

if (m.status === "awaiting_input") {
  if (!m.reason) block('status is awaiting_input with no question. Set --reason "<the question>".');
  allow();
}

if (m.status === "active") {
  block(
    `the mission "${m.goal}" is still active (cycle ${m.cycle}/${m.max_cycles}). Keep working, or close it honestly: ` +
      'node .claude/apm/mission.mjs set --status complete | complete_with_limitations | awaiting_review | blocked | budget_exhausted --reason "...", ' +
      'or ask the user with set --status awaiting_input --reason "<question>".'
  );
}

const fp = fingerprint(root).hash;
if (["complete", "awaiting_review", "complete_with_limitations"].includes(m.status) && m.closed_fingerprint && m.closed_fingerprint !== fp) {
  block(
    `files changed after the mission was declared ${m.status}. Re-run node .claude/apm/verify.mjs (and the review for complete) and set the status again, ` +
      "or archive the mission (mission.mjs archive) if this is new, unrelated work."
  );
}
const v = canDeclare(m.status, m.reason, root);
if (!v.ok) block(`status ${m.status} isn't backed by the evidence: ${v.why}.`);
allow();
