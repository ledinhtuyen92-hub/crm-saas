import {
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  HistoryOutlined,
  MailOutlined,
  MessageOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StarFilled,
  StarOutlined,
  TagOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  UserOutlined,
  UserSwitchOutlined,
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
  Popover,
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

const avatarColors = ['#2563eb', '#7c3aed', '#dc2626', '#d97706', '#059669', '#0891b2', '#db2777', '#4f46e5', '#ea580c', '#16a34a']
function getAvatarColor(name) {
  if (!name) return '#2563eb'
  const idx = (name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % avatarColors.length
  return avatarColors[idx]
}

function LeadAvatar({ lead, size = 44, style = {} }) {
  const name = lead?.fb_user_name || 'Khách hàng'
  const src = lead?.fb_user_avatar || null
  const initial = name.charAt(0).toUpperCase()
  return (
    <Avatar
      size={size}
      src={src}
      style={{
        background: src ? 'transparent' : getAvatarColor(name),
        color: '#fff',
        fontWeight: 600,
        fontSize: Math.round(size * 0.42),
        flexShrink: 0,
        ...style
      }}
    >
      {!src && initial}
    </Avatar>
  )
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
          <LeadAvatar lead={lead} size={44} />
        </Badge>
      </Badge>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {lead.is_starred && <StarFilled style={{ color: '#f59e0b', marginRight: 4 }} />}
            {lead.fb_user_name || 'Khách hàng'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, flexShrink: 0, marginLeft: 4 }}>
            {formatTime(lead.last_message_at)}
          </Text>
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.last_message_preview || 'Chưa có tin nhắn'}
        </Text>
        <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {lead.tags && lead.tags.map(t => (
            <Tag key={t.id} style={{ fontSize: 10, padding: '0 6px', lineHeight: '16px', borderRadius: 8, margin: 0, color: '#fff', background: t.color || '#3b82f6', border: 'none', fontWeight: 600 }}>
              {t.name}
            </Tag>
          ))}
          {lead.assigned_to_name && (
            <Tag style={{ fontSize: 10, padding: '0 6px', lineHeight: '16px', borderRadius: 8, margin: 0, color: '#4b5563', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
              👤 {lead.assigned_to_name}
            </Tag>
          )}
          <Tag style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', borderRadius: 8, margin: 0,
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </Tag>
          {lead.latest_sender === 'customer' ? (
            <Tag style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', borderRadius: 8, margin: 0,
              color: '#d97706', background: '#fef3c7', border: '1px solid #fde68a' }}>
              ⏳ Chờ trả lời
            </Tag>
          ) : lead.latest_sender === 'page' ? (
            <Tag style={{ fontSize: 10, padding: '0 5px', lineHeight: '16px', borderRadius: 8, margin: 0,
              color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
              ✓ Đã trả lời
            </Tag>
          ) : null}
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
  const urlLower = (msg.attachment_url || '').toLowerCase()
  const isImage = msg.attachment_type === 'image' ||
    /\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(urlLower) ||
    urlLower.includes('fbcdn.net/v/') ||
    urlLower.includes('scontent.') ||
    urlLower.includes('/images/')

  const isVideo = msg.attachment_type === 'video' ||
    /\.(mp4|mov|avi|webm|mkv)(\?.*)?$/i.test(urlLower) ||
    urlLower.includes('/videos/')

  const isAudio = msg.attachment_type === 'audio' ||
    /\.(mp3|wav|ogg|m4a)(\?.*)?$/i.test(urlLower)

  const hasOnlyMedia = !msg.text && msg.attachment_url && (isImage || isVideo)

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
            <LeadAvatar lead={lead} size={28} />
          )}
        </div>
      )}
      <div style={{
        maxWidth: '68%',
        padding: hasOnlyMedia ? 0 : '10px 14px',
        borderRadius: isPage ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: hasOnlyMedia ? 'transparent' : isPage ? '#1877f2' : '#f0f0f0',
        color: isPage ? '#fff' : '#1a1a1a',
        fontSize: 14,
        lineHeight: 1.5,
        boxShadow: hasOnlyMedia ? 'none' : isPage ? '0 1px 4px rgba(24,119,242,0.25)' : '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {msg.text && <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{msg.text}</div>}
        {msg.attachment_url && (
          <div style={{ marginTop: msg.text ? 8 : 0 }}>
            {isImage ? (
              <Image
                src={msg.attachment_url}
                alt="attachment"
                style={{ maxWidth: 260, maxHeight: 260, borderRadius: 12, objectFit: 'cover', display: 'block' }}
              />
            ) : isVideo ? (
              <video
                controls
                src={msg.attachment_url}
                style={{ maxWidth: 280, maxHeight: 260, borderRadius: 12, display: 'block', background: '#000' }}
              />
            ) : isAudio ? (
              <audio controls src={msg.attachment_url} style={{ maxWidth: 240 }} />
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
                  Tệp đính kèm ({msg.attachment_url.split('/').pop().split('?')[0] || 'file'})
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
          textShadow: hasOnlyMedia ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
          color: hasOnlyMedia ? '#6b7280' : 'inherit',
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
  const [replyFilter, setReplyFilter] = useState('') // '' | 'unanswered' | 'read_unanswered'
  const [sortBy, setSortBy] = useState('') // '' | 'waiting_longest' | 'time_asc'
  const [phoneFilterMode, setPhoneFilterMode] = useState('all') // 'all' | 'has_phone' | 'no_phone'
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

  // Pancake filters state
  const [isStarredOnly, setIsStarredOnly] = useState(false)
  const [tagFilter, setTagFilter] = useState('all')
  const [assignedToFilter, setAssignedToFilter] = useState('all')

  // Tags & Quick Replies & Notes state
  const [tagsList, setTagsList] = useState([])
  const [quickRepliesList, setQuickRepliesList] = useState([])
  const [quickReplyModal, setQuickReplyModal] = useState(false)
  const [qrShortcut, setQrShortcut] = useState('')
  const [qrTitle, setQrTitle] = useState('')
  const [qrContent, setQrContent] = useState('')
  const [qrSaving, setQrSaving] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [manageTagsModal, setManageTagsModal] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3b82f6')

  const fetchPages = async () => {
    try {
      const res = await api.get('/facebook/pages/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setPages(data)
    } catch { /* silent */ }
  }

  const fetchTags = async () => {
    try {
      const res = await api.get('/facebook/lead-tags/')
      setTagsList(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { /* silent */ }
  }

  const fetchQuickReplies = async () => {
    try {
      const res = await api.get('/facebook/quick-replies/')
      setQuickRepliesList(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch { /* silent */ }
  }

  const fetchLeads = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = {}
      if (selectedPage && selectedPage !== 'all') params.page_config = selectedPage
      if (phoneFilterMode === 'has_phone' || hasPhoneOnly) params.has_phone = 'true'
      else if (phoneFilterMode === 'no_phone') params.has_phone = 'false'
      if (statusFilter) params.status = statusFilter
      if (hasUnreadOnly) params.has_unread = 'true'
      if (isArchivedOnly) params.is_archived = 'true'
      if (replyFilter) params.reply_filter = replyFilter
      if (sortBy) params.sort_by = sortBy
      if (isStarredOnly) params.is_starred = 'true'
      if (tagFilter && tagFilter !== 'all') params.tag_id = tagFilter
      if (assignedToFilter && assignedToFilter !== 'all') params.assigned_to = assignedToFilter
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
    fetchTags()
    fetchQuickReplies()
    api.get('/users/').then(res => setEmployees(Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.results) ? res.data.results : []))).catch(() => setEmployees([]))
  }, [])
  useEffect(() => { 
    fetchLeads() 
    const interval = setInterval(() => { fetchLeads(true) }, 3000)
    return () => clearInterval(interval)
  }, [selectedPage, hasPhoneOnly, phoneFilterMode, statusFilter, hasUnreadOnly, isArchivedOnly, replyFilter, sortBy, isStarredOnly, tagFilter, assignedToFilter])

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

  const handleToggleStar = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!selectedLead) return
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/toggle-star/`)
      setSelectedLead(prev => ({ ...prev, is_starred: res.data.is_starred }))
      message.success(res.data.is_starred ? '★ Đã đánh dấu Khách VIP!' : '☆ Đã bỏ đánh dấu VIP.')
      fetchLeads(true)
    } catch { message.error('Lỗi khi đánh dấu VIP.') }
  }

  const handleUpdateLeadTags = async (tagIds) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!selectedLead) return
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/update-tags/`, { tag_ids: tagIds })
      setSelectedLead(prev => ({ ...prev, tags: res.data.tags }))
      message.success('Đã cập nhật nhãn!')
      fetchLeads(true)
    } catch { message.error('Lỗi khi cập nhật nhãn.') }
  }

  const handleAddNote = async (content) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!selectedLead || !content.trim()) return
    setNoteSaving(true)
    try {
      const res = await api.post(`/facebook/leads/${selectedLead.id}/add-note/`, { content: content.trim() })
      setSelectedLead(prev => ({
        ...prev,
        internal_notes: [res.data, ...(prev.internal_notes || [])]
      }))
      setNoteText('')
      message.success('Đã thêm ghi chú nội bộ!')
    } catch { message.error('Lỗi khi thêm ghi chú.') }
    finally { setNoteSaving(false) }
  }

  const handleCreateTag = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!newTagName.trim()) return
    try {
      await api.post('/facebook/lead-tags/', { name: newTagName.trim(), color: newTagColor })
      message.success('Đã tạo nhãn mới!')
      setNewTagName('')
      fetchTags()
    } catch { message.error('Lỗi khi tạo nhãn.') }
  }

  const handleDeleteTag = async (id) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      await api.delete(`/facebook/lead-tags/${id}/`)
      message.success('Đã xóa nhãn!')
      fetchTags()
      fetchLeads(true)
    } catch { message.error('Lỗi khi xóa nhãn.') }
  }

  const handleCreateQuickReply = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (!qrShortcut.trim() || !qrContent.trim()) {
      message.warning('Vui lòng nhập phím tắt (VD: /hello) và nội dung mẫu!')
      return
    }
    let shortcut = qrShortcut.trim()
    if (!shortcut.startsWith('/')) shortcut = '/' + shortcut
    setQrSaving(true)
    try {
      await api.post('/facebook/quick-replies/', { shortcut, title: qrTitle || shortcut, content: qrContent })
      message.success('Đã tạo văn bản mẫu!')
      setQrShortcut('')
      setQrTitle('')
      setQrContent('')
      fetchQuickReplies()
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi khi tạo văn bản mẫu.')
    } finally { setQrSaving(false) }
  }

  const handleDeleteQuickReply = async (id) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      await api.delete(`/facebook/quick-replies/${id}/`)
      message.success('Đã xóa văn bản mẫu!')
      fetchQuickReplies()
    } catch { message.error('Lỗi khi xóa văn bản mẫu.') }
  }

  const handleInsertQuickReply = (qr) => {
    setMsgText(prev => (prev ? prev + ' ' + qr.content : qr.content))
    setQuickReplyModal(false)
  }

  const handleMsgTextChange = (e) => {
    const val = e.target.value
    setMsgText(val)
    const parts = val.split(' ')
    const lastWord = parts[parts.length - 1]
    if (lastWord.startsWith('/') && lastWord.length > 1) {
      const match = quickRepliesList.find(q => q.shortcut.toLowerCase() === lastWord.toLowerCase())
      if (match) {
        parts[parts.length - 1] = match.content
        setMsgText(parts.join(' '))
        message.info(`⚡ Đã tự động gõ tắt ${match.shortcut} -> "${match.title}"`)
      }
    }
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

      {/* Main 3-column layout + Pancake-style Filter Sidebar */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Pancake-style Vertical Filter Toolbar */}
        <div style={{
          width: 52,
          background: '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 12,
          paddingBottom: 12,
          gap: 16,
          flexShrink: 0,
          borderRight: '1px solid #1e293b',
          zIndex: 10,
        }}>
          {/* 1. Tất cả tin nhắn (Reset/Mặc định) */}
          <Tooltip title="Tất cả hội thoại" placement="right">
            <div
              onClick={() => {
                setReplyFilter('')
                setSortBy('')
                setHasUnreadOnly(false)
                setHasPhoneOnly(false)
                setPhoneFilterMode('all')
                setStatusFilter('')
                setIsArchivedOnly(false)
                setIsStarredOnly(false)
                setTagFilter('all')
                setAssignedToFilter('all')
              }}
              style={{
                width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: (!replyFilter && !sortBy && !hasUnreadOnly && phoneFilterMode === 'all' && !hasPhoneOnly && !statusFilter && !isArchivedOnly && !isStarredOnly && tagFilter === 'all' && assignedToFilter === 'all') ? '#2563eb' : 'transparent',
                color: (!replyFilter && !sortBy && !hasUnreadOnly && phoneFilterMode === 'all' && !hasPhoneOnly && !statusFilter && !isArchivedOnly && !isStarredOnly && tagFilter === 'all' && assignedToFilter === 'all') ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              <MessageOutlined style={{ fontSize: 18 }} />
            </div>
          </Tooltip>

          {/* 2. Lọc chưa trả lời (Pancake Clock popover) */}
          <Popover
            placement="rightTop"
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>🕒 Lọc chưa trả lời</span>}
            content={
              <div style={{ minWidth: 230, padding: 4 }}>
                <Radio.Group
                  value={sortBy === 'waiting_longest' ? 'waiting_longest' : (replyFilter || 'all')}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === 'all') {
                      setReplyFilter('')
                      setSortBy('')
                    } else if (val === 'unanswered') {
                      setReplyFilter('unanswered')
                      setSortBy('')
                    } else if (val === 'waiting_longest') {
                      setReplyFilter('unanswered')
                      setSortBy('waiting_longest')
                    } else if (val === 'read_unanswered') {
                      setReplyFilter('read_unanswered')
                      setSortBy('')
                    }
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <Radio value="all" style={{ fontWeight: 500 }}>🌐 Tất cả tin nhắn</Radio>
                  <Radio value="unanswered" style={{ fontWeight: 500, color: '#2563eb' }}>⏱️ Giảm dần theo thời gian (Khách chờ)</Radio>
                  <Radio value="waiting_longest" style={{ fontWeight: 600, color: '#d97706' }}>⏳ Đợi phản hồi lâu nhất</Radio>
                  <Radio value="read_unanswered" style={{ fontWeight: 500, color: '#9333ea' }}>👀 Đã đọc nhưng chưa trả lời</Radio>
                </Radio.Group>
              </div>
            }
            trigger="click"
          >
            <Tooltip title="Lọc chưa trả lời (Theo thời gian / Đợi lâu nhất)" placement="right">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (replyFilter || sortBy) ? '#f59e0b' : 'transparent',
                  color: (replyFilter || sortBy) ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                <ClockCircleOutlined style={{ fontSize: 18 }} />
              </div>
            </Tooltip>
          </Popover>

          {/* Khách VIP (Starred) */}
          <Tooltip title="Lọc Khách VIP (Đánh dấu sao)" placement="right">
            <div
              onClick={() => setIsStarredOnly(!isStarredOnly)}
              style={{
                width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isStarredOnly ? '#f59e0b' : 'transparent',
                color: isStarredOnly ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              <StarFilled style={{ fontSize: 18, color: isStarredOnly ? '#fff' : '#f59e0b' }} />
            </div>
          </Tooltip>

          {/* Lọc theo Nhãn (Tags) */}
          <Popover
            placement="rightTop"
            title={<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontWeight: 700, color: '#1e293b' }}>🏷️ Lọc theo Nhãn Tag</span><Button size="small" type="link" onClick={() => setManageTagsModal(true)} style={{ padding: 0 }}>Quản lý</Button></div>}
            content={
              <div style={{ minWidth: 200, padding: 4, maxHeight: 300, overflowY: 'auto' }}>
                <Radio.Group
                  value={tagFilter}
                  onChange={e => setTagFilter(e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <Radio value="all" style={{ fontWeight: 500 }}>🌐 Tất cả nhãn</Radio>
                  {tagsList.map(t => (
                    <Radio key={t.id} value={t.id}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: t.color || '#3b82f6', marginRight: 6 }} />
                      <span style={{ fontWeight: 500 }}>{t.name}</span>
                    </Radio>
                  ))}
                </Radio.Group>
              </div>
            }
            trigger="click"
          >
            <Tooltip title="Lọc theo Nhãn Tag" placement="right">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: tagFilter !== 'all' ? '#10b981' : 'transparent',
                  color: tagFilter !== 'all' ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                <TagOutlined style={{ fontSize: 18 }} />
              </div>
            </Tooltip>
          </Popover>

          {/* Lọc theo Sale phụ trách */}
          <Popover
            placement="rightTop"
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>👤 Phân công Sale</span>}
            content={
              <div style={{ minWidth: 200, padding: 4, maxHeight: 300, overflowY: 'auto' }}>
                <Radio.Group
                  value={assignedToFilter}
                  onChange={e => setAssignedToFilter(e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <Radio value="all" style={{ fontWeight: 500 }}>🌐 Tất cả nhân viên</Radio>
                  <Radio value="me" style={{ fontWeight: 600, color: '#2563eb' }}>🧑 Giỏ hội thoại của tôi</Radio>
                  <Radio value="unassigned" style={{ fontWeight: 500, color: '#f59e0b' }}>❓ Chưa phân công</Radio>
                  {employees.map(emp => (
                    <Radio key={emp.id} value={emp.id} style={{ fontWeight: 500 }}>
                      👤 {emp.full_name || emp.username}
                    </Radio>
                  ))}
                </Radio.Group>
              </div>
            }
            trigger="click"
          >
            <Tooltip title="Lọc theo Sale phụ trách" placement="right">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: assignedToFilter !== 'all' ? '#8b5cf6' : 'transparent',
                  color: assignedToFilter !== 'all' ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                <UserSwitchOutlined style={{ fontSize: 18 }} />
              </div>
            </Tooltip>
          </Popover>

          {/* 3. Tin nhắn chưa đọc */}
          <Tooltip title="Tin nhắn chưa đọc" placement="right">
            <div
              onClick={() => setHasUnreadOnly(!hasUnreadOnly)}
              style={{
                width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: hasUnreadOnly ? '#ef4444' : 'transparent',
                color: hasUnreadOnly ? '#fff' : '#94a3b8',
                transition: 'all 0.2s',
              }}
            >
              <Badge dot={!hasUnreadOnly} offset={[2, -2]} color="#ef4444">
                <MailOutlined style={{ fontSize: 18, color: hasUnreadOnly ? '#fff' : '#94a3b8' }} />
              </Badge>
            </div>
          </Tooltip>

          {/* 4. Lọc số điện thoại */}
          <Popover
            placement="rightTop"
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>📞 Lọc số điện thoại</span>}
            content={
              <div style={{ minWidth: 200, padding: 4 }}>
                <Radio.Group
                  value={phoneFilterMode !== 'all' ? phoneFilterMode : (hasPhoneOnly ? 'has_phone' : 'all')}
                  onChange={e => {
                    const val = e.target.value
                    setPhoneFilterMode(val)
                    setHasPhoneOnly(val === 'has_phone')
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <Radio value="all" style={{ fontWeight: 500 }}>🌐 Tất cả hội thoại</Radio>
                  <Radio value="has_phone" style={{ fontWeight: 600, color: '#10b981' }}>📞 Có số điện thoại</Radio>
                  <Radio value="no_phone" style={{ fontWeight: 500, color: '#ef4444' }}>❌ Chưa có số điện thoại</Radio>
                </Radio.Group>
              </div>
            }
            trigger="click"
          >
            <Tooltip title="Lọc số điện thoại" placement="right">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: (phoneFilterMode !== 'all' || hasPhoneOnly) ? '#10b981' : 'transparent',
                  color: (phoneFilterMode !== 'all' || hasPhoneOnly) ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                <PhoneOutlined style={{ fontSize: 18 }} />
              </div>
            </Tooltip>
          </Popover>

          {/* 5. Phân loại Khách hàng CRM */}
          <Popover
            placement="rightTop"
            title={<span style={{ fontWeight: 700, color: '#1e293b' }}>👥 Trạng thái CRM</span>}
            content={
              <div style={{ minWidth: 200, padding: 4 }}>
                <Radio.Group
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  <Radio value="" style={{ fontWeight: 500 }}>🌐 Tất cả</Radio>
                  <Radio value="not_added" style={{ fontWeight: 500, color: '#f59e0b' }}>⚠️ Chưa thêm vào CRM</Radio>
                  <Radio value="converted" style={{ fontWeight: 600, color: '#10b981' }}>✓ Đã có trong CRM</Radio>
                </Radio.Group>
              </div>
            }
            trigger="click"
          >
            <Tooltip title="Lọc theo trạng thái CRM" placement="right">
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: statusFilter ? '#8b5cf6' : 'transparent',
                  color: statusFilter ? '#fff' : '#94a3b8',
                  transition: 'all 0.2s',
                }}
              >
                <TeamOutlined style={{ fontSize: 18 }} />
              </div>
            </Tooltip>
          </Popover>

          {/* 6. Kho rác / Đã ẩn */}
          <Tooltip title="Kho rác / Hội thoại đã ẩn" placement="right">
            <div
              onClick={() => setIsArchivedOnly(!isArchivedOnly)}
              style={{
                width: 36, height: 36, borderRadius: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isArchivedOnly ? '#f97316' : 'transparent',
                color: isArchivedOnly ? '#fff' : '#94a3b8',
                marginTop: 'auto',
                transition: 'all 0.2s',
              }}
            >
              <FolderOutlined style={{ fontSize: 18 }} />
            </div>
          </Tooltip>
        </div>

        {/* Left: Conversation List */}
        <div style={{ width: 300, flexShrink: 0, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          {/* Active Filter Banner */}
          {(replyFilter || sortBy || hasUnreadOnly || (phoneFilterMode !== 'all' && phoneFilterMode !== '') || hasPhoneOnly || statusFilter || isArchivedOnly || isStarredOnly || tagFilter !== 'all' || assignedToFilter !== 'all') && (
            <div style={{ padding: '6px 10px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Lọc:</span>
              {replyFilter === 'unanswered' && sortBy !== 'waiting_longest' && <Tag color="blue" closable onClose={() => setReplyFilter('')} style={{ fontSize: 11, margin: 1 }}>⏱️ Khách chờ</Tag>}
              {sortBy === 'waiting_longest' && <Tag color="orange" closable onClose={() => { setSortBy(''); setReplyFilter(''); }} style={{ fontSize: 11, margin: 1 }}>⏳ Đợi lâu nhất</Tag>}
              {replyFilter === 'read_unanswered' && <Tag color="purple" closable onClose={() => setReplyFilter('')} style={{ fontSize: 11, margin: 1 }}>👀 Đã đọc</Tag>}
              {isStarredOnly && <Tag color="gold" closable onClose={() => setIsStarredOnly(false)} style={{ fontSize: 11, margin: 1 }}>★ Khách VIP</Tag>}
              {tagFilter !== 'all' && <Tag color="green" closable onClose={() => setTagFilter('all')} style={{ fontSize: 11, margin: 1 }}>🏷️ {tagsList.find(t => t.id == tagFilter)?.name || 'Tag'}</Tag>}
              {assignedToFilter !== 'all' && <Tag color="purple" closable onClose={() => setAssignedToFilter('all')} style={{ fontSize: 11, margin: 1 }}>👤 {assignedToFilter === 'me' ? 'Của tôi' : assignedToFilter === 'unassigned' ? 'Chưa phân công' : employees.find(e => e.id == assignedToFilter)?.full_name || 'Sale'}</Tag>}
              {hasUnreadOnly && <Tag color="red" closable onClose={() => setHasUnreadOnly(false)} style={{ fontSize: 11, margin: 1 }}>🔴 Chưa đọc</Tag>}
              {(phoneFilterMode === 'has_phone' || hasPhoneOnly) && <Tag color="green" closable onClose={() => { setPhoneFilterMode('all'); setHasPhoneOnly(false); }} style={{ fontSize: 11, margin: 1 }}>📞 Có SĐT</Tag>}
              {phoneFilterMode === 'no_phone' && <Tag color="default" closable onClose={() => setPhoneFilterMode('all')} style={{ fontSize: 11, margin: 1 }}>❌ Không SĐT</Tag>}
              {statusFilter === 'not_added' && <Tag color="warning" closable onClose={() => setStatusFilter('')} style={{ fontSize: 11, margin: 1 }}>Chưa vào CRM</Tag>}
              {statusFilter === 'converted' && <Tag color="success" closable onClose={() => setStatusFilter('')} style={{ fontSize: 11, margin: 1 }}>Đã vào CRM</Tag>}
              {isArchivedOnly && <Tag color="orange" closable onClose={() => setIsArchivedOnly(false)} style={{ fontSize: 11, margin: 1 }}>🗑️ Kho rác</Tag>}
              <span
                style={{ fontSize: 11, color: '#2563eb', cursor: 'pointer', marginLeft: 'auto', fontWeight: 600 }}
                onClick={() => {
                  setReplyFilter('')
                  setSortBy('')
                  setHasUnreadOnly(false)
                  setHasPhoneOnly(false)
                  setPhoneFilterMode('all')
                  setStatusFilter('')
                  setIsArchivedOnly(false)
                  setIsStarredOnly(false)
                  setTagFilter('all')
                  setAssignedToFilter('all')
                }}
              >
                Xóa lọc
              </span>
            </div>
          )}
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
                <LeadAvatar lead={selectedLead} size={36} />
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
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button size="small" icon={<PhoneOutlined />} onClick={() => handleSend(null, true)} loading={sending} style={{ borderRadius: 14 }}>
                    Yêu cầu chia sẻ SĐT
                  </Button>
                  <Button size="small" icon={<ThunderboltOutlined />} onClick={() => setQuickReplyModal(true)} style={{ borderRadius: 14, background: '#fff7ed', borderColor: '#fdba74', color: '#c2410c', fontWeight: 600 }}>
                    ⚡ Văn bản mẫu (/gõ tắt)
                  </Button>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input.TextArea
                    value={msgText}
                    onChange={handleMsgTextChange}
                    placeholder="Nhập tin nhắn (hoặc gõ phím tắt VD: /hello)..."
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
        <div style={{ width: 285, flexShrink: 0, borderLeft: '1px solid #e5e7eb', background: '#fafafa', overflowY: 'auto', padding: 14 }}>
          {selectedLead ? (
            <>
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <LeadAvatar
                  lead={selectedLead}
                  size={64}
                  style={{ margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                />
                <div style={{ fontWeight: 700, fontSize: 15, marginTop: 8 }}>
                  {selectedLead.is_starred && <StarFilled style={{ color: '#f59e0b', marginRight: 4 }} />}
                  {selectedLead.fb_user_name || 'Khách hàng'}
                </div>
                <Tag color={selectedLead.is_customer_converted ? 'success' : 'warning'} style={{ marginTop: 6 }}>
                  {selectedLead.is_customer_converted ? '✅ Đã có trong KH' : '⚠️ Chưa thêm KH'}
                </Tag>
              </div>

              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <Button
                  type={selectedLead.is_starred ? "primary" : "default"}
                  block
                  icon={<StarFilled style={{ color: selectedLead.is_starred ? '#fff' : '#f59e0b' }} />}
                  onClick={handleToggleStar}
                  style={{ background: selectedLead.is_starred ? '#f59e0b' : '#fff', borderColor: '#f59e0b', color: selectedLead.is_starred ? '#fff' : '#d97706', marginBottom: 14, borderRadius: 20, fontWeight: 600 }}
                >
                  {selectedLead.is_starred ? '★ Đang là Khách VIP' : '☆ Đánh dấu Khách VIP'}
                </Button>

                <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>NHÃN HỘI THOẠI (TAGS)</Text>
                  <Button size="small" type="link" onClick={() => setManageTagsModal(true)} style={{ padding: 0, fontSize: 11 }}>+ Quản lý</Button>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Select
                    mode="multiple"
                    placeholder="Gắn nhãn cho khách hàng..."
                    style={{ width: '100%' }}
                    value={(selectedLead.tags || []).map(t => t.id)}
                    onChange={handleUpdateLeadTags}
                    tagRender={(props) => {
                      const t = tagsList.find(item => item.id === props.value)
                      return <Tag color={t?.color || '#3b82f6'} closable={props.closable} onClose={props.onClose} style={{ marginRight: 3, fontWeight: 600 }}>{props.label}</Tag>
                    }}
                    options={tagsList.map(t => ({ value: t.id, label: t.name }))}
                  />
                </div>

                <Tabs
                  defaultActiveKey="info"
                  items={[
                    {
                      key: 'info',
                      label: 'ℹ️ Thông tin',
                      children: (
                        <div style={{ paddingTop: 6 }}>
                          <div style={{ marginBottom: 4 }}><Text type="secondary" style={{ fontSize: 11 }}>TRANG FACEBOOK</Text></div>
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
                      )
                    },
                    {
                      key: 'notes',
                      label: `📝 Ghi chú (${selectedLead.internal_notes?.length || 0})`,
                      children: (
                        <div style={{ paddingTop: 6 }}>
                          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                            <Input.TextArea
                              value={noteText}
                              onChange={e => setNoteText(e.target.value)}
                              placeholder="Ghi chú nội bộ (chỉ Sale thấy)..."
                              autoSize={{ minRows: 2, maxRows: 4 }}
                              style={{ borderRadius: 8, fontSize: 12 }}
                            />
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              loading={noteSaving}
                              onClick={() => handleAddNote(noteText)}
                              disabled={!noteText.trim()}
                              style={{ background: '#10b981', borderRadius: 8 }}
                            />
                          </div>
                          <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {(selectedLead.internal_notes || []).length === 0 ? (
                              <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block', margin: '20px 0' }}>Chưa có ghi chú nào</Text>
                            ) : (
                              (selectedLead.internal_notes || []).map((note, idx) => (
                                <div key={note.id || idx} style={{ background: '#fff', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                                    <Text strong style={{ fontSize: 11, color: '#334155' }}>👤 {note.created_by_name || 'Sale'}</Text>
                                    <Text type="secondary" style={{ fontSize: 10 }}>{formatTime(note.created_at)}</Text>
                                  </div>
                                  <div style={{ color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{note.content}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )
                    }
                  ]}
                />
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

      {/* Manage Tags Modal */}
      <Modal
        open={manageTagsModal}
        title="🏷️ Quản lý Nhãn hội thoại (Tags)"
        onCancel={() => setManageTagsModal(false)}
        footer={[
          <Button key="close" onClick={() => setManageTagsModal(false)}>Đóng</Button>
        ]}
        width={500}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Input
              placeholder="Tên nhãn mới..."
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              onPressEnter={handleCreateTag}
              style={{ flex: 1 }}
            />
            <input
              type="color"
              value={newTagColor}
              onChange={e => setNewTagColor(e.target.value)}
              style={{ width: 40, height: 32, padding: 0, border: '1px solid #d9d9d9', borderRadius: 6, cursor: 'pointer' }}
              title="Chọn màu"
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTag} style={{ background: '#10b981' }}>
              Tạo nhãn
            </Button>
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tagsList.length === 0 ? (
              <Empty description="Chưa có nhãn nào" style={{ margin: '20px auto' }} />
            ) : (
              tagsList.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 14, height: 14, borderRadius: '50%', background: t.color || '#3b82f6', display: 'inline-block' }} />
                    <Text strong style={{ fontSize: 13 }}>{t.name}</Text>
                  </div>
                  <Popconfirm title="Xóa nhãn này?" onConfirm={() => handleDeleteTag(t.id)} okText="Xóa" cancelText="Hủy">
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Quick Replies Modal */}
      <Modal
        open={quickReplyModal}
        title="⚡ Danh sách Văn bản mẫu (/gõ tắt)"
        onCancel={() => setQuickReplyModal(false)}
        footer={[
          <Button key="close" onClick={() => setQuickReplyModal(false)}>Đóng</Button>
        ]}
        width={640}
      >
        <div style={{ padding: '8px 0' }}>
          <Card size="small" style={{ marginBottom: 16, background: '#fff7ed', borderColor: '#fed7aa' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13, color: '#9a3412' }}>➕ Thêm văn bản mẫu mới</div>
            <Row gutter={[8, 8]}>
              <Col span={8}>
                <Input
                  size="small"
                  placeholder="Phím tắt (VD: /hello)..."
                  value={qrShortcut}
                  onChange={e => setQrShortcut(e.target.value)}
                />
              </Col>
              <Col span={16}>
                <Input
                  size="small"
                  placeholder="Tiêu đề gợi nhớ (VD: Chào hỏi ban đầu)..."
                  value={qrTitle}
                  onChange={e => setQrTitle(e.target.value)}
                />
              </Col>
              <Col span={24}>
                <Input.TextArea
                  size="small"
                  placeholder="Nội dung tin nhắn mẫu..."
                  value={qrContent}
                  onChange={e => setQrContent(e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
              </Col>
              <Col span={24} style={{ textAlign: 'right' }}>
                <Button size="small" type="primary" icon={<PlusOutlined />} loading={qrSaving} onClick={handleCreateQuickReply} style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>
                  Tạo mẫu
                </Button>
              </Col>
            </Row>
          </Card>

          <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {quickRepliesList.length === 0 ? (
              <Empty description="Chưa có văn bản mẫu nào" style={{ margin: '20px auto' }} />
            ) : (
              quickRepliesList.map(qr => (
                <div key={qr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#f8fafc', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color="orange" style={{ fontWeight: 700, margin: 0 }}>{qr.shortcut}</Tag>
                      <Text strong style={{ fontSize: 13 }}>{qr.title}</Text>
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{qr.content}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button type="primary" size="small" onClick={() => handleInsertQuickReply(qr)} style={{ background: '#1877f2' }}>
                      Chèn
                    </Button>
                    <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDeleteQuickReply(qr.id)} okText="Xóa" cancelText="Hủy">
                      <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
