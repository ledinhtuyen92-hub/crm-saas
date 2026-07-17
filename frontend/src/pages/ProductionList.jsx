import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

const statusConfig = {
  pending: { label: 'Chờ sản xuất', color: 'warning', icon: <ClockCircleOutlined /> },
  in_progress: { label: 'Đang sản xuất', color: 'processing', icon: <PlayCircleOutlined /> },
  completed: { label: 'Hoàn thành', color: 'success', icon: <CheckCircleOutlined /> },
  cancelled: { label: 'Đã hủy', color: 'default', icon: <ToolOutlined /> },
}

const stepStatusConfig = {
  pending: { label: 'Chờ thực hiện', color: 'default' },
  in_progress: { label: 'Đang làm', color: 'processing' },
  done: { label: 'Hoàn thành', color: 'success' },
}

export default function ProductionList() {
  const { isCompanyAdmin, hasPermission, checkMaintenance } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  // Data
  const [productionOrders, setProductionOrders] = useState([])
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal Add / Edit Production Order
  const [modalVisible, setModalVisible] = useState(false)
  const [editingPO, setEditingPO] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // Drawer Manage Steps
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [stepModalVisible, setStepModalVisible] = useState(false)
  const [editingStep, setEditingStep] = useState(null)
  const [stepForm] = Form.useForm()

  // Permissions
  const canCreate = hasPermission('production.create')
  const canEdit = hasPermission('production.edit')
  const canUpdateStep = hasPermission('production.update_step')
  const canDelete = hasPermission('production.delete')

  // ── Fetch data ────────────────────────────────────────────────────────
  const fetchProductionOrders = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/production/orders/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setProductionOrders(data)
    } catch {
      messageApi.error('Không thể tải danh sách lệnh sản xuất.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, messageApi])

  const fetchOrdersAndUsers = useCallback(async () => {
    await Promise.resolve()
    try {
      const [ordRes, usrRes] = await Promise.all([
        api.get('/orders/orders/', { params: { status: 'approved' } }),
        api.get('/users/users/').catch(() => ({ data: [] })),
      ])
      const ordData = Array.isArray(ordRes.data) ? ordRes.data : ordRes.data?.results ?? []
      const usrData = Array.isArray(usrRes.data) ? usrRes.data : usrRes.data?.results ?? []
      setOrders(ordData)
      setUsers(usrData)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchProductionOrders()
  }, [fetchProductionOrders])

  useEffect(() => {
    fetchOrdersAndUsers()
  }, [fetchOrdersAndUsers])

  // ── Filtered list ─────────────────────────────────────────────────────
  const filteredPOs = productionOrders.filter((item) => {
    if (!searchText) return true
    const oNum = (item.order_number || '').toLowerCase()
    const query = searchText.toLowerCase()
    return oNum.includes(query)
  })

  // ── Open Modal (PO) ───────────────────────────────────────────────────
  const openModal = (po = null) => {
    if (checkMaintenance()) return
    setEditingPO(po)
    if (po) {
      form.setFieldsValue({
        order: po.order,
        status: po.status,
        start_date: po.start_date ? dayjs(po.start_date) : null,
        end_date: po.end_date ? dayjs(po.end_date) : null,
        notes: po.notes || '',
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'pending' })
    }
    setModalVisible(true)
  }

  const handleSubmitPO = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const payload = {
        order: values.order,
        status: values.status,
        start_date: values.start_date ? values.start_date.format('YYYY-MM-DD') : null,
        end_date: values.end_date ? values.end_date.format('YYYY-MM-DD') : null,
        notes: values.notes || '',
      }

      if (editingPO) {
        await api.patch(`/production/orders/${editingPO.id}/`, payload)
        messageApi.success('Cập nhật lệnh sản xuất thành công!')
      } else {
        await api.post('/production/orders/', payload)
        messageApi.success('Tạo lệnh sản xuất mới thành công!')
      }

      setModalVisible(false)
      fetchProductionOrders()
    } catch (error) {
      if (error.errorFields) return
      const data = error.response?.data
      let errorMsg = 'Lưu lệnh sản xuất thất bại. Vui lòng kiểm tra dữ liệu.'
      if (data) {
        if (Array.isArray(data.status)) errorMsg = data.status[0]
        else if (typeof data.status === 'string') errorMsg = data.status
        else if (data.detail) errorMsg = data.detail
        else if (Array.isArray(data.non_field_errors)) errorMsg = data.non_field_errors[0]
        else if (Array.isArray(data.order)) errorMsg = data.order[0]
        else if (Object.values(data).length > 0 && Array.isArray(Object.values(data)[0])) errorMsg = Object.values(data)[0][0]
        else if (typeof data === 'string') errorMsg = data
      }
      messageApi.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePO = async (id) => {
    if (checkMaintenance()) return
    try {
      await api.delete(`/production/orders/${id}/`)
      messageApi.success('Đã xoá lệnh sản xuất.')
      fetchProductionOrders()
    } catch {
      messageApi.error('Không thể xoá lệnh sản xuất này.')
    }
  }

  // ── Step Management ───────────────────────────────────────────────────
  const openStepModal = (step = null) => {
    if (checkMaintenance()) return
    setEditingStep(step)
    if (step) {
      stepForm.setFieldsValue({
        step_name: step.step_name,
        sequence: step.sequence,
        assigned_to: step.assigned_to,
        status: step.status,
        notes: step.notes || '',
      })
    } else {
      stepForm.resetFields()
      const nextSeq = (selectedPO?.steps?.length || 0) + 1
      stepForm.setFieldsValue({ sequence: nextSeq, status: 'pending' })
    }
    setStepModalVisible(true)
  }

  const handleSubmitStep = async () => {
    try {
      const values = await stepForm.validateFields()
      setSubmitting(true)

      const payload = {
        ...values,
        production_order: selectedPO.id,
      }

      if (values.status === 'in_progress' && (!editingStep || !editingStep.started_at)) {
        payload.started_at = new Date().toISOString()
      } else if (values.status === 'done' && (!editingStep || !editingStep.completed_at)) {
        payload.completed_at = new Date().toISOString()
        if (!editingStep?.started_at) payload.started_at = new Date().toISOString()
      }

      if (editingStep) {
        await api.patch(`/production/steps/${editingStep.id}/`, payload)
        messageApi.success('Cập nhật công đoạn thành công!')
      } else {
        await api.post('/production/steps/', payload)
        messageApi.success('Thêm công đoạn thành công!')
      }

      setStepModalVisible(false)
      // Refetch current PO details
      const res = await api.get(`/production/orders/${selectedPO.id}/`)
      setSelectedPO(res.data)
      fetchProductionOrders()
    } catch (error) {
      if (error.errorFields) return
      const data = error.response?.data
      let errorMsg = 'Lưu công đoạn thất bại.'
      if (data) {
        if (Array.isArray(data.status)) errorMsg = data.status[0]
        else if (typeof data.status === 'string') errorMsg = data.status
        else if (data.detail) errorMsg = data.detail
        else if (Array.isArray(data.non_field_errors)) errorMsg = data.non_field_errors[0]
        else if (Object.values(data).length > 0 && Array.isArray(Object.values(data)[0])) errorMsg = Object.values(data)[0][0]
        else if (typeof data === 'string') errorMsg = data
      }
      messageApi.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStep = async (stepId) => {
    if (checkMaintenance()) return
    try {
      await api.delete(`/production/steps/${stepId}/`)
      messageApi.success('Đã xoá công đoạn.')
      const res = await api.get(`/production/orders/${selectedPO.id}/`)
      setSelectedPO(res.data)
      fetchProductionOrders()
    } catch {
      messageApi.error('Không thể xoá công đoạn này.')
    }
  }

  const handleQuickStepStatus = async (step, newStatus) => {
    if (checkMaintenance()) return
    try {
      const payload = { status: newStatus }
      if (newStatus === 'in_progress' && !step.started_at) {
        payload.started_at = new Date().toISOString()
      } else if (newStatus === 'done' && !step.completed_at) {
        payload.completed_at = new Date().toISOString()
        if (!step.started_at) payload.started_at = new Date().toISOString()
      }
      await api.patch(`/production/steps/${step.id}/`, payload)
      messageApi.success(`Đã chuyển trạng thái bước "${step.step_name}" sang "${stepStatusConfig[newStatus].label}"`)
      const res = await api.get(`/production/orders/${selectedPO.id}/`)
      setSelectedPO(res.data)
      fetchProductionOrders()
    } catch {
      messageApi.error('Lỗi khi cập nhật trạng thái công đoạn.')
    }
  }

  // ── Table Columns ─────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Mã Lệnh SX',
      key: 'id',
      render: (_, r) => (
        <Space>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: 'rgba(2, 132, 199, 0.1)',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            SX
          </div>
          <div>
            <Text
              strong
              style={{ color: '#0284c7', cursor: 'pointer', display: 'block' }}
              onClick={() => {
                setSelectedPO(r)
                setDrawerVisible(true)
              }}
            >
              {r.production_order_code || `LSX-${r.id ? r.id.toString().padStart(4, '0') : '0000'}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Đơn hàng: <Tag color="blue">{r.order_number || `DH-${r.order}`}</Tag>
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st) => {
        const cfg = statusConfig[st] || { label: st, color: 'default' }
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Tiến độ công đoạn',
      key: 'progress',
      render: (_, r) => {
        const total = r.steps ? r.steps.length : 0
        if (total === 0) return <Text type="secondary">Chưa có công đoạn</Text>
        const done = r.steps.filter((s) => s.status === 'done').length
        const percent = Math.round((done / total) * 100)
        return (
          <div style={{ width: 140 }}>
            <Progress percent={percent} size="small" strokeColor={percent === 100 ? '#10b981' : '#0284c7'} />
            <Text type="secondary" style={{ fontSize: 11 }}>Hoàn thành {done}/{total} bước</Text>
          </div>
        )
      },
    },
    {
      title: 'Thời gian thực hiện',
      key: 'dates',
      render: (_, r) => (
        <div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Bắt đầu:</Text> <Text strong>{r.start_date ? dayjs(r.start_date).format('DD/MM/YYYY') : '—'}</Text></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Dự kiến:</Text> <Text strong style={{ color: '#dc2626' }}>{r.end_date ? dayjs(r.end_date).format('DD/MM/YYYY') : '—'}</Text></div>
        </div>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      render: (v) => <Text type="secondary">{v || '—'}</Text>,
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedPO(record)
              setDrawerVisible(true)
            }}
            style={{ background: '#0284c7' }}
          >
            Công đoạn
          </Button>

          {canEdit && (
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#d97706' }} />}
              onClick={() => openModal(record)}
            />
          )}

          {canDelete && (
            <Popconfirm
              title="Xoá lệnh sản xuất?"
              onConfirm={() => handleDeletePO(record.id)}
              okText="Xoá"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: '24px 32px' }}>
      {contextHolder}

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            <ToolOutlined style={{ color: '#0284c7', marginRight: 10 }} />
            Quản lý Lệnh Sản Xuất & Gia Công
          </Title>
          <Text type="secondary">
            Theo dõi tiến độ gia công từng đơn hàng, phân công công đoạn thi công cho kỹ thuật viên.
          </Text>
        </Col>
        <Col>
          {canCreate && (
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
              style={{
                borderRadius: 10,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
              }}
            >
              Tạo Lệnh Sản Xuất Mới
            </Button>
          )}
        </Col>
      </Row>

      {/* ── Search & Filter Bar ────────────────────────────────────────── */}
      <Card style={{ borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Tìm theo mã đơn hàng liên kết..."
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="Lọc theo trạng thái"
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
              allowClear
              style={{ width: '100%' }}
            >
              <Option value="pending">Chờ sản xuất</Option>
              <Option value="in_progress">Đang sản xuất</Option>
              <Option value="completed">Hoàn thành</Option>
              <Option value="cancelled">Đã hủy</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <Card style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: 0 }}>
        <Table scroll={{ x: 'max-content' }}
          columns={columns}
          dataSource={filteredPOs}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* ── Modal Add / Edit PO ────────────────────────────────────────── */}
      <Modal
        title={<Text strong style={{ fontSize: 18 }}>{editingPO ? 'Chỉnh sửa Lệnh Sản Xuất' : 'Tạo Lệnh Sản Xuất Mới'}</Text>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmitPO}
        confirmLoading={submitting}
        okText="Lưu Lệnh SX"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="order" label="Đơn hàng liên kết" rules={[{ required: true, message: 'Vui lòng chọn đơn hàng' }]}>
            <Select showSearch optionFilterProp="children" placeholder="Chọn đơn hàng đã được chấp thuận..." disabled={!!editingPO}>
              {orders.map((o) => (
                <Option key={o.id} value={o.id}>{o.order_number} — Khách: {o.customer_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Trạng thái">
                <Select disabled={editingPO?.delivery_status === 'delivered'}>
                  <Option value="pending">Chờ sản xuất</Option>
                  <Option value="in_progress">Đang sản xuất</Option>
                  <Option value="completed">Hoàn thành</Option>
                  <Option value="cancelled">Đã hủy</Option>
                </Select>
              </Form.Item>
              {editingPO?.delivery_status === 'delivered' && (
                <div style={{ color: '#ef4444', fontSize: 12, marginTop: -16, marginBottom: 16 }}>
                  Đơn hàng đã được giao thành công, không thể thay đổi trạng thái sản xuất.
                </div>
              )}
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="start_date" label="Ngày bắt đầu">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="end_date" label="Ngày kết thúc dự kiến">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Ghi chú kỹ thuật">
            <TextArea rows={3} placeholder="VD: Cắt nhôm chính xác theo bản vẽ, chú ý keo silicone màu đen..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer Manage Steps ────────────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <ToolOutlined style={{ color: '#0284c7' }} />
            <Text strong>Quản lý Công Đoạn — {selectedPO?.production_order_code || (selectedPO ? `LSX-${selectedPO.id.toString().padStart(4, '0')}` : 'LSX-0000')}</Text>
          </Space>
        }
        width={750}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedPO && (
          <div>
            <Card style={{ marginBottom: 20, background: '#f8fafc', borderRadius: 10 }}>
              <Row gutter={16}>
                <Col xs={24} md={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>ĐƠN HÀNG:</Text>
                  <div><Text strong style={{ color: '#0284c7', fontSize: 15 }}>{selectedPO.order_number || `DH-${selectedPO.order}`}</Text></div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>TRẠNG THÁI LSX:</Text>
                  <div>{(() => { const c = statusConfig[selectedPO.status] || { label: selectedPO.status }; return <Tag color={c.color}>{c.label}</Tag> })()}</div>
                </Col>
                <Col xs={24} md={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>NGÀY DỰ KIẾN XONG:</Text>
                  <div><Text strong style={{ color: '#dc2626' }}>{selectedPO.end_date ? dayjs(selectedPO.end_date).format('DD/MM/YYYY') : '—'}</Text></div>
                </Col>
              </Row>
            </Card>

            <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Danh sách công đoạn thực hiện</Title>
              {canEdit && (
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openStepModal()} style={{ background: '#0284c7' }}>
                  Thêm công đoạn
                </Button>
              )}
            </Row>

            <Table scroll={{ x: 'max-content' }}
              dataSource={selectedPO.steps || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                { title: '#', dataIndex: 'sequence', key: 'sequence', width: 50, align: 'center', render: (v) => <Tag color="blue">{v}</Tag> },
                {
                  title: 'Tên công đoạn',
                  dataIndex: 'step_name',
                  key: 'step_name',
                  render: (v, r) => (
                    <div>
                      <Text strong style={{ fontSize: 14 }}>{v}</Text>
                      {r.notes && <div style={{ fontSize: 12 }}><Text type="secondary">{r.notes}</Text></div>}
                    </div>
                  ),
                },
                {
                  title: 'Phụ trách',
                  dataIndex: 'assigned_to_name',
                  key: 'assigned_to_name',
                  render: (val) => val ? <Tag icon={<UserOutlined />} color="cyan">{val}</Tag> : <Text type="secondary">Chưa gán</Text>,
                },
                {
                  title: 'Trạng thái',
                  dataIndex: 'status',
                  key: 'status',
                  render: (st, r) => (
                    <Select
                      size="small"
                      value={st}
                      style={{ width: 120 }}
                      onChange={(newVal) => handleQuickStepStatus(r, newVal)}
                      disabled={!canEdit && !canUpdateStep}
                    >
                      <Option value="pending">Chờ làm</Option>
                      <Option value="in_progress">Đang làm</Option>
                      <Option value="done">Hoàn thành</Option>
                    </Select>
                  ),
                },
                {
                  title: 'Thời gian',
                  key: 'time',
                  render: (_, r) => (
                    <div style={{ fontSize: 11 }}>
                      {r.started_at && <div>Bắt đầu: {dayjs(r.started_at).format('DD/MM HH:mm')}</div>}
                      {r.completed_at && <div style={{ color: '#16a34a' }}>Xong: {dayjs(r.completed_at).format('DD/MM HH:mm')}</div>}
                    </div>
                  ),
                },
                {
                  title: '',
                  key: 'actions',
                  align: 'right',
                  render: (_, r) => (
                    <Space size="small">
                      {(canEdit || canUpdateStep) && <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openStepModal(r)} />}
                      {canEdit && (
                        <Popconfirm title="Xoá bước này?" onConfirm={() => handleDeleteStep(r.id)} okText="Xoá" cancelText="Hủy">
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      )}
                    </Space>
                  ),
                },
              ]}
            />
          </div>
        )}
      </Drawer>

      {/* ── Step Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={<Text strong>{editingStep ? 'Chỉnh sửa Công đoạn' : 'Thêm Công đoạn Mới'}</Text>}
        open={stepModalVisible}
        onCancel={() => setStepModalVisible(false)}
        onOk={handleSubmitStep}
        confirmLoading={submitting}
        okText="Lưu Công Đoạn"
        cancelText="Hủy"
      >
        <Form form={stepForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={18}>
              <Form.Item name="step_name" label="Tên công đoạn thi công" rules={[{ required: true, message: 'Nhập tên công đoạn' }]}>
                <Input placeholder="VD: Cắt nhôm theo bản vẽ, Lắp ráp khung, Ghép kính..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="sequence" label="Thứ tự" rules={[{ required: true }]}>
                <Input type="number" min={1} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="assigned_to" label="Kỹ thuật viên phụ trách">
                <Select placeholder="Chọn nhân viên..." allowClear>
                  {users.map((u) => (
                    <Option key={u.id} value={u.id}>{u.full_name || u.username}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="status" label="Trạng thái thực hiện">
                <Select>
                  <Option value="pending">Chờ thực hiện</Option>
                  <Option value="in_progress">Đang thực hiện</Option>
                  <Option value="done">Hoàn thành</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={24}>
              <Form.Item name="notes" label="Ghi chú / Yêu cầu kỹ thuật">
                <TextArea rows={2} placeholder="Ghi chú cho kỹ thuật viên thi công bước này..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
