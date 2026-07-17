# ASSET_GENERATION_PLAN — «Unblock» (Freecash B4C4)

> Production-план placeholder-ассетов для прототипа. Финальная нарезка дизайнера и официальный логотип клиента заменят временные PNG перед экспортом.

## 1. Границы, стиль и комплаенс

- **Визуальный стиль:** concept-1, классический Unblock: тёплое мультяшное дерево, фронтальный orthographic-вид, без машин, колёс и изометрии.
- **Палитра:** obstacle wood `#E0982E`; main block `#E24A3B`; cell `#6E5138`; frame `#C9A063`; background `#E8D5A8`; coin `#FFD54A`.
- **Форма:** скругление 10–20% меньшей стороны, тёмный контур 2–3 px с alpha около 0.6, верхний белый блик 20–30%. Никакой внешней размытой тени.
- **Формат:** PNG RGBA8 без потерь. Прозрачность нужна всем sprites, кроме `background.png`. Не создавать `.meta` вручную.
- **Ограничение веса:** ориентир до 1 MB на sprite и до 5 MB на финальный билд.
- **Запрещено:** `$`, другие валюты, купюры, карты, cash-out, payout, банковские элементы и слово «Баланс».
- **Разрешённая награда:** только условная золотая монета с рисованными буквами `FC`.
- **Логотип Freecash:** не генерировать, не реконструировать и не использовать AI-версию. До получения официального прозрачного PNG применять временный Cocos Label `FREE CASH` или оставить logo-node пустой. В финале использовать только клиентский `freecash_logo.png`.

## 2. Порядок работ

1. Создать и проверить board kit: `cell`, `block_tile`, `block_main`, `board_frame`.
2. Создать UI и feedback kit: `panel`, `button_play`, `coin_fc`, `exit_arrow`, `finger`, `stars`, `spark`.
3. Создать чистый центрированный фон.
4. Импортировать PNG в Cocos, назначить 9-slice borders, проверить на 720×1280.
5. Заменить placeholder-набор финальной нарезкой без изменения путей, затем повторить QA и проверку веса.

## 3. Общий prompt-модификатор

Добавлять к каждому prompt, если ниже не указано обратное:

```text
mobile casual puzzle-game UI asset, warm polished cartoon wood style, front-facing orthographic view, crisp antialiased edges, no text, no logo, no watermark, no dollar sign, no currency symbols, no banknotes, no bank cards, no payout imagery
```

Для всех transparent sprites добавить:

```text
isolated single asset, centered, full alpha transparent background, no checkerboard, no external cast shadow, no border crop
```

Для 9-slice sprites добавить:

```text
designed for 9-slice scaling: fixed undistorted rounded corners, straight even edges, simple stretchable center, no internal dividers, no slice guides
```

> Если генератор не выдаёт target size, сохранить transparent master и экспортировать в требуемый размер без обрезания контура. Генератор не должен рисовать text labels для UI.

## 4. Набор ассетов и готовые prompts

### A. Board kit

| Файл | Target | Роль | 9-slice |
|---|---:|---|---:|
| `assets/art/sprites/block_tile.png` | 96×96 | Обычные блоки, растягиваются по длине | border 24 px |
| `assets/art/sprites/block_main.png` | 96×96 | Главный блок, растягивается горизонтально | border 24 px |
| `assets/art/sprites/cell.png` | 96×96 | Повторяется в сетке 6×6 | нет |
| `assets/art/sprites/board_frame.png` | 512×512 | Рамка игрового поля | border 48 px |

#### `block_tile.png`

```text
Single square mobile puzzle UI sprite: one warm orange wooden sliding-puzzle block, color #E0982E, subtle horizontal wood-plank grain, rounded rectangular silhouette with a dark brown 2–3 px outline at 60% opacity, restrained white highlight along the upper edge, flat frontal orthographic view. Designed for 9-slice scaling: fixed undistorted rounded corners, straight even edges, simple stretchable center, no internal dividers, no slice guides. Isolated single asset, centered, full alpha transparent background, no external cast shadow, no text, no logo, no watermark, no car, no wheels, no dollar sign, no money imagery. Export target 96 by 96 pixels.
```

**Приёмка:** одинаково хорошо выглядит в 96×96, 96×192 и 96×288; центральная зона не имеет деталей, которые растянутся.

#### `block_main.png`

```text
Single square mobile puzzle UI sprite: the main sliding-puzzle block, red painted wood color #E24A3B, subtle horizontal plank grain, rounded rectangular silhouette, dark brown 2–3 px outline at 60% opacity, restrained white top-edge highlight. Match a warm casual wooden Unblock game, but no car and no wheels. Designed for 9-slice scaling: fixed undistorted rounded corners, straight even edges, simple stretchable center, no internal dividers, no slice guides. Isolated asset, centered, full alpha transparent background, no text, no logo, no watermark, no currency imagery. Export target 96 by 96 pixels.
```

