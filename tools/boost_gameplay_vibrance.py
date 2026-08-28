#!/usr/bin/env python3
"""Поднимает насыщенность/яркость крупных фоновых поверхностей геймплея.

Зачем: пэкшот (`you_won`/`gift`/`bonus_10`, meanSat 0.56-0.85) читается "сочнее" основной игры не
потому, что блоки/кнопки блёклые — они уже яркие (`block_len2_h_obst` meanSat 0.94, `star_on` 0.87,
кнопки 0.46-0.52). Разница в том, что САМЫЕ БОЛЬШИЕ по площади поверхности геймплея — фон и плата —
пастельные (`bg_gameplay` meanSat 0.298, `Board_full` meanSat 0.319), и именно они держат общее
визуальное впечатление от сцены. Пэкшотные панели — бесподложечный акцентный арт того же дизайнера,
не крупная заливка, поэтому сравнение "на глаз" воспринимается как "пэкшот ярче".

Правим только эти две поверхности (не блоки, не UI — они уже на уровне пэкшота, трогать не нужно):
`bg_gameplay.png`, `Board_full.png`. Модель — умножение S и V в HSV, hue не трогаем (чтобы не
уехать с утверждённой палитры розово-сиреневого мармелада), только альфа-непрозрачные пиксели.
Белая сетка платы (S=0) от умножения S не меняется, V близко к 1 — потолок клампится, линия
остаётся чистым белым.

Запуск: python3 tools/boost_gameplay_vibrance.py [--sat 1.3] [--val 1.05]
"""
import argparse
import colorsys

import numpy as np
from PIL import Image

TARGETS = [
    "assets/art/bg/bg_gameplay.png",
    "assets/art/board/Board_full.png",
]


def boost(path, sat_mult, val_mult):
    im = Image.open(path).convert("RGBA")
    arr = np.array(im).astype(np.float64) / 255.0
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    hsv = np.vectorize(colorsys.rgb_to_hsv)(r, g, b)
    h, s, v = hsv
    s = np.clip(s * sat_mult, 0.0, 1.0)
    v = np.clip(v * val_mult, 0.0, 1.0)
    r2, g2, b2 = np.vectorize(colorsys.hsv_to_rgb)(h, s, v)

    out = np.dstack([r2, g2, b2, a])
    out = np.rint(np.clip(out, 0.0, 1.0) * 255.0).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(path)
    print(f"{path}: sat x{sat_mult}, val x{val_mult}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sat", type=float, default=1.3)
    ap.add_argument("--val", type=float, default=1.05)
    args = ap.parse_args()
    for path in TARGETS:
        boost(path, args.sat, args.val)


if __name__ == "__main__":
    main()
