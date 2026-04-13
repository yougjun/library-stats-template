import { useState, useEffect } from 'react'
import { Card, Table, Button, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import { EditableCell } from '../components/EditableCell'
import SessionTimer from '../components/SessionTimer'
import { isAccessCodeSession } from '../utils/libraryDays'
import { floor23Api } from '../services/api'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import '../styles/table.css'

type TextAlign = 'left' | 'right' | 'center' | 'justify' | 'start' | 'end'

interface ResizableTitleProps {
  onResize?: (e: React.SyntheticEvent, data: ResizeCallbackData) => void
  width?: number
  textAlign?: TextAlign
  [key: string]: unknown
}

interface SubjectData {
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

interface GeneralMaterialData {
  general_books: number
  comic: number
  english: number
  multicultural: number
  large_print: number
  dementia: number
  easy_read: number
  braille: number
  [key: string]: number
}

interface HumanitiesMaterialRow {
  books: number
  newspaper: number
  magazine: number
  ebook: number
  audiobook: number
  ejournal: number
  online_magazine_pc: number
  online_magazine_mobile: number
  waveon: number
  flybook: number
  [key: string]: number
}

interface HumanitiesData {
  loan: HumanitiesMaterialRow
  read: HumanitiesMaterialRow
  use: HumanitiesMaterialRow
  sum: HumanitiesMaterialRow
}

const renderNumber = (v: number | undefined) => Math.round(v || 0).toLocaleString()

const ResizableTitle = (props: ResizableTitleProps) => {
  const { onResize, width, textAlign, ...restProps } = props

  if (!width) {
    return <th {...restProps} style={{ textAlign }} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} style={{ textAlign }} />
    </Resizable>
  )
}

export default function YearlyFloor23Stats() {
  const { year } = useParams()
  const navigate = useNavigate()
  const [loading] = useState(false)
  const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs(year || dayjs().format('YYYY')))
  const [visitorData, setVisitorData] = useState<any[]>([])
  const [materialSubjectData, setMaterialSubjectData] = useState<any[]>([])
  const [materialTypeGeneralData, setMaterialTypeGeneralData] = useState<any[]>([])
  const [materialTypeHumanitiesData, setMaterialTypeHumanitiesData] = useState<any[]>([])
  const [programData, setProgramData] = useState<any[]>([])
  const [aiSmartLibraryData, setAISmartLibraryData] = useState<any[]>([])
  const [aiEquipmentData, setAIEquipmentData] = useState<any[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

  useEffect(() => {
    setVisitorData([])
    setMaterialSubjectData([])
    setMaterialTypeGeneralData([])
    setMaterialTypeHumanitiesData([])
    setProgramData([])
    setAISmartLibraryData([])
    setAIEquipmentData([])
    loadLocalData()
  }, [year])

  const loadLocalData = async () => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    const visitorDataArray: Record<string, string | number>[] = []
    const materialSubjectDataArray: Record<string, string | number>[] = []
    const materialTypeGeneralDataArray: Record<string, string | number>[] = []
    const materialTypeHumanitiesDataArray: Record<string, string | number>[] = []
    const programDataArray: Record<string, string | number>[] = []
    const aiSmartDataArray: Record<string, string | number>[] = []
    const aiEquipmentDataArray: Record<string, string | number>[] = []

    try {
      const yearlyRes = await floor23Api.getYearly(year || '')
      const yearlyData = yearlyRes.data || {}

      const visitorByMonth: Record<string, any[]> = {}
      const materialTypeByMonth: Record<string, any[]> = {}
      const materialSubjectByMonth: Record<string, any[]> = {}
      const programByMonth: Record<string, any[]> = {}
      const aiSmartByMonth: Record<string, any> = {}
      const aiEquipmentByMonth: Record<string, any[]> = {}

      ;(yearlyData.visitor || []).forEach((item: any) => {
        if (!visitorByMonth[item.year_month]) visitorByMonth[item.year_month] = []
        visitorByMonth[item.year_month].push(item)
      })
      ;(yearlyData.material_type || []).forEach((item: any) => {
        if (!materialTypeByMonth[item.year_month]) materialTypeByMonth[item.year_month] = []
        materialTypeByMonth[item.year_month].push(item)
      })
      ;(yearlyData.material_subject || []).forEach((item: any) => {
        if (!materialSubjectByMonth[item.year_month]) materialSubjectByMonth[item.year_month] = []
        materialSubjectByMonth[item.year_month].push(item)
      })
      ;(yearlyData.program || []).forEach((item: any) => {
        if (!programByMonth[item.year_month]) programByMonth[item.year_month] = []
        programByMonth[item.year_month].push(item)
      })
      ;(yearlyData.ai_smart || []).forEach((item: any) => {
        aiSmartByMonth[item.year_month] = item
      })
      ;(yearlyData.ai_equipment || []).forEach((item: any) => {
        if (!aiEquipmentByMonth[item.year_month]) aiEquipmentByMonth[item.year_month] = []
        aiEquipmentByMonth[item.year_month].push(item)
      })

      for (let idx = 0; idx < months.length; idx++) {
        const month = months[idx]
        const yearMonth = `${year}-${month}`

        const visitorData = visitorByMonth[yearMonth] || []
        const monthVisitorByAge: any = {
          'infant_elementary': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
          'middle_high': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
          'adult': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 }
        }

        visitorData.forEach((item: any) => {
          if (item.age_group && item.age_group !== 'sum' && monthVisitorByAge[item.age_group]) {
            const catMap: Record<string, string> = {
              '자료이용': 'loan',
              '열람': 'reading',
              '책바다': 'bookbada',
              '책나래': 'booknare',
              '만화책마루': 'comic',
              '영어책마루': 'english',
              '다봄자료실': 'dabom',
              '인문예술자료실': 'humanities',
              '멀티미디어존': 'multimedia',
              '간행물존': 'periodical',
              '영화': 'movie',
              '음악': 'music',
              '디지털갤러리': 'gallery'
            }
            const key = catMap[item.category]
            if (key) {
              monthVisitorByAge[item.age_group][key] = (monthVisitorByAge[item.age_group][key] || 0) + (item.user_count || 0)
            }
          }
        })

        Object.keys(monthVisitorByAge).forEach(ageGroup => {
          const row = monthVisitorByAge[ageGroup]
          row.total = row.loan + row.reading + row.bookbada + row.booknare + row.comic +
                      row.english + row.dabom + row.humanities + row.multimedia +
                      row.periodical + row.movie + row.music + row.gallery
        })

        const ageGroups = ['infant_elementary', 'middle_high', 'adult']
        ageGroups.forEach((ageGroup, subIdx) => {
          visitorDataArray.push({
            month: `${parseInt(month)}월`,
            age_group: ageGroup,
            ...monthVisitorByAge[ageGroup],
            cumulative: 0,
            key: `${idx}_${subIdx}`
          })
        })

        const monthSumVisitor = {
          loan: monthVisitorByAge['infant_elementary'].loan + monthVisitorByAge['middle_high'].loan + monthVisitorByAge['adult'].loan,
          reading: monthVisitorByAge['infant_elementary'].reading + monthVisitorByAge['middle_high'].reading + monthVisitorByAge['adult'].reading,
          bookbada: monthVisitorByAge['infant_elementary'].bookbada + monthVisitorByAge['middle_high'].bookbada + monthVisitorByAge['adult'].bookbada,
          booknare: monthVisitorByAge['infant_elementary'].booknare + monthVisitorByAge['middle_high'].booknare + monthVisitorByAge['adult'].booknare,
          comic: monthVisitorByAge['infant_elementary'].comic + monthVisitorByAge['middle_high'].comic + monthVisitorByAge['adult'].comic,
          english: monthVisitorByAge['infant_elementary'].english + monthVisitorByAge['middle_high'].english + monthVisitorByAge['adult'].english,
          dabom: monthVisitorByAge['infant_elementary'].dabom + monthVisitorByAge['middle_high'].dabom + monthVisitorByAge['adult'].dabom,
          humanities: monthVisitorByAge['infant_elementary'].humanities + monthVisitorByAge['middle_high'].humanities + monthVisitorByAge['adult'].humanities,
          multimedia: monthVisitorByAge['infant_elementary'].multimedia + monthVisitorByAge['middle_high'].multimedia + monthVisitorByAge['adult'].multimedia,
          periodical: monthVisitorByAge['infant_elementary'].periodical + monthVisitorByAge['middle_high'].periodical + monthVisitorByAge['adult'].periodical,
          movie: monthVisitorByAge['infant_elementary'].movie + monthVisitorByAge['middle_high'].movie + monthVisitorByAge['adult'].movie,
          music: monthVisitorByAge['infant_elementary'].music + monthVisitorByAge['middle_high'].music + monthVisitorByAge['adult'].music,
          gallery: monthVisitorByAge['infant_elementary'].gallery + monthVisitorByAge['middle_high'].gallery + monthVisitorByAge['adult'].gallery
        }

        const monthSumTotal = monthSumVisitor.loan + monthSumVisitor.reading + monthSumVisitor.bookbada + monthSumVisitor.booknare +
                              monthSumVisitor.comic + monthSumVisitor.english + monthSumVisitor.dabom + monthSumVisitor.humanities +
                              monthSumVisitor.multimedia + monthSumVisitor.periodical + monthSumVisitor.movie + monthSumVisitor.music +
                              monthSumVisitor.gallery

        visitorDataArray.push({
          month: `${parseInt(month)}월`,
          age_group: 'sum',
          ...monthSumVisitor,
          total: monthSumTotal,
          cumulative: 0,
          key: `${idx}_3`
        })

        const materialSubjectData = materialSubjectByMonth[yearMonth] || []
        const loanData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
        const readData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
        materialSubjectData.forEach((item: { usage_type: string; subject_code: string; book_count: number }) => {
          const key = item.subject_code === 'etc' ? 'etc' : `type_${item.subject_code}`
          if (item.usage_type === 'loan') {
            loanData[key] = item.book_count || 0
          } else if (item.usage_type === 'reading') {
            readData[key] = item.book_count || 0
          }
        })

        const sumData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
        Object.keys(loanData).forEach(key => {
          sumData[key] = loanData[key] + readData[key]
        })

        const loanTotal = Object.values(loanData).reduce((a, b) => a + b, 0) as number
        const readTotal = Object.values(readData).reduce((a, b) => a + b, 0) as number
        const sumTotal = loanTotal + readTotal

        materialSubjectDataArray.push({ month: `${parseInt(month)}월`, type: 'loan', ...loanData, month_total: loanTotal, cumulative_total: 0, key: `${idx}_0` })
        materialSubjectDataArray.push({ month: `${parseInt(month)}월`, type: 'read', ...readData, month_total: readTotal, cumulative_total: 0, key: `${idx}_1` })
        materialSubjectDataArray.push({ month: `${parseInt(month)}월`, type: 'sum', ...sumData, month_total: sumTotal, cumulative_total: 0, key: `${idx}_2` })

        const materialTypeData = materialTypeByMonth[yearMonth] || []
        const generalLoanData: GeneralMaterialData = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }
        const generalReadData: GeneralMaterialData = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }

        materialTypeData.forEach((item: { room_type: string; usage_type: string; material_type: string; book_count: number }) => {
          if (item.room_type === 'general') {
            if (item.usage_type === 'loan') {
              generalLoanData[item.material_type] = item.book_count || 0
            } else if (item.usage_type === 'read') {
              generalReadData[item.material_type] = item.book_count || 0
            }
          }
        })

        const generalSumData: GeneralMaterialData = { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0 }
        Object.keys(generalLoanData).forEach(key => {
          generalSumData[key] = generalLoanData[key] + generalReadData[key]
        })

        const generalLoanTotal = Object.values(generalLoanData).reduce((a, b) => a + b, 0) as number
        const generalReadTotal = Object.values(generalReadData).reduce((a, b) => a + b, 0) as number
        const generalSumTotal = generalLoanTotal + generalReadTotal

        materialTypeGeneralDataArray.push({ month: `${parseInt(month)}월`, type: 'loan', unit: '권', ...generalLoanData, month_total: generalLoanTotal, cumulative_total: 0, key: `${idx}_0` })
        materialTypeGeneralDataArray.push({ month: `${parseInt(month)}월`, type: 'read', unit: '권', ...generalReadData, month_total: generalReadTotal, cumulative_total: 0, key: `${idx}_1` })
        materialTypeGeneralDataArray.push({ month: `${parseInt(month)}월`, type: 'sum', unit: '권', ...generalSumData, month_total: generalSumTotal, cumulative_total: 0, key: `${idx}_2` })

        const humanitiesData: HumanitiesData = {
          loan: { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 },
          read: { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 },
          use: { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 },
          sum: { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0 }
        }

        materialTypeData.forEach((item: { room_type: string; usage_type: string; material_type: string; book_count: number }) => {
          if (item.room_type === 'humanities') {
            if (item.usage_type === 'loan') {
              humanitiesData.loan[item.material_type] = item.book_count || 0
            } else if (item.usage_type === 'read') {
              humanitiesData.read[item.material_type] = item.book_count || 0
            } else if (item.usage_type === 'use') {
              humanitiesData.use[item.material_type] = item.book_count || 0
            }
          }
        })

        Object.keys(humanitiesData.loan).forEach(key => {
          humanitiesData.sum[key] = humanitiesData.loan[key] + humanitiesData.read[key]
        })

        const humLoanTotal = Object.values(humanitiesData.loan).reduce((a, b) => a + b, 0) as number
        const humReadTotal = Object.values(humanitiesData.read).reduce((a, b) => a + b, 0) as number
        const humUseTotal = Object.values(humanitiesData.use).reduce((a, b) => a + b, 0) as number
        const humSumTotal = humLoanTotal + humReadTotal

        materialTypeHumanitiesDataArray.push({ month: `${parseInt(month)}월`, type: 'loan', unit: '권', ...humanitiesData.loan, month_total: humLoanTotal, cumulative_total: 0, key: `${idx}_0` })
        materialTypeHumanitiesDataArray.push({ month: `${parseInt(month)}월`, type: 'read', unit: '권', ...humanitiesData.read, month_total: humReadTotal, cumulative_total: 0, key: `${idx}_1` })
        materialTypeHumanitiesDataArray.push({ month: `${parseInt(month)}월`, type: 'sum', unit: '권', ...humanitiesData.sum, month_total: humSumTotal, cumulative_total: 0, key: `${idx}_2` })
        materialTypeHumanitiesDataArray.push({ month: `${parseInt(month)}월`, type: 'sum', unit: '이용자', ...humanitiesData.use, month_total: humUseTotal, cumulative_total: 0, key: `${idx}_3` })

        const programs = programByMonth[yearMonth] || []
        const programMap: any = {
          night_floor23_count: 0, night_floor23_people: 0,
          teen_experience_count: 0, teen_experience_people: 0,
          volunteer_education_count: 0, volunteer_education_people: 0,
          dabom_program_count: 0, dabom_program_people: 0,
          face_reading_count: 0, face_reading_people: 0,
          healing_concert_count: 0, healing_concert_people: 0,
          room_event_count: 0, room_event_people: 0,
          total_count: 0, total_people: 0
        }

        programs.forEach((p: any) => {
          const nameMap: Record<string, string> = {
            'night_floor23': 'night_floor23',
            'teen_experience': 'teen_experience',
            'volunteer_education': 'volunteer_education',
            'dabom_program': 'dabom_program',
            'face_reading': 'face_reading',
            'healing_concert': 'healing_concert',
            'room_event': 'room_event'
          }
          const prefix = nameMap[p.program_name]
          if (prefix) {
            programMap[`${prefix}_count`] = p.session_count || 0
            programMap[`${prefix}_people`] = p.participant_count || 0
          }
        })

        programMap.total_count = programMap.night_floor23_count + programMap.teen_experience_count +
                                  programMap.volunteer_education_count + programMap.dabom_program_count +
                                  programMap.face_reading_count + programMap.healing_concert_count +
                                  programMap.room_event_count
        programMap.total_people = programMap.night_floor23_people + programMap.teen_experience_people +
                                   programMap.volunteer_education_people + programMap.dabom_program_people +
                                   programMap.face_reading_people + programMap.healing_concert_people +
                                   programMap.room_event_people

        programDataArray.push({ month: `${parseInt(month)}월`, ...programMap, key: idx })

        const aiSmartItem = aiSmartByMonth[yearMonth] || {
          literature_vending: 0, unmanned_card_issuer: 0,
          smart_loan_users: 0, smart_loan_books: 0,
          smart_return_users: 0, smart_return_books: 0,
          smart_reservation_users: 0, smart_reservation_books: 0
        }

        const aiSmartProcessed = {
          ...aiSmartItem,
          smart_total_users: (aiSmartItem.smart_loan_users || 0) + (aiSmartItem.smart_return_users || 0) + (aiSmartItem.smart_reservation_users || 0),
          smart_total_books: (aiSmartItem.smart_loan_books || 0) + (aiSmartItem.smart_return_books || 0) + (aiSmartItem.smart_reservation_books || 0),
          total_users: 0,
          total_items: 0
        }
        aiSmartProcessed.total_users = (aiSmartItem.literature_vending || 0) + (aiSmartItem.unmanned_card_issuer || 0) + aiSmartProcessed.smart_total_users
        aiSmartProcessed.total_items = aiSmartProcessed.smart_total_books

        aiSmartDataArray.push({ month: `${parseInt(month)}월`, ...aiSmartProcessed, key: idx })

        const aiEquipmentItems = aiEquipmentByMonth[yearMonth] || []
        const monthAIEquipmentData: any = {
          bookbot: 0, book_kiosk: 0, laptop: 0, tablet: 0, book_scanner: 0, enews: 0, users: 0, total: 0
        }

        aiEquipmentItems.forEach((floorData: any) => {
          Object.keys(monthAIEquipmentData).forEach(key => {
            if (key !== 'total') {
              monthAIEquipmentData[key] += floorData[key] || 0
            }
          })
        })

        monthAIEquipmentData.total = monthAIEquipmentData.bookbot + monthAIEquipmentData.book_kiosk +
                                      monthAIEquipmentData.laptop + monthAIEquipmentData.tablet +
                                      monthAIEquipmentData.book_scanner + monthAIEquipmentData.enews +
                                      monthAIEquipmentData.users

        aiEquipmentDataArray.push({ month: `${parseInt(month)}월`, ...monthAIEquipmentData, key: idx })
      }
    } catch {
      for (let idx = 0; idx < months.length; idx++) {
        const month = months[idx]
        const ageGroups = ['infant_elementary', 'middle_high', 'adult', 'sum']
        ageGroups.forEach((ageGroup, subIdx) => {
          visitorDataArray.push({
            month: `${parseInt(month)}월`,
            age_group: ageGroup,
            loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0,
            humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0,
            total: 0, cumulative: 0,
            key: `${idx}_${subIdx}`
          })
        })

        const types = ['loan', 'read', 'sum']
        types.forEach((type, subIdx) => {
          materialSubjectDataArray.push({
            month: `${parseInt(month)}월`, type,
            type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0,
            type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0,
            month_total: 0, cumulative_total: 0,
            key: `${idx}_${subIdx}`
          })
        })

        types.forEach((type, subIdx) => {
          materialTypeGeneralDataArray.push({
            month: `${parseInt(month)}월`, type, unit: '권',
            general_books: 0, comic: 0, english: 0, multicultural: 0,
            large_print: 0, dementia: 0, easy_read: 0, braille: 0,
            month_total: 0, cumulative_total: 0,
            key: `${idx}_${subIdx}`
          })
        })

        const humTypes = [
          { type: 'loan', unit: '권' },
          { type: 'read', unit: '권' },
          { type: 'sum', unit: '권' },
          { type: 'sum', unit: '이용자' }
        ]
        humTypes.forEach((typeObj, subIdx) => {
          materialTypeHumanitiesDataArray.push({
            month: `${parseInt(month)}월`, type: typeObj.type, unit: typeObj.unit,
            books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0,
            online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0,
            month_total: 0, cumulative_total: 0,
            key: `${idx}_${subIdx}`
          })
        })

        programDataArray.push({
          month: `${parseInt(month)}월`,
          night_floor23_count: 0, night_floor23_people: 0,
          teen_experience_count: 0, teen_experience_people: 0,
          volunteer_education_count: 0, volunteer_education_people: 0,
          dabom_program_count: 0, dabom_program_people: 0,
          face_reading_count: 0, face_reading_people: 0,
          healing_concert_count: 0, healing_concert_people: 0,
          room_event_count: 0, room_event_people: 0,
          total_count: 0, total_people: 0,
          key: idx
        })

        aiSmartDataArray.push({
          month: `${parseInt(month)}월`,
          literature_vending: 0, unmanned_card_issuer: 0,
          smart_loan_users: 0, smart_loan_books: 0,
          smart_return_users: 0, smart_return_books: 0,
          smart_reservation_users: 0, smart_reservation_books: 0,
          smart_total_users: 0, smart_total_books: 0,
          total_users: 0, total_items: 0,
          key: idx
        })

        aiEquipmentDataArray.push({
          month: `${parseInt(month)}월`,
          bookbot: 0, book_kiosk: 0, laptop: 0, tablet: 0,
          book_scanner: 0, enews: 0, users: 0, total: 0,
          key: idx
        })
      }
    }

    const cumulativeVisitorByAge: any = {
      'infant_elementary': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
      'middle_high': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
      'adult': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 },
      'sum': { loan: 0, reading: 0, bookbada: 0, booknare: 0, comic: 0, english: 0, dabom: 0, humanities: 0, multimedia: 0, periodical: 0, movie: 0, music: 0, gallery: 0, total: 0 }
    }

    const visitorMonthsWithData = new Set<string>()
    visitorDataArray.forEach((item) => {
      if (item.age_group === 'sum' && (Number(item.total) || 0) > 0) {
        visitorMonthsWithData.add(item.month as string)
      }
    })

    visitorDataArray.forEach((item) => {
      if (cumulativeVisitorByAge[item.age_group]) {
        const fields = ['loan', 'reading', 'bookbada', 'booknare', 'comic', 'english', 'dabom', 'humanities', 'multimedia', 'periodical', 'movie', 'music', 'gallery', 'total']
        fields.forEach(field => {
          cumulativeVisitorByAge[item.age_group][field] += item[field] || 0
        })
        item.cumulative = visitorMonthsWithData.has(item.month as string)
          ? cumulativeVisitorByAge[item.age_group].total
          : 0
      }
    })

    const ageGroups = ['infant_elementary', 'middle_high', 'adult']
    ageGroups.forEach((ageGroup, idx) => {
      visitorDataArray.push({
        month: '계',
        age_group: ageGroup,
        ...cumulativeVisitorByAge[ageGroup],
        cumulative: cumulativeVisitorByAge[ageGroup].total,
        key: `total_${idx}`
      })
    })
    visitorDataArray.push({
      month: '계',
      age_group: 'sum',
      ...cumulativeVisitorByAge.sum,
      cumulative: cumulativeVisitorByAge.sum.total,
      key: 'total_sum'
    })

    const cumulativeMaterialSubject: any = {
      'loan': { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0, month_total: 0 },
      'read': { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0, month_total: 0 },
      'sum': { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0, month_total: 0 }
    }

    const materialMonthsWithData = new Set<string>()
    materialSubjectDataArray.forEach((item) => {
      if (item.type === 'sum' && (Number(item.month_total) || 0) > 0) {
        materialMonthsWithData.add(item.month as string)
      }
    })

    materialSubjectDataArray.forEach((item) => {
      if (cumulativeMaterialSubject[item.type]) {
        const fields = ['type_000', 'type_100', 'type_200', 'type_300', 'type_400', 'type_500', 'type_600', 'type_700', 'type_800', 'type_900', 'etc', 'month_total']
        fields.forEach(field => {
          cumulativeMaterialSubject[item.type][field] += item[field] || 0
        })
        item.cumulative_total = materialMonthsWithData.has(item.month as string)
          ? cumulativeMaterialSubject[item.type].month_total
          : 0
      }
    })

    const materialTypes = ['loan', 'read', 'sum']
    materialTypes.forEach((type, idx) => {
      materialSubjectDataArray.push({
        month: '계',
        type,
        ...cumulativeMaterialSubject[type],
        cumulative_total: cumulativeMaterialSubject[type].month_total,
        key: `total_${type}`
      })
    })

    const cumulativeMaterialGeneral: any = {
      'loan': { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0, month_total: 0 },
      'read': { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0, month_total: 0 },
      'sum': { general_books: 0, comic: 0, english: 0, multicultural: 0, large_print: 0, dementia: 0, easy_read: 0, braille: 0, month_total: 0 }
    }

    const generalMonthsWithData = new Set<string>()
    materialTypeGeneralDataArray.forEach((item) => {
      if (item.type === 'sum' && (Number(item.month_total) || 0) > 0) {
        generalMonthsWithData.add(item.month as string)
      }
    })

    materialTypeGeneralDataArray.forEach((item) => {
      if (cumulativeMaterialGeneral[item.type]) {
        const fields = ['general_books', 'comic', 'english', 'multicultural', 'large_print', 'dementia', 'easy_read', 'braille', 'month_total']
        fields.forEach(field => {
          cumulativeMaterialGeneral[item.type][field] += item[field] || 0
        })
        item.cumulative_total = generalMonthsWithData.has(item.month as string)
          ? cumulativeMaterialGeneral[item.type].month_total
          : 0
      }
    })

    materialTypes.forEach((type, idx) => {
      materialTypeGeneralDataArray.push({
        month: '계',
        type,
        unit: '권',
        ...cumulativeMaterialGeneral[type],
        cumulative_total: cumulativeMaterialGeneral[type].month_total,
        key: `total_${type}`
      })
    })

    const cumulativeMaterialHumanities: any = {
      'loan': { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0, month_total: 0 },
      'read': { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0, month_total: 0 },
      'sum': { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0, month_total: 0 }
    }

    const cumulativeUse: any = { books: 0, newspaper: 0, magazine: 0, ebook: 0, audiobook: 0, ejournal: 0, online_magazine_pc: 0, online_magazine_mobile: 0, waveon: 0, flybook: 0, month_total: 0 }

    const humanitiesMonthsWithData = new Set<string>()
    materialTypeHumanitiesDataArray.forEach((item) => {
      if (item.type === 'sum' && item.unit === '권' && (Number(item.month_total) || 0) > 0) {
        humanitiesMonthsWithData.add(item.month as string)
      }
    })

    materialTypeHumanitiesDataArray.forEach((item) => {
      const hasData = humanitiesMonthsWithData.has(item.month as string)
      if (item.type === 'sum' && item.unit === '이용자') {
        const fields = ['books', 'newspaper', 'magazine', 'ebook', 'audiobook', 'ejournal', 'online_magazine_pc', 'online_magazine_mobile', 'waveon', 'flybook', 'month_total']
        fields.forEach(field => {
          cumulativeUse[field] += item[field] || 0
        })
        item.cumulative_total = hasData ? cumulativeUse.month_total : 0
      } else if (cumulativeMaterialHumanities[item.type] && item.unit === '권') {
        const fields = ['books', 'newspaper', 'magazine', 'ebook', 'audiobook', 'ejournal', 'online_magazine_pc', 'online_magazine_mobile', 'waveon', 'flybook', 'month_total']
        fields.forEach(field => {
          cumulativeMaterialHumanities[item.type][field] += item[field] || 0
        })
        item.cumulative_total = hasData ? cumulativeMaterialHumanities[item.type].month_total : 0
      }
    })

    const humanitiesTypes = [
      { type: 'loan', unit: '권' },
      { type: 'read', unit: '권' },
      { type: 'sum', unit: '권' },
      { type: 'sum', unit: '이용자' }
    ]
    humanitiesTypes.forEach((typeObj, idx) => {
      if (typeObj.type === 'sum' && typeObj.unit === '이용자') {
        materialTypeHumanitiesDataArray.push({
          month: '계',
          type: typeObj.type,
          unit: typeObj.unit,
          ...cumulativeUse,
          cumulative_total: cumulativeUse.month_total,
          key: `total_use`
        })
      } else {
        materialTypeHumanitiesDataArray.push({
          month: '계',
          type: typeObj.type,
          unit: typeObj.unit,
          ...cumulativeMaterialHumanities[typeObj.type],
          cumulative_total: cumulativeMaterialHumanities[typeObj.type].month_total,
          key: `total_${typeObj.type}`
        })
      }
    })

    const yearlyProgramTotals: any = {
      night_floor23_count: 0, night_floor23_people: 0,
      teen_experience_count: 0, teen_experience_people: 0,
      volunteer_education_count: 0, volunteer_education_people: 0,
      dabom_program_count: 0, dabom_program_people: 0,
      face_reading_count: 0, face_reading_people: 0,
      healing_concert_count: 0, healing_concert_people: 0,
      room_event_count: 0, room_event_people: 0,
      total_count: 0, total_people: 0
    }

    programDataArray.forEach((item) => {
      Object.keys(yearlyProgramTotals).forEach(key => {
        yearlyProgramTotals[key] += item[key] || 0
      })
    })

    programDataArray.push({ month: '계', ...yearlyProgramTotals, key: 'total' })

    const yearlyAISmartTotals: any = {
      literature_vending: 0, unmanned_card_issuer: 0,
      smart_loan_users: 0, smart_loan_books: 0,
      smart_return_users: 0, smart_return_books: 0,
      smart_reservation_users: 0, smart_reservation_books: 0,
      smart_total_users: 0, smart_total_books: 0,
      total_users: 0, total_items: 0
    }

    const baseAISmartFields = ['literature_vending', 'unmanned_card_issuer', 'smart_loan_users', 'smart_loan_books',
      'smart_return_users', 'smart_return_books', 'smart_reservation_users', 'smart_reservation_books']

    aiSmartDataArray.forEach((item) => {
      baseAISmartFields.forEach(key => {
        yearlyAISmartTotals[key] += item[key] || 0
      })
    })

    yearlyAISmartTotals.smart_total_users = yearlyAISmartTotals.smart_loan_users + yearlyAISmartTotals.smart_return_users + yearlyAISmartTotals.smart_reservation_users
    yearlyAISmartTotals.smart_total_books = yearlyAISmartTotals.smart_loan_books + yearlyAISmartTotals.smart_return_books + yearlyAISmartTotals.smart_reservation_books
    yearlyAISmartTotals.total_users = yearlyAISmartTotals.literature_vending + yearlyAISmartTotals.unmanned_card_issuer + yearlyAISmartTotals.smart_total_users
    yearlyAISmartTotals.total_items = yearlyAISmartTotals.smart_total_books

    aiSmartDataArray.push({ month: '계', ...yearlyAISmartTotals, key: 'total' })

    const yearlyAIEquipmentTotals: any = {
      bookbot: 0, book_kiosk: 0, laptop: 0, tablet: 0,
      book_scanner: 0, enews: 0, users: 0, total: 0
    }

    aiEquipmentDataArray.forEach((item) => {
      Object.keys(yearlyAIEquipmentTotals).forEach(key => {
        yearlyAIEquipmentTotals[key] += item[key] || 0
      })
    })

    aiEquipmentDataArray.push({ month: '계', ...yearlyAIEquipmentTotals, key: 'total' })

    setVisitorData(visitorDataArray)
    setMaterialSubjectData(materialSubjectDataArray)
    setMaterialTypeGeneralData(materialTypeGeneralDataArray)
    setMaterialTypeHumanitiesData(materialTypeHumanitiesDataArray)
    setProgramData(programDataArray)
    setAISmartLibraryData(aiSmartDataArray)
    setAIEquipmentData(aiEquipmentDataArray)
  }

  const handleResize = (key: string) => (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
    setColumnWidths(prev => ({ ...prev, [key]: size.width }))
  }

  const handleYearChange = (date: Dayjs | null) => {
    if (date) {
      const newYear = date.format('YYYY')
      setSelectedYear(date)
      navigate(`/statistics/yearly-floor23/${newYear}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA', textAlign: 'center' as const } })

  const baseVisitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 2 }),
      render: (text, record, index) => {
        return text
      },
      onCell: (record, index) => {
        if (index === undefined) return {}
        if (record.month === '계' && index >= visitorData.length - 4) {
          if (index === visitorData.length - 4) {
            return { rowSpan: 4, style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
          }
          return { rowSpan: 0 }
        }
        if (index % 4 === 0) return { rowSpan: 4 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'age_group',
      key: 'age_group',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'infant_elementary': '유아/초등',
          'middle_high': '중고생',
          'adult': '일반',
          'sum': '계'
        }
        return labels[text] || text
      }
    },
    {
      title: '자료\n이용',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '대출', dataIndex: 'loan', key: 'loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '열람', dataIndex: 'reading', key: 'reading', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '상호\n대차',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '책바다', dataIndex: 'bookbada', key: 'bookbada', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '책나래', dataIndex: 'booknare', key: 'booknare', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '만화\n책마루', dataIndex: 'comic', key: 'comic', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '영어\n책마루', dataIndex: 'english', key: 'english', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '다봄\n자료실', dataIndex: 'dabom', key: 'dabom', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: <span style={{ whiteSpace: 'pre-line' }}>{'인문예술\n자료실'}</span>, dataIndex: 'humanities', key: 'humanities', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '멀티\n미디어존', dataIndex: 'multimedia', key: 'multimedia', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '간행물\n존', dataIndex: 'periodical', key: 'periodical', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '영화\n음악존',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '영화', dataIndex: 'movie', key: 'movie', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '음악', dataIndex: 'music', key: 'music', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '디지털\n갤러리', dataIndex: 'gallery', key: 'gallery', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '합계', dataIndex: 'total', key: 'total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '누계', dataIndex: 'cumulative', key: 'cumulative', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseMaterialSubjectColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 2 }),
      render: (text, record, index) => {
        return text
      },
      onCell: (record, index) => {
        if (index === undefined) return {}
        if (record.month === '계' && index >= materialSubjectData.length - 3) {
          if (index === materialSubjectData.length - 3) {
            return { rowSpan: 3, style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
          }
          return { rowSpan: 0 }
        }
        if (index % 3 === 0) return { rowSpan: 3 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'read': '열람',
          'sum': '계',
          'cumulative': '누계'
        }
        return labels[text] || text
      }
    },
    { title: '총류\n(000)', dataIndex: 'type_000', key: 'type_000', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '철학\n(100)', dataIndex: 'type_100', key: 'type_100', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '종교\n(200)', dataIndex: 'type_200', key: 'type_200', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '사회\n(300)', dataIndex: 'type_300', key: 'type_300', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '자연\n(400)', dataIndex: 'type_400', key: 'type_400', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기술\n(500)', dataIndex: 'type_500', key: 'type_500', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '예술\n(600)', dataIndex: 'type_600', key: 'type_600', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '언어\n(700)', dataIndex: 'type_700', key: 'type_700', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '문학\n(800)', dataIndex: 'type_800', key: 'type_800', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '역사\n(900)', dataIndex: 'type_900', key: 'type_900', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '기타', dataIndex: 'etc', key: 'etc', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseMaterialTypeGeneralColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 3 }),
      render: (text, record, index) => {
        return text
      },
      onCell: (record, index) => {
        if (index === undefined) return {}
        if (record.month === '계' && index >= materialTypeGeneralData.length - 3) {
          if (index === materialTypeGeneralData.length - 3) {
            return { rowSpan: 3, style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
          }
          return { rowSpan: 0 }
        }
        if (index % 3 === 0) return { rowSpan: 3 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: (text: string) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'read': '열람',
          'sum': '계',
          'cumulative': '누계'
        }
        return labels[text] || text
      }
    },
    {
      title: '',
      dataIndex: 'unit',
      key: 'unit',
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: () => '권'
    },
    { title: '일반\n도서', dataIndex: 'general_books', key: 'general_books', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '만화\n책마루', dataIndex: 'comic', key: 'comic', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '영어', dataIndex: 'english', key: 'english', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '다문화', dataIndex: 'multicultural', key: 'multicultural', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '큰글자', dataIndex: 'large_print', key: 'large_print', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '치매\n극복', dataIndex: 'dementia', key: 'dementia', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '읽기\n쉬운책', dataIndex: 'easy_read', key: 'easy_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '점자', dataIndex: 'braille', key: 'braille', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseMaterialTypeHumanitiesColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 3 }),
      render: (text, record, index) => {
        return text
      },
      onCell: (record, index) => {
        if (index === undefined) return {}
        if (record.month === '계' && index >= materialTypeHumanitiesData.length - 4) {
          if (index === materialTypeHumanitiesData.length - 4) {
            return { rowSpan: 4, style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
          }
          return { rowSpan: 0 }
        }
        if (index % 4 === 0) return { rowSpan: 4 }
        return { rowSpan: 0 }
      }
    },
    {
      title: '',
      dataIndex: 'type',
      key: 'type',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: (text, record) => {
        const labels: Record<string, string> = {
          'loan': '대출',
          'read': '열람',
          'sum': '계',
          'cumulative': '누계'
        }
        if (text === 'sum' && record.unit === '이용자') {
          return '계'
        }
        return labels[text] || text
      }
    },
    {
      title: '',
      dataIndex: 'unit',
      key: 'unit',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ ...headerStyle().style, colSpan: 0 }),
      render: (text: string) => text
    },
    { title: '도서', dataIndex: 'books', key: 'books', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '신문', dataIndex: 'newspaper', key: 'newspaper', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '잡지', dataIndex: 'magazine', key: 'magazine', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '전자책', dataIndex: 'ebook', key: 'ebook', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '오디오북', dataIndex: 'audiobook', key: 'audiobook', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '전자\n저널', dataIndex: 'ejournal', key: 'ejournal', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '온라인\n전자잡지',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: 'PC', dataIndex: 'online_magazine_pc', key: 'online_magazine_pc', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '모바일', dataIndex: 'online_magazine_mobile', key: 'online_magazine_mobile', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '웨이브온', dataIndex: 'waveon', key: 'waveon', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '플라이북', dataIndex: 'flybook', key: 'flybook', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '월계', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '누계', dataIndex: 'cumulative_total', key: 'cumulative_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const baseProgramColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text,
      onCell: (record) => {
        if (record.month === '계') {
          return { style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
        }
        return {}
      }
    },
    {
      title: '야간개관\n(일반)',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'night_floor23_count', key: 'night_floor23_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'night_floor23_people', key: 'night_floor23_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '북적북적\n청소년\n체험',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'teen_experience_count', key: 'teen_experience_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'teen_experience_people', key: 'teen_experience_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '자원봉사자\n교육',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'volunteer_education_count', key: 'volunteer_education_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'volunteer_education_people', key: 'volunteer_education_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '다봄\n프로그램',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'dabom_program_count', key: 'dabom_program_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'dabom_program_people', key: 'dabom_program_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '대면\n낭독',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'face_reading_count', key: 'face_reading_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'face_reading_people', key: 'face_reading_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '힐링북\n콘서트',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'healing_concert_count', key: 'healing_concert_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'healing_concert_people', key: 'healing_concert_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '자료실\n행사',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'room_event_count', key: 'room_event_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'room_event_people', key: 'room_event_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'total_count', key: 'total_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'total_people', key: 'total_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const baseAISmartLibraryColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text,
      onCell: (record) => {
        if (record.month === '계') {
          return { style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
        }
        return {}
      }
    },
    { title: '문학\n자판기\n이용', dataIndex: 'literature_vending', key: 'literature_vending', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '무인\n회원증\n발급기', dataIndex: 'unmanned_card_issuer', key: 'unmanned_card_issuer', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
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
            { title: '이용자수', dataIndex: 'smart_loan_users', key: 'smart_loan_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_loan_books', key: 'smart_loan_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '반납',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_return_users', key: 'smart_return_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_return_books', key: 'smart_return_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '예약대출',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_reservation_users', key: 'smart_reservation_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_reservation_books', key: 'smart_reservation_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        },
        {
          title: '계',
          align: 'center',
          onHeaderCell: headerStyle,
          children: [
            { title: '이용자수', dataIndex: 'smart_total_users', key: 'smart_total_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
            { title: '이용권수', dataIndex: 'smart_total_books', key: 'smart_total_books', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
          ]
        }
      ]
    },
    {
      title: '합계',
      align: 'center',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'total_users', key: 'total_users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'total_items', key: 'total_items', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const baseAIEquipmentColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: headerStyle,
      render: (text: string) => text,
      onCell: (record) => {
        if (record.month === '계') {
          return { style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
        }
        return {}
      }
    },
    { title: '책봇\n(로버)', dataIndex: 'bookbot', key: 'bookbot', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '도서추천\n키오스크', dataIndex: 'book_kiosk', key: 'book_kiosk', width: 39, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '노트북', dataIndex: 'laptop', key: 'laptop', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '태블릿', dataIndex: 'tablet', key: 'tablet', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '북스캐너', dataIndex: 'book_scanner', key: 'book_scanner', width: 39, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '전자신문', dataIndex: 'enews', key: 'enews', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '이용자\n수', dataIndex: 'users', key: 'users', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '합계', dataIndex: 'total', key: 'total', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]


  const visitorColumns = baseVisitorColumns
  const materialSubjectColumns = baseMaterialSubjectColumns
  const materialTypeGeneralColumns = baseMaterialTypeGeneralColumns
  const materialTypeHumanitiesColumns = baseMaterialTypeHumanitiesColumns
  const programColumns = baseProgramColumns
  const aiSmartLibraryColumns = baseAISmartLibraryColumns
  const aiEquipmentColumns = baseAIEquipmentColumns

  const handleBackToMonthly = () => {
    const currentMonth = dayjs().format('YYYY-MM')
    navigate(`/statistics/floor23/${currentMonth}`)
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToMonthly}
        >
          월계 통계로 돌아가기
        </Button>
        <DatePicker
          picker="year"
          value={selectedYear}
          onChange={handleYearChange}
          format="YYYY"
        />
      </div>

      {isAccessCodeSession() && <SessionTimer />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        {isAccessCodeSession() && (
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/settings')}
          >
            설정으로 돌아가기
          </Button>
        )}
      </div>

      <Card style={{ marginBottom: 24, border: '2px solid #000' }}>
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>종합, 인문예술 자료실 연간 이용 현황 ({year}년)</h1>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 이용자 현황</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={visitorData}
            columns={visitorColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(주제별)</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialSubjectData}
            columns={materialSubjectColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 종합자료실</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialTypeGeneralData}
            columns={materialTypeGeneralColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 자료 이용 현황(자료별) - 인문예술자료실</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 권)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={materialTypeHumanitiesData}
            columns={materialTypeHumanitiesColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 행사 및 프로그램</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={programData}
            columns={programColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={aiSmartLibraryData}
            columns={aiSmartLibraryColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            style={{ marginBottom: 16 }}
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
          <Table
            className="black-bordered-table"
            dataSource={aiEquipmentData}
            columns={aiEquipmentColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                cell: EditableCell,
              },
            }}
          />
        </div>
      </Card>

    </div>
  )
}
