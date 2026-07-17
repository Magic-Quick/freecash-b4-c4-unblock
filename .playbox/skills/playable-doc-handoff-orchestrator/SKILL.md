---
name: playable-doc-handoff-orchestrator
description: Keep playable source-of-truth docs synchronized and produce reliable handoffs for the next agent or human.
---

# Playable doc and handoff orchestration

Use this skill when the task changes gameplay scope, scene structure, asset plan, QA expectations, or ownership between agents.

## 1. Core rule

For playable projects, documentation is not an afterthought. It is the control plane for future edits.

If code, scene, or assets change but the source-of-truth docs do not, the project becomes slower and less reliable for every later agent.

## 2. Source-of-truth precedence

When documents disagree, use this precedence until the conflict is resolved:

1. explicit client-approved `GDD.md`
2. `OPEN_ISSUES.md` or accepted assumptions log
3. `ARCHITECTURE.md`
4. scene and asset specs such as `SCENE_SETUP.md`, `ASSET_SPEC.md`, `PREFAB_STRATEGY.md`, `ANIMATION_STRATEGY.md`
5. phase plans such as `IMPLEMENTATION_PHASES.md`
6. `QA_CHECKLIST.md` and `EXPORT_CHECKLIST.md`
7. agent/command instructions in `.playbox/agent/` and `.playbox/command/`

If a lower-priority doc contradicts a higher one, sync it before treating it as a valid instruction.

## 3. Required doc set for healthy playable repos

Preferred structure:

```text
GDD.md
ARCHITECTURE.md
AGENTS.md
.playbox/game-design/
  OPEN_ISSUES.md
  IMPLEMENTATION_PHASES.md
  SCENE_SETUP.md
  ASSET_SPEC.md
  QA_CHECKLIST.md
  EXPORT_CHECKLIST.md
```

Projects may rename the folder, but the roles should remain explicit.

## 4. Change-to-doc impact map

Gameplay rule changed:
- sync `GDD.md`
- sync `ARCHITECTURE.md` if systems or state flow changed
- sync QA and export docs if player flow changed

Scene hierarchy changed:
- sync `SCENE_SETUP.md`
- sync architecture if refs or bootstrap ownership changed
- sync QA scene checks

Asset plan changed:
- sync `ASSET_SPEC.md`
- sync prefab/animation strategy docs if affected
- sync bundle/export expectations

CTA, analytics, or network behavior changed:
- sync GDD if user flow changed
- sync export/network validation docs
- sync any agent instructions that mention lifecycle wiring

## 5. Update order after a scope change

Preferred sync order:
1. document the new rule or decision
2. record unresolved unknowns in `OPEN_ISSUES.md`
3. update architecture/spec docs that implement the rule
4. update phase plan and QA/export expectations
5. only then update agent-facing instructions if needed

Do not start by rewriting agent prompts while the design docs are still stale.

## 6. Open issues policy

Use `OPEN_ISSUES.md` for questions that affect implementation order or correctness.

Good entries:
- missing CTA label approval
- unresolved store URL strategy
- unknown asset ownership
- network-specific packaging uncertainty

Bad entries:
- vague reminders without an action or decision needed
- issues that were already resolved but not removed

Each open issue should make clear:
- what is unknown
- why it matters
- temporary assumption if any
- what phase is blocked by it

## 7. Handoff quality bar

Every handoff should let the next agent start work without repo archaeology.

Include:
- current phase
- required reads in order
- what changed
- what is validated
- what is still manual in Cocos/editor
- blockers and assumptions
- the exact next recommended task

## 8. Manual-step policy

Call out editor-only steps explicitly.

Typical examples:
- reimport folders so Cocos generates `.meta`
- assign SpriteFrames or AnimationClips in Inspector
- reopen scene and verify script bindings
- run Play mode and observe a specific flow

Never hide manual steps inside `NOTES` if they gate correctness.

## 9. Anti-patterns

Avoid these:
- changing runtime flow without updating QA/export docs
- leaving phase docs from an old mechanic in place
- using agent instructions as the only design source
- writing a handoff that says only "continue from here"

## 10. Recommended handoff contract

```text
CURRENT_PHASE: <name>
REQUIRED_READS: [ordered list]
SOURCE_OF_TRUTH_UPDATED: [files]
CHANGED: [files]
VALIDATION_DONE: [checks and result]
MANUAL_EDITOR_STEPS: [none or list]
OPEN_ISSUES: [none or list]
ASSUMPTIONS: [none or list]
NEXT_OWNER_TASK: <single clear next task>
```

## 11. Completion standard

Doc-sync work is complete when:
- all touched implementation areas have matching docs
- stale instructions are removed or corrected
- blockers are explicit
- the next agent can identify the current truth in under one reading pass
