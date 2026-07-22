# IMPLEMENTATION_PHASES — «Unblock» (Freecash B4C4)

> Рабочий план реализации. Каждая фаза заканчивается проверяемым результатом и handoff-контрактом.
> Зависимые фазы не выполнять параллельно. Приоритет требований: `GDD.md` → `OPEN_ISSUES.md`
> → `ARCHITECTURE.md` → тематические спеки → этот план.

## Как использовать план

- Статус фазы ведёт оркестратор: `not started` → `in progress` → `ready for review` → `accepted`.
- В работу берётся только одна зависимая фаза. Параллельно допустимы только независимые дорожки,
  явно отмеченные ниже.
- В конце фазы исполнитель передаёт: изменённые файлы, результаты гейтов, известные ограничения
  и точные действия для следующей фазы.
- Новое решение, меняющее flow, данные, сцены или публичные контракты, сначала фиксируется
  в соответствующем документе. Не компенсировать неясность хардкодом.
- Вопросы, не блокирующие болванку, остаются в `OPEN_ISSUES.md`; блокеры финального билда не
  считаются закрытыми без подтверждения владельца.

## Карта зависимостей

```text
Фаза 0: baseline + данные уровней
          |
          +--> Фаза 1: контракты рантайма --> Фаза 2: puzzle systems --> Фаза 3: views
          |                                                              |
Параллельная дорожка A: placeholder-арт -------------------------------> Фаза 4: prefabs
                                                                         |
                                                                         v
                                                              Фаза 5: сцена + wiring
                                                                         |
                                                                         v
                                                              Фаза 6: интеграция + адаптив
                                                                         |
                                                                         v
                                                              Фаза 7: QA + релиз
```

## Фаза 0 — Baseline и контракт данных

- **Владелец:** оркестратор / `cocos-coder`
- **Статус:** ready for review
- **Цель:** зафиксировать техническую базу и подготовить два валидных уровня до реализации механики.

### Входы

- `GDD.md`, `AGENTS.md`, `ARCHITECTURE.md`.
- `OPEN_ISSUES.md`: использовать текущие допущения, не ожидая финальных ассетов и SDK.
- Чистый Cocos Creator проект на версии 3.8.8, основная сцена `assets/scene.scene`.

### Работы

1. Проверить конфигурацию проекта: Cocos Creator 3.8.8, дизайн-разрешение 720×1280, portrait как основной режим.
2. Подтвердить, что `assets/scene.scene` является единственной рабочей сценой, а пути соответствуют контракту:
   `assets/scripts`, `assets/data`, `assets/prefabs`, `assets/art`.
3. Создать `assets/data/levels.json` как единственный источник раскладок L1 и L2.
4. Описать в данных для каждого блока: стабильный `id`, стартовую ячейку, длину, ось, признак главного блока.
   Формат должен позволять добавить уровень без изменения `BoardSystem`.
5. Вручную или детерминированным solver-проходом проверить уровни: границы 6×6, отсутствие пересечений,
   один главный горизонтальный блок, реальный путь к правому выходу и целевая драматургия L1 проще L2.
6. Зафиксировать прототипные значения: L1 = 9 FC, L2 = 10 FC, всего = 19 FC. Любое изменение вносить
   одновременно в `GameConfig`, уровневые данные (если применимо), QA и `OPEN_ISSUES.md`.
7. Согласовать порядок завершения уровня так, чтобы награда и FX L1 визуально завершались до появления L2,
   затем обновить `ARCHITECTURE.md` при необходимости. Не начинать фазу 1 с противоречивым event flow.

### Результат

- `assets/data/levels.json` с двумя решаемыми раскладками (готово).
- Короткая запись в `OPEN_ISSUES.md` только о неразрешённых внешних решениях (готово — см. заметки ниже).
- Согласованный порядок transition/reward для систем фаз 1–2 и обновлённый архитектурный контракт (готово —
  новое событие `EVT_REWARD_SEQUENCE_DONE`, см. `ARCHITECTURE.md` §2/§4 и `AGENTS.md` §5).

### Заметки по проверке (п.1–2 «Работы»)

- Engine подтверждён через `get_project_info` MCP: Cocos Creator **3.8.8**, модуль 2D — совпадает с `AGENTS.md` §1.
- `assets/scene.scene` **пока не существует** (`list_assets({type:"scene"})` → 0), design-резолюция 720×1280 нигде
  не сконфигурирована (`settings/v2` не содержит записи) — проект действительно чистый. Это ожидаемо: сцена и
  Canvas/design-resolution — зона `cocos-scene-builder` (Фаза 5–6, `SCENE_SETUP.md`), не блокирует данные Фазы 0.
  Не помечаю как «подтверждено», честно фиксирую как «настроить в Фазе 5–6».
- `assets/scripts`, `assets/prefabs` тоже ещё не созданы — появятся в Фазах 1 и 4 соответственно; на момент
  Фазы 0 в проекте есть только `assets/art/` (Фаза 4 уже выполнена) и теперь `assets/data/levels.json`.

### Гейт готовности

- [x] Данные не содержат выходов за поле, наложений и невалидных осей — проверено скриптом (bounds/overlap
      check по обоим уровням, см. handoff).
- [x] Оба уровня можно решить исключительно допустимыми свайпами — проверено скриптом: каждый блок,
      перекрывающий `exitRow`, имеет свободный слайд (вверх или вниз) в текущей раскладке; блоки друг от
      друга независимы (нет цепочек зависимостей), т.е. порядок свайпов не важен.
- [x] Главный блок после решения имеет свободный коридор вправо — путь `exitRow` cols `mainEndCol+1..5`
      целиком высвобождается после того как каждый блокирующий блок сдвинут.
- [x] Награды дают последовательность `0 → 9 → 19` — `levels.json` reward=9 (L1) / reward=10 (L2), совпадает
      с `GameConfig.level1Reward`/`level2Reward`.
- [x] Порядок награды и старта следующего уровня не противоречит `ARCHITECTURE.md` — синхронизировано:
      `GameStateSystem` теперь слушает `EVT_REWARD_SEQUENCE_DONE`, а не сырой `EVT_LEVEL_SOLVED`.
- [x] Открытые вопросы #1–#3 (и новые #8–#9) не блокируют прототип и отмечены как внешние зависимости —
      см. `OPEN_ISSUES.md`.

### Handoff

`assets/data/levels.json` (схема: `{level, reward, exitRow, exitSide, blocks:[{id, axis, length, col, row,
isMain}]}`; `col`/`row` — 0-индексная верхняя-левая ячейка блока, `row 0` = верх поля). Раскладки: L1 — 4 блока
(1 главный + 3 блокирующих `exitRow`, все со свободным ходом), L2 — 6 блоков (1 главный + 4 блокирующих,
включая один длиной 3, + 1 декоративный вне `exitRow` для «больше блоков»). Проверка bounds/overlap/clear-path
прогонялась Python-скриптом по данным `levels.json` напрямую (не хранится в репозитории — разовая проверка).

Принятое правило перехода: `RewardSystem` публикует `EVT_COINS_CHANGED` сразу на `EVT_LEVEL_SOLVED` (fly-in
монет стартует), затем через `GameConfig.coinFlyDuration` — `EVT_REWARD_SEQUENCE_DONE{level, isFinal}`.
`GameStateSystem` стартует L2 / запрашивает CTA только по этому событию, не по `EVT_LEVEL_SOLVED` напрямую —
это и есть гарантия, что FX L1 не обрывается стартом L2. Дальше в Фазу 1.

## Фаза 1 — Контракты рантайма и конфигурация

- **Владелец:** `cocos-coder`
- **Статус:** ready for review
- **Зависит от:** фазы 0
- **Цель:** создать стабильные типизированные границы между данными, системами, views и Playbox SDK.

