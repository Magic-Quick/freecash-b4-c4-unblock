---
name: template-reference-migration
description: Migrate from legacy or reference playable projects without copying technical debt or leaking reference assets into production.
---

# Template and reference migration

Use this skill when a new playable starts from a template, a previous campaign, a donor project, or a `.playbox/reference` library.

## 1. Core rule

Audit before copy.

The correct workflow is:

```text
reference audit -> migration plan -> selective reuse -> rename/rewire -> validate bundle boundaries
```

The wrong workflow is:

```text
copy project wholesale -> patch random files -> runtime searches nodes by name -> reference assets leak into build
```

## 2. Classify every source first

Before migrating anything, classify source material into one of these buckets:
- runtime base: safe to adapt as project foundation
- reference-only: learn from it but do not ship it directly
- asset donor: selected assets may be copied into production folders
- obsolete: not worth migrating

Document the classification. Do not keep it implicit.

## 3. Required audit questions

Answer these before production edits:
- which systems are worth reusing as-is
- which systems need renaming or namespace isolation
- which scenes/prefabs are reference only
- which assets are temporary visual references only
- which CTA, analytics, or adapter behaviors are template-specific and must not survive unchanged
- which files must never be bundled in production

## 4. Rename and namespace rules

When reusing runtime classes, make ownership obvious.

Preferred pattern:
- rename imported gameplay classes to project-specific names
- keep prefabs under `assets/prefabs/<project>/**`
- keep animations under `assets/animations/<project>/**`
- keep copied art under `assets/art/**`

Avoid leaving core production classes with generic or donor-specific names if they now belong to a different game.

## 5. Bundle boundary rules

Reference folders must not quietly become production dependencies.

Hard rules:
- do not import runtime code directly from reference-only folders in final production
- do not ship `.playbox/reference/**` as bundle content
- do not keep donor scenes or huge reference images in production output unless explicitly intended
- do not couple store/CTA logic to donor paths or donor network assumptions

## 6. Migration order

Recommended order:
1. audit references and document what is reusable
2. define the target scene and architecture contracts
3. migrate the smallest stable runtime foundation first
4. migrate prefabs and assets into production-owned folders
5. rewire scene and bootstrap explicitly
6. delete or isolate donor-only assumptions only after the replacement works

Do not start by copying a complete donor scene and then repairing it with code lookups.

## 7. Scene migration rules

For scene work:
- build a new hierarchy around the target playable flow
- keep explicit anchors and refs
- preserve critical legacy nodes until replacements are validated
- keep reference screenshots or layouts as comparison targets, not runtime assets

If the donor scene is only a visual hint, rebuild the production scene cleanly.

## 8. Logic migration rules

For code work:
- keep template logic only if it matches the target game loop
- isolate generic subsystems such as EventBus, object pooling, reel logic, or utility math
- rewrite gameplay rules that are specific to the new mechanic instead of layering hacks on top
- disable or remove template auto-CTA, auto-flow, or analytics behavior that conflicts with the new design

## 9. Common traps

Avoid these:
- production imports from reference-only folders
- copied prefabs that still depend on donor assets
- leaving donor class names in bootstrap and views
- keeping template CTA timing that no longer matches the new payoff
- hiding migration debt behind `find()` and `getChildByName()`

## 10. Validation checklist

Before calling the migration healthy, confirm:
- runtime files no longer depend on reference-only imports
- production assets live under production-owned folders
- the scene can run without donor paths present
- template-specific CTA or flow logic is intentionally adapted or removed
- QA and export docs reflect the new project, not the donor project

## 11. Reporting contract

```text
REFERENCE_AUDITED: [sources reviewed]
REUSE_DECISIONS: [what was kept, adapted, or rejected]
RENAMED_OR_NAMESPACED: [list]
PRODUCTION_PATHS: [new owning folders]
REFERENCE_ONLY_LEFT: [list]
VALIDATION: [checks and result]
OPEN_ISSUES: [none or list]
```
