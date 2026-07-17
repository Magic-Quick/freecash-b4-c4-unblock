---
name: cocos-playable-architecture
description: Apply the standard Cocos playable architecture: EventBus, System and View separation, Bootstrap wiring, and serialization safety.
---

# Cocos playable architecture

Use this skill for any Cocos Creator playable feature that adds runtime code, scene bindings, or cross-system behavior.

## 1. Core invariants

Use the same architectural contract everywhere unless the project explicitly defines a different one.

Required baseline:
- `Model` stores state and plain data
- `System` owns rules and orchestration
- `View` is a `Component` responsible for visuals, input, and node-level behavior
- `Bootstrap` or entry point owns composition and explicit wiring
- `GlobalEventBus` is the only cross-system communication path

## 2. System vs View split

System:
- plain TypeScript class when possible
- no scene-tree discovery
- no direct asset import hacks
- subscribes/unsubscribes predictably

View:
- extends `Component`
- owns sprites, labels, tweens, animation playback, and UI feedback
- exposes explicit methods such as `showResult()`, `setFireLevel()`, `playHintBounce()`

Keep gameplay rules out of the view and visual timing curves out of the state machine.

## 3. Bootstrap rules

Bootstrap or entry point should:
- create systems in a clear order
- pass explicit dependencies into constructors
- wire known node/component refs through `@property`
- own lifecycle hooks such as `onLoad`, `start`, `update`, and `onDestroy`

Preferred order:
1. read config
2. resolve explicit scene refs
3. construct systems
4. bind input/listeners
5. call `plbx.game_ready()` when the scene is actually ready

## 4. EventBus contract

Use one EventBus as the cross-system spine.

Rules:
- add new events at the end of the events file
- do not rename existing events without a migration plan
- do not use duplicate channels for the same intent
- normalize user intent events before counting analytics or hint progress
- unsubscribe in `stop()` or `onDestroy()`

If one user action can emit several low-level events, create a normalized event instead of overcounting.

## 5. Explicit reference rule

Gameplay code should never depend on runtime scene search.

Avoid:
- `find()`
- `getChildByName()`
- `getComponentInChildren()`
- `getComponentsInChildren()`

Allowed:
- `node.getComponent(X)` on an already explicit node
- touch-target resolution on a node received from an input event

## 6. Scene and prefab serialization safety

Do not treat Cocos serialized files like generic JSON blobs.

Rules:
- never create `.meta` manually
- never serialize custom script refs as ad hoc string `__type__` values
- prefer editor workflow or validated `cocos_*` tools for `.scene` and `.prefab`
- inspect before and validate after scene-side changes

If the project uses collapsed prefab instances, respect instance overrides instead of rewriting source prefabs blindly.

## 7. Asset and package boundaries

Keep boundaries strict.

Do not:
- edit `/temp`, `/library`, `/profiles`, `/settings`
- add npm dependencies without explicit need
- change `package.json` or `tsconfig.json` casually
- leave production `console.log` noise
- leave commented dead code as a state-management substitute

## 8. Naming and style rules

Preferred defaults:
- file names in kebab-case unless project conventions say otherwise
- Cocos classes via `@ccclass('ClassName')`
- `@property` refs default to `null`
- describe data with interfaces instead of `any`

Group Cocos imports together and keep new modules easy to scan.

## 9. Playable lifecycle integration

When the Playbox adapter is present, wire these responsibilities explicitly:
- `plbx.game_ready()` once when the scene is ready
- `plbx.tap()` in the central input path
- `plbx.download()` on CTA click
- `plbx.game_end()` when gameplay reaches the terminal state

Do not call network-specific SDK methods directly when the adapter exists.

## 10. Acceptance checklist

Before calling the work architecturally correct, confirm:
- no forbidden scene-tree search was introduced
- EventBus additions are appended, not scattered
- systems can be started and stopped cleanly
- explicit refs exist for all cross-layer dependencies
- scene/prefab edits did not require manual `.meta`
- lifecycle hooks are wired exactly once

## 11. Reporting contract

```text
ARCH_RULES_APPLIED: [list]
EVENTS_ADDED: [list or none]
EXPLICIT_REFS_REQUIRED: [list]
FORBIDDEN_APIS_AVOIDED: yes/no
SCENE_SERIALIZATION_RISK: none or description
OPEN_ISSUES: [none or list]
```
