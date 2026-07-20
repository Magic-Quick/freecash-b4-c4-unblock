# IMPLEMENTATION_PHASES — <Название плейбла>

> Точный план фаз для `/build-playable`. Каждая фаза = владелец + файлы + ворота валидации.

## Фаза 1 — Контракты и конфиг · cocos-coder
- Файлы: <TODO: GameEntryPoint, Models/*, event-bus/events.ts (+EVT_*), GameConfig>
- Ворота: `node tools/plbx-cocos-typecheck/bin/plbx-cocos-typecheck.mjs` = 0 ошибок (fallback: `tsc --noEmit`,
  если инструмента нет в проекте).

## Фаза 2 — Systems · cocos-coder
- Файлы: <TODO: Systems/*>
- Ворота: компиляция; корректные подписки/отписки; нет запрещённых API.

## Фаза 3 — Views · cocos-coder
- Файлы: <TODO: Views/*>
- Ворота: компиляция; нет `find()`; `@property` = null; нет `console.log`.

## Фаза 4 — Ассеты · cocos-asset-maker
- Файлы: <TODO: список PNG по ASSET_SPEC.md>
- Ворота: файлы на месте; размеры/alpha/имена/стиль по спеке.

## Фаза 5 — Префабы · cocos-scene-builder
- Файлы: <TODO: *.prefab через build_prefab>
- Ворота: `validate_document` pass; wrapper-правило соблюдено.

## Фаза 6 — Сцена + wiring · cocos-scene-builder
- Правки: <TODO: ноды/иерархия по SCENE_SETUP.md через apply_edits>
- Ворота: `query_scene_graph` = плану; `validate_document` pass; все `@property` привязаны.

## Фаза 7 — QA / release · оркестратор
- Ворота: static + scene + manual (QA_CHECKLIST) + network + export (EXPORT_CHECKLIST) = pass.
