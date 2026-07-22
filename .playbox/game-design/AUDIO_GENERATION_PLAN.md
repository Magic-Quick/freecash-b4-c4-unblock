# AUDIO_GENERATION_PLAN — «Unblock» (Freecash B4C4)

> План производства и приёмки звука через `generate_audio` (ElevenLabs). Документ описывает генерацию и последующее подключение; в этой задаче аудиофайлы и код не меняются.

## 1. Цель, границы и ограничения

### Цель

Дать короткий, читаемый feedback всем ключевым действиям Unblock, не перегружая короткий playable. Эмоциональная дуга: спокойный деревянный пазл → понятное движение блока → нарастание при открытом пути → яркая, но не агрессивная награда → CTA.

### Границы первого аудиопрохода

- Генерируются только SFX; фоновая музыка — отдельный необязательный эксперимент после их проверки.
- Никакой речи, вокала, слов, названий брендов, денежных терминов или звуков слот-машины/казино.
- Звуки должны быть пригодны для коммерческого использования. До финального экспорта подтвердить лицензию/права выбранного генератора и сохранить ссылку на условия, дату и аккаунт-источник в задаче/релизной карточке.
- Ориентир общего размера playable — **до 5 MB** (GDD §10). Для первой итерации держать суммарный вес аудио не выше **450 KB**; для этого использовать короткие моно/стерео MP3 и не добавлять музыку в финальный пакет без весового бюджета.
- Формат генерации: `mp3_44100_128`. Инструмент принимает SFX от 0.5 s: для более короткого по ощущению UI-сигнала генерировать 0.5 s с быстрой атакой и затуханием, а не указывать недопустимую длительность. При необходимости оптимизации финального билда перекодировать после прослушивания только если это разрешено экспортным пайплайном; оригиналы не перезаписывать.
- Пути: `assets/audio/sfx/<kebab-case-name>-vN.mp3` и `assets/audio/music/<kebab-case-name>-vN.mp3`. Версии не затирать: это позволяет A/B-сравнение.

## 2. Текущий технический контракт

