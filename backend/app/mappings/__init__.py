"""
Cell mapping definitions for template-driven Excel generation.

This package provides:
  - dynamic_resolver: Runtime cell mapping resolution from database
  - field_catalog: Static registry of available data fields
"""

from app.mappings.dynamic_resolver import CellMappingResolver
from app.mappings.field_catalog import get_field_catalog, get_field_by_id, get_catalog_tree

__all__ = [
    "CellMappingResolver",
    "get_field_catalog",
    "get_field_by_id",
    "get_catalog_tree",
]
