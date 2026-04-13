import { Typography, Card, Divider, Table, Space } from 'antd'
import { CalculatorOutlined } from '@ant-design/icons'
import { getReadingMultiplier } from '../utils/libraryDays'

const { Title, Paragraph, Text } = Typography

export default function CalculationGuide() {
  const floor1Multiplier = getReadingMultiplier('floor1')
  const floor23Multiplier = getReadingMultiplier('floor23')

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <CalculatorOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          <Title level={2}>통계 산출 기준</Title>
          <Text type="secondary">도서관 통계 수치 계산 및 합산 방법 안내</Text>
        </div>

        <Card title="1. 어린이자료실 이용자 통계 (1층)">
          <Paragraph>
            <Text strong>열람 인원 계산식:</Text>
            <br />
            <Text code>열람 = 대출 × multiplier</Text>
          </Paragraph>
          <Paragraph>
            <Text type="secondary">
              ※ multiplier는 설정에서 변경 가능한 배수 값입니다. (현재값: {floor1Multiplier})
            </Text>
          </Paragraph>
          <Paragraph>
            <Text strong>합산 구조:</Text>
            <ul>
              <li>어린이자료실(children) + 유아자료실(infant)</li>
              <li>연령대별: 유아/초등생, 중고생, 성인</li>
              <li>대출 + 열람 = 총 이용자</li>
            </ul>
          </Paragraph>
        </Card>

        <Card title="2. 종합,인문예술자료실 이용자 통계 (2,3층)">
          <Paragraph>
            <Text strong>열람 인원 계산식:</Text>
            <br />
            <Text code>열람 = 대출 × multiplier</Text>
          </Paragraph>
          <Paragraph>
            <Text type="secondary">
              ※ multiplier는 카테고리별로 설정에서 변경 가능한 배수 값입니다.
            </Text>
          </Paragraph>
          <Paragraph>
            <Text strong>카테고리 구분:</Text>
            <br />
            <Text strong style={{ color: '#1890ff' }}>• 대출 + 열람:</Text> 만화자료실, 영어자료실, 다봄자료실, 인문예술자료실
            <br />
            <Text strong style={{ color: '#52c41a' }}>• 대출만:</Text> 상호대차(책바다/책나래)
            <br />
            <Text strong style={{ color: '#faad14' }}>• 열람만:</Text> 멀티미디어실, 정기간행물실, 영화감상실, 음악감상실, 디지털갤러리
          </Paragraph>
          <Paragraph>
            <Text strong>연령대별 합산:</Text>
            <br />
            유아/초등생, 중고생, 성인별로 각 카테고리 이용자 집계
          </Paragraph>
        </Card>

        <Card title="3. 지식정보기반과 종합 통계">
          <Paragraph>
            <Text strong>출입자 통계:</Text>
            <br />
            출입게이트를 통한 도서관 전체 출입자 수
          </Paragraph>
        </Card>

        <Card title="4. 합산되는 통계 항목">
          <Paragraph>
            <Text strong type="danger">여러 값이 합쳐져 표시되는 항목</Text>
          </Paragraph>

          <Divider orientation="left">1층 이용자 통계</Divider>
          <Paragraph>
            <Text strong>1. 자료실별 합계:</Text>
            <br />
            <Text code>총 이용자 = 어린이자료실 + 유아자료실</Text>
            <br />
            <Text type="secondary">※ 두 자료실의 연령대별 대출/열람 인원을 모두 합산</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>2. 연령대별 합계:</Text>
            <br />
            <Text code>연령대별 총 이용자 = 대출 + 열람</Text>
            <br />
            <Text type="secondary">※ 각 연령대(유아/초등생, 중고생, 성인)의 대출과 열람 인원 합산</Text>
          </Paragraph>

          <Divider orientation="left">2,3층 이용자 통계</Divider>
          <Paragraph>
            <Text strong>1. 연령대별 합계:</Text>
            <br />
            <Text code>연령대별 총 이용자 = 모든 카테고리 합산</Text>
            <br />
            <Text type="secondary">※ 자료이용, 열람, 상호대차, 만화책마루, 영어책마루, 다봄자료실, 인문예술자료실, 멀티미디어존, 간행물존, 디지털갤러리, 영화, 음악 등 모든 카테고리 합산</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>2. 카테고리별 합계:</Text>
            <br />
            <Text code>카테고리별 총 이용자 = 유아/초등생 + 중고생 + 성인</Text>
            <br />
            <Text type="secondary">※ 각 카테고리의 모든 연령대 합산</Text>
          </Paragraph>

          <Divider orientation="left">자료 통계</Divider>
          <Paragraph>
            <Text strong>십진분류 합계:</Text>
            <br />
            <Text code>총 이용 = 000 + 100 + 200 + 300 + 400 + 500 + 600 + 700 + 800 + 900 + 기타</Text>
            <br />
            <Text type="secondary">※ 모든 주제분류의 대출 또는 열람 수 합산</Text>
          </Paragraph>

          <Divider orientation="left">프로그램 통계</Divider>
          <Paragraph>
            <Text strong>프로그램 합계:</Text>
            <br />
            <Text code>총 회차/참여인원 = 모든 프로그램의 회차/참여인원 합산</Text>
            <br />
            <Text type="secondary">※ 1층: 동화체험, 도서관나들이, 어린이북클럽, 야간개관(어린이), 책꾸러미, 자료실행사</Text>
            <br />
            <Text type="secondary">※ 2,3층: 야간개관(일반), 북적북적청소년체험, 자원봉사자교육, 다봄프로그램, 대면낭독, 힐링북콘서트, 자료실행사</Text>
          </Paragraph>

          <Divider orientation="left">지식정보기반과 층별 소계</Divider>
          <Paragraph>
            <Text strong>1층 소계:</Text>
            <br />
            <Text code>1층 총 이용자 = 대출 + 열람 + 프로그램 + AI도서관</Text>
            <br />
            <Text type="secondary">※ 어린이자료실과 유아자료실의 모든 이용 형태 합산</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>2,3층 소계:</Text>
            <br />
            <Text code>2,3층 총 이용자 = 대출 + 열람 + 프로그램 + AI도서관</Text>
            <br />
            <Text type="secondary">※ 종합,인문예술자료실의 모든 이용 형태 합산</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>도서관 전체 총계:</Text>
            <br />
            <Text code>전체 이용자 = 1층 소계 + 2,3층 소계</Text>
            <br />
            <Text type="secondary">※ 도서관 전체 이용 현황 (출입자 수는 별도 집계)</Text>
          </Paragraph>
        </Card>

        <Card title="5. 배수 적용 방식">
          <Paragraph>
            <Text strong type="danger">현재 시스템 적용 방식:</Text>
            <br />
            <Text code>각 월의 대출 수 × multiplier → 반올림 → 월별 열람 수</Text>
            <br />
            <Text code>누적 열람 수 = 각 월 열람 수의 합계</Text>
          </Paragraph>
          <Divider />
          <Paragraph>
            <Text strong>예시:</Text> 어린이자료실 중고생 (multiplier = {floor1Multiplier})
          </Paragraph>
          <Paragraph>
            <Text type="secondary">
              ※ 자료실별(어린이자료실, 유아자료실) 각각 반올림 후 합산
            </Text>
          </Paragraph>
          <Table
            size="small"
            pagination={false}
            bordered
            dataSource={[
              { month: '1월', loan: '18 (18+0)', calculated: `18×${floor1Multiplier}=${Math.round(18*floor1Multiplier)} + 0×${floor1Multiplier}=0`, reading: Math.round(18*floor1Multiplier) },
              { month: '2월', loan: '32 (28+4)', calculated: `28×${floor1Multiplier}=${Math.round(28*floor1Multiplier)} + 4×${floor1Multiplier}=${Math.round(4*floor1Multiplier)}`, reading: Math.round(28*floor1Multiplier) + Math.round(4*floor1Multiplier) },
              { month: '3월', loan: '37 (35+2)', calculated: `35×${floor1Multiplier}=${Math.round(35*floor1Multiplier)} + 2×${floor1Multiplier}=${Math.round(2*floor1Multiplier)}`, reading: Math.round(35*floor1Multiplier) + Math.round(2*floor1Multiplier) },
              { month: '4월', loan: '0 (0+0)', calculated: `0×${floor1Multiplier}=0 + 0×${floor1Multiplier}=0`, reading: 0 },
              { month: '5월', loan: '12 (11+1)', calculated: `11×${floor1Multiplier}=${Math.round(11*floor1Multiplier)} + 1×${floor1Multiplier}=${Math.round(1*floor1Multiplier)}`, reading: Math.round(11*floor1Multiplier) + Math.round(1*floor1Multiplier) },
              { month: '6월', loan: '9 (9+0)', calculated: `9×${floor1Multiplier}=${Math.round(9*floor1Multiplier)} + 0×${floor1Multiplier}=0`, reading: Math.round(9*floor1Multiplier) },
              { month: '7월', loan: '9 (9+0)', calculated: `9×${floor1Multiplier}=${Math.round(9*floor1Multiplier)} + 0×${floor1Multiplier}=0`, reading: Math.round(9*floor1Multiplier) },
              { month: '8월', loan: '15 (15+0)', calculated: `15×${floor1Multiplier}=${Math.round(15*floor1Multiplier)} + 0×${floor1Multiplier}=0`, reading: Math.round(15*floor1Multiplier) },
              { month: '9월', loan: '16 (15+1)', calculated: `15×${floor1Multiplier}=${Math.round(15*floor1Multiplier)} + 1×${floor1Multiplier}=${Math.round(1*floor1Multiplier)}`, reading: Math.round(15*floor1Multiplier) + Math.round(1*floor1Multiplier) },
              { month: '누적', loan: 148, calculated: '각 월 자료실별 반올림 합계', reading: Math.round(18*floor1Multiplier) + Math.round(28*floor1Multiplier) + Math.round(4*floor1Multiplier) + Math.round(35*floor1Multiplier) + Math.round(2*floor1Multiplier) + Math.round(11*floor1Multiplier) + Math.round(1*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(1*floor1Multiplier) }
            ]}
            columns={[
              { title: '월', dataIndex: 'month', key: 'month', align: 'center', width: 80 },
              { title: '대출', dataIndex: 'loan', key: 'loan', align: 'center', width: 100 },
              { title: '계산식 (어린이+유아)', dataIndex: 'calculated', key: 'calculated', align: 'left' },
              { title: '열람', dataIndex: 'reading', key: 'reading', align: 'center', width: 60 }
            ]}
          />
          <Divider />
          <Paragraph>
            <Text type="warning">
              <strong>차이 발생 원인:</strong>
              <br />
              ✓ 현재 방식: 각 월 × 자료실별로 반올림 후 합산 = <Text strong>{Math.round(18*floor1Multiplier) + Math.round(28*floor1Multiplier) + Math.round(4*floor1Multiplier) + Math.round(35*floor1Multiplier) + Math.round(2*floor1Multiplier) + Math.round(11*floor1Multiplier) + Math.round(1*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(1*floor1Multiplier)}명</Text>
              <br />
              ✗ 단순 누적 계산: 148 × {floor1Multiplier} = {(148 * floor1Multiplier).toFixed(1)} → {Math.round(148 * floor1Multiplier)}명
              <br />
              <br />
              <Text strong>차이: {(Math.round(18*floor1Multiplier) + Math.round(28*floor1Multiplier) + Math.round(4*floor1Multiplier) + Math.round(35*floor1Multiplier) + Math.round(2*floor1Multiplier) + Math.round(11*floor1Multiplier) + Math.round(1*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(9*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(15*floor1Multiplier) + Math.round(1*floor1Multiplier)) - Math.round(148 * floor1Multiplier)}명</Text>
              <br />
              <Text type="secondary">
                월별, 자료실별 이중 반올림 과정에서 발생하는 오차 누적
                <br />
                (예: 2월 → 28×{floor1Multiplier}={28*floor1Multiplier}→{Math.round(28*floor1Multiplier)} + 4×{floor1Multiplier}={4*floor1Multiplier}→{Math.round(4*floor1Multiplier)} = {Math.round(28*floor1Multiplier) + Math.round(4*floor1Multiplier)}, 단순 계산 시 32×{floor1Multiplier}={32*floor1Multiplier}→{Math.round(32*floor1Multiplier)})
              </Text>
            </Text>
          </Paragraph>
        </Card>

        <Card title="6. 자동화(Automation) 데이터 처리">
          <Paragraph>
            <Text strong>KLAS Automation 도구:</Text>
            <br />
            엑셀 파일에서 데이터를 읽어 API를 통해 자동으로 전송하는 도구
          </Paragraph>
          <Paragraph>
            <Text strong>처리 방식:</Text>
            <br />
            <Text code>Automation 데이터 = 수동 입력 데이터와 동일한 방식으로 처리</Text>
            <br />
            <Text type="secondary">※ API를 통해 전송된 데이터는 수동 입력과 동일하게 multiplier 적용, 합산 규칙 적용</Text>
          </Paragraph>
          <Paragraph>
            <Text strong>대상 데이터:</Text>
            <ul>
              <li>1층: 이용자 현황, 자료이용 현황</li>
              <li>2,3층: 이용자 현황, 자료이용 현황(주제별, 자료별-종합자료실, 도서-인문예술자료실)</li>
            </ul>
          </Paragraph>
          <Paragraph>
            <Text type="secondary">
              ※ Automation으로 전송된 데이터도 위의 모든 합산 및 배수 적용 규칙이 동일하게 적용됩니다.
            </Text>
          </Paragraph>
        </Card>

      </Space>
    </div>
  )
}
