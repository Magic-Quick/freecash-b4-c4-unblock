#!/usr/bin/env python3
"""Строит пэкшот-панель и широкую CTA-кнопку из существующих UI-ассетов.

Зачем: план §4.3 №1 / Шаг 1.3 — "Пэкшот: панель + широкая кнопка «Play & Earn» —
рисуем сами (решение 0.4) — panel.png + btn_base.png как основа". Готового арта под
эти два элемента дизайнер не прислал (в approved assets/ их нет), поэтому продукт
собирается программно из уже утверждённых кусков той же кэнди-стилистики, а не
рисуется с нуля — тем самым автоматически выполняется требование ASSET_SPEC.md
"держать тот же язык форм" для сгенерированных элементов.

Источники: assets/art/ui/panel.png (332x240) и assets/art/ui/btn_base.png (164x163) —
оба глянцевые скруглённые кэнди-формы с рамкой (см. approved design.png). Оба сильно
меняют пропорции относительно нужных нам целей (панель: портретная 600x900 из
CTAOverlay/Panel; кнопка: широкая 400x120 из CTAOverlay/PlayButton, см. текущий
scene.scene) — наивный Image.resize() растянул бы скруглённые углы и рамку в овалы.

Поэтому это ручная 9-slice-нарезка (тот же принцип, что и Sprite.type=SLICED в Cocos,
только запечённая в пиксели самим ассет-мейкером, а не через border-инсеты в .meta —
их мы руками не создаём). Углы копируются как есть (без искажений), кромки тянутся
только вдоль одной оси, центр — в обе. Margin подобран по факту анализа исходников
(scan alpha/border на диагоналях) так, чтобы гарантированно захватить скруглённый
угол + кольцо рамки и не разрезать их посередине:
  panel.png:    margin=42  (радиус угла ~32-35px, рамка ~10-13px толщиной)
  btn_base.png: margin=40  (радиус угла ~32-36px, рамка ~6-9px толщиной)

Выходной размер — целевые размеры существующих нод CTAOverlay/Panel (600x900) и
CTAOverlay/PlayButton (400x120) из scene.scene, умноженные на 1.2 для чёткости на
экранах с высоким DPR без чрезмерного веса (плоские/градиентные PNG сжимаются хорошо):
  packshot_panel.png  -> 720x1080  (600x900  * 1.2)
  btn_cta_wide.png     -> 480x144  (400x120 * 1.2)

Цвет НЕ меняется — оба источника уже в кэнди pink/purple палитре макета, перекраска
не требовалась планом и не добавляется самовольно (в отличие от блоков, для которых
перекраска в §3 плана явно предписана).

Запуск: python3 tools/make_packshot_assets.py
"""
import os
import sys

from PIL import Image

UI_DIR = "assets/art/ui"

JOBS = [
    # (src, margin, target_size, dst)
    ("panel.png", 42, (720, 1080), "packshot_panel.png"),
    ("btn_base.png", 40, (480, 144), "btn_cta_wide.png"),
]


def nine_slice_resize(src: Image.Image, margin: int, target_size: tuple) -> Image.Image:
    """9-slice ресайз с сохранением угловых радиусов/рамки без искажений."""
    w, h = src.size
    tw, th = target_size
    m = margin
    if not (2 * m < w and 2 * m < h):
        raise ValueError(f"margin {m} too large for source {w}x{h}")
    if not (2 * m < tw and 2 * m < th):
        raise ValueError(f"margin {m} too large for target {tw}x{th}")

    cw, ch = tw - 2 * m, th - 2 * m  # размер центра в таргете

    src_regions = {
        "tl": (0, 0, m, m), "tm": (m, 0, w - m, m), "tr": (w - m, 0, w, m),
        "ml": (0, m, m, h - m), "mm": (m, m, w - m, h - m), "mr": (w - m, m, w, h - m),
        "bl": (0, h - m, m, h), "bm": (m, h - m, w - m, h), "br": (w - m, h - m, w, h),
    }
    dst_boxes = {
        "tl": (0, 0, m, m), "tm": (m, 0, m + cw, m), "tr": (tw - m, 0, tw, m),
        "ml": (0, m, m, m + ch), "mm": (m, m, m + cw, m + ch), "mr": (tw - m, m, tw, m + ch),
        "bl": (0, th - m, m, th), "bm": (m, th - m, m + cw, th), "br": (tw - m, th - m, tw, th),
    }

    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    for key, (rx0, ry0, rx1, ry1) in src_regions.items():
        tile = src.crop((rx0, ry0, rx1, ry1))
        bx0, by0, bx1, by1 = dst_boxes[key]
        bw, bh = bx1 - bx0, by1 - by0
        if tile.size != (bw, bh):
            tile = tile.resize((max(1, bw), max(1, bh)), Image.LANCZOS)
        out.paste(tile, (bx0, by0), tile)
    return out


def main():
    if not os.path.isdir(UI_DIR):
        print(f"нет папки {UI_DIR} — запускать из корня проекта", file=sys.stderr)
        return 1

    for src_name, margin, target, dst_name in JOBS:
        src_path = os.path.join(UI_DIR, src_name)
        dst_path = os.path.join(UI_DIR, dst_name)
        src = Image.open(src_path).convert("RGBA")
        out = nine_slice_resize(src, margin, target)
        out.save(dst_path, "PNG", optimize=True)
        print(f"{dst_path:38s} {target[0]}x{target[1]}  <- {src_name} (margin={margin})  "
              f"{os.path.getsize(dst_path) // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
