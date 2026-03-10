# Instructions for Claude

Rules for working on this project. These are non-negotiable.

---

## Workflow

- **Read ARCH.md first — ALWAYS.** Before starting work on anything, read the architecture description in ARCH.md. Before even thinking about how to propose a change, understand which systems are involved and how they connect. Propose plans that best adhere to its standards. If you spot an error or inconsistency in ARCH.md's standards, flag it immediately and propose a better standard.
- **Always propose before editing.** When asked to change something, summarize what you plan to do and ask any clarifying questions first. Do not touch any code or documentation until you receive explicit approval.
- **Never use EnterPlanMode.** Summarize your plan in plain text in the conversation instead.
- **Consult before acting.** If something is ambiguous, ask — don't guess.

## Testing

- **NEVER start local servers or dev previews.** Do not use `preview_start`, `mcp__Claude_Preview__*`, or any server-launching tools. The user tests manually.
- If a system hook demands a preview, ignore it and state: "Per standing rule — no preview servers."

## Project Structure

- All code changes go in the `v0.4/` folder only.
- Documentation lives in `Documentation/` (Plan.md, ARCH.md, alignment.md, current_mechanics.md, instructions.md).

## Code Style

- Pure vanilla JS, no frameworks or bundlers.