**Приёмка:** выделяется только красным цветом, сохраняет стиль и контур обычного блока, не имеет автомобильного силуэта.

#### `cell.png`

```text
Single square mobile puzzle board-cell UI sprite, dark warm brown color #6E5138, slightly recessed center, rounded square, subtle inner bevel, clean flat cartoon wood-compatible finish, quiet low-contrast texture, no text. Isolated single asset, centered, full alpha transparent background, no cast shadow outside the object, no logo, no watermark, no currency symbols. Front-facing orthographic view. Export target 96 by 96 pixels.
```

**Приёмка:** 36 повторов не дают заметных швов и не конкурируют с блоками по контрасту.

#### `board_frame.png`

```text
Square mobile puzzle board frame only, light wood rim color #C9A063 around a dark brown inner recess, warm cartoon casual style matching wooden sliding blocks, rounded outer corners, dark inner outline, subtle top highlight. The center must be completely transparent and empty. Designed for 9-slice scaling: fixed undistorted corners, straight even wood edges, clean stretchable sides, no internal grid, no slice guides, no text. Full alpha transparent outside and inside the frame, no external shadow, no logo, no money imagery. Export target 512 by 512 pixels.
```

**Приёмка:** центр прозрачен, а 48 px border не содержит мелких деталей, ломающихся при растяжении.

### B. UI и feedback kit

| Файл | Target | Роль | 9-slice |
|---|---:|---|---:|
| `assets/art/ui/coin_fc.png` | 80×80 | HUD и reward instances | нет |
| `assets/art/ui/panel.png` | 320×200 | HUD и CTA-panel | border 40 px |
| `assets/art/ui/button_play.png` | 320×96 | CTA button background | border 32 px |
| `assets/art/ui/finger.png` | 80×120 | Tutorial cursor | нет |
| `assets/art/ui/star_on.png` | 48×48 | Filled HUD star | нет |
| `assets/art/ui/star_off.png` | 48×48 | Empty HUD star | нет |
| `assets/art/sprites/exit_arrow.png` | 96×96 | Exit marker | нет |
| `assets/art/sprites/spark.png` | 128×128 | Additive exit flash | нет |

#### `coin_fc.png`

```text
Single generic gold reward coin UI icon for a casual mobile puzzle game, circular and centered, bright gold #FFD54A with a darker amber rim #C8901E, crisp cartoon shading, subtle embossed hand-drawn letters “FC” only in the center. The letters are part of the illustration, not typeset text. Isolated single asset, full alpha transparent background, no external shadow, no dollar sign, no other currency symbols, no banknotes, no card, no payout or cash-out imagery, no logo, no watermark. Front-facing orthographic view. Export target 80 by 80 pixels.
```

**Приёмка:** `FC` читается при 40–80 px; отсутствуют `$` и реалистичная финансовая символика.

#### `panel.png`

```text
Rounded cream UI panel sprite for a warm casual mobile puzzle game, fill color #F3E4C6, dark warm-brown outline, restrained top highlight, empty plain center with no labels or icons. Designed for 9-slice scaling: fixed rounded corners, straight even edges, simple stretchable center, no internal dividers, no slice guides. Isolated single UI asset, full alpha transparent background outside the panel, no outside drop shadow, no text, no logo, no money imagery. Export target 320 by 200 pixels.
```

#### `button_play.png`

```text
Green primary call-to-action button background for a casual mobile puzzle game, vivid green #34C759, darker solid lower lip #1F8F3C suggesting press depth, clean white top highlight, rounded corners, no words and no icon. Designed for 9-slice scaling: fixed undistorted rounded corners, straight edges, plain stretchable center, no internal dividers, no slice guides. Isolated UI sprite with full alpha transparent background, no external drop shadow, no text, no logo, no currency or money imagery. Export target 320 by 96 pixels.
```

**Приёмка для panel/button:** Cocos Labels добавляют весь текст; borders 40 px и 32 px не деформируют углы при portrait и landscape.

#### `finger.png`

```text
Single tutorial cursor hand UI sprite, simplified friendly pointing index finger angled slightly downward, warm skin tone #F5D0A9, dark brown outline, soft flat cartoon shading, no sleeve, no jewelry, no text. Isolated single asset, centered, full alpha transparent background, no cast shadow outside object, no logo, no watermark, no money imagery. Front-facing game UI illustration. Export target 80 by 120 pixels.
```

#### `star_on.png` and `star_off.png`

```text
Single five-point HUD star icon for a warm casual puzzle game, centered, clean rounded cartoon edges, dark warm-brown outline, no text, no logo, transparent background, no shadow outside. Create a filled version in golden yellow #FFC107. Export target 48 by 48 pixels.
```