### Работы

1. Создать `Core/GameConfig.ts` со всеми serializable `@property` из `AGENTS.md` §3. Логика не содержит
   дублирующих числовых литералов для размеров, таймингов, наград и порога свайпа.
2. Создать plain-модели `GameStateModel`, `BoardModel`, `BlockModel` и `GamePhase`:
   `INTRO`, `LEVEL_PLAY`, `LEVEL_DRIVE`, `LEVEL_CLEAR`, `CTA`.
3. Реализовать `event-bus/event-bus.ts` и добавить в конец `event-bus/events.ts` все `EVT_*` и payload-интерфейсы
   из `ARCHITECTURE.md` §4. События становятся публичным контрактом, а не деталью конкретного View.
4. Создать `Core/Playbox.ts`: безопасная обёртка над глобальным `plbx` с no-op в редакторе.
   Вызовы `game_ready`, `tap`, `download`, `game_end` должны быть локализованы в одном адаптере.
5. Создать `Core/GameEntryPoint.ts`: явное wiring систем, единый startup и защита от повторной инициализации.
6. Зафиксировать ownership фаз: ввод разрешён только в `LEVEL_PLAY`; запущенный drive, награда и CTA
   могут отработать лишь один раз для уровня/сессии.

### Результат

- `assets/scripts/Core/{GameEntryPoint,GameConfig,Playbox}.ts` (готово).
- `assets/scripts/Models/{GameStateModel,BoardModel,BlockModel,GamePhase}.ts` (готово).
- `assets/scripts/event-bus/{event-bus,events}.ts` (готово, все 17 `EVT_*` включая `EVT_REWARD_SEQUENCE_DONE`).

### Гейт готовности

- [x] `plbx-cocos-typecheck` завершается без ошибок — `9 selected, 0 excluded`, `0 errors, 0 warnings`
      (Creator 3.8.8 / TS 4.9.5 бандл).
- [x] В `GameConfig` есть все поля из `AGENTS.md` §3, включая `levelsData: JsonAsset`.
- [x] Каждый event из архитектуры имеет типизированный payload и единственного либо явно перечисленного publisher.
- [x] `Playbox` не бросает ошибок при отсутствии `plbx` в Cocos Editor — каждый метод проверяет
      `typeof window.plbx !== 'undefined'` перед делегированием, безопасные фолбэки (`is_muted()→false`,
      `is_audio()→true`).
- [x] Точки `game_ready`, первого `tap`, `download` и `game_end` определены однозначно (см. `GameEntryPoint`/
      `Playbox`), реальные вызовы из Views/Systems — предмет фаз 2–3.
- [x] Нет `find()`, `getChildByName()`, `getComponentInChildren()`, `getComponentsInChildren()` и production
      `console.log` — проверено `grep` по `assets/scripts/**`.

### Заметка по scope

`GameEntryPoint`'s `@property` поля для систем (`gameStateSystem`, `boardSystem`, `driveSystem`,
`rewardSystem`, `tutorialSystem`, `ctaView`) типизированы как `Node` — System/View-классы ещё не существуют
(Фазы 2–3). Пути имён узлов уже совпадают с `SCENE_SETUP.md`, так что `cocos-scene-builder` сможет привязать
их без реструктуризации позже; типы уточнятся сами собой, когда Фазы 2–3 создадут классы.

### Handoff

Передать публичные API моделей, payload всех событий, значения `GameConfig` и правила single-fire для фаз 2–3.

## Фаза 2 — Системы и правила пазла

- **Владелец:** `cocos-coder`
- **Статус:** ready for review
- **Зависит от:** фазы 1
- **Цель:** реализовать data-driven механику без зависимости от конкретной сцены и спрайтов.

### Работы

1. Создать `Systems/BoardSystem.ts`. При `EVT_LEVEL_STARTED` загрузить уровень, построить occupancy grid
   и `BoardModel` из `levels.json`.
2. Обработать `EVT_SWIPE`: проверить направление относительно оси, вычислить самую дальнюю свободную ячейку,
   обновить модель атомарно и отправить `EVT_BLOCK_MOVED`; при нулевом смещении — `EVT_BLOCK_BLOCKED`.
3. После каждого успешного хода проверять свободный горизонтальный коридор главного блока до правого выхода;
   публиковать `EVT_MAIN_PATH_CLEAR` либо `EVT_MAIN_BLOCKED` без повторов одного и того же перехода.
4. Создать `GameStateSystem`, `DriveSystem`, `RewardSystem`, `TutorialSystem`, `SoundSystem` согласно
   таблице `ARCHITECTURE.md` §2.
5. В `DriveSystem` заблокировать дальнейший ввод при старте drive и дождаться визуального `EVT_MAIN_REACHED_EXIT`
   до `EVT_LEVEL_SOLVED`.
6. В `RewardSystem` начислять награду строго один раз на уровень. `isFinal` должен быть `true` только при L2.
7. В `GameStateSystem` переключать L1 на L2 только после завершения наградного flow; после L2 переходить в CTA.
8. Во всех Cocos Components очистить подписки EventBus в `onDestroy`. Нетривиальную логику коллизий и проверки
   коридора снабдить краткими комментариями на русском или английском.

### Результат

- `assets/scripts/Systems/{GameStateSystem,BoardSystem,DriveSystem,RewardSystem,TutorialSystem,SoundSystem}.ts` (готово).
- Логический flow: `INTRO → LEVEL_PLAY → LEVEL_DRIVE → LEVEL_CLEAR → LEVEL_PLAY/CTA`.

### Гейт готовности

- [x] Горизонтальные блоки не двигаются вертикально, вертикальные — горизонтально — `BoardSystem.onSwipe`
      отклоняет свайп при несовпадении оси блока и направления.
- [x] Блок не проходит сквозь границы или другие блоки; вычисление не меняет модель при нулевом ходе —
      `computeMaxShift` только читает grid, `onSwipe` мутирует модель лишь при `shift > 0`.
- [x] `EVT_MAIN_PATH_CLEAR`, drive, reward и CTA не дублируются при быстрых повторных свайпах —
      `BoardSystem.lastMainClear` дедуп на публикацию + `GameStateModel.tryStartDrive/tryGrantReward/tryRequestCta`
      single-fire guards, используемые `DriveSystem`/`RewardSystem`/`GameStateSystem`.
- [x] Источник L1/L2 — только `levels.json`; в системе нет захардкоженных координат раскладки — проверено
      `grep` по `assets/scripts/Systems/**`, координаты нигде не встречаются литералами.
- [x] Награды последовательны: `0 → 9 → 19` — `RewardSystem` читает `level1Reward`/`level2Reward` из
      `GameConfig`, `GameStateModel.addCoins` аккумулирует.
- [x] Подписки систем снимаются при уничтожении компонента — все 6 систем кэшируют `bind(this)` в приватное
      поле и используют ОДНУ и ту же ссылку для `subscribe`/`unsubscribe` (проверено построчно во всех файлах —
      именно здесь чаще всего ломается `unsubscribe`, т.к. инлайновый `.bind()` создаёт новую ссылку каждый раз).
- [x] `plbx-cocos-typecheck` = 0 ошибок — `15 selected, 0 excluded`, `0 errors, 0 warnings`.

### Заметка по scope и правке архитектуры

