#!/usr/bin/env python3
"""Проверка документации: относительные ссылки, якоря и ширина ASCII-рамок.

Запуск из корня репозитория:  python3 scripts/check_docs.py
Код выхода 0 — всё в порядке, 1 — найдены проблемы (список в выводе).
Только стандартная библиотека Python.

Что проверяется во всех *.md (кроме ref/OpenD6/text/ — там текст книг):
  1. [текст](путь) — файл существует (ссылки http(s)/mailto не проверяются);
  2. [текст](путь#якорь) — в целевом файле есть заголовок с таким GitHub-slug;
  3. ASCII-макеты в блоках ``` : строки, начинающиеся с символа рамки, одной длины в символах.
Ссылки внутри `inline code` и блоков кода игнорируются.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = ("ref/OpenD6/text/", "node_modules/", "dist/", ".git/", "evals/reports/")  # отчёты evals: сгенерированные, в git не хранятся
FENCE = re.compile(r"^```.*?^```", re.S | re.M)
LINK = re.compile(r"(?<!!)\[[^\]]*\]\(([^)\s]+)\)")
FRAME_START = set("╔║╟╠╚┌│├└")


def slug(heading: str) -> str:
    """GitHub-slug заголовка: нижний регистр, без пунктуации, пробелы → дефисы."""
    h = re.sub(r"`", "", heading.strip().lower())
    h = re.sub(r"[^\w\- ]", "", h)
    return h.replace(" ", "-")


def headings(path: Path, cache: dict) -> set[str]:
    if path not in cache:
        text = FENCE.sub("", path.read_text(encoding="utf-8"))
        cache[path] = {slug(h) for h in re.findall(r"^#{1,6} (.+?)\s*#*$", text, re.M)}
    return cache[path]


def check_links(md: Path, text: str, cache: dict) -> list[str]:
    errors = []
    body = FENCE.sub("", text)
    body = re.sub(r"`[^`\n]*`", "", body)
    for m in LINK.finditer(body):
        target = m.group(1)
        if re.match(r"^(https?|mailto):", target):
            continue
        path_part, _, anchor = target.partition("#")
        dest = (md.parent / path_part).resolve() if path_part else md
        line = body[: m.start()].count("\n") + 1
        where = f"{md.relative_to(ROOT)}:{line}"
        if not dest.exists():
            errors.append(f"{where}: нет файла «{target}»")
        elif anchor and dest.suffix == ".md" and anchor not in headings(dest, cache):
            errors.append(f"{where}: нет якоря «#{anchor}» в {dest.relative_to(ROOT)}")
    return errors


def check_frames(md: Path, text: str) -> list[str]:
    errors = []
    for block in FENCE.finditer(text):
        lines = block.group(0).split("\n")[1:-1]
        framed = [l.rstrip("\n") for l in lines if l[:1] in FRAME_START]
        widths = {len(l) for l in framed}
        if len(widths) > 1:
            line = text[: block.start()].count("\n") + 1
            counts = {w: sum(1 for l in framed if len(l) == w) for w in sorted(widths)}
            errors.append(f"{md.relative_to(ROOT)}:{line}: разная ширина строк ASCII-рамки {counts}")
    return errors


def main() -> int:
    cache: dict = {}
    errors: list[str] = []
    files = sorted(p for p in ROOT.rglob("*.md") if not any(s in p.relative_to(ROOT).as_posix() for s in SKIP))
    for md in files:
        text = md.read_text(encoding="utf-8")
        errors += check_links(md, text, cache)
        errors += check_frames(md, text)
    for e in errors:
        print(e)
    print(f"{'OK' if not errors else 'Ошибок: ' + str(len(errors))} — проверено файлов: {len(files)}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
