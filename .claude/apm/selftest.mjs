#!/usr/bin/env node
// Self-test for the APM kit. Builds a throwaway git repo, copies the kit in,
// and checks the gate's promises: evidence is tied to the tree, complete
// needs green gates plus a review, tampering is caught, and the hooks deny,
// ask and block where they should. Exit code = number of failures.
//   node .claude/apm/selftest.mjs

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const kit = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apm-selftest-"));
let fails = 0;
let passes = 0;
const check = (cond, label) => {
  if (cond) passes++;
  else fails++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${label}`);
};

const env = { ...process.env, CLAUDE_PROJECT_DIR: tmp };
const git = (...a) => execFileSync("git", a, { cwd: tmp, env, encoding: "utf8" });
const node = (script, args = [], extraEnv = {}) =>
  spawnSync("node", [path.join(tmp, ".claude/apm", script), ...args], { cwd: tmp, env: { ...env, ...extraEnv }, encoding: "utf8" });
const hook = (name, payload) => {
  const r = spawnSync("node", [path.join(tmp, ".claude/apm/hooks", name)], { cwd: tmp, env, input: JSON.stringify(payload), encoding: "utf8" });
  return r.stdout ? JSON.parse(r.stdout) : {};
};
const decision = (out) => (out.hookSpecificOutput ? out.hookSpecificOutput.permissionDecision : "allow");

try {
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.cpSync(kit, path.join(tmp, ".claude/apm"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "tests"));
  fs.writeFileSync(path.join(tmp, "app.txt"), "v1\n");
  fs.writeFileSync(path.join(tmp, "tests/check.sh"), "#!/bin/sh\n# the contract\ngrep -q v app.txt\n");

  console.log("setup & verify");
  check(node("mission.mjs", ["init"]).status === 0, "init writes a config");
  const cfgPath = path.join(tmp, ".agent/master/config.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  cfg.gates = [
    { id: "unit", cmd: "sh tests/check.sh && test ! -f FAIL", required: true },
    { id: "lint", cmd: "true", required: false, note: "optional example" },
  ];
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  check(fs.readFileSync(path.join(tmp, ".gitignore"), "utf8").includes("!.agent/master/config.json"), "init keeps the config tracked and the evidence ignored");
  git("add", "-A");
  git("commit", "-qm", "base");

  let r = node("mission.mjs", ["start", "--goal", "ship v2", "--accept", "app says v2", "--max-cycles", "2"]);
  check(r.status === 0, "start a mission");
  check(node("mission.mjs", ["start", "--goal", "x", "--accept", "y"]).status !== 0, "a second live mission is refused");
  check(node("mission.mjs", ["cycle"]).status === 0, "cycle 1");

  fs.writeFileSync(path.join(tmp, "FAIL"), "");
  r = node("verify.mjs");
  check(r.status === 1 && r.stdout.includes("RED"), "a failing required gate makes verify exit 1");
  check(node("mission.mjs", ["set", "--status", "awaiting_review", "--reason", "r"]).status !== 0, "awaiting_review is refused over red gates");
  fs.unlinkSync(path.join(tmp, "FAIL"));
  fs.writeFileSync(path.join(tmp, "app.txt"), "v2\n");
  r = node("verify.mjs", ["--only", "unit"]);
  check(r.status === 0 && r.stdout.includes("partial"), "a partial run can pass");
  r = node("mission.mjs", ["set", "--status", "awaiting_review", "--reason", "r"]);
  check(r.status !== 0, "...but a partial run doesn't count as evidence");
  r = node("verify.mjs");
  check(r.status === 0 && r.stdout.includes("GREEN"), "a full run on the tree is green");

  console.log("complete needs a review");
  r = node("mission.mjs", ["set", "--status", "complete"]);
  check(r.status !== 0 && /review/.test(r.stderr), "complete is refused without a review");
  r = node("mission.mjs", ["review", "--verdict", "PASS", "--summary", "looks right", "--blocking", "missing edge case"]);
  check(r.status === 0, "a review with a blocking finding is recorded");
  check(node("mission.mjs", ["set", "--status", "complete"]).status !== 0, "complete is refused while a finding is blocking");
  check(node("mission.mjs", ["review", "--verdict", "PASS", "--summary", "fixed"]).status === 0, "a clean PASS is recorded");
  fs.writeFileSync(path.join(tmp, "app.txt"), "v2 edited\n");
  check(node("mission.mjs", ["set", "--status", "complete"]).status !== 0, "editing a file after review makes the evidence stale");
  fs.writeFileSync(path.join(tmp, "app.txt"), "v2\n");
  check(node("mission.mjs", ["set", "--status", "complete"]).status === 0, "the identical tree is complete again (content fingerprint)");
  git("add", "-A");
  git("commit", "-qm", "v2");
  const st = JSON.parse(node("mission.mjs", ["status", "--json"]).stdout);
  check(st.required_green === "yes" && st.passing_review === "yes", "committing a verified tree keeps its evidence");

  console.log("tampering");
  const ev = path.join(tmp, ".agent/master/evidence.jsonl");
  const original = fs.readFileSync(ev, "utf8");
  fs.writeFileSync(ev, original.replace('"required_green":false', '"required_green":true'));
  r = node("verify.mjs", ["--only", "unit"]);
  check(r.status !== 0 && /edited or reordered/.test(r.stderr + r.stdout), "a hand-edited evidence log is detected and refused");
  fs.writeFileSync(ev, original);

  console.log("stop gate");
  check(!hook("stop_gate.mjs", {}).decision, "a complete, backed mission lets the turn end");
  fs.writeFileSync(path.join(tmp, "app.txt"), "v3\n");
  check(hook("stop_gate.mjs", {}).decision === "block", "editing after declaring complete blocks the stop");
  check(node("mission.mjs", ["archive"]).status === 0, "archive a closed mission");
  check(!hook("stop_gate.mjs", {}).decision, "no mission: the turn ends normally");
  node("mission.mjs", ["start", "--goal", "g", "--accept", "a"]);
  check(hook("stop_gate.mjs", {}).decision === "block", "an active mission blocks the stop");
  check(hook("stop_gate.mjs", {}).decision === "block" && hook("stop_gate.mjs", {}).decision === "block", "...again (up to three times)");
  check(!hook("stop_gate.mjs", {}).decision, "...then gives way rather than trapping the session");
  check(node("mission.mjs", ["set", "--status", "awaiting_input", "--reason", "which colour?"]).status === 0, "awaiting_input with a question");
  check(!hook("stop_gate.mjs", {}).decision, "awaiting_input lets the turn end");
  check(node("mission.mjs", ["set", "--status", "blocked"]).status !== 0, "blocked needs a reason");

  console.log("pre-tool guard");
  const t = (tool, input, extra = {}) => decision(hook("pre_tool_guard.mjs", { tool_name: tool, tool_input: input, ...extra }));
  check(t("Write", { file_path: path.join(tmp, ".agent/master/evidence.jsonl"), content: "" }) === "deny", "writing the evidence log is denied");
  check(t("Edit", { file_path: path.join(tmp, ".agent/master/mission.json"), old_string: "a", new_string: "b" }) === "deny", "editing mission.json is denied");
  check(t("Bash", { command: "echo '{}' >> .agent/master/reviews.jsonl" }) === "deny", "appending to reviews by shell is denied");
  check(t("Bash", { command: "rm -rf .agent/master" }) === "deny", "deleting the state directory is denied");
  check(t("Bash", { command: "node .claude/apm/verify.mjs" }) === "allow", "running verify.mjs is allowed");
  check(t("Bash", { command: "node .claude/apm/mission.mjs review --verdict PASS --summary x" }) === "deny", "the main agent can't record a review");
  check(t("Bash", { command: "node .claude/apm/mission.mjs review --verdict PASS --summary x" }, { agent_type: "evidence-reviewer" }) === "allow", "the evidence-reviewer can");
  node("mission.mjs", ["set", "--status", "active"]);
  check(t("Write", { file_path: cfgPath, content: "{}" }) === "deny", "the gate config is frozen while a mission is live");
  const testFile = path.join(tmp, "tests/check.sh");
  check(t("Edit", { file_path: testFile, old_string: "grep -q v app.txt", new_string: "grep -q v app.txt\ngrep -q 2 app.txt" }) === "allow", "an additive test edit passes");
  check(t("Edit", { file_path: testFile, old_string: "grep -q v app.txt", new_string: "true" }) === "ask", "rewriting an assertion asks the human");
  check(t("Write", { file_path: testFile, content: "#!/bin/sh\ntrue\n" }) === "ask", "overwriting a test file asks");
  check(t("Write", { file_path: path.join(tmp, "tests/new_test.sh"), content: "true\n" }) === "allow", "a new test file is fine");
  check(t("Bash", { command: "sed -i 's/v/x/' tests/check.sh" }) === "ask", "sed -i on an existing test asks");
  check(t("Bash", { command: "rm tests/check.sh" }) === "ask", "deleting an existing test asks");
  check(t("Write", { file_path: path.join(tmp, "app.txt"), content: "v4\n" }) === "allow", "ordinary edits are untouched");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails);