- В проекте пока нет аудио-ассетов.
- `SoundSystem` — безопасный no-op stub, уже подписанный на `EVT_PLAY_SOUND` (`assets/scripts/Systems/SoundSystem.ts`). Это означает, что генерация не требует изменений gameplay-кода до отдельной задачи интеграции.
- Единственный публичный аудиовход — `EVT_PLAY_SOUND` с `{ id: string }` (`assets/scripts/event-bus/events.ts`). Имена ID нужно централизовать константами в будущей реализации, а не разносить строковыми литералами по Views/System.
- В будущей интеграции воспроизведение обязано уважать `plbx.is_muted()`, `plbx.on_mute_change()` и явную кнопку mute/unmute (OPEN_ISSUES #9). Звук не должен запускаться самовольно до разрешённого контейнером пользовательского ввода.

## 3. Реестр SFX первого релиза

| ID для будущего `EVT_PLAY_SOUND` | Файл-кандидат | Событие/момент | Целевая длина | Приоритет |
|---|---|---|---:|---|
| `block_slide` | `assets/audio/sfx/block-slide-v1.mp3` | успешный `EVT_BLOCK_MOVED` | 0.35–0.50 s | P0 |
| `block_blocked` | `assets/audio/sfx/block-blocked-v1.mp3` | `EVT_BLOCK_BLOCKED`, не чаще одного на действие | 0.50 s | P0 |
| `path_clear` | `assets/audio/sfx/path-clear-v1.mp3` | финальное освобождение пути / `EVT_MAIN_PATH_CLEAR` | 0.45–0.65 s | P0 |
| `main_drive` | `assets/audio/sfx/main-drive-v1.mp3` | `EVT_MAIN_DRIVE_START`; синхронно с `mainDriveDuration` 0.7 s | 0.65–0.80 s | P0 |
| `exit_whoosh` | `assets/audio/sfx/exit-whoosh-v1.mp3` | `EVT_MAIN_REACHED_EXIT` + flash | 0.50 s | P0 |
| `coin_fly` | `assets/audio/sfx/coin-fly-v1.mp3` | `EVT_COINS_CHANGED`, соответствует `coinFlyDuration` 0.6 s | 0.50–0.70 s | P0 |
| `coin_count` | `assets/audio/sfx/coin-count-v1.mp3` | финальный tick/подсветка счётчика | 0.50 s | P1 |
| `level_complete` | `assets/audio/sfx/level-complete-v1.mp3` | только после `EVT_REWARD_SEQUENCE_DONE` на L1 | 0.70–1.00 s | P1 |
| `final_fanfare` | `assets/audio/sfx/final-fanfare-v1.mp3` | финальные 19 FC / CTA | 1.20–1.80 s | P1 |
| `cta_tap` | `assets/audio/sfx/cta-tap-v1.mp3` | нажатие Play & Earn до `plbx.download()` | 0.50 s | P2 |

**Правило приоритета:** сначала сделать и проверить P0. P1 добавлять только если размер и микс P0 проходят QA; P2 необязателен, поскольку переход в стор может оборвать звук.

## 4. Готовые prompts для `generate_audio`

Промпты оставлены на английском: так предсказуемее контролируется SFX-модель. Во всех вариантах избегать слов `cash`, `money`, `jackpot`, `slot`, `casino`, названий артистов и чужих брендов.

### P0 — основной feedback

| Файл | Prompt | Параметры инструмента |
|---|---|---|
| `block-slide-v1.mp3` | `Short tactile wooden puzzle block sliding smoothly across a polished board, soft wood friction and a gentle stop, warm casual mobile game UI, clean dry mix, no music, no voice, no crowd` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.85` |
| `block-blocked-v1.mp3` | `Very short muted wooden puzzle block knock against a board edge, satisfying soft clack, warm casual mobile game UI, no metallic ring, no music, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |
| `path-clear-v1.mp3` | `Bright subtle puzzle solved discovery chime, two rising warm wooden mallet and soft bell notes, optimistic casual mobile game feedback, compact, no fanfare, no voice` | `type: sfx`, `duration_seconds: 0.55`, `prompt_influence: 0.8` |
| `main-drive-v1.mp3` | `A red wooden sliding puzzle block gliding confidently to the right across a smooth board, soft friction whoosh that gently rises in pitch and resolves cleanly, warm casual mobile game, no engine, no car, no voice` | `type: sfx`, `duration_seconds: 0.75`, `prompt_influence: 0.85` |
| `exit-whoosh-v1.mp3` | `Short cheerful exit whoosh with a soft sparkling burst, warm casual mobile puzzle game success feedback, clean and light, no explosion, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.8` |
| `coin-fly-v1.mp3` | `A small cluster of generic gold game tokens flying upward to a UI counter, delicate bright chimes with a soft final ping, friendly casual mobile puzzle game, no slot machine, no casino, no voice` | `type: sfx`, `duration_seconds: 0.6`, `prompt_influence: 0.85` |

### P1/P2 — полировка

| Файл | Prompt | Параметры инструмента |
|---|---|---|
| `coin-count-v1.mp3` | `Single crisp soft UI count-up tick with a tiny warm glassy ping, casual mobile puzzle game, very short, no music, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |
| `level-complete-v1.mp3` | `Short warm casual puzzle level-complete sting: three ascending marimba and soft bell notes, playful and restrained, no vocals, no casino feel` | `type: sfx`, `duration_seconds: 0.85`, `prompt_influence: 0.8` |
| `final-fanfare-v1.mp3` | `Warm celebratory casual mobile puzzle-game fanfare, bright marimba, soft bells and a gentle final sparkle, confident but restrained, no vocals, no orchestra, no casino feel` | `type: sfx`, `duration_seconds: 1.5`, `prompt_influence: 0.8` |
| `cta-tap-v1.mp3` | `Very short soft rounded UI button press with a clean upbeat confirmation click, casual mobile game, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |

## 5. Порядок генерации и отбор

1. Создать каталог `assets/audio/sfx/` штатным инструментом при первой генерации. Не создавать `.meta` вручную: Cocos импортирует их сам.
2. Для каждого P0-звука сгенерировать `v1` по prompt из §4. Не запускать пачку из всех P1/P2 до первичного микс-прохода.
3. Прослушать каждый звук в изоляции и в последовательности: `block_slide → block_blocked → path_clear → main_drive → exit_whoosh → coin_fly`.
4. Для неудовлетворительных вариантов создать `v2`, меняя **одно** свойство prompt: характер атаки, длину или инструмент. Не перезаписывать `v1`.
5. Выбрать по одному утверждённому варианту каждого ID; неимпортируемые/отклонённые версии убрать из итогового билда только после архивирования/фиксации выбора.
6. Сгенерировать P1 только после того, как P0 проходит микс и весовой бюджет. На финале решить, нужен ли P2.

### Быстрые итерации prompt

- Слишком резкий/громкий звук: добавить `soft attack, restrained, lower intensity`.
- Слишком «металлический»: добавить `wooden, muted, no metallic ring`.
- Слишком похож на казино: добавить `no casino, no slot machine, no jackpot` и заменить `coins` на `generic gold game tokens`.
- Звук слишком длинный: уменьшить `duration_seconds`; не обрезать атаку так, чтобы пропал распознаваемый момент действия.
- Нечитаемое окончание движения: добавить `gentle stop` / `clean resolution`.

## 6. Необязательная музыка

Музыка добавляется лишь при наличии отдельного бюджетного и UX-одобрения: для playable она может ухудшить читаемость SFX и увеличить вес. Сначала сделать **бесплатный** `music_plan`, оценить структуру, затем генерировать только одобренный вариант.

### Вариант трека

- Файл: `assets/audio/music/unblock-loop-v1.mp3`.
- Назначение: тихий gameplay-слой после первого user gesture; не должен конкурировать с хрустом дерева и reward-звуками.
- Длина: 30–45 s, instrumental, бесшовный loop проверяется отдельно; если генератор не даёт чистый seam, музыку не включать.
- Prompt для `music_plan`: `Light instrumental casual mobile puzzle-game loop, warm marimba, soft pizzicato and subtle hand percussion, optimistic and focused, 108 BPM, C major, very low intensity, no vocals, no branded melody, designed to leave room for UI sound effects.`
- После проверки плана: вызвать `generate_audio` с `type: music`, `composition_plan: <approved plan>`, `path: assets/audio/music/unblock-loop-v1.mp3`. Не передавать одновременно `music_length_ms`.

**Микс-правило:** music должна быть существенно тише SFX; на reward/exit допустимо краткое ducking или отсутствие музыкального слоя. Автовоспроизведение и mute обязательно сверить с Playbox SDK.

## 7. Будущее подключение в Cocos (отдельная задача)

1. Импортировать утверждённые MP3, проверить, что Cocos создал meta-файлы сам.
2. Реализовать `AudioController`/доработать `SoundSystem`: явные `@property` ссылки на `AudioClip`, таблица `soundId → AudioClip`, проверка mute-состояния контейнера и пользовательского mute.
3. `SoundSystem` должен подписаться на gameplay EVT из таблицы ниже и сам вызывать внутреннее воспроизведение либо потреблять уже опубликованный `EVT_PLAY_SOUND`. Предпочтительный вариант — централизованное преобразование доменных EVT в звук внутри SoundSystem, чтобы Views не знали ID клипов.
4. Ограничить частоту `block_blocked` и `block_slide`, чтобы быстрые свайпы не складывали клипы в шум. Нельзя использовать таймеры с магическими литералами: tunable-пороги добавить в `GameConfig` с комментариями и значениями по умолчанию.
5. Добавить видимую кнопку `sound_on/sound_off` согласно OPEN_ISSUES #9; она не заменяет реакцию на mute рекламного контейнера.
6. Прогнать звук и mute в Preview и целевых сетевых сборках. На первом пользовательском touch звук должен быть разрешён браузером; до него — тихий fallback.

| Доменное событие | Будущий SoundSystem action | Ограничение |
|---|---|---|
| `EVT_BLOCK_MOVED` | `block_slide` | один клип на завершённый ход |
| `EVT_BLOCK_BLOCKED` | `block_blocked` | debounce, не более одного на неудачную попытку |
| `EVT_MAIN_PATH_CLEAR` | `path_clear` | один раз перед началом drive |
| `EVT_MAIN_DRIVE_START` | `main_drive` | один раз на уровень |
| `EVT_MAIN_REACHED_EXIT` | `exit_whoosh` | вместе с визуальной вспышкой |
| `EVT_COINS_CHANGED` | `coin_fly`; при `isFinal` — дополнительный `coin_count` | длительность синхронизировать с `coinFlyDuration` |
| `EVT_REWARD_SEQUENCE_DONE` | `level_complete` для L1 / `final_fanfare` для L2 | L1 не должна мешать немедленному старту L2 |
| CTA click | `cta_tap` | best effort до `plbx.download()` |

## 8. Приёмка

### Аудио и UX

- Все P0-звуки узнаваемы с первого прослушивания и не содержат речи, брендов, валютных терминов, casino/slot-ассоциаций или агрессивных ударов.
- `block_slide` и `block_blocked` различимы даже на телефонном динамике.
- `main_drive` не звучит как мотор/машина: главный объект по концепту — блок, а не автомобиль.
- `coin_fly` воспринимается как игровая награда и не обещает выплату/вывод средств.
- Одновременные exit/reward звуки не клиппуют и не маскируют друг друга.
- При mute от SDK или пользовательском mute ни один клип не стартует; размьют не «догоняет» уже пропущенные эффекты.

### Техническая проверка

- Импорт в Cocos без ошибок; все ссылки `AudioClip` назначены явно через inspector.
- Нет ручных `.meta`; нет `console.log` в production-коде.
- В собранном playable итоговый размер проверен против 5 MB, а размер аудио записан в чеклист релиза.
- Smoke: INTRO → свайп → попытка упрётся → путь открыт → автопроезд → exit → +9 FC → L2 → +10 FC → CTA. Все SFX срабатывают ровно в своих фазах.
- Права коммерческого использования генератора подтверждены до финальной передачи.

## 9. Риски и решения

| Риск | Решение |
|---|---|
| Генератор даёт несогласованный стиль | Держать общий словарь: `warm`, `wooden`, `casual mobile puzzle`, `clean dry mix`; генерировать v2 только с точечным изменением. |
| Аудио превышает бюджет | P0 важнее P1/P2; музыку исключить первой; оставлять только победившие версии в сборке. |
| Web/autoplay блокирует звук | Запускать после первого ввода, учитывать `plbx` mute API, тестировать в реальном контейнере. |
| Награда звучит как обещание денег | Использовать нейтральные token/chime формулировки, без слов cash/payout/win money и без слот-механики. |
| Слишком много звуков в коротком ролике | Не озвучивать декор и tutorial-loop; один чёткий сигнал на значимое действие. |

## 10. Результат этапа

После выполнения плана должен быть утверждённый набор максимум из шести P0 MP3 в `assets/audio/sfx/`, протокол выбора версий, подтверждение коммерческих прав и отдельная техническая задача на AudioController/SoundSystem, mute-кнопку и Cocos wiring.
