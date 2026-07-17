---
name: cocos-scene-blueprint-assembly
description: Build or rebuild Cocos playable scenes from a blueprint contract, explicit wiring rules, and editor-safe scene workflows.
---

# Cocos scene blueprint assembly

Use this skill when a playable scene should be assembled from GDD, reference art, prefab strategy, and explicit node contracts instead of ad hoc manual layout.

## 1. Core rule

Scene-first is valid only when it is contract-first.

Do not start with a pixel-perfect mockup and hope gameplay code adapts later.

Preferred order:
1. define the scene contract
2. define anchors, layers, targets, and placeholders
3. assemble the hierarchy
4. wire explicit refs
5. validate the scene

## 2. Required inputs

Before touching the scene, read:
- `GDD.md`
- `ARCHITECTURE.md`
- `AGENTS.md`
- `SCENE_SETUP.md`
- `ASSET_SPEC.md` if assets are involved
- `PREFAB_STRATEGY.md` and `ANIMATION_STRATEGY.md` if prefabs or clips are involved
- any visual reference audit or target screenshot notes

## 3. Blueprint before scene edits

Prefer a scene blueprint or equivalent contract file before making large scene edits.

Minimum contract shape:

```json
{
  "canvas": { "width": 720, "height": 1280 },
  "layers": ["BackgroundLayer", "GameplayLayer", "HudLayer", "TutorialLayer", "ResultLayer"],
  "interactive": ["SpinButton", "PlayNowButton"],
  "anchors": ["CoinFxRoot", "PackshotRoot"],
  "nodes": []
}
```

The important part is not the exact schema. The important part is that layout, anchors, and targets are documented before runtime code depends on them.

## 4. Keep layout in scene data, not gameplay code

Rules:
- coordinates belong in the scene or blueprint/config
- state machines should call view methods, not hardcoded positions
- gameplay logic should not depend on node names as a lookup mechanism
- explicit refs beat name lookup every time

## 5. Recommended layer patterns

Most playable scenes benefit from stable top-level layers like:

```text
Canvas
  BackgroundLayer
  GameplayLayer
  HudLayer
  TutorialLayer
  ResultLayer
System
```

Add domain-specific roots as needed:
- `FxLayer`
- `DragOverlayRoot`
- `CoinFxRoot`
- `PackshotRoot`
- `EndCardLayer`

## 6. Placeholder policy

Use placeholders deliberately when imported asset UUIDs are not ready.

Allowed placeholders:
- empty nodes for future VFX or animation anchors
- labels or dummy sprites for flow validation
- `null` SpriteFrame or clip refs when the manual Cocos import step is still pending

Not allowed:
- fake UUIDs
- manual `.meta`
- ambiguous node names like `Node` or `Temp2`

## 7. Scene editing workflow

Use Cocos-aware tooling.

Preferred workflow:
1. inspect current scene graph
2. inspect precise nodes to be touched
3. prepare changes against the contract
4. dry-run scene edits if the tool supports it
5. apply edits
6. validate the scene document
7. re-query the graph and compare it to the intended hierarchy

Never mass-edit `.scene` files as raw text when a Cocos-specific tool exists.

## 8. Explicit wiring rules

Scene assembly is not finished when the hierarchy merely looks right.

Finish it by making sure:
- all important gameplay roots exist
- all `@property` node refs are wired explicitly
- interactive targets are named and distinct
- player-only and bot-only or left/right zones are clearly separated when relevant
- legacy bootstrap nodes are preserved until migration is complete

## 9. Visual QA against references

After scene assembly, compare the result against the visual target.

Check:
- first-frame readability
- safe-area placement
- background fill
- interaction reachability
- whether HUD overlaps gameplay
- whether payoff/CTA layers appear in the intended visual order

If the scene is visually wrong, change the blueprint/layout first, not gameplay code.

## 10. Common traps

Avoid these:
- rebuilding the hierarchy but forgetting explicit refs
- encoding layout fixes in systems instead of the scene
- deleting legacy nodes before their replacements are validated
- shipping reference-only files inside runtime folders
- making a beautiful layout with no animation anchors or no room for tutorial overlays

## 11. Reporting contract

```text
SCENE_CONTRACT_USED: [docs or blueprint files]
SCENE_UPDATED: [nodes created or changed]
REFERENCES_WIRED: [list]
PLACEHOLDERS_LEFT: [none or list]
VALIDATION: [query/inspect/validate result]
MANUAL_EDITOR_STEPS: [none or list]
OPEN_ISSUES: [none or list]
```
