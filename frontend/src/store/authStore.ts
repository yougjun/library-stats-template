import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  role: string | null
  siteToken: string | null
  login: (token: string, role: string) => void
  logout: () => void
  isAuthenticated: () => boolean
  setSiteToken: (token: string) => void
  isSiteAuthenticated: () => boolean
  logoutSite: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      siteToken: null,
      login: (token, role) => set({ token, role }),
      logout: () => set({ token: null, role: null }),
      isAuthenticated: () => !!get().token,
      setSiteToken: (token) => set({ siteToken: token }),
      isSiteAuthenticated: () => !!get().siteToken,
      logoutSite: () => set({ siteToken: null, token: null, role: null })
    }),
    {
      name: 'auth-storage'
    }
  )
)
