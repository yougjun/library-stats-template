import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

interface ActualDataPoint {
  month: string
  value: number
}

interface PredictionDataPoint {
  year_month: string
  predicted_value: number
  lower_bound: number
  upper_bound: number
}

interface ComparisonChartProps {
  actualData: ActualDataPoint[]
  predictionData?: PredictionDataPoint[]
  dataMode: 'actual' | 'prediction' | 'comparison'
  title?: string
  dataKey: string
  color?: string
  height?: number
}

export default function ComparisonChart({
  actualData,
  predictionData = [],
  dataMode,
  dataKey,
  color = '#1890ff',
  height = 300
}: ComparisonChartProps) {
  const mergedData = actualData.map(item => {
    const pred = predictionData.find(p => p.year_month === item.month)

    return {
      month: item.month,
      실제값: dataMode !== 'prediction' ? item.value : null,
      예측값: dataMode !== 'actual' && pred ? pred.predicted_value : null,
      하한값: dataMode !== 'actual' && pred ? pred.lower_bound : null,
      상한값: dataMode !== 'actual' && pred ? pred.upper_bound : null
    }
  })

  if (dataMode !== 'actual') {
    predictionData.forEach(pred => {
      if (!actualData.find(a => a.month === pred.year_month)) {
        mergedData.push({
          month: pred.year_month,
          실제값: null,
          예측값: pred.predicted_value,
          하한값: pred.lower_bound,
          상한값: pred.upper_bound
        })
      }
    })
  }

  mergedData.sort((a, b) => a.month.localeCompare(b.month))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={mergedData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />

        {/* Confidence interval area */}
        {dataMode !== 'actual' && (
          <>
            <Area
              type="monotone"
              dataKey="상한값"
              stackId="1"
              stroke="none"
              fill={color}
              fillOpacity={0.1}
            />
            <Area
              type="monotone"
              dataKey="하한값"
              stackId="1"
              stroke="none"
              fill={color}
              fillOpacity={0.1}
            />
          </>
        )}

        {/* Actual data line */}
        {dataMode !== 'prediction' && (
          <Line
            type="monotone"
            dataKey="실제값"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4 }}
            name="실제 데이터"
          />
        )}

        {/* Prediction data line */}
        {dataMode !== 'actual' && (
          <Line
            type="monotone"
            dataKey="예측값"
            stroke="#ff7875"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: '#ff7875' }}
            name="예측 데이터"
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
