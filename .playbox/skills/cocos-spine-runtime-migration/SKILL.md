---
name: cocos-spine-runtime-migration
description: Convert Spine assets to Cocos-compatible runtime format and migrate scene bindings safely for Cocos playable projects.
---

# Cocos Spine runtime migration

Use this skill when a Cocos Creator playable must import Spine assets, especially when source files target a newer Spine runtime than the project supports.

## 1. Core rule

Match the project runtime first.

If the project runs Cocos Creator 3.8.x with Spine 3.8 runtime, do not assume Spine 4.x binary assets will work directly.

Common failure signatures:
- `memory access out of bounds`
- `table index is out of bounds`
- `scale is not a valid attribute`
- invisible skeletons after import with no obvious gameplay error

## 2. Preferred conversion pipeline

For incompatible Spine binary sources, use this flow:
1. convert `.skel` to JSON compatible with the project runtime
2. downgrade atlas data if needed
3. place the converted JSON, atlas, and PNG pages in a dedicated asset folder
4. reimport in Cocos so the editor generates fresh `.meta`
5. bind the converted asset set through Inspector or validated scene tools

## 3. Typical conversion commands

Example flow for Cocos 3.8 projects:

```bash
SpineSkeletonDataConverter input.skel output.json -v 3.8.99
SpineAtlasDowngrade input.atlas output_dir
```

If the source uses `.skel.bytes` or `.atlas.txt`, copy them to the expected temporary extensions first instead of mutating originals in place.

## 4. Folder structure

Use explicit converted folders.

Recommended pattern:

```text
assets/art/spine/<character>_38json/
  <character>_38.json
  <character>_38.atlas.txt
  <character>_38.png
```

The suffix matters because it tells future agents that the files were normalized for the project runtime.

## 5. Import and reimport rules

After copying converted files into the project:
- reimport the folder in Cocos
- verify the JSON imported as Spine data
- verify atlas linkage is present
- verify the first atlas line matches the PNG page name exactly

Never create or patch `.meta` manually to fake a successful import.

## 6. Scene binding pattern

Do not place `sp.Skeleton` on a node that already owns `cc.Sprite`.

Preferred hierarchy:

```text
CharacterRoot
  CharacterSprite   # optional legacy/static sprite
  SkeletonView      # sp.Skeleton lives here
```

Then bind gameplay or view refs explicitly to the `sp.Skeleton` on `SkeletonView`.

## 7. Dual-path migration strategy

When replacing an older visual system, migrate in stages:
1. keep the old visual path available as a fallback
2. validate one converted character end to end
3. expand to the remaining characters
4. measure runtime, bundle size, and scene stability
5. remove the old path only after validation

Do not perform a big-bang replacement for all characters unless the project explicitly allows the risk.

## 8. Validation checklist

Check these after import:
- skeleton renders in editor preview
- expected animation names are visible in Inspector
- scene refs point to the converted asset, not the old one
- no sprite/skeleton component conflicts exist on the same node
- gameplay and layout still behave correctly with the new visual child

## 9. Common traps

Avoid these:
- converting the skeleton but forgetting atlas downgrade
- leaving the atlas first line pointing to the old PNG name
- mixing converted JSON with unconverted atlas data
- attaching `sp.Skeleton` to legacy sprite nodes directly
- deleting the old frame-sequence or sprite fallback before the new path is verified

## 10. Reporting contract

```text
SOURCE_ASSETS: [original Spine files]
CONVERTED_ASSETS: [new JSON/atlas/png files]
RUNTIME_TARGET: [for example Spine 3.8.99]
SCENE_BINDINGS_UPDATED: [nodes or prefabs]
VALIDATION: [import/preview/runtime result]
MANUAL_EDITOR_STEPS: [none or list]
OPEN_ISSUES: [none or list]
```
