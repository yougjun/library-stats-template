import axios from 'axios'

export interface Floor1VisitorRecord {
  year_month: string
  room_type: string
  age_group: string
  usage_type: string
  user_count: number
}

export interface Floor1MaterialRecord {
  year_month: string
  usage_type: string
  subject_code: string
  book_count: number
}

export interface Floor1ProgramRecord {
  year_month: string
  program_name: string
  session_count: number
  participant_count: number
  book_count: number
}

export interface Floor1AILibraryRecord {
  year_month: string
  bookbot?: number
  air_projection?: number
  finger_story?: number
  ar_book?: number
  pass_infant_m?: number
  pass_infant_f?: number
  pass_elementary_m?: number
  pass_elementary_f?: number
  pass_middle_m?: number
  pass_middle_f?: number
  pass_adult_m?: number
  pass_adult_f?: number
  unmanned_users?: number
  unmanned_books?: number
  total_users?: number
  total_books?: number
  updated_at?: string
  created_at?: string
  [key: string]: string | number | undefined
}

export interface Floor1PassIssuerRecord {
  year_month: string
  infant_m?: number
  infant_f?: number
  elementary_m?: number
  elementary_f?: number
  middle_m?: number
  middle_f?: number
  adult_m?: number
  adult_f?: number
}

export interface Floor1GateTagRecord {
  year_month: string
  total_count?: number
}

export interface Floor1RegularMemberRecord {
  year_month: string
  infant_m?: number
  infant_f?: number
  elementary_m?: number
  elementary_f?: number
  middle_m?: number
  middle_f?: number
  adult_m?: number
  adult_f?: number
}

export interface Floor23VisitorRecord {
  year_month: string
  age_group: string
  category: string
  user_count: number
}

export interface Floor23MaterialTypeRecord {
  year_month: string
  room_type: string
  usage_type: string
  material_type: string
  book_count: number
}

export interface Floor23MaterialSubjectRecord {
  year_month: string
  usage_type: string
  subject_code: string
  book_count: number
}

export interface Floor23ProgramRecord {
  year_month: string
  program_name: string
  session_count: number
  participant_count: number
}

export interface Floor23AISmartRecord {
  year_month: string
  literature_vending: number
  unmanned_card_issuer: number
  smart_loan_users: number
  smart_loan_books: number
  smart_return_users: number
  smart_return_books: number
  smart_reservation_users: number
  smart_reservation_books: number
  smart_total_users?: number
  smart_total_books?: number
  total_users?: number
  total_items?: number
  type?: string
  updated_at?: string
  created_at?: string
}

export interface Floor23AIEquipmentRecord {
  year_month: string
  floor: string
  bookbot?: number
  book_kiosk?: number
  laptop?: number
  tablet?: number
  book_scanner?: number
  enews?: number
  users?: number
  updated_at?: string
  created_at?: string
  [key: string]: string | number | undefined
}

export interface HolidayEntry {
  start_date: string
  end_date: string
  condition?: string
}

export interface Floor1AIAutomation {
  enabled: boolean
  airProjectionMultiplier: number
  fingerStoryMultiplier: number
  arBookMultiplier: number
}

export interface AutomationTool {
  enabled: boolean
}

export interface HeaderAliasConfig {
  program?: Record<string, string>
  ai?: Record<string, string>
  floor23_program?: Record<string, string>
}

export interface SettingsData {
  holidays: HolidayEntry[]
  floor1_reading_multiplier: number
  floor23_reading_multiplier: number
  calculation_cutoff_date: string
  gate_start_date: string
  library_year_start_date: string
  update_date_format: string
  floor1_ai_automation: Floor1AIAutomation
  floor1_klas_automation: AutomationTool
  floor23_klas_automation: AutomationTool
  holiday_api_service_key: string
  show_reopen_date: boolean
  show_reopen_date_until: string
  header_aliases?: HeaderAliasConfig
}

export interface SettingsUpdateData {
  holidays?: HolidayEntry[]
  floor1_reading_multiplier?: number
  floor23_reading_multiplier?: number
  floor1_multiplier_effective_from?: string
  floor23_multiplier_effective_from?: string
  calculation_cutoff_date?: string
  gate_start_date?: string
  library_year_start_date?: string
  update_date_format?: string
  floor1_ai_automation?: Partial<Floor1AIAutomation>
  floor1_klas_automation?: Partial<AutomationTool>
  floor23_klas_automation?: Partial<AutomationTool>
  holiday_api_service_key?: string
  show_reopen_date?: boolean
  show_reopen_date_until?: string
  header_aliases?: HeaderAliasConfig
}

