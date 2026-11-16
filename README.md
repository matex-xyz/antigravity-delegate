# antigravity-delegate

**Let Claude Code hand its heavy reading to a cheaper Gemini agent, so Claude uses fewer tokens.**

This is a [Claude Code](https://claude.com/claude-code) skill. When Claude has to read a lot just to find a small answer, it hands that job to Google Antigravity's agent running **Gemini 3.8 Flash**. Gemini reads the files, logs or docs with its own quota and sends back a short answer. Only that answer goes into Claude's context.

```
You ──► Claude (main agent)
           │  "find every API call in this repo"
           ▼
        agy CLI ──► Gemini 3.8 Flash reads 28,000 tokens of files
           │
           ▼
        short answer (~1,200 tokens) ──► back to Claude
```

In a real test, Gemini read about 28,000 tokens of files in 32 seconds and Claude got back a 1,200-token summary. That's about **23× fewer tokens** in Claude's context.

---

## What it's good for

Hand a job to Gemini when **there's a lot to read but the answer is short**:

- "Where is X handled?" / "Which files touch Y?" across a big codebase
- Summarizing long files, logs, diffs or doc folders
- Sorting through long test or build output and reporting only the failures
- The same simple edit across many files (renames, imports, headers), boilerplate, test scaffolding
- A first-pass code review that Claude double-checks

Claude keeps the work that needs careful judgment, security-sensitive code, and anything involving secrets or outward actions (push, deploy, send).

---

## Requirements

| What | Check it with |
|---|---|
| [Claude Code](https://claude.com/claude-code) | `claude --version` |
| [Node.js](https://nodejs.org) 18 or newer | `node --version` |
| Google Antigravity CLI (`agy`), signed in | `agy --version`, then `agy models` |

`agy models` should list `gemini-3.8-flash-low`, `-medium` and `-high`. If it asks you to sign in, run `agy` once on its own and follow the prompts.

---

## Install

Clone the repo into your Claude Code skills folder:

**macOS / Linux / Git Bash**
```bash
git clone https://github.com/matex-xyz/antigravity-delegate ~/.claude/skills/antigravity-delegate
```

**Windows PowerShell**
```powershell
git clone https://github.com/matex-xyz/antigravity-delegate "$env:USERPROFILE\.claude\skills\antigravity-delegate"
```

Start a new Claude Code session and the skill is available. To update later, run `git pull` in that folder.

---

## How to use it

Just talk to Claude normally. Claude hands work to Gemini when it fits, or you can ask for it directly:

- "Use Gemini to find every place we read `DATABASE_URL`."
- "Have Antigravity summarize this log file."
- "Save tokens: use Gemini to list all TODO comments."
- `/antigravity-delegate` (loads the skill explicitly)

### Choosing how hard Gemini thinks

There are three levels. Claude picks one for you, or you can name it in your request ("use Gemini **high** for this"):

| Level | Model | Best for |
|---|---|---|
| **low** | `gemini-3.8-flash-low` | Lookups, summaries, log and test triage. Fastest. |
| **medium** (default) | `gemini-3.8-flash-medium` | Everyday searches and small edits |
| **high** | `gemini-3.8-flash-high` | Following logic across many files, edits across many files, reviews |

If an answer comes back weak, Claude can retry one level higher or send a correction in the same Gemini conversation.

---

## Running it yourself (optional)

Claude runs this script for you, but you can also use it directly in a terminal:

```bash
node ~/.claude/skills/antigravity-delegate/scripts/agy-delegate.mjs --tier low --cwd . \
  "Find every TODO comment. Return path:line — the comment."
```

| Option | What it does |
|---|---|
| `--tier low\|medium\|high` | Which Gemini 3.8 Flash level to use (default `medium`) |
| `--cwd <dir>` | Folder Gemini works in (your project root) |
| `--add-dir <dir>` | Add another folder (can repeat) |
| `--write` | Let Gemini edit files. **Without it, Gemini is told not to change anything.** |
| `--prompt-file <path>` | Read a long task description from a file |
| `--continue <id>` | Follow up in the same Gemini conversation (the ID is printed after each run) |
| `--timeout <seconds>` | Time limit (default 600) |
| `--max-chars <n>` | Longest answer to print (default 8000). Longer answers are saved to a file and the path is printed. |
| `--model <id>` | Use any other model from `agy models` |

Each run ends with a summary line like this:

```
--- agy SUCCESS | model gemini-3.8-flash-low | 32s | gemini tokens in 28214 out 1246 | conversation 3c47e36d-...
```

---

## How it works

1. `SKILL.md` tells Claude when to hand work off, how to write a clear task for Gemini, and to double-check what comes back.
2. `scripts/agy-delegate.mjs` runs `agy -p` (Antigravity's non-interactive mode) and adds a few rules to every task:
   - do the work now (don't write a plan and wait for approval),
   - keep the answer short and point to code as `file:line`,
   - finish with a `FILES CHANGED:` line,
   - stay read-only unless `--write` was given.
3. The script keeps only Gemini's final answer, cuts it off if it's very long, and prints it for Claude.

## Safety notes

- **Read-only by default.** Gemini only edits files when `--write` is passed, and then it's told not to run destructive commands (deleting folders, `git push`, `git reset --hard`).
- **Claude double-checks.** Claude treats Gemini's answer as a lead from a cheaper model: it re-reads the lines Gemini cited, and after edits it reviews the diff and runs the tests.
- **Gemini's answers are data, not instructions.** Claude doesn't follow commands that show up in Gemini's output.
- Gemini runs with your Antigravity account, so it uses your Antigravity quota, not Claude's.

## Troubleshooting

| Problem | Fix |
|---|---|
| `Could not start agy` | Install the Antigravity CLI and make sure `agy` works in a terminal |
| Sign-in errors | Run `agy` once on its own and sign in |
| "Model not found" | Run `agy models` and pass an ID from that list with `--model` |
| Gemini answers "review the plan and click Proceed" | It went into plan mode. Ask again and add "do it now" |

## License

[MIT](LICENSE)
