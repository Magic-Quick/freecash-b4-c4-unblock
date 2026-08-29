# AUDIO_GENERATION_PLAN — «Unblock» (Freecash B4C4)

> Актуализированный после candy-reskin план производства музыки и SFX через `generate_audio` (ElevenLabs).

## 1. Цель, границы и ограничения

### Цель

Собрать единый звук для нового glossy candy-cloud визуала. Эмоциональная дуга: лёгкое любопытство → приятное скольжение конфетных тайлов → воздушный подъём при открытом пути → яркая, но не «казиношная» награда → CTA.

### Общая тема: Candy Cloud Puzzle Pop

- **Характер:** воздушный, сладкий, глянцевый, оптимистичный, современный mobile casual; не детская шкатулка и не слот-машина.
- **Музыкальная палитра:** airy synth plucks, soft glassy mallets, gentle pizzicato, rounded bass, tiny shaker, light hand percussion, restrained sparkle accents.
- **SFX-палитра:** мягкий gummy/gel glide, округлый plastic-candy tap, bubble pop, короткий sugar sparkle, воздушный whoosh.
- **Общий мотив:** восходящее мажорное движение; для музыкальных сигналов ориентир D major и ноты D–F#–A. Точное попадание AI-SFX в высоту не является блокером, важнее единый тембр.
- **Запрещённая палитра:** wood friction/clack, тяжёлые барабаны, агрессивный EDM drop, цирковая/детская музыка, оркестровая фанфара, cash-register, casino/slot/jackpot associations.

### Границы первого аудиопрохода

- Музыка становится P0 частью рескина. Существующие шесть SFX считаются pre-reskin кандидатами: их тайминги пригодны, но деревянный тембр нужно заменить в отдельном v2-проходе.
- Никакой речи, вокала, слов, названий брендов, денежных терминов или звуков слот-машины/казино.
- Звуки должны быть пригодны для коммерческого использования. До финального экспорта подтвердить лицензию/права выбранного генератора и сохранить ссылку на условия, дату и аккаунт-источник в задаче/релизной карточке.
- Ориентир общего размера playable — **до 5 MB** (GDD §10). Цель полного reskin-прохода — не более **550 KB** аудио: 24 s gameplay-музыки ≈ 384 KB, 4.5 s packshot-sting ≈ 72 KB и текущие шесть SFX ≈ 59 KB. Каждую дополнительную версию после выбора исключать из финального билда.
- Формат генерации: `mp3_44100_128`. Инструмент принимает SFX от 0.5 s: для более короткого по ощущению UI-сигнала генерировать 0.5 s с быстрой атакой и затуханием, а не указывать недопустимую длительность. При необходимости оптимизации финального билда перекодировать после прослушивания только если это разрешено экспортным пайплайном; оригиналы не перезаписывать.
- Пути: `assets/audio/sfx/<kebab-case-name>-vN.mp3` и `assets/audio/music/<kebab-case-name>-vN.mp3`. Версии не затирать: это позволяет A/B-сравнение.

## 2. Текущий технический контракт

