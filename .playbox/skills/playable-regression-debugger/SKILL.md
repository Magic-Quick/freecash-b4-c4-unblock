---
name: playable-regression-debugger
description: Diagnose black screens, lifecycle bugs, scene regressions, and packaging failures in Cocos playable projects.
---

# Playable regression debugger

Use this skill when a playable used to work and now shows a black screen, broken CTA, missing scene bindings, incorrect state flow, or packaging-only failures.

## 1. Core rule

Classify the failing layer before editing anything.

Use this order:
1. reproduce the problem
2. capture the first visible failure signal
3. classify the layer
4. inspect the smallest responsible surface
5. fix and revalidate the exact failure path

Do not start by rewriting gameplay code if the bug is actually in packaging or network boot.

## 2. Failure layer classification

Use these buckets:

Scene/serialization:
- missing classes
- broken property refs
- nodes missing or inactive unexpectedly

Runtime/gameplay:
- wrong state transitions
- duplicate subscriptions
- timers, tweens, or update leaks
- CTA never appears or appears twice

Packaging/runtime loader:
- raw Cocos build works, packaged build fails
- asset path resolution changes only after packaging
- script execution context differences break wasm or companion-file lookup

Network/container:
- MRAID or SDK events never arrive
- redirect path fails only in the ad container
- lifecycle beacons missing despite local preview looking fine

## 3. Reproduction protocol

Record these first:
- exact build variant that fails
- whether raw editor preview works
- whether raw `build/web-mobile` works
- whether packaged HTML works locally
- whether the failure only exists in a network preview or container
- first console or network error

The raw-versus-packaged split is especially important for Playbox regressions.

## 4. High-value failure signatures

Examples worth recognizing quickly:
- `/cocos-js/undefined` requests usually point to broken script execution context or companion-file path resolution
- `Cannot read properties of undefined (reading 'default')` in packaged output often indicates loader or module execution issues
- duplicate CTA redirects usually mean duplicate event binding, not a broken store URL
- black screen with a working raw build often points to loader, MRAID boot gate, or packaging issues rather than gameplay logic

## 5. Scene and runtime checklist

Inspect these when the failure is not obviously in packaging:
- `onLoad`, `start`, `update`, `onEnable`, `onDisable`, `onDestroy`
- system start/stop symmetry
- duplicate `GlobalEventBus` subscriptions
- timers and tweens that survive scene state changes
- hidden or inactive nodes assumed to be visible later
- explicit refs that were not rewired after scene changes
- bootstrap order and null-guard behavior

## 6. Packaging and lifecycle checklist

When packaged output fails but raw build works, inspect:
- runtime loader patches and interception behavior
- whether `fetch()` returns a real `Response` when required
- whether cached script execution preserves script-resource semantics
- whether `document.currentScript`-dependent libraries still resolve companion files correctly
- whether `__plbx_pre_boot` or equivalent MRAID defer-boot gating exists in final HTML
- whether `plbx.game_ready()`, `plbx.tap()`, `plbx.download()`, and `plbx.game_end()` are actually wired

## 7. Fix discipline

Prefer the smallest layer-correct fix.

Examples:
- packaging bug: fix loader behavior, not game code
- scene ref bug: rewire the ref, do not add `find()` fallback
- duplicate click: remove the second binding, do not add arbitrary debouncing in gameplay unless justified

## 8. Validation after the fix

Revalidate the exact broken path first.

Then run adjacent checks:
- startup
- core interaction
- transition into CTA or end state
- packaged smoke test if the bug involved packaging
- network preview if the bug involved lifecycle or redirects

Do not stop at "error disappeared". Confirm the playable boots and advances normally.

## 9. Handoff format for regressions

Use a crisp root-cause report.

```text
PROBLEM_SUMMARY: <what broke and where>
REPRO_SIGNALS: [errors, requests, failing steps]
FAILURE_LAYER: [scene/runtime/packaging/network]
ROOT_CAUSE: <direct cause>
FIX_APPLIED: [files and logic changed]
VALIDATION: [what was retested]
RESIDUAL_WARNINGS: [none or list]
UPSTREAM_ACTION: [none or recommendation]
```

## 10. Anti-patterns

Avoid these:
- fixing symptoms in the wrong layer
- assuming editor preview proves packaged output is healthy
- adding runtime search or fallback hacks instead of repairing explicit wiring
- writing vague debug handoffs without the first error and the exact failing variant
