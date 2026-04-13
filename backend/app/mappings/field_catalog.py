"""
Field Catalog — Static registry of data fields for template-driven input.

Each entry has:
  - id: Dot-notation unique identifier
  - label: Display name
  - category: Hierarchical path for the Cascader UI
  - sheet_hint: Target Excel sheet name

Functions:
  - get_field_catalog(): Full flat list
  - get_field_by_id(): Single lookup
  - get_catalog_tree(): Nested tree for Cascader UI
"""

from typing import Optional

SHEET_MONTHLY = "Monthly Statistics"
SHEET_PROGRAMS = "Program Details"

MONTHS = [
    ("jan", "January"), ("feb", "February"), ("mar", "March"),
    ("apr", "April"), ("may", "May"), ("jun", "June"),
    ("jul", "July"), ("aug", "August"), ("sep", "September"),
    ("oct", "October"), ("nov", "November"), ("dec", "December"),
]

_CATALOG: list[dict] = []


def _add(field_id: str, label: str, category: list[str], sheet_hint: str):
    _CATALOG.append({
        "id": field_id,
        "label": label,
        "category": category,
        "sheet_hint": sheet_hint,
    })


def _build_catalog():
    if _CATALOG:
        return

    ms = "Monthly Statistics"

    for month_key, month_label in MONTHS:
        _add(
            f"visitors.adult.{month_key}",
            f"Visitors (Adult) — {month_label}",
            [ms, "Visitors", "Adult", month_label],
            SHEET_MONTHLY,
        )
        _add(
            f"visitors.child.{month_key}",
            f"Visitors (Child) — {month_label}",
            [ms, "Visitors", "Child", month_label],
            SHEET_MONTHLY,
        )
        _add(
            f"books.loaned.{month_key}",
            f"Books Loaned — {month_label}",
            [ms, "Books", "Loaned", month_label],
            SHEET_MONTHLY,
        )
        _add(
            f"books.returned.{month_key}",
            f"Books Returned — {month_label}",
            [ms, "Books", "Returned", month_label],
            SHEET_MONTHLY,
        )
        _add(
            f"programs.held.{month_key}",
            f"Programs Held — {month_label}",
            [ms, "Programs", "Held", month_label],
            SHEET_MONTHLY,
        )

    _add("visitors.adult.total", "Visitors (Adult) — Total", [ms, "Visitors", "Adult", "Total"], SHEET_MONTHLY)
    _add("visitors.child.total", "Visitors (Child) — Total", [ms, "Visitors", "Child", "Total"], SHEET_MONTHLY)
    _add("books.loaned.total", "Books Loaned — Total", [ms, "Books", "Loaned", "Total"], SHEET_MONTHLY)
    _add("books.returned.total", "Books Returned — Total", [ms, "Books", "Returned", "Total"], SHEET_MONTHLY)
    _add("programs.held.total", "Programs Held — Total", [ms, "Programs", "Held", "Total"], SHEET_MONTHLY)

    pd = "Program Details"

    programs = [
        ("reading_club", "Reading Club"),
        ("story_time", "Story Time"),
        ("book_fair", "Book Fair"),
    ]
    for prog_key, prog_label in programs:
        _add(
            f"program.{prog_key}.sessions",
            f"{prog_label} — Sessions",
            [pd, prog_label, "Sessions"],
            SHEET_PROGRAMS,
        )
        _add(
            f"program.{prog_key}.participants",
            f"{prog_label} — Participants",
            [pd, prog_label, "Participants"],
            SHEET_PROGRAMS,
        )

    _add("program.total.sessions", "Total Sessions", [pd, "Total", "Sessions"], SHEET_PROGRAMS)
    _add("program.total.participants", "Total Participants", [pd, "Total", "Participants"], SHEET_PROGRAMS)


_build_catalog()


def get_field_catalog() -> list[dict]:
    return _CATALOG


def get_field_by_id(field_id: str) -> Optional[dict]:
    for entry in _CATALOG:
        if entry["id"] == field_id:
            return entry
    return None


def get_catalog_tree() -> list[dict]:
    root: list[dict] = []

    for entry in _CATALOG:
        node = root
        parts = entry["category"]
        for i, part in enumerate(parts):
            found = None
            for child in node:
                if child["label"] == part:
                    found = child
                    break
            if found is None:
                found = {"label": part, "value": part, "children": []}
                node.append(found)
            if i == len(parts) - 1:
                found["children"].append({
                    "label": entry["label"],
                    "value": entry["id"],
                })
            else:
                node = found["children"]

    return root
