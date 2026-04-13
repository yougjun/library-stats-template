import { create } from 'zustand'

interface TemplateEditorState {
  templateType: 'old' | 'new' | 'current'
  loading: boolean
  saving: boolean
  dirty: boolean
  lastSaved: string | null
  setTemplateType: (type: 'old' | 'new' | 'current') => void
  setLoading: (v: boolean) => void
  setSaving: (v: boolean) => void
  setDirty: (v: boolean) => void
  setLastSaved: (v: string | null) => void
}

export const useTemplateEditorStore = create<TemplateEditorState>((set) => ({
  templateType: 'current',
  loading: false,
  saving: false,
  dirty: false,
  lastSaved: null,
  setTemplateType: (type) => set({ templateType: type }),
  setLoading: (v) => set({ loading: v }),
  setSaving: (v) => set({ saving: v }),
  setDirty: (v) => set({ dirty: v }),
  setLastSaved: (v) => set({ lastSaved: v }),
}))
