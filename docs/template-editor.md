# Template Editor (Univer)

## Architecture

```
Frontend (React + Univer)          Backend (FastAPI + openpyxl)
┌──────────────────────┐           ┌──────────────────────────┐
│ TemplateEditor page  │──JSON──→  │ template_converter.py    │
│   UniverEditor comp  │←──JSON──  │   xlsx_to_univer()       │
│   templateEditorStore│           │   univer_to_xlsx()       │
└──────────────────────┘           └──────────────────────────┘
```

## Files

| File | Role |
|------|------|
| `backend/app/services/template_converter.py` | Bidirectional xlsx <-> Univer JSON |
| `backend/app/routes/excel.py` (bottom) | GET/POST `/template/{type}/editor-data` |
| `frontend/src/components/template-editor/UniverEditor.tsx` | Univer instance wrapper |
| `frontend/src/pages/TemplateEditor.tsx` | Editor page with toolbar |
| `frontend/src/store/templateEditorStore.ts` | Zustand state |
| `frontend/src/services/api.ts` | `templateApi.getEditorData/saveEditorData` |

## API Endpoints

```
GET  /api/template/{type}/editor-data   → IWorkbookData JSON
POST /api/template/{type}/editor-data   ← IWorkbookData JSON
```

`type` = `current` | `old` | `new`

## NPM Packages

```
@univerjs/presets
@univerjs/preset-sheets-core
```

## Key Notes

- Korean locale: `LocaleType.KO_KR` + `ko-KR` locale import
- CSS: `@univerjs/preset-sheets-core/lib/index.css`
- Snapshot: `workbook.save()` returns IWorkbookData
- Load: `univerAPI.createWorkbook(data)`
- Dispose existing workbook before loading new one
- Vendor chunk is ~8.6MB (gzipped ~2.1MB) — extracted to `vendor-univer` chunk
- PWA workbox limit raised to 15MB to accommodate
