import {
  AlertOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  InboxOutlined,
  PictureOutlined,
  PlusOutlined,
  SearchOutlined,
  ShopOutlined,
  TagOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import dayjs from 'dayjs'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

export default function Inventory() {
  const { isCompanyAdmin, hasPermission, checkMaintenance } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  const [activeTab, setActiveTab] = useState('products')

  // Data states
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [stockLevels, setStockLevels] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)

  // Modals
  const [productModalVisible, setProductModalVisible] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productImageFile, setProductImageFile] = useState(null)
  const [productPreviewImage, setProductPreviewImage] = useState(null)
  const [productForm] = Form.useForm()

  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryForm] = Form.useForm()

  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [warehouseForm] = Form.useForm()

  const [txnModalVisible, setTxnModalVisible] = useState(false)
  const [txnForm] = Form.useForm()

  const [submitting, setSubmitting] = useState(false)

  // Permissions
  const canCreate = isCompanyAdmin || hasPermission('inventory.create')
  const canEdit = isCompanyAdmin || hasPermission('inventory.edit')
  const canDelete = isCompanyAdmin || hasPermission('inventory.delete')

  // ── Fetch Data ────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const params = { include_inactive: 'true' }
      if (categoryFilter) params.category_id = categoryFilter
      const res = await api.get('/inventory/products/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setProducts(data)
    } catch {
      messageApi.error('Không thể tải danh sách sản phẩm.')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, messageApi])

  const fetchCategories = useCallback(async () => {
    await Promise.resolve()
    try {
      const res = await api.get('/inventory/product-categories/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setCategories(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchWarehouses = useCallback(async () => {
    await Promise.resolve()
    try {
      const res = await api.get('/inventory/warehouses/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setWarehouses(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchStockLevels = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const params = {}
      if (warehouseFilter) params.warehouse_id = warehouseFilter
      if (lowStockOnly) params.low_stock = 'true'
      const res = await api.get('/inventory/stock-levels/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setStockLevels(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [warehouseFilter, lowStockOnly])

  const fetchTransactions = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const res = await api.get('/inventory/transactions/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setTransactions(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
    fetchWarehouses()
  }, [fetchCategories, fetchWarehouses])

  useEffect(() => {
    if (activeTab === 'products') fetchProducts()
    else if (activeTab === 'categories') fetchCategories()
    else if (activeTab === 'stock') fetchStockLevels()
    else if (activeTab === 'transactions') fetchTransactions()
  }, [activeTab, fetchProducts, fetchCategories, fetchStockLevels, fetchTransactions])

  // ── Filtered Products ─────────────────────────────────────────────────
  const filteredProducts = products.filter((item) => {
    if (!searchText) return true
    const name = (item.name || '').toLowerCase()
    const sku = (item.sku || '').toLowerCase()
    const query = searchText.toLowerCase()
    return name.includes(query) || sku.includes(query)
  })

  // ── Product Handlers ──────────────────────────────────────────────────
  const openProductModal = (prod = null) => {
    if (checkMaintenance()) return
    setEditingProduct(prod)
    setProductImageFile(null)
    if (prod) {
      setProductPreviewImage(prod.image_url || prod.image || null)
      productForm.setFieldsValue({
        sku: prod.sku,
        name: prod.name,
        category: prod.category,
        unit: prod.unit || 'cái',
        price: Number(prod.price || 0),
        cost_price: Number(prod.cost_price || 0),
        is_active: prod.is_active !== false,
        description: prod.description || '',
      })
    } else {
      setProductPreviewImage(null)
      productForm.resetFields()
      productForm.setFieldsValue({ unit: 'cái', price: 0, cost_price: 0, is_active: true })
    }
    setProductModalVisible(true)
  }

  const handleProductSubmit = async () => {
    try {
      const values = await productForm.validateFields()
      setSubmitting(true)

      const formData = new FormData()
      formData.append('sku', values.sku)
      formData.append('name', values.name)
      formData.append('category', values.category)
      formData.append('unit', values.unit || 'cái')
      formData.append('price', values.price || 0)
      formData.append('cost_price', values.cost_price || 0)
      formData.append('description', values.description || '')
      formData.append('is_active', values.is_active !== false)
      if (productImageFile) {
        formData.append('image', productImageFile)
      }

      if (editingProduct) {
        await api.patch(`/inventory/products/${editingProduct.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        messageApi.success('Cập nhật sản phẩm thành công!')
      } else {
        await api.post('/inventory/products/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        messageApi.success('Thêm sản phẩm mới thành công!')
      }
      setProductModalVisible(false)
      fetchProducts()
    } catch (error) {
      if (error.errorFields) return
      messageApi.error('Lưu sản phẩm thất bại. Vui lòng kiểm tra lại mã SKU.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleProductDelete = async (id) => {
    if (checkMaintenance()) return
    try {
      await api.delete(`/inventory/products/${id}/`)
      messageApi.success('Đã xoá sản phẩm.')
      fetchProducts()
    } catch {
      messageApi.error('Không thể xoá sản phẩm này vì đang được sử dụng trong đơn hàng hoặc báo giá.')
    }
  }

  // ── Category Handlers ─────────────────────────────────────────────────
  const openCategoryModal = (cat = null) => {
    if (checkMaintenance()) return
    setEditingCategory(cat)
    if (cat) {
      categoryForm.setFieldsValue({ name: cat.name, description: cat.description || '' })
    } else {
      categoryForm.resetFields()
    }
    setCategoryModalVisible(true)
  }

  const handleCategorySubmit = async () => {
    try {
      const values = await categoryForm.validateFields()
      setSubmitting(true)
      if (editingCategory) {
        await api.patch(`/inventory/product-categories/${editingCategory.id}/`, values)
        messageApi.success('Cập nhật danh mục thành công!')
      } else {
        await api.post('/inventory/product-categories/', values)
        messageApi.success('Thêm danh mục thành công!')
      }
      setCategoryModalVisible(false)
      fetchCategories()
    } catch {
      messageApi.error('Lưu danh mục thất bại. Tên danh mục có thể đã tồn tại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCategoryDelete = async (id) => {
    if (checkMaintenance()) return
    try {
      await api.delete(`/inventory/product-categories/${id}/`)
      messageApi.success('Đã xoá danh mục.')
      fetchCategories()
    } catch {
      messageApi.error('Không thể xoá danh mục này vì đang chứa sản phẩm.')
    }
  }

  // ── Warehouse Handlers ────────────────────────────────────────────────
  const openWarehouseModal = (wh = null) => {
    if (checkMaintenance()) return
    setEditingWarehouse(wh)
    if (wh) {
      warehouseForm.setFieldsValue({ name: wh.name, location: wh.location || '', is_active: wh.is_active !== false })
    } else {
      warehouseForm.resetFields()
      warehouseForm.setFieldsValue({ is_active: true })
    }
    setWarehouseModalVisible(true)
  }

  const handleWarehouseSubmit = async () => {
    try {
      const values = await warehouseForm.validateFields()
      setSubmitting(true)
      if (editingWarehouse) {
        await api.patch(`/inventory/warehouses/${editingWarehouse.id}/`, values)
        messageApi.success('Cập nhật kho thành công!')
      } else {
        await api.post('/inventory/warehouses/', values)
        messageApi.success('Thêm kho thành công!')
      }
      setWarehouseModalVisible(false)
      fetchWarehouses()
    } catch {
      messageApi.error('Lưu thông tin kho thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Transaction (Nhập kho / Điều chỉnh) Handlers ──────────────────────
  const openTxnModal = () => {
    if (checkMaintenance()) return
    txnForm.resetFields()
    txnForm.setFieldsValue({ type: 'import', quantity: 1, unit_cost: 0 })
    setTxnModalVisible(true)
  }

  const handleTxnSubmit = async () => {
    try {
      const values = await txnForm.validateFields()
      setSubmitting(true)
      await api.post('/inventory/transactions/', values)
      messageApi.success('Tạo phiếu kho thành công! Tồn kho đã được tự động cập nhật.')
      setTxnModalVisible(false)
      fetchTransactions()
      fetchStockLevels()
    } catch (error) {
      if (error.errorFields) return
      messageApi.error('Tạo phiếu kho thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Columns for Products ──────────────────────────────────────────────
  const productColumns = [
    {
      title: 'Mã SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 130,
      render: (val) => <Tag color="blue" style={{ fontWeight: 600 }}>{val}</Tag>,
    },
    {
      title: 'Hình ảnh',
      key: 'image',
      width: 95,
      align: 'center',
      render: (_, r) => {
        const imgUrl = r.image_url || r.image
        return imgUrl ? (
          <img src={imgUrl} alt={r.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
        ) : (
          <div style={{ width: 48, height: 48, background: '#f1f5f9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 11, margin: '0 auto' }}>
            No Img
          </div>
        )
      },
    },
    {
      title: 'Tên sản phẩm / Dịch vụ',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (val, r) => (
        <div>
          <Text strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{val}</Text>
          {r.description && <Text type="secondary" style={{ fontSize: 12 }}>{r.description}</Text>}
        </div>
      ),
    },
    {
      title: 'Loại sản phẩm',
      dataIndex: 'category',
      key: 'category',
      width: 160,
      render: (catId) => {
        const cat = categories.find((c) => c.id === catId)
        return <Tag color="cyan">{cat ? cat.name : 'Chưa phân loại'}</Tag>
      },
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 90,
      align: 'center',
      render: (v) => <Tag>{v || 'cái'}</Tag>,
    },
    {
      title: 'Giá bán',
      dataIndex: 'price',
      key: 'price',
      width: 140,
      align: 'right',
      render: (v) => (
        <Text strong style={{ color: '#16a34a' }}>
          {Number(v || 0).toLocaleString('vi-VN')} đ
        </Text>
      ),
    },
    {
      title: 'Giá nhập (Vốn)',
      dataIndex: 'cost_price',
      key: 'cost_price',
      width: 140,
      align: 'right',
      render: (v) => <Text type="secondary">{Number(v || 0).toLocaleString('vi-VN')} đ</Text>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 130,
      align: 'center',
      render: (v) =>
        v !== false ? (
          <Tag color="success" icon={<CheckCircleOutlined />}>Kinh doanh</Tag>
        ) : (
          <Tag color="default" icon={<CloseCircleOutlined />}>Ngừng KD</Tag>
        ),
    },
    {
      title: 'Hành động',
      key: 'action',
      width: 110,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <Space>
          {canEdit && (
            <Button
              type="text"
              icon={<EditOutlined style={{ color: '#d97706' }} />}
              onClick={() => openProductModal(record)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Xoá sản phẩm?"
              description="Bạn có chắc chắn muốn xoá sản phẩm này không?"
              onConfirm={() => handleProductDelete(record.id)}
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

  // ── Columns for Stock Levels ──────────────────────────────────────────
  const stockColumns = [
    {
      title: 'Sản phẩm',
      key: 'product',
      render: (_, r) => {
        const prod = products.find((p) => p.id === r.product)
        return prod ? <Text strong>{prod.name} ({prod.sku})</Text> : <Text>SP #{r.product}</Text>
      },
    },
    {
      title: 'Kho hàng',
      key: 'warehouse',
      render: (_, r) => {
        const wh = warehouses.find((w) => w.id === r.warehouse)
        return <Tag color="geekblue" icon={<ShopOutlined />}>{wh ? wh.name : `Kho #${r.warehouse}`}</Tag>
      },
    },
    {
      title: 'Số lượng tồn kho thực tế',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (qty, r) => {
        const isLow = r.is_low_stock || qty <= r.min_quantity
        return (
          <Space>
            <Text strong style={{ fontSize: 16, color: isLow ? '#dc2626' : '#16a34a' }}>
              {qty}
            </Text>
            {isLow && <Tag color="error" icon={<AlertOutlined />}>Tồn kho thấp</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Ngưỡng cảnh báo min',
      dataIndex: 'min_quantity',
      key: 'min_quantity',
      align: 'center',
      render: (v) => <Text type="secondary">{v || 0}</Text>,
    },
  ]

  // ── Columns for Transactions ──────────────────────────────────────────
  const txnColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'transaction_code',
      key: 'transaction_code',
      render: (val) => <Tag color="purple" style={{ fontWeight: 600 }}>{val}</Tag>,
    },
    {
      title: 'Loại phiếu',
      dataIndex: 'type',
      key: 'type',
      render: (val) => {
        if (val === 'import') return <Tag color="success">Nhập kho</Tag>
        if (val === 'export') return <Tag color="error">Xuất kho</Tag>
        return <Tag color="warning">Điều chỉnh</Tag>
      },
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'product',
      key: 'product',
      render: (id) => {
        const p = products.find((item) => item.id === id)
        return p ? <Text strong>{p.name}</Text> : `SP #${id}`
      },
    },
    {
      title: 'Kho',
      dataIndex: 'warehouse',
      key: 'warehouse',
      render: (id) => {
        const w = warehouses.find((item) => item.id === id)
        return <Tag>{w ? w.name : `Kho #${id}`}</Tag>
      },
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (v, r) => (
        <Text strong style={{ color: r.type === 'export' ? '#dc2626' : '#16a34a', fontSize: 15 }}>
          {r.type === 'export' ? `-${v}` : `+${v}`}
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
      render: (v) => <Text type="secondary">{v || '—'}</Text>,
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val) => dayjs(val).format('DD/MM/YYYY HH:mm'),
    },
  ]

  return (
    <div style={{ padding: '24px 32px' }}>
      {contextHolder}

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={3} style={{ margin: 0, fontWeight: 800 }}>
            <DatabaseOutlined style={{ color: '#0284c7', marginRight: 10 }} />
            Quản lý Kho bãi & Sản phẩm
          </Title>
          <Text type="secondary">
            Danh mục vật tư, kiểm soát tồn kho theo thời gian thực và lịch sử biến động kho.
          </Text>
        </Col>
        <Col>
          <Space>
            {activeTab === 'products' && canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openProductModal()}
                style={{ background: '#0284c7', fontWeight: 600, borderRadius: 8 }}
              >
                Thêm Sản Phẩm Mới
              </Button>
            )}
            {activeTab === 'categories' && canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openCategoryModal()}
                style={{ background: '#0891b2', fontWeight: 600, borderRadius: 8 }}
              >
                Thêm Danh Mục Mới
              </Button>
            )}
            {activeTab === 'stock' && canCreate && (
              <Button
                type="primary"
                icon={<ShopOutlined />}
                onClick={() => openWarehouseModal()}
                style={{ background: '#4f46e5', fontWeight: 600, borderRadius: 8 }}
              >
                Quản lý Kho Hàng
              </Button>
            )}
            {activeTab === 'transactions' && canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => openTxnModal()}
                style={{ background: '#16a34a', fontWeight: 600, borderRadius: 8 }}
              >
                Tạo Phiếu Nhập / Điều Chỉnh
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Card style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }} bodyStyle={{ padding: 16 }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'products',
              label: (
                <Space>
                  <InboxOutlined />
                  <span>Sản phẩm & Dịch vụ ({products.length})</span>
                </Space>
              ),
              children: (
                <div>
                  <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={10}>
                      <Input
                        placeholder="Tìm theo tên sản phẩm, mã SKU..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        style={{ borderRadius: 8 }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select
                        placeholder="Lọc theo danh mục"
                        value={categoryFilter || undefined}
                        onChange={(val) => setCategoryFilter(val || '')}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {categories.map((c) => (
                          <Option key={c.id} value={c.id}>{c.name}</Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                  <Table
                    columns={productColumns}
                    dataSource={filteredProducts}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1300 }}
                  />
                </div>
              ),
            },
            {
              key: 'stock',
              label: (
                <Space>
                  <AppstoreOutlined />
                  <span>Tồn Kho Thực Tế</span>
                </Space>
              ),
              children: (
                <div>
                  <Row gutter={16} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
                    <Col xs={24} sm={10}>
                      <Select
                        placeholder="Chọn kho hàng để xem..."
                        value={warehouseFilter || undefined}
                        onChange={(val) => setWarehouseFilter(val || '')}
                        allowClear
                        style={{ width: '100%' }}
                      >
                        {warehouses.map((w) => (
                          <Option key={w.id} value={w.id}>{w.name} {w.location ? `(${w.location})` : ''}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col>
                      <Space>
                        <Text strong style={{ color: lowStockOnly ? '#dc2626' : 'inherit' }}>Chỉ hiện tồn kho báo động:</Text>
                        <Switch checked={lowStockOnly} onChange={setLowStockOnly} />
                      </Space>
                    </Col>
                  </Row>
                  <Table
                    columns={stockColumns}
                    dataSource={stockLevels}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
            {
              key: 'transactions',
              label: (
                <Space>
                  <HistoryOutlined />
                  <span>Lịch Sử Giao Dịch Kho</span>
                </Space>
              ),
              children: (
                <Table
                  columns={txnColumns}
                  dataSource={transactions}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: 'categories',
              label: (
                <Space>
                  <TagOutlined />
                  <span>Loại Sản Phẩm</span>
                </Space>
              ),
              children: (
                <Table
                  dataSource={categories}
                  rowKey="id"
                  columns={[
                    { title: 'Tên loại sản phẩm', dataIndex: 'name', key: 'name', render: (v) => <Text strong>{v}</Text> },
                    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (v) => <Text type="secondary">{v || '—'}</Text> },
                    {
                      title: 'Hành động',
                      key: 'action',
                      align: 'right',
                      render: (_, r) => (
                        <Space>
                          {canEdit && <Button type="text" icon={<EditOutlined style={{ color: '#d97706' }} />} onClick={() => openCategoryModal(r)} />}
                          {canDelete && (
                            <Popconfirm title="Xoá danh mục?" onConfirm={() => handleCategoryDelete(r.id)} okText="Xoá" cancelText="Hủy" okButtonProps={{ danger: true }}>
                              <Button type="text" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          )}
                        </Space>
                      ),
                    },
                  ]}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* ── Modal Product Add / Edit ───────────────────────────────────── */}
      <Modal
        title={<Text strong style={{ fontSize: 18 }}>{editingProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản Phẩm Mới'}</Text>}
        open={productModalVisible}
        onCancel={() => setProductModalVisible(false)}
        onOk={handleProductSubmit}
        confirmLoading={submitting}
        okText="Lưu Sản Phẩm"
        cancelText="Hủy"
        width={700}
      >
        <Form form={productForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sku" label="Mã SKU" rules={[{ required: true, message: 'Vui lòng nhập mã SKU' }]}>
                <Input placeholder="VD: SP-001, NHOM-XINGFA..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="Tên sản phẩm / dịch vụ" rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm' }]}>
                <Input placeholder="VD: Cửa nhôm Xingfa 4 cánh..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Danh mục sản phẩm" rules={[{ required: true, message: 'Vui lòng chọn danh mục' }]}>
                <Select placeholder="Chọn danh mục...">
                  {categories.map((c) => (
                    <Option key={c.id} value={c.id}>{c.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Đơn vị tính">
                <Select>
                  <Option value="cái">Cái</Option>
                  <Option value="m²">m²</Option>
                  <Option value="m">Mét</Option>
                  <Option value="bộ">Bộ</Option>
                  <Option value="kg">Kg</Option>
                  <Option value="lít">Lít</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label="Giá bán (VNĐ)" rules={[{ required: true, message: 'Vui lòng nhập giá bán' }]}>
                <InputNumber min={0} step={10000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => v.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="cost_price" label="Giá nhập / Giá vốn (VNĐ)">
                <InputNumber min={0} step={10000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => v.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="Hình ảnh sản phẩm (Tải lên ảnh mẫu cửa / sản phẩm)">
                <Upload
                  beforeUpload={(file) => {
                    const isImage = file.type.startsWith('image/')
                    if (!isImage) {
                      messageApi.error('Chỉ được tải lên file hình ảnh!')
                      return Upload.LIST_IGNORE
                    }
                    setProductImageFile(file)
                    setProductPreviewImage(URL.createObjectURL(file))
                    return false
                  }}
                  maxCount={1}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
                    Chọn hình ảnh sản phẩm
                  </Button>
                </Upload>
                {productPreviewImage && (
                  <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
                    <img
                      src={productPreviewImage}
                      alt="Preview"
                      style={{ height: 100, borderRadius: 8, border: '1px solid #d9d9d9', objectFit: 'cover' }}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.8)' }}
                      onClick={() => {
                        setProductImageFile(null)
                        setProductPreviewImage(null)
                      }}
                    >
                      Xóa ảnh
                    </Button>
                  </div>
                )}
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="description" label="Mô tả chi tiết">
                <TextArea rows={3} placeholder="Mô tả quy cách, thông số kỹ thuật..." />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="is_active" valuePropName="checked" label="Trạng thái kinh doanh">
                <Switch checkedChildren="Đang kinh doanh" unCheckedChildren="Ngừng kinh doanh" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Modal Category Add / Edit ──────────────────────────────────── */}
      <Modal
        title={<Text strong style={{ fontSize: 18 }}>{editingCategory ? 'Chỉnh sửa Danh mục' : 'Thêm Danh Mục Mới'}</Text>}
        open={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        onOk={handleCategorySubmit}
        confirmLoading={submitting}
        okText="Lưu Danh Mục"
        cancelText="Hủy"
      >
        <Form form={categoryForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên danh mục" rules={[{ required: true, message: 'Vui lòng nhập tên danh mục' }]}>
            <Input placeholder="VD: Cửa nhôm, Kính cường lực, Phụ kiện..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={2} placeholder="Mô tả ngắn gọn..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Warehouse Add / Edit ─────────────────────────────────── */}
      <Modal
        title={<Text strong style={{ fontSize: 18 }}>{editingWarehouse ? 'Chỉnh sửa Kho Hàng' : 'Thêm Kho Hàng Mới'}</Text>}
        open={warehouseModalVisible}
        onCancel={() => setWarehouseModalVisible(false)}
        onOk={handleWarehouseSubmit}
        confirmLoading={submitting}
        okText="Lưu Kho"
        cancelText="Hủy"
      >
        <Form form={warehouseForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên kho hàng" rules={[{ required: true, message: 'Vui lòng nhập tên kho' }]}>
            <Input placeholder="VD: Kho chính Hóc Môn, Kho xưởng Bình Tân..." />
          </Form.Item>
          <Form.Item name="location" label="Địa chỉ kho">
            <Input placeholder="VD: Số 10 Đường số 1, Q.Bình Tân, TP.HCM..." />
          </Form.Item>
          <Form.Item name="is_active" valuePropName="checked" label="Trạng thái hoạt động">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Modal Transaction (Nhập kho / Điều chỉnh) ──────────────────── */}
      <Modal
        title={<Text strong style={{ fontSize: 18 }}>Tạo Phiếu Nhập / Điều Chỉnh Kho</Text>}
        open={txnModalVisible}
        onCancel={() => setTxnModalVisible(false)}
        onOk={handleTxnSubmit}
        confirmLoading={submitting}
        okText="Tạo Phiếu Kho"
        cancelText="Hủy"
      >
        <Form form={txnForm} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Loại giao dịch" rules={[{ required: true }]}>
                <Select>
                  <Option value="import">Nhập kho (+)</Option>
                  <Option value="adjust">Điều chỉnh kiểm kê (=)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warehouse" label="Kho hàng" rules={[{ required: true, message: 'Chọn kho' }]}>
                <Select placeholder="Chọn kho...">
                  {warehouses.map((w) => (
                    <Option key={w.id} value={w.id}>{w.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="product" label="Sản phẩm" rules={[{ required: true, message: 'Chọn sản phẩm' }]}>
                <Select showSearch optionFilterProp="children" placeholder="Chọn sản phẩm...">
                  {products.map((p) => (
                    <Option key={p.id} value={p.id}>{p.name} ({p.sku})</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity" label="Số lượng" rules={[{ required: true, message: 'Nhập số lượng' }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_cost" label="Đơn giá nhập (VNĐ)">
                <InputNumber min={0} step={10000} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={(v) => v.replace(/\$\s?|(,*)/g, '')} />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="note" label="Ghi chú phiếu kho">
                <Input placeholder="VD: Nhập lô hàng từ nhà cung cấp Xingfa Aluminium..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  )
}
