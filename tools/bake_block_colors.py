#!/usr/bin/env python3
"""Запекает цвет блоков из серой базы дизайнера.

Зачем: арт блоков (`block_len2/3.png`) — чистая шкала серого, т.е. яркость цветного блока.
`Sprite.color` в Cocos — это умножение, а умножение только затемняет: база арта имеет медиану
тела 197/187, поэтому до макетных 253 тинт не доходит и блок получается горчичным. Восстановить
цвет из яркости можно только операцией, которая яркость сохраняет.

Операция — gradient map «чёрный → C → белый», кусочно-линейный по серому g:

    g <= m :  out = C * (g / m)                     # тени -> к чёрному
    g >  m :  out = C + (1 - C) * (g - m)/(1 - m)   # блики -> к белому

где m — медиана серого по непрозрачному телу блока, C — целевой цвет из макета.
Свойства, которые нам и нужны:
  * при g = m выходит РОВНО C  -> тело блока совпадает с макетом до байта;
  * при g = 0 выходит 0        -> запечённая дизайнером тень (RGB=0) остаётся тенью
                                  при любом цвете, её не красит;
  * при g = 1 выходит 1        -> блик остаётся белым;
  * клиппинга практически нет  -> полный тональный диапазон сохранён
                                  (у наивного C*(g/m) в блик улетало ~20k пикселей).
Альфа копируется байт-в-байт, PNG пишется без потерь.

Запуск:  python3 tools/bake_block_colors.py
"""
import os
import sys

import numpy as np
from PIL import Image

SRC_DIR = "assets/art/blocks"
# Цвета замерены по .playbox/approved design.png (медиана тела блока).
COLORS = {
    "obst": (253, 205, 40),    # препятствие, #FDCD28
    "main": (251, 90, 120),    # главный блок, #FB5A78
}
LENGTHS = ["block_len2", "block_len3"]


def bake(src_path, target):
    src = np.array(Image.open(src_path).convert("RGBA"))
    alpha = src[..., 3]
    gray = src[..., 0].astype(np.float64) / 255.0
    body = alpha > 250
    if not body.any():
        raise SystemExit(f"{src_path}: нет непрозрачного тела")
    m = float(np.median(gray[body]))
    C = np.asarray(target, dtype=np.float64) / 255.0

    lo = C[None, None, :] * (gray / m)[..., None]
    hi = C[None, None, :] + (1.0 - C)[None, None, :] * ((gray - m) / (1.0 - m))[..., None]
    out = np.where((gray > m)[..., None], hi, lo)

    rgb = np.rint(np.clip(out, 0.0, 1.0) * 255.0).astype(np.uint8)
    baked = np.dstack([rgb, alpha])
    assert (baked[..., 3] == src[..., 3]).all(), "альфа изменилась — так быть не должно"
    return Image.fromarray(baked, "RGBA"), m, np.median(rgb[body], axis=0)


def main():
    if not os.path.isdir(SRC_DIR):
        print(f"нет папки {SRC_DIR} — запускать из корня проекта", file=sys.stderr)
        return 1
    for base in LENGTHS:
        src = os.path.join(SRC_DIR, f"{base}.png")
        for role, target in COLORS.items():
            img, m, got = bake(src, target)
            dst = os.path.join(SRC_DIR, f"{base}_{role}.png")
            img.save(dst, "PNG", optimize=True)
            ok = "OK" if tuple(int(v) for v in got) == target else "РАСХОЖДЕНИЕ"
            print(f"{dst:44s} база={m*255:.0f} тело={tuple(int(v) for v in got)} "
                  f"цель={target} [{ok}] {os.path.getsize(dst)//1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
