import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { Badge, Button, Card, Col, Divider, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, message, Tabs, Steps } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const statusConfig = {
  pending: { label: 'Chờ duyệt', color: 'warning', icon: <ClockCircleOutlined /> },
  approved: { label: 'Đã duyệt', color: 'success', icon: <CheckCircleOutlined /> },
  rejected: { label: 'Từ chối', color: 'error', icon: <CloseCircleOutlined /> },
  canceled: { label: 'Đã hủy', color: 'default', icon: <CloseCircleOutlined /> },
}

export default function ApprovalList() {
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('to_approve')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)
  
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [actionType, setActionType] = useState('') // 'approve' | 'reject'
  const [comment, setComment] = useState('')
  const [processing, setProcessing] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/approvals/requests/?mode=${activeTab}&search=${search}&status=${statusFilter}`)
      setRequests(data.results || data)
    } catch (err) {
      message.error('Lỗi tải danh sách phê duyệt')
    } finally {
      setLoading(false)
    }
  }, [activeTab, search, statusFilter])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const openActionModal = (req, step, type) => {
    setSelectedReq(req)
    setSelectedStepId(step.id)
    setActionType(type)
    setComment('')
    setModalVisible(true)
  }

  const handleAction = async () => {
    setProcessing(true)
    try {
      const endpoint = actionType === 'approve' ? 'approve-step' : 'reject-step'
      await api.post(`/approvals/requests/${selectedReq.id}/${endpoint}/`, {
        step_id: selectedStepId,
        comment
      })
      message.success(`Đã ${actionType === 'approve' ? 'duyệt' : 'từ chối'} thành công.`)
      setModalVisible(false)
      fetchRequests()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Lỗi xử lý phê duyệt')
    } finally {
      setProcessing(false)
    }
  }

  const columns = [
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <div>
          <Text strong style={{ color: '#1649c9', fontSize: 15 }}>{text}</Text>
          <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
            Loại: <Tag color="blue">{record.content_type}</Tag> ID: {record.object_id}
          </div>
        </div>
      )
    },
    {
      title: 'Người gửi',
      dataIndex: 'requester_name',
      key: 'requester',
      render: (val) => <Text strong>{val}</Text>
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm')
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st) => {
        const cfg = statusConfig[st] || { label: st, color: 'default' }
        return <Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 13, padding: '4px 8px' }}>{cfg.label}</Tag>
      }
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => {
        // Tìm bước duyệt mà user này có thể thao tác
        const pendingStep = (record.steps || []).find(s => s.status === 'pending')
        let canAct = false
        if (activeTab === 'to_approve' && pendingStep && record.status === 'pending') {
          if (pendingStep.approver_user === user.id) canAct = true
          if (pendingStep.approver_role === user.role) canAct = true
          if (user.is_superuser || user.is_company_admin) canAct = true
          if (hasPermission('orders.approve') && record.title?.toLowerCase().includes('đơn hàng')) canAct = true
          if (hasPermission('sales.approve') && record.title?.toLowerCase().includes('báo giá')) canAct = true
        }

        return (
          <Space>
            {canAct && (
              <>
                <Button type="primary" icon={<CheckOutlined />} style={{ background: '#16a34a' }} onClick={() => openActionModal(record, pendingStep, 'approve')}>
                  Duyệt
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => openActionModal(record, pendingStep, 'reject')}>
                  Từ chối
                </Button>
              </>
            )}
            <Button type="text" icon={<EyeOutlined style={{ color: '#2563eb' }} />} onClick={() => setSelectedReq(record)} />
          </Space>
        )
      }
    }
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }} gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Title level={3} style={{ margin: 0 }}>Luồng Phê Duyệt</Title>
          <Text type="secondary">Quản lý và xét duyệt các yêu cầu tập trung</Text>
        </Col>
        <Col xs={24} md={12} style={{ textAlign: 'right' }}>
          <Space wrap>
            <Input.Search
              placeholder="Tìm theo tiêu đề..."
              allowClear
              onSearch={(val) => setSearch(val)}
              style={{ width: 220 }}
            />
            <Select
              placeholder="Lọc trạng thái"
              allowClear
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
              style={{ width: 150 }}
            >
              <Select.Option value="pending">Chờ duyệt</Select.Option>
              <Select.Option value="approved">Đã duyệt</Select.Option>
              <Select.Option value="rejected">Từ chối</Select.Option>
              <Select.Option value="canceled">Đã hủy</Select.Option>
            </Select>
          </Space>
        </Col>
      </Row>

      <Card 
        bodyStyle={{ padding: 0 }} 
        style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}
      >
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          style={{ padding: '0 24px' }}
          tabBarStyle={{ marginBottom: 0 }}
          items={[
            { label: 'Cần tôi duyệt', key: 'to_approve' },
            { label: 'Yêu cầu của tôi', key: 'my_requests' },
            { label: 'Tất cả', key: 'all' },
          ]}
        />
        <Table scroll={{ x: 'max-content' }} 
          columns={columns} 
          dataSource={requests} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* Modal Detail & Action */}
      <Modal
        title={`Chi tiết phê duyệt: ${selectedReq?.title}`}
        open={!!selectedReq && !modalVisible}
        onCancel={() => setSelectedReq(null)}
        footer={null}
        width={700}
      >
        {selectedReq && (
          <div style={{ marginTop: 16 }}>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 24 }}>
              <Paragraph style={{ margin: 0 }}><strong>Mô tả:</strong> {selectedReq.description || 'Không có mô tả'}</Paragraph>
              <div style={{ marginTop: 8, color: '#64748b' }}>
                Gửi bởi: <strong>{selectedReq.requester_name}</strong> lúc {dayjs(selectedReq.created_at).format('DD/MM/YYYY HH:mm')}
              </div>
            </div>

            <Title level={5} style={{ marginBottom: 16 }}>Tiến trình phê duyệt</Title>
            <Steps
              direction="vertical"
              current={(selectedReq.steps || []).findIndex(s => s.status === 'pending')}
              status={selectedReq.status === 'rejected' ? 'error' : 'process'}
              items={(selectedReq.steps || []).map(step => ({
                title: `Cấp ${step.step_order}: ${step.approver_user_name || step.approver_role_name || 'Admin'}`,
                description: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <Tag color={statusConfig[step.status]?.color}>{statusConfig[step.status]?.label || step.status}</Tag>
                      {step.acted_by_name && <span style={{ marginLeft: 8, fontSize: 12, color: '#64748b' }}>Bởi {step.acted_by_name} ({dayjs(step.acted_at).format('DD/MM/YYYY HH:mm')})</span>}
                    </div>
                    {step.comment && <div style={{ fontStyle: 'italic', color: '#475569', background: '#f1f5f9', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>"{step.comment}"</div>}
                  </div>
                )
              }))}
            />
          </div>
        )}
      </Modal>

      {/* Modal Confirm Action */}
      <Modal
        title={actionType === 'approve' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleAction}
        confirmLoading={processing}
        okText={actionType === 'approve' ? 'Duyệt' : 'Từ chối'}
        okButtonProps={{ danger: actionType === 'reject', style: actionType === 'approve' ? { background: '#16a34a' } : {} }}
      >
        <div style={{ marginTop: 16 }}>
          <Text strong>Nhập ghi chú (không bắt buộc):</Text>
          <TextArea 
            rows={4} 
            value={comment} 
            onChange={e => setComment(e.target.value)} 
            placeholder="Lý do từ chối hoặc ghi chú duyệt..." 
            style={{ marginTop: 8 }}
          />
        </div>
      </Modal>

    </div>
  )
}
