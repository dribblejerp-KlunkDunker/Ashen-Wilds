// Autonomous Project Master kit: shared helpers.
//
// State lives in <project>/.agent/master/:
//   config.json      gates + protected test globs (committed)
//   mission.json     the live mission (goal, acceptance, cycles, notes, status)
//   evidence.jsonl   one record per verify.mjs run, hash-chained
//   reviews.jsonl    one record per evidence-reviewer verdict, hash-chained
//
// The fingerprint is a SHA-256 over the contents of every file git would see
// (tracked + untracked, not ignored), excluding .agent/. Committing a verified
// tree keeps its fingerprint; editing any file changes it.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const KIT_VERSION = "1.0.0";

export function projectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

export function stateDir(root = projectRoot()) {
  return path.join(root, ".agent", "master");
}

export const files = (root = projectRoot()) => {
  const d = stateDir(root);
  return {
    dir: d,
    config: path.join(d, "config.json"),
    mission: path.join(d, "mission.json"),
    evidence: path.join(d, "evidence.jsonl"),
    reviews: path.join(d, "reviews.jsonl"),
    stopCounter: path.join(d, ".stop_blocks"),
    archive: path.join(d, "archive"),
  };
};

export function readJson(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(tmp, p);
}

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------
export function listTreeFiles(root = projectRoot()) {
  let out;
  try {
    out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
      cwd: root,
      encoding: "buffer",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    throw new Error("APM needs a git repository to fingerprint the working tree.");
  }
  const seen = new Set();
  for (const rel of out.toString("utf8").split("\0")) {
    if (!rel || rel === ".agent" || rel.startsWith(".agent/")) continue;
    seen.add(rel);
  }
  return [...seen].sort();
}

export function fingerprint(root = projectRoot()) {
  const h = createHash("sha256");
  let count = 0;
  for (const rel of listTreeFiles(root)) {
    const abs = path.join(root, rel);
    let digest;
    try {
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) continue;
      digest = st.isSymbolicLink() ? "link:" + fs.readlinkSync(abs) : sha256(fs.readFileSync(abs));
    } catch {
      continue; // tracked but deleted: absent from the hash, so the hash changes
    }
    h.update(`${rel}\0${digest}\n`);
    count++;
  }
  return { hash: h.digest("hex"), files: count };
}

// ---------------------------------------------------------------------------
// Hash-chained logs
// ---------------------------------------------------------------------------
function recordHash(rec) {
  const { hash, ...body } = rec;
  return sha256(JSON.stringify(body));
}

export function readChain(p) {
  if (!fs.existsSync(p)) return { records: [], valid: true, problem: "" };
  const lines = fs.readFileSync(p, "utf8").split("\n").filter((l) => l.trim());
  const records = [];
  let prev = "genesis";
  for (let i = 0; i < lines.length; i++) {
    let rec;
    try {
      rec = JSON.parse(lines[i]);
    } catch {
      return { records, valid: false, problem: `${path.basename(p)} line ${i + 1} is not JSON` };
    }
    if (rec.prev !== prev || rec.hash !== recordHash(rec)) {
      return { records, valid: false, problem: `${path.basename(p)} record ${i + 1} was edited or reordered` };
    }
    records.push(rec);
    prev = rec.hash;
  }
  return { records, valid: true, problem: "" };
}

export function appendChain(p, body) {
  const chain = readChain(p);
  if (!chain.valid) throw new Error(`Refusing to append: ${chain.problem}. Evidence must not be edited by hand.`);
  const prev = chain.records.length ? chain.records[chain.records.length - 1].hash : "genesis";
  const rec = { ...body, prev };
  rec.hash = recordHash(rec);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.appendFileSync(p, JSON.stringify(rec) + "\n");
  return rec;
}

// ---------------------------------------------------------------------------
// Config, mission, evidence queries
// ---------------------------------------------------------------------------
export const DEFAULT_PROTECTED_TESTS = ["tests/**", "test/**", "**/__tests__/**", "**/*.test.*", "**/*.spec.*", "**/*_test.*", "**/test_*.*"];

export function loadConfig(root = projectRoot()) {
  const cfg = readJson(files(root).config);
  if (!cfg) return null;
  cfg.gates = Array.isArray(cfg.gates) ? cfg.gates : [];
  cfg.protected_tests = Array.isArray(cfg.protected_tests) ? cfg.protected_tests : DEFAULT_PROTECTED_TESTS;
  return cfg;
}

