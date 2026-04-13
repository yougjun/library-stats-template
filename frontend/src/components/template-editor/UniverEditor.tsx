import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import UniverPresetSheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR'
import sheetsWorkerUrl from '@univerjs/preset-sheets-core/lib/worker.js?url'
import '@univerjs/preset-sheets-core/lib/index.css'

export interface CellLocation {
  sheetName: string
  sheetId: string
  cellRef: string
  row: number
  col: number
}

export interface UniverEditorRef {
  loadWorkbook: (data: Record<string, unknown>) => void
  getSnapshot: () => Record<string, unknown> | null
  getSelectedCell: () => CellLocation | null
  onSelectionChange: (cb: (cell: CellLocation) => void) => (() => void)
  setCellStyle: (sheetName: string, row: number, col: number, style: Record<string, unknown>) => void
}

interface UniverEditorProps {
  onReady?: () => void
  onChange?: () => void
  enableFormula?: boolean
}

function colToLetter(col: number): string {
  let result = ''
  let c = col
  while (c >= 0) {
    result = String.fromCharCode((c % 26) + 65) + result
    c = Math.floor(c / 26) - 1
  }
  return result
}

const UniverEditor = forwardRef<UniverEditorRef, UniverEditorProps>(
  ({ onReady, onChange, enableFormula = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const apiRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null)
    const selectionCallbacks = useRef<Set<(cell: CellLocation) => void>>(new Set())

    const getActiveLocation = useCallback((): CellLocation | null => {
      const api = apiRef.current
      if (!api) return null

      const wb = api.getActiveWorkbook()
      if (!wb) return null

      const ws = wb.getActiveSheet()
      if (!ws) return null

      const cell = ws.getActiveCell()
      if (!cell) return null

      const row = cell.getRow()
      const col = cell.getColumn()

      return {
        sheetName: ws.getSheetName(),
        sheetId: ws.getSheetId(),
        cellRef: `${colToLetter(col)}${row + 1}`,
        row,
        col,
      }
    }, [])

    useImperativeHandle(ref, () => ({
      loadWorkbook(data: Record<string, unknown>) {
        if (!apiRef.current) return
        const existing = apiRef.current.getActiveWorkbook()
        if (existing) {
          try { existing.dispose() } catch { /* ignore */ }
        }
        apiRef.current.createWorkbook(data)
      },
      getSnapshot() {
        if (!apiRef.current) return null
        const wb = apiRef.current.getActiveWorkbook()
        if (!wb) return null
        return wb.save() as unknown as Record<string, unknown>
      },
      getSelectedCell() {
        return getActiveLocation()
      },
      onSelectionChange(cb: (cell: CellLocation) => void) {
        selectionCallbacks.current.add(cb)
        return () => { selectionCallbacks.current.delete(cb) }
      },
      setCellStyle(sheetName: string, row: number, col: number, style: Record<string, unknown>) {
        const api = apiRef.current
        if (!api) return

        const wb = api.getActiveWorkbook()
        if (!wb) return

        const ws = wb.getSheetByName(sheetName)
        if (!ws) return

        const range = ws.getRange(row, col)
        if (!range) return

        if (style.background) {
          range.setBackgroundColor(style.background as string)
        }
      },
    }))

    useEffect(() => {
      if (!containerRef.current) return

      const presetConfig: Record<string, unknown> = {
        container: containerRef.current,
      }

      if (enableFormula) {
        presetConfig.workerURL = sheetsWorkerUrl
      }

      const { univerAPI } = createUniver({
        locale: LocaleType.KO_KR,
        locales: {
          [LocaleType.KO_KR]: mergeLocales(UniverPresetSheetsCoreKoKR),
        },
        presets: [
          UniverSheetsCorePreset(presetConfig),
        ],
      })

      apiRef.current = univerAPI
      onReady?.()

      const commandSub = univerAPI.onCommandExecuted?.(() => {
        onChange?.()
      })

      let selectionSub: { dispose: () => void } | undefined
      try {
        const wb = univerAPI.getActiveWorkbook?.()
        if (wb?.onSelectionChange) {
          selectionSub = wb.onSelectionChange(() => {
            const loc = getActiveLocation()
            if (loc) {
              selectionCallbacks.current.forEach(cb => cb(loc))
            }
          })
        }
      } catch {
        // selection tracking not critical
      }

      return () => {
        commandSub?.dispose?.()
        selectionSub?.dispose?.()
        univerAPI.dispose()
        apiRef.current = null
      }
    }, [])

    return (
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
    )
  }
)

UniverEditor.displayName = 'UniverEditor'
export default UniverEditor
