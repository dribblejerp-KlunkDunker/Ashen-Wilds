#!/usr/bin/env node
// PreToolUse hook. Keeps the evidence honest:
//   deny  - any write to .agent/master/ evidence, reviews or mission files
//           (only verify.mjs and mission.mjs write those);
//   deny  - editing .agent/master/config.json while a mission is live;
//   deny  - recording a review from anything but the evidence-reviewer agent;
//   ask   - rewriting or deleting assertions in an existing test file
//           (purely additive edits pass);
//   allow - everything else.
// Shell commands are matched by pattern. This is a tripwire, not a sandbox.

import fs from "node:fs";
import { isLive, loadConfig, loadMission, matchesAny, projectRoot, relToRoot } from "../lib.mjs";

let input = {};
try {
  input = JSON.parse(fs.readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}
const root = projectRoot();
const tool = input.tool_name || "";
const ti = input.tool_input || {};
const mission = loadMission(root);
const live = isLive(mission);
const cfg = loadConfig(root);
const testGlobs = cfg ? cfg.protected_tests : [];

function decide(decision, reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision, permissionDecisionReason: `APM guard: ${reason}` } })
  );
  process.exit(0);
}

const EVIDENCE = /(^|\/)\.agent\/master\/(evidence\.jsonl|reviews\.jsonl|mission\.json|\.stop_blocks|archive\/)/;
const CONFIG = /(^|\/)\.agent\/master\/config\.json$/;

function checkPath(rel) {
  if (EVIDENCE.test(rel) || rel === ".agent/master" || rel === ".agent") decide("deny", `${rel} is written only by verify.mjs / mission.mjs.`);
  if (CONFIG.test(rel) && live) decide("deny", "the gate config is frozen while a mission is live. Close the mission first, or ask the user.");
}

function existingTest(rel) {
  return testGlobs.length && matchesAny(rel, testGlobs) && fs.existsSync(`${root}/${rel}`);
}

const significant = (s) => s.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("//"));

function additive(oldText, newText) {
  // Every meaningful old line survives, in order.
  const want = significant(oldText);
  const have = significant(newText);
  let j = 0;
  for (const line of have) if (j < want.length && line === want[j]) j++;
  return j === want.length;
}

if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(tool)) {
  const rel = relToRoot(ti.file_path || ti.notebook_path || "", root);
  checkPath(rel);
  if (existingTest(rel)) {
    const cur = fs.readFileSync(`${root}/${rel}`, "utf8");
    let ok = true;
    if (tool === "Write") ok = additive(cur, ti.content || "");
    else if (tool === "Edit") ok = ti.replace_all ? additive(cur, cur.split(ti.old_string).join(ti.new_string)) : additive(ti.old_string || "", ti.new_string || "");
    else if (tool === "MultiEdit") ok = (ti.edits || []).every((e) => additive(e.old_string || "", e.new_string || ""));
    else ok = false;
    if (!ok) decide("ask", `this rewrites or removes lines in the existing test ${rel}. Approve only if the old assertion is demonstrably wrong.`);
  }
  process.exit(0);
}

if (tool === "Bash") {
  const c = String(ti.command || "");
  if (/mission\.mjs\s+review\b/.test(c) && input.agent_type !== "evidence-reviewer") {
    decide("deny", "reviews are recorded only by the evidence-reviewer subagent. Spawn it, or set --status awaiting_review.");
  }
  const writes = /(>>?|\btee\b|\brm\b|\bmv\b|\bcp\b|\btruncate\b|\bsed\s+-i|\bperl\s+-[a-z]*i|\bdd\b|\bln\b|\bchmod\b|writeFile|appendFile|open\([^)]*['"][wa])/;
  if (/\.agent\/master/.test(c) && writes.test(c) && !/^\s*node\s+(\S*\/)?\.claude\/apm\/(verify|mission)\.mjs\b[^;&|>]*$/.test(c)) {
    if (/\.agent\/master\/(evidence|reviews|mission|\.stop_blocks|archive)/.test(c) || /\.agent\/master\/?(\s|$|\*)/.test(c)) decide("deny", "the evidence files are written only by verify.mjs / mission.mjs.");
    if (/\.agent\/master\/config\.json/.test(c) && live) decide("deny", "the gate config is frozen while a mission is live.");
  }
  if (/\bgit\s+(checkout|restore|reset|clean|stash)\b/.test(c) && /\.agent/.test(c)) decide("deny", "don't restore or clean the evidence directory.");
  if (/\bsed\s+-i|\bperl\s+-[a-z]*i|\brm\b|\bmv\b|>|\btruncate\b|\bgit\s+(rm|checkout|restore)\b/.test(c)) {
    for (const tok of c.split(/[\s;|&<>()]+/)) {
      const word = tok.replace(/^["']+|["']+$/g, "");
      if (!word || word.startsWith("-")) continue;
      const rel = relToRoot(word, root);
      if (existingTest(rel)) decide("ask", `this shell command may rewrite or delete the existing test ${rel}.`);
    }
  }
}
process.exit(0);