export function loadMission(root = projectRoot()) {
  return readJson(files(root).mission);
}

export const LIVE_STATUSES = ["active", "awaiting_input"];
export const CLOSED_STATUSES = ["complete", "complete_with_limitations", "awaiting_review", "blocked", "budget_exhausted"];

export function isLive(m) {
  return !!m && LIVE_STATUSES.includes(m.status);
}

/** The latest full (not --only) verify run recorded on this fingerprint. */
export function latestFullRun(fp, root = projectRoot()) {
  const chain = readChain(files(root).evidence);
  if (!chain.valid) return { run: null, problem: chain.problem };
  for (let i = chain.records.length - 1; i >= 0; i--) {
    const r = chain.records[i];
    if (r.kind === "verify" && !r.partial && r.fingerprint === fp) return { run: r, problem: "" };
  }
  return { run: null, problem: "no full verify.mjs run on the current tree" };
}

/** Every required gate in the current config passed in that run. */
export function requiredGreen(fp, root = projectRoot()) {
  const cfg = loadConfig(root);
  if (!cfg) return { ok: false, why: "no .agent/master/config.json (run mission.mjs init)" };
  const { run, problem } = latestFullRun(fp, root);
  if (!run) return { ok: false, why: problem };
  const byId = new Map(run.gates.map((g) => [g.id, g]));
  const failing = [];
  for (const g of cfg.gates.filter((x) => x.required)) {
    const r = byId.get(g.id);
    if (!r) failing.push(`${g.id} (not run)`);
    else if (!r.passed) failing.push(`${g.id} (exit ${r.exit}${r.timed_out ? ", timed out" : ""})`);
  }
  if (failing.length) return { ok: false, why: `required gates not green: ${failing.join(", ")}`, run };
  return { ok: true, why: "", run };
}

export function passingReview(fp, root = projectRoot()) {
  const chain = readChain(files(root).reviews);
  if (!chain.valid) return { ok: false, why: chain.problem };
  for (let i = chain.records.length - 1; i >= 0; i--) {
    const r = chain.records[i];
    if (r.fingerprint !== fp) continue;
    if (r.verdict === "PASS" && !(r.findings || []).some((f) => f.blocking)) return { ok: true, why: "", review: r };
    return { ok: false, why: `the latest review of this tree is ${r.verdict}${(r.findings || []).some((f) => f.blocking) ? " with blocking findings" : ""}` };
  }
  return { ok: false, why: "no evidence-reviewer verdict on the current tree" };
}

/**
 * Whether `status` may be declared right now. Returns { ok, why }.
 * The same rules back mission.mjs set and the Stop hook.
 */
export function canDeclare(status, reason, root = projectRoot()) {
  const fp = fingerprint(root).hash;
  const needReason = ["complete_with_limitations", "awaiting_review", "blocked", "budget_exhausted", "awaiting_input"];
  if (needReason.includes(status) && !(reason && reason.trim())) return { ok: false, why: `status ${status} needs --reason` };
  switch (status) {
    case "complete": {
      const g = requiredGreen(fp, root);
      if (!g.ok) return { ok: false, why: g.why };
      const r = passingReview(fp, root);
      if (!r.ok) return { ok: false, why: r.why };
      return { ok: true, why: "" };
    }
    case "awaiting_review": {
      const g = requiredGreen(fp, root);
      return g.ok ? { ok: true, why: "" } : { ok: false, why: g.why };
    }
    case "complete_with_limitations": {
      const { run, problem } = latestFullRun(fp, root);
      return run ? { ok: true, why: "" } : { ok: false, why: problem };
    }
    case "active":
    case "awaiting_input":
    case "blocked":
    case "budget_exhausted":
      return { ok: true, why: "" };
    default:
      return { ok: false, why: `unknown status ${status}` };
  }
}

// ---------------------------------------------------------------------------
// Globs (for protected tests). Supports **, *, ? and {a,b}.
// ---------------------------------------------------------------------------
export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        re += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      re += "(?:" + glob.slice(i + 1, end).split(",").map((s) => s.replace(/[.+^$()|[\]\\]/g, "\\$&")).join("|") + ")";
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

export function matchesAny(rel, globs) {
  return globs.some((g) => globToRegExp(g).test(rel));
}

export function relToRoot(p, root = projectRoot()) {
  const abs = path.resolve(root, p);
  return path.relative(root, abs).split(path.sep).join("/");
}
