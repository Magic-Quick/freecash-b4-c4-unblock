---
name: playable-qa-release-gate
description: Run final static, scene, manual, and network-level checks before shipping a playable.
---

# Playable QA and release gate

Use this skill when a playable branch is close to done and needs a reliable final gate before packaging, submission, or handoff.

## 1. Core rule

Release readiness is a multi-layer check.

Do not declare a playable done because the scene opens once or because typecheck passes once.

Minimum layers:
- static validation
- scene validation
- manual gameplay validation
- regression validation
- network and packaging validation

## 2. Required reads

Before QA, read:
- `GDD.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `QA_CHECKLIST.md`
- `EXPORT_CHECKLIST.md`
- the latest phase or handoff report

If the project has network-specific notes or a Playbox developer guide, include them.

## 3. Static validation

Run the strongest available static checks.

Typical commands:

```text
node tools/plbx-cocos-typecheck/bin/plbx-cocos-typecheck.mjs
```

Prefer this over a bare `npx tsc --noEmit -p tsconfig.json` when `tools/plbx-cocos-typecheck` is present in the
project: it uses the TypeScript and `cc.d.ts` bundled with the installed Cocos Creator and checks only
`assets/**/*.ts`, instead of `tsconfig.json`'s wider `temp/tsconfig.cocos.json`-inherited file selection (which
tends to surface noisy, irrelevant errors from engine declaration files). Fall back to bare `tsc` only if the
tool isn't available in this project.

Also check for banned patterns in new code:
- `find(`
- `getChildByName(`
- `getComponentInChildren(`
- `getComponentsInChildren(`
- manual `.meta` creation
- new production `console.log`
- new dependencies without approval

If the project cannot typecheck in the current environment, record the exact reason instead of pretending the check passed.

## 4. Scene validation

If a scene or prefab changed:
- inspect the graph before and after edits when possible
- validate the document with Cocos-aware tools
- confirm key nodes and explicit refs still exist
- confirm no missing script or missing property reference errors remain

Focus on first-frame correctness, not only JSON validity.

## 5. Manual gameplay regression matrix

Always test the core playable loop, not just the changed feature.

Common matrix:
- first-frame clarity
- tutorial or first interaction
- main loop input
- score/economy updates
- transitions to payoff or end-card
- CTA visibility and click path
- idle behavior
- tap spam behavior
- reload behavior
- responsive layout or orientation checks

If the project has a feature-specific scenario, use it as the canonical smoke test.

## 6. Network lifecycle checks

When the Playbox adapter exists, confirm these calls are present and behave correctly:
- `plbx.game_ready()` once when the scene is ready
- `plbx.tap()` on meaningful user interaction
- `plbx.download()` on CTA click
- `plbx.game_end()` on terminal state

Also verify:
- store URLs are set
- CTA does not redirect before a user action on networks that forbid it
- there are no duplicate click handlers
- there are no direct network SDK calls bypassing the adapter

## 7. Packaging and export checks

Before export, confirm:
- bundle size is within network limits
- reference-only folders are excluded from production
- only intended fonts, textures, audio, and animations are included
- archive naming and folder structure match campaign requirements
- there are no temporary debug overlays or staging assets left in the build

If packaging output exists, smoke-test the packaged HTML, not only raw Cocos preview.

## 8. Common blocker categories

Treat these as release blockers unless explicitly accepted:
- scene opens with missing scripts or missing refs
- core loop cannot reach CTA
- duplicate CTA redirects
- black screen or boot failure in packaged output
- reference assets leak into production bundle
- lifecycle calls are missing or misplaced

## 9. Reporting contract

```text
STATIC_VALIDATION: pass/fail + details
SCENE_VALIDATION: pass/fail + details
MANUAL_TEST: pass/fail + checked flow
REGRESSION: pass/fail + notes
NETWORK_CHECKS: pass/fail + details
EXPORT_CHECKS: pass/fail + details
OPEN_ISSUES: [none or list]
RELEASE_READY: yes/no
```

## 10. Completion standard

The branch is release-ready only when:
- blockers are resolved or explicitly accepted
- manual editor-only steps are documented
- the packaged playable behavior matches the raw runtime behavior closely enough for target networks
