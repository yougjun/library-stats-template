import { ResponsiveContainer, LineChart, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line, Bar, LabelList } from 'recharts'

interface MaximizedChartProps {
  type: 'line' | 'bar'
  data: any[]
  lines?: Array<{
    dataKey: string
    stroke: string
    name: string
    strokeWidth?: number
    strokeDasharray?: string
    dot?: any
  }>
  bars?: Array<{
    dataKey: string
    fill: string
    name: string
  }>
  showGrid?: boolean
  showLabels?: boolean
  showAnimation?: boolean
  interval?: 'month' | 'quarter' | 'year'
}

export default function MaximizedChart({
  type,
  data,
  lines = [],
  bars = [],
  showGrid = true,
  showLabels = false,
  showAnimation = true,
  interval = 'month'
}: MaximizedChartProps) {
  const filteredData = interval === 'month'
    ? data
    : interval === 'quarter'
    ? data.filter((_, idx) => idx % 3 === 0)
    : interval === 'year'
    ? (data.length <= 12 ? data : data.filter((_, idx) => idx % 12 === 0))
    : data

  const ChartComponent = type === 'line' ? LineChart : BarChart

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ChartComponent data={filteredData}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" />}
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />

        {type === 'line' && lines.map((lineConfig, idx) => (
          <Line
            key={idx}
            type="monotone"
            {...lineConfig}
            isAnimationActive={showAnimation}
          >
            {showLabels && (
              <LabelList
                position="top"
                style={{ fontSize: '12px', fontWeight: 'bold', fill: '#333' }}
                offset={10}
              />
            )}
          </Line>
        ))}

        {type === 'bar' && bars.map((barConfig, idx) => (
          <Bar
            key={idx}
            {...barConfig}
            isAnimationActive={showAnimation}
          >
            {showLabels && (
              <LabelList
                position="top"
                style={{ fontSize: '12px', fontWeight: 'bold', fill: '#333' }}
                offset={5}
              />
            )}
          </Bar>
        ))}
      </ChartComponent>
    </ResponsiveContainer>
  )
}
