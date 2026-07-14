import {
  MessageOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Skeleton,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Text } = Typography

const STATUS_CONFIG = {
  not_added: { color: '#f59e0b', bg: '#fef3c7', label: 'Chưa thêm KH', border: '#fde68a' },
  converted: { color: '#10b981', bg: '#d1fae5', label: 'Đã có trong KH', border: '#6ee7b7' },
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  if (diffMin < 1) return 'Vừa xong'
  if (diffMin < 60) return `${diffMin} phút`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} giờ`
  return d.toLocaleDateString('vi-VN')
}

// Conversation list item
function ConvItem({ lead, selected, onClick }) {
  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.not_added
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        cursor: 'pointer',
        borderBottom: '1px solid #f0f0f0',
        background: selected ? '#e8f0fe' : 'transparent',
        borderLeft: selected ? '3px solid #1877f2' : '3px solid transparent',
        transition: 'all 0.15s',
      }}
    >
      <Badge
        dot
        style={{ background: lead.is_customer_converted ? '#10b981' : '#f59e0b' }}
        offset={[-3, 40]}
      >
        <Avatar
          src={lead.fb_user_avatar || null}
          icon={!lead.fb_user_avatar ? <UserOutlined /> : null}
          size={44}
          style={{ background: '#dbeafe', color: '#1877f2', flexShrink: 0 }}
        />
      </Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {lead.fb_user_name || 'Khách hàng'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0, marginLeft: 4 }}>
            {formatTime(lead.last_message_at)}
          </Text>
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.last_message_preview || 'Chưa có tin nhắn'}
        </Text>
        <div style={{ marginTop: 3, display: 'flex', gap: 4 }}>
          <Tag style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', borderRadius: 8, margin: 0,
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </Tag>
          {lead.detected_phone && (
            <Tag style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', borderRadius: 8, margin: 0,
              color: '#2563eb', background: '#dbeafe', border: '1px solid #93c5fd' }}>
              📞 {lead.detected_phone}
            </Tag>
          )}
        </div>
      </div>
    </div>
  )
}

// Message bubble (Meta Messenger style)
function MessageBubble({ msg }) {
  const isPage = msg.sender_type === 'page'
  return (
    <div style={{
      display: 'flex',
      justifyContent: isPage ? 'flex-end' : 'flex-start',
      marginBottom: 8,
      padding: '0 16px',
    }}>
      {!isPage && (
        <Avatar size={28} icon={<UserOutlined />}
          style={{ marginRight: 8, background: '#dbeafe', color: '#1877f2', flexShrink: 0, alignSelf: 'flex-end' }} />
      )}
      <div style={{
        maxWidth: '68%',
        padding: '10px 14px',
        borderRadius: isPage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isPage ? '#1877f2' : '#f0f0f0',
        color: isPage ? '#fff' : '#1a1a1a',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: isPage ? '0 1px 4px rgba(24,119,242,0.25)' : '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        {msg.text && <span>{msg.text}</span>}
        {msg.attachment_url && msg.attachment_type === 'image' && (
          <img src={msg.attachment_url} alt="attachment" style={{ maxWidth: 200, borderRadius: 8, display: 'block' }} />
        )}
        <div style={{ fontSize: 10, marginTop: 4, opacity: 0.65, textAlign: isPage ? 'right' : 'left' }}>
          {new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

export default function FacebookInboxPage() {
  const { maintenanceMode } = useAuth()
  const [pages, setPages] = useState([])
  const [selectedPage, setSelectedPage] = useState('all')
  const [leads, setLeads] = useState([])
  const [selectedLead, setSelectedLead] = useState(null)
  const [messages, setMessages] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [createForm] = Form.useForm()
  const [creating, setCreating] = useState(false)
  const messagesEndRef = useRef(null)

  const fetchPages = async () => {
    try {
      const res = await api.get('/facebook/pages/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setPages(data)
    } catch { /* silent */ }
  }

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const params = {}
      if (selectedPage && selectedPage !== 'all') params.page_config = selectedPage
      if (hasPhoneOnly) params.has_phone = 'true'
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/facebook/leads/', { params })
      setLeads(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { message.error('Không thể tải danh sách hội thoại Facebook.') }
    finally { setLoading(false) }
  }

  const fetchMessages = async (lead) => {
    setMsgLoading(true)
    try {
      const res = await api.get(`/facebook/leads/${lead.id}/`)
      setMessages(res.data.messages || [])
      setSelectedLead(res.data)
    } catch { message.error('Không thể tải tin nhắn.') }
    finally { setMsgLoading(false) }
  }

  useEffect(() => { fetchPages() }, [])
  useEffect(() => { fetchLeads() }, [selectedPage, hasPhoneOnly, statusFilter])
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSelectLead = (lead) => {
    setSelectedLead(lead)
    fetchMessages(lead)
  }

  const handleSend = async () => {
    if (!msgText.trim() || !selectedLead) return
    setSending(true)
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/send-message/`, { text: msgText })
      setMessages(prev => [...prev, res.data])
      setMsgText('')
    } catch (err) {
      message.error(err.response?.data?.error || 'Không thể gửi tin nhắn.')
    } finally { setSending(false) }
  }

  const handleCreateCustomer = async (values) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    setCreating(true)
    try {
      await api.post(`/facebook/leads/${selectedLead.id}/create-customer/`, values)
      message.success('Đã tạo Khách hàng thành công!')
      setCreateModal(false)
      fetchLeads()
      fetchMessages(selectedLead)
    } catch (err) {
      message.error(err.response?.data?.error || 'Không thể tạo khách hàng.')
    } finally { setCreating(false) }
  }

  const filteredLeads = leads.filter(l =>
    !search || (l.fb_user_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.last_message_preview || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.detected_phone || '').includes(search)
  )

  return (
    <div style={{ height: 'calc(100vh - 128px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 22, color: '#1877f2', fontWeight: 900 }}>𝐟</span>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Facebook Inbox</span>
        {pages.length > 1 && (
          <Select
            value={selectedPage}
            onChange={setSelectedPage}
            style={{ width: 200, marginLeft: 8 }}
            size="small"
          >
            <Select.Option value="all">🔀 Tất cả Trang</Select.Option>
            {pages.map(p => (
              <Select.Option key={p.id} value={p.id}>{p.page_name}</Select.Option>
            ))}
          </Select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button
            size="small"
            type={hasPhoneOnly ? 'primary' : 'default'}
            icon={<PhoneOutlined />}
            onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
          >
            {hasPhoneOnly ? '📞 Có SĐT' : 'Lọc có SĐT'}
          </Button>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            size="small"
            style={{ width: 160 }}
            placeholder="Lọc trạng thái"
          >
            <Select.Option value="">Tất cả trạng thái</Select.Option>
            <Select.Option value="not_added">Chưa thêm KH</Select.Option>
            <Select.Option value="converted">Đã có trong KH</Select.Option>
          </Select>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchLeads}>Làm mới</Button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Conversation List */}
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
            <Input
              prefix={<SearchOutlined style={{ color: '#9ca3af' }} />}
              placeholder="Tìm kiếm hội thoại..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small"
              style={{ borderRadius: 20 }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 16 }}><Skeleton active avatar paragraph={{ rows: 2 }} /><Skeleton active avatar paragraph={{ rows: 2 }} /></div>
            ) : filteredLeads.length === 0 ? (
              <Empty description="Chưa có hội thoại" style={{ marginTop: 40 }} />
            ) : (
              filteredLeads.map(lead => (
                <ConvItem
                  key={lead.id}
                  lead={lead}
                  selected={selectedLead?.id === lead.id}
                  onClick={() => handleSelectLead(lead)}
                />
              ))
            )}
          </div>
        </div>

        {/* Middle: Chat */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {!selectedLead ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: 12 }}>
              <MessageOutlined style={{ fontSize: 48, color: '#d1d5db' }} />
              <span>Chọn một hội thoại để xem tin nhắn</span>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar src={selectedLead.fb_user_avatar} icon={<UserOutlined />} size={36} style={{ background: '#dbeafe', color: '#1877f2' }} />
                <div>
                  <Text strong>{selectedLead.fb_user_name || 'Khách hàng'}</Text>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>{selectedLead.page_name}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  {!selectedLead.is_customer_converted && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<UserAddOutlined />}
                      onClick={() => {
                        if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
                        createForm.setFieldsValue({ phone: selectedLead.detected_phone || '', name: selectedLead.fb_user_name || '' })
                        setCreateModal(true)
                      }}
                      style={{ background: '#1877f2', borderRadius: 16 }}
                    >
                      Tạo khách hàng
                    </Button>
                  )}
                  {selectedLead.detected_phone && (
                    <Tag color="blue" style={{ margin: 0, lineHeight: '28px' }}>📞 {selectedLead.detected_phone}</Tag>
                  )}
                </div>
              </div>

              {/* Phone detected banner */}
              {selectedLead.detected_phone && !selectedLead.is_customer_converted && (
                <div style={{ padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PhoneOutlined style={{ color: '#f59e0b' }} />
                  <Text style={{ color: '#92400e', fontSize: 13 }}>
                    Phát hiện số điện thoại <b>{selectedLead.detected_phone}</b> — Bấm <b>"Tạo khách hàng"</b> để thêm vào CRM
                  </Text>
                </div>
              )}
              {selectedLead.is_customer_converted && (
                <div style={{ padding: '8px 16px', background: '#ecfdf5', borderBottom: '1px solid #6ee7b7', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981' }}>✅</span>
                  <Text style={{ color: '#065f46', fontSize: 13 }}>
                    Khách hàng đã có trong hệ thống CRM: <b>{selectedLead.customer_name}</b>
                  </Text>
                </div>
              )}

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', background: '#f9fafb' }}>
                {msgLoading ? <Spin style={{ display: 'block', margin: 'auto', marginTop: 40 }} /> : (
                  <>
                    {messages.length === 0 && <Empty description="Chưa có tin nhắn" style={{ marginTop: 40 }} />}
                    {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message input */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <Input.TextArea
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  style={{ borderRadius: 20, resize: 'none', flex: 1 }}
                  onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!msgText.trim()}
                  style={{ background: '#1877f2', borderRadius: '50%', width: 40, height: 40, padding: 0, flexShrink: 0 }}
                />
              </div>
            </>
          )}
        </div>

        {/* Right: CRM Customer Profile */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid #e5e7eb', background: '#fafafa', overflowY: 'auto', padding: 16 }}>
          {selectedLead ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <Avatar
                  src={selectedLead.fb_user_avatar}
                  icon={<UserOutlined />}
                  size={64}
                  style={{ background: '#dbeafe', color: '#1877f2' }}
                />
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>{selectedLead.fb_user_name || 'Khách hàng'}</div>
                <Tag color={selectedLead.is_customer_converted ? 'success' : 'warning'} style={{ marginTop: 6 }}>
                  {selectedLead.is_customer_converted ? '✅ Đã có trong KH' : '⚠️ Chưa thêm KH'}
                </Tag>
              </div>
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <div style={{ marginBottom: 8 }}><Text type="secondary" style={{ fontSize: 11 }}>TRANG FACEBOOK</Text></div>
                <div style={{ fontSize: 13, marginBottom: 12 }}>🟦 {selectedLead.page_name}</div>
                {selectedLead.detected_phone && (
                  <>
                    <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>SỐ ĐIỆN THOẠI</Text></div>
                    <div style={{ fontSize: 13, marginBottom: 12, color: '#1877f2', fontWeight: 600 }}>📞 {selectedLead.detected_phone}</div>
                  </>
                )}
                {selectedLead.customer_name && (
                  <>
                    <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>KHÁCH HÀNG CRM</Text></div>
                    <div style={{ fontSize: 13, marginBottom: 12 }}>👤 {selectedLead.customer_name}</div>
                  </>
                )}
                {!selectedLead.is_customer_converted && (
                  <Button
                    type="primary"
                    block
                    icon={<UserAddOutlined />}
                    onClick={() => {
                      if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
                      createForm.setFieldsValue({ phone: selectedLead.detected_phone || '', name: selectedLead.fb_user_name || '' })
                      setCreateModal(true)
                    }}
                    style={{ background: '#1877f2', marginTop: 8, borderRadius: 20 }}
                  >
                    Tạo Khách hàng CRM
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: 40 }}>
              <UserOutlined style={{ fontSize: 32, marginBottom: 8, display: 'block' }} />
              <span style={{ fontSize: 13 }}>Chọn hội thoại để xem thông tin</span>
            </div>
          )}
        </div>
      </div>

      {/* Create Customer Modal */}
      <Modal
        open={createModal}
        title="Tạo Khách hàng từ Facebook"
        onCancel={() => setCreateModal(false)}
        footer={null}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreateCustomer} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên Khách hàng" rules={[{ required: true, message: 'Vui lòng nhập tên' }]}>
            <Input placeholder="Họ và tên khách hàng..." />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Vui lòng nhập SĐT' }]}>
            <Input placeholder="0912345678" prefix={<PhoneOutlined />} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setCreateModal(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={creating} style={{ background: '#1877f2' }}>
              Tạo Khách hàng
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
