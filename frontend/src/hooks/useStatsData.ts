import { useState, useEffect } from 'react'
import { message } from 'antd'
import { statsApi } from '../services/api'
import { getReadingMultiplier } from '../utils/libraryDays'

type FloorType = 'floor1' | 'floor23' | 'knowledge'

interface UseStatsDataOptions {
  floor: FloorType
  yearMonth: string
}

export function useStatsData({ floor, yearMonth }: UseStatsDataOptions) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    loadData()
  }, [yearMonth, floor])

  const loadData = async () => {
    setLoading(true)
    try {
      let res
      if (floor === 'floor1') {
        res = await statsApi.getFloor1Cumulative(yearMonth)
      } else if (floor === 'floor23') {
        res = await statsApi.getFloor23Cumulative(yearMonth)
      } else {
        res = await statsApi.getKnowledge(yearMonth)
      }
      setData(res.data)
    } catch (error: unknown) {
      message.error('데이터 로드 실패')
    } finally {
      setLoading(false)
    }
  }

  return { data, loading, reload: loadData }
}

export function calculateCumulativeReading(
  loanCount: number,
  floor: FloorType
): number {
  if (floor === 'knowledge') return 0
  const multiplier = getReadingMultiplier(floor)
  return Math.round(loanCount * multiplier)
}

export function aggregateVisitorData(
  visitorData: any[],
  floor: FloorType
): any[] {
  if (floor === 'floor1') {
    return aggregateFloor1Visitor(visitorData)
  } else if (floor === 'floor23') {
    return aggregateFloor23Visitor(visitorData)
  }
  return []
}

function aggregateFloor1Visitor(data: any[]): any[] {
  const grouped: any = {}

  data.forEach((item: any) => {
    const key = `${item.age_group}_${item.room_type}_${item.usage_type}`
    if (!grouped[key]) {
      grouped[key] = { ...item }
    } else {
      grouped[key].user_count += item.user_count || 0
    }
  })

  return Object.values(grouped)
}

function aggregateFloor23Visitor(data: any[]): any[] {
  const grouped: any = {}

  data.forEach((item: any) => {
    const key = `${item.age_group}_${item.category}`
    if (!grouped[key]) {
      grouped[key] = { ...item }
    } else {
      grouped[key].user_count += item.user_count || 0
    }
  })

  return Object.values(grouped)
}
