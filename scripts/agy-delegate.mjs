#!/usr/bin/env node
// Delegate a task to Antigravity's agent (Gemini 3.8 Flash by default) and print a compact result.
// Usage: node agy-delegate.mjs [options] "<task prompt>"
//   --tier low|medium|high   Gemini 3.8 Flash variant (default: medium)
//   --model <id>             Any model from `agy models` (overrides --tier)
//   --cwd <dir>              Workspace directory for the agent (default: current dir)
//   --add-dir <dir>          Extra workspace directory (repeatable)
//   --write                  Allow file edits (accept-edits mode). Default is read-only by instruction.
//   --prompt-file <path>     Read the task prompt from a file (for long briefs)
//   --continue <id>          Resume a previous delegated conversation by ID
//   --timeout <seconds>      Hard time limit (default: 600)
//   --max-chars <n>          Cap on printed response; the full text goes to a file (default: 8000)
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const opt = { tier: "medium", cwd: process.cwd(), addDirs: [], write: false, timeout: 600, maxChars: 8000 };
const rest = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  const next = () => args[++i];
  switch (a) {
    case "--tier": opt.tier = next(); break;
    case "--model": opt.model = next(); break;
    case "--cwd": opt.cwd = resolve(next()); break;
    case "--add-dir": opt.addDirs.push(resolve(next())); break;
    case "--write": opt.write = true; break;
    case "--prompt-file": opt.promptFile = next(); break;
    case "--continue": opt.conversation = next(); break;
    case "--timeout": opt.timeout = Number(next()); break;
    case "--max-chars": opt.maxChars = Number(next()); break;
    default: rest.push(a);
  }
}

let task = opt.promptFile ? readFileSync(opt.promptFile, "utf8") : rest.join(" ");
if (!task.trim()) {
  console.error("No task given. Usage: node agy-delegate.mjs [options] \"<task>\"");
  process.exit(2);
}

const guard = opt.write
  ? "You may edit files inside the workspace as the task requires. Do not run destructive commands (deleting directories, git push, git reset --hard, installing global packages)."
  : "READ-ONLY TASK: do not create, modify or delete any files, and do not run commands that change state.";
const prompt = `${task.trim()}

---
Rules for this delegated task:
- ${guard}
- Do not write a plan and wait for approval; do the work now and answer in this turn.
- Your reply is read by another AI agent with a limited context budget. Be dense: no preamble, no restating the task. Use file paths with line numbers (path:line) when pointing at code. Quote code only when essential.
- End with a line "FILES CHANGED: <comma-separated paths or none>".`;

const model = opt.model || `gemini-3.8-flash-${opt.tier}`;
const agyArgs = ["-p", prompt, "--model", model, "--output-format", "json", "--print-timeout", `${opt.timeout}s`];
if (opt.write) agyArgs.push("--mode", "accept-edits");
if (opt.conversation) agyArgs.push("--conversation", opt.conversation);
for (const d of opt.addDirs) agyArgs.push("--add-dir", d);

const child = spawn("agy", agyArgs, { cwd: opt.cwd, windowsHide: true, shell: false });
let out = "", err = "";
child.stdout.on("data", (d) => (out += d));
child.stderr.on("data", (d) => (err += d));
const killer = setTimeout(() => child.kill(), (opt.timeout + 30) * 1000);

child.on("error", (e) => {
  console.error(`Could not start agy: ${e.message}. Is the Antigravity CLI installed and on PATH?`);
  process.exit(1);
});

child.on("close", (code) => {
  clearTimeout(killer);
  let res;
  try {
    res = JSON.parse(out.slice(out.indexOf("{")));
  } catch {
    console.error(`agy exited with code ${code} and no JSON result.\n${(err || out).slice(-2000)}`);
    process.exit(1);
  }
  let text = (res.response || "").trim();
  let note = "";
  if (text.length > opt.maxChars) {
    const dir = join(tmpdir(), "agy-delegate");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${res.conversation_id || Date.now()}.md`);
    writeFileSync(file, text);
    text = text.slice(0, opt.maxChars);
    note = `\n[truncated at ${opt.maxChars} chars; full response: ${file}]`;
  }
  const u = res.usage || {};
  console.log(text + note);
  console.log(
    `\n--- agy ${res.status} | model ${model} | ${Math.round(res.duration_seconds || 0)}s | ` +
      `gemini tokens in ${u.input_tokens ?? "?"} out ${u.output_tokens ?? "?"} | conversation ${res.conversation_id}`
  );
  process.exit(res.status === "SUCCESS" ? 0 : 1);
});
