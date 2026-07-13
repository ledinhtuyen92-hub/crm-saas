import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Avatar, Badge, Button, Col, Divider, Empty, Input, Modal,
  Row, Select, Space, Spin, Tag, Tooltip, Typography, Form, message
} from 'antd'
import {
  CheckCircleOutlined, CloseOutlined, MessageOutlined,
  PhoneOutlined, ReloadOutlined, SearchOutlined,
  UserAddOutlined, UserOutlined, WechatOutlined,
  InfoCircleOutlined, TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/vi'
import api from '../api/axios'
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

// ── Panel chi tiết bên phải ───────────────────────────────────────────────────
function LeadDetailPanel({ lead, onRefresh, employees }) {
  const { maintenanceMode } = useAuth()
  const [convertModalVisible, setConvertModalVisible] = useState(false)
  const [convertForm] = Form.useForm()
  const [convertLoading, setConvertLoading] = useState(false)

  if (!lead) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#9ca3af' }}>
        <WechatOutlined style={{ fontSize: 64, opacity: 0.3 }} />
        <Text type="secondary">Chọn một cuộc hội thoại để xem chi tiết</Text>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new

  const handleAssign = async (userId) => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      await api.post(`/zalo/social-leads/${lead.id}/assign/`, { assigned_to: userId || null })
      message.success('Phân công thành công!')
      onRefresh()
    } catch { message.error('Lỗi khi phân công.') }
  }

  const handleConvert = async () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    try {
      const values = await convertForm.validateFields()
      setConvertLoading(true)
      const res = await api.post(`/zalo/social-leads/${lead.id}/convert/`, values)
      message.success(`✅ ${res.data.detail}`)
      setConvertModalVisible(false)
      convertForm.resetFields()
      onRefresh()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Lỗi khi chuyển đổi.')
    } finally { setConvertLoading(false) }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Avatar
              size={56}
              src={lead.avatar_url}
              icon={<UserOutlined />}
              style={{ background: '#dbeafe', color: '#2563eb' }}
            />
          </Col>
          <Col flex="auto">
            <Title level={5} style={{ margin: 0 }}>
              {lead.display_name || `Khách Zalo (${lead.social_id?.slice(-4)})`}
            </Title>
            <Space size={6} style={{ marginTop: 4 }}>
              <Tag style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 10 }}>
                {cfg.label}
              </Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <WechatOutlined style={{ marginRight: 4 }} />Zalo · {lead.oa_name || 'OA'}
              </Text>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Body — Thông tin chi tiết */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Thông tin Lead */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            THÔNG TIN LEAD
          </Text>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row>
              <Col span={10}><Text type="secondary" style={{ fontSize: 13 }}>Zalo UID:</Text></Col>
              <Col span={14}><Text style={{ fontSize: 13, fontFamily: 'monospace' }}>{lead.social_id}</Text></Col>
            </Row>
            <Row>
              <Col span={10}><Text type="secondary" style={{ fontSize: 13 }}>Tương tác cuối:</Text></Col>
              <Col span={14}><Text style={{ fontSize: 13 }}>{dayjs(lead.last_interaction_date).format('HH:mm DD/MM/YYYY')}</Text></Col>
            </Row>
            <Row>
              <Col span={10}><Text type="secondary" style={{ fontSize: 13 }}>Tin nhắn cuối:</Text></Col>
              <Col span={14}>
                <Text style={{ fontSize: 13 }} ellipsis>
                  {lead.last_message || <Text type="secondary" italic>Chưa có</Text>}
                </Text>
              </Col>
            </Row>
            {lead.converted_customer_id && (
              <Row>
                <Col span={10}><Text type="secondary" style={{ fontSize: 13 }}>Hồ sơ KH:</Text></Col>
                <Col span={14}>
                  <Tag icon={<CheckCircleOutlined />} color="purple">
                    {lead.converted_customer_name}
                  </Tag>
                </Col>
              </Row>
            )}
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Phân công nhân viên */}
        <div style={{ marginBottom: 20 }}>
          <Text strong style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            <TeamOutlined style={{ marginRight: 4 }} />PHÂN CÔNG
          </Text>
          <div style={{ marginTop: 10 }}>
            <Select
              placeholder="Chọn nhân viên phụ trách..."
              style={{ width: '100%' }}
              value={lead.assigned_to || null}
              allowClear
              onChange={handleAssign}
              options={[
                { value: null, label: 'Chưa phân công' },
                ...employees.map(e => ({ value: e.id, label: e.full_name || e.username }))
              ]}
            />
          </div>
        </div>

        <Divider style={{ margin: '16px 0' }} />

        {/* Tin nhắn cuối */}
        {lead.last_message && (
          <div style={{ marginBottom: 20 }}>
            <Text strong style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              <MessageOutlined style={{ marginRight: 4 }} />TIN NHẮN MỚI NHẤT
            </Text>
            <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Avatar size={28} src={lead.avatar_url} icon={<UserOutlined />} style={{ background: '#dbeafe', flexShrink: 0 }} />
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 12px 12px 12px', padding: '8px 12px', flex: 1 }}>
                  <Text style={{ fontSize: 13 }}>{lead.last_message}</Text>
                </div>
              </div>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'right', marginTop: 6 }}>
                {dayjs(lead.last_interaction_date).format('HH:mm DD/MM')}
              </Text>
            </div>
          </div>
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
