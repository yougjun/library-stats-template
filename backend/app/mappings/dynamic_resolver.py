"""
Dynamic Cell Mapping Resolver — Loads cell mappings from the database
(Settings table) and provides lookup methods for the ExcelGenerator.

Falls back gracefully: if no DB mappings exist, has_db_mappings is False
and the caller should use the hardcoded Python mapping flow.

DB storage format (Settings.value JSON):
{
    "version": 1,
    "mappings": {
        "Monthly Statistics!B3": "visitors.adult.jan",
        ...
    }
}
"""

import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class CellMappingResolver:
    def __init__(self, db: Session, template_type: str = "current"):
        self._db = db
        self._mappings: dict[str, str] = {}
        self._reverse: dict[str, tuple[str, str]] = {}
        self.has_db_mappings = False

        key = f"cell_mappings_{template_type}"
        from app import models
        row = db.query(models.Settings).filter(models.Settings.key == key).first()

        if row and row.value:
            data = row.value if isinstance(row.value, dict) else json.loads(row.value)
            raw = data.get("mappings", {})
            if raw:
                self._mappings = raw
                self.has_db_mappings = True
                self._build_reverse_index()
                logger.info(f"[CellMappingResolver] loaded {len(raw)} mappings for '{key}'")
            else:
                logger.debug(f"[CellMappingResolver] key '{key}' exists but has no mappings")
        else:
            logger.debug(f"[CellMappingResolver] no DB mappings for '{key}'")

    def _build_reverse_index(self):
        for cell_key, field_id in self._mappings.items():
            if "!" in cell_key:
                sheet_name, cell_ref = cell_key.split("!", 1)
            else:
                sheet_name = ""
                cell_ref = cell_key
            self._reverse[field_id] = (sheet_name, cell_ref)

    def resolve(self, field_id: str) -> Optional[tuple[str, str]]:
        return self._reverse.get(field_id)

    def get_sheet_mappings(self, sheet_name: str) -> dict[str, str]:
        result: dict[str, str] = {}
        for field_id, (sname, cell_ref) in self._reverse.items():
            if sname == sheet_name:
                result[field_id] = cell_ref
        return result

    def get_all_mappings(self) -> dict[str, str]:
        return dict(self._mappings)

    def get_all_field_ids(self) -> list[str]:
        return list(self._reverse.keys())

    def get_mappings_for_template(self, template_type: str) -> dict[str, str]:
        if self.has_db_mappings:
            return dict(self._mappings)
        key = f"cell_mappings_{template_type}"
        from app import models
        row = self._db.query(models.Settings).filter(models.Settings.key == key).first()
        if row and row.value:
            data = row.value if isinstance(row.value, dict) else json.loads(row.value)
            return data.get("mappings", {})
        return {}
