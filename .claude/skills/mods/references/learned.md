# learned.md — mods

Append-only log of where `SKILL.md` or a reference misled, in the entry format
`SKILL.md` gives under "Improving this skill". Where an entry disagrees with the
body, the entry wins until curation folds it in.

No entries yet: the skill was written on 2026-10-16 from the session that built
`collapse-all` and `skills-pane`, and everything that session found is already
in the body and the references.

### 2026-10-16 — skills-pane: tests passed, a restarted session's pane said "No skills loaded yet"
The skill (Workflow step 3) treats validate + tsc + test as proof; the tests only covered
skills loaded live or through the Skill tool. Keith's session typed `/afriport-report`; the
desktop later restarted that session's engine, `$.state` came back empty, and the
`session.start` rebuild only knew Skill tool calls. i-have-adhd and Ponytail still showed
because their rebuild reads the API form.
Evidence: sp-probe atom `[]` after `-p --resume`; same probe found `typed=afriport-report`
in a copy of session ebbe8879; UIA read of another open session's pane listed its skills fine.
Proposed: Workflow step 3 in SKILL.md — "test what the pane shows after a restart: a
`session.start` with only a transcript beneath it". Domain detail is in plugin-mods.md §4, §6.
