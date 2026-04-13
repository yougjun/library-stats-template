import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Table, InputNumber, Button, message, DatePicker, Alert, Modal } from 'antd'
import { DownloadOutlined, SwapOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { floor1Api, automationApi, floor23Api, settingsApi } from '../services/api'
import { useAuthStore } from '../store/authStore'
import dayjs, { Dayjs } from 'dayjs'
import { getFloor1AIAutomation, getFloor1KLASAutomation, getReadingMultiplier } from '../utils/libraryDays'
import { distributeWithLargestRemainder } from '../utils/calculations'
import axios from 'axios'
import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '../config/api'
import '../styles/table.css'
import { getErrorMessage, isAxiosError } from '../utils/errorHandler'

interface VisitorRow {
  key: number
  age_group: string
  children_loan: number
  children_read: number
  infant_loan: number
  infant_read: number
  total: number
}

interface MaterialRow {
  key: number
  room: string
  type: string
  type_000: number
  type_100: number
  type_200: number
  type_300: number
  type_400: number
  type_500: number
  type_600: number
  type_700: number
  type_800: number
  type_900: number
  etc: number
  month_total: number
  cumulative_total: number
  [key: string]: string | number
}

interface ProgramRow {
  key: number
  [key: string]: string | number
}

interface AILibraryRow {
  key: number
  [key: string]: string | number
}

interface PassIssuerRow {
  key: number
  infant_m?: number
  infant_f?: number
  elementary_m?: number
  elementary_f?: number
  middle_m?: number
  middle_f?: number
  adult_m?: number
  adult_f?: number
  [key: string]: string | number | undefined
}

interface RegularMemberRow {
  key: number
  infant_m?: number
  infant_f?: number
  elementary_m?: number
  elementary_f?: number
  middle_m?: number
  middle_f?: number
  adult_m?: number
  adult_f?: number
  [key: string]: string | number | undefined
}

interface InterlibData {
  bookbada: number
  booknare: number
}

interface VisitorApiItem {
  age_group?: string
  room_type?: string
  usage_type?: string
  user_count?: number
}

interface MaterialApiItem {
  usage_type?: string
  subject_code?: string
  book_count?: number
}

interface ProgramApiItem {
  program_name?: string
  session_count?: number
  participant_count?: number
  book_count?: number
}

interface ExclusionItem {
  year_month: string
  floor: string
}

interface InterlibApiItem {
  category?: string
  age_group?: string
  user_count?: number
}

interface VisitorMapValue {
  age_group: string
  children_loan: number
  children_read: number
  infant_loan: number
  infant_read: number
  total: number
}

interface SubjectMap {
  type_000: number
  type_100: number
  type_200: number
  type_300: number
  type_400: number
  type_500: number
  type_600: number
  type_700: number
  type_800: number
  type_900: number
  etc: number
  [key: string]: number
}

interface ProgramMap {
  storytelling_count: number
  storytelling_people: number
  library_tour_count: number
  library_tour_people: number
  children_bookclub_count: number
  children_bookclub_people: number
  night_floor1_count: number
  night_floor1_people: number
  book_package_count: number
  book_package_books: number
  book_package_people: number
  room_event_count: number
  room_event_people: number
  total_count: number
  total_people: number
  [key: string]: number
}

const PROGRAM_NAME_MAP: Record<string, string> = {
  'storytelling': 'storytelling',
  'library_tour': 'library_tour',
  'children_bookclub': 'children_bookclub',
  'night_floor1': 'night_floor1',
  'book_package': 'book_package',
  'room_event': 'room_event'
}

interface VisitorPayload {
  year_month: string
  room_type: string
  age_group: string
  usage_type: string
  user_count: number
}

interface InterlibPayload {
  year_month: string
  age_group: string
  category: string
  user_count: number
}

const renderNumber = (v: number | undefined) => Math.round(v || 0).toLocaleString()

export default function Floor1Input() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [visitorData, setVisitorData] = useState<VisitorRow[]>([])
  const [materialData, setMaterialData] = useState<MaterialRow[]>([])
  const [programData, setProgramData] = useState<ProgramRow[]>([])
  const [aiLibraryData, setAILibraryData] = useState<AILibraryRow[]>([])
  const [passIssuerData, setPassIssuerData] = useState<PassIssuerRow[]>([])
  const [gateTagCount, setGateTagCount] = useState<number>(0)
  const [regularMemberData, setRegularMemberData] = useState<RegularMemberRow[]>([])
  const [interlibData, setInterlibData] = useState<InterlibData>({ bookbada: 0, booknare: 0 })
  const [aiAutomation, setAIAutomation] = useState(getFloor1AIAutomation())
  const [klasAutomation, setKLASAutomation] = useState(getFloor1KLASAutomation())
  const [isExcludedMonth, setIsExcludedMonth] = useState(false)
  const [headerAliases, setHeaderAliases] = useState<{program?: Record<string, string>, ai?: Record<string, string>}>({})
  const isExcludedRef = useRef(false)
  const shouldBlockAutoCalc = useRef(false)
  const hasLoadedData = useRef(false)
  const lastSavedDataHash = useRef<string>('')
  const socketRef = useRef<Socket | null>(null)
  const isMountedRef = useRef(true)
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const isSavingRef = useRef(false)

  const distributedPassValues = useMemo(() => {
    const passIssuerValues = {
      infant_m: passIssuerData[0]?.infant_m || 0,
      infant_f: passIssuerData[0]?.infant_f || 0,
      elementary_m: passIssuerData[0]?.elementary_m || 0,
      elementary_f: passIssuerData[0]?.elementary_f || 0,
      middle_m: passIssuerData[0]?.middle_m || 0,
      middle_f: passIssuerData[0]?.middle_f || 0,
      adult_m: passIssuerData[0]?.adult_m || 0,
      adult_f: passIssuerData[0]?.adult_f || 0
    }
    return distributeWithLargestRemainder(passIssuerValues, gateTagCount)
  }, [passIssuerData, gateTagCount])

  useEffect(() => {
    hasLoadedData.current = false
    loadData()
  }, [yearMonth])

  useEffect(() => {
    isMountedRef.current = true
    connectionStateRef.current = 'connecting'

    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 10000
    })

    socketRef.current = socket

    socket.on('connect', () => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'connected'
      socket.emit('join_room', { room: `floor1-${yearMonth}` })
    })

    socket.on('connect_error', (error) => {
      if (!isMountedRef.current) return
      console.error('Socket connect error:', error.message)
      connectionStateRef.current = 'disconnected'
    })

    socket.on('error', (error) => {
      if (!isMountedRef.current) return
      console.error('Socket error:', error)
    })

    socket.on('floor1_data_updated', (data) => {
      if (!isMountedRef.current) return
      if (data.year_month === yearMonth) {
        let currentUserCode = null
        try {
          if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]))
            currentUserCode = payload?.code
          }
        } catch (e) {
          console.error('JWT parse error:', e)
        }
        if (data.updated_by === currentUserCode) return
        message.info(`데이터가 업데이트되었습니다 (${data.updated_by})`)
        setRemoteLoading(true)
        loadData().finally(() => {
          if (isMountedRef.current) {
            setRemoteLoading(false)
          }
        })
      }
    })

    socket.on('disconnect', (reason) => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'disconnected'
      if (reason === 'io server disconnect') {
        socket.connect()
      }
    })

    socket.on('reconnect', () => {
      if (!isMountedRef.current) return
      connectionStateRef.current = 'connected'
      socket.emit('join_room', { room: `floor1-${yearMonth}` })
    })

    return () => {
      if (connectionStateRef.current === 'connected' && socketRef.current) {
        socketRef.current.emit('leave_room', { room: `floor1-${yearMonth}` })
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners()
        socketRef.current.disconnect()
        socketRef.current = null
      }
      isMountedRef.current = false
      connectionStateRef.current = 'disconnected'
    }
  }, [yearMonth, token])

  useEffect(() => {
    if (passIssuerData.length === 0) {
      setPassIssuerData([{
        key: 0,
        infant_m: 0,
        infant_f: 0,
        elementary_m: 0,
        elementary_f: 0,
        middle_m: 0,
        middle_f: 0,
        adult_m: 0,
        adult_f: 0
      }])
    }
    if (regularMemberData.length === 0) {
      setRegularMemberData([{
        key: 0,
        infant_m: 0,
        infant_f: 0,
        elementary_m: 0,
        elementary_f: 0,
        middle_m: 0,
        middle_f: 0,
        adult_m: 0,
        adult_f: 0
      }])
    }
  }, [])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        return
      }
      setAIAutomation(getFloor1AIAutomation())
      setKLASAutomation(getFloor1KLASAutomation())
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'floor1_ai_automation' || e.key === 'floor1_klas_automation') {
        setAIAutomation(getFloor1AIAutomation())
        setKLASAutomation(getFloor1KLASAutomation())
      }
    }

    const handleFocus = () => {
      setAIAutomation(getFloor1AIAutomation())
      setKLASAutomation(getFloor1KLASAutomation())
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  useEffect(() => {
    if (aiAutomation.enabled && !hasLoadedData.current && !shouldBlockAutoCalc.current && !isExcludedRef.current && passIssuerData.length > 0 && regularMemberData.length > 0) {
      const issuerTotal = (passIssuerData[0]?.infant_m || 0) + (passIssuerData[0]?.infant_f || 0) +
                         (passIssuerData[0]?.elementary_m || 0) + (passIssuerData[0]?.elementary_f || 0) +
                         (passIssuerData[0]?.middle_m || 0) + (passIssuerData[0]?.middle_f || 0) +
                         (passIssuerData[0]?.adult_m || 0) + (passIssuerData[0]?.adult_f || 0)
      const multiplier = issuerTotal > 0 ? gateTagCount / issuerTotal : 0

      const passInfant = Math.round((passIssuerData[0]?.infant_m || 0) * multiplier) + Math.round((passIssuerData[0]?.infant_f || 0) * multiplier)
      const passElementary = Math.round((passIssuerData[0]?.elementary_m || 0) * multiplier) + Math.round((passIssuerData[0]?.elementary_f || 0) * multiplier)

      const regularInfant = (regularMemberData[0]?.infant_m || 0) + (regularMemberData[0]?.infant_f || 0)
      const regularElementary = (regularMemberData[0]?.elementary_m || 0) + (regularMemberData[0]?.elementary_f || 0)

      const totalInfant = passInfant + regularInfant
      const totalElementary = passElementary + regularElementary
      const totalInfantElementary = totalInfant + totalElementary

      const airProjection = Math.round(totalInfantElementary * aiAutomation.airProjectionMultiplier)
      const fingerStory = Math.round(totalInfant * aiAutomation.fingerStoryMultiplier)
      const arBook = Math.round(totalElementary * aiAutomation.arBookMultiplier)

      setAILibraryData(prev => [{
        ...(prev[0] || {}),
        air_projection: airProjection,
        finger_story: fingerStory,
        ar_book: arBook
      }])
    }
  }, [passIssuerData, gateTagCount, regularMemberData, aiAutomation])

  const loadData = async () => {
    hasLoadedData.current = true

    const ageGroups = ['infant_elementary', 'middle_high', 'adult']
    const types = ['loan']

    let isExcluded = false
    try {
      const exclusionsRes = await automationApi.getExclusions()
      const excluded = exclusionsRes.data.find((e: ExclusionItem) => e.year_month === yearMonth && e.floor === 'floor1')
      isExcluded = !!excluded
      isExcludedRef.current = isExcluded
      setIsExcludedMonth(isExcluded)
      shouldBlockAutoCalc.current = isExcluded
    } catch (error: unknown) {
      console.error('Failed to check exclusions:', error)
      isExcludedRef.current = false
      setIsExcludedMonth(false)
      shouldBlockAutoCalc.current = false
    }

    try {
      const settingsRes = await settingsApi.get()
      if (settingsRes.data.header_aliases) {
        setHeaderAliases(settingsRes.data.header_aliases)
      }
    } catch (error: unknown) {
      console.error('Failed to load header aliases:', error)
    }

    try {
      const passIssuerRes = await floor1Api.getPassIssuer(yearMonth!)
      if (passIssuerRes.data) {
        setPassIssuerData([{ key: 0, ...passIssuerRes.data }])
      }
    } catch (error: unknown) {
      console.error('No pass issuer data:', error)
    }

    try {
      const gateTagRes = await floor1Api.getGateTag(yearMonth!)
      if (gateTagRes.data) {
        setGateTagCount(gateTagRes.data.total_count || 0)
      }
    } catch (error: unknown) {
      console.error('No gate tag data:', error)
    }

    try {
      const regularMemberRes = await floor1Api.getRegularMember(yearMonth!)
      if (regularMemberRes.data) {
        setRegularMemberData([{ key: 0, ...regularMemberRes.data }])
      }
    } catch (error: unknown) {
      console.error('No regular member data:', error)
    }

    try {
      const visitorRes = await floor1Api.getVisitor(yearMonth!)
      const visitorDataFromApi = visitorRes.data

      const visitorMap: Record<string, VisitorMapValue> = {}
      ageGroups.forEach(ag => {
        visitorMap[ag] = { age_group: ag, children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0 }
      })

      visitorDataFromApi.forEach((item: VisitorApiItem) => {
        if (item.age_group && visitorMap[item.age_group]) {
          if (item.room_type === 'children' && item.usage_type === 'loan') {
            visitorMap[item.age_group].children_loan = item.user_count || 0
          } else if (item.room_type === 'children' && item.usage_type === 'read') {
            visitorMap[item.age_group].children_read = item.user_count || 0
          } else if (item.room_type === 'infant' && item.usage_type === 'loan') {
            visitorMap[item.age_group].infant_loan = item.user_count || 0
          } else if (item.room_type === 'infant' && item.usage_type === 'read') {
            visitorMap[item.age_group].infant_read = item.user_count || 0
          }
        }
      })

      setVisitorData(ageGroups.map((ag, i) => ({ key: i, ...visitorMap[ag] })))
    } catch {
      setVisitorData(ageGroups.map((age_group, idx) => ({
        key: idx,
        age_group,
        children_loan: 0,
        children_read: 0,
        infant_loan: 0,
        infant_read: 0,
        total: 0
      })))
    }

    try {
      const materialRes = await floor1Api.getMaterial(yearMonth!)
      const materialDataFromApi = materialRes.data

      const subjectMap: SubjectMap = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      materialDataFromApi.forEach((item: MaterialApiItem) => {
        if (item.usage_type === 'loan') {
          const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
          if (Object.prototype.hasOwnProperty.call(subjectMap, key)) subjectMap[key] = item.book_count || 0
        }
      })
      setMaterialData([{ key: 0, room: 'children', type: 'loan', ...subjectMap, month_total: 0, cumulative_total: 0 }])
    } catch {
      setMaterialData([{
        key: 0,
        room: 'children',
        type: 'loan',
        type_000: 0,
        type_100: 0,
        type_200: 0,
        type_300: 0,
        type_400: 0,
        type_500: 0,
        type_600: 0,
        type_700: 0,
        type_800: 0,
        type_900: 0,
        etc: 0,
        month_total: 0,
        cumulative_total: 0
      }])
    }

    try {
      const programRes = await floor1Api.getProgram(yearMonth!)
      const programs = programRes.data
      const programMap: ProgramMap = { storytelling_count: 0, storytelling_people: 0, library_tour_count: 0, library_tour_people: 0, children_bookclub_count: 0, children_bookclub_people: 0, night_floor1_count: 0, night_floor1_people: 0, book_package_count: 0, book_package_books: 0, book_package_people: 0, room_event_count: 0, room_event_people: 0, total_count: 0, total_people: 0 }
      programs.forEach((p: ProgramApiItem) => {
        const prefix = p.program_name ? PROGRAM_NAME_MAP[p.program_name] : undefined
        if (prefix) {
          programMap[`${prefix}_count`] = p.session_count || 0
          programMap[`${prefix}_people`] = p.participant_count || 0
          if (prefix === 'book_package') {
            programMap[`${prefix}_books`] = p.book_count || 0
          }
        }
      })
      setProgramData([{ key: 0, ...programMap }])
    } catch {
      setProgramData([{
        key: 0,
        storytelling_count: 0,
        storytelling_people: 0,
        library_tour_count: 0,
        library_tour_people: 0,
        children_bookclub_count: 0,
        children_bookclub_people: 0,
        night_floor1_count: 0,
        night_floor1_people: 0,
        book_package_count: 0,
        book_package_books: 0,
        book_package_people: 0,
        room_event_count: 0,
        room_event_people: 0,
        total_count: 0,
        total_people: 0
      }])
    }

    try {
      const aiRes = await floor1Api.getAILibrary(yearMonth!)
      const aiDataFromApi = aiRes.data
      if (aiDataFromApi) {
        setAILibraryData([{ key: 0, ...aiDataFromApi }])
      } else {
        setAILibraryData([{
          key: 0,
          bookbot: 0,
          air_projection: 0,
          finger_story: 0,
          ar_book: 0,
          pass_infant_m: 0,
          pass_infant_f: 0,
          pass_elementary_m: 0,
          pass_elementary_f: 0,
          pass_middle_m: 0,
          pass_middle_f: 0,
          pass_adult_m: 0,
          pass_adult_f: 0,
          unmanned_users: 0,
          unmanned_books: 0,
          total_users: 0,
          total_books: 0
        }])
      }
    } catch {
      setAILibraryData([{
        key: 0,
        bookbot: 0,
        air_projection: 0,
        finger_story: 0,
        ar_book: 0,
        pass_infant_m: 0,
        pass_infant_f: 0,
        pass_elementary_m: 0,
        pass_elementary_f: 0,
        pass_middle_m: 0,
        pass_middle_f: 0,
        pass_adult_m: 0,
        pass_adult_f: 0,
        unmanned_users: 0,
        unmanned_books: 0,
        total_users: 0,
        total_books: 0
      }])
    }

    try {
      const interlibRes = await floor23Api.getVisitor(yearMonth!)
      const bookbada = interlibRes.data.find((d: InterlibApiItem) => d.category === '책바다' && d.age_group === 'adult')?.user_count || 0
      const booknare = interlibRes.data.find((d: InterlibApiItem) => d.category === '책나래' && d.age_group === 'adult')?.user_count || 0
      setInterlibData({ bookbada, booknare })
    } catch {
      setInterlibData({ bookbada: 0, booknare: 0 })
    }

    if (!isExcluded) {
      hasLoadedData.current = false
    }
  }

  const calculateVisitorTotal = (row: VisitorRow) => {
    return (row.children_loan || 0) + (row.children_read || 0) + (row.infant_loan || 0) + (row.infant_read || 0)
  }

  const calculateMaterialTotal = (row: MaterialRow) => {
    return (row.type_000 || 0) + (row.type_100 || 0) + (row.type_200 || 0) +
           (row.type_300 || 0) + (row.type_400 || 0) + (row.type_500 || 0) +
           (row.type_600 || 0) + (row.type_700 || 0) + (row.type_800 || 0) +
           (row.type_900 || 0) + (row.etc || 0)
  }

  const calculateProgramTotal = (row: ProgramRow) => {
    return {
      count: (Number(row.storytelling_count) || 0) + (Number(row.library_tour_count) || 0) +
             (Number(row.children_bookclub_count) || 0) + (Number(row.night_floor1_count) || 0) +
             (Number(row.book_package_count) || 0) + (Number(row.room_event_count) || 0),
      people: (Number(row.storytelling_people) || 0) + (Number(row.library_tour_people) || 0) +
              (Number(row.children_bookclub_people) || 0) + (Number(row.night_floor1_people) || 0) +
              (Number(row.book_package_people) || 0) + (Number(row.room_event_people) || 0)
    }
  }

  const handleSaveAll = async (isAuto = false, forceOverwrite = false) => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    if (!isAuto) setLoading(true)
    try {
      const readingMultiplier = getReadingMultiplier('floor1')
      const visitorPayload: VisitorPayload[] = []
      visitorData.forEach(item => {
        const childrenLoan = item.children_loan || 0
        const infantLoan = item.infant_loan || 0

        visitorPayload.push({
          year_month: yearMonth!,
          room_type: 'children',
          age_group: item.age_group,
          usage_type: 'loan',
          user_count: childrenLoan
        })
        visitorPayload.push({
          year_month: yearMonth!,
          room_type: 'children',
          age_group: item.age_group,
          usage_type: 'read',
          user_count: Math.round(childrenLoan * readingMultiplier)
        })
        visitorPayload.push({
          year_month: yearMonth!,
          room_type: 'infant',
          age_group: item.age_group,
          usage_type: 'loan',
          user_count: infantLoan
        })
        visitorPayload.push({
          year_month: yearMonth!,
          room_type: 'infant',
          age_group: item.age_group,
          usage_type: 'read',
          user_count: Math.round(infantLoan * readingMultiplier)
        })
      })
      const visitorUrl = `/api/floor1/visitor/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(visitorUrl, visitorPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const materialPayload = materialData.slice(0, 1).map(item => ({
        year_month: yearMonth!,
        usage_type: 'loan',
        subject_code: '000',
        book_count: item.type_000 || 0
      }))
      const subjectCodes = ['100', '200', '300', '400', '500', '600', '700', '800', '900', 'etc']
      const materialRow = materialData[0]
      subjectCodes.forEach(code => {
        const key = code === 'etc' ? 'etc' : `type_${code}`
        materialPayload.push({
          year_month: yearMonth!,
          usage_type: 'loan',
          subject_code: code,
          book_count: Number(materialRow[key]) || 0
        })
      })
      const materialUrl = `/api/floor1/material/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(materialUrl, materialPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const programPayload = [
        { year_month: yearMonth!, program_name: 'storytelling', session_count: programData[0].storytelling_count || 0, participant_count: programData[0].storytelling_people || 0, book_count: 0 },
        { year_month: yearMonth!, program_name: 'library_tour', session_count: programData[0].library_tour_count || 0, participant_count: programData[0].library_tour_people || 0, book_count: 0 },
        { year_month: yearMonth!, program_name: 'children_bookclub', session_count: programData[0].children_bookclub_count || 0, participant_count: programData[0].children_bookclub_people || 0, book_count: 0 },
        { year_month: yearMonth!, program_name: 'night_floor1', session_count: programData[0].night_floor1_count || 0, participant_count: programData[0].night_floor1_people || 0, book_count: 0 },
        { year_month: yearMonth!, program_name: 'book_package', session_count: programData[0].book_package_count || 0, participant_count: programData[0].book_package_people || 0, book_count: programData[0].book_package_books || 0 },
        { year_month: yearMonth!, program_name: 'room_event', session_count: programData[0].room_event_count || 0, participant_count: programData[0].room_event_people || 0, book_count: 0 }
      ]
      const programUrl = `/api/floor1/program/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(programUrl, programPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const passIssuerValues = {
        infant_m: passIssuerData[0]?.infant_m || 0,
        infant_f: passIssuerData[0]?.infant_f || 0,
        elementary_m: passIssuerData[0]?.elementary_m || 0,
        elementary_f: passIssuerData[0]?.elementary_f || 0,
        middle_m: passIssuerData[0]?.middle_m || 0,
        middle_f: passIssuerData[0]?.middle_f || 0,
        adult_m: passIssuerData[0]?.adult_m || 0,
        adult_f: passIssuerData[0]?.adult_f || 0
      }
      const distributedPass = distributeWithLargestRemainder(passIssuerValues, gateTagCount)

      const aiLibraryPayload = {
        year_month: yearMonth!,
        bookbot: aiLibraryData[0].bookbot || 0,
        air_projection: aiLibraryData[0].air_projection || 0,
        finger_story: aiLibraryData[0].finger_story || 0,
        ar_book: aiLibraryData[0].ar_book || 0,
        pass_infant_m: distributedPass.infant_m,
        pass_infant_f: distributedPass.infant_f,
        pass_elementary_m: distributedPass.elementary_m,
        pass_elementary_f: distributedPass.elementary_f,
        pass_middle_m: distributedPass.middle_m,
        pass_middle_f: distributedPass.middle_f,
        pass_adult_m: distributedPass.adult_m,
        pass_adult_f: distributedPass.adult_f,
        unmanned_users: aiLibraryData[0].unmanned_users || 0,
        unmanned_books: aiLibraryData[0].unmanned_books || 0,
        total_users: aiLibraryData[0].total_users || 0,
        total_books: aiLibraryData[0].total_books || 0
      }
      const aiLibraryUrl = `/api/floor1/ai-library/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(aiLibraryUrl, aiLibraryPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (passIssuerData.length > 0) {
        const passIssuerPayload = {
          year_month: yearMonth!,
          infant_m: passIssuerData[0]?.infant_m || 0,
          infant_f: passIssuerData[0]?.infant_f || 0,
          elementary_m: passIssuerData[0]?.elementary_m || 0,
          elementary_f: passIssuerData[0]?.elementary_f || 0,
          middle_m: passIssuerData[0]?.middle_m || 0,
          middle_f: passIssuerData[0]?.middle_f || 0,
          adult_m: passIssuerData[0]?.adult_m || 0,
          adult_f: passIssuerData[0]?.adult_f || 0
        }
        const passIssuerUrl = `/api/floor1/pass-issuer/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
        await axios.post(passIssuerUrl, passIssuerPayload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      const gateTagPayload = {
        year_month: yearMonth!,
        total_count: gateTagCount || 0
      }
      const gateTagUrl = `/api/floor1/gate-tag/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(gateTagUrl, gateTagPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (regularMemberData.length > 0) {
        const regularMemberPayload = {
          year_month: yearMonth!,
          infant_m: regularMemberData[0]?.infant_m || 0,
          infant_f: regularMemberData[0]?.infant_f || 0,
          elementary_m: regularMemberData[0]?.elementary_m || 0,
          elementary_f: regularMemberData[0]?.elementary_f || 0,
          middle_m: regularMemberData[0]?.middle_m || 0,
          middle_f: regularMemberData[0]?.middle_f || 0,
          adult_m: regularMemberData[0]?.adult_m || 0,
          adult_f: regularMemberData[0]?.adult_f || 0
        }
        const regularMemberUrl = `/api/floor1/regular-member/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
        await axios.post(regularMemberUrl, regularMemberPayload, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      const ageGroups = ['infant_elementary', 'middle_high', 'adult']
      const interlibPayload: InterlibPayload[] = []
      ageGroups.forEach(ag => {
        interlibPayload.push({ year_month: yearMonth!, age_group: ag, category: '책바다', user_count: 0 })
        interlibPayload.push({ year_month: yearMonth!, age_group: ag, category: '책나래', user_count: 0 })
      })
      interlibPayload[4].user_count = interlibData.bookbada || 0
      interlibPayload[5].user_count = interlibData.booknare || 0
      const interlibUrl = `/api/floor23/visitor/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(interlibUrl, interlibPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const currentDataHash = JSON.stringify({
        visitorData, materialData, programData, aiLibraryData,
        passIssuerData, gateTagCount, regularMemberData, interlibData
      })

      if (currentDataHash !== lastSavedDataHash.current) {
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
        await axios.post(`${apiUrl}/api/snapshot/floor1/${yearMonth}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        lastSavedDataHash.current = currentDataHash
      }

      if (isAuto) {
        message.success({ content: '자동 저장됨', duration: 2, style: { marginTop: '20px' } })
      } else {
        message.success('데이터베이스에 저장되었습니다')
      }
    } catch (error: unknown) {
      console.error('Save error:', error)
      if (isAxiosError(error) && error.response?.status === 409) {
        Modal.confirm({
          title: '데이터 충돌',
          content: '다른 사용자가 이 데이터를 수정했습니다. 어떻게 하시겠습니까?',
          okText: '덮어쓰기',
          cancelText: '다시 불러오기',
          onOk: () => {
            handleSaveAll(isAuto, true)
          },
          onCancel: () => {
            loadData()
            message.info('최신 데이터를 불러왔습니다')
          }
        })
      } else if (!isAuto) {
        message.error(getErrorMessage(error))
      }
    } finally {
      if (!isAuto) setLoading(false)
      isSavingRef.current = false
    }
  }

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/floor1/input/${newYearMonth}`)
    }
  }

  const handleDownloadAutomation = async () => {
    const hide = message.loading('다운로드 중...', 0)
    try {
      const response = await fetch(`${API_BASE_URL}/api/automation/download`)
      if (!response.ok) {
        throw new Error('다운로드 실패')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'klas_automation.zip'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      hide()
      message.success('자동화 도구가 다운로드되었습니다')
    } catch (error: unknown) {
      hide()
      console.error('Download error:', error)
      message.error(getErrorMessage(error))
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA' } })

  const passIssuerColumns: ColumnsType<PassIssuerRow> = [
    {
      title: '유아\n(남)',
      dataIndex: 'infant_m',
      key: 'infant_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].infant_m = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '유아\n(여)',
      dataIndex: 'infant_f',
      key: 'infant_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].infant_f = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '초등\n(남)',
      dataIndex: 'elementary_m',
      key: 'elementary_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].elementary_m = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '초등\n(여)',
      dataIndex: 'elementary_f',
      key: 'elementary_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].elementary_f = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '중고등\n(남)',
      dataIndex: 'middle_m',
      key: 'middle_m',
      width: 65,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].middle_m = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '중고등\n(여)',
      dataIndex: 'middle_f',
      key: 'middle_f',
      width: 65,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].middle_f = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '일반\n(남)',
      dataIndex: 'adult_m',
      key: 'adult_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].adult_m = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '일반\n(여)',
      dataIndex: 'adult_f',
      key: 'adult_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...passIssuerData]; n[index].adult_f = val || 0; setPassIssuerData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (_, record) => {
        const total = (record.infant_m || 0) + (record.infant_f || 0) + (record.elementary_m || 0) + (record.elementary_f || 0) + (record.middle_m || 0) + (record.middle_f || 0) + (record.adult_m || 0) + (record.adult_f || 0)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const regularMemberColumns: ColumnsType<RegularMemberRow> = [
    {
      title: '유아\n(남)',
      dataIndex: 'infant_m',
      key: 'infant_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].infant_m = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '유아\n(여)',
      dataIndex: 'infant_f',
      key: 'infant_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].infant_f = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '초등\n(남)',
      dataIndex: 'elementary_m',
      key: 'elementary_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].elementary_m = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '초등\n(여)',
      dataIndex: 'elementary_f',
      key: 'elementary_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].elementary_f = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '중고등\n(남)',
      dataIndex: 'middle_m',
      key: 'middle_m',
      width: 65,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].middle_m = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '중고등\n(여)',
      dataIndex: 'middle_f',
      key: 'middle_f',
      width: 65,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].middle_f = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '일반\n(남)',
      dataIndex: 'adult_m',
      key: 'adult_m',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].adult_m = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '일반\n(여)',
      dataIndex: 'adult_f',
      key: 'adult_f',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...regularMemberData]; n[index].adult_f = val || 0; setRegularMemberData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 60,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (_, record) => {
        const total = (record.infant_m || 0) + (record.infant_f || 0) + (record.elementary_m || 0) + (record.elementary_f || 0) + (record.middle_m || 0) + (record.middle_f || 0) + (record.adult_m || 0) + (record.adult_f || 0)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const baseVisitorColumns: ColumnsType<VisitorRow> = [
    {
      title: '구분',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 36,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'infant_elementary': '유아/\n초등',
          'middle_high': '중고생',
          'adult': '일반',
          'sum': '계'
        }
        return labels[text] || text
      }
    },
    {
      title: '어린이자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '관외대출',
          dataIndex: 'children_loan',
          key: 'children_loan',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber
              value={v}
              onChange={(val) => {
                const newData = [...visitorData]
                newData[index].children_loan = val || 0
                setVisitorData(newData)
              }}
              onFocus={(e) => e.target.select()}
              min={0}
              controls={false}
              style={{ width: '100%', textAlign: 'center' }}
            />
          )
        },
        {
          title: '관내열람',
          dataIndex: 'children_read',
          key: 'children_read',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, record) => {
            const calculated = Math.round((record.children_loan || 0) * getReadingMultiplier('floor1'))
            return <span style={{ fontWeight: 'bold' }}>{calculated}</span>
          }
        }
      ]
    },
    {
      title: '유아자료실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '관외대출',
          dataIndex: 'infant_loan',
          key: 'infant_loan',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber
              value={v}
              onChange={(val) => {
                const newData = [...visitorData]
                newData[index].infant_loan = val || 0
                setVisitorData(newData)
              }}
              onFocus={(e) => e.target.select()}
              min={0}
              controls={false}
              style={{ width: '100%', textAlign: 'center' }}
            />
          )
        },
        {
          title: '관내열람',
          dataIndex: 'infant_read',
          key: 'infant_read',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, record) => {
            const calculated = Math.round((record.infant_loan || 0) * getReadingMultiplier('floor1'))
            return <span style={{ fontWeight: 'bold' }}>{calculated}</span>
          }
        }
      ]
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 36,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (_, record) => {
        const total = calculateVisitorTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const baseMaterialColumns: ColumnsType<MaterialRow> = [
    {
      title: '총류\n(000)',
      dataIndex: 'type_000',
      key: 'type_000',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_000 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()}
          min={0}
          controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '철학\n(100)',
      dataIndex: 'type_100',
      key: 'type_100',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_100 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '종교\n(200)',
      dataIndex: 'type_200',
      key: 'type_200',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_200 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '사회\n(300)',
      dataIndex: 'type_300',
      key: 'type_300',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_300 = val || 0
            setMaterialData(newData)
          }}
          min={0}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '자연\n(400)',
      dataIndex: 'type_400',
      key: 'type_400',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_400 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '기술\n(500)',
      dataIndex: 'type_500',
      key: 'type_500',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_500 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '예술\n(600)',
      dataIndex: 'type_600',
      key: 'type_600',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_600 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '언어\n(700)',
      dataIndex: 'type_700',
      key: 'type_700',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_700 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%', textAlign: 'center' }}
        />
      )
    },
    {
      title: '문학\n(800)',
      dataIndex: 'type_800',
      key: 'type_800',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_800 = val || 0
            setMaterialData(newData)
          }}
          onFocus={(e) => e.target.select()} min={0} controls={false}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '역사\n(900)',
      dataIndex: 'type_900',
      key: 'type_900',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].type_900 = val || 0
            setMaterialData(newData)
          }}
          min={0}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '기타',
      dataIndex: 'etc',
      key: 'etc',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            const newData = [...materialData]
            newData[index].etc = val || 0
            setMaterialData(newData)
          }}
          min={0}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: '계',
      dataIndex: 'month_total',
      key: 'month_total',
      width: 40,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (_, record) => {
        const total = calculateMaterialTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const baseProgramColumns: ColumnsType<ProgramRow> = [
    {
      title: headerAliases.program?.storytelling || '동화체험',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'storytelling_count',
          key: 'storytelling_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].storytelling_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '인원',
          dataIndex: 'storytelling_people',
          key: 'storytelling_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].storytelling_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: headerAliases.program?.library_tour || '도서관\n나들이',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'library_tour_count',
          key: 'library_tour_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].library_tour_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '인원',
          dataIndex: 'library_tour_people',
          key: 'library_tour_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].library_tour_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: headerAliases.program?.children_bookclub || '어린이\n북클럽',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'children_bookclub_count',
          key: 'children_bookclub_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].children_bookclub_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '인원',
          dataIndex: 'children_bookclub_people',
          key: 'children_bookclub_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].children_bookclub_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: headerAliases.program?.night_floor1 || '야간개관\n(어린이)',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'night_floor1_count',
          key: 'night_floor1_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].night_floor1_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '인원',
          dataIndex: 'night_floor1_people',
          key: 'night_floor1_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].night_floor1_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: headerAliases.program?.book_package || '책꾸러미',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수\n(권수)',
          dataIndex: 'book_package_count',
          key: 'book_package_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <InputNumber value={_record.book_package_count} onChange={(val) => { const n = [...programData]; n[index].book_package_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} placeholder="횟수" />
              <InputNumber value={_record.book_package_books} onChange={(val) => { const n = [...programData]; n[index].book_package_books = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} placeholder="권수" />
            </div>
          )
        },
        {
          title: '인원',
          dataIndex: 'book_package_people',
          key: 'book_package_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].book_package_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: headerAliases.program?.room_event || '자료실행사',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'room_event_count',
          key: 'room_event_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].room_event_count = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '인원',
          dataIndex: 'room_event_people',
          key: 'room_event_people',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _record, index) => (
            <InputNumber value={v} onChange={(val) => { const n = [...programData]; n[index].room_event_people = val || 0; setProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: '합계',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수',
          dataIndex: 'total_count',
          key: 'total_count',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (_, record) => {
            const totals = calculateProgramTotal(record)
            return <span style={{ fontWeight: 'bold' }}>{totals.count}</span>
          }
        },
        {
          title: '인원',
          dataIndex: 'total_people',
          key: 'total_people',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (_, record) => {
            const totals = calculateProgramTotal(record)
            return <span style={{ fontWeight: 'bold' }}>{totals.people}</span>
          }
        }
      ]
    }
  ]

  const baseAILibraryColumns: ColumnsType<AILibraryRow> = [
    {
      title: headerAliases.ai?.bookbot || '책봇\n(로미)',
      dataIndex: 'bookbot',
      key: 'bookbot',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber value={v} onChange={(val) => { const n = [...aiLibraryData]; n[index].bookbot = val || 0; setAILibraryData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: headerAliases.ai?.air_projection || '에어\n프로젝션',
      dataIndex: 'air_projection',
      key: 'air_projection',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            shouldBlockAutoCalc.current = true;
            const n = [...aiLibraryData];
            n[index].air_projection = val || 0;
            setAILibraryData(n);
            if (isExcludedMonth) {
              setTimeout(() => handleSaveAll(true), 500);
            }
          }}
          onFocus={(e) => e.target.select()}
          min={0}
          controls={false}
          disabled={aiAutomation.enabled && !isExcludedMonth}
          style={{ width: '100%', textAlign: 'center', backgroundColor: (aiAutomation.enabled && !isExcludedMonth) ? '#f5f5f5' : 'white' }}
        />
      )
    },
    {
      title: headerAliases.ai?.finger_story || '핑거\n스토리',
      dataIndex: 'finger_story',
      key: 'finger_story',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            shouldBlockAutoCalc.current = true;
            const n = [...aiLibraryData];
            n[index].finger_story = val || 0;
            setAILibraryData(n);
            if (isExcludedMonth) {
              setTimeout(() => handleSaveAll(true), 500);
            }
          }}
          onFocus={(e) => e.target.select()}
          min={0}
          controls={false}
          disabled={aiAutomation.enabled && !isExcludedMonth}
          style={{ width: '100%', textAlign: 'center', backgroundColor: (aiAutomation.enabled && !isExcludedMonth) ? '#f5f5f5' : 'white' }}
        />
      )
    },
    {
      title: headerAliases.ai?.ar_book || 'AR북',
      dataIndex: 'ar_book',
      key: 'ar_book',
      width: 29,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _record, index) => (
        <InputNumber
          value={v}
          onChange={(val) => {
            shouldBlockAutoCalc.current = true;
            const n = [...aiLibraryData];
            n[index].ar_book = val || 0;
            setAILibraryData(n);
            if (isExcludedMonth) {
              setTimeout(() => handleSaveAll(true), 500);
            }
          }}
          onFocus={(e) => e.target.select()}
          min={0}
          controls={false}
          disabled={aiAutomation.enabled && !isExcludedMonth}
          style={{ width: '100%', textAlign: 'center', backgroundColor: (aiAutomation.enabled && !isExcludedMonth) ? '#f5f5f5' : 'white' }}
        />
      )
    },
    {
      title: '1일출입증',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '유아\n(남)',
          dataIndex: 'pass_infant_m',
          key: 'pass_infant_m',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.infant_m || 0}</span>
        },
        {
          title: '유아\n(여)',
          dataIndex: 'pass_infant_f',
          key: 'pass_infant_f',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.infant_f || 0}</span>
        },
        {
          title: '초등\n(남)',
          dataIndex: 'pass_elementary_m',
          key: 'pass_elementary_m',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.elementary_m || 0}</span>
        },
        {
          title: '초등\n(여)',
          dataIndex: 'pass_elementary_f',
          key: 'pass_elementary_f',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.elementary_f || 0}</span>
        },
        {
          title: '중고등\n(남)',
          dataIndex: 'pass_middle_m',
          key: 'pass_middle_m',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.middle_m || 0}</span>
        },
        {
          title: '중고등\n(여)',
          dataIndex: 'pass_middle_f',
          key: 'pass_middle_f',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.middle_f || 0}</span>
        },
        {
          title: '일반\n(남)',
          dataIndex: 'pass_adult_m',
          key: 'pass_adult_m',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.adult_m || 0}</span>
        },
        {
          title: '일반\n(여)',
          dataIndex: 'pass_adult_f',
          key: 'pass_adult_f',
          width: 28,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => <span style={{ fontWeight: 'bold' }}>{distributedPassValues.adult_f || 0}</span>
        }
      ]
    },
    {
      title: '상호\n대차',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '책바다',
          dataIndex: 'bookbada',
          key: 'bookbada',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => (
            <InputNumber value={interlibData.bookbada} onChange={(val) => setInterlibData({...interlibData, bookbada: val || 0})} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '책나래',
          dataIndex: 'booknare',
          key: 'booknare',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: () => (
            <InputNumber value={interlibData.booknare} onChange={(val) => setInterlibData({...interlibData, booknare: val || 0})} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>1층 어린이자료실 데이터 입력 - {yearMonth}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button icon={<SwapOutlined />} onClick={() => navigate(`/floor23/input/${yearMonth}`)} type="dashed">
            2/3층 이동
          </Button>
          {klasAutomation.enabled && (
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadAutomation}
              disabled={new Date() < new Date('2026-01-01')}
              title={new Date() < new Date('2026-01-01') ? '1월 1일부터 다운로드 가능' : ''}
            >
              KLAS 자동화 도구
            </Button>
          )}
          <DatePicker
            picker="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            format="YYYY-MM"
          />
          <Button type="primary" onClick={() => handleSaveAll(false)} loading={loading}>일괄 저장</Button>
        </div>
      </div>

      {isExcludedMonth && (
        <Alert
          message="자동 계산 제외됨"
          description="이 월은 자동 계산에서 제외되었습니다. AI 도서관 데이터를 수동으로 입력할 수 있습니다."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={visitorData}
            columns={baseVisitorColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
            tableLayout="fixed"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(주제별)</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialData}
            columns={baseMaterialColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 행사 및 프로그램</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            key={`program-${JSON.stringify(headerAliases.program || {})}`}
            className="black-bordered-table"
            dataSource={programData}
            columns={baseProgramColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            key={`ai-${JSON.stringify(headerAliases.ai || {})}`}
            className="black-bordered-table"
            dataSource={aiLibraryData}
            columns={baseAILibraryColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
            scroll={{ x: 'max-content' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 1일 출입증 (발급기)</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={passIssuerData}
            columns={passIssuerColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 출입게이트 (태그기)</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', border: '1px solid #d9d9d9', borderRadius: 4, backgroundColor: '#fafafa' }}>
            <span style={{ fontWeight: 'bold' }}>총 태그 수(일일출입증만):</span>
            <InputNumber value={gateTagCount} onChange={(val) => setGateTagCount(val || 0)} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: 150 }} />
            <span style={{ marginLeft: 32, fontWeight: 'bold', color: '#1890ff' }}>
              배수: {(() => {
                const issuerTotal = (passIssuerData[0]?.infant_m || 0) + (passIssuerData[0]?.infant_f || 0) + (passIssuerData[0]?.elementary_m || 0) + (passIssuerData[0]?.elementary_f || 0) + (passIssuerData[0]?.middle_m || 0) + (passIssuerData[0]?.middle_f || 0) + (passIssuerData[0]?.adult_m || 0) + (passIssuerData[0]?.adult_f || 0)
                return issuerTotal > 0 ? (gateTagCount / issuerTotal).toFixed(11) : '0'
              })()}
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 정회원</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={regularMemberData}
            columns={regularMemberColumns}
            pagination={false}
            loading={loading || remoteLoading}
            bordered
            size="small"
          />
        </div>
      </Card>
    </div>
  )
}
