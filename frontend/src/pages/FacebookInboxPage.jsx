import {
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  UserAddOutlined,
  UserOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Image,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Spin,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
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
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffH = Math.floor(diffMs / 3600000)
    if (diffMin < 1) return 'Vừa xong'
    if (diffMin < 60) return `${diffMin} phút`
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)} giờ`
    return d.toLocaleDateString('vi-VN')
  } catch (e) {
    return ''
  }
}

// Conversation list item
function ConvItem({ lead, selected, onClick }) {
  if (!lead) return null
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
      <Badge dot={Boolean(lead.has_unread_message)} color="#ef4444" offset={[-4, 4]}>
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

// Message bubble (Meta Messenger style & Zalo clean UX)
function MessageBubble({ msg, lead, showAvatar = true }) {
  if (!msg) return null
  const isPage = msg.sender_type === 'page'
  const isImage = msg.attachment_type === 'image' || (msg.attachment_url && /\.(png|jpg|jpeg|gif|webp)$/i.test(msg.attachment_url))
  const hasOnlyImage = !msg.text && msg.attachment_url && isImage

  return (
    <div style={{
      display: 'flex',
      justifyContent: isPage ? 'flex-end' : 'flex-start',
      marginBottom: showAvatar ? 12 : 3,
      padding: '0 16px',
    }}>
      {!isPage && (
        <div style={{ width: 28, marginRight: 8, flexShrink: 0, alignSelf: 'flex-end' }}>
          {showAvatar && (
            <Avatar
              size={28}
              src={lead?.fb_user_avatar || null}
              icon={!lead?.fb_user_avatar ? <UserOutlined /> : null}
              style={{ background: '#dbeafe', color: '#1877f2' }}
            />
          )}
        </div>
      )}
      <div style={{
        maxWidth: '68%',
        padding: hasOnlyImage ? 0 : '10px 14px',
        borderRadius: isPage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: hasOnlyImage ? 'transparent' : isPage ? '#1877f2' : '#f0f0f0',
        color: isPage ? '#fff' : '#1a1a1a',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: hasOnlyImage ? 'none' : isPage ? '0 1px 4px rgba(24,119,242,0.25)' : '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {msg.text && <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
        {msg.attachment_url && (
          <div style={{ marginTop: msg.text ? 8 : 0 }}>
            {isImage ? (
              <Image
                src={msg.attachment_url}
                alt="attachment"
                style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <a
                href={msg.attachment_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: isPage ? 'rgba(255,255,255,0.15)' : '#e5e7eb',
                  color: isPage ? '#fff' : '#1f2937',
                  textDecoration: 'none',
                }}
              >
                <PaperClipOutlined style={{ fontSize: 18 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Tệp đính kèm
                </span>
                <DownloadOutlined />
              </a>
            )}
          </div>
        )}
        <div style={{
          fontSize: 10,
          marginTop: 4,
          opacity: isPage ? 0.8 : 0.6,
          textAlign: isPage ? 'right' : 'left',
          textShadow: hasOnlyImage ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
          color: hasOnlyImage ? '#6b7280' : 'inherit',
        }}>
          {formatTime(msg.created_at)}
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
  const [hasUnreadOnly, setHasUnreadOnly] = useState(false)
  const [isArchivedOnly, setIsArchivedOnly] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msgLoading, setMsgLoading] = useState(false)
  const [employees, setEmployees] = useState([])
  const [createForm] = Form.useForm()
  const [createModal, setCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const messagesEndRef = useRef(null)

  // Sync History
  const [syncModal, setSyncModal] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMaxConv, setSyncMaxConv] = useState(100)
  const [syncLimitMsg, setSyncLimitMsg] = useState(50)
  const [syncTargetPage, setSyncTargetPage] = useState('all')

  // Quick Media Library
  const [quickMediaModal, setQuickMediaModal] = useState(false)
  const [quickMediaList, setQuickMediaList] = useState([])
  const [quickMediaLoading, setQuickMediaLoading] = useState(false)
  const [quickMediaUploading, setQuickMediaUploading] = useState(false)
  const [quickMediaTitle, setQuickMediaTitle] = useState('')
  const [quickMediaType, setQuickMediaType] = useState('image')

  const fetchPages = async () => {
    try {
      const res = await api.get('/facebook/pages/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setPages(data)
    } catch { /* silent */ }
  }

  const fetchLeads = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = {}
      if (selectedPage && selectedPage !== 'all') params.page_config = selectedPage
      if (hasPhoneOnly) params.has_phone = 'true'
      if (statusFilter) params.status = statusFilter
      if (hasUnreadOnly) params.has_unread = 'true'
      if (isArchivedOnly) params.is_archived = 'true'
      const res = await api.get('/facebook/leads/', { params })
      setLeads(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { if (!silent) message.error('Không thể tải danh sách hội thoại Facebook.') }
    finally { if (!silent) setLoading(false) }
  }

  const fetchMessages = async (lead, silent = false) => {
    if (!silent) setMsgLoading(true)
    try {
      const res = await api.get(`/facebook/leads/${lead.id}/`)
      setMessages(res.data.messages || [])
      setSelectedLead(res.data)
      if (!silent) fetchLeads(true)
    } catch { if (!silent) message.error('Không thể tải tin nhắn.') }
    finally { if (!silent) setMsgLoading(false) }
  }

  useEffect(() => {
    fetchPages()
    api.get('/users/').then(res => setEmployees(Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : []))).catch(() => setEmployees([]))
  }, [])
  useEffect(() => { 
    fetchLeads() 
    const interval = setInterval(() => { fetchLeads(true) }, 3000)
    return () => clearInterval(interval)
  }, [selectedPage, hasPhoneOnly, statusFilter, hasUnreadOnly, isArchivedOnly])

  useEffect(() => {
    if (selectedLead?.id) {
      const interval = setInterval(() => {
        fetchMessages(selectedLead, true)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [selectedLead?.id])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSelectLead = (lead) => {
    setSelectedLead(lead)
    fetchMessages(lead)
  }

  const handleSend = async (file = null, requestPhone = false) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!msgText.trim() && !file && !requestPhone && !selectedLead) return
    setSending(true)
    try {
      const formData = new FormData()
      if (msgText.trim()) formData.append('text', msgText.trim())
      if (file) formData.append('file', file)
      if (requestPhone) formData.append('request_phone', 'true')

      const res = await api.post(`/facebook/leads/${selectedLead.id}/send-message/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMessages(prev => [...prev, res.data])
      if (!file && !requestPhone) setMsgText('')
      fetchLeads(true)
    } catch (err) {
      message.error(err.response?.data?.error || 'Không thể gửi tin nhắn.')
    } finally { setSending(false) }
  }

  const handleAssign = async (userId) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      await api.post(`/facebook/leads/${selectedLead.id}/assign/`, { assigned_to: userId || null })
      message.success('Phân công thành công!')
      fetchLeads(true)
      fetchMessages(selectedLead, true)
    } catch { message.error('Lỗi khi phân công.') }
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

  const handleRescanPhone = async () => {
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/rescan-phone/`)
      message.success(res.data.detail)
      fetchLeads()
      setSelectedLead(prev => ({ ...prev, detected_phone: res.data.phone }))
    } catch (err) {
      message.error(err.response?.data?.error || 'Không tìm thấy số điện thoại.')
    }
  }

  const fetchQuickMedia = async () => {
    setQuickMediaLoading(true)
    try {
      const res = await api.get('/facebook/quick-media/')
      setQuickMediaList(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { message.error('Lỗi khi tải thư viện media mẫu.') }
    finally { setQuickMediaLoading(false) }
  }

  const handleUploadQuickMedia = async (file) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return false }
    if (!file) return false
    setQuickMediaUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', quickMediaTitle || file.name)
      formData.append('media_type', quickMediaType)
      await api.post('/facebook/quick-media/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      message.success('Đã tải lên thư viện mẫu!')
      setQuickMediaTitle('')
      fetchQuickMedia()
    } catch (err) {
      message.error(err.response?.data?.error || 'Không thể tải file lên.')
    } finally { setQuickMediaUploading(false) }
    return false
  }

  const handleDeleteQuickMedia = async (id) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
    try {
      await api.delete(`/facebook/quick-media/${id}/`)
      message.success('Đã xóa mẫu!')
      fetchQuickMedia()
    } catch { message.error('Lỗi khi xóa.') }
  }

  const handleSendQuickMedia = async (asset) => {
    if (!selectedLead) {
      message.warning('Vui lòng chọn một hội thoại trước khi gửi!')
      setQuickMediaModal(false)
      return
    }
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
    setSending(true)
    setQuickMediaModal(false)
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/send-message/`, {
        text: '',
        attachment_url: asset.file_url,
        attachment_type: asset.media_type || 'image'
      })
      setMessages(prev => [...prev, res.data])
      message.success(`Đã gửi "${asset.title}" đến ${selectedLead.fb_user_name || 'Khách hàng'}!`)
      fetchLeads(true)
    } catch (err) {
      message.error(err.response?.data?.error || 'Không thể gửi mẫu.')
    } finally { setSending(false) }
  }

  const handleSyncHistory = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì!'); return }
    const targets = syncTargetPage === 'all'
      ? pages
      : pages.filter(p => p.id === syncTargetPage)

    if (targets.length === 0) {
      message.warning('Không tìm thấy Trang Facebook nào để đồng bộ!')
      return
    }

    setSyncing(true)
    try {
      let totalConv = 0
      let totalMsg = 0
      for (const page of targets) {
        const res = await api.post(`/facebook/pages/${page.id}/sync-history/`, {
          max_conversations: syncMaxConv,
          limit_messages: syncLimitMsg,
        })
        totalConv += res.data?.data?.synced_conversations || 0
        totalMsg += res.data?.data?.synced_messages || 0
      }
      message.success(`🎉 Đã đồng bộ thành công ${totalConv} hội thoại và ${totalMsg} tin nhắn từ Meta!`)
      setSyncModal(false)
      fetchLeads()
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi khi đồng bộ lịch sử.')
    } finally { setSyncing(false) }
  }

  const filteredLeads = (leads || []).filter(l =>
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            size="small"
            type="primary"
            style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
            icon={<HistoryOutlined />}
            onClick={() => {
              setSyncTargetPage(selectedPage !== 'all' ? selectedPage : (pages[0]?.id || 'all'))
              setSyncModal(true)
            }}
          >
            🔄 Đồng bộ lịch sử
          </Button>
          <Button
            size="small"
            style={{ background: '#10b981', color: '#fff', borderColor: '#10b981' }}
            icon={<FolderOpenOutlined />}
            onClick={() => {
              fetchQuickMedia()
              setQuickMediaModal(true)
            }}
          >
            📁 Thư viện mẫu
          </Button>
          <Button
            size="small"
            type={hasUnreadOnly ? 'primary' : 'default'}
            danger={hasUnreadOnly}
            onClick={() => setHasUnreadOnly(!hasUnreadOnly)}
          >
            {hasUnreadOnly ? '🔴 Chưa đọc' : 'Chưa đọc'}
          </Button>
          <Button
            size="small"
            type={hasPhoneOnly ? 'primary' : 'default'}
            icon={<PhoneOutlined />}
            onClick={() => setHasPhoneOnly(!hasPhoneOnly)}
          >
            {hasPhoneOnly ? '📞 Có SĐT' : 'Lọc SĐT'}
          </Button>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            size="small"
            style={{ width: 140 }}
            placeholder="Lọc trạng thái"
          >
            <Select.Option value="">Tất cả trạng thái</Select.Option>
            <Select.Option value="not_added">Chưa thêm KH</Select.Option>
            <Select.Option value="converted">Đã có trong KH</Select.Option>
          </Select>
          <Button
            size="small"
            type={isArchivedOnly ? 'primary' : 'default'}
            onClick={() => setIsArchivedOnly(!isArchivedOnly)}
            style={isArchivedOnly ? { background: '#f97316', borderColor: '#f97316' } : {}}
          >
            {isArchivedOnly ? '🗑️ Lead rác (đã ẩn)' : '🗑️ Kho rác'}
          </Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchLeads()} title="Làm mới" />
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
                  <Tooltip title="Quét lại toàn bộ tin nhắn cũ để tìm số điện thoại">
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={handleRescanPhone}
                      style={{ borderRadius: 16 }}
                    >
                      Quét SĐT
                    </Button>
                  </Tooltip>
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
                    {(messages || []).length === 0 && <Empty description="Chưa có tin nhắn" style={{ marginTop: 40 }} />}
                    {(messages || []).map((msg, index) => {
                      if (!msg) return null
                      const nextMsg = messages[index + 1]
                      const showAvatar = !nextMsg || nextMsg.sender_type !== msg.sender_type
                      return <MessageBubble key={msg.id || index} msg={msg} lead={selectedLead} showAvatar={showAvatar} />
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Message input & toolbar */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Button size="small" icon={<PhoneOutlined />} onClick={() => handleSend(null, true)} loading={sending} style={{ borderRadius: 14 }}>
                    Yêu cầu chia sẻ SĐT
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input.TextArea
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    style={{ borderRadius: 20, resize: 'none', flex: 1 }}
                    onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
                    disabled={sending}
                  />
                  <Upload beforeUpload={(file) => { handleSend(file, false); return false; }} showUploadList={false} multiple={false} accept="image/*">
                    <Button shape="circle" icon={<PictureOutlined />} disabled={sending} title="Gửi hình ảnh" />
                  </Upload>
                  <Upload beforeUpload={(file) => { handleSend(file, false); return false; }} showUploadList={false} multiple={false}>
                    <Button shape="circle" icon={<PaperClipOutlined />} disabled={sending} title="Gửi file tài liệu" />
                  </Upload>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleSend()}
                    loading={sending}
                    disabled={!msgText.trim() && !sending}
                    style={{ background: '#1877f2', borderRadius: '50%', width: 40, height: 40, padding: 0, flexShrink: 0 }}
                  />
                </div>
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
                <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>NHÂN VIÊN PHỤ TRÁCH</Text></div>
                <div style={{ marginBottom: 16 }}>
                  <Select
                    placeholder="Chọn nhân viên"
                    style={{ width: '100%' }}
                    value={selectedLead.assigned_to || ''}
                    allowClear
                    onChange={val => handleAssign(val || null)}
                    options={[{ value: '', label: '-- Chưa phân công --' }, ...(employees || []).map(e => ({ value: e.id, label: e.full_name || e.username }))]}
                  />
                </div>
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

      {/* Sync History Modal */}
      <Modal
        open={syncModal}
        title="🔄 Đồng bộ lịch sử hội thoại từ Facebook (chuẩn Pancake)"
        onCancel={() => setSyncModal(false)}
        onOk={handleSyncHistory}
        confirmLoading={syncing}
        okText="Bắt đầu đồng bộ"
        cancelText="Đóng"
        width={560}
      >
        <div style={{ padding: '8px 0' }}>
          <p style={{ color: '#4b5563', fontSize: 13, marginBottom: 16 }}>
            Hệ thống sẽ kéo các hội thoại cũ và tin nhắn gần nhất trực tiếp từ Graph API. Quá trình này chỉ mất 3-5 giây nhờ cơ chế tối giới hạn, không gây tải nặng hay đầy DB.
          </p>
          <Form layout="vertical">
            <Form.Item label="Chọn Trang Facebook cần đồng bộ">
              <Select value={syncTargetPage} onChange={setSyncTargetPage}>
                {pages.length > 1 && <Select.Option value="all">🔀 Tất cả Trang quản lý</Select.Option>}
                {pages.map(p => (
                  <Select.Option key={p.id} value={p.id}>🟦 {p.page_name}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Số hội thoại tối đa"
                  tooltip="Số lượng hội thoại gần nhất kéo về (mặc định 50 - 200)"
                >
                  <InputNumber
                    min={10}
                    max={500}
                    value={syncMaxConv}
                    onChange={setSyncMaxConv}
                    style={{ width: '100%' }}
                    addonAfter="hội thoại"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Số tin nhắn / hội thoại"
                  tooltip="Số tin nhắn gần nhất mỗi hội thoại để Sale hiểu ngữ cảnh (mặc định 50)"
                >
                  <InputNumber
                    min={5}
                    max={100}
                    value={syncLimitMsg}
                    onChange={setSyncLimitMsg}
                    style={{ width: '100%' }}
                    addonAfter="tin nhắn"
                  />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      </Modal>

      {/* Quick Media Library Modal */}
      <Modal
        open={quickMediaModal}
        title="📁 Thư viện mẫu & gửi nhanh (Pancake style)"
        onCancel={() => setQuickMediaModal(false)}
        footer={[
          <Button key="close" onClick={() => setQuickMediaModal(false)}>Đóng</Button>
        ]}
        width={720}
      >
        <div style={{ padding: '8px 0' }}>
          <Card size="small" style={{ marginBottom: 16, background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>⬆️ Tải lên mẫu mới (Hình ảnh, Video, Báo giá...)</div>
            <Row gutter={12} align="middle">
              <Col span={10}>
                <Input
                  size="small"
                  placeholder="Tên gợi nhớ (VD: Báo giá 2026, Banner khuyến mãi)..."
                  value={quickMediaTitle}
                  onChange={e => setQuickMediaTitle(e.target.value)}
                />
              </Col>
              <Col span={6}>
                <Select size="small" value={quickMediaType} onChange={setQuickMediaType} style={{ width: '100%' }}>
                  <Select.Option value="image">🖼️ Hình ảnh</Select.Option>
                  <Select.Option value="video">🎬 Video</Select.Option>
                  <Select.Option value="file">📄 Tài liệu / File</Select.Option>
                </Select>
              </Col>
              <Col span={8}>
                <Upload
                  beforeUpload={handleUploadQuickMedia}
                  showUploadList={false}
                  accept={quickMediaType === 'image' ? 'image/*' : quickMediaType === 'video' ? 'video/*' : '*/*'}
                >
                  <Button size="small" type="primary" icon={<PlusOutlined />} loading={quickMediaUploading} style={{ background: '#10b981' }}>
                    Chọn file tải lên
                  </Button>
                </Upload>
              </Col>
            </Row>
          </Card>

          {quickMediaLoading ? <Spin style={{ display: 'block', margin: '30px auto' }} /> : (
            <Tabs
              defaultActiveKey="all"
              items={[
                {
                  key: 'all',
                  label: `Tất cả (${quickMediaList.length})`,
                  children: (
                    <Row gutter={[12, 12]} style={{ maxHeight: 380, overflowY: 'auto', marginTop: 8 }}>
                      {quickMediaList.length === 0 && <Empty description="Chưa có mẫu nào trong thư viện" style={{ margin: '30px auto', width: '100%' }} />}
                      {quickMediaList.map(item => (
                        <Col span={8} key={item.id}>
                          <Card
                            size="small"
                            hoverable
                            style={{ borderRadius: 8, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}
                            bodyStyle={{ padding: 10, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                          >
                            <div>
                              {item.media_type === 'image' ? (
                                <Image
                                  src={item.file_url}
                                  alt={item.title}
                                  style={{ height: 110, width: '100%', objectFit: 'cover', borderRadius: 6 }}
                                  preview={false}
                                />
                              ) : (
                                <div style={{ height: 110, background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
                                  {item.media_type === 'video' ? <VideoCameraOutlined style={{ fontSize: 32, color: '#3b82f6' }} /> : <FileOutlined style={{ fontSize: 32, color: '#64748b' }} />}
                                  <span style={{ fontSize: 11, color: '#475569', padding: '0 8px', textAlign: 'center', wordBreak: 'break-all' }}>
                                    {item.file_url.split('/').pop()}
                                  </span>
                                </div>
                              )}
                              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                                {item.title}
                              </div>
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>Bởi: {item.created_by_name || 'Admin'}</div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, borderTop: '1px solid #f1f5f9', paddingTop: 8 }}>
                              <Button
                                type="primary"
                                size="small"
                                icon={<SendOutlined />}
                                onClick={() => handleSendQuickMedia(item)}
                                disabled={!selectedLead}
                                style={{ background: '#1877f2', fontSize: 11, padding: '0 8px' }}
                              >
                                Gửi ngay
                              </Button>
                              <Popconfirm
                                title="Xóa mẫu này?"
                                onConfirm={() => handleDeleteQuickMedia(item.id)}
                                okText="Xóa"
                                cancelText="Hủy"
                              >
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )
                }
              ]}
            />
          )}
        </div>
      </Modal>

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
