export function sumByField(data: any[], field: string): number {
  return data.reduce((sum, item) => sum + (item[field] || 0), 0)
}

export function groupBy(data: any[], keyFields: string[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}

  data.forEach(item => {
    const key = keyFields.map(field => item[field]).join('_')
    if (!grouped[key]) {
      grouped[key] = []
    }
    grouped[key].push(item)
  })

  return grouped
}

export function aggregateByKey(
  data: any[],
  keyFields: string[],
  sumFields: string[]
): any[] {
  const grouped = groupBy(data, keyFields)

  return Object.entries(grouped).map(([key, items]) => {
    const result: any = {}

    keyFields.forEach((field, index) => {
      result[field] = items[0][field]
    })

    sumFields.forEach(field => {
      result[field] = sumByField(items, field)
    })

    return result
  })
}

export function distributeWithLargestRemainder(
  values: Record<string, number>,
  targetTotal: number
): Record<string, number> {
  const keys = Object.keys(values)
  const sourceTotal = Object.values(values).reduce((a, b) => a + b, 0)

  if (sourceTotal === 0 || targetTotal === 0) {
    return keys.reduce((acc, key) => ({ ...acc, [key]: 0 }), {})
  }

  const multiplier = targetTotal / sourceTotal
  const exactValues = keys.map(key => ({
    key,
    exact: values[key] * multiplier,
    floor: Math.floor(values[key] * multiplier)
  }))

  const floorSum = exactValues.reduce((sum, v) => sum + v.floor, 0)
  let remaining = targetTotal - floorSum

  const withRemainders = exactValues.map(v => ({
    ...v,
    remainder: v.exact - v.floor
  })).sort((a, b) => b.remainder - a.remainder)

  const result: Record<string, number> = {}
  for (const item of withRemainders) {
    if (remaining > 0 && item.remainder > 0) {
      result[item.key] = item.floor + 1
      remaining--
    } else {
      result[item.key] = item.floor
    }
  }

  return result
}