export interface AdminRecord {
  id: number
  code: string
  name: string
  role: string
  description?: string
  is_active: boolean
  created_at: string
}

export interface AdminCreateData {
  name: string
  role: string
  description?: string
}

export interface AdminUpdateData {
  name?: string
  role?: string
  code?: string
  description?: string
  is_active?: boolean
}

export interface WeatherFetchParams {
  start_date: string
  end_date: string
  station_id?: number
}

export interface LibraryDataRecord {
  date: string
  visitors?: number
  loans?: number
}

const isStaticDeploy = typeof window !== 'undefined' && window.location.hostname.includes('github.io')

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
})

let csrfToken: string | null = null

api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const storage = localStorage.getItem('auth-storage')
    if (storage) {
      const parsed = JSON.parse(storage)
      const token = parsed.state?.token || parsed.state?.siteToken
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  }

  if (csrfToken && ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '')) {
    config.headers['X-CSRF-Token'] = csrfToken
  }

  return config
})

api.interceptors.response.use(
  (response) => {
    const token = response.headers['x-csrf-token']
    if (token) {
      csrfToken = token
    }
    return response
  },
  async (error) => {
    if (isStaticDeploy) {
      const method = error.config?.method?.toLowerCase() || 'get'
      if (method === 'get') {
        return { data: null, headers: {}, status: 200, statusText: 'OK', config: error.config }
      }
      return { data: { success: true, saved: 0 }, headers: {}, status: 200, statusText: 'OK', config: error.config }
    }

    if (error.response?.status === 401 && error.response?.data?.detail === 'Token expired') {
      localStorage.removeItem('auth-storage')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (error.response?.status === 403 && error.response?.data?.detail === 'CSRF token missing' && !error.config._retry) {
      error.config._retry = true

      try {
        const token = localStorage.getItem('auth-storage')
        if (token) {
          const parsed = JSON.parse(token)
          if (parsed.state?.token) {
            await api.get('/health')
            return api.request(error.config)
          }
        }
      } catch (retryError) {
        return Promise.reject(retryError)
      }
    }

    return Promise.reject(error)
  }
)

interface RememberMeParams {
  access_type: 'site' | 'edit'
  access_role?: string
  access_code?: string
  device_name?: string
}

interface RememberVerifyResponse {
  trusted: boolean
  access_type?: 'site' | 'edit'
  access_role?: string
  token?: string
}

export const authApi = {
  verifySitePassword: (password: string) =>
    api.post<{ valid: boolean; token: string }>('/auth/verify-site-password', { password }),

  verifyCode: (accessCode: string) =>
    api.post<{ valid: boolean; token: string; role: string }>('/auth/verify-code', {
      access_code: accessCode
    }),

  verifyRemember: () =>
    api.get<RememberVerifyResponse>('/auth/verify-remember', { withCredentials: true }),

  rememberMe: (data: RememberMeParams, authToken: string) =>
    api.post<{ success: boolean }>('/auth/remember-me', data, {
      withCredentials: true,
      headers: { Authorization: `Bearer ${authToken}` }
    }),

  forgetMe: () =>
    api.delete<{ success: boolean }>('/auth/forget-me', { withCredentials: true })
}

export const floor1Api = {
  getVisitor: (yearMonth: string) =>
    api.get<Floor1VisitorRecord[]>(`/floor1/visitor/${yearMonth}`),
  saveVisitor: (yearMonth: string, data: Floor1VisitorRecord[]) =>
    api.post(`/floor1/visitor/${yearMonth}`, data),
  getMaterial: (yearMonth: string) =>
    api.get<Floor1MaterialRecord[]>(`/floor1/material/${yearMonth}`),
  saveMaterial: (yearMonth: string, data: Floor1MaterialRecord[]) =>
    api.post(`/floor1/material/${yearMonth}`, data),
  getProgram: (yearMonth: string) =>
    api.get<Floor1ProgramRecord[]>(`/floor1/program/${yearMonth}`),
  saveProgram: (yearMonth: string, data: Floor1ProgramRecord[]) =>
    api.post(`/floor1/program/${yearMonth}`, data),
  getAILibrary: (yearMonth: string) =>
    api.get<Floor1AILibraryRecord | null>(`/floor1/ai-library/${yearMonth}`),
  saveAILibrary: (yearMonth: string, data: Floor1AILibraryRecord, force?: boolean) =>
    api.post(`/floor1/ai-library/${yearMonth}${force ? '?force=true' : ''}`, data),
  getPassIssuer: (yearMonth: string) =>
    api.get<Floor1PassIssuerRecord | null>(`/floor1/pass-issuer/${yearMonth}`),
  savePassIssuer: (yearMonth: string, data: Floor1PassIssuerRecord) =>
    api.post(`/floor1/pass-issuer/${yearMonth}`, data),
  getGateTag: (yearMonth: string) =>
    api.get<Floor1GateTagRecord | null>(`/floor1/gate-tag/${yearMonth}`),
  saveGateTag: (yearMonth: string, data: Floor1GateTagRecord) =>
    api.post(`/floor1/gate-tag/${yearMonth}`, data),
  getRegularMember: (yearMonth: string) =>
    api.get<Floor1RegularMemberRecord | null>(`/floor1/regular-member/${yearMonth}`),
  saveRegularMember: (yearMonth: string, data: Floor1RegularMemberRecord) =>
    api.post(`/floor1/regular-member/${yearMonth}`, data)
}

export const floor23Api = {
  getVisitor: (yearMonth: string) =>
    api.get<Floor23VisitorRecord[]>(`/floor23/visitor/${yearMonth}`),
  saveVisitor: (yearMonth: string, data: Floor23VisitorRecord[]) =>
    api.post(`/floor23/visitor/${yearMonth}`, data),
  getMaterialType: (yearMonth: string) =>
    api.get<Floor23MaterialTypeRecord[]>(`/floor23/material-type/${yearMonth}`),
  saveMaterialType: (yearMonth: string, data: Floor23MaterialTypeRecord[]) =>
    api.post(`/floor23/material-type/${yearMonth}`, data),
  getMaterialSubject: (yearMonth: string) =>
    api.get<Floor23MaterialSubjectRecord[]>(`/floor23/material-subject/${yearMonth}`),
  saveMaterialSubject: (yearMonth: string, data: Floor23MaterialSubjectRecord[]) =>
    api.post(`/floor23/material-subject/${yearMonth}`, data),
  getProgram: (yearMonth: string) =>
    api.get<Floor23ProgramRecord[]>(`/floor23/program/${yearMonth}`),
  saveProgram: (yearMonth: string, data: Floor23ProgramRecord[]) =>
    api.post(`/floor23/program/${yearMonth}`, data),
  getAISmart: (yearMonth: string) =>
    api.get<Floor23AISmartRecord | null>(`/floor23/ai-smart/${yearMonth}`),
  saveAISmart: (yearMonth: string, data: Floor23AISmartRecord) =>
    api.post(`/floor23/ai-smart/${yearMonth}`, data),
  getAIEquipment: (yearMonth: string, floor: string) =>
    api.get<Floor23AIEquipmentRecord | null>(`/floor23/ai-equipment/${yearMonth}/${floor}`),
  saveAIEquipment: (yearMonth: string, data: Floor23AIEquipmentRecord[]) =>
    api.post(`/floor23/ai-equipment/${yearMonth}`, data),
  getYearly: (year: string) =>
    api.get(`/floor23/yearly/${year}`)
}

export const statsApi = {
  getMonthly: (yearMonth: string) =>
    api.get(`/statistics/monthly/${yearMonth}`),
  getFloor1Cumulative: (yearMonth: string) =>
    api.get(`/statistics/floor1/cumulative/${yearMonth}`),
  getFloor23Cumulative: (yearMonth: string) =>
    api.get(`/statistics/floor23/cumulative/${yearMonth}`),
  getKnowledge: (yearMonth: string) =>
    api.get(`/statistics/knowledge/${yearMonth}`)
}

export const settingsApi = {
  get: () => api.get<SettingsData>('/settings'),
  getPublic: () => api.get<SettingsData>('/settings/public'),
  update: (data: SettingsUpdateData) => api.post('/settings', data)
}

export const weatherApi = {
  fetchWeather: async (startDate: string, endDate: string, stationId?: number) => {
    const params: WeatherFetchParams = { start_date: startDate, end_date: endDate }
    if (stationId) params.station_id = stationId
    const response = await api.post('/settings/fetch-weather', null, { params })
    return response.data
  },

  getWeatherData: async (startDate: string, endDate: string) => {
    const response = await api.get('/weather/data', {
      params: { start_date: startDate, end_date: endDate }
    })
    return response.data
  },

  getWeatherCorrelation: async (startDate: string, endDate: string, libraryData: LibraryDataRecord[]) => {
    const response = await api.post('/prediction/weather-correlation',
      { data: libraryData },
      { params: { start_date: startDate, end_date: endDate } }
    )
    return response.data
  }
}

interface ChatChartData {
  type: 'line' | 'bar';
  title: string;
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string | string[];
  }>;
}

