import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  SendOutlined,
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

// Trạng thái báo giá
const statusConfig = {
  draft: { label: 'Nháp', color: 'default', icon: <ClockCircleOutlined /> },
  sent: { label: 'Đã gửi', color: 'blue', icon: <SendOutlined /> },
  accepted: { label: 'Đã chấp nhận', color: 'success', icon: <CheckCircleOutlined /> },
  rejected: { label: 'Đã từ chối', color: 'error', icon: <CloseCircleOutlined /> },
}

export default function QuotationList() {
  const { token } = theme.useToken()
  const { isCompanyAdmin, hasPermission } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  // Data states
  const [quotations, setQuotations] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal Add / Edit
  const [modalVisible, setModalVisible] = useState(false)
  const [editingQuotation, setEditingQuotation] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // Dynamic products in form
  const [formItems, setFormItems] = useState(() => [
    { key: 'init-1', product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
  ])

  // Drawer details
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [selectedQuotation, setSelectedQuotation] = useState(null)

  // Permissions
  const canCreate = isCompanyAdmin || hasPermission('sales.create')
  const canEdit = isCompanyAdmin || hasPermission('sales.edit')
  const canDelete = isCompanyAdmin || hasPermission('sales.delete')

  // ── Fetch data ────────────────────────────────────────────────────────
  const fetchQuotations = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/sales/quotations/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setQuotations(data)
    } catch {
      messageApi.error('Không thể tải danh sách báo giá.')
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
    fetchQuotations()
  }, [fetchQuotations])

  useEffect(() => {
    fetchCustomersAndProducts()
  }, [fetchCustomersAndProducts])

  // ── Filtered list ─────────────────────────────────────────────────────
  const filteredQuotations = quotations.filter((item) => {
    if (!searchText) return true
    const qNum = (item.quotation_number || '').toLowerCase()
    const cName = (item.customer_name || '').toLowerCase()
    const query = searchText.toLowerCase()
    return qNum.includes(query) || cName.includes(query)
  })

  // ── Stats ─────────────────────────────────────────────────────────────
  const totalDraft = quotations.filter((q) => q.status === 'draft').length
  const totalSent = quotations.filter((q) => q.status === 'sent').length
  const totalAccepted = quotations.filter((q) => q.status === 'accepted').length
  const totalAmountAccepted = quotations
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + Number(q.total_amount || 0), 0)

  // ── Handlers for modal form items ─────────────────────────────────────
  const handleAddLine = () => {
    setFormItems((prev) => [
      ...prev,
      { key: Date.now(), product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
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

  // Calculate totals in modal
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
  const openModal = (quotation = null) => {
    setEditingQuotation(quotation)
    if (quotation) {
      form.setFieldsValue({
        customer: quotation.customer,
        status: quotation.status,
        installation_date: quotation.installation_date ? dayjs(quotation.installation_date) : null,
        notes: quotation.notes,
        discount_total: Number(quotation.discount_total || 0),
      })
      if (quotation.items && quotation.items.length > 0) {
        setFormItems(
          quotation.items.map((it, idx) => ({
            key: it.id || idx,
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
          { key: Date.now(), product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
        ])
      }
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'draft', discount_total: 0 })
      setFormItems([
        { key: Date.now(), product: null, width: 0, height: 0, quantity: 1, unit_price: 0, discount_percent: 0 },
      ])
    }
    setModalVisible(true)
  }

  // ── Submit Form (Create / Edit) ───────────────────────────────────────
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      // Validate items
      const validItems = formItems.filter((it) => it.product)
      if (validItems.length === 0) {
        messageApi.error('Vui lòng chọn ít nhất 1 sản phẩm cho báo giá.')
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

      let quotationId
      if (editingQuotation) {
        const res = await api.patch(`/sales/quotations/${editingQuotation.id}/`, payload)
        quotationId = res.data.id
        messageApi.success('Cập nhật báo giá thành công!')
      } else {
        const res = await api.post('/sales/quotations/', payload)
        quotationId = res.data.id
        messageApi.success('Tạo báo giá mới thành công!')
      }

      // Add / replace items
      // Xoá các items cũ nếu chỉnh sửa
      if (editingQuotation && editingQuotation.items) {
        await Promise.all(
          editingQuotation.items.map((it) => api.delete(`/sales/quotation-items/${it.id}/`).catch(() => {}))
        )
      }

      // Tạo mới items
      await Promise.all(
        validItems.map((it) => {
          const prodObj = products.find((p) => p.id === it.product)
          return api.post('/sales/quotation-items/', {
            quotation: quotationId,
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
      fetchQuotations()
    } catch (error) {
      if (error.errorFields) return
      messageApi.error('Lưu báo giá thất bại. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete Quotation ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await api.delete(`/sales/quotations/${id}/`)
      messageApi.success('Đã xoá báo giá.')
      fetchQuotations()
    } catch {
      messageApi.error('Không thể xoá báo giá này.')
    }
  }

  // ── Convert Quotation to Order ────────────────────────────────────────
  const handleConvertToOrder = async (id) => {
    try {
      await api.post(`/sales/quotations/${id}/create-order/`)
      messageApi.success('🎉 Đã chuyển báo giá thành Đơn hàng chính thức!')
      fetchQuotations()
    } catch (error) {
      const msg = error.response?.data?.detail || 'Không thể tạo đơn hàng từ báo giá này.'
      messageApi.error(msg)
    }
  }

  // ── Table Columns ─────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Mã báo giá',
      dataIndex: 'quotation_number',
      key: 'quotation_number',
      render: (val, record) => (
        <Space>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            BG
          </div>
          <div>
            <Text
              strong
              style={{ color: '#2563eb', cursor: 'pointer', display: 'block' }}
              onClick={() => {
                setSelectedQuotation(record)
                setDrawerVisible(true)
              }}
            >
              {val || `BG-${record.id}`}
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
      render: (val) => <Text strong>{val || '—'}</Text>,
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
      title: 'Người tạo',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      render: (val) => <Tag color="blue">{val || 'Hệ thống'}</Tag>,
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
          {record.status === 'accepted' && (
            <Button
              type="primary"
              size="small"
              icon={<FileDoneOutlined />}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              onClick={() => handleConvertToOrder(record.id)}
            >
              Tạo Đơn Hàng
            </Button>
          )}
          <Button
            type="text"
            icon={<FileTextOutlined style={{ color: '#2563eb' }} />}
            onClick={() => {
              setSelectedQuotation(record)
              setDrawerVisible(true)
            }}
          />
          {canEdit && (
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#d97706' }} />}
              onClick={() => openModal(record)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Xoá báo giá?"
              description="Bạn có chắc chắn muốn xoá báo giá này không?"
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
            <FileTextOutlined style={{ color: '#2563eb', marginRight: 10 }} />
            Quản lý Bán hàng & Báo giá
          </Title>
          <Text type="secondary">
            Tạo, theo dõi và chuyển đổi báo giá thành đơn hàng chính thức một cách chuyên nghiệp.
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
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              }}
            >
              Tạo Báo Giá Mới
            </Button>
          )}
        </Col>
      </Row>

      {/* ── Cards Thống Kê ─────────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #94a3b8' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>BÁO GIÁ NHÁP</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800 }}>{totalDraft}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #3b82f6' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>ĐÃ GỬI KHÁCH HÀNG</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, color: '#3b82f6' }}>{totalSent}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #16a34a' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>ĐÃ CHẤP NHẬN</Text>
            <Title level={2} style={{ margin: '4px 0 0', fontWeight: 800, color: '#16a34a' }}>{totalAccepted}</Title>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card style={{ borderRadius: 12, borderLeft: '4px solid #e11d48' }}>
            <Text type="secondary" style={{ fontWeight: 600 }}>TỔNG DOANH SỐ CHỐT</Text>
            <Title level={3} style={{ margin: '4px 0 0', fontWeight: 800, color: '#e11d48' }}>
              {totalAmountAccepted.toLocaleString('vi-VN')} đ
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
              placeholder="Tìm theo mã báo giá, tên khách hàng..."
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
              <Option value="draft"><Badge status="default" text="Nháp" /></Option>
              <Option value="sent"><Badge status="processing" text="Đã gửi" /></Option>
              <Option value="accepted"><Badge status="success" text="Đã chấp nhận" /></Option>
              <Option value="rejected"><Badge status="error" text="Đã từ chối" /></Option>
            </Select>
          </Col>
        </Row>
      </Card>

      {/* ── Quotation Table ────────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 4px 16px rgba(0,0,0,0.05)',
        }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          columns={columns}
          dataSource={filteredQuotations}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `Tổng cộng ${total} báo giá`,
          }}
        />
      </Card>

      {/* ── Modal Add / Edit Quotation ─────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: '#2563eb' }} />
            <Text strong style={{ fontSize: 18 }}>
              {editingQuotation ? `Chỉnh sửa Báo giá (${editingQuotation.quotation_number})` : 'Tạo Báo Giá Mới'}
            </Text>
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="Lưu Báo Giá"
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
                  <Option value="draft">Nháp</Option>
                  <Option value="sent">Đã gửi</Option>
                  <Option value="accepted">Đã chấp nhận</Option>
                  <Option value="rejected">Đã từ chối</Option>
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

          {/* Dynamic products lines */}
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

          <Form.Item name="notes" label="Ghi chú & Điều khoản báo giá">
            <TextArea
              rows={3}
              placeholder="VD: Báo giá có hiệu lực trong vòng 15 ngày. Chưa bao gồm thuế VAT..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer View Quotation Details ──────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <PrinterOutlined style={{ color: '#2563eb' }} />
            <Text strong>Chi tiết Báo Giá {selectedQuotation?.quotation_number}</Text>
          </Space>
        }
        width={650}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {selectedQuotation && (
          <div>
            <Card style={{ marginBottom: 20, background: token.colorFillAlter }}>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text type="secondary">Khách hàng:</Text>
                  <Title level={5} style={{ margin: 0 }}>{selectedQuotation.customer_name}</Title>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Mã báo giá:</Text>
                  <Title level={5} style={{ margin: 0, color: '#2563eb' }}>
                    {selectedQuotation.quotation_number}
                  </Title>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Ngày tạo:</Text>
                  <div><Text strong>{dayjs(selectedQuotation.created_at).format('DD/MM/YYYY HH:mm')}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary">Trạng thái:</Text>
                  <div>
                    {(() => {
                      const st = selectedQuotation.status
                      const cfg = statusConfig[st] || { label: st, color: 'default' }
                      return <Tag color={cfg.color}>{cfg.label}</Tag>
                    })()}
                  </div>
                </Col>
              </Row>
            </Card>

            <Title level={5}>Danh sách hạng mục báo giá</Title>
            <Table
              dataSource={selectedQuotation.items || []}
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
                <div><Text type="secondary">Chiết khấu chung:</Text> <Text strong>-{Number(selectedQuotation.discount_total || 0).toLocaleString('vi-VN')} đ</Text></div>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">TỔNG THANH TOÁN:</Text>{' '}
                  <Title level={4} style={{ display: 'inline', color: '#16a34a', margin: 0 }}>
                    {Number(selectedQuotation.total_amount || 0).toLocaleString('vi-VN')} đ
                  </Title>
                </div>
              </Col>
            </Row>

            {selectedQuotation.notes && (
              <Card size="small" style={{ marginTop: 24, background: '#fffbeb', borderColor: '#fef3c7' }}>
                <Text strong style={{ color: '#d97706' }}>Ghi chú & Điều khoản:</Text>
                <Paragraph style={{ margin: '4px 0 0', color: '#92400e' }}>
                  {selectedQuotation.notes}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
