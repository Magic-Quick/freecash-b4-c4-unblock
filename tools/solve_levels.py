#!/usr/bin/env python3
"""Проверка раскладок assets/data/levels.json.

Семантика хода — «до упора», как в BoardSystem.computeMaxShift(): свайп двигает блок
максимально далеко в направлении жеста, остановиться на полпути нельзя. Это НЕ классический
Unblock Me — числа ходов и сама решаемость отличаются, поэтому считать можно только так.

Печатает для каждого уровня: минимальное число ходов, либо что раскладка невалидна/нерешаема.
"""
import json
import os
import sys
from collections import deque

COLS = ROWS = 6


def cells(axis, length, c, r):
    return {(c + k, r) for k in range(length)} if axis == "h" else {(c, r + k) for k in range(length)}


def solve(blocks, exit_row):
    B = [("h" if b["axis"] == "horizontal" else "v", b["length"], b["col"], b["row"],
          b.get("isMain", False)) for b in blocks]
    mains = [i for i, b in enumerate(B) if b[4]]
    if len(mains) != 1:
        return f"НЕВАЛИДНО: главных блоков {len(mains)}, должен быть ровно 1"
    mi = mains[0]

    def occ(st):
        s = set()
        for b, (c, r) in zip(B, st):
            s |= cells(b[0], b[1], c, r)
        return s

    start = tuple((b[2], b[3]) for b in B)
    if len(occ(start)) != sum(b[1] for b in B):
        return "НЕВАЛИДНО: блоки наложены на старте"
    for b, (c, r) in zip(B, start):
        if any(x < 0 or x >= COLS or y < 0 or y >= ROWS for x, y in cells(b[0], b[1], c, r)):
            return "НЕВАЛИДНО: блок выходит за поле"
    if B[mi][0] != "h":
        return "НЕВАЛИДНО: главный блок должен быть горизонтальным (выход справа)"
    if B[mi][3] != exit_row:
        return f"НЕВАЛИДНО: главный блок в строке {B[mi][3]}, а выход в {exit_row}"

    def solved(st):
        c, r = st[mi]
        return r == exit_row and c + B[mi][1] - 1 == COLS - 1

    def neigh(st):
        o = occ(st)
        for i, b in enumerate(B):
            c, r = st[i]
            own = cells(b[0], b[1], c, r)
            for d in (-1, 1):
                step = 0
                while True:                              # свайп едет ДО УПОРА
                    nc, nr = (c + d * (step + 1), r) if b[0] == "h" else (c, r + d * (step + 1))
                    nx = cells(b[0], b[1], nc, nr)
                    if any(x < 0 or x >= COLS or y < 0 or y >= ROWS for x, y in nx):
                        break
                    if (nx - own) & o:
                        break
                    step += 1
                if step == 0:
                    continue
                nc, nr = (c + d * step, r) if b[0] == "h" else (c, r + d * step)
                ns = list(st)
                ns[i] = (nc, nr)
                yield tuple(ns)

    seen = {start: None}
    q = deque([start])
    while q:
        s = q.popleft()
        if solved(s):
            path = []
            while seen[s]:
                path.append(s)
                s = seen[s]
            return f"решается за {len(path)} ходов (состояний просмотрено {len(seen)})"
        for x in neigh(s):
            if x not in seen:
                seen[x] = s
                q.append(x)
    return "НЕ РЕШАЕТСЯ"


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "assets/data/levels.json"
    if not os.path.exists(path):
        print(f"нет файла: {path}", file=sys.stderr)
        return 1
    data = json.load(open(path))
    bad = 0
    for lv in data["levels"]:
        res = solve(lv["blocks"], lv["exitRow"])
        print(f"level {lv['level']}: {res}")
        if not res.startswith("решается"):
            bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
