import { useState, useRef, useEffect } from 'react';
import { Card, Input, List, Avatar, Spin, Tag, Button } from 'antd';
import { RobotOutlined, SendOutlined, CloseOutlined, UserOutlined, LikeOutlined, DislikeOutlined, EditOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const markdownStyles = `
  .markdown-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
    font-size: 13px;
  }
  .markdown-content th, .markdown-content td {
    border: 1px solid #d9d9d9;
    padding: 6px 10px;
    text-align: left;
  }
  .markdown-content th {
    background-color: #fafafa;
    font-weight: 600;
  }
  .markdown-content tr:nth-child(even) {
    background-color: #fafafa;
  }
  .markdown-content strong {
    color: #1890ff;
  }
  .markdown-content p {
    margin: 4px 0;
  }
`;
import { chatApi } from '../services/api';

const { TextArea } = Input;

interface ChartData {
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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  chartData?: ChartData | null;
  suggestions?: string[];
  typoCorrections?: string[];
  intent?: string;
  confidence?: number;
  userQuery?: string;
  feedbackGiven?: 'accept' | 'correct' | 'wrong' | null;
}

const getExampleQuestions = () => {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const prevMonth = month === 1 ? 12 : month - 1;
  return [
    `${year}년 ${prevMonth}월 이용자 몇명?`,
    `${year}년 ${prevMonth}월 책꾸러미`,
    '책꾸러미 어떻게 구해?',
    '1층 이용자 출처는?',
  ];
};

const ChatChart = ({ chartData }: { chartData: ChartData }) => {
  const transformedData = chartData.labels.map((label, idx) => {
    const point: Record<string, string | number> = { name: label };
    chartData.datasets.forEach(ds => {
      point[ds.label] = ds.data[idx];
    });
    return point;
  });

  const colors = ['#4CAF50', '#2196F3', '#FF9800', '#E91E63'];

  if (chartData.type === 'line') {
    return (
      <div style={{ width: '100%', height: 200, marginTop: 8 }}>
        <ResponsiveContainer>
          <LineChart data={transformedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={10} />
            <YAxis fontSize={10} />
            <Tooltip />
            <Legend />
            {chartData.datasets.map((ds, idx) => (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={ds.borderColor || colors[idx]}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: 200, marginTop: 8 }}>
      <ResponsiveContainer>
        <BarChart data={transformedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" fontSize={10} />
          <YAxis fontSize={10} />
          <Tooltip />
          <Legend />
          {chartData.datasets.map((ds, idx) => (
            <Bar
              key={ds.label}
              dataKey={ds.label}
              fill={typeof ds.backgroundColor === 'string' ? ds.backgroundColor : colors[idx]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatWidget({ isOpen, onClose }: ChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '안녕하세요! 도서관 통계 시스템에 대해 궁금한 점이 있으신가요?\n\n**실시간 통계 조회 예시:**' }
  ]);
  const [showExamples, setShowExamples] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    return sessionStorage.getItem('chat_session_id') || undefined;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [correctingIndex, setCorrectingIndex] = useState<number | null>(null);
  const [correctionIntent, setCorrectionIntent] = useState('');

  const handleFeedback = async (msgIndex: number, feedbackType: 'accept' | 'wrong' | 'correct', correctIntent?: string) => {
    const msg = messages[msgIndex];
    if (!msg.userQuery || !msg.intent) return;

    try {
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: msg.userQuery,
          predicted_intent: msg.intent,
          confidence: msg.confidence || 0.5,
          feedback_type: correctIntent ? 'correct' : feedbackType,
          correct_intent: correctIntent || null
        })
      });

      setMessages(prev => prev.map((m, i) =>
        i === msgIndex ? { ...m, feedbackGiven: correctIntent ? 'correct' : feedbackType } : m
      ));
      setCorrectingIndex(null);
      setCorrectionIntent('');
    } catch (err) {
      console.error('Feedback error:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleExampleClick = (question: string) => {
    setShowExamples(false);
    setInput(question);
    setTimeout(() => {
      sendMessage(question);
    }, 100);
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: Message = { role: 'user', content: message };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setShowExamples(false);

    try {
      const response = await chatApi.sendMessage(userMessage.content, sessionId);

      if (response.data.session_id) {
        setSessionId(response.data.session_id);
        sessionStorage.setItem('chat_session_id', response.data.session_id);
      }

      const botMessage: Message = {
        role: 'assistant',
        content: response.data.response,
        chartData: response.data.chart_data,
        suggestions: response.data.suggestions || [],
        typoCorrections: response.data.typo_corrections || [],
        intent: response.data.intent,
        confidence: response.data.confidence,
        userQuery: userMessage.content,
        feedbackGiven: null
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error: unknown) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    sendMessage(input);
  };

  if (!isOpen) return null;

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RobotOutlined /> AI 도우미
        </div>
      }
      extra={<CloseOutlined onClick={onClose} style={{ cursor: 'pointer' }} />}
      style={{
        position: 'fixed',
        bottom: 80,
        right: 20,
        width: 350,
        height: 500,
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}
      styles={{ body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 0 } }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        <List
          itemLayout="horizontal"
          dataSource={messages}
          renderItem={(msg) => (
            <List.Item style={{ border: 'none', padding: '4px 0' }}>
              <div style={{
                display: 'flex',
                width: '100%',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 8
              }}>
                {msg.role === 'assistant' && (
                  <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#1890ff', flexShrink: 0 }} />
                )}
                <div style={{ maxWidth: '80%' }}>
                  {msg.typoCorrections && msg.typoCorrections.length > 0 && (
                    <div style={{
                      fontSize: '11px',
                      color: '#888',
                      marginBottom: 4,
                      fontStyle: 'italic'
                    }}>
                      자동 수정: {msg.typoCorrections.join(', ')}
                    </div>
                  )}
                  <div style={{
                    backgroundColor: msg.role === 'user' ? '#1890ff' : '#f0f2f5',
                    color: msg.role === 'user' ? 'white' : 'black',
                    padding: '8px 12px',
                    borderRadius: '12px',
                    wordBreak: 'break-word'
                  }} className="markdown-content">
                    <style>{markdownStyles}</style>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    {msg.chartData && <ChatChart chartData={msg.chartData} />}
                  </div>
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {msg.suggestions.map((suggestion, idx) => (
                        <Tag
                          key={idx}
                          color="cyan"
                          style={{ cursor: 'pointer', fontSize: '11px' }}
                          onClick={() => handleExampleClick(suggestion)}
                        >
                          {suggestion}
                        </Tag>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && msg.intent && !msg.feedbackGiven && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '11px', color: '#888' }}>응답 정확도:</span>
                      <Button
                        size="small"
                        type="text"
                        icon={<LikeOutlined />}
                        onClick={() => handleFeedback(messages.indexOf(msg), 'accept')}
                        style={{ fontSize: '11px', padding: '0 4px' }}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<DislikeOutlined />}
                        onClick={() => handleFeedback(messages.indexOf(msg), 'wrong')}
                        style={{ fontSize: '11px', padding: '0 4px' }}
                      />
                      <Button
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => setCorrectingIndex(messages.indexOf(msg))}
                        style={{ fontSize: '11px', padding: '0 4px' }}
                      />
                    </div>
                  )}
                  {correctingIndex === messages.indexOf(msg) && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                      <Input
                        size="small"
                        placeholder="올바른 의도 입력"
                        value={correctionIntent}
                        onChange={(e) => setCorrectionIntent(e.target.value)}
                        style={{ width: 120, fontSize: '11px' }}
                      />
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => handleFeedback(messages.indexOf(msg), 'correct', correctionIntent)}
                        disabled={!correctionIntent}
                      >
                        수정
                      </Button>
                      <Button size="small" onClick={() => setCorrectingIndex(null)}>취소</Button>
                    </div>
                  )}
                  {msg.feedbackGiven && (
                    <div style={{ marginTop: 4, fontSize: '10px', color: '#52c41a' }}>
                      ✓ 피드백 반영됨
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#87d068', flexShrink: 0 }} />
                )}
              </div>
            </List.Item>
          )}
        />
        {showExamples && (
          <div style={{ padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {getExampleQuestions().map((q, i) => (
              <Tag
                key={i}
                color="blue"
                style={{ cursor: 'pointer', marginRight: 0 }}
                onClick={() => handleExampleClick(q)}
              >
                {q}
              </Tag>
            ))}
          </div>
        )}
        {loading && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Spin size="small" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="질문을 입력하세요..."
            autoSize={{ minRows: 1, maxRows: 3 }}
          />
          <Button
            icon={<SendOutlined />}
            type="primary"
            onClick={handleSend}
          />
        </div>
      </div>
    </Card>
  );
}