`EVT_MAIN_REACHED_EXIT` в `ARCHITECTURE.md` §2/§4 был ошибочно указан как публикуемый `DriveSystem`
(документная нестыковка, обнаруженная при ревью реализации) — по факту это визуальное событие, которое
опубликует `BlockView` (Фаза 3) по завершении твина `driveToExit()`; `DriveSystem` его только слушает и публикует `EVT_LEVEL_SOLVED` в ответ. Исправлено в `ARCHITECTURE.md` (публикатор `EVT_MAIN_REACHED_EXIT` →
`BlockView`, `DriveSystem` добавлен в подписчики). Cross-system доступ к `GameStateModel` (нужен
`BoardSystem`/`DriveSystem`/`RewardSystem`/`GameStateSystem`) сделан через статический аксессор
`GameStateSystem.model`, а не `@property`-ссылки между системами — `ARCHITECTURE.md` §5 перечисляет только ссылки System→View, не System→System.

### Handoff

Передать список событий, которые views должны слушать, и минимальные публичные методы для запуска слайда, автопроезда, tutorial и наградных эффектов.

## Параллельная дорожка A — Placeholder-арт

- **Владелец:** `cocos-asset-maker`
- **Статус:** ready for review
- **Можно выполнять:** после фазы 0, параллельно с фазами 1–2
- **Цель:** обеспечить функциональную сборку лёгкими заменяемыми ассетами в утверждённом стиле concept-1.

### Работы

