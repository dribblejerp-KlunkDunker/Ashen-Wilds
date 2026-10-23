#!/usr/bin/env node
// Installs the Autonomous Project Master kit.
//
//   node .claude/apm/install.mjs [/path/to/project] [--force] [--hooks-only]
//
// With no path it enables the hooks in this project. With a path it copies
// .claude/apm/ and .claude/agents/evidence-reviewer.md there first. Either way
// it merges settings.hooks.json into the target's .claude/settings.json, keeping
// any hooks already there. Restart Claude Code afterwards so the hooks load.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcClaude = path.resolve(here, "..");
const args = process.argv.slice(2);
const force = args.includes("--force");
const target = args.find((a) => !a.startsWith("--"));
const dst = path.resolve(target || path.resolve(srcClaude, ".."));
const sameProject = path.resolve(dst, ".claude") === srcClaude;

if (!fs.existsSync(path.join(dst, ".git"))) console.warn(`Warning: ${dst} is not a git repository root. The kit fingerprints files through git.`);

if (!sameProject && !args.includes("--hooks-only")) {
  const dstApm = path.join(dst, ".claude", "apm");
  if (fs.existsSync(dstApm) && !force) {
    console.error(`${dstApm} exists. Use --force to overwrite the kit files (state in .agent/ is untouched).`);
    process.exit(1);
  }
  fs.cpSync(here, dstApm, { recursive: true });
  fs.mkdirSync(path.join(dst, ".claude", "agents"), { recursive: true });
  fs.copyFileSync(path.join(srcClaude, "agents", "evidence-reviewer.md"), path.join(dst, ".claude", "agents", "evidence-reviewer.md"));
  console.log(`Copied the kit into ${dst}/.claude/.`);
}

const ours = JSON.parse(fs.readFileSync(path.join(here, "settings.hooks.json"), "utf8")).hooks;
const sp = path.join(dst, ".claude", "settings.json");
const settings = fs.existsSync(sp) ? JSON.parse(fs.readFileSync(sp, "utf8")) : {};
settings.hooks = settings.hooks || {};
let added = 0;
for (const [event, groups] of Object.entries(ours)) {
  const cur = settings.hooks[event] || [];
  for (const g of groups) {
    const cmd = g.hooks[0].command;
    if (!cur.some((x) => (x.hooks || []).some((h) => h.command === cmd))) {
      cur.push(g);
      added++;
    }
  }
  settings.hooks[event] = cur;
}
fs.mkdirSync(path.dirname(sp), { recursive: true });
fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + "\n");
console.log(`${added ? `Added ${added} hook(s) to` : "Hooks already present in"} ${path.relative(process.cwd(), sp) || sp}.
Next, in that project:
  node .claude/apm/mission.mjs init      # skip if .agent/master/config.json exists; then set "gates"
  node .claude/apm/verify.mjs            # baseline
  node .claude/apm/selftest.mjs          # optional: proves the gate and hooks behave
Restart Claude Code there so the hooks load.`);