interface ChatResponse {
  response: string;
  session_id: string;
  has_chart_data: boolean;
  chart_data: ChatChartData | null;
  suggestions: string[];
  typo_corrections: string[];
  intent?: string;
  confidence?: number;
}

export const chatApi = {
  sendMessage: (message: string, sessionId?: string) =>
    api.post<ChatResponse>('/chat', { message, session_id: sessionId }),
  getHistory: (sessionId: string) =>
    api.get<Array<{user_message: string; bot_response: string; intent: string | null; created_at: string}>>(`/chat/history/${sessionId}`),
  getAnalytics: (days: number = 7) =>
    api.get<{total_messages: number; intent_distribution: Record<string, number>; avg_response_time_ms: number; daily_counts: Record<string, number>}>(`/chat/analytics?days=${days}`),
  getChartData: (chartType: string, params: Record<string, string>) => {
    const queryParams = new URLSearchParams({ chart_type: chartType, ...params }).toString();
    return api.get<{chart_data: ChatChartData | null}>(`/chat/chart?${queryParams}`);
  }
}

export const adminApi = {
  list: () => api.get<AdminRecord[]>('/admin/list'),
  create: (data: AdminCreateData) => api.post('/admin/create', data),
  update: (id: number, data: AdminUpdateData) => api.put(`/admin/${id}`, data),
  delete: (id: number) => api.delete(`/admin/${id}`)
}

