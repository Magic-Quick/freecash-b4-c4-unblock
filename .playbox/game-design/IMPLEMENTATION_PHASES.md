# IMPLEMENTATION_PHASES — «Unblock» (Freecash B4C4)

> Точный план фаз для `/build-playable`. Каждая фаза = владелец + файлы + ворота валидации.
> Зависимые фазы НЕ запускать параллельно. После каждой фазы — handoff-контракт.

## Фаза 0 — Предпосев (оркестратор, разово, вне /build-playable)
- Проверить MCP `plbx-cocos` подключён (`/mcp` → 18 инструментов). ✅ путь в `.mcp.json` верен для этой машины.
- Проверить открытые вопросы в `OPEN_ISSUES.md`; заблокированные значения не мешают старту болванок.
- Создать `assets/data/levels.json` (раскладки L1/L2) — источник данных, редактируемый без пересборки кода.

## Фаза 1 — Контракты и конфиг · `cocos-coder`
- Файлы: `Core/GameEntryPoint.ts`, `Core/Playbox.ts`, `Core/GameConfig.ts`,
  `Models/{GameStateModel,BoardModel,BlockModel}.ts`, `event-bus/{event-bus.ts,events.ts}` (все `EVT_*` из ARCHITECTURE §4),
  enum `GamePhase`.
- `GameConfig` — все `@property` из `AGENTS.md §3` (числа как поля, не литералы в логике).
- **Ворота:** `tsc --noEmit` = 0 ошибок; файлы на месте; события объявлены с интерфейсами.

## Фаза 2 — Systems / логика · `cocos-coder`
- Файлы: `Systems/{GameStateSystem,BoardSystem,DriveSystem,RewardSystem,TutorialSystem,SoundSystem}.ts`.
- `BoardSystem` — движок Unblock: парс `levels.json`, occupancy-grid, сдвиг блока по оси до упора,
  детект коридора главного блока к выходу. Комментировать нетривиальную логику коллизий/пути.
- **Ворота:** компиляция; подписки/отписки на `EVT_*` предсказуемы (unsubscribe в `onDestroy`); нет запрещённых API.

## Фаза 3 — Views · `cocos-coder`
- Файлы: `Views/{BoardView,BlockView,CoinCounterView,TutorialFingerView,MoneyFountainView,CTAView,ExitArrowView,HudView,DisclaimerView}.ts`.
- Ввод (touch→свайп) в `BlockView`; твины слайда/проезда/монет; главный блок выезжает вправо за край (без машинки, концепт-1).
- **Ворота:** компиляция; нет `find()`; все `@property` дефолт `null`; нет production `console.log`.

## Фаза 4 — Ассеты · `cocos-asset-maker`
- Файлы: PNG по `ASSET_SPEC.md` в `assets/art/{sprites,ui}` + импорт `freecash_logo.png` (или placeholder, см. OPEN_ISSUES).
- **Ворота:** файлы на месте; размеры/alpha/имена/стиль по спеке; 9-slice-ассеты пригодны к масштабированию.

## Фаза 5 — Префабы · `cocos-scene-builder`
- Файлы: `assets/prefabs/{Block,Cell,CoinFx}.prefab` через `build_prefab` (wrapper: Root→Visual).
  `Block.prefab` несёт `BlockView` + Sprite (9-slice) + UITransform; спавнится `BoardView` по данным уровня.
- **Ворота:** `validate_document` pass; префабы открываются без ошибок; wrapper-правило соблюдено.

## Фаза 6 — Сцена + wiring · `cocos-scene-builder`
- Правки: иерархия по `SCENE_SETUP.md` через `apply_edits` (сначала `dryRun`); привязка всех `@property`
  (таблица wiring в SCENE_SETUP); адресация по пути/`_id`, не `__id__`; ассеты через `set_asset_ref`.
- **Ворота:** `query_scene_graph` совпадает с планом; `validate_document` pass; нет битых ссылок;
  недоступные ассеты → `@property=null` + запись в OPEN_ISSUES (ручной шаг в редакторе).

## Фаза 7 — QA / release gate · оркестратор (`playable-qa-release-gate`)
- `tsc --noEmit`; скан запрещённых паттернов; scene-валидация; ручной прогон `QA_CHECKLIST.md`;
  проверка Playbox lifecycle (`game_ready/tap/download/game_end`); `EXPORT_CHECKLIST.md`; вес ≤ 5 MB.
- **Ворота:** все слои pass или блокеры явно приняты владельцем.

## Ручные шаги в редакторе Cocos (после сборки)
1. Открыть `assets/scene.scene` — Cocos сгенерирует `.meta` для новых ассетов.
2. Прокинуть SpriteFrame в `@property`, оставшиеся `null` (список из OPEN_ISSUES).
3. Play → пройти smoke-сценарий из `QA_CHECKLIST.md`.