1. Подготовить PNG в `assets/art/{sprites,ui}` строго по именам, размерам и 9-slice границам из `ASSET_SPEC.md` (готово).
2. Использовать классический деревянный стиль: единый оранжевый блок-препятствие и красный главный блок, который выезжает как блок, а не машина (готово).
3. До получения лого использовать только нейтральный текстовый placeholder `FREE CASH` и не выдавать его за клиентский знак (лого не генерировалось вообще — см. `OPEN_ISSUES.md` #2).
4. Проверить RGBA, прозрачность, 9-slice масштабирование и итоговый вес. Не создавать `.meta` вручную (готово, кроме 9-slice масштабирования — см. гейт).

### Гейт готовности

- [x] Все пути и размеры совпадают с `ASSET_SPEC.md` — проверено по пикселям всех 13 файлов
      (`sips`/`get_asset_info`): `block_tile`/`block_main`/`cell`/`exit_arrow` 96×96, `board_frame` 512×512,
      `background` 720×1280, `spark` 128×128, `coin_fc` 80×80, `panel` 320×200, `button_play` 320×96,
      `finger` 80×120, `star_on`/`star_off` 48×48 — все совпадают.
- [ ] Растягиваемые элементы сохраняют углы и читаемую рамку — **не выполнено**: `.meta` всех 9-slice
      ассетов (`panel`, `board_frame`, `button_play`, `block_tile`, `block_main`) до сих пор имеют
      `borderTop/Bottom/Left/Right = 0` (перепроверено только что). Границы нужно выставить вручную в
      Sprite Editor (значения — `ASSET_SPEC.md`: panel 40, board_frame 48, button_play 32, blocks 24);
      отслеживается в `OPEN_ISSUES.md`. До этого `_type=SLICED` в сцене визуально ведёт себя как обычный stretch.
- [x] На монете есть только `FC`; нет `$`, купюр, карт и cash-out формулировок — визуально подтверждено
      (`coin_fc.png` открыт и просмотрен), только буквы «FC» формой, без `$`.
- [x] Суммарный вес ассетов оставляет запас в лимите финального билда 5 MB — фактический вес 192 KB
      (`du -sh assets/art`), запас огромный.
- [x] `OPEN_ISSUES.md` содержит напоминание о замене placeholder logo/арта перед релизом — пункты #1
      (финальная нарезка) и #2 (клиентский логотип).

### Handoff

Все 13 путей готовы и импортированы (UUID подтверждены через `list_assets`): `assets/art/sprites/
{block_tile,block_main,cell,board_frame,background,exit_arrow,spark}.png`, `assets/art/ui/
{coin_fc,panel,button_play,finger,star_on,star_off}.png`. `freecash_logo.png` НЕ создавался (внешняя
зависимость, `OPEN_ISSUES.md` #2). Единственный незакрытый пункт — 9-slice границы, ждут ручной настройки
в редакторе перед тем как `_type=SLICED` начнёт визуально работать (не блокирует Фазу 3, но должно быть
закрыто до Фазы 6 QA-прогона адаптива).

## Фаза 3 — Views, ввод и игровой feedback

- **Владелец:** `cocos-coder`
- **Статус:** ready for review
- **Зависит от:** фаз 1–2; placeholder-арт желателен, но не блокирует реализацию
- **Цель:** соединить event-driven логику с управлением, анимациями и UI без дублирования правил BoardSystem.

### Работы

1. Реализовать `BoardView`: построение и очистку уровня, maps `blockId → BlockView`, позиционирование из
   координат сетки и реакцию на события BoardSystem.
2. Реализовать `BlockView`: touch start/end, порог `swipeMinDistance`, нормализацию в cardinal direction,
   единственный `EVT_TAP` на первый пользовательский touch и `EVT_SWIPE`. View не решает коллизии.
3. Реализовать slide, blocked feedback и `driveToExit()` с длительностями из `GameConfig`. Твины должны
   завершаться либо отменяться безопасно при смене уровня.
4. Реализовать `CoinCounterView`, `MoneyFountainView`, `TutorialFingerView`, `ExitArrowView`, `HudView`,
   `DisclaimerView`, `CTAView` по публичным методам из `ARCHITECTURE.md` §3.
5. Спрятать tutorial после первого успешного `EVT_BLOCK_MOVED`; CTA показывать только на `EVT_REQUEST_CTA`.
6. Создать либо зарезервировать компонент layout-адаптера: portrait — основная композиция, landscape —
   HUD по сторонам, поле и CTA остаются в safe area.
7. Все сериализованные `@property` инициализировать `null`; падение отсутствующей ссылки заменять предсказуемым
   no-op/warn, но не скрывать обязательную ошибку wiring на QA.

### Результат

- `assets/scripts/Views/{BoardView,BlockView,CoinCounterView,TutorialFingerView,MoneyFountainView,CTAView,ExitArrowView,HudView,DisclaimerView}.ts` (готово).
- `Views/InputRouter.ts` — глобальный дебаунснутый tap-счётчик (`EVT_TAP` + `Playbox.tap()`), не входил в
  исходный список файлов результата, но требовался контрактом `EVT_TAP`/`PLBX_LIFECYCLE_GUIDE.md`.
- `Views/LayoutAdapter.ts` — зарезервирован (детекция ориентации + no-op branch на landscape, см. заметку).

### Гейт готовности

- [x] Свайп преобразуется только в событие, а правила движения принадлежат `BoardSystem` — `BlockView`
      публикует только `EVT_SWIPE`, никогда не двигает себя по собственному решению.
- [x] Визуальная позиция блока синхронизируется с `EVT_BLOCK_MOVED`; нулевой ход не перемещает View —
      `EVT_BLOCK_BLOCKED` вызывает только `playBlocked()` (шейк на месте), не `slideTo`.
- [x] Drive отключает пользовательский ввод (существующий `GameStateModel.canAcceptInput`/фаза, не менялся)
      и не оставляет активных tween после смены уровня — **найден и исправлен реальный баг** при ревью:
      `BoardView.clearLevel()` использовал `removeAllChildren()`, который в Cocos только отсоединяет ноду
      от родителя и НЕ вызывает `destroy()`/`onDestroy()` — активные твины и touch-листенеры `BlockView`
      продолжали бы жить на осиротевших нодах при каждом переходе между уровнями. Заменено на явный
      `child.destroy()` по каждому ребёнку.
- [x] Палец скрывается после первого успешного хода; CTA появляется только после L2 — `TutorialSystem`
      (Фаза 2) публикует `EVT_TUTORIAL_HIDE` на `EVT_BLOCK_MOVED`; `CTAView` реагирует только на
      `EVT_REQUEST_CTA` (публикуется только после `isFinal` из `EVT_REWARD_SEQUENCE_DONE`).
- [x] Дисклеймер поддерживается как постоянный UI-элемент, не зависящий от фазы — `DisclaimerView` не имеет
      подписок на EventBus вообще, текст выставляется один раз в `start()`.
- [x] `@property` имеют default `null`; запрещённых API и production `console.log` нет — проверено
      построчно по каждому файлу (не только `grep` агента) и повторным прогоном самостоятельно.
- [x] `plbx-cocos-typecheck` = 0 ошибок — `26 selected, 0 excluded`, `0 errors, 0 warnings` (перепроверено
      после фикса `clearLevel()`).

### Заметки по реализации

- `plbx.tap()`/`EVT_TAP` фирит на КАЖДЫЙ дебаунснутый тап за сессию (не единожды) — критично для
  Moloco-порогов `taps_for_engagement`/`taps_for_redirection` (кумулятивный счёт), реализовано в
  `InputRouter` отдельно от `BlockView`'s свайп-детекции.
- `Playbox.game_end()` вызывается ровно в `CTAView.show()` (момент показа CTA), не в обработчике клика
  кнопки — клик вызывает только `Playbox.download()`. Частый источник провала валидатора Moloco, если
  перепутать complete beacon с click beacon (см. `PLBX_LIFECYCLE_GUIDE.md`).
- `driveToExit()` на главном блоке вызывает `BoardView` (держит `mainBlockView` из `isMain` при спавне),
  не сам `BlockView` через самоподписку — без `find()`/`getComponentInChildren()`.
- Все Views делят одну систему координат ("шаг сетки" `cellSize+cellSpacing`, `(col+0.5)*pitch` от
  верхнего левого угла контейнера) — проверено на совпадение между `BoardView` (ячейки), `BlockView`
  (блоки с учётом `axisCenterOffset` для блоков длиннее 1 ячейки) и `TutorialFingerView` (позиции подсказки).
- `LayoutAdapter` — зарезервирован намеренно неполным: landscape-раскладка не реализована до подтверждения
  `OPEN_ISSUES.md` #7 (каким сетям она реально нужна); сейчас только определяет ориентацию и no-op на landscape.

### Handoff

Передать prefabs/scene-builder список компонентов, обязательных `@property`, ожидаемые ноды и asset refs.
Ключевое для Фазы 4/5: `BoardView`/`MoneyFountainView` ждут `Cell.prefab`/`Block.prefab`/`CoinFx.prefab`
(сейчас `null`-safe — просто ничего не спавнят без них); `InputRouter`/`LayoutAdapter` — новые ноды,
не описанные в текущей `SCENE_SETUP.md`, нужно добавить в целевую иерархию перед Фазой 5/6 wiring.

## Фаза 4 — Префабы

- **Владелец:** `cocos-scene-builder`
- **Статус:** ready for review
- **Зависит от:** фазы 3 и готовых placeholder-ассетов
- **Цель:** собрать повторно используемые элементы, совместимые с data-driven спавном `BoardView`.

### Работы

1. Через Cocos MCP создать `assets/prefabs/{Block,Cell,CoinFx}.prefab`; соблюдать wrapper-конвенцию
   `Root → Visual`, оставляя логику и коллайдеры на root (готово).
2. В `Block.prefab` настроить `BlockView`, UITransform и 9-slice Sprite. Главный/обычный вид выбирать
   через `BlockView.setup`, не через отдельные разложенные в сцене блоки (готово).
3. В `Cell.prefab` настроить размер ячейки и визуальный Sprite; в `CoinFx.prefab` — переиспользуемый FX-элемент (готово).
4. Выполнять изменения только семантическими MCP-операциями: сначала `dryRun`, затем запись и
   `validate_document` (готово).

### Гейт готовности

- [x] Каждый prefab проходит `validate_document` — все три (`Block`, `Cell`, `CoinFx`) валидны, без ошибок и предупреждений.
- [x] Wrapper-конвенция соблюдена; renderer и неединичный scale не находятся на prefab root — `Sprite`
      всегда на дочерней `Visual`; root несёт только `UITransform` (+`BlockView` на `Block`).
- [x] `Block.prefab` не содержит данных конкретного уровня и не предразмещён в сцене — `BlockView.tileFrame`/
      `mainFrame` это статичные asset-ref'ы стиля, не координаты; сам prefab нигде не размещён как child сцены.
- [x] `BoardView` может инстанцировать все prefab refs без скрытых scene dependencies — все три prefab
      самодостаточны (внутренние `$component`/`$asset` ссылки, никаких ссылок наружу).

### Реальный пробел, найденный и закрытый при сборке (Фаза 3 → Фаза 4)

Сборка `Block.prefab` вскрыла два пробела в коде Фазы 3, которые не были видны, пока prefab не существовал:

1. **Не было визуального различия главный/обычный блок.** `BlockView.setup()` не переключал `Sprite.spriteFrame`
   и не менял размер `UITransform` под `length` блока — единственный `Block.prefab` иначе не смог бы обслуживать
   и препятствия, и главный блок, и блоки длиной >1 (см. `ASSET_SPEC.md`: `block_tile`/`block_main` — разные файлы,
   9-slice border 24). Добавлены `@property(Sprite) sprite`, `@property(SpriteFrame) tileFrame/mainFrame`;
   `setup()` теперь выставляет `spriteFrame` по `blockModel.isMain` и растягивает `UITransform` вдоль оси блока
   (`length * cellPitch - cellSpacing`), не искажая 9-slice углы.
2. **`BoardView` никогда не передавал `config` в заспавненный `BlockView`.** Блоки инстанцируются в рантайме
   (`instantiate(this.blockPrefab)`), поэтому `@property(GameConfig)` на самом prefab-е физически не может
   быть привязан к ноде `GameConfig` в сцене — крест-файловые ссылки на конкретный экземпляр сцены из prefab
   невозможны в Cocos. Без фикса `BlockView` всегда падал на хардкод-фолбэки (`?? 0.18`, `?? 0.7`, `?? 30`, `?? 0`
   для `cellSpacing` — это сломало бы новую логику размера блока). `BoardView.buildLevel()` теперь делает
   `blockView.config = this.config` сразу после `instantiate()`, до `setup()`.

Оба фикса — правки `.ts` (не сцены/префаба), формально зона `cocos-coder`, но выполнены в рамках Фазы 4, т.к. без них `Block.prefab` был бы структурно валиден, но не мог бы работать. `plbx-cocos-typecheck` перепрогнан после обеих правок — `26 selected, 0 excluded`, `0 errors, 0 warnings`.

### Известное ограничение, унаследованное из Фазы Track A (не блокер Фазы 4)

9-slice border у `block_tile`/`block_main`/`cell`… — уточнение: у `cell.png` 9-slice не предусмотрен спекой (обычный Sprite). У `block_tile.png`/`block_main.png` border всё ещё `0` в `.meta` (см. `OPEN_ISSUES.md`, раздел «Технические заметки»). `Visual/Sprite.type` в `Block.prefab` уже выставлен `SLICED`, чтобы растяжка заработала автоматически, как только владелец проекта проставит border вручную в Sprite Editor — до этого момента блоки длиной >1 будут визуально растягиваться как обычный stretch, а не 9-slice. Не блокирует Фазу 5, должно быть закрыто до QA-прогона адаптива в Фазе 6.

### Handoff

`assets/prefabs/{Block,Cell,CoinFx}.prefab` — все три готовы, с UUID (см. `list_assets`/`get_asset_info` при привязке в Фазе 5). Структура одинакова: root = `UITransform` (+`BlockView` на `Block`), child `Visual` =
`UITransform + Sprite` (+`Widget` stretch-to-parent на `Block`/`Cell`, кроме `CoinFx` — не резайзится в рантайме).
`Block.prefab.BlockView`: `tileFrame`/`mainFrame` уже привязаны к `block_tile.png@f9941`/`block_main.png@f9941`,
`sprite` — к `Visual`'s `Sprite`; `config` намеренно `null` в самом prefab (см. пробел №2 выше — `BoardView` проставляет его в рантайме, в сцене привязывать нечего). Для Фазы 5: только `BoardView.cellPrefab` →
`db://assets/prefabs/Cell.prefab`, `BoardView.blockPrefab` → `db://assets/prefabs/Block.prefab`,
`MoneyFountainView.coinFxPrefab` → `db://assets/prefabs/CoinFx.prefab` — как в `SCENE_SETUP.md`, без
дополнительного wiring.

## Фаза 5 — Сцена и явный wiring

- **Владелец:** `cocos-scene-builder`
- **Статус:** ready for review
- **Зависит от:** фаз 3–4
- **Цель:** собрать единственную игровую сцену с явными ссылками и иерархией из `SCENE_SETUP.md`.

### Работы

1. Проверить проект через Cocos MCP, затем собрать `Canvas`, слои, `CTAOverlay`, `GameManager` и Systems согласно целевой иерархии `SCENE_SETUP.md` (готово — иерархия уже существовала в `assets/scene.scene` до начала Фазы 5, см. заметку ниже).
2. На первом проходе применить структуру через `apply_edits` в `dryRun`; после проверки применить запись (готово).
3. Добавить компоненты на целевые ноды и связать каждое поле из таблицы wiring через `@property` (готово — 46 операций: 20× `add_component`, 26× `set_component_property`, единым `apply_edits`-батчем после `dryRun`).
4. Установить asset refs через `set_asset_ref`; неизвестные UUID не подменять вручную. Отсутствующие внешние ассеты оставить `null` и зарегистрировать в `OPEN_ISSUES.md` (готово — `GameConfig.levelsData` → `assets/data/levels.json`; `BoardView.cellPrefab/blockPrefab`, `MoneyFountainView.coinFxPrefab` → Фаза-4 prefabs; единственный оставшийся `null` — `FreecashLogo.Sprite.spriteFrame`, внешний блокер `OPEN_ISSUES.md` #2).
5. Оставить `CellsContainer` и `BlocksContainer` пустыми: `BoardView` спавнит их во время запуска (подтверждено, оба контейнера без детей).
6. Настроить `SafeArea`, Widget и anchor points для portrait. `CTAOverlay` остаётся поверх сцены, но его панель должна учитывать usable bounds в landscape (portrait-раскладка и Widget'ы уже были собраны заранее; landscape — по-прежнему `LayoutAdapter`-заглушка, см. Фаза 6 / `OPEN_ISSUES.md` #7).

### Заметка: иерархия сцены уже существовала до Фазы 5

`assets/scene.scene` и вся целевая иерархия (`Canvas`/`SafeArea`/слои/`CTAOverlay`/`GameManager`/`Systems`) были собраны заранее (см. `OPEN_ISSUES.md` «Технические заметки» — design resolution уже выставлена в Project Settings). На момент старта Фазы 5 ни одна нода не несла ни одного `[ViewClass]`/`[SystemClass]` компонента — `query_scene_graph` показывал голые `UITransform`/`Sprite`/`Label`/`Widget` без единого скрипта. Вся работа Фазы 5 состояла в: (1) добавлении `InputRouter`/`LayoutAdapter` — двух нод из Фазы 3 handoff, которых не было в исходной `SCENE_SETUP.md`; (2) навешивании всех 20 компонентов; (3) полном wiring 26 `@property`-полей по таблице. `SCENE_SETUP.md` обновлён, чтобы отразить `InputRouter`/`LayoutAdapter` в целевой иерархии и то, что `GameConfig` — компонент на ноде `GameEntryPoint`, а не отдельная нода.

### Гейт готовности

- [x] `query_scene_graph` соответствует `SCENE_SETUP.md` — иерархия, имена нод и набор компонентов на каждой ноде совпадают 1:1 (перепроверено после апдейта `SCENE_SETUP.md` с `InputRouter`/`LayoutAdapter`).
- [x] `validate_document assets/scene.scene` = pass — `154 objects`, 0 ошибок, 0 предупреждений.
- [x] Нет битых node/component/asset refs — все 46 `apply_edits`-операций прошли без ошибок ссылок, `validate_document` подтверждает целостность.
- [x] Все обязательные поля привязаны; допустимые `null` перечислены в `OPEN_ISSUES.md` — единственный `null` за пределами скриптовых `@property` — спрайт `FreecashLogo` (см. п.4 выше), уже в `OPEN_ISSUES.md` #2.
- [x] Главный блок и ячейки отсутствуют среди статических children сцены — `CellsContainer`/`BlocksContainer` пусты, `Block`/`Cell` инстанцируются только `BoardView` в рантайме.
- [x] `CTAOverlay.active = false` до terminal event; disclaimer присутствует в базовом UI — подтверждено (`○ CTAOverlay`, `Sparks` тоже неактивен по умолчанию; `DisclaimerLabel` активен, текст уже совпадает с `DisclaimerView.text` по умолчанию — без дублирующего литерала).

### Handoff

`assets/scene.scene` — единственная рабочая сцена, `validate_document` = pass (154 объекта, 0 ошибок). Полный wiring по таблице `SCENE_SETUP.md` подтверждён `query_scene_graph`/`inspect_node`. Единственный оставшийся временный `null` — `CTAOverlay/Panel/FreecashLogo.Sprite.spriteFrame` (клиентский логотип, `OPEN_ISSUES.md` #2). Для Фазы 6: запустить сцену в редакторе, пройти полный flow INTRO→CTA, проверить 9-slice после того как владелец проекта выставит border'а (`OPEN_ISSUES.md`, «Технические заметки»), прогнать portrait/landscape.

## Фаза 6 — Сквозная интеграция и адаптив

- **Владелец:** `cocos-coder` + `cocos-scene-builder`
- **Статус:** in progress
- **Зависит от:** фазы 5
- **Цель:** подтвердить, что реальная сцена корректно исполняет полный игровой сценарий на нужных aspect ratios.

### Работы

1. Запустить сцену в Cocos Editor и пройти полный flow: INTRO → L1 → drive → +9 FC → L2 → drive → +10 FC → CTA.
2. Устранить расхождения между serialised refs, event contracts, prefab contents и runtime-поведением.

### Найденный и исправленный баг: сетка рисовалась не по центру `BoardFrame`

Владелец проекта запустил preview и увидел, что вся сетка (`CellsContainer`/`BlocksContainer`) рисуется в
правом нижнем углу экрана вместо центра `BoardFrame` — уровень был неиграбелен. Причина: `BoardView.buildLevel()`,
`BlockView.cellToLocal()` и `TutorialFingerView.showHint()` (все три — Фазы 2–3) считали позицию ячейки как
`(col + 0.5) * pitch`, что кладёт ячейку `(0,0)` в локальный `(0,0)` контейнера — т.е. в его **угол**. Но
`CellsContainer`/`BlocksContainer` не имеют собственного anchorPoint-смещения для детей (anchorPoint влияет
только на рендер собственного спрайта ноды, не на систему координат children) и физически совпадают с
локальным `(0,0)` центрированного `BoardFrame`. Итог: вся 6×6 сетка (612×612px) рисовалась целиком в
положительном-x/отрицательном-y квадранте относительно центра рамки — визуально «сползала» на половину
своего размера вниз-вправо.

**Фикс** — добавлен центрирующий сдвиг (`offsetX = -(gridCols * pitch) / 2`, `offsetY = (gridRows * pitch) / 2`)
идентично в трёх местах: `BoardView.buildLevel()` (ячейки), `BlockView.cellToLocal()` (блоки, через новые
приватные поля `gridOffsetX/gridOffsetY`, посчитанные один раз в `setup()`), `TutorialFingerView.showHint()`
(палец-подсказка). Все три обязаны использовать один и тот же расчёт — иначе подсказка/блоки/ячейки снова
разъедутся между собой. `plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`.

Заодно поправлена ранее вручную выставленная позиция `ExitArrow` в сцене: `y=20` не совпадал с реальным
центром `exitRow=2` под новой формулой (`y=51`, посчитано из `levels.json` — оба уровня используют
`exitRow: 2`) — обновлено через `apply_edits` до `y=51`, `validate_document` = pass.

**Урок на будущее:** позиционирующая математика, которая координирует несколько View (сетка/блоки/подсказка),
должна быть либо в одном общем месте, либо перепроверяться на реальном preview сразу после Фазы 5 wiring —
`plbx-cocos-typecheck` и `validate_document` не ловят такие ошибки, потому что синтаксически всё корректно;
баг был чисто геометрический и виден только в запущенной сцене.

### Найденный и исправленный баг: CTA никогда не появлялся (неактивный предок блокирует `onLoad`)

Владелец проекта прошёл оба уровня и не увидел CTA-панель в финале. Причина — движковый гочка Cocos, а не
логическая ошибка: `CTAView` (Фаза 3) висел на ноде `Panel`, а `Panel` — потомок `CTAOverlay`, которая
сцена (Фаза 5) держит `active=false` до терминального события. Cocos **не вызывает `onLoad()` для потомков
неактивного предка** — компонент числится в сцене, но его код инициализации никогда не выполняется, пока сам
узел не станет активным во всей цепочке предков ([Life Cycle Callbacks](https://docs.cocos.com/creator/3.8/manual/en/scripting/life-cycle-callbacks.html): «a Node may be inactive because a parent is not
active, even if the node's own active property returns true»). Итог: `CTAView.onLoad()` — где происходит
подписка на `EVT_REQUEST_CTA` — никогда не выполнялся, поэтому показ CTA не мог сработать в принципе:
единственный код, который должен был его показать, никогда не просыпался.

**Фикс:** `CTAView` перенесён на саму ноду `CTAOverlay` (`remove_component` с `Panel` + `add_component` на
`CTAOverlay` через `apply_edits`), которая теперь `active=true` с самого старта сцены — активны только её
скрипты, а не визуал. Видимость переключают два новых `@property(Node)`: `dimNode`/`panelNode` (дети `Dim`/
`Panel`, оба `active=false` при старте) — `CTAView.show()` больше не трогает `this.node`/`this.node.parent`.
`GameEntryPoint.ctaView` и `SCENE_SETUP.md` (иерархия + wiring-таблица) обновлены на новый путь `CTAOverlay`.
`plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`; `validate_document` = pass
(154 объекта). Проверены остальные изначально неактивные ноды сцены (`Dim`, `Panel`, `Sparks`) на тот же
класс бага — ни на одной нет собственного скрипта, ждущего `onLoad()`, только на уже-исправленной `Panel`
он и был.

**Урок на будущее:** компонент, который должен АКТИВИРОВАТЬ ветку сцены по событию, не может сам жить
ВНУТРИ этой ветки, если ветка стартует неактивной — его `onLoad()`/подписки на EventBus просто не
выполнятся. Правильный паттерн (уже применён в `MoneyFountainView`/`Sparks`): управляющий скрипт — на
всегда-активном узле, у которого есть `@property(Node)`-ссылка на скрываемые визуальные дети.

3. Проверить порядок state/reward: L2 не появляется до завершения награды L1, финальный счётчик не
   обновляется дважды, CTA не может открыться раньше L2.
4. Прогнать portrait, узкий portrait, landscape и широкий landscape. Подстроить layout-адаптер/Widget так, чтобы board, exit arrow, HUD, disclaimer и CTA button были целиком видимы.
5. Проверить Playbox lifecycle в editor-safe режиме: `game_ready` один раз после wiring, `tap` на первый ввод, `game_end` при CTA, `download` только на CTA button.

### Найденный и исправленный баг: сильный зум в landscape (не выставлена resolution policy)

Владелец проекта переключил preview в landscape и увидел сильный зум центра экрана вместо адаптированной
раскладки. Причина: нигде в проекте (ни в Project Settings, ни в коде) не был явно выставлен design
resolution policy — движок работал на дефолтном поведении, которое не гарантирует «весь дизайн-прямоугольник
720×1280 виден без обрезки» на произвольном aspect ratio.

**Фикс:** `LayoutAdapter.applyLayout()` теперь явно вызывает `view.setDesignResolutionSize(720, 1280,
ResolutionPolicy.SHOW_ALL)` — официальный механизм Cocos, гарантирующий отсутствие обрезки/зума при
любом соотношении сторон (леттербокс вместо кропа). Вызывается при старте и на каждый `canvas-resize`.
`plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`.

**Осталось (см. `OPEN_ISSUES.md` #7):** SHOW_ALL закрывает жёсткое требование «ничего не обрезается», но пока не даёт bespoke landscape-композицию из `SCENE_SETUP.md` («HUD-панели по краям, поле по центру» — т.е. использование реально освободившейся ширины, а не леттербокс-поля вокруг portrait-раскладки).
Репозиционирование HUD под landscape сознательно не реализовано вслепую в этом же проходе — без визуальной обратной связи (скриншот/точное описание того, что видно после SHOW_ALL) высок риск получить результат хуже текущего leterbox-fallback. Следующий шаг: владелец подтверждает, что SHOW_ALL устранил зум/обрезку, затем даёт конкретный фидбек по итоговой landscape-раскладке для точной подгонки позиций HUD.

### Итерация 2: SHOW_ALL убран, полосы устранены через ручной `Camera.orthoHeight`

Владелец подтвердил: на стандартном разрешении ничего не обрезается, landscape корректно леттербоксит
portrait-композицию по центру (SHOW_ALL сработал). Но на «вытянутых» телефонах (aspect уже дизайна 9:16, напр. iPhone) появились чёрные полосы сверху/снизу, и попросил full-bleed фон без полос вместо принятия леттербокса как есть (выбрано явно, вариант «оставить SHOW_ALL как есть» и «NO_BORDER» отклонены — NO_BORDER дал бы обрезку ≈64px с каждой стороны на типичном iPhone aspect, `LevelPanel`/`ExitArrow` уже на грани этого).

**Фикс:** `LayoutAdapter` больше не трогает `view`/`ResolutionPolicy` вообще — `Canvas.alignCanvasWithScreen`
и так растягивает сам canvas-элемент на 100% реального окна без каких-либо полос (это и был источник
исходного зума в landscape, а не сам факт растяжения). Вместо DOM-леттербокса теперь пересчитывается
`Camera.orthoHeight` под текущий `screen.windowSize` по формуле `max(designHeight/2, (designWidth/2) /
screenAspect)`: на экранах шире дизайна (landscape) формула не меняет базовые 640 — лишняя ширина просто
открывает больше фона; на экранах уже дизайна (iPhone) `orthoHeight` растёт — сцена целиком чуть уменьшается,
освобождая вертикальное пространство под тот же растянутый на весь Canvas фон, а не под чёрные полосы. Гарантия
«ничего не обрезается» сохраняется в обеих ветках формулы. Добавлен `@property(Camera) camera`, привязан к
`Canvas/Camera` через `apply_edits`. `plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`;
`validate_document` = pass (154 объекта).

**Важно:** это правка и `.ts`, и `.scene` — по уроку из бага с CTA (см. выше) владельцу нужно закрыть и заново открыть вкладку `scene.scene` в редакторе перед проверкой в Preview.

### Итерация 3: остаточная полоса в portrait + bespoke landscape-композиция по спеке владельца

Владелец после итерации 2 сообщил: (а) в portrait осталась нижняя полоса (верхняя пропала), (б) в
landscape «структура ломается» — плата остаётся в центре, фон и интерфейс «уезжают вниз». Дал точную
спеку желаемого landscape: фон растягивается по ширине и обрезается по высоте (cover-fit), плата
увеличивается (боковой паддинг portrait становится вертикальным паддингом landscape), HUD перестраивается
в колонку слева.

**Реструктуризация сцены:** `GameplayLayer`, `TutorialLayer`, `FxLayer` были независимыми детьми `SafeArea`
с одинаковым статичным offset (0,-40,0) — чтобы двигать/масштабировать "плату" одним куском, заведена новая
обёртка `SafeArea/BoardArea` (тот же offset), все три перепривязаны под неё (`reparent` + сброс локальной
позиции в (0,0,0), т.к. `reparent` не сохраняет мировую позицию — правило проверено на практике в этом же
проходе). `BoardView`/`BlockView`/`TutorialFingerView`/`MoneyFountainView` не тронуты — их математика
работает в локальных координатах контейнеров и не зависит от того, где эти контейнеры висят в дереве.

**Фикс полосы в portrait и cover-fit фона:** `Background`'s `Widget` отключён (`.enabled = false`) —
он конфликтовал бы с ручным управлением. Вместо Widget-стретча `LayoutAdapter` теперь считает единую
cover-fit формулу для ОБЕИХ ориентаций: `scale = max(visibleWidth / bgWidth, visibleHeight / bgHeight)` —
растягивает фон по большей из двух осей, вторая переполняется за экран (обрезается декоративно). Работает
одинаково в portrait и landscape, поэтому одна и та же формула убрала и старую полосу снизу, и дала
landscape-поведение «растянуть по ширине, обрезать по высоте» из спеки владельца.

**Плата (`boardArea`) и HUD-колонка:** `HudLayer`'s `Widget` тоже отключён — при повороте экрана
`LayoutAdapter.applyLayout()` либо восстанавливает захваченную один раз в `onLoad` portrait-базу (позиции/
размеры HUD, фона, `boardArea` — не задизайнены литералами в коде, а прочитаны из уже собранной сцены),
либо считает landscape-версию: `boardArea` масштабируется так, чтобы использовать зафиксированную видимую
высоту (1280, т.к. `orthoHeight` в landscape не меняется — см. итерацию 2) за вычетом той же margin-доли,
что была у платы по бокам в portrait (пропорция переносится с ширины на высоту, как просил владелец), и
сдвигается вправо от HUD-колонки. `HudLayer` меняет anchor с «сверху, во всю ширину» на «слева, во всю
высоту» (ширина колонки — 200px, подобрана под размеры `LevelPanel`/`CoinCounter`), три его ребёнка
(`LevelPanel`/`MovesPanel`/`CoinCounter`) переставляются в вертикальный стек.

`plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`; `validate_document` = pass
(155 объектов, +1 за новую ноду `BoardArea`).

**Осталось:** это первая версия landscape-композиции по словесной спеке, реализованная без визуальной
обратной связи (не могу просмотреть результат сам) — конкретные числа (ширина HUD-колонки 200px, отступы
между панелями 350px, margin-пропорция платы) подобраны по разумным, но не проверенным визуально
предположениям и почти наверняка потребуют финальной подгонки после первого реального просмотра. Не забыть
про урок с CTA: и `.ts`, и `.scene` менялись — переоткрыть вкладку `scene.scene` перед Preview.

### Итерация 4: отказ от вычисляемой "ширины колонки" в пользу фиксированных паддингов + укрупнение HUD

Владелец сам подправил формулы (`LANDSCAPE_HUD_COLUMN_WIDTH` → 400, `boardArea` позиция → `(0,0,0)`) и
дал новое направление: telefon и планшет в landscape выглядят по-разному (разный aspect ratio), поэтому
вычислять точную "ширину колонки" под конкретный экран — хрупкий подход. Попросил вместо этого простой
фиксированный паддинг слева от платы (без вычисления ширины) и визуально более крупные HUD-элементы
(были мелкими на фоне освободившегося в landscape пространства).

**Фикс:** убран весь код, резервировавший точную ширину HUD-колонки под текущий `visibleHalfWidth`.
Теперь два независимых фиксированных паддинга в дизайн-единицах: `LANDSCAPE_BOARD_LEFT_PADDING=40`
(левый край `boardArea` — ровно эта дистанция от левого края экрана, считается через уже существующий
`gameplayLayerWidth`×`scale` половину ширины платы) и `LANDSCAPE_HUD_LEFT_PADDING=30` (независимая позиция
`hudLayer` у левого края). Оба не зависят от класса устройства (телефон/планшет) — единственная адаптация
идёт через уже существующий `visibleHalfWidth` (сам меняется по aspect ratio), так что отдельная ветка
"phone vs tablet" не потребовалась.

**Укрупнение HUD:** вместо увеличения каждой панели по отдельности и подбора интервала между ними отдельной
константой — масштабируется весь `hudLayer` целиком (`LANDSCAPE_HUD_SCALE=1.5`). Локальные позиции панелей
внутри него (350/0/-350) не менялись: масштаб родителя пропорционально увеличивает и сам размер панелей,
и интервал между ними одним числом, без риска рассинхронизировать «размер» и «отступ» как отдельные ручки.

Заодно упрощена сама модель: `hudLayer`'s `UITransform.contentSize` (использовался только под старую
"ширину колонки") больше не трогается вообще — раз он ни на что не влиял (ни маска, ни layout от него не
зависели), меньше состояния, которое нужно захватывать/восстанавливать между portrait и landscape.

`plbx-cocos-typecheck` — `26 selected, 0 excluded`, `0 errors, 0 warnings`. Сценовых правок в этой итерации
не было (только `.ts`) — реимпорт вкладки сцены не требуется, следующий Preview подхватит правку сам.

### Найденный «баг», оказавшийся устаревшей сценой в редакторе (не код)

После фикса CTA (см. выше — `CTAView` перенесён на `CTAOverlay`) владелец всё равно не видел CTA. Чтобы не
гадать дальше, добавили временное трейс-логирование (`console.error('[DEBUG ...]')`) по всей цепочке
`BoardSystem.checkMainPath → DriveSystem.onMainPathClear/onMainReachedExit → RewardSystem.onLevelSolved →
GameStateSystem.onRewardSequenceDone → CTAView.onLoad/onRequestCta/show`. Лог с реального прогона показал:
**вся цепочка событий отрабатывает идеально** — L1 (`reward:9, total:9`) → L2 (`reward:10, total:19`) →
`EVT_REQUEST_CTA{totalFc:19}` → `CTAView.onRequestCta` → `show()` — но `show()` пришёл с
`hasDimNode:false, hasPanelNode:false`, хотя сам `.scene`-файл на диске (перепроверено через `inspect_node`
прямо в момент бага) чётко содержал `dimNode=→Dim`, `panelNode=→Panel`.

Причина — не логика, а редактор: MCP пишет изменения в `assets/scene.scene` напрямую на диск, но уже
**открытая вкладка сцены в Cocos Editor держит собственную in-memory копию** и не перечитывает файл с диска
просто от обновления окна Preview. Правка (перенос `CTAView` на `CTAOverlay` + новые `dimNode`/`panelNode`)
физически лежала в файле, но открытая в редакторе сцена продолжала работать со старой версией компонента.
Владелец закрыл и заново открыл вкладку `scene.scene` в редакторе (полный реимпорт с диска) — CTA сразу
заработал. Отладочные `console.error` убраны из всех 5 файлов после подтверждения, `plbx-cocos-typecheck`
= `26 selected, 0 excluded`, `0 errors, 0 warnings`, `grep` по `console\.` в `assets/scripts/**` — пусто
(кроме штатных no-op проверок в `Playbox.ts`, которые не логируют).

**Урок на будущее, важно для Фаз 7–8:** после ЛЮБОЙ правки `.scene`/`.prefab` через MCP `apply_edits`/
`build_prefab`, если этот файл уже открыт вкладкой в Cocos Editor — обязательно закрыть и заново открыть
вкладку (или перезапустить редактор) ПЕРЕД тем как проверять результат в Preview. `validate_document` этого
не поймает (он читает файл с диска, а не in-memory состояние редактора), только реальный визуальный прогон.

### Гейт готовности

- [x] Smoke-сценарий из `QA_CHECKLIST.md` проходит без ручного вмешательства вне ожидаемых свайпов —
      подтверждено владельцем: INTRO → L1 → drive → +9 FC → L2 → drive → +19 FC → CTA, полный цикл.
- [x] Счётчик воспроизводимо показывает `0 → 9 → 19` — подтверждено логом реального прогона
      (`reward:9, total:9` → `reward:10, total:19`).
- [x] Ни один пользовательский input не влияет на уровень в `INTRO`, `LEVEL_DRIVE`, `LEVEL_CLEAR` и `CTA` —
      гарантировано кодом (`GameStateModel.canAcceptInput()` пропускает свайпы только в `LEVEL_PLAY`,
      см. `BoardSystem.onSwipe`), поведение не менялось с гейта Фазы 2.
- [ ] Portrait и landscape не обрезают ключевые элементы, включая disclaimer — `SHOW_ALL` фикс внедрён
      (см. выше), но landscape ещё не переподтверждён владельцем именно после этого фикса; portrait и
      узкие/широкие варианты — тоже ждут финального прохода.
- [ ] Вызовы Playbox происходят по одному разу в ожидаемых состояниях — по коду гарантировано (single-fire
      guards в `GameStateModel`, единственные вызовы `game_ready`/`tap`/`game_end`/`download` в
      `GameEntryPoint`/`InputRouter`/`CTAView`), но не наблюдаемо визуально в editor-safe режиме (`Playbox`
      — no-op без `window.plbx`, ничего не логирует по дизайну) — предмет per-network проверки в Фазе 8.
- [x] Изменённые сцена и prefabs повторно проходят `validate_document` — сцена `154 объекта`, 0 ошибок;
      все три prefab (`Block`/`Cell`/`CoinFx`) валидны.

### Handoff

Передать результаты smoke и aspect-ratio прогона, плюс список исправлений или оставшихся внешних блокеров.

## Фаза 7 — QA и release gate

- **Владелец:** оркестратор / `playable-qa-release-gate`
- **Статус:** not started
- **Зависит от:** фазы 6, закрытых внешних блокеров #1–#3
- **Цель:** подтвердить готовность к сетевым сборкам и не допустить регрессии требований Freecash.

### Работы

1. Выполнить все пункты `QA_CHECKLIST.md`: core loop, механика, адаптив, статика, lifecycle и compliance.
2. Проверить `plbx-cocos-typecheck`, отсутствие запрещённых API и production `console.log`, очистку EventBus subscriptions
   и `validate_document` для сцены и всех prefab.
3. Заменить placeholder-арт и лого утверждёнными клиентскими файлами. Повторно проверить 9-slice, визуальный
   контраст и вес после замены.
4. Зафиксировать результат по каждому открытому вопросу. Нерешённый финальный блокер должен быть явно
   принят владельцем, а не скрыт workaround-ом.
5. Зафиксировать кандидата на выпуск только после complete pass всех обязательных пунктов.

### Гейт готовности

- [ ] `QA_CHECKLIST.md` полностью пройден.
- [ ] Используется официальный логотип Freecash; placeholder не попал в релиз.
- [ ] Нет $/купюр/карт/«Баланс»/cash-out формулировок; монета маркирована только `FC`.
- [ ] Дисклеймер `For illustration purposes only` виден весь playable.
- [ ] Общий вес готовой сборки не превышает 5 MB.
- [ ] Открытые вопросы #1–#3 закрыты либо имеют явное письменное разрешение владельца релиза.

### Handoff

Передать подписанный QA-результат, финальный список ассетов и конфигурацию, нужную для per-network export.

## Фаза 8 — Per-network export и передача

- **Владелец:** оркестратор / релиз-инженер
- **Статус:** not started
- **Зависит от:** фазы 7
- **Цель:** подготовить и провалидировать store-сборки для всех требуемых рекламных сетей.

### Работы

1. Для каждой сети настроить инжект `plbx`/тегов и убедиться, что CTA ведёт на правильный store-link.
2. Собрать и проверить отдельные версии для: Mintegral, AppLovin, Google, Unity, Moloco, IronSource2025,
   TikTok, Facebook, Smadex, Liftoff и Snapchat.
3. Прогнать preview/validator каждой сети и smoke-сценарий внутри соответствующего окружения.
4. Проверить размер каждой сборки (≤ 5 MB), disclaimer, логотип, CTA и lifecycle после сетевого инжекта.
5. Упаковать только store-версию в RAR: внутри папка `store`, имя `PL_B4C4_<network>`.

### Гейт готовности

- [ ] Все 11 сетевых сборок проходят собственный validator/preview.
- [ ] Каждая сборка использует нужный SDK adapter и корректный store CTA.
- [ ] Каждый архив соответствует формату и неймингу из `EXPORT_CHECKLIST.md`.
- [ ] Все сборки и архивы проверены до передачи в чат.

## Реестр ранних рисков

| Риск                                     | Как предотвращается                                                     | Владелец                    |
| ---------------------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| Нерешаемая или слишком сложная раскладка | Проверить L1/L2 до написания `BoardSystem`; хранить решения уровней     | cocos-coder                 |
| Повторный solve/reward/CTA               | Single-fire guards на phase, drive и наградах; проверка быстрых свайпов | cocos-coder                 |
| L2 появляется поверх эффекта +9 FC       | Вводится явная последовательность reward → следующий уровень в фазе 0   | cocos-coder                 |
| Сцена расходится с кодом                 | Явные `@property`, MCP validation, handoff refs между фазами            | cocos-scene-builder         |
| Обрезка UI в landscape                   | Отдельный acceptance gate на четыре aspect-ratio в фазе 6               | cocos-coder + scene-builder |
| Нефинальный лого/арт попадает в экспорт  | Финальный QA-gate требует закрытия #1–#2                                | оркестратор                 |
| Несовместимый `plbx` runtime             | No-op adapter в editor и per-network проверка перед упаковкой           | лид / релиз-инженер         |
| Превышение 5 MB                          | Контроль placeholder-арта и измерение каждого финального билда          | asset-maker / релиз-инженер |

## Ручные действия в Cocos Editor

После импорта новых ассетов и до финального QA:

1. Открыть `assets/scene.scene`, дать Cocos создать служебные `.meta` автоматически.
2. Проверить назначение SpriteFrame и `@property`; незаполненные допустимые поля оставить `null` и записать
   в `OPEN_ISSUES.md`.
3. Запустить Play и пройти smoke из `QA_CHECKLIST.md`.
4. Не редактировать JSON `.scene`/`.prefab` вручную и не создавать `.meta` вручную.
