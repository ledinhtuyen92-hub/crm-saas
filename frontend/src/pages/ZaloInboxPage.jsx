import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Avatar, Badge, Button, Col, Divider, Empty, Input, Modal,
  Row, Select, Space, Spin, Tag, Tooltip, Typography, Form, message, Upload
} from 'antd'
import {
  CheckCircleOutlined, CloseOutlined, MessageOutlined,
  PhoneOutlined, ReloadOutlined, SearchOutlined,
  UserAddOutlined, UserOutlined, WechatOutlined,
  InfoCircleOutlined, TeamOutlined, PaperClipOutlined, SendOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

dayjs.extend(relativeTime)
dayjs.locale('vi')

const { Text, Title, Paragraph } = Typography
const { Search } = Input

// ── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  new:       { label: 'Mới',           color: '#3b82f6', bg: '#eff6ff' },
  chatting:  { label: 'Đang chat',     color: '#10b981', bg: '#ecfdf5' },
  converted: { label: 'Đã chuyển đổi', color: '#8b5cf6', bg: '#f5f3ff' },
  archived:  { label: 'Lưu trữ',       color: '#6b7280', bg: '#f9fafb' },
}

// ── Lead Item trong danh sách trái ───────────────────────────────────────────
function LeadListItem({ lead, selected, onClick }) {
  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new
  const isNew = lead.status === 'new'

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
        background: selected ? '#eff6ff' : 'transparent',
        borderLeft: selected ? '3px solid #2563eb' : '3px solid transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = '#f8fafc' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent' }}
    >
      <Row gutter={10} align="middle" wrap={false}>
        <Col flex="none">
          <Badge dot={isNew} color="#3b82f6" offset={[-4, 4]}>
            <Avatar
              size={44}
              src={lead.avatar_url}
              icon={<UserOutlined />}
              style={{ background: '#dbeafe', color: '#2563eb' }}
            />
          </Badge>
        </Col>
        <Col flex="auto" style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong ellipsis style={{ fontSize: 14, maxWidth: 140 }}>
              {lead.display_name || `Zalo ${lead.social_id?.slice(-4)}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
              {dayjs(lead.last_interaction_date).fromNow()}
            </Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            <Text type="secondary" ellipsis style={{ fontSize: 12, maxWidth: 140 }}>
              {lead.last_message || 'Chưa có tin nhắn'}
            </Text>
            <Tag
              style={{
                fontSize: 10, padding: '0 6px', lineHeight: '18px',
                color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`,
                borderRadius: 10, marginLeft: 4,
              }}
            >
              {cfg.label}
            </Tag>
          </div>
        </Col>
      </Row>
    </div>
  )
}

