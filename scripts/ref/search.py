#!/usr/bin/env python3
"""Поиск по извлечённому тексту книг OpenD6 со ссылками «книга p.N · глава».

  python3 scripts/ref/search.py "wild die"                 # поиск (регистр не важен, regex), книги приоритета 1–2
  python3 scripts/ref/search.py "body points" -b adventure,fantasy -C 3
  python3 scripts/ref/search.py "initiative" --all         # все книги, включая приоритет 3
  python3 scripts/ref/search.py page adventure 47          # страница целиком
  python3 scripts/ref/search.py page adventure 47-49       # диапазон страниц
  python3 scripts/ref/search.py toc fantasy                # оглавление книги
  python3 scripts/ref/search.py render fantasy 65          # PNG страницы для визуальной сверки (нужен PDF)

Текст берётся из ref/OpenD6/text/*.md (пересобрать: python3 scripts/ref/extract.py).
Только стандартная библиотека Python.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TEXT = ROOT / "ref" / "OpenD6" / "text"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract import CATALOG  # noqa: E402

PRIORITY = {slug: prio for slug, _f, _t, _w, prio, _p in CATALOG}
ORDER = [slug for slug, *_ in sorted(CATALOG, key=lambda c: c[4])]
PAGE_RE = re.compile(r"^## p\.(\d+)(?: · (.*))?$")


def load_pages(slug: str) -> list[tuple[int, str, list[str]]]:
    path = TEXT / f"{slug}.md"
    if not path.exists():
        sys.exit(f"Нет {path}. Запустите: python3 scripts/ref/extract.py")
    pages, cur = [], None
    for line in path.read_text(encoding="utf-8").splitlines():
        m = PAGE_RE.match(line)
        if m:
            cur = (int(m.group(1)), m.group(2) or "", [])
            pages.append(cur)
        elif cur is not None:
            cur[2].append(line)
    return pages


SKIP_CHAPTERS = re.compile(r"^(cover|credits|contents|index|table of contents)$", re.I)


def compile_query(q: str, case: bool, exact: bool) -> re.Pattern:
    # В извлечённом тексте иногда слипаются слова («determininghow»), поэтому пробел в запросе = \s* (кроме --exact)
    if not exact:
        q = re.sub(r"(?<!\\) +", r"\\s*", q)
    return re.compile(q, 0 if case else re.I)


def cmd_search(args: argparse.Namespace) -> int:
    books = args.books.split(",") if args.books else [s for s in ORDER if args.all or PRIORITY[s] <= 2]
    rx = compile_query(args.query, args.case, args.exact)
    total = 0
    for slug in books:
        pages = []
        for num, chap, lines in load_pages(slug):
            if not args.toc and SKIP_CHAPTERS.match(chap.strip()):
                continue
            idx = [i for i, line in enumerate(lines) if rx.search(line)]
            if not idx:
                continue
            i = idx[0]
            lo, hi = max(0, i - args.context), min(len(lines), i + args.context + 1)
            snippet = "\n    ".join(l for l in lines[lo:hi] if l.strip())
            pages.append((len(idx), num, f"  p.{num}{' · ' + chap if chap else ''}  [{len(idx)}×]\n    {snippet}"))
        if pages:
            pages.sort(key=lambda h: (-h[0], h[1]))  # сначала страницы с наибольшим числом совпадений
            print(f"== {slug}: {len(pages)} стр.")
            print("\n".join(h[2] for h in pages[: args.limit]))
            if len(pages) > args.limit:
                rest = sorted(h[1] for h in pages[args.limit:])
                print(f"  … ещё страницы: {', '.join(map(str, rest[:40]))}{' …' if len(rest) > 40 else ''}")
            total += len(pages)
    if not total:
        print("Ничего не найдено. Попробуйте синонимы (текст книг на английском), --all или regex.")
    return 0 if total else 1


def cmd_page(args: argparse.Namespace) -> int:
    lo, _, hi = args.pages.partition("-")
    lo, hi = int(lo), int(hi or lo)
    for num, chap, lines in load_pages(args.book):
        if lo <= num <= hi:
            print(f"## {args.book} p.{num}{' · ' + chap if chap else ''}\n")
            print("\n".join(lines).strip(), "\n")
    return 0


def cmd_toc(args: argparse.Namespace) -> int:
    seen = ""
    for num, chap, _ in load_pages(args.book):
        if chap and chap != seen:
            print(f"p.{num} — {chap}")
            seen = chap
    return 0


def cmd_render(args: argparse.Namespace) -> int:
    import subprocess
    import tempfile

    fname = next((f for slug, f, *_ in CATALOG if slug == args.book), None)
    pdf = ROOT / "ref" / "OpenD6" / (fname or "")
    if not fname or not pdf.exists():
        sys.exit(f"Нет PDF для {args.book}: {pdf}. PDF хранятся в git: проверьте, что клон полный (ref/OpenD6/README.md).")
    lo, _, hi = args.pages.partition("-")
    out = Path(args.out or tempfile.gettempdir()) / f"opend6-{args.book}"
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftoppm", "-png", "-r", str(args.dpi), "-f", lo, "-l", hi or lo, str(pdf), str(out)], check=True)
    for f in sorted(out.parent.glob(f"{out.name}-*.png")):
        print(f)
    return 0


def main() -> int:
    argv = sys.argv[1:]
    if argv and argv[0] in ("page", "toc", "render"):
        p = argparse.ArgumentParser(prog=f"search.py {argv[0]}")
        p.add_argument("book")
        if argv[0] == "render":
            p.add_argument("pages", help="N или N-M")
            p.add_argument("--dpi", type=int, default=100)
            p.add_argument("--out", help="каталог для PNG (по умолчанию системный temp)")
            return cmd_render(p.parse_args(argv[1:]))
        if argv[0] == "page":
            p.add_argument("pages", help="N или N-M")
            return cmd_page(p.parse_args(argv[1:]))
        return cmd_toc(p.parse_args(argv[1:]))
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("query", help="regex, регистр не важен")
    p.add_argument("-b", "--books", help="slug через запятую (см. ref/OpenD6/INDEX.md)")
    p.add_argument("--all", action="store_true", help="искать и в книгах приоритета 3")
    p.add_argument("-C", "--context", type=int, default=1, help="строк контекста (1)")
    p.add_argument("--limit", type=int, default=6, help="страниц на книгу (6)")
    p.add_argument("--case", action="store_true", help="учитывать регистр")
    p.add_argument("--exact", action="store_true", help="пробелы в запросе — буквальные (по умолчанию \\s*)")
    p.add_argument("--toc", action="store_true", help="искать и в оглавлениях/индексах книг")
    return cmd_search(p.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
