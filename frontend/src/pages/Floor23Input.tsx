import { useState, useEffect, useRef } from 'react'
import { Card, Table, InputNumber, Button, message, Tabs, DatePicker, Modal } from 'antd'
import { DownloadOutlined, SwapOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { floor23Api, floor1Api } from '../services/api'
import { useAuthStore } from '../store/authStore'
import axios from 'axios'
import dayjs, { Dayjs } from 'dayjs'
import { getFloor23KLASAutomation, getReadingMultiplier } from '../utils/libraryDays'
import { io, Socket } from 'socket.io-client'
import { API_BASE_URL } from '../config/api'
import '../styles/table.css'
import { getErrorMessage, isAxiosError } from '../utils/errorHandler'

const renderNumber = (v: number | undefined) => Math.round(v || 0).toLocaleString()

interface VisitorRecord {
  key?: number
  age_group: string
  loan?: number
  bookbada?: number
  booknare?: number
  comic?: number
  english?: number
  dabom?: number
  humanities?: number
  multimedia?: number
  periodical?: number
  movie?: number
  music?: number
  gallery?: number
  comic_read?: number
  english_read?: number
  dabom_read?: number
  humanities_read?: number
}

interface MaterialSubjectRecord {
  key?: number
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
}

interface MaterialGeneralRecord {
  key?: number
  type: string
  general_books: number
  comic: number
  english: number
  multicultural: number
  large_print: number
  dementia: number
  easy_read: number
  braille: number
}

interface MaterialHumanitiesRecord {
  key?: number
  type: string
  books?: number
  newspaper?: number
  magazine?: number
  ebook?: number
  audiobook?: number
  ejournal?: number
  online_magazine_pc?: number
  online_magazine_mobile?: number
  waveon?: number
  flybook?: number
}

interface Floor3MaterialHumanitiesRecord {
  key?: number
  usage_type: string
  newspaper?: number
  magazine?: number
  ebook?: number
  audiobook?: number
  ejournal?: number
  online_magazine_pc?: number
  online_magazine_mobile?: number
  waveon?: number
  flybook?: number
}

interface ProgramRecord {
  key: number
  night_floor23_count: number
  night_floor23_people: number
  teen_experience_count: number
  teen_experience_people: number
  volunteer_education_count: number
  volunteer_education_people: number
  dabom_program_count: number
  dabom_program_people: number
  face_reading_count: number
  face_reading_people: number
  healing_concert_count: number
  healing_concert_people: number
  room_event_count: number
  room_event_people: number
}

interface AISmartLibraryRecord {
  key?: number
  literature_vending: number
  unmanned_card_issuer: number
  smart_loan_users: number
  smart_loan_books: number
  smart_return_users: number
  smart_return_books: number
  smart_reservation_users: number
  smart_reservation_books: number
}

interface AIEquipmentRecord {
  key?: number
  bookbot?: number
  book_kiosk?: number
  laptop?: number
  tablet?: number
  book_scanner?: number
  enews?: number
  users?: number
}

export default function Floor23Input() {
  const { yearMonth } = useParams()
  const navigate = useNavigate()
  const { token } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(dayjs(yearMonth))
  const [klasAutomation, setKLASAutomation] = useState(getFloor23KLASAutomation())

  const [floor2VisitorData, setFloor2VisitorData] = useState<VisitorRecord[]>([])
  const [floor2MaterialSubjectData, setFloor2MaterialSubjectData] = useState<MaterialSubjectRecord[]>([])
  const [floor2MaterialGeneralData, setFloor2MaterialGeneralData] = useState<MaterialGeneralRecord[]>([])
  const [floor2MaterialHumanitiesData, setFloor2MaterialHumanitiesData] = useState<MaterialHumanitiesRecord[]>([])
  const [floor2ProgramData, setFloor2ProgramData] = useState<ProgramRecord[]>([])
  const [floor2AISmartData, setFloor2AISmartData] = useState<AISmartLibraryRecord[]>([])
  const [floor2AIEquipmentData, setFloor2AIEquipmentData] = useState<AIEquipmentRecord[]>([])

  const [floor3VisitorData, setFloor3VisitorData] = useState<VisitorRecord[]>([])
  const [floor3MaterialHumanitiesData, setFloor3MaterialHumanitiesData] = useState<Floor3MaterialHumanitiesRecord[]>([])
  const [floor3AIEquipmentData, setFloor3AIEquipmentData] = useState<AIEquipmentRecord[]>([])

  const [unmannedData, setUnmannedData] = useState<any>({ unmanned_users: 0, unmanned_books: 0 })

  const lastSavedDataHash = useRef<string>('')
  const socketRef = useRef<Socket | null>(null)
  const isMountedRef = useRef(true)
  const connectionStateRef = useRef<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const isSavingRef = useRef(false)

  useEffect(() => {
    loadLocalData()
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
      socket.emit('join_room', { room: `floor23-${yearMonth}` })
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

    socket.on('floor23_data_updated', (data) => {
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
        loadLocalData().finally(() => {
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
      socket.emit('join_room', { room: `floor23-${yearMonth}` })
    })

    return () => {
      if (connectionStateRef.current === 'connected' && socketRef.current) {
        socketRef.current.emit('leave_room', { room: `floor23-${yearMonth}` })
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
    const handleVisibilityChange = () => {
      if (document.hidden) {
        return
      }
      setKLASAutomation(getFloor23KLASAutomation())
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'floor23_klas_automation') {
        setKLASAutomation(getFloor23KLASAutomation())
      }
    }

    const handleFocus = () => {
      setKLASAutomation(getFloor23KLASAutomation())
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

  const handleMonthChange = (date: Dayjs | null) => {
    if (date) {
      const newYearMonth = date.format('YYYY-MM')
      setSelectedMonth(date)
      navigate(`/floor23/input/${newYearMonth}`)
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
      const axiosError = error as { response?: { data?: { detail?: string } } }
      message.error(axiosError.response?.data?.detail || '다운로드에 실패했습니다')
    }
  }

  const loadLocalData = async () => {
    const ageGroups = ['infant_elementary', 'middle_high', 'adult']

    try {
      const visitorRes = await floor23Api.getVisitor(yearMonth!)
      const visitorData = visitorRes.data

      const floor2Map: any = {}
      const floor3Map: any = {}
      ageGroups.forEach(ag => {
        floor2Map[ag] = { age_group: ag, loan: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, comic_read: 0, english_read: 0, dabom_read: 0, humanities_read: 0 }
        floor3Map[ag] = { age_group: ag, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0 }
      })

      visitorData.forEach((item: any) => {
        if (item.age_group === 'sum') return
        const catMap: any = {
          '자료이용': 'loan', '책바다': 'bookbada', '책나래': 'booknare', '만화책마루': 'comic',
          '영어책마루': 'english', '다봄자료실': 'dabom', '인문예술자료실': 'humanities',
          '멀티미디어존': 'multimedia', '간행물존': 'periodical', '영화': 'movie', '음악': 'music', '디지털갤러리': 'gallery',
          '만화책마루_열람': 'comic_read', '영어책마루_열람': 'english_read', '다봄자료실_열람': 'dabom_read', '인문예술자료실_열람': 'humanities_read'
        }
        const key = catMap[item.category]
        if (key) {
          if (['loan', 'bookbada', 'booknare', 'comic', 'english', 'dabom', 'humanities', 'comic_read', 'english_read', 'dabom_read', 'humanities_read'].includes(key)) {
            floor2Map[item.age_group][key] = item.user_count || 0
          } else {
            floor3Map[item.age_group][key] = item.user_count || 0
          }
        }
      })

      setFloor2VisitorData(ageGroups.map((ag, i) => ({ key: i, ...floor2Map[ag] })))
      setFloor3VisitorData(ageGroups.map((ag, i) => ({ key: i, ...floor3Map[ag] })))
    } catch {
      setFloor2VisitorData(ageGroups.map((ag, i) => ({ key: i, age_group: ag, loan: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, comic_read: 0, english_read: 0, dabom_read: 0, humanities_read: 0 })))
      setFloor3VisitorData(ageGroups.map((ag, i) => ({ key: i, age_group: ag, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0 })))
    }

    try {
      const materialSubjectRes = await floor23Api.getMaterialSubject(yearMonth!)
      const subjectData = materialSubjectRes.data
      const subjectMap: any = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
      subjectData.forEach((item: any) => {
        if (item.usage_type === 'loan') {
          const key = `type_${item.subject_code}`
          if (subjectMap.hasOwnProperty(key)) subjectMap[key] = item.book_count || 0
        }
      })
      setFloor2MaterialSubjectData([{ key: 0, type: 'loan', ...subjectMap }])
    } catch {
      setFloor2MaterialSubjectData([{ key: 0, type: 'loan', type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }])
    }

    try {
      const materialTypeRes = await floor23Api.getMaterialType(yearMonth!)
      const typeData = materialTypeRes.data
      const generalMap: any = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }
      const humanitiesFloor2Map: any = { books: 0 }

      const floor3ReadMap: any = { newspaper: 0, magazine: 0, audiobook: 0, online_magazine_pc: 0, online_magazine_mobile: 0, flybook: 0, ejournal: 0, ebook: 0, waveon: 0 }
      const floor3LoanMap: any = { newspaper: 0, magazine: 0, audiobook: 0, online_magazine_pc: 0, online_magazine_mobile: 0, flybook: 0, ejournal: 0, ebook: 0, waveon: 0 }
      const floor3UseMap: any = { newspaper: 0, magazine: 0, audiobook: 0, online_magazine_pc: 0, online_magazine_mobile: 0, flybook: 0, ejournal: 0, ebook: 0, waveon: 0 }

      typeData.forEach((item: any) => {
        if (item.usage_type === 'loan') {
          if (generalMap.hasOwnProperty(item.material_type)) generalMap[item.material_type] = item.book_count || 0
          if (humanitiesFloor2Map.hasOwnProperty(item.material_type)) humanitiesFloor2Map[item.material_type] = item.book_count || 0
          if (floor3LoanMap.hasOwnProperty(item.material_type)) floor3LoanMap[item.material_type] = item.book_count || 0
        } else if (item.usage_type === 'read') {
          if (floor3ReadMap.hasOwnProperty(item.material_type)) floor3ReadMap[item.material_type] = item.book_count || 0
        } else if (item.usage_type === 'use') {
          if (floor3UseMap.hasOwnProperty(item.material_type)) floor3UseMap[item.material_type] = item.book_count || 0
        }
      })

      setFloor2MaterialGeneralData([{ key: 0, type: 'loan', ...generalMap }])
      setFloor2MaterialHumanitiesData([{ key: 0, type: 'loan', ...humanitiesFloor2Map }])
      setFloor3MaterialHumanitiesData([
        { key: 0, usage_type: 'read', ...floor3ReadMap },
        { key: 1, usage_type: 'loan', ...floor3LoanMap },
        { key: 2, usage_type: 'use', ...floor3UseMap }
      ])
    } catch {
      setFloor2MaterialGeneralData([{ key: 0, type: 'loan', general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }])
      setFloor2MaterialHumanitiesData([{ key: 0, type: 'loan', books: 0 }])
      setFloor3MaterialHumanitiesData([
        { key: 0, usage_type: 'read', newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 },
        { key: 1, usage_type: 'loan', newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 },
        { key: 2, usage_type: 'use', newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
      ])
    }

    try {
      const programRes = await floor23Api.getProgram(yearMonth!)
      const programs = programRes.data
      const programMap: any = { night_floor23_count: 0, night_floor23_people: 0, teen_experience_count: 0, teen_experience_people: 0, volunteer_education_count: 0, volunteer_education_people: 0, dabom_program_count: 0, dabom_program_people: 0, face_reading_count: 0, face_reading_people: 0, healing_concert_count: 0, healing_concert_people: 0, room_event_count: 0, room_event_people: 0 }
      programs.forEach((p: any) => {
        const nameMap: any = { '야간개관(일반)': 'night_floor23', '북적북적청소년체험': 'teen_experience', '자원봉사자교육': 'volunteer_education', '다봄프로그램': 'dabom_program', '대면낭독': 'face_reading', '힐링북콘서트': 'healing_concert', '자료실행사': 'room_event' }
        const prefix = nameMap[p.program_name]
        if (prefix) {
          programMap[`${prefix}_count`] = p.session_count || 0
          programMap[`${prefix}_people`] = p.participant_count || 0
        }
      })
      setFloor2ProgramData([{ key: 0, ...programMap }])
    } catch {
      setFloor2ProgramData([{ key: 0, night_floor23_count: 0, night_floor23_people: 0, teen_experience_count: 0, teen_experience_people: 0, volunteer_education_count: 0, volunteer_education_people: 0, dabom_program_count: 0, dabom_program_people: 0, face_reading_count: 0, face_reading_people: 0, healing_concert_count: 0, healing_concert_people: 0, room_event_count: 0, room_event_people: 0 }])
    }

    try {
      const aiSmartRes = await floor23Api.getAISmart(yearMonth!)
      const aiSmart = aiSmartRes.data
      if (aiSmart) {
        setFloor2AISmartData([{ key: 0, ...aiSmart }])
      } else {
        setFloor2AISmartData([{ key: 0, literature_vending: 0, unmanned_card_issuer: 0, smart_loan_users: 0, smart_loan_books: 0, smart_return_users: 0, smart_return_books: 0, smart_reservation_users: 0, smart_reservation_books: 0 }])
      }
    } catch {
      setFloor2AISmartData([{ key: 0, literature_vending: 0, unmanned_card_issuer: 0, smart_loan_users: 0, smart_loan_books: 0, smart_return_users: 0, smart_return_books: 0, smart_reservation_users: 0, smart_reservation_books: 0 }])
    }

    try {
      const floor2EquipRes = await floor23Api.getAIEquipment(yearMonth!, 'floor2')
      const floor2Equip = floor2EquipRes.data
      if (floor2Equip) {
        setFloor2AIEquipmentData([{ key: 0, bookbot: floor2Equip.bookbot || 0, book_kiosk: floor2Equip.book_kiosk || 0 }])
      } else {
        setFloor2AIEquipmentData([{ key: 0, bookbot: 0, book_kiosk: 0 }])
      }
    } catch {
      setFloor2AIEquipmentData([{ key: 0, bookbot: 0, book_kiosk: 0 }])
    }

    try {
      const floor3EquipRes = await floor23Api.getAIEquipment(yearMonth!, 'floor3')
      const floor3Equip = floor3EquipRes.data
      if (floor3Equip) {
        setFloor3AIEquipmentData([{ key: 0, laptop: floor3Equip.laptop || 0, tablet: floor3Equip.tablet || 0, book_scanner: floor3Equip.book_scanner || 0, enews: floor3Equip.enews || 0, users: floor3Equip.users || 0 }])
      } else {
        setFloor3AIEquipmentData([{ key: 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0 }])
      }
    } catch {
      setFloor3AIEquipmentData([{ key: 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0 }])
    }

    try {
      const unmannedRes = await floor1Api.getAILibrary(yearMonth!)
      setUnmannedData({
        unmanned_users: unmannedRes.data?.unmanned_users || 0,
        unmanned_books: unmannedRes.data?.unmanned_books || 0
      })
    } catch {
      setUnmannedData({ unmanned_users: 0, unmanned_books: 0 })
    }
  }

  const handleSaveAll = async (isAuto = false, forceOverwrite = false) => {
    if (isSavingRef.current) return
    isSavingRef.current = true
    if (!isAuto) setLoading(true)
    try {
      const visitorPayload: any[] = []
      const catMap = { loan: '자료이용', bookbada: '책바다', booknare: '책나래', comic: '만화책마루', english: '영어책마루', dabom: '다봄자료실', humanities: '인문예술자료실' }
      floor2VisitorData.forEach(row => {
        Object.entries(catMap).forEach(([key, cat]) => {
          visitorPayload.push({ year_month: yearMonth!, age_group: row.age_group, category: cat, user_count: (row as any)[key] || 0 })
        })
      })
      const catMap3 = { multimedia: '멀티미디어존', periodical: '간행물존', movie: '영화', music: '음악', gallery: '디지털갤러리' }
      floor3VisitorData.forEach(row => {
        Object.entries(catMap3).forEach(([key, cat]) => {
          visitorPayload.push({ year_month: yearMonth!, age_group: row.age_group, category: cat, user_count: (row as any)[key] || 0 })
        })
      })
      const visitorUrl = `/api/floor23/visitor/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(visitorUrl, visitorPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const subjectPayload: any[] = []
      floor2MaterialSubjectData.forEach(row => {
        ['000', '100', '200', '300', '400', '500', '600', '700', '800', '900', 'etc'].forEach(code => {
          subjectPayload.push({ year_month: yearMonth!, usage_type: 'loan', subject_code: code, book_count: (row as any)[`type_${code}`] || 0 })
        })
      })
      const subjectUrl = `/api/floor23/material-subject/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(subjectUrl, subjectPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const typePayload: any[] = []
      floor2MaterialGeneralData.forEach(row => {
        ['general_books', 'comic', 'english', 'multicultural', 'large_print', 'dementia', 'easy_read', 'braille'].forEach(type => {
          typePayload.push({ year_month: yearMonth!, room_type: 'general', usage_type: 'loan', material_type: type, book_count: (row as any)[type] || 0 })
        })
      })
      floor2MaterialHumanitiesData.forEach(row => {
        typePayload.push({ year_month: yearMonth!, room_type: 'humanities', usage_type: 'loan', material_type: 'books', book_count: row.books || 0 })
      })
      floor3MaterialHumanitiesData.forEach(row => {
        ['newspaper', 'magazine', 'ebook', 'audiobook', 'ejournal', 'online_magazine_pc', 'online_magazine_mobile', 'waveon', 'flybook'].forEach(type => {
          typePayload.push({ year_month: yearMonth!, room_type: 'humanities', usage_type: row.usage_type, material_type: type, book_count: (row as any)[type] || 0 })
        })
      })
      const typeUrl = `/api/floor23/material-type/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(typeUrl, typePayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const programPayload: any[] = []
      const programNameMap: any = { night_floor23: '야간개관(일반)', teen_experience: '북적북적청소년체험', volunteer_education: '자원봉사자교육', dabom_program: '다봄프로그램', face_reading: '대면낭독', healing_concert: '힐링 북콘서트', room_event: '자료실행사' }
      floor2ProgramData.forEach(row => {
        Object.entries(programNameMap).forEach(([prefix, name]) => {
          programPayload.push({ year_month: yearMonth!, program_name: name, session_count: (row as any)[`${prefix}_count`] || 0, participant_count: (row as any)[`${prefix}_people`] || 0 })
        })
      })
      const programUrl = `/api/floor23/program/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(programUrl, programPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (floor2AISmartData[0]) {
        const aiSmartUrl = `/api/floor23/ai-smart/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
        await axios.post(aiSmartUrl, { year_month: yearMonth!, ...floor2AISmartData[0] }, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }

      const equipPayload: any[] = []
      if (floor2AIEquipmentData[0]) {
        equipPayload.push({ year_month: yearMonth!, floor: 'floor2', bookbot: floor2AIEquipmentData[0].bookbot || 0, book_kiosk: floor2AIEquipmentData[0].book_kiosk || 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0 })
      }
      if (floor3AIEquipmentData[0]) {
        equipPayload.push({ year_month: yearMonth!, floor: 'floor3', bookbot: 0, book_kiosk: 0, laptop: floor3AIEquipmentData[0].laptop || 0, tablet: floor3AIEquipmentData[0].tablet || 0, book_scanner: floor3AIEquipmentData[0].book_scanner || 0, enews: floor3AIEquipmentData[0].enews || 0, users: floor3AIEquipmentData[0].users || 0 })
      }
      const equipUrl = `/api/floor23/ai-equipment/${yearMonth}${forceOverwrite ? '?force=true' : ''}`
      await axios.post(equipUrl, equipPayload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      const unmannedRes = await floor1Api.getAILibrary(yearMonth!)
      const unmannedPayload = {
        year_month: yearMonth!,
        ...unmannedRes.data,
        unmanned_users: unmannedData.unmanned_users || 0,
        unmanned_books: unmannedData.unmanned_books || 0
      }
      await floor1Api.saveAILibrary(yearMonth!, unmannedPayload, forceOverwrite)

      const currentDataHash = JSON.stringify({
        floor2VisitorData, floor2MaterialSubjectData, floor2MaterialGeneralData,
        floor2MaterialHumanitiesData, floor2ProgramData, floor2AISmartData, floor2AIEquipmentData,
        floor3VisitorData, floor3MaterialHumanitiesData, floor3AIEquipmentData, unmannedData
      })

      if (currentDataHash !== lastSavedDataHash.current) {
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin
        await axios.post(`${apiUrl}/api/snapshot/floor23/${yearMonth}`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        lastSavedDataHash.current = currentDataHash
      }

      if (isAuto) {
        message.success({ content: '자동 저장됨', duration: 2, style: { marginTop: '20px' } })
      } else {
        message.success('저장되었습니다')
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
            loadLocalData()
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

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA' } })

  const getAgeGroupLabel = (age: string) => {
    const labels: Record<string, string> = {
      'infant_elementary': '유아/초등',
      'middle_high': '중고생',
      'adult': '일반',
      'sum': '계'
    }
    return labels[age] || age
  }


  const calculateReadingValue = (loanValue: number) => {
    const multiplier = getReadingMultiplier('floor23')
    return Math.round(loanValue * multiplier)
  }

  const calculateFloor2VisitorTotal = (row: VisitorRecord) => {
    return (row.loan || 0) + (row.bookbada || 0) + (row.booknare || 0) +
           (row.comic || 0) + (row.english || 0) + (row.dabom || 0) + (row.humanities || 0)
  }

  const calculateFloor3VisitorTotal = (row: VisitorRecord) => {
    return (row.multimedia || 0) + (row.periodical || 0) + (row.movie || 0) +
           (row.music || 0) + (row.gallery || 0)
  }

  const calculateMaterialSubjectTotal = (row: MaterialSubjectRecord) => {
    return (row.type_000 || 0) + (row.type_100 || 0) + (row.type_200 || 0) +
           (row.type_300 || 0) + (row.type_400 || 0) + (row.type_500 || 0) +
           (row.type_600 || 0) + (row.type_700 || 0) + (row.type_800 || 0) +
           (row.type_900 || 0) + (row.etc || 0)
  }

  const calculateMaterialGeneralTotal = (row: MaterialGeneralRecord) => {
    return (row.general_books || 0) + (row.comic || 0) + (row.english || 0) +
           (row.multicultural || 0) + (row.large_print || 0) + (row.dementia || 0) +
           (row.easy_read || 0) + (row.braille || 0)
  }

  const calculateFloor3HumanitiesTotal = (row: Floor3MaterialHumanitiesRecord) => {
    return (row.newspaper || 0) + (row.magazine || 0) + (row.ebook || 0) +
           (row.audiobook || 0) + (row.ejournal || 0) + (row.online_magazine_pc || 0) +
           (row.online_magazine_mobile || 0) + (row.waveon || 0) + (row.flybook || 0)
  }

  const calculateProgramTotal = (row: ProgramRecord) => {
    return {
      count: (row.night_floor23_count || 0) + (row.teen_experience_count || 0) +
             (row.volunteer_education_count || 0) + (row.dabom_program_count || 0) +
             (row.face_reading_count || 0) + (row.healing_concert_count || 0) + (row.room_event_count || 0),
      people: (row.night_floor23_people || 0) + (row.teen_experience_people || 0) +
              (row.volunteer_education_people || 0) + (row.dabom_program_people || 0) +
              (row.face_reading_people || 0) + (row.healing_concert_people || 0) + (row.room_event_people || 0)
    }
  }

  const floor2VisitorColumns: ColumnsType<VisitorRecord> = [
    {
      title: '구분',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (text: string) => getAgeGroupLabel(text)
    },
    {
      title: '자료\n이용',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '대출',
          dataIndex: 'loan',
          key: 'loan',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _r: VisitorRecord, i: number) => (
            <InputNumber value={v} onChange={(val) => { const n = [...floor2VisitorData]; n[i].loan = val || 0; setFloor2VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: '무인\n반납실',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '이용자수',
          dataIndex: 'unmanned_users',
          key: 'unmanned_users',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (_v: any, _r: VisitorRecord, i: number) => _r.age_group === 'adult' ? (
            <InputNumber value={unmannedData.unmanned_users} onChange={(val) => setUnmannedData({...unmannedData, unmanned_users: val || 0})} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          ) : null
        },
        {
          title: '이용권수',
          dataIndex: 'unmanned_books',
          key: 'unmanned_books',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (_v: any, _r: VisitorRecord, i: number) => _r.age_group === 'adult' ? (
            <InputNumber value={unmannedData.unmanned_books} onChange={(val) => setUnmannedData({...unmannedData, unmanned_books: val || 0})} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          ) : null
        }
      ]
    },
    {
      title: '만화\n책마루',
      dataIndex: 'comic',
      key: 'comic',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor2VisitorData]; n[i].comic = val || 0; setFloor2VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '영어\n책마루',
      dataIndex: 'english',
      key: 'english',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor2VisitorData]; n[i].english = val || 0; setFloor2VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '다봄\n자료실',
      dataIndex: 'dabom',
      key: 'dabom',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor2VisitorData]; n[i].dabom = val || 0; setFloor2VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: <span style={{ whiteSpace: 'pre-line' }}>{'인문예술\n자료실'}</span>,
      dataIndex: 'humanities',
      key: 'humanities',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor2VisitorData]; n[i].humanities = val || 0; setFloor2VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '만화책마루\n열람',
      dataIndex: 'comic_read',
      key: 'comic_read',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#F5F5F5' } }),
      render: (_: any, record: VisitorRecord) => {
        const readingValue = calculateReadingValue(record.comic || 0)
        return <span style={{ color: '#888', fontSize: '12px' }}>{readingValue}</span>
      }
    },
    {
      title: '영어책마루\n열람',
      dataIndex: 'english_read',
      key: 'english_read',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#F5F5F5' } }),
      render: (_: any, record: VisitorRecord) => {
        const readingValue = calculateReadingValue(record.english || 0)
        return <span style={{ color: '#888', fontSize: '12px' }}>{readingValue}</span>
      }
    },
    {
      title: '다봄자료실\n열람',
      dataIndex: 'dabom_read',
      key: 'dabom_read',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#F5F5F5' } }),
      render: (_: any, record: VisitorRecord) => {
        const readingValue = calculateReadingValue(record.dabom || 0)
        return <span style={{ color: '#888', fontSize: '12px' }}>{readingValue}</span>
      }
    },
    {
      title: <span style={{ whiteSpace: 'pre-line' }}>{'인문예술\n자료실\n열람'}</span>,
      dataIndex: 'humanities_read',
      key: 'humanities_read',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#F5F5F5' } }),
      render: (_: any, record: VisitorRecord) => {
        const readingValue = calculateReadingValue(record.humanities || 0)
        return <span style={{ color: '#888', fontSize: '12px' }}>{readingValue}</span>
      }
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 36,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (_: any, record: VisitorRecord) => {
        const total = calculateFloor2VisitorTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const floor3VisitorColumns: ColumnsType<VisitorRecord> = [
    {
      title: '구분',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (text: string) => getAgeGroupLabel(text)
    },
    {
      title: '멀티\n미디어존',
      dataIndex: 'multimedia',
      key: 'multimedia',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor3VisitorData]; n[i].multimedia = val || 0; setFloor3VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '간행물\n존',
      dataIndex: 'periodical',
      key: 'periodical',
      width: 28,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor3VisitorData]; n[i].periodical = val || 0; setFloor3VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '영화\n음악존',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '영화',
          dataIndex: 'movie',
          key: 'movie',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _r: VisitorRecord, i: number) => (
            <InputNumber value={v} onChange={(val) => { const n = [...floor3VisitorData]; n[i].movie = val || 0; setFloor3VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        },
        {
          title: '음악',
          dataIndex: 'music',
          key: 'music',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, _r: VisitorRecord, i: number) => (
            <InputNumber value={v} onChange={(val) => { const n = [...floor3VisitorData]; n[i].music = val || 0; setFloor3VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
          )
        }
      ]
    },
    {
      title: '디지털\n갤러리',
      dataIndex: 'gallery',
      key: 'gallery',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, _r: VisitorRecord, i: number) => (
        <InputNumber value={v} onChange={(val) => { const n = [...floor3VisitorData]; n[i].gallery = val || 0; setFloor3VisitorData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      )
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 36,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2 }),
      render: (_: any, record: VisitorRecord) => {
        const total = calculateFloor3VisitorTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const materialSubjectColumns: ColumnsType<MaterialSubjectRecord> = [
    { title: '총류\n(000)', dataIndex: 'type_000', key: 'type_000', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_000 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '철학\n(100)', dataIndex: 'type_100', key: 'type_100', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_100 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '종교\n(200)', dataIndex: 'type_200', key: 'type_200', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_200 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '사회\n(300)', dataIndex: 'type_300', key: 'type_300', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_300 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '자연\n(400)', dataIndex: 'type_400', key: 'type_400', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_400 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '기술\n(500)', dataIndex: 'type_500', key: 'type_500', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_500 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '예술\n(600)', dataIndex: 'type_600', key: 'type_600', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_600 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '언어\n(700)', dataIndex: 'type_700', key: 'type_700', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_700 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '문학\n(800)', dataIndex: 'type_800', key: 'type_800', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_800 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '역사\n(900)', dataIndex: 'type_900', key: 'type_900', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].type_900 = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '기타', dataIndex: 'etc', key: 'etc', width: 29, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialSubjectRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialSubjectData]; n[i].etc = val || 0; setFloor2MaterialSubjectData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '계', dataIndex: 'total', key: 'total', width: 40, align: 'center', onHeaderCell: headerStyle,
      render: (_: any, record: MaterialSubjectRecord) => {
        const total = calculateMaterialSubjectTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const materialGeneralColumns: ColumnsType<MaterialGeneralRecord> = [
    { title: '일반도서', dataIndex: 'general_books', key: 'general_books', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].general_books = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '만화책마루', dataIndex: 'comic', key: 'comic', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].comic = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '영어', dataIndex: 'english', key: 'english', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].english = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '다문화', dataIndex: 'multicultural', key: 'multicultural', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].multicultural = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '큰글자', dataIndex: 'large_print', key: 'large_print', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].large_print = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '치매극복', dataIndex: 'dementia', key: 'dementia', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].dementia = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '읽기\n쉬운책', dataIndex: 'easy_read', key: 'easy_read', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].easy_read = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '점자', dataIndex: 'braille', key: 'braille', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialGeneralRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialGeneralData]; n[i].braille = val || 0; setFloor2MaterialGeneralData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '계', dataIndex: 'total', key: 'total', width: 40, align: 'center', onHeaderCell: headerStyle,
      render: (_: any, record: MaterialGeneralRecord) => {
        const total = calculateMaterialGeneralTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const floor2MaterialHumanitiesColumns: ColumnsType<MaterialHumanitiesRecord> = [
    { title: '도서', dataIndex: 'books', key: 'books', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: MaterialHumanitiesRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2MaterialHumanitiesData]; n[i].books = val || 0; setFloor2MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    }
  ]

  const floor3MaterialHumanitiesColumns: ColumnsType<Floor3MaterialHumanitiesRecord> = [
    {
      title: '구분',
      dataIndex: 'usage_type',
      key: 'usage_type',
      width: 40,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => {
        const labels: Record<string, string> = {
          'read': '열람',
          'loan': '대출',
          'use': '이용'
        }
        return <span style={{ fontWeight: 'bold' }}>{labels[text] || text}</span>
      }
    },
    {
      title: '신문',
      dataIndex: 'newspaper',
      key: 'newspaper',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'read' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].newspaper = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '잡지',
      dataIndex: 'magazine',
      key: 'magazine',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'read' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].magazine = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '전자책',
      dataIndex: 'ebook',
      key: 'ebook',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'loan' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].ebook = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '오디오북',
      dataIndex: 'audiobook',
      key: 'audiobook',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'read' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].audiobook = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '전자저널',
      dataIndex: 'ejournal',
      key: 'ejournal',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].ejournal = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
      }
    },
    {
      title: '온라인\n전자잡지',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: 'PC',
          dataIndex: 'online_magazine_pc',
          key: 'online_magazine_pc',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
            if (record.usage_type === 'read' || record.usage_type === 'use') {
              return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].online_magazine_pc = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            }
            return <span style={{ color: '#999' }}>-</span>
          }
        },
        {
          title: '모바일',
          dataIndex: 'online_magazine_mobile',
          key: 'online_magazine_mobile',
          width: 32,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
            if (record.usage_type === 'read' || record.usage_type === 'use') {
              return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].online_magazine_mobile = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            }
            return <span style={{ color: '#999' }}>-</span>
          }
        }
      ]
    },
    {
      title: '웨이브온',
      dataIndex: 'waveon',
      key: 'waveon',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'loan' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].waveon = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '플라이북',
      dataIndex: 'flybook',
      key: 'flybook',
      width: 32,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (v: number, record: Floor3MaterialHumanitiesRecord, i: number) => {
        if (record.usage_type === 'read' || record.usage_type === 'use') {
          return <InputNumber value={v} onChange={(val) => { const n = [...floor3MaterialHumanitiesData]; n[i].flybook = val || 0; setFloor3MaterialHumanitiesData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
        return <span style={{ color: '#999' }}>-</span>
      }
    },
    {
      title: '계',
      dataIndex: 'total',
      key: 'total',
      width: 40,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (_: any, record: Floor3MaterialHumanitiesRecord) => {
        const total = calculateFloor3HumanitiesTotal(record)
        return <span style={{ fontWeight: 'bold' }}>{total}</span>
      }
    }
  ]

  const programColumns: ColumnsType<ProgramRecord> = [
    {
      title: '야간개관\n(일반)',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'night_floor23_count', key: 'night_floor23_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].night_floor23_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'night_floor23_people', key: 'night_floor23_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].night_floor23_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '북적북적\n청소년\n체험',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'teen_experience_count', key: 'teen_experience_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].teen_experience_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'teen_experience_people', key: 'teen_experience_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].teen_experience_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '자원봉사자\n교육',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'volunteer_education_count', key: 'volunteer_education_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].volunteer_education_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'volunteer_education_people', key: 'volunteer_education_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].volunteer_education_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '다봄\n프로그램',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'dabom_program_count', key: 'dabom_program_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].dabom_program_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'dabom_program_people', key: 'dabom_program_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].dabom_program_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '대면\n낭독',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'face_reading_count', key: 'face_reading_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].face_reading_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'face_reading_people', key: 'face_reading_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].face_reading_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: <span style={{ whiteSpace: 'pre-line' }}>{'힐링\n북콘서트'}</span>,
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'healing_concert_count', key: 'healing_concert_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].healing_concert_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'healing_concert_people', key: 'healing_concert_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].healing_concert_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '자료실\n행사',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'room_event_count', key: 'room_event_count', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].room_event_count = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        },
        { title: '인원', dataIndex: 'room_event_people', key: 'room_event_people', width: 29, align: 'center', onHeaderCell: headerStyle,
          render: (v: number, _r: ProgramRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2ProgramData]; n[i].room_event_people = val || 0; setFloor2ProgramData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
        }
      ]
    },
    {
      title: '합계',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'total_count', key: 'total_count', width: 32, align: 'center', onHeaderCell: headerStyle,
          render: (_: any, record: ProgramRecord) => {
            const totals = calculateProgramTotal(record)
            return <span style={{ fontWeight: 'bold' }}>{totals.count}</span>
          }
        },
        { title: '인원', dataIndex: 'total_people', key: 'total_people', width: 32, align: 'center', onHeaderCell: headerStyle,
          render: (_: any, record: ProgramRecord) => {
            const totals = calculateProgramTotal(record)
            return <span style={{ fontWeight: 'bold' }}>{totals.people}</span>
          }
        }
      ]
    }
  ]

  const aiSmartColumns: ColumnsType<AISmartLibraryRecord> = [
    { title: '문학\n자판기\n이용', dataIndex: 'literature_vending', key: 'literature_vending', width: 28, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].literature_vending = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '무인\n회원증\n발급기', dataIndex: 'unmanned_card_issuer', key: 'unmanned_card_issuer', width: 28, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].unmanned_card_issuer = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    {
      title: '스마트도서관',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '대출',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_loan_users', key: 'smart_loan_users', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_loan_users = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            },
            { title: '이용권수', dataIndex: 'smart_loan_books', key: 'smart_loan_books', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_loan_books = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            }
          ]
        },
        {
          title: '반납',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_return_users', key: 'smart_return_users', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_return_users = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            },
            { title: '이용권수', dataIndex: 'smart_return_books', key: 'smart_return_books', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_return_books = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            }
          ]
        },
        {
          title: '예약대출',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_reservation_users', key: 'smart_reservation_users', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_reservation_users = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            },
            { title: '이용권수', dataIndex: 'smart_reservation_books', key: 'smart_reservation_books', width: 28, align: 'center', onHeaderCell: headerStyle,
              render: (v: number, _r: AISmartLibraryRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AISmartData]; n[i].smart_reservation_books = val || 0; setFloor2AISmartData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
            }
          ]
        }
      ]
    }
  ]

  const floor2AIEquipmentColumns: ColumnsType<AIEquipmentRecord> = [
    { title: '책봇\n(로버)', dataIndex: 'bookbot', key: 'bookbot', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AIEquipmentData]; n[i].bookbot = val || 0; setFloor2AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '도서추천\n키오스크', dataIndex: 'book_kiosk', key: 'book_kiosk', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor2AIEquipmentData]; n[i].book_kiosk = val || 0; setFloor2AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    }
  ]

  const floor3AIEquipmentColumns: ColumnsType<AIEquipmentRecord> = [
    { title: '노트북', dataIndex: 'laptop', key: 'laptop', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor3AIEquipmentData]; n[i].laptop = val || 0; setFloor3AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '태블릿', dataIndex: 'tablet', key: 'tablet', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor3AIEquipmentData]; n[i].tablet = val || 0; setFloor3AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '북스캐너', dataIndex: 'book_scanner', key: 'book_scanner', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor3AIEquipmentData]; n[i].book_scanner = val || 0; setFloor3AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '전자신문', dataIndex: 'enews', key: 'enews', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: (v: number, _r: AIEquipmentRecord, i: number) => <InputNumber value={v} onChange={(val) => { const n = [...floor3AIEquipmentData]; n[i].enews = val || 0; setFloor3AIEquipmentData(n) }} onFocus={(e) => e.target.select()} min={0} controls={false} style={{ width: '100%', textAlign: 'center' }} />
    },
    { title: '이용자수', dataIndex: 'users', key: 'users', width: 32, align: 'center', onHeaderCell: headerStyle,
      render: () => <span style={{ color: '#999' }}>-</span>
    }
  ]

  const tabItems = [
    {
      key: 'floor2',
      label: '2층 입력',
      children: (
        <Card style={{ backgroundColor: '#f9f9f9' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황(종합,인문예술)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor2VisitorData}
              columns={floor2VisitorColumns}
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
              dataSource={floor2MaterialSubjectData}
              columns={materialSubjectColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 종합자료실</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor2MaterialGeneralData}
              columns={materialGeneralColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 인문예술자료실 (도서)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor2MaterialHumanitiesData}
              columns={floor2MaterialHumanitiesColumns}
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
              className="black-bordered-table"
              dataSource={floor2ProgramData}
              columns={programColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관 - Smart Library</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor2AISmartData}
              columns={aiSmartColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관 - AI Equipment (책봇, 키오스크)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor2AIEquipmentData}
              columns={floor2AIEquipmentColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
            />
          </div>
        </Card>
      )
    },
    {
      key: 'floor3',
      label: '3층 입력',
      children: (
        <Card style={{ backgroundColor: '#f0f8ff' }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황 (멀티미디어존~디지털갤러리)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor3VisitorData}
              columns={floor3VisitorColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
              tableLayout="fixed"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 인문예술자료실 (신문~플라이북)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor3MaterialHumanitiesData}
              columns={floor3MaterialHumanitiesColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관 - AI Equipment (노트북~이용자수)</span>
              <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
            </div>
            <Table
              className="black-bordered-table"
              dataSource={floor3AIEquipmentData}
              columns={floor3AIEquipmentColumns}
              pagination={false}
              loading={loading || remoteLoading}
              bordered
              size="small"
            />
          </div>
        </Card>
      )
    }
  ]

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>2,3층 종합/인문예술자료실 데이터 입력 - {yearMonth}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button icon={<SwapOutlined />} onClick={() => navigate(`/floor1/input/${yearMonth}`)} type="dashed">
            1층 이동
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
      <Tabs defaultActiveKey="floor2" items={tabItems} />
    </div>
  )
}