// ── Component Panel Chi tiết (Kèm khung Chat) ──────────────────────────────
function LeadDetailPanel({ lead, employees, onRefresh }) {
  const { maintenanceMode } = useAuth()
  const [convertModalVisible, setConvertModalVisible] = useState(false)
  const [convertForm] = Form.useForm()
  const [convertLoading, setConvertLoading] = useState(false)
  
  // Chat state
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sending, setSending] = useState(false)
  const chatContainerRef = useRef(null)

  useEffect(() => {
    if (lead?.id) {
      fetchMessages()
    }
  }, [lead?.id])

  const fetchMessages = async () => {
    setLoadingMessages(true)
    try {
      const res = await api.get(`/zalo/social-leads/${lead.id}/messages/`)
      setMessages(res.data || [])
      scrollToBottom()
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingMessages(false)
    }
  }

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }, 100)
  }

  const handleSendMessage = async (file = null) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!messageText.trim() && !file) return

    setSending(true)
    try {
      const formData = new FormData()
      if (messageText.trim()) formData.append('text', messageText.trim())
      if (file) formData.append('file', file)

      const res = await api.post(`/zalo/social-leads/${lead.id}/send-message/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setMessages([...messages, res.data])
      setMessageText('')
      scrollToBottom()
      onRefresh() // Refresh để update tin nhắn mới nhất bên trái
    } catch (err) {
      message.error(err.response?.data?.error || 'Gửi tin nhắn thất bại.')
    } finally {
      setSending(false)
    }
  }

  const handleAssign = async (userId) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      await api.post(`/zalo/social-leads/${lead.id}/assign/`, { assigned_to: userId || null })
      message.success('Phân công thành công!')
      onRefresh()
    } catch { message.error('Lỗi khi phân công.') }
  }

  if (!lead) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#9ca3af' }}>
        <WechatOutlined style={{ fontSize: 64, opacity: 0.3 }} />
        <Text type="secondary">Chọn một cuộc hội thoại để xem chi tiết</Text>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0 }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Avatar size={56} src={lead.avatar_url} icon={<UserOutlined />} style={{ background: '#dbeafe', color: '#2563eb' }} />
          </Col>
          <Col flex="auto">
            <Title level={5} style={{ margin: 0 }}>{lead.display_name || `Khách Zalo (${lead.social_id?.slice(-4)})`}</Title>
            <Space size={6} style={{ marginTop: 4 }}>
              <Tag style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 10 }}>{cfg.label}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <WechatOutlined style={{ marginRight: 4 }} />Zalo · {lead.oa_name || 'OA'}
              </Text>
            </Space>
          </Col>
          <Col>
            <Select
              placeholder="Nhân viên phụ trách"
              style={{ width: 160 }}
              value={lead.assigned_to || null}
              allowClear
              onChange={handleAssign}
              options={[{ value: null, label: 'Chưa phân công' }, ...employees.map(e => ({ value: e.id, label: e.full_name || e.username }))]}
            />
          </Col>
          {lead.status !== 'converted' && lead.status !== 'archived' && (
            <Col>
              <Button type="primary" icon={<CheckCircleOutlined />} style={{ background: '#10b981', borderColor: '#10b981' }} onClick={() => setConvertModalVisible(true)}>
                Tạo KH
              </Button>
            </Col>
          )}
        </Row>
      </div>

      {/* Body — Lịch sử Chat */}
      <div ref={chatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#eef2f5' }}>
        {loadingMessages ? (
          <div style={{ textAlign: 'center', marginTop: 50 }}><Spin /></div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 50, color: '#9ca3af' }}>Chưa có tin nhắn nào.</div>
        ) : (
          messages.map((msg, idx) => {
            const isOutbound = msg.direction === 'outbound'
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isOutbound ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
                {!isOutbound && (
                  <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, marginLeft: 36 }}>{msg.sender_name}</Text>
                )}
                {isOutbound && (
                  <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, marginRight: 8 }}>{msg.sender_name}</Text>
                )}
                
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexDirection: isOutbound ? 'row-reverse' : 'row' }}>
                  {!isOutbound && <Avatar size={28} src={lead.avatar_url} icon={<UserOutlined />} />}
                  
                  <div style={{
                    background: isOutbound ? '#0068ff' : '#fff',
                    color: isOutbound ? '#fff' : '#000',
                    border: isOutbound ? 'none' : '1px solid #e2e8f0',
                    borderRadius: isOutbound ? '12px 0 12px 12px' : '0 12px 12px 12px',
                    padding: '8px 12px',
                    maxWidth: 350,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}>
                    {msg.attachment_url && (
                      <div style={{ marginBottom: msg.content ? 8 : 0 }}>
                        {msg.attachment_type === 'image' ? (
                          <img src={msg.attachment_url} alt="attachment" style={{ maxWidth: '100%', borderRadius: 8 }} />
                        ) : (
                          <a href={msg.attachment_url} target="_blank" rel="noreferrer" style={{ color: isOutbound ? '#fff' : '#0068ff', textDecoration: 'underline' }}>
                            <PaperClipOutlined /> Tệp đính kèm
                          </a>
                        )}
                      </div>
                    )}
                    {msg.content && <Text style={{ color: 'inherit', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.content}</Text>}
                  </div>
                </div>
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, marginRight: isOutbound ? 8 : 0, marginLeft: isOutbound ? 0 : 36 }}>
                  {dayjs(msg.created_at).format('HH:mm DD/MM/YYYY')}
                </Text>
              </div>
            )
          })
        )}
      </div>

      {/* Footer — Actions */}
      {lead.status !== 'converted' && lead.status !== 'archived' && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
          <Button
            type="primary"
            icon={<UserAddOutlined />}
            block
            onClick={() => {
              if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
              setConvertModalVisible(true)
            }}
            style={{
              background: 'linear-gradient(135deg, #6d28d9, #4f46e5)',
              border: 'none', height: 40,
            }}
          >
            Chuyển đổi thành Khách hàng
          </Button>
          <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center', marginTop: 8 }}>
            <InfoCircleOutlined style={{ marginRight: 4 }} />
            Nhập số điện thoại để tạo hồ sơ khách hàng chính thức
          </Text>
        </div>
      )}

      {/* Modal Convert */}
      <Modal
        title={
          <Space><UserAddOutlined style={{ color: '#6d28d9' }} />
            Chuyển đổi Lead thành Khách hàng
          </Space>
        }
        open={convertModalVisible}
        onCancel={() => setConvertModalVisible(false)}
        onOk={handleConvert}
        okText="Chuyển đổi"
        cancelText="Huỷ"
        confirmLoading={convertLoading}
        okButtonProps={{ style: { background: '#6d28d9', borderColor: '#6d28d9' } }}
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          Nhập số điện thoại của <strong>{lead.display_name}</strong> để tạo hồ sơ Khách hàng chính thức. Nếu số này đã tồn tại, hệ thống sẽ gắn kết Lead vào hồ sơ hiện có.
        </Paragraph>
        <Form form={convertForm} layout="vertical">
          <Form.Item
            name="phone_number"
            label="Số điện thoại"
            rules={[{ required: true, message: 'Vui lòng nhập số điện thoại' }]}
          >
            <Input prefix={<PhoneOutlined />} placeholder="VD: 0901234567" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ZaloInboxPage() {
  const { maintenanceMode } = useAuth()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [selectedLeadDetail, setSelectedLeadDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [employees, setEmployees] = useState([])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/zalo/social-leads/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setLeads(data)
    } catch { message.error('Không thể tải danh sách Social Leads.') }
    finally { setLoading(false) }
  }, [search, statusFilter])

  const fetchDetail = async (leadId) => {
    setDetailLoading(true)
    try {
      const res = await api.get(`/zalo/social-leads/${leadId}/`)
      setSelectedLeadDetail(res.data)
    } catch {}
    finally { setDetailLoading(false) }
  }

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/users/employees/')
      setEmployees(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch {}
  }

  useEffect(() => { fetchLeads() }, [fetchLeads])
  useEffect(() => { fetchEmployees() }, [])

  const handleSelectLead = (lead) => {
    setSelectedLead(lead)
    fetchDetail(lead.id)
  }

  const handleRefresh = () => {
    fetchLeads()
    if (selectedLead) fetchDetail(selectedLead.id)
  }

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Page Header */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <WechatOutlined style={{ color: '#0068ff' }} />
            Zalo Inbox
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Quản lý hội thoại và chuyển đổi Lead từ Zalo OA
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh}>Làm mới</Button>
      </div>

      {/* Inbox 2-column layout */}
      <div style={{
        flex: 1, display: 'flex', border: '1px solid #e2e8f0',
        borderRadius: 12, overflow: 'hidden', background: '#fff',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)',
      }}>
        {/* Cột trái — Danh sách Leads */}
        <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
          {/* Search + Filter */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Search
              placeholder="Tìm theo tên, tin nhắn..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onSearch={fetchLeads}
              style={{ marginBottom: 8 }}
              allowClear
            />
            <Select
              style={{ width: '100%' }}
              placeholder="Lọc theo trạng thái"
              value={statusFilter || undefined}
              onChange={v => setStatusFilter(v || '')}
              allowClear
              options={[
                { value: 'new',       label: '🔵 Mới' },
                { value: 'chatting',  label: '🟢 Đang chat' },
                { value: 'converted', label: '🟣 Đã chuyển đổi' },
                { value: 'archived',  label: '⚫ Lưu trữ' },
              ]}
            />
          </div>

          {/* Lead list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
            ) : leads.length === 0 ? (
              <Empty style={{ paddingTop: 60 }} description="Chưa có Social Lead nào" />
            ) : (
              leads.map(lead => (
                <LeadListItem
                  key={lead.id}
                  lead={lead}
                  selected={selectedLead?.id === lead.id}
                  onClick={() => handleSelectLead(lead)}
                />
              ))
            )}
          </div>

          {/* Count */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {leads.length} hội thoại
            </Text>
          </div>
        </div>

        {/* Cột phải — Chi tiết */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {detailLoading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="large" />
            </div>
          ) : (
            <LeadDetailPanel
              lead={selectedLeadDetail}
              onRefresh={handleRefresh}
              employees={employees}
            />
          )}
        </div>
      </div>
    </div>
  )
}
