import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Avatar, Badge, Button, Col, Divider, Empty, Input, Modal,
  Row, Select, Space, Spin, Tag, Tooltip, Typography, Form, message, Upload
} from 'antd'
import {
  CheckCircleOutlined, CloseOutlined, MessageOutlined,
  PhoneOutlined, ReloadOutlined, SearchOutlined,
  UserAddOutlined, UserOutlined, WechatOutlined,
  InfoCircleOutlined, TeamOutlined, PaperClipOutlined, SendOutlined, PictureOutlined, DeleteOutlined
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
          <Badge dot={lead.has_unread_message || isNew} color={lead.has_unread_message ? "#ef4444" : "#3b82f6"} offset={[-4, 4]}>
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
            <Space size={4}>
              {lead.oa_name && (
                <Tag style={{ fontSize: 10, padding: '0 6px', lineHeight: '18px', borderRadius: 10, margin: 0, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                  🏢 {lead.oa_name}
                </Tag>
              )}
              <Tag
                style={{
                  fontSize: 10, padding: '0 6px', lineHeight: '18px',
                  color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`,
                  borderRadius: 10, margin: 0,
                }}
              >
                {cfg.label}
              </Tag>
            </Space>
          </div>
          {lead.detected_phone && (
            <div style={{ marginTop: 4 }}>
              {lead.is_customer_converted ? (
                <Tag color="success" style={{ fontSize: 10, borderRadius: 10, margin: 0 }}>
                  ✅ SĐT: {lead.detected_phone} (Đã có trong KH)
                </Tag>
              ) : (
                <Tag color="warning" style={{ fontSize: 10, borderRadius: 10, margin: 0, fontWeight: 600 }}>
                  📞 SĐT: {lead.detected_phone} (Chưa thêm KH)
                </Tag>
              )}
            </div>
          )}
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

  const fetchMessages = async (background = false) => {
    if (!background) setLoadingMessages(true)
    try {
      const res = await api.get(`/zalo/social-leads/${lead.id}/messages/`)
      setMessages(res.data || [])
      if (!background) scrollToBottom()
    } catch (err) {
      console.error(err)
    } finally {
      if (!background) setLoadingMessages(false)
    }
  }

  useEffect(() => {
    if (lead?.id) {
      fetchMessages()
      const interval = setInterval(() => {
        fetchMessages(true)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [lead?.id])


  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
      }
    }, 100)
  }

  const handleSendMessage = async (file = null, requestPhone = false, forceAsFile = false) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!messageText.trim() && !file && !requestPhone) return

    setSending(true)
    try {
      const formData = new FormData()
      if (messageText.trim()) formData.append('text', messageText.trim())
      if (file) {
        formData.append('file', file)
        if (forceAsFile) formData.append('force_as_file', 'true')
      }
      if (requestPhone) formData.append('request_phone', 'true')

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

  const handleConvert = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì dữ liệu. Chức năng này tạm thời bị khóa!'); return }
    try {
      const values = await convertForm.validateFields()
      setConvertLoading(true)
      await api.post(`/zalo/social-leads/${lead.id}/convert/`, values)
      message.success('Chuyển đổi Khách hàng thành công!')
      setConvertModalVisible(false)
      convertForm.resetFields()
      onRefresh()
    } catch (err) {
      if (err.name === 'ValidationError') return
      message.error(err.response?.data?.error || 'Lỗi khi chuyển đổi.')
    } finally {
      setConvertLoading(false)
    }
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
            <Space align="center" size={12}>
              <Title level={5} style={{ margin: 0 }}>{lead.display_name || `Khách Zalo (${lead.social_id?.slice(-4)})`}</Title>
              {!lead.is_customer_converted && lead.status !== 'archived' && (
                <Button 
                  size="small" 
                  type="primary" 
                  icon={<UserAddOutlined />} 
                  style={{ background: '#8b5cf6', borderColor: '#8b5cf6', borderRadius: 16, fontSize: 12 }} 
                  onClick={() => {
                    if (maintenanceMode) {
                      message.warning('⚠️ Hệ thống đang bảo trì dữ liệu. Chức năng này tạm thời bị khóa!')
                      return
                    }
                    convertForm.setFieldsValue({
                      customer_name: lead?.display_name || '',
                      phone_number: lead?.detected_phone || ''
                    })
                    setConvertModalVisible(true)
                  }}
                >
                  Tạo KH
                </Button>
              )}
            </Space>
            <Space size={6} style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap' }}>
              <Tag style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 10 }}>{cfg.label}</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <WechatOutlined style={{ marginRight: 4 }} />Zalo · {lead.oa_name || 'OA'}
              </Text>
              {lead.detected_phone && (
                lead.is_customer_converted ? (
                  <Tag color="success" style={{ borderRadius: 10 }}>
                    ✅ SĐT phát hiện: {lead.detected_phone} (Đã thêm vào Khách hàng)
                  </Tag>
                ) : (
                  <Tag color="warning" style={{ borderRadius: 10, fontWeight: 600 }}>
                    📞 SĐT phát hiện: {lead.detected_phone} (Chưa thêm vào Khách hàng)
                  </Tag>
                )
              )}
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
          <Col>
            <Tooltip title="Xóa hội thoại">
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => {
                  Modal.confirm({
                    title: 'Xóa hội thoại này?',
                    content: 'Toàn bộ tin nhắn với khách hàng này sẽ bị xóa vĩnh viễn và không thể khôi phục.',
                    okText: 'Xóa',
                    okType: 'danger',
                    cancelText: 'Hủy',
                    onOk: async () => {
                      if (maintenanceMode) { message.warning('Hệ thống bảo trì!'); return }
                      try {
                        await api.delete(`/zalo/social-leads/${lead.id}/`)
                        message.success('Đã xóa hội thoại')
                        onRefresh()
                      } catch {
                        message.error('Lỗi khi xóa hội thoại')
                      }
                    }
                  })
                }} 
              />
            </Tooltip>
          </Col>
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

      {/* Footer — Chat Input */}
      {lead.status !== 'archived' && (
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
          <div style={{ marginBottom: 8 }}>
            <Button size="small" icon={<PhoneOutlined />} onClick={() => handleSendMessage(null, true)} loading={sending}>
              Yêu cầu chia sẻ SĐT
            </Button>
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="Nhập tin nhắn..."
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onPressEnter={() => handleSendMessage()}
              disabled={sending}
            />
            <Upload beforeUpload={(file) => { handleSendMessage(file, false, false); return false; }} showUploadList={false} multiple={true} accept="image/*">
              <Button icon={<PictureOutlined />} disabled={sending} />
            </Upload>
            <Upload beforeUpload={(file) => { handleSendMessage(file, false, true); return false; }} showUploadList={false} multiple={true}>
              <Button icon={<PaperClipOutlined />} disabled={sending} />
            </Upload>
            <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={() => handleSendMessage()} style={{ background: '#0068ff' }}>
              Gửi
            </Button>
          </Space.Compact>
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
          Nhập tên và số điện thoại của <strong>{lead.display_name}</strong> để tạo hồ sơ Khách hàng chính thức. Nếu số điện thoại đã tồn tại, hệ thống sẽ tự động liên kết Lead vào hồ sơ hiện có.
        </Paragraph>
        <Form form={convertForm} layout="vertical">
          <Form.Item
            name="customer_name"
            label="Tên khách hàng"
            rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="VD: Anh Minh (Zalo)" size="large" />
          </Form.Item>
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
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [oaConfigs, setOaConfigs] = useState([])
  const [selectedOaFilter, setSelectedOaFilter] = useState('all')

  const fetchLeads = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (hasPhoneOnly) params.has_phone = 'true'
      if (selectedOaFilter && selectedOaFilter !== 'all') params.oa_config = selectedOaFilter
      const res = await api.get('/zalo/social-leads/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setLeads(data)
    } catch { 
      if (!background) message.error('Không thể tải danh sách Social Leads.') 
    }
    finally { if (!background) setLoading(false) }
  }, [search, statusFilter, hasPhoneOnly, selectedOaFilter])

  const handleScanPhones = async () => {
    setScanning(true)
    try {
      const res = await api.post('/zalo/social-leads/scan-phones/')
      message.success(res.data?.detail || 'Quét SĐT thành công!')
      fetchLeads()
    } catch {
      message.error('Lỗi khi quét SĐT trong hội thoại.')
    } finally {
      setScanning(false)
    }
  }

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
      const res = await api.get('/users/users/')
      setEmployees(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch {}
  }

  const fetchOaConfigs = async () => {
    try {
      const res = await api.get('/zalo/config/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setOaConfigs(data)
    } catch {}
  }

  useEffect(() => { 
    fetchLeads() 
    const interval = setInterval(() => { fetchLeads(true) }, 3000)
    return () => clearInterval(interval)
  }, [fetchLeads])
  useEffect(() => { 
    fetchEmployees()
    fetchOaConfigs()
  }, [])

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
            {oaConfigs.length > 1 && (
              <Select
                style={{ width: '100%', marginBottom: 8 }}
                value={selectedOaFilter}
                onChange={v => setSelectedOaFilter(v)}
                options={[
                  { value: 'all', label: `🌐 Tất cả Zalo OA (${oaConfigs.length} trang)` },
                  ...oaConfigs.map(oa => ({
                    value: oa.id,
                    label: `🟢 ${oa.oa_name || 'Zalo OA'}`
                  }))
                ]}
              />
            )}
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
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <Tooltip title="Chỉ hiển thị các cuộc hội thoại mà khách đã để lại số điện thoại">
                <Button
                  size="small"
                  type={hasPhoneOnly ? 'primary' : 'default'}
                  icon={<PhoneOutlined />}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    fontSize: 12,
                    background: hasPhoneOnly ? '#f59e0b' : undefined,
                    borderColor: hasPhoneOnly ? '#f59e0b' : undefined,
                  }}
                  onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
                >
                  {hasPhoneOnly ? 'Đang lọc: Có SĐT' : 'Lọc khách có SĐT'}
                </Button>
              </Tooltip>
              <Tooltip title="Đọc lại toàn bộ lịch sử tin nhắn cũ để tìm kiếm số điện thoại và cập nhật danh sách">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={scanning}
                  style={{ borderRadius: 12, fontSize: 12 }}
                  onClick={handleScanPhones}
                >
                  Quét lại SĐT cũ
                </Button>
              </Tooltip>
            </div>
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
