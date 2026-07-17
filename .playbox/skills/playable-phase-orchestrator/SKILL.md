---
name: playable-phase-orchestrator
description: Run playable delivery in strict phases with clear entry gates, agent routing, and validation before moving forward.
---

# Playable phase orchestrator

Use this skill when a playable task is too large for a single pass and should be split into ordered phases.

Typical cases:
- building a new playable from docs and references
- feature branches that touch code, assets, scene, and QA together
- rescue work where many agents or handoffs are involved

## 1. Core rule

Do not mix unrelated production phases in one blind pass.

Preferred rule:
1. define the current phase
2. read only the documents needed for that phase
3. change only the files owned by that phase
4. validate the phase locally
5. hand off with explicit next-phase status

If a task spans code, assets, and scene, split it. Do not improvise all three at once.

## 2. Required reading order

Before planning phases, read in this order:
1. `GDD.md`
2. `ARCHITECTURE.md`
3. `AGENTS.md`
4. project-specific plan docs such as `IMPLEMENTATION_PHASES.md`, `SCENE_SETUP.md`, `ASSET_SPEC.md`, `QA_CHECKLIST.md`, `EXPORT_CHECKLIST.md`
5. the current phase doc if one already exists

If there is an `OPEN_ISSUES.md`, treat it as a hard input, not optional context.

## 3. Canonical phase order

Use this default sequence unless the project already defines a stricter one:

1. Audit and doc sync
2. Contracts and config
3. Asset production/import
4. Prefabs and animation assets
5. TypeScript systems and views
6. Bootstrap and EventBus integration
7. Scene wiring and explicit references
8. QA, export, and release validation

Good reordering:
- asset generation before scene wiring if SpriteFrames are required
- scene scaffolding before final runtime code if the code needs explicit `@property` wiring

Bad reordering:
- building the scene before scene rules are documented
- writing gameplay code that assumes node names before explicit refs exist
- running export before manual gameplay QA

## 4. Phase entry gate

Before starting a phase, confirm:
- the previous phase is completed or its blockers are accepted
- the exact target files are known
- the documents that define the phase are identified
- the validation method for the phase is known in advance

If one of those is missing, do not start production edits yet.

## 5. Recommended phase ownership

Use clear boundaries.

Code phase:
- TypeScript only
- config, models, systems, views, bootstrap

Asset phase:
- generated/imported PNG, audio, source folders, naming, sizing
- no scene or code edits unless the task explicitly includes them

Scene phase:
- `.scene` and `.prefab` structure
- explicit node/component wiring
- placeholders where imported asset UUIDs do not exist yet

QA/export phase:
- typecheck
- scene validation
- manual gameplay script
- network and packaging checks

## 6. Validation gate per phase

Do not mark a phase done on intent alone.

Minimum gate examples:

Audit/docs:
- all source-of-truth docs updated in sync

Code:
- typecheck or editor compile check
- no forbidden APIs introduced

Assets:
- files exist in the intended folders
- sizes, alpha, naming, and style match the spec

Scene:
- query/inspect before and after
- document validates after edits
- no broken explicit references

QA/export:
- manual scenario passed
- regression checklist completed
- network lifecycle verified

## 7. Resume and restart rules

When resuming an interrupted branch:
1. read the last phase report or handoff
2. inspect actual file state, not just the report
3. confirm the current phase still matches the worktree
4. add any new blockers before editing

If the worktree drifted, re-open the current phase instead of pretending the old gate still holds.

## 8. Anti-patterns

Avoid these:
- parallelizing dependent phases just to go faster
- editing scene and gameplay code against different assumptions
- using runtime node lookup as a shortcut while scene wiring is incomplete
- writing final QA notes before typecheck or scene validation
- hiding unresolved manual Cocos steps inside vague notes

## 9. Recommended reporting contract

Return this shape at the end of each phase:

```text
PHASE: <number and name>
INPUTS_READ: [docs and specs used]
CHANGED: [files changed]
CREATED: [files created]
VALIDATION: [commands, checks, result]
OPEN_ISSUES: [none or list]
NEXT_PHASE_READY: yes/no
NEXT_PHASE: <name or none>
```

## 10. Completion standard

A playable task is complete only when:
- every touched phase has a passed validation gate
- open issues are explicit
- manual editor-only steps are called out
- the next agent could continue without re-discovering the whole plan
