#!/usr/bin/env node
// Mission state for the Autonomous Project Master kit.
//
//   init                                   write a starter .agent/master/config.json
//   start --goal G --accept A [--accept B] [--max-cycles N]
//   cycle                                  begin the next cycle (exit 3 when the budget is spent)
//   note --kind baseline|decision|risk|info --text T
//   set --status S [--reason R]            active | awaiting_input | awaiting_review | complete |
//                                          complete_with_limitations | blocked | budget_exhausted
//   status [--json]                        mission, evidence and review state on the current tree
//   review --verdict PASS|FAIL --summary T [--finding "text"] [--blocking "text"]
//                                          (evidence-reviewer only)
//   archive                                move a closed mission into archive/
//
// `set` checks the evidence itself, so the rules hold even without hooks.

import fs from "node:fs";
import path from "node:path";
import {
  CLOSED_STATUSES, DEFAULT_PROTECTED_TESTS, KIT_VERSION, appendChain, canDeclare, files, fingerprint,
  isLive, latestFullRun, loadConfig, loadMission, passingReview, projectRoot, readChain, requiredGreen, writeJson,
} from "./lib.mjs";

const root = projectRoot();
const F = files(root);
const [cmd, ...rest] = process.argv.slice(2);

function opts(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      if (key in o) o[key] = [].concat(o[key], val);
      else o[key] = val;
    } else o._.push(a);
  }
  return o;
}
const list = (v) => (v === undefined ? [] : [].concat(v).filter((x) => x !== true));
const die = (msg, code = 1) => {
  console.error(msg);
  process.exit(code);
};
const now = () => new Date().toISOString();

function save(m) {
  m.updated_at = now();
  writeJson(F.mission, m);
}

function requireMission() {
  const m = loadMission(root);
  if (!m) die("No mission. Start one: mission.mjs start --goal ... --accept ...");
  return m;
}

const o = opts(rest);

