#!/usr/bin/env python3
"""Рисует сетку 6x6 поверх `Board_full.png` по геометрии из `GameConfig.ts`.

Зачем: автор убрал старую запечённую сетку с `Board_full.png` (была невыразительной и не
совпадала с тем, где реально останавливаются блоки — GameConfig.colPitch/rowPitch считают
РАВНОМЕРНЫЙ шаг из inner rect, а старые линии на текстуре были нарисованы неравномерно).
Новые линии кладутся ровно на границы ячеек, которые использует рантайм, — расхождений
"сетка vs блоки" больше не будет по построению.

Геометрия (числа — те же, что в `assets/scripts/Core/GameConfig.ts`, дублировать формулы
безопасно: это одноразовый build-tool, а не рантайм-код, GameConfig остаётся source of truth):
  boardInnerLeft/Top/Right/Bottom = 32/29/663/649 px текстуры, gridCols/gridRows = 6/6.
  colPitch = (663-32)/6 ≈ 105.17 px, rowPitch = (649-29)/6 ≈ 103.33 px.

Линии — только ВНУТРЕННИЕ границы ячеек (5 вертикальных + 5 горизонтальных, i=1..5).
Внешний периметр inner rect не дублируется линией: он уже промаркирован рамкой платы
(тёмный рант в самом арте, см. замеры пикселей вокруг x=32/663, y=29/649) — линия поверх
рамки только замусорила бы её, ничего не добавляя к читаемости.

Цвет — чистый белый (255,255,255), непрозрачный в теле линии; сглаживание на краях линии
делается только альфой (суперсэмплинг), это не меняет сам цвет.

Запуск: python3 tools/draw_board_grid.py
"""
from PIL import Image, ImageDraw

SRC = "assets/art/board/Board_full.png"

BOARD_INNER_LEFT = 32
BOARD_INNER_TOP = 29
BOARD_INNER_RIGHT = 663
BOARD_INNER_BOTTOM = 649
GRID_COLS = 6
GRID_ROWS = 6

LINE_WIDTH = 3.0  # px текстуры, супersample x4 ниже даёт сглаженный край при этой толщине
SUPERSAMPLE = 4
WHITE = (255, 255, 255, 255)


def col_pitch():
    return (BOARD_INNER_RIGHT - BOARD_INNER_LEFT) / GRID_COLS


def row_pitch():
    return (BOARD_INNER_BOTTOM - BOARD_INNER_TOP) / GRID_ROWS


def main():
    base = Image.open(SRC).convert("RGBA")
    w, h = base.size

    hi = Image.new("RGBA", (w * SUPERSAMPLE, h * SUPERSAMPLE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hi)
    lw = LINE_WIDTH * SUPERSAMPLE

    cp, rp = col_pitch(), row_pitch()
    for i in range(1, GRID_COLS):
        x = (BOARD_INNER_LEFT + i * cp) * SUPERSAMPLE
        draw.line([(x, BOARD_INNER_TOP * SUPERSAMPLE), (x, BOARD_INNER_BOTTOM * SUPERSAMPLE)], fill=WHITE, width=round(lw))
    for j in range(1, GRID_ROWS):
        y = (BOARD_INNER_TOP + j * rp) * SUPERSAMPLE
        draw.line([(BOARD_INNER_LEFT * SUPERSAMPLE, y), (BOARD_INNER_RIGHT * SUPERSAMPLE, y)], fill=WHITE, width=round(lw))

    grid = hi.resize((w, h), Image.LANCZOS)
    out = Image.alpha_composite(base, grid)
    out.save(SRC)
    print(f"grid drawn: {w}x{h}, colPitch={cp:.3f} rowPitch={rp:.3f} lineWidth={LINE_WIDTH}px -> {SRC}")


if __name__ == "__main__":
    main()