export const automationApi = {
  getExclusions: () => api.get('/automation/exclusions'),
  addExclusion: (data: { year_month: string; floor: string; reason: string; created_by: string }) =>
    api.post('/automation/exclusions', data),
  deleteExclusion: (id: number) => api.delete(`/automation/exclusions/${id}`),
  getInfo: () => api.get('/automation/info'),
  download: () => api.get('/automation/download', { responseType: 'blob' }),
  upload: (formData: FormData) => api.post('/automation/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const siteAuthApi = {
  setPassword: (newPassword: string, adminToken: string) =>
    api.post('/auth/set-site-password', { new_password: newPassword, admin_token: adminToken }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-site-password', { current_password: currentPassword, new_password: newPassword })
}

export interface TemplateDrivenConfig {
  id: number
  name: string
  template_type: string
  file_hash: string
  original_filename: string
  sheet_count: number
  created_at: string | null
  updated_at: string | null
}

export interface TemplateDrivenUploadResult {
  id: number
  name: string
  sheets: number
  total_cells: number
  formula_count: number
  merged_count: number
  auto_detected_roles: number
}

export interface TemplateDrivenEditorData {
  univer_data: Record<string, unknown>
  cell_roles: Record<string, string>
}

export interface CellSaveItem {
  sheet: string
  cell: string
  value: string | number | null
  value_type?: string
}

export const templateDrivenApi = {
  upload: (formData: FormData) =>
    api.post<TemplateDrivenUploadResult>('/template-driven/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getConfigs: () =>
    api.get<TemplateDrivenConfig[]>('/template-driven/configs'),
  getStructure: (id: number) =>
    api.get<{ id: number; name: string; structure: Record<string, unknown>; cell_roles: Record<string, string> }>(
      `/template-driven/${id}/structure`
    ),
  getEditor: (id: number) =>
    api.get<TemplateDrivenEditorData>(`/template-driven/${id}/editor`),
  saveCellRoles: (id: number, roles: Record<string, string>) =>
    api.post<{ saved: number }>(`/template-driven/${id}/cell-roles`, { roles }),
  getData: (id: number, yearMonth: string) =>
    api.get<TemplateDrivenEditorData>(`/template-driven/${id}/data/${yearMonth}`),
  saveData: (id: number, yearMonth: string, cells: CellSaveItem[]) =>
    api.post<{ saved: number }>(`/template-driven/${id}/data/${yearMonth}`, { cells }),
  exportXlsx: (id: number, yearMonth: string) =>
    api.get(`/template-driven/${id}/export/${yearMonth}`, { responseType: 'blob' }),
}

export const templateApi = {
  downloadOld: () => api.get('/template/old/download', { responseType: 'blob' }),
  downloadNew: () => api.get('/template/new/download', { responseType: 'blob' }),
  uploadOld: (formData: FormData) => api.post('/template/old/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadNew: (formData: FormData) => api.post('/template/new/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getEditorData: (type: string) => api.get(`/template/${type}/editor-data`),
  saveEditorData: (type: string, data: object) => api.post(`/template/${type}/editor-data`, data),
}

export default api
