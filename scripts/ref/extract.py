#!/usr/bin/env python3
"""Извлекает текст книг OpenD6 из PDF в постраничный Markdown и собирает каталог.

Запуск из корня репозитория:  python3 scripts/ref/extract.py
Зависимости: poppler-utils (pdftotext, pdfinfo, pdftohtml). Только стандартная библиотека Python.

Результат:
  ref/OpenD6/text/<slug>.md   — полный текст, перед каждой страницей заголовок «## p.N · Глава»
  ref/OpenD6/INDEX.md         — каталог книг с оглавлениями (генерируется, руками не править)
"""
from __future__ import annotations

import html
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / "ref" / "OpenD6"
TEXT = REF / "text"

# slug, файл, название, WEG, приоритет для проекта (1 — нужна в MVP, 2 — полезна, 3 — после MVP), зачем нужна
CATALOG = [
    ("adventure", "D6_Adventure_v2.0_weg51011OGL.pdf", "D6 Adventure 2.0", "51011", 1,
     "Ядро варианта `adventure` (постапокалипсис): характеристики, навыки, бой, урон, лечение, снаряжение, шаблоны персонажей. Есть глава о магии и псионике."),
    ("fantasy", "D6_Fantasy_v1.3_weg51013OGL.pdf", "D6 Fantasy 1.3", "51013", 1,
     "Ядро варианта `fantasy` («Пограничье»): характеристики фэнтези, навыки, бой, магия, чудеса, снаряжение."),
    ("magic", "D6_Magic_weg51024OGL.pdf", "D6 Magic", "51024", 1,
     "Система магии подробно: формулы заклинаний, готовые заклинания. Источник для `spells.yaml`."),
    ("gm-screen", "D6_Gamemasters_Aid_Screen_weg51019eOGL.pdf", "D6 Gamemaster's Aid Screen", "51019", 1,
     "Сжатые справочные таблицы. Первое место для проверки чисел (сложности, дистанции, урон)."),
    ("fantasy-creatures", "D6_Fantasy_Creatures_v1.1_weg51015eOGL.pdf", "D6 Fantasy Creatures 1.1", "51015", 1,
     "Бестиарий фэнтези: статблоки для `fantasy`."),
    ("adventure-creatures", "D6_Adventure_Creatures_weg51021eOGL.pdf", "D6 Adventure Creatures", "51021", 1,
     "Бестиарий современности и мутантов: статблоки для `adventure` (постапокалипсис)."),
    ("system-book", "D6_System_Book_weg51005eOGL.pdf", "D6 System Book", "51005", 2,
     "Базовая жанронезависимая книга правил. Сверять, когда Adventure и Fantasy расходятся."),
    ("fantasy-locations", "D6_Fantasy_Locations_v1.1_weg51020OGL.pdf", "D6 Fantasy Locations 1.1", "51020", 2,
     "Локации фэнтези: идеи и правила для шаблона «Пограничье», карты, ловушки."),
    ("adventure-locations", "D6_Adventure_Locations_v1.1_weg51016eOGL.pdf", "D6 Adventure Locations 1.1", "51016", 2,
     "Локации современности: идеи для постапокалипсиса, здания, транспорт."),
    ("player-gm-guide", "D6_Player_Book_And_GM_Guide.pdf", "D6 Player Book and GM Guide", "", 2,
     "Руководство игрока и Мастера (фанатская компиляция). Советы по ведению — материал для промптов Мастера."),
    ("how-game-works", "D6_How_The_Game_Works.pdf", "D6: How the Game Works", "", 2,
     "Двухстраничное введение в механику. Хороший конспект для `promptPrimer`."),
    ("tryout-nexus-temple", "D6_Game_System_Try-Out_-_Crumbling_Nexus_Temple.pdf", "D6 Try-Out: Crumbling Nexus Temple", "", 2,
     "Короткое ознакомительное приключение. Пример сцены для evals."),
    ("legend-conversion", "D6_Legend_And_Conversion_OGL.pdf", "D6 Legend and Conversion", "", 3,
     "D6 Legend (упрощённая ветка) и конверсия между версиями D6."),
    ("space", "D6_Space_v2.0_weg51012OGL.pdf", "D6 Space 2.0", "51012", 3,
     "Ядро будущего варианта `space`."),
    ("space-aliens", "D6_Space_Aliens_1_weg51022eOGL.pdf", "D6 Space Aliens 1", "51022", 3,
     "Инопланетяне для `space`."),
    ("space-ships", "D6_Space_Ships_weg51017eOGL.pdf", "D6 Space Ships", "51017", 3,
     "Корабли для `space`. **Скан без текстового слоя**: для поиска нужен OCR."),
    ("space-opera", "D6_Space_Opera.pdf", "D6 Space Opera", "", 3,
     "Материалы space opera для `space`."),
    ("septimus", "Septimus_weg54000eOGL.pdf", "Septimus", "54000", 3,
     "Готовый sci-fi сеттинг на D6. Пример структуры сеттинга."),
    ("septimus-quickstart", "Septimus_Quickstart_weg54000_qs.pdf", "Septimus Quickstart", "54000", 3,
     "Быстрый старт Septimus."),
    ("sheet-adventure", "D6_Adventure_Character_Sheet.pdf", "D6 Adventure Character Sheet", "", 2,
     "Лист персонажа Adventure — референс для `sheetLayout`."),
    ("sheet-fantasy", "D6_Fantasy_Character_Sheet.pdf", "D6 Fantasy Character Sheet", "", 2,
     "Лист персонажа Fantasy — референс для `sheetLayout`."),
    ("sheet-space", "D6_Space_Character_Sheet.pdf", "D6 Space Character Sheet", "", 3,
     "Лист персонажа Space."),
    ("sheet-generic", "D6_Character_Sheet.pdf", "D6 Character Sheet", "", 3,
     "Универсальный лист персонажа."),
]

