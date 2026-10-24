#!/usr/bin/env node
// Runs the project's gates from .agent/master/config.json and appends one
// hash-chained record to evidence.jsonl, tied to the working-tree fingerprint.
//
//   node .claude/apm/verify.mjs            every gate (a "full" run)
//   node .claude/apm/verify.mjs --only id  one or more gates (partial: never counts as done)
//   node .claude/apm/verify.mjs --list     show the gates
//
// Exit code: 0 when every required gate that ran passed, 1 otherwise, 2 on setup errors.
// If the tree changes while the gates run, the record is marked unstable and
// does not count: a gate must not rewrite the files it checks.

import { spawnSync } from "node:child_process";
import { appendChain, fingerprint, files, loadConfig, loadMission, projectRoot } from "./lib.mjs";

const args = process.argv.slice(2);
const root = projectRoot();
const cfg = loadConfig(root);
if (!cfg) {
  console.error("No .agent/master/config.json. Run: node .claude/apm/mission.mjs init");
  process.exit(2);
}
if (args.includes("--list")) {
  for (const g of cfg.gates) console.log(`${g.required ? "required" : "optional"}  ${g.id}  ${g.cmd}${g.note ? `  (${g.note})` : ""}`);
  process.exit(0);
}
const only = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--only" && args[i + 1]) only.push(...args[++i].split(","));
const unknown = only.filter((id) => !cfg.gates.some((g) => g.id === id));
if (unknown.length) {
  console.error(`Unknown gate(s): ${unknown.join(", ")}`);
  process.exit(2);
}
const gates = only.length ? cfg.gates.filter((g) => only.includes(g.id)) : cfg.gates;
if (!gates.length) {
  console.error("No gates configured.");
  process.exit(2);
}

const before = fingerprint(root);
const results = [];
for (const g of gates) {
  const t0 = Date.now();
  process.stdout.write(`── ${g.id}${g.required ? "" : " (optional)"}: ${g.cmd}\n`);
  const r = spawnSync(g.cmd, {
    cwd: root,
    shell: process.env.SHELL && process.env.SHELL.endsWith("bash") ? process.env.SHELL : "/bin/bash",
    encoding: "utf8",
    timeout: (g.timeout_s || 900) * 1000,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(g.env || {}) },
  });
  const output = `${r.stdout || ""}${r.stderr || ""}`;
  const timedOut = r.error && r.error.code === "ETIMEDOUT";
  const exit = r.status === null ? (timedOut ? 124 : 1) : r.status;
  const passed = exit === 0 && !timedOut;
  const tail = output.split("\n").slice(-40).join("\n").trim();
  results.push({ id: g.id, required: !!g.required, cmd: g.cmd, exit, passed, timed_out: !!timedOut, seconds: Math.round((Date.now() - t0) / 100) / 10, tail });
  console.log(`   ${passed ? "PASS" : "FAIL"}  exit ${exit}${timedOut ? " (timed out)" : ""}  ${results.at(-1).seconds}s`);
  if (!passed && tail) console.log(tail.split("\n").map((l) => "   | " + l).join("\n"));
}
const after = fingerprint(root);
const stable = before.hash === after.hash;
const mission = loadMission(root);
const rec = appendChain(files(root).evidence, {
  kind: "verify",
  ts: new Date().toISOString(),
  fingerprint: stable ? after.hash : `unstable:${before.hash}->${after.hash}`,
  files: after.files,
  partial: only.length > 0,
  mission_cycle: mission ? mission.cycle : null,
  gates: results,
  required_green: stable && results.filter((r) => r.required).every((r) => r.passed),
});
const failedRequired = results.filter((r) => r.required && !r.passed).map((r) => r.id);
console.log("");
if (!stable) console.log("UNSTABLE: the tree changed while the gates ran. This run doesn't count. A gate must not write tracked files.");
console.log(`${failedRequired.length ? "RED" : "GREEN"}${only.length ? " (partial run)" : ""}  ${results.filter((r) => r.passed).length}/${results.length} gates passed · tree ${after.hash.slice(0, 12)} (${after.files} files) · record ${rec.hash.slice(0, 12)}`);
if (failedRequired.length) console.log(`Required gates failing: ${failedRequired.join(", ")}`);
process.exit(!stable || failedRequired.length ? 1 : 0);
