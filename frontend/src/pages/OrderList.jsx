import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  theme,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

// Trạng thái đơn hàng
const statusConfig = {
  pending: { label: 'Chờ duyệt', color: 'warning', icon: <ClockCircleOutlined /> },
  approved: { label: 'Đã chấp thuận', color: 'processing', icon: <CheckCircleOutlined /> },
  rejected: { label: 'Đã từ chối', color: 'error', icon: <CloseCircleOutlined /> },
  cancelled: { label: 'Đã hủy', color: 'default', icon: <MinusCircleOutlined /> },
  completed: { label: 'Hoàn thành', color: 'success', icon: <CheckCircleOutlined /> },
}

export default function OrderList() {
  const { token } = theme.useToken()
  const { isCompanyAdmin, hasPermission } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  // Data states
  const [orders, setOrders] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal Add / Edit
  const [modalVisible, setModalVisible] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // Dynamic products in form
  const [formItems, setFormItems] = useState(() => [
    { key: 'init-item-1', product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
  ])

  // Drawer details
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)

  // Permissions
  const canCreate = isCompanyAdmin || hasPermission('orders.create')
  const canEdit = isCompanyAdmin || hasPermission('orders.edit')
  const canDelete = isCompanyAdmin || hasPermission('orders.delete')
  const canApprove = isCompanyAdmin || hasPermission('orders.approve')

  // ── Fetch data ────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/orders/orders/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setOrders(data)
    } catch {
      messageApi.error('Không thể tải danh sách đơn hàng.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, messageApi])

  const fetchCustomersAndProducts = useCallback(async () => {
    await Promise.resolve()
    try {
      const [custRes, prodRes] = await Promise.all([
        api.get('/crm/customers/'),
        api.get('/inventory/products/'),
      ])
      const custData = Array.isArray(custRes.data) ? custRes.data : custRes.data?.results ?? []
      const prodData = Array.isArray(prodRes.data) ? prodRes.data : prodRes.data?.results ?? []
      setCustomers(custData)
      setProducts(prodData)
    } catch {
      // ignore silently
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  useEffect(() => {
    fetchCustomersAndProducts()
  }, [fetchCustomersAndProducts])

  // ── Filtered list ─────────────────────────────────────────────────────
  const filteredOrders = orders.filter((item) => {
    if (!searchText) return true
    const oNum = (item.order_number || '').toLowerCase()
    const cName = (item.customer_name || '').toLowerCase()
    const query = searchText.toLowerCase()
    return oNum.includes(query) || cName.includes(query)
  })

  // ── Stats ─────────────────────────────────────────────────────────────
  const totalPending = orders.filter((q) => q.status === 'pending').length
  const totalApproved = orders.filter((q) => q.status === 'approved').length
  const totalCompleted = orders.filter((q) => q.status === 'completed').length
  const totalRevenue = orders
    .filter((q) => q.status === 'approved' || q.status === 'completed')
    .reduce((sum, q) => sum + Number(q.total_amount || 0), 0)

  // ── Handlers for modal form items ─────────────────────────────────────
  const handleAddLine = () => {
    setFormItems((prev) => [
      ...prev,
      {
        key: `line-${prev.length + 1}-${Math.random()}`,
        product: null,
        width: 0,
        height: 0,
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
      },
    ])
  }

  const handleRemoveLine = (index) => {
    if (formItems.length === 1) return
    setFormItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleLineChange = (index, field, value) => {
    setFormItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'product') {
        const prod = products.find((p) => p.id === value)
        if (prod) {
          updated[index].unit_price = Number(prod.unit_price || 0)
        }
      }
      return updated
    })
  }

  const calculateModalTotal = () => {
    let subtotal = 0
    formItems.forEach((item) => {
      const qty = Number(item.quantity || 1)
      const price = Number(item.unit_price || 0)
      const discount = Number(item.discount_percent || 0)
      const lineTotal = qty * price * (1 - discount / 100)
      subtotal += lineTotal
    })
    return subtotal
  }

  // ── Open Modal ────────────────────────────────────────────────────────
  const openModal = (order = null) => {
    setEditingOrder(order)
    if (order) {
      form.setFieldsValue({
        customer: order.customer,
        status: order.status,
        installation_date: order.installation_date ? dayjs(order.installation_date) : null,
        notes: order.notes,
        discount_total: Number(order.discount_total || 0),
      })
      if (order.items && order.items.length > 0) {
        setFormItems(
          order.items.map((it, idx) => ({
            key: it.id || `edit-${idx}`,
            id: it.id,
            product: it.product,
            width: Number(it.width || 0),
            height: Number(it.height || 0),
            quantity: Number(it.quantity || 1),
            unit_price: Number(it.unit_price || 0),
            discount_percent: Number(it.discount_percent || 0),
          }))
        )
      } else {
        setFormItems([
          { key: 'init-item-1', product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
        ])
      }
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'pending', discount_total: 0 })
      setFormItems([
        { key: 'init-item-1', product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
      ])
    }
    setModalVisible(true)
  }

  // ── Submit Form (Create / Edit) ───────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      const validItems = formItems.filter((it) => it.product)
      if (validItems.length === 0) {
        messageApi.error('Vui lòng chọn ít nhất 1 sản phẩm cho đơn hàng.')
        setSubmitting(false)
        return
      }

      const totalAmt = calculateModalTotal() - Number(values.discount_total || 0)

      const payload = {
        customer: values.customer,
        status: values.status,
        installation_date: values.installation_date ? values.installation_date.format('YYYY-MM-DD') : null,
        notes: values.notes || '',
        discount_total: Number(values.discount_total || 0),
        total_amount: Math.max(0, totalAmt),
      }

      let orderId
      if (editingOrder) {
        const res = await api.patch(`/orders/orders/${editingOrder.id}/`, payload)
        orderId = res.data.id
        messageApi.success('Cập nhật đơn hàng thành công!')
      } else {
        const res = await api.post('/orders/orders/', payload)
        orderId = res.data.id
        messageApi.success('Tạo đơn hàng mới thành công!')
      }

      if (editingOrder && editingOrder.items) {
        await Promise.all(
          editingOrder.items.map((it) => api.delete(`/orders/order-items/${it.id}/`).catch(() => {}))
        )
      }

      await Promise.all(
        validItems.map((it) => {
          const prodObj = products.find((p) => p.id === it.product)
          return api.post('/orders/order-items/', {
            order: orderId,
            product: it.product,
            product_name: prodObj ? prodObj.name : 'Sản phẩm',
            unit_price: Number(it.unit_price || 0),
            width: Number(it.width || 0),
            height: Number(it.height || 0),
            quantity: Number(it.quantity || 1),
            discount_percent: Number(it.discount_percent || 0),
          })
        })
      )

      setModalVisible(false)
      fetchOrders()
    } catch (error) {
      if (error.errorFields) return
      messageApi.error('Lưu đơn hàng thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete Order ──────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/orders/orders/${id}/`)
      messageApi.success('Đã xoá đơn hàng.')
      fetchOrders()
    } catch {
      messageApi.error('Không thể xoá đơn hàng này.')
    }
  }

  // ── Approve & Reject Order ────────────────────────────────────────────
  const handleApprove = async (id) => {
    try {
      await api.post(`/orders/orders/${id}/approve/`)
      messageApi.success('✅ Đã duyệt đơn hàng! Hệ thống đã tự động xuất kho & tạo lệnh sản xuất.')
      fetchOrders()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Không thể duyệt đơn hàng này.'
      messageApi.error(msg)
    }
  }

  const handleReject = async (id) => {
    try {
      await api.post(`/orders/orders/${id}/reject/`)
      messageApi.warning('Đã từ chối đơn hàng.')
      fetchOrders()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Không thể từ chối đơn hàng này.'
      messageApi.error(msg)
    }
  }

  // ── Table Columns ─────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Mã đơn hàng',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (val, record) => (
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            ĐH
          </div>
          <div>
            <Text
              strong
              style={{ color: '#2563eb', cursor: 'pointer', display: 'block' }}
              onClick={() => {
                setSelectedOrder(record)
                setDrawerVisible(true)
              }}
            >
              {val || `DH-${record.id}`}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(record.created_at).format('DD/MM/YYYY')}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customer_name',
      key: 'customer_name',
      render: (val, r) => (
        <div>
          <Text strong style={{ display: 'block' }}>{val || '—'}</Text>
          {r.customer_phone && <Text type="secondary" style={{ fontSize: 12 }}>{r.customer_phone}</Text>}
        </div>
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
      title: 'Người tạo / duyệt',
      key: 'people',
      render: (_, r) => (
        <div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Tạo:</Text> <Tag color="blue">{r.created_by_name || '—'}</Tag></div>
          {r.approved_by_name && (
            <div style={{ marginTop: 2 }}><Text type="secondary" style={{ fontSize: 12 }}>Duyệt:</Text> <Tag color="green">{r.approved_by_name}</Tag></div>
          )}
        </div>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (val) => (
        <Text strong style={{ color: '#16a34a', fontSize: 15 }}>
          {Number(val || 0).toLocaleString('vi-VN')} đ
        </Text>
      ),
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && canApprove && (
            <>
              <Popconfirm
                title="Duyệt đơn hàng?"
                description="Sau khi duyệt, hệ thống sẽ tự động xuất kho và tạo lệnh sản xuất."
                onConfirm={() => handleApprove(record.id)}
                okText="Duyệt đơn"
                cancelText="Hủy"
              >
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ background: '#16a34a', borderColor: '#16a34a' }}
                >
                  Duyệt
                </Button>
              </Popconfirm>

              <Popconfirm
                title="Từ chối đơn hàng?"
                description="Bạn có chắc chắn muốn từ chối đơn hàng này không?"
                onConfirm={() => handleReject(record.id)}
                okText="Từ chối"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<CloseCircleOutlined />}>
                  Từ chối
                </Button>
              </Popconfirm>
            </>
          )}

          <Button
            type="text"
            icon={<FileTextOutlined style={{ color: '#2563eb' }} />}
            onClick={() => {
              setSelectedOrder(record)
              setDrawerVisible(true)
            }}
          />

          {canEdit && record.status === 'pending' && (
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#d97706' }} />}
              onClick={() => openModal(record)}
            />
          )}

          {canDelete && (
            <Popconfirm
              title="Xoá đơn hàng?"
              description="Bạn có chắc chắn muốn xoá đơn hàng này không?"
              onConfirm={() => handleDelete(record.id)}
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

      {/* ── Page Header & Stats ────────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            <FileDoneOutlined style={{ color: '#10b981', marginRight: 10 }} />
            Quản lý Đơn hàng
          </Title>
          <Text type="secondary">
            Điều phối đơn hàng, xét duyệt tự động kích hoạt xuất kho và phát lệnh sản xuất.
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              }}
            >
              Tạo Đơn Hàng Mới
            </Button>
          )}
        </Col>
      </Row>

      {/* ── Cards Thống Kê ─────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #f59e0b' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>CHỜ XÉT DUYỆT</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, color: '#f59e0b' }}>{totalPending}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #3b82f6' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>ĐÃ DUYỆT / ĐANG SX</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, color: '#3b82f6' }}>{totalApproved}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #10b981' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>HOÀN THÀNH</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, color: '#10b981' }}>{totalCompleted}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #e11d48' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>DOANH THU GHI NHẬN</Text>
            <Title level={3} style={{ margin: '4px 0 0', fontWeight: 800, color: '#e11d48' }}>
              {totalRevenue.toLocaleString('vi-VN')} đ
            </Title>
          </Card>
        </Col>
      </Row>

      {/* ── Search & Filter Bar ────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          marginBottom: 24,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Tìm theo mã đơn hàng, tên khách hàng..."
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
              <Option value="pending"><Badge status="warning" text="Chờ duyệt" /></Option>
              <Option value="approved"><Badge status="processing" text="Đã chấp nhận" /></Option>
              <Option value="rejected"><Badge status="error" text="Đã từ chối" /></Option>
              <Option value="cancelled"><Badge status="default" text="Đã hủy" /></Option>
              <Option value="completed"><Badge status="success" text="Hoàn thành" /></Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* ── Order Table ────────────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `Tổng cộng ${total} đơn hàng`,
          }}
        />
      </Card>

      {/* ── Modal Add / Edit Order ─────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <FileDoneOutlined style={{ color: '#10b981' }} />
            <Text strong style={{ fontSize: 18 }}>
              {editingOrder ? `Chỉnh sửa Đơn hàng (${editingOrder.order_number})` : 'Tạo Đơn Hàng Mới'}
            </Text>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Lưu Đơn Hàng"
        cancelText="Hủy"
        width={850}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="customer"
                label="Khách hàng"
                rules={[{ required: true, message: 'Vui lòng chọn khách hàng' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn hoặc tìm kiếm khách hàng..."
                  optionFilterProp="children"
                >
                  {customers.map((c) => (
                    <Option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Trạng thái">
                <Select>
                  <Option value="pending">Chờ duyệt</Option>
                  <Option value="approved">Đã chấp nhận</Option>
                  <Option value="rejected">Đã từ chối</Option>
                  <Option value="cancelled">Đã hủy</Option>
                  <Option value="completed">Hoàn thành</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="installation_date" label="Ngày lắp đặt dự kiến">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '12px 0' }}>Danh sách sản phẩm / dịch vụ</Divider>

          {formItems.map((item, index) => (
            <Card
              key={item.key}
              size="small"
              style={{
                marginBottom: 12,
                background: token.colorFillAlter,
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <Row gutter={12} align="middle">
                <Col xs={24} sm={8}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Sản phẩm / Vật tư</Text>
                  <Select
                    showSearch
                    placeholder="Chọn sản phẩm..."
                    optionFilterProp="children"
                    style={{ width: '100%' }}
                    value={item.product || undefined}
                    onChange={(val) => handleLineChange(index, 'product', val)}
                  >
                    {products.map((p) => (
                      <Option key={p.id} value={p.id}>
                        {p.name} ({p.unit || 'cái'})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col xs={12} sm={3}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Rộng (m)</Text>
                  <InputNumber
                    min={0}
                    step={0.1}
                    style={{ width: '100%' }}
                    value={item.width}
                    onChange={(val) => handleLineChange(index, 'width', val)}
                  />
                </Col>
                <Col xs={12} sm={3}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Cao (m)</Text>
                  <InputNumber
                    min={0}
                    step={0.1}
                    style={{ width: '100%' }}
                    value={item.height}
                    onChange={(val) => handleLineChange(index, 'height', val)}
                  />
                </Col>
                <Col xs={12} sm={3}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Số lượng</Text>
                  <InputNumber
                    min={1}
                    style={{ width: '100%' }}
                    value={item.quantity}
                    onChange={(val) => handleLineChange(index, 'quantity', val)}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>Đơn giá (đ)</Text>
                  <InputNumber
                    min={0}
                    step={1000}
                    style={{ width: '100%' }}
                    value={item.unit_price}
                    onChange={(val) => handleLineChange(index, 'unit_price', val)}
                  />
                </Col>
                <Col xs={24} sm={3} style={{ textAlign: 'right', marginTop: 18 }}>
                  {formItems.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveLine(index)}
                    />
                  )}
                </Col>
              </Row>
            </Card>
          ))}

          <Button type="dashed" onClick={handleAddLine} block icon={<PlusOutlined />} style={{ marginBottom: 16 }}>
            Thêm dòng sản phẩm
          </Button>

          <Row gutter={16} justify="end">
            <Col xs={24} md={8}>
              <Form.Item name="discount_total" label="Tổng chiết khấu chung (VNĐ)">
                <InputNumber
                  min={0}
                  step={10000}
                  style={{ width: '100%' }}
                  formatter={(val) => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(val) => val.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú thi công & giao hàng">
            <TextArea
              rows={3}
              placeholder="VD: Giao hàng tận công trình, kiểm tra số đo thực tế trước khi cắt nhôm..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer View Order Details ──────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <PrinterOutlined style={{ color: '#10b981' }} />
            <Text strong>Chi tiết Đơn Hàng {selectedOrder?.order_number}</Text>
          </Space>
        }
        width={650}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedOrder && (
          <div>
            <Card style={{ marginBottom: 20, background: token.colorFillAlter }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">Khách hàng:</Text>
                  <Title level={5} style={{ margin: 0 }}>{selectedOrder.customer_name}</Title>
                  {selectedOrder.customer_phone && <Text type="secondary">{selectedOrder.customer_phone}</Text>}
                </Col>
                <Col span={12}>
                  <Text type="secondary">Mã đơn hàng:</Text>
                  <Title level={5} style={{ margin: 0, color: '#10b981' }}>
                    {selectedOrder.order_number}
                  </Title>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Ngày tạo:</Text>
                  <div><Text strong>{dayjs(selectedOrder.created_at).format('DD/MM/YYYY HH:mm')}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Trạng thái:</Text>
                  <div>
                    {(() => {
                      const st = selectedOrder.status
                      const cfg = statusConfig[st] || { label: st, color: 'default' }
                      return <Tag color={cfg.color}>{cfg.label}</Tag>
                    })()}
                  </div>
                </Col>
              </Row>
            </Card>

            <Title level={5}>Danh sách sản phẩm thi công</Title>
            <Table
              dataSource={selectedOrder.items || []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Sản phẩm',
                  dataIndex: 'product_name',
                  key: 'product_name',
                  render: (val) => <Text strong>{val}</Text>,
                },
                {
                  title: 'KT (R x C)',
                  key: 'dimensions',
                  render: (_, r) => (
                    <Text type="secondary">
                      {r.width > 0 || r.height > 0 ? `${r.width}m x ${r.height}m` : '—'}
                    </Text>
                  ),
                },
                {
                  title: 'SL',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  align: 'center',
                },
                {
                  title: 'Đơn giá',
                  dataIndex: 'unit_price',
                  key: 'unit_price',
                  align: 'right',
                  render: (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`,
                },
                {
                  title: 'Thành tiền',
                  key: 'total',
                  align: 'right',
                  render: (_, r) => {
                    const tot = r.quantity * r.unit_price * (1 - (r.discount_percent || 0) / 100)
                    return <Text strong>{tot.toLocaleString('vi-VN')} đ</Text>
                  },
                },
              ]}
            />

            <Divider />
            <Row justify="end">
              <Col span={12} style={{ textAlign: 'right' }}>
                <div><Text type="secondary">Chiết khấu chung:</Text> <Text strong>-{Number(selectedOrder.discount_total || 0).toLocaleString('vi-VN')} đ</Text></div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">TỔNG THANH TOÁN:</Text>{' '}
                  <Title level={4} style={{ display: 'inline', color: '#16a34a', margin: 0 }}>
                    {Number(selectedOrder.total_amount || 0).toLocaleString('vi-VN')} đ
                  </Title>
                </div>
              </Col>
            </Row>

            {selectedOrder.notes && (
              <Card size="small" style={{ marginTop: 24, background: '#fffbeb', borderColor: '#fef3c7' }}>
                <Text strong style={{ color: '#d97706' }}>Ghi chú thi công:</Text>
                <Paragraph style={{ margin: '4px 0 0', color: '#92400e' }}>
                  {selectedOrder.notes}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
