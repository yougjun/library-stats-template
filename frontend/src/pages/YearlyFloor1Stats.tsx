import { useState, useEffect } from 'react'
import { Card, Table, Button, DatePicker } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { SettingOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import dayjs, { Dayjs } from 'dayjs'
import type { ColumnsType } from 'antd/es/table'
import SessionTimer from '../components/SessionTimer'
import { isAccessCodeSession } from '../utils/libraryDays'
import { floor1Api } from '../services/api'
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

export default function YearlyFloor1Stats() {
  const { year } = useParams()
  const navigate = useNavigate()
  const [loading] = useState(false)
  const [selectedYear, setSelectedYear] = useState<Dayjs>(dayjs(year || dayjs().format('YYYY')))
  const [visitorData, setVisitorData] = useState<any[]>([])
  const [materialData, setMaterialData] = useState<any[]>([])
  const [programData, setProgramData] = useState<any[]>([])
  const [aiLibraryData, setAILibraryData] = useState<any[]>([])
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})

  useEffect(() => {
    setVisitorData([])
    setMaterialData([])
    setProgramData([])
    setAILibraryData([])
    loadLocalData()
  }, [year])

  const loadLocalData = async () => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
    const visitorDataArray: any[] = []
    const materialDataArray: any[] = []
    const programDataArray: any[] = []
    const aiLibraryDataArray: any[] = []

    for (let idx = 0; idx < months.length; idx++) {
      const month = months[idx]
      const yearMonth = `${year}-${month}`

      try {
        const visitorRes = await floor1Api.getVisitor(yearMonth)
        const visitorDataFromApi = visitorRes.data

        const visitorMap: any = {
          'infant_elementary': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 },
          'middle_high': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 },
          'adult': { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 }
        }

        visitorDataFromApi.forEach((item: any) => {
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

        const ageGroups = ['infant_elementary', 'middle_high', 'adult']
        ageGroups.forEach((ageGroup, subIdx) => {
          const total = visitorMap[ageGroup].children_loan + visitorMap[ageGroup].children_read +
                       visitorMap[ageGroup].infant_loan + visitorMap[ageGroup].infant_read
          visitorDataArray.push({
            month: `${parseInt(month)}월`,
            age_group: ageGroup,
            ...visitorMap[ageGroup],
            total,
            key: `${idx}_${subIdx}`
          })
        })

        const sumTotal = ageGroups.reduce((sum, ag) =>
          sum + visitorMap[ag].children_loan + visitorMap[ag].children_read +
          visitorMap[ag].infant_loan + visitorMap[ag].infant_read, 0)
        visitorDataArray.push({
          month: `${parseInt(month)}월`,
          age_group: 'sum',
          children_loan: ageGroups.reduce((sum, ag) => sum + visitorMap[ag].children_loan, 0),
          children_read: ageGroups.reduce((sum, ag) => sum + visitorMap[ag].children_read, 0),
          infant_loan: ageGroups.reduce((sum, ag) => sum + visitorMap[ag].infant_loan, 0),
          infant_read: ageGroups.reduce((sum, ag) => sum + visitorMap[ag].infant_read, 0),
          total: sumTotal,
          key: `${idx}_3`
        })
      } catch {
        const ageGroups = ['infant_elementary', 'middle_high', 'adult', 'sum']
        ageGroups.forEach((ageGroup, subIdx) => {
          visitorDataArray.push({ month: `${parseInt(month)}월`, age_group: ageGroup, children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0, total: 0, key: `${idx}_${subIdx}` })
        })
      }

      try {
        const materialRes = await floor1Api.getMaterial(yearMonth)
        const materialDataFromApi = materialRes.data

        const loanData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
        const readData: SubjectData = { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
        materialDataFromApi.forEach((item: { usage_type: string; subject_code: string; book_count: number }) => {
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

        materialDataArray.push({ month: `${parseInt(month)}월`, room: 'children', type: 'loan', ...loanData, month_total: loanTotal, key: `${idx}_0` })
        materialDataArray.push({ month: `${parseInt(month)}월`, room: 'children', type: 'read', ...readData, month_total: readTotal, key: `${idx}_1` })
        materialDataArray.push({ month: `${parseInt(month)}월`, room: 'children', type: 'sum', ...sumData, month_total: sumTotal, key: `${idx}_2` })
      } catch {
        const types = ['loan', 'read', 'sum']
        types.forEach((type, subIdx) => {
          materialDataArray.push({ month: `${parseInt(month)}월`, room: 'children', type, type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0, month_total: 0, key: `${idx}_${subIdx}` })
        })
      }

      try {
        const programRes = await floor1Api.getProgram(yearMonth)
        const programs = programRes.data
        const programMap: any = { storytelling_count: 0, storytelling_people: 0, library_tour_count: 0, library_tour_people: 0, english_count: 0, english_people: 0, book_package_count: 0, book_package_books: 0, book_package_people: 0, room_event_count: 0, room_event_people: 0, etc_count: 0, etc_people: 0, total_count: 0, total_people: 0 }

        programs.forEach((p: any) => {
          const nameMap: any = { 'storytelling': 'storytelling', 'library_tour': 'library_tour', 'english_book_club': 'english', 'book_package': 'book_package', 'room_event': 'room_event', 'etc': 'etc' }
          const prefix = nameMap[p.program_name]
          if (prefix) {
            programMap[`${prefix}_count`] = p.session_count || 0
            programMap[`${prefix}_people`] = p.participant_count || 0
            if (prefix === 'book_package') {
              programMap[`${prefix}_books`] = p.book_count || 0
            }
          }
        })

        programMap.total_count = programMap.storytelling_count + programMap.library_tour_count + programMap.english_count + programMap.book_package_count + programMap.room_event_count + programMap.etc_count
        programMap.total_people = programMap.storytelling_people + programMap.library_tour_people + programMap.english_people + programMap.book_package_people + programMap.room_event_people + programMap.etc_people

        programDataArray.push({ month: `${parseInt(month)}월`, ...programMap, key: idx })
      } catch {
        programDataArray.push({ month: `${parseInt(month)}월`, storytelling_count: 0, storytelling_people: 0, library_tour_count: 0, library_tour_people: 0, english_count: 0, english_people: 0, book_package_count: 0, book_package_books: 0, book_package_people: 0, room_event_count: 0, room_event_people: 0, etc_count: 0, etc_people: 0, total_count: 0, total_people: 0, key: idx })
      }

      try {
        const aiRes = await floor1Api.getAILibrary(yearMonth)
        const aiData = aiRes.data
        if (aiData) {
          aiLibraryDataArray.push({ month: `${parseInt(month)}월`, ...aiData, key: idx })
        } else {
          aiLibraryDataArray.push({ month: `${parseInt(month)}월`, bookbot: 0, air_projection: 0, finger_story: 0, ar_book: 0, pass_infant_m: 0, pass_infant_f: 0, pass_elementary_m: 0, pass_elementary_f: 0, pass_middle_m: 0, pass_middle_f: 0, pass_adult_m: 0, pass_adult_f: 0, unmanned_users: 0, unmanned_books: 0, total_users: 0, total_books: 0, key: idx })
        }
      } catch {
        aiLibraryDataArray.push({ month: `${parseInt(month)}월`, bookbot: 0, air_projection: 0, finger_story: 0, ar_book: 0, pass_infant_m: 0, pass_infant_f: 0, pass_elementary_m: 0, pass_elementary_f: 0, pass_middle_m: 0, pass_middle_f: 0, pass_adult_m: 0, pass_adult_f: 0, unmanned_users: 0, unmanned_books: 0, total_users: 0, total_books: 0, key: idx })
      }
    }

    const yearlyProgramTotals = {
      storytelling_count: 0, storytelling_people: 0,
      library_tour_count: 0, library_tour_people: 0,
      english_count: 0, english_people: 0,
      book_package_count: 0, book_package_books: 0, book_package_people: 0,
      room_event_count: 0, room_event_people: 0,
      etc_count: 0, etc_people: 0,
      total_count: 0, total_people: 0
    }

    programDataArray.forEach((item: any) => {
      Object.keys(yearlyProgramTotals).forEach(key => {
        yearlyProgramTotals[key as keyof typeof yearlyProgramTotals] += item[key] || 0
      })
    })

    programDataArray.push({
      month: '계',
      ...yearlyProgramTotals,
      key: 'total'
    })

    const yearlyAITotals = {
      bookbot: 0, air_projection: 0, finger_story: 0, ar_book: 0,
      pass_infant_m: 0, pass_infant_f: 0,
      pass_elementary_m: 0, pass_elementary_f: 0,
      pass_middle_m: 0, pass_middle_f: 0,
      pass_adult_m: 0, pass_adult_f: 0,
      unmanned_users: 0, unmanned_books: 0,
      total_users: 0, total_books: 0
    }

    aiLibraryDataArray.forEach((item: any) => {
      Object.keys(yearlyAITotals).forEach(key => {
        yearlyAITotals[key as keyof typeof yearlyAITotals] += item[key] || 0
      })
    })

    aiLibraryDataArray.push({
      month: '계',
      ...yearlyAITotals,
      key: 'total'
    })

    const yearlyVisitorTotals = {
      infant_elementary: { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 },
      middle_high: { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 },
      adult: { children_loan: 0, children_read: 0, infant_loan: 0, infant_read: 0 }
    }

    const ageGroups = ['infant_elementary', 'middle_high', 'adult']

    visitorDataArray.forEach((item: any) => {
      if (item.age_group !== 'sum' && yearlyVisitorTotals[item.age_group as keyof typeof yearlyVisitorTotals]) {
        const group = yearlyVisitorTotals[item.age_group as keyof typeof yearlyVisitorTotals]
        group.children_loan += item.children_loan || 0
        group.children_read += item.children_read || 0
        group.infant_loan += item.infant_loan || 0
        group.infant_read += item.infant_read || 0
      }
    })

    ageGroups.forEach((ageGroup, idx) => {
      const group = yearlyVisitorTotals[ageGroup as keyof typeof yearlyVisitorTotals]
      const total = group.children_loan + group.children_read + group.infant_loan + group.infant_read
      visitorDataArray.push({
        month: '계',
        age_group: ageGroup,
        ...group,
        total,
        key: `total_${idx}`
      })
    })

    const grandTotal = {
      children_loan: ageGroups.reduce((sum, ag) => sum + yearlyVisitorTotals[ag as keyof typeof yearlyVisitorTotals].children_loan, 0),
      children_read: ageGroups.reduce((sum, ag) => sum + yearlyVisitorTotals[ag as keyof typeof yearlyVisitorTotals].children_read, 0),
      infant_loan: ageGroups.reduce((sum, ag) => sum + yearlyVisitorTotals[ag as keyof typeof yearlyVisitorTotals].infant_loan, 0),
      infant_read: ageGroups.reduce((sum, ag) => sum + yearlyVisitorTotals[ag as keyof typeof yearlyVisitorTotals].infant_read, 0)
    }
    const grandTotalSum = grandTotal.children_loan + grandTotal.children_read + grandTotal.infant_loan + grandTotal.infant_read
    visitorDataArray.push({
      month: '계',
      age_group: 'sum',
      ...grandTotal,
      total: grandTotalSum,
      key: 'total_grand'
    })

    const yearlyMaterialTotals = {
      loan: { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 },
      read: { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 },
      sum: { type_000: 0, type_100: 0, type_200: 0, type_300: 0, type_400: 0, type_500: 0, type_600: 0, type_700: 0, type_800: 0, type_900: 0, etc: 0 }
    }

    materialDataArray.forEach((item: any) => {
      if (yearlyMaterialTotals[item.type as keyof typeof yearlyMaterialTotals]) {
        const totals = yearlyMaterialTotals[item.type as keyof typeof yearlyMaterialTotals]
        Object.keys(totals).forEach(key => {
          totals[key as keyof typeof totals] += item[key] || 0
        })
      }
    })

    const materialTypes = ['loan', 'read', 'sum']
    materialTypes.forEach((type, idx) => {
      const totals = yearlyMaterialTotals[type as keyof typeof yearlyMaterialTotals]
      const monthTotal = Object.values(totals).reduce((a, b) => a + b, 0)
      materialDataArray.push({
        month: '계',
        room: 'children',
        type,
        ...totals,
        month_total: monthTotal,
        key: `total_${type}`
      })
    })

    setVisitorData(visitorDataArray)
    setMaterialData(materialDataArray)
    setProgramData(programDataArray)
    setAILibraryData(aiLibraryDataArray)
  }

  const handleResize = (key: string) => (_: any, { size }: ResizeCallbackData) => {
    setColumnWidths(prev => ({ ...prev, [key]: size.width }))
  }

  const handleYearChange = (date: Dayjs | null) => {
    if (date) {
      const newYear = date.format('YYYY')
      setSelectedYear(date)
      navigate(`/statistics/yearly-floor1/${newYear}`)
    }
  }

  const headerStyle = () => ({ style: { backgroundColor: '#E2EFDA' } })

  const visitorColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 2 }),
      render: (text: string, record: any, index: number) => {
        return text
      },
      onCell: (record: any, index?: number) => {
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
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 0, colSpan: 0 }),
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
      title: <span style={{ whiteSpace: 'pre-line' }}>{'어린이\n자료실'}</span>,
      onHeaderCell: headerStyle,
      children: [
        { title: '관외\n대출', dataIndex: 'children_loan', key: 'children_loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '관내\n열람', dataIndex: 'children_read', key: 'children_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '유아\n자료실',
      onHeaderCell: headerStyle,
      children: [
        { title: '관외\n대출', dataIndex: 'infant_loan', key: 'infant_loan', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '관내\n열람', dataIndex: 'infant_read', key: 'infant_read', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    { title: '합계', dataIndex: 'total', key: 'total', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const materialColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 39,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 2 }),
      render: (text: string, record: any, index: number) => {
        return text
      },
      onCell: (record: any, index?: number) => {
        if (index === undefined) return {}
        if (record.month === '계' && index >= materialData.length - 3) {
          if (index === materialData.length - 3) {
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
      width: 28,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 0, colSpan: 0 }),
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
    { title: '연간', dataIndex: 'month_total', key: 'month_total', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
  ]

  const programColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 1 }),
      render: (text: string) => text,
      onCell: (record: any) => {
        if (record.month === '계') {
          return { style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
        }
        return {}
      }
    },
    {
      title: '동화\n체험',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'storytelling_count', key: 'storytelling_count', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'storytelling_people', key: 'storytelling_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '도서관\n나들이',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'library_tour_count', key: 'library_tour_count', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'library_tour_people', key: 'library_tour_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '영어\n북클럽',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'english_count', key: 'english_count', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'english_people', key: 'english_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '책\n꾸러미',
      onHeaderCell: headerStyle,
      children: [
        {
          title: '횟수\n(권수)',
          dataIndex: 'book_package_count',
          key: 'book_package_count',
          width: 29,
          align: 'center',
          onHeaderCell: headerStyle,
          render: (v: any, record: any) => (
            <div style={{ whiteSpace: 'pre-line' }}>
              {Math.round(record.book_package_count || 0).toLocaleString().toLocaleString()}
              {'\n'}
              {Math.round(record.book_package_books || 0).toLocaleString().toLocaleString()}
            </div>
          )
        },
        { title: '인원', dataIndex: 'book_package_people', key: 'book_package_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '자료실\n행사',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'room_event_count', key: 'room_event_count', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'room_event_people', key: 'room_event_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '기타',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'etc_count', key: 'etc_count', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'etc_people', key: 'etc_people', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '합계',
      onHeaderCell: headerStyle,
      children: [
        { title: '횟수', dataIndex: 'total_count', key: 'total_count', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '인원', dataIndex: 'total_people', key: 'total_people', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const aiLibraryColumns: ColumnsType<any> = [
    {
      title: '구분',
      dataIndex: 'month',
      key: 'month',
      width: 32,
      align: 'center',
      onHeaderCell: () => ({ style: { backgroundColor: '#E2EFDA' }, rowSpan: 2, colSpan: 1 }),
      render: (text: string) => text,
      onCell: (record: any) => {
        if (record.month === '계') {
          return { style: { fontWeight: 'bold', backgroundColor: '#f0f0f0' } }
        }
        return {}
      }
    },
    { title: '책봇\n(로미)', dataIndex: 'bookbot', key: 'bookbot', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '에어\n프로젝션', dataIndex: 'air_projection', key: 'air_projection', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: '핑거\n스토리', dataIndex: 'finger_story', key: 'finger_story', width: 32, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    { title: 'AR북', dataIndex: 'ar_book', key: 'ar_book', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
    {
      title: '1일출입증',
      onHeaderCell: headerStyle,
      children: [
        { title: '유아\n(남)', dataIndex: 'pass_infant_m', key: 'pass_infant_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '유아\n(여)', dataIndex: 'pass_infant_f', key: 'pass_infant_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '초등\n(남)', dataIndex: 'pass_elementary_m', key: 'pass_elementary_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '초등\n(여)', dataIndex: 'pass_elementary_f', key: 'pass_elementary_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '중고등\n(남)', dataIndex: 'pass_middle_m', key: 'pass_middle_m', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '중고등\n(여)', dataIndex: 'pass_middle_f', key: 'pass_middle_f', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '일반\n(남)', dataIndex: 'pass_adult_m', key: 'pass_adult_m', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '일반\n(여)', dataIndex: 'pass_adult_f', key: 'pass_adult_f', width: 28, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '무인\n반납실',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'unmanned_users', key: 'unmanned_users', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'unmanned_books', key: 'unmanned_books', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    },
    {
      title: '합계',
      onHeaderCell: headerStyle,
      children: [
        { title: '이용자\n수', dataIndex: 'total_users', key: 'total_users', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber },
        { title: '이용\n권수', dataIndex: 'total_books', key: 'total_books', width: 29, align: 'center', onHeaderCell: headerStyle, render: renderNumber }
      ]
    }
  ]

  const handleBackToMonthly = () => {
    const currentMonth = dayjs().format('YYYY-MM')
    navigate(`/statistics/floor1/${currentMonth}`)
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
        <h1 style={{ textAlign: 'center', margin: '0 0 16px 0' }}>어린이자료실 연간 이용 현황 ({year}년)</h1>
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
            dataSource={materialData}
            columns={materialColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
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
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '15px', fontWeight: 'bold' }}>□ 인공지능 미래형 도서관</span>
            <span style={{ fontSize: '13px', color: '#666' }}>(단위: 명)</span>
          </div>
          <Table
            className="black-bordered-table"
            dataSource={aiLibraryData}
            columns={aiLibraryColumns}
            pagination={false}
            loading={loading}
            bordered
            size="small"
            tableLayout="fixed"
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
          />
        </div>
      </Card>

    </div>
  )
}