```text
Single five-point HUD star icon matching the filled gold-star silhouette exactly, centered, clean rounded cartoon edges, dark warm-brown outline, muted warm gray empty fill, no text, no logo, transparent background, no shadow outside. Export target 48 by 48 pixels.
```

**Приёмка:** обе версии имеют идентичные silhouette и origin, чтобы заменяться без сдвига.

#### `exit_arrow.png`

```text
Single right-facing double-chevron exit marker for a casual mobile sliding-puzzle game, two bold rounded chevrons pointing right, cheerful yellow-green color, dark warm-brown outline, subtle white upper highlight, clean flat cartoon UI style. Isolated single icon, centered, full alpha transparent background, no text, no logo, no watermark, no money imagery, no vehicle imagery. Export target 96 by 96 pixels.
```

#### `spark.png`

```text
Single radial starburst sparkle effect for a casual mobile game, sharp white center fading into saturated warm yellow #FFD54A and then full transparency, symmetrical 6–8 pointed burst, no hard square background, no text, no logo, no watermark. Centered on full alpha transparent canvas, additive-blend-ready, no external shadow. Export target 128 by 128 pixels.
```

**Приёмка для arrow/spark:** chevrons видны на светлом и тёмном фоне; при additive blend у spark нет прямоугольного фона.

### C. Background

| Файл | Target | Роль | Alpha |
|---|---:|---|---:|
| `assets/art/sprites/background.png` | 720×1280 | BackgroundLayer, Widget stretch all | нет |

#### `background.png`

```text
Portrait 720 by 1280 casual mobile sliding-puzzle game background, warm beige #E8D5A8 paper-like gradient, gentle centered light area behind where a square board will sit, very sparse small leaves or flower accents confined to outer corners and far edges, clean unobstructed middle 70 percent, friendly polished cartoon style, no text, no logo, no watermark, no board, no blocks, no coins, no dollar sign, no currency symbols, no banknotes, no cards, no payout imagery. Opaque full-canvas background, no transparency.
```

**Приёмка:** центральная область остаётся спокойной и контрастной для BoardFrame; важная композиция не теряется при landscape crop.

## 5. Что собирается в Cocos, а не генерируется

| Элемент | Правило |
|---|---|
| Блоки длиной 2–3 клетки | Растягивать `block_tile` и `block_main` в Sliced mode; не делать варианты на каждую длину. |
| Поле 6×6 | Создавать из `Cell.prefab` и одной растягиваемой `board_frame`. |
| Текст HUD и CTA | Cocos Label: `LEVEL`, `MOVES`, номера, `FC`, `LEVEL COMPLETE`, `PLAY & EARN`, disclaimer. |
| CTA dim | Полноэкранный Cocos Sprite или Graphics, чёрный с alpha около 0.6. |
| Монеты и tutorial | Tween-инстансы `coin_fc` и `finger`; не нужен sprite sheet. |
| Лого | Только внешний клиентский `freecash_logo.png`; до него Label или null reference. |

## 6. Импорт и контроль качества

1. Проверить пути и имена из реестра до scene wiring.
2. Проверить alpha на светлом и тёмном фоне: не допускаются белые квадраты, checkerboard или halo.
3. Задать Sprite Mode `Sliced`: blocks 24 px, frame 48 px, panel 40 px, button 32 px.
4. Проверить blocks на 96×192 и 96×288, CTA на portrait и landscape ширине.
5. Проверить контраст главного блока, стрелки, CTA и disclaimer на фоне.
6. Выполнить Freecash compliance: нет денег, `$`, банковских образов, cash-out текста или AI-лого.
7. Перед финальным export заменить placeholders, назначить официальный logo, повторить весовую проверку и smoke из `QA_CHECKLIST.md`.

## 7. Batch-порядок

### Batch A — board foundation

`block_tile` → `block_main` → `cell` → `board_frame`.

**Гейт:** собрать тестовую сетку 6×6 и подтвердить 9-slice до генерации остальных PNG.

### Batch B — UI и feedback

`panel` → `button_play` → `coin_fc` → `exit_arrow` → `finger` → `star_on`/`star_off` → `spark`.

**Гейт:** проверить читаемость и отсутствие запрещённой финансовой символики.

### Batch C — environment и final replacement

`background` → внешний `freecash_logo.png` → финальная нарезка дизайнера.

**Гейт:** проверить portrait/landscape, вес и итоговый compliance перед Phase 7 QA.

## 8. Внешние зависимости

- Финальная нарезка placeholder-ассетов: `OPEN_ISSUES.md` #1.
- Официальный прозрачный Freecash logo: `OPEN_ISSUES.md` #2.
- Этот документ не создаёт звук; его источник и коммерческие права ведутся отдельно: GDD §6 и `OPEN_ISSUES.md` #3.