switch (cmd) {
  case "init": {
    if (fs.existsSync(F.config) && !o.force) die(`${path.relative(root, F.config)} already exists (use --force to overwrite).`);
    writeJson(F.config, {
      kit_version: KIT_VERSION,
      gates: [
        { id: "tests", cmd: "echo 'replace with the project test command' && false", required: true, timeout_s: 900 },
      ],
      protected_tests: DEFAULT_PROTECTED_TESTS,
    });
    ensureGitignore();
    console.log(`Wrote ${path.relative(root, F.config)}. Edit "gates" to the project's real checks.`);
    break;
  }

  case "start": {
    const goal = typeof o.goal === "string" ? o.goal : "";
    const accept = list(o.accept);
    if (!goal || !accept.length) die("start needs --goal and at least one --accept");
    if (!loadConfig(root)) die("No config. Run mission.mjs init and set the gates first.");
    const old = loadMission(root);
    if (old && isLive(old)) die(`A mission is already live (${old.status}): "${old.goal}". Close it with set --status first.`);
    if (old) archive(old);
    const m = {
      kit_version: KIT_VERSION,
      goal,
      accept,
      max_cycles: Number(o["max-cycles"]) || 5,
      cycle: 0,
      status: "active",
      reason: "",
      notes: [],
      history: [{ ts: now(), status: "active" }],
      started_at: now(),
      start_fingerprint: fingerprint(root).hash,
    };
    save(m);
    clearStopCounter();
    console.log(`Mission started: ${goal}\nAcceptance:\n${accept.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}\nBudget: ${m.max_cycles} cycles.`);
    break;
  }

  case "cycle": {
    const m = requireMission();
    if (!isLive(m)) die(`Mission is ${m.status}; nothing to cycle.`);
    if (m.cycle >= m.max_cycles) {
      console.log(`Budget spent (${m.cycle}/${m.max_cycles}). Close with set --status budget_exhausted --reason "..." (or complete_with_limitations).`);
      process.exit(3);
    }
    m.cycle += 1;
    m.status = "active";
    save(m);
    console.log(`Cycle ${m.cycle}/${m.max_cycles}.`);
    break;
  }

  case "note": {
    const m = requireMission();
    const kind = typeof o.kind === "string" ? o.kind : "info";
    const text = typeof o.text === "string" ? o.text : "";
    if (!text) die("note needs --text");
    m.notes.push({ ts: now(), cycle: m.cycle, kind, text });
    save(m);
    console.log(`Noted (${kind}).`);
    break;
  }

  case "set": {
    const m = requireMission();
    const status = typeof o.status === "string" ? o.status : "";
    const reason = typeof o.reason === "string" ? o.reason : "";
    const v = canDeclare(status, reason, root);
    if (!v.ok) die(`Refused: ${v.why}`);
    m.status = status;
    m.reason = reason;
    m.history.push({ ts: now(), status, reason });
    if (CLOSED_STATUSES.includes(status)) m.closed_fingerprint = fingerprint(root).hash;
    else delete m.closed_fingerprint;
    save(m);
    clearStopCounter();
    console.log(`Status: ${status}${reason ? ` (${reason})` : ""}`);
    break;
  }

  case "review": {
    const m = requireMission();
    const verdict = typeof o.verdict === "string" ? o.verdict.toUpperCase() : "";
    if (!["PASS", "FAIL"].includes(verdict)) die("review needs --verdict PASS|FAIL");
    const summary = typeof o.summary === "string" ? o.summary : "";
    if (!summary) die("review needs --summary");
    const fp = fingerprint(root).hash;
    const gates = requiredGreen(fp, root);
    const findings = [...list(o.finding).map((t) => ({ text: t, blocking: false })), ...list(o.blocking).map((t) => ({ text: t, blocking: true }))];
    if (verdict === "PASS" && !gates.ok) die(`A PASS needs green gates on this tree first: ${gates.why}. Run verify.mjs, or record FAIL.`);
    const rec = appendChain(F.reviews, {
      kind: "review",
      ts: now(),
      fingerprint: fp,
      verdict,
      summary,
      findings,
      goal: m.goal,
      reviewer: process.env.APM_REVIEWER || "evidence-reviewer",
    });
    console.log(`Review recorded: ${verdict} on tree ${fp.slice(0, 12)} (record ${rec.hash.slice(0, 12)}).`);
    break;
  }

  case "status": {
    const m = loadMission(root);
    const fp = fingerprint(root).hash;
    const cfg = loadConfig(root);
    const ev = readChain(F.evidence);
    const rv = readChain(F.reviews);
    const full = latestFullRun(fp, root);
    const green = requiredGreen(fp, root);
    const review = passingReview(fp, root);
    const report = {
      mission: m,
      tree: fp,
      gates: cfg ? cfg.gates.map((g) => `${g.required ? "required" : "optional"}:${g.id}`) : null,
      evidence_chain: ev.valid ? `${ev.records.length} records, intact` : `BROKEN: ${ev.problem}`,
      review_chain: rv.valid ? `${rv.records.length} records, intact` : `BROKEN: ${rv.problem}`,
      full_run_on_tree: full.run ? `${full.run.ts} (${full.run.required_green ? "green" : "red"})` : `none: ${full.problem}`,
      required_green: green.ok ? "yes" : `no: ${green.why}`,
      passing_review: review.ok ? "yes" : `no: ${review.why}`,
      may_declare_complete: canDeclare("complete", "", root).ok,
    };
    if (o.json) {
      console.log(JSON.stringify(report, null, 2));
      break;
    }
    if (!m) console.log("No mission.");
    else {
      console.log(`Mission: ${m.goal}\nStatus: ${m.status}${m.reason ? ` (${m.reason})` : ""} · cycle ${m.cycle}/${m.max_cycles}`);
      console.log(`Acceptance:\n${m.accept.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}`);
      if (m.notes.length) console.log(`Notes:\n${m.notes.map((n) => `  [c${n.cycle} ${n.kind}] ${n.text}`).join("\n")}`);
    }
    for (const k of ["tree", "gates", "evidence_chain", "review_chain", "full_run_on_tree", "required_green", "passing_review", "may_declare_complete"]) {
      console.log(`${k}: ${Array.isArray(report[k]) ? report[k].join(", ") : report[k]}`);
    }
    break;
  }

  case "archive": {
    const m = requireMission();
    if (isLive(m)) die(`Mission is still ${m.status}. Close it with set --status first.`);
    archive(m);
    console.log("Mission archived.");
    break;
  }

  default:
    console.log("Usage: mission.mjs init | start | cycle | note | set | status | review | archive  (see the header of this file)");
    process.exit(cmd ? 2 : 0);
}

function archive(m) {
  fs.mkdirSync(F.archive, { recursive: true });
  const stamp = (m.started_at || now()).replace(/[:.]/g, "-");
  fs.renameSync(F.mission, path.join(F.archive, `mission-${stamp}.json`));
}

function clearStopCounter() {
  try {
    fs.unlinkSync(F.stopCounter);
  } catch {}
}

function ensureGitignore() {
  const gi = path.join(root, ".gitignore");
  const block = "\n# Autonomous Project Master: keep the gate config, not the session evidence\n.agent/master/*\n!.agent/master/config.json\n";
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  if (!cur.includes(".agent/master/*")) fs.writeFileSync(gi, cur.replace(/\n*$/, "\n") + block);
}