- В проекте подключены шесть pre-reskin P0 SFX в `assets/audio/sfx/`: `block-slide`, `block-blocked`, `path-clear`, `main-drive`, `exit-whoosh`, `coin-fly`.
- `SoundSystem` уже воспроизводит их по доменным событиям через `AudioSource.playOneShot` и учитывает mute Playbox SDK.
- `EVT_PLAY_SOUND` остаётся в публичном контракте, но текущий `SoundSystem` сознательно слушает доменные события напрямую. Views не должны знать имена аудиоклипов.
- Воспроизведение обязано уважать `plbx.is_muted()`, `plbx.on_mute_change()` и явную кнопку mute/unmute (OPEN_ISSUES #9). Звук и музыка не должны запускаться до разрешённого браузером пользовательского ввода.

## 3. Реестр SFX первого релиза

| ID для будущего `EVT_PLAY_SOUND` | Файл-кандидат | Событие/момент | Целевая длина | Приоритет |
|---|---|---|---:|---|
| `block_slide` | `assets/audio/sfx/block-slide-v2.mp3` | успешный `EVT_BLOCK_MOVED` | 0.35–0.50 s | P0 |
| `block_blocked` | `assets/audio/sfx/block-blocked-v2.mp3` | `EVT_BLOCK_BLOCKED`, не чаще одного на действие | 0.50 s | P0 |
| `path_clear` | `assets/audio/sfx/path-clear-v2.mp3` | финальное освобождение пути / `EVT_MAIN_PATH_CLEAR` | 0.45–0.65 s | P0 |
| `main_drive` | `assets/audio/sfx/main-drive-v2.mp3` | `EVT_MAIN_DRIVE_START`; синхронно с `mainDriveDuration` 0.7 s | 0.65–0.80 s | P0 |
| `exit_whoosh` | `assets/audio/sfx/exit-whoosh-v2.mp3` | `EVT_MAIN_REACHED_EXIT` + flash | 0.50 s | P0 |
| `coin_fly` | `assets/audio/sfx/coin-fly-v2.mp3` | `EVT_COINS_CHANGED`, соответствует `coinFlyDuration` 0.6 s | 0.50–0.70 s | P0 |
| `coin_count` | `assets/audio/sfx/coin-count-v2.mp3` | финальный tick/подсветка счётчика | 0.50 s | P1 |
| `level_complete` | `assets/audio/sfx/level-complete-v2.mp3` | только после `EVT_REWARD_SEQUENCE_DONE` на L1 | 0.70–1.00 s | P1 |
| `final_fanfare` | `assets/audio/sfx/final-fanfare-v2.mp3` | резервный вариант для финальных 19 FC / CTA | 1.20–1.80 s | P1 |
| `cta_tap` | `assets/audio/sfx/cta-tap-v2.mp3` | нажатие Play & Earn до `plbx.download()` | 0.50 s | P2 |

**Правило приоритета:** сначала сделать и проверить P0. P1 добавлять только если размер и микс P0 проходят QA; P2 необязателен, поскольку переход в стор может оборвать звук.

## 4. Готовые prompts для `generate_audio`

Промпты оставлены на английском: так предсказуемее контролируется SFX-модель. Во всех вариантах избегать слов `cash`, `money`, `jackpot`, `slot`, `casino`, названий артистов и чужих брендов.

### P0 — основной feedback

| Файл | Prompt | Параметры инструмента |
|---|---|---|
| `block-slide-v2.mp3` | `Short tactile glossy candy puzzle tile sliding across a smooth frosted board, soft gummy gel swish with a tiny rounded pop at the stop, pastel candy-cloud mobile game, clean dry mix, no wood, no squeak, no music, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.85` |
| `block-blocked-v2.mp3` | `Very short muted gummy candy tile bump against a soft board edge, rounded plastic-candy tap, satisfying and gentle, pastel casual mobile UI, no wood clack, no metallic ring, no music, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |
| `path-clear-v2.mp3` | `Bright subtle puzzle discovery chime, two rising soft glassy mallet notes with a tiny bubble sparkle, glossy candy-cloud mobile game, optimistic and compact, D major feeling, no fanfare, no casino, no voice` | `type: sfx`, `duration_seconds: 0.55`, `prompt_influence: 0.82` |
| `main-drive-v2.mp3` | `A glossy pink candy puzzle tile gliding confidently to the right, smooth gummy swish rising gently in pitch and resolving with a soft bubble pop, pastel candy-cloud mobile game, no wood, no engine, no car, no voice` | `type: sfx`, `duration_seconds: 0.75`, `prompt_influence: 0.85` |
| `exit-whoosh-v2.mp3` | `Short airy candy-cloud exit whoosh with a soft sugar sparkle burst, glossy pastel casual puzzle success feedback, clean, light and rounded, no explosion, no casino, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.82` |
| `coin-fly-v2.mp3` | `A small cluster of generic golden game tokens floating upward through a candy-cloud UI, delicate glassy plucks and soft sparkle with one rounded final ping, friendly casual puzzle game, no cash register, no slot machine, no casino, no voice` | `type: sfx`, `duration_seconds: 0.6`, `prompt_influence: 0.85` |

### P1/P2 — полировка

| Файл | Prompt | Параметры инструмента |
|---|---|---|
| `coin-count-v2.mp3` | `Single crisp candy-cloud UI count tick, one tiny soft glassy pluck with a rounded sparkle tail, glossy pastel mobile puzzle, clean and restrained, no cash register, no casino, no music bed, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |
| `level-complete-v2.mp3` | `Short glossy candy puzzle level-complete sting, three ascending airy synth plucks and soft glassy mallet notes with a D-major feeling, playful and restrained, clean modern mobile mix, no brass, no casino, no vocals` | `type: sfx`, `duration_seconds: 0.85`, `prompt_influence: 0.82` |
| `final-fanfare-v2.mp3` | `Short celebratory candy-cloud puzzle fanfare, airy synth plucks, soft glassy mallets and one gentle sugar sparkle, confident D-major feeling but restrained, polished mobile-game mix, no brass, no orchestra, no cash register, no casino, no vocals` | `type: sfx`, `duration_seconds: 1.5`, `prompt_influence: 0.82` |
| `cta-tap-v2.mp3` | `Very short glossy gummy UI button press, soft rounded candy pop with a clean upbeat confirmation pluck, pastel casual mobile game, no hard click, no cash register, no voice` | `type: sfx`, `duration_seconds: 0.5`, `prompt_influence: 0.9` |

## 5. Порядок генерации и отбор

1. Утвердить словарь `Candy Cloud Puzzle Pop` и не смешивать его с прежней wooden-палитрой.
2. Сгенерировать gameplay-кандидат `candy-cloud-puzzle-loop-v1.mp3` и packshot-кандидат `candy-cloud-packshot-sting-v1.mp3` по §6.
3. Сначала слушать каждый трек отдельно, затем проверить переход `gameplay loop → reward → packshot sting`.
4. Если направление верное, сгенерировать шесть SFX v2 из §4. Старые v1 не перезаписывать.
5. Прослушать последовательность `block_slide → block_blocked → path_clear → main_drive → exit_whoosh → coin_fly` поверх gameplay-музыки.
6. Для неудовлетворительных вариантов менять только одно свойство prompt: атаку, плотность, длину или один инструмент.
7. После A/B выбрать по одному файлу каждого ID и два музыкальных файла; проигравшие версии убрать из финального импорта/билда.
8. P1/P2 генерировать только после прохождения P0 по миксу и размеру. Отдельный `final_fanfare` не нужен, если packshot-sting уже выполняет эту функцию.

### Быстрые итерации prompt

- Слишком резкий/громкий звук: добавить `soft attack, restrained, lower intensity`.
- Слишком «металлический»: добавить `soft gummy, rounded, muted, no metallic ring`.
- Слишком похож на казино: добавить `no casino, no slot machine, no jackpot` и заменить `coins` на `generic gold game tokens`.
- Звук слишком длинный: уменьшить `duration_seconds`; не обрезать атаку так, чтобы пропал распознаваемый момент действия.
- Нечитаемое окончание движения: добавить `gentle stop` / `clean resolution`.

## 6. Музыка P0

Музыкальная система состоит из двух связанных файлов: циклической фоновой мелодии gameplay и короткого one-shot sting для пэкшота. Оба используют D major, 120 BPM, airy synth plucks, glassy mallets и один восходящий трёхнотный мотив. Это создаёт узнаваемость без буквального повторения одной записи.

### 6.1 Gameplay background melody

- Файл: `assets/audio/music/candy-cloud-puzzle-loop-v1.mp3`.
- Назначение: тихий gameplay-слой после первого user gesture; не конкурирует с gummy-slide и reward-sparkle.
- Длина: **24 s**, instrumental, 120 BPM, D major. Это 12 тактов 4/4 и ≈384 KB при 128 kbps.
- Структура: 0–8 s основной мотив; 8–16 s лёгкий подъём/добавление sparkle; 16–24 s снятие слоёв и возврат к стартовому груву без финального аккорда.
- Prompt: `Instrumental seamless-loop-friendly background music for a glossy pastel candy-cloud casual mobile sliding puzzle. Bright, playful, optimistic and focused rather than childish. Airy synth plucks, soft glassy mallets, gentle pizzicato, rounded bass, tiny shaker and light hand percussion, subtle candy sparkle accents. 120 BPM, D major, low intensity, clean modern mobile-game production, simple memorable motif, steady energy, no dramatic intro, no hard ending, no vocals, no choir, no orchestral fanfare, no casino or slot-machine character, no heavy drums, and plenty of frequency space for tactile UI sound effects.`
- Если v1 слишком «детский»: в v2 убрать `glassy mallets`, усилить `soft synth plucks`, больше ничего не менять.
- Если v1 слишком электронный: в v2 заменить `airy synth plucks` на `soft felt mallets`, больше ничего не менять.
- Loop seam проверять в наушниках и на телефоне минимум на трёх повторениях. При заметном стыке вариант отклонить, не маскировать громким SFX.

Бесплатный composition plan утверждён как две фазы по 12 секунд:

1. **Loop Phase A:** основной synth-pluck мотив, glassy mallets, pizzicato и rounded bass.
2. **Loop Phase B:** добавляются tiny shaker, light hand percussion и лёгкая вариация мотива; конец возвращает плотность к старту без cadence.

### 6.2 Packshot / CTA sting

- Файл: `assets/audio/music/candy-cloud-packshot-sting-v1.mp3`.
- Назначение: one-shot в момент появления CTAOverlay; заменяет отдельную финальную фанфару и не зацикливается.
- Длина: **4.5 s**, instrumental, 120 BPM, D major; ориентировочный вес ≈72 KB.
- Структура: немедленный bright pickup → восходящий трёхнотный мотив → мягкий уверенный D-major cadence → один restrained sugar-sparkle на финале.
- Prompt: `Short instrumental packshot and CTA musical sting matching a glossy pastel candy-cloud casual mobile puzzle. Continue the same D-major sonic identity as the gameplay music: airy synth plucks, soft glassy mallets, gentle pizzicato and one restrained sugar-sparkle accent. Immediate bright pickup, confident three-note ascending motif, then a warm clean resolution that makes the green Play and Earn button feel inviting. 120 BPM, polished modern mobile-game production, celebratory but restrained, no vocals, no choir, no brass fanfare, no cash-register sound, no casino or slot-machine character, no dramatic trailer impact, no childish nursery-music feel.`
- Если sting слишком «победный» или казиношный: убрать sparkle, добавить `gentle, understated, no reward jingle`, не менять мотив и инструменты.
- Если CTA не получает акцента: усилить только `immediate bright pickup` и сократить атаку, не добавлять brass/impact.

Бесплатный composition plan: одна секция 4.5 s — immediate pickup, ascending motif, soft mallet/pizzicato cadence, один sparkle-акцент.

### 6.3 Переход и микс

- Gameplay-музыка стартует только после первого user gesture.
- При входе в CTA gameplay-loop плавно уходит за **0.20–0.25 s**, затем packshot-sting играет один раз с начала.
- Не складывать packshot-sting с `final_fanfare`: используется что-то одно; предпочтителен packshot-sting.
- Финальный `coin_fly` можно оставить под первой атакой sting, но его уровень должен быть ниже музыкального мотива и без клиппинга.
- После окончания 4.5 s пэкшот остаётся без фонового loop: CTA продолжает читаться, а пользователь не слышит короткий повторяющийся джингл.

**Микс-правило:** music должна быть существенно тише SFX; на reward/exit допустимо краткое ducking или отсутствие музыкального слоя. Автовоспроизведение и mute обязательно сверить с Playbox SDK.

## 7. Обновление подключения в Cocos

1. Импортировать утверждённые MP3, проверить, что Cocos создал meta-файлы сам.
2. Переназначить шесть `@property` ссылок `SoundSystem` с v1 на утверждённые v2, не меняя событий и таймингов.
3. Добавить отдельный looped `AudioSource` для gameplay-музыки и one-shot источник/clip для packshot-sting: старт gameplay после первого user gesture, fade при CTA, синхронизация с SDK и пользовательским mute, без «догоняющего» воспроизведения.
4. Стартовая громкость для настройки: music 0.20–0.25, movement SFX 0.45–0.55, reward SFX 0.65–0.75; финальные значения утверждаются на телефонном динамике, не по цифрам.
5. Сохранить действующие throttle для `block_blocked` и `block_slide`, чтобы быстрые свайпы не складывали клипы в шум.
6. Добавить/проверить видимую кнопку `sound_on/sound_off` согласно OPEN_ISSUES #9; она не заменяет реакцию на mute рекламного контейнера.
7. Прогнать музыку, SFX и mute в Preview и целевых сетевых сборках.

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
| Генератор даёт несогласованный стиль | Держать общий словарь: `glossy candy`, `soft gummy`, `glassy`, `airy`, `pastel casual mobile puzzle`, `clean mix`; генерировать следующую версию только с точечным изменением. |
| Аудио превышает бюджет | P0 важнее P1/P2; музыку исключить первой; оставлять только победившие версии в сборке. |
| Web/autoplay блокирует звук | Запускать после первого ввода, учитывать `plbx` mute API, тестировать в реальном контейнере. |
| Награда звучит как обещание денег | Использовать нейтральные token/chime формулировки, без слов cash/payout/win money и без слот-механики. |
| Слишком много звуков в коротком ролике | Не озвучивать декор и tutorial-loop; один чёткий сигнал на значимое действие. |

## 10. Результат этапа

После выполнения reskin-прохода должны быть утверждены один 24-секундный gameplay-loop, один 4.5-секундный packshot-sting и максимум шесть согласованных candy-SFX, протокол A/B, подтверждение коммерческих прав, рабочий mute и проверенный итоговый вес.

### Статус: §7 (Cocos wiring) выполнен

Все шесть P0 клипов на месте (`assets/audio/sfx/*-v1.mp3`, 112 KB суммарно). `SoundSystem` реализован по
таблице из §7 — прямая подписка на доменные `EVT_BLOCK_MOVED`/`EVT_BLOCK_BLOCKED`/`EVT_MAIN_PATH_CLEAR`/
`EVT_MAIN_DRIVE_START`/`EVT_MAIN_REACHED_EXIT`/`EVT_COINS_CHANGED`, `AudioSource.playOneShot` (не
интерферирует с одновременными клипами), throttle на `block_slide`/`block_blocked` через новые
`GameConfig.sfxBlockSlideMinInterval`/`sfxBlockBlockedMinInterval`, гейт на `Playbox.is_muted()`/
`is_audio()`. `EVT_PLAY_SOUND` остался в контракте неиспользуемым (см. `events.ts`) — сознательно, план
явно предпочитал прямую подписку. Не сделано: P1/P2-клипы (не генерировались), mute-кнопка (OPEN_ISSUES #9),
подтверждение коммерческой лицензии генератора, ручной прогон в Preview со звуком. См. `OPEN_ISSUES.md`
секцию «Звук» за деталями.

### Статус: music reskin candidates сгенерированы 2026-08-29

- `assets/audio/music/candy-cloud-puzzle-loop-v1.mp3` — 24.00 s, 384,984 bytes, stereo MP3 44.1 kHz / 128 kbps, mean −26.9 dB, peak −4.8 dB.
- `assets/audio/music/candy-cloud-packshot-sting-v1.mp3` — 4.48 s, 72,768 bytes, stereo MP3 44.1 kHz / 128 kbps, mean −26.9 dB, peak −7.7 dB.
- Суммарно два музыкальных файла ≈447 KB; вместе с шестью текущими SFX ≈506 KB, что проходит целевой лимит 550 KB.
- Из-за текущей валидации music-endpoint gameplay-кандидат создан fallback-режимом SFX с `loop: true`; перед интеграцией обязательны субъективная проверка музыкальности и seam на трёх повторах.
- Packshot-sting создан как короткий musical SFX, что соответствует его one-shot назначению.

### Статус: полный reskin SFX-набор сгенерирован 2026-08-29

- Созданы все десять файлов `assets/audio/sfx/*-v2.mp3`: шесть P0, `coin-count`, `level-complete`, резервный `final-fanfare` и `cta-tap`.
- Суммарный размер десяти v2 SFX — 115,794 bytes; длительности соответствуют реестру: 0.48–1.48 s.
- Production selection: две music-дорожки + девять используемых v2 SFX без резервного `final-fanfare` = 548,843 bytes, то есть проходит целевой лимит 550 KB.
- `final-fanfare-v2.mp3` хранится только как A/B-резерв и не должен попадать в один билд вместе с `candy-cloud-packshot-sting-v1.mp3`.
- Новые MP3 физически находятся в проекте; Cocos Asset Database ещё не создала для bulk-generated v2 клипов `.meta`. Требуется штатный Refresh/Reimport в Creator, ручное создание `.meta` запрещено.
- Перед wiring обязательны ручное прослушивание полного gameplay flow, проверка различимости `block_slide`/`block_blocked`, отсутствие casino-ассоциаций и проверка loop seam.

### Статус: v2-набор подключен в Cocos, 2026-08-29

- Cocos Editor пересканировал проект (открыт всё это время) — `.meta` на все 10 `*-v2.mp3` и на новый `MusicSystem.ts` созданы автоматически, без ручного вмешательства.
- Пять P0 SFX-ссылок `SoundSystem` переключены с v1 на v2 через MCP `apply_edits` (`blockSlideClip`/`blockBlockedClip`/`pathClearClip`/`mainDriveClip`/`exitWhooshClip`) — события/тайминги/throttle не менялись. `coin_fly` не переносился: `EVT_COINS_CHANGED` и вся `RewardSystem`-ветка вырезаны решением владельца (`OPEN_ISSUES.md` #5) ещё до этого прохода, звуку награды подписываться не на что.
- Новый `Systems/MusicSystem.ts` + нода `Systems/MusicSystem` (дети `Loop`/`Sting`, каждый — свой `AudioSource`) реализуют §6/§7: looped gameplay-музыка (`candy-cloud-puzzle-loop-v1.mp3`, volume 0.22) стартует на первый `EVT_TAP` (тот же жест, что уже анлочит `Playbox.tap()`), гейт на `Playbox.is_muted()`/`is_audio()` как и у `SoundSystem`; на `EVT_REQUEST_CTA` loop уходит fade-out 0.22 s и включается one-shot packshot-sting (`candy-cloud-packshot-sting-v1.mp3`, volume 0.7) — loop после этого не возобновляется (CTA терминальна). `validate_document` — 0 ошибок; `plbx-cocos-typecheck` — 0 ошибок.
- Суммарный вес подключённых аудио-ассетов (5 SFX v2 + 2 музыкальных) — **494.2 KB**, укладывается в целевые 550 KB.
- Сознательно не подключено: `coin-count-v2`/`level-complete-v2`/`final-fanfare-v2` — сироты без событий-триггеров после удаления reward-ветки, отдельного места в новом флоу под них нет; `cta-tap-v2` — остаётся P2/best-effort по самому плану (§3, §5 п.8), не подключен, чтобы не изобретать новый `EVT_*` под единственный вызов. Файлы `*-v1.mp3` (SFX) и упомянутые P1/P2 v2-клипы остаются на диске как A/B-архив (§1: версии не затирать) — Cocos не бандлит несвязанные ассеты в билд (`find_asset_references` подтвердил 0 ссылок на v1), поэтому вес билда не растёт.
- Не проверено вручную: полный прогон в Preview со звуком (нужен реальный user gesture в браузере), loop seam на телефонном динамике, финальные значения громкости "на слух".