PRIORITY_NAMES = {1: "1 — нужна в MVP", 2: "2 — полезна", 3: "3 — после MVP"}


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True).stdout.decode("utf-8", "replace")


def outline(pdf: Path) -> list[tuple[int, str]]:
    """Закладки PDF верхнего уровня и вложенные: [(страница, заголовок)]."""
    try:
        xml = run("pdftohtml", "-xml", "-i", "-q", "-stdout", str(pdf))
    except subprocess.CalledProcessError:
        return []
    m = re.search(r"<outline>(.*)</outline>", xml, re.S)
    if not m:
        return []
    items = []
    for page, title in re.findall(r'<item page="(\d+)">(.*?)</item>', m.group(1), re.S):
        title = html.unescape(re.sub(r"<[^>]+>", "", title)).strip()
        if title:
            items.append((int(page), " ".join(title.split())))
    return items


def clean(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)  # лигатуры ﬁ → fi
    text = re.sub(r"(\w)-\n(\w)", r"\1\2", text)  # переносы «dam-\nage»
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chapter_at(toc: list[tuple[int, str]], page: int) -> str:
    current = ""
    for p, title in sorted(toc, key=lambda x: x[0]):
        if p <= page:
            current = title
        else:
            break
    return current


def extract(slug: str, pdf: Path, title: str) -> dict:
    pages = run("pdftotext", "-enc", "UTF-8", str(pdf), "-").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    toc = outline(pdf)
    empty = 0
    out = [f"# {title}\n",
           f"<!-- source: ref/OpenD6/{pdf.name} · pages: {len(pages)} · generated by scripts/ref/extract.py -->\n",
           "Open Game Content under the Open Game License v1.0a (см. страницу OGL в конце книги). "
           "Product Identity (D6 System, логотипы, арт) не используется.\n"]
    for n, raw in enumerate(pages, start=1):
        body = clean(raw)
        if len(body) < 40:
            empty += 1
        chap = chapter_at(toc, n)
        out.append(f"\n## p.{n}" + (f" · {chap}" if chap else "") + "\n\n" + (body or "_(нет текста)_") + "\n")
    (TEXT / f"{slug}.md").write_text("".join(out), encoding="utf-8")
    return {"pages": len(pages), "empty": empty, "toc": toc, "chars": sum(len(p) for p in pages)}


def main() -> int:
    TEXT.mkdir(parents=True, exist_ok=True)
    known = {f for _, f, *_ in CATALOG}
    for pdf in sorted(REF.glob("*.pdf")):
        if pdf.name not in known:
            print(f"! {pdf.name} нет в CATALOG — добавьте запись в scripts/ref/extract.py", file=sys.stderr)

    rows, tocs = [], []
    for slug, fname, title, weg, prio, purpose in CATALOG:
        pdf = REF / fname
        if not pdf.exists():
            print(f"- пропуск {fname}: файла нет", file=sys.stderr)
            continue
        info = extract(slug, pdf, title)
        print(f"+ {slug:22} {info['pages']:4} стр., без текста: {info['empty']}")
        status = "текст есть" if info["empty"] < info["pages"] * 0.3 else "**нет текста (скан/картинка)**"
        rows.append(f"| {prio} | `{slug}` | {title} | {weg or '—'} | {info['pages']} | {status} | {purpose} |")
        if info["toc"]:
            items = "\n".join(f"- p.{p} — {t}" for p, t in info["toc"])
            tocs.append(f"### `{slug}` — {title}\n\n{items}\n")
        else:
            tocs.append(f"### `{slug}` — {title}\n\n_(закладок в PDF нет)_\n")

    index = [
        "# Индекс книг OpenD6\n",
        "Сгенерировано `python3 scripts/ref/extract.py` — руками не править, правьте `CATALOG` в скрипте.",
        "Как пользоваться: [README.md](README.md). Тематическая карта: [TOPICS.md](TOPICS.md).\n",
        "Номера страниц — **страницы PDF** (как в просмотрщике), а не печатные номера книги.\n",
        "## Книги\n",
        "| Приоритет | slug | Книга | WEG | Стр. | Текст | Зачем проекту |",
        "|---|---|---|---|---|---|---|",
        *sorted(rows),
        "\nПриоритеты: " + "; ".join(PRIORITY_NAMES.values()) + ".\n",
        "## Оглавления (из закладок PDF)\n",
        *tocs,
    ]
    (REF / "INDEX.md").write_text("\n".join(index), encoding="utf-8")
    print(f"= {REF / 'INDEX.md'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
