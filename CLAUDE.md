# Playbox Playable Starter Pack

Набор команд, агентов и скиллов для сборки играбельных рекламных плейблов на **Cocos Creator 3.8.x**
через Claude Code. Цель — воспроизводимая, фазовая, проверяемая сборка плейбла из проектного контракта.

## Как начать новый плейбл

1. Скопируй в корень cocos-проекта: `.playbox/`, `.claude/`, `.mcp.json`.
2. Заполни **контракт проекта** (source of truth) — шаблоны в `.playbox/templates/`:
   - корень: `GDD.md`, `ARCHITECTURE.md`, `AGENTS.md`
   - `.playbox/game-design/`: `IMPLEMENTATION_PHASES.md`, `SCENE_SETUP.md`, `ASSET_SPEC.md`,
     `QA_CHECKLIST.md`, `EXPORT_CHECKLIST.md`, `OPEN_ISSUES.md`
   - Ориентир по уровню детализации — `.playbox/examples/debt-collector.md`.
3. Проверь путь к MCP-серверу в `.mcp.json` (см. ниже) и перезапусти Claude Code, чтобы сервер поднялся.
4. Запусти `/build-playable` (опц. `example=debt-collector` для сверки).

## MCP `plbx-cocos` — обязателен для работы со сценой

Все правки `.scene`/`.prefab` идут **только** через семантические операции сервера `plbx-cocos`.
Ручная правка JSON сцены запрещена: `__id__` — индексы массива, вставка в середину ломает ссылки.

`.mcp.json` в этом паке указывает на локальный путь сервера
(`…/plbx-cocos-mcp/src/index.js`) и `COCOS_PROJECT_ROOT: "."`. **Обнови `args`-путь под свою машину.**
Проверить подключение: `/mcp` в интерактивной сессии — должен быть виден `plbx-cocos` (18 инструментов).

## Пайплайн и владение

`/build-playable` оркестрирует под-агентов по фазам (не смешивая зависимые фазы):

| Фаза | Владелец | Артефакт | Ворота |
|------|----------|----------|--------|
| 1 Контракты+конфиг | `cocos-coder` | Core/Models/events/GameConfig | `tsc --noEmit` |
| 2 Systems | `cocos-coder` | логика, EventBus | компиляция, нет запрещённых API |
| 3 Views | `cocos-coder` | визуал/ввод | нет `find()`, `@property=null` |
| 4 Ассеты | `cocos-asset-maker` | PNG placeholder | файлы+размеры по ASSET_SPEC |
| 5 Префабы | `cocos-scene-builder` | `.prefab` через `build_prefab` | `validate_document` |
| 6 Сцена+wiring | `cocos-scene-builder` | `.scene` через `apply_edits` | граф = плану, валиден |
| 7 QA/release | оркестратор | отчёт | все слои pass |

Разделение строгое: **coder** пишет только `.ts`; **asset-maker** — только PNG; **scene-builder** — только
сцену/префабы через MCP. Никто не залезает в чужую зону.

## Границы (жёсткие правила)
- Не редактировать `.scene`/`.prefab`/`.meta` вручную — только MCP `plbx-cocos`.
- Не создавать `.meta` руками (кроме `build_prefab`, который делает это сам).
- Не использовать `find()`, `getChildByName()`, `getComponentInChildren()` — только явные `@property`.
- Не трогать `/temp`, `/library`, `/profiles`, `/settings`; не менять `package.json`/`tsconfig.json` без нужды.
- EventBus: новые `EVT_*` добавлять **в конец** файла; не переименовывать без плана миграции.
- `.playbox/reference/**` и `.playbox/examples/**` — не бандлить в продакшн.

## Конвенции доков (единые имена)
- Архитектура — всегда `ARCHITECTURE.md` (не `MERGE_ARCHITECTURE.md`).
- Спека ассетов — всегда `.playbox/game-design/ASSET_SPEC.md` (не `ASSETS_GUIDE.md`).
- Дизайн-доки живут в `.playbox/game-design/`; корневые — `GDD.md`, `ARCHITECTURE.md`, `AGENTS.md`.
- Сетевые build/export-гайды (Moloco, AppLovin, Mintegral, …) — тоже в `.playbox/game-design/`, имя
  `SCREAMING_SNAKE_CASE` без пробелов/тире (напр. `MOLOCO_V2_EXPORT_GUIDE.md`, не `Moloco V2.md`); они
  детализируют `EXPORT_CHECKLIST.md` и `ARCHITECTURE.md` §Playbox lifecycle, а не заменяют их.
- Precedence при конфликте: GDD → OPEN_ISSUES → ARCHITECTURE → spec-доки → phase-планы → QA/EXPORT →
  network build-гайды → agent/command.

## Структура набора
```
CLAUDE.md                     ← этот файл
.mcp.json                     ← подключение plbx-cocos
.playbox/
  agent/                      cocos-coder, cocos-asset-maker, cocos-scene-builder
  command/                    build-playable, asset-batch
  skills/                     8 скиллов (архитектура, оркестрация, QA, дебаг, миграции, spine)
  templates/                  шаблоны source-of-truth доков
  examples/                   debt-collector.md — эталон детализации
  game-design/                (создаётся в проекте) OPEN_ISSUES, SCENE_SETUP, ASSET_SPEC, …
```

## Скиллы (когда применяются)
- `cocos-playable-architecture` — любой рантайм-код/wiring: инварианты Model/System/View/EventBus.
- `playable-phase-orchestrator` — крупная задача → строгие фазы с воротами.
- `playable-doc-handoff-orchestrator` — синк source-of-truth доков и handoff.
- `cocos-scene-blueprint-assembly` — сборка сцены из контракта.
- `playable-qa-release-gate` — финальный гейт перед сдачей.
- `playable-regression-debugger` — чёрный экран/сломанный CTA/паковка.
- `template-reference-migration` — старт из донор-проекта без утечки reference-ассетов.
- `cocos-spine-runtime-migration` — импорт Spine под рантайм 3.8.
