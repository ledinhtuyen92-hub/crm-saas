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
  MinusOutlined,
  PictureOutlined,
  PlusOutlined,
  PrinterOutlined,
  SearchOutlined,
  ShopOutlined,
  TagOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  Alert,
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
import ProductTemplateTab from './inventory/ProductTemplateTab'
import TransactionPrintView from '../components/TransactionPrintView'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

export default function Inventory() {
  const { isCompanyAdmin, hasPermission, checkMaintenance, user } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  const [activeTab, setActiveTab] = useState('stock')

  // Data states
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [stockLevels, setStockLevels] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [stockSearchText, setStockSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [txnSearchText, setTxnSearchText] = useState('')
  const [txnTypeFilter, setTxnTypeFilter] = useState('')
  const [txnStatusFilter, setTxnStatusFilter] = useState('')
  const [txnWarehouseFilter, setTxnWarehouseFilter] = useState('')

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

  const [transferModalVisible, setTransferModalVisible] = useState(false)
  const [deletingWarehouse, setDeletingWarehouse] = useState(null)
  const [targetWarehouseId, setTargetWarehouseId] = useState(null)

  const [txnModalVisible, setTxnModalVisible] = useState(false)
  const [txnModalMode, setTxnModalMode] = useState('import')
  const [txnForm] = Form.useForm()

  const [exportApproveModalVisible, setExportApproveModalVisible] = useState(false)
  const [selectedExportTxn, setSelectedExportTxn] = useState(null)
  const [approveWarehouseId, setApproveWarehouseId] = useState(null)

  const [clearTxnModalVisible, setClearTxnModalVisible] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')

  const [selectedTxnForPrint, setSelectedTxnForPrint] = useState(null)

  const [submitting, setSubmitting] = useState(false)

  // Permissions
  const canCreate = hasPermission('inventory.create')
  const canEdit = hasPermission('inventory.edit')
  const canDelete = hasPermission('inventory.delete')
  const canManualExport = hasPermission('inventory.manual_export')

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
    else if (activeTab === 'stock') {
      fetchStockLevels()
      if (products.length === 0) fetchProducts()
    }
    else if (activeTab === 'transactions' || activeTab === 'pending_exports') {
      fetchTransactions()
      if (products.length === 0) fetchProducts()
    }
  }, [activeTab, fetchProducts, fetchCategories, fetchStockLevels, fetchTransactions, products.length])

  // ── Filtered Products ─────────────────────────────────────────────────
  const filteredProducts = products.filter((item) => {
    if (!searchText) return true
    const name = (item.name || '').toLowerCase()
    const sku = (item.sku || '').toLowerCase()
    const query = searchText.toLowerCase()
    return name.includes(query) || sku.includes(query)
  })

  // ── Filtered Stock Levels ─────────────────────────────────────────────
  const filteredStockLevels = stockLevels.filter((stk) => {
    if (!stockSearchText.trim()) return true
    const kw = stockSearchText.trim().toLowerCase()
    const prod = products.find((p) => p.id === stk.product)
    const name = (prod?.name || stk.product_name || '').toLowerCase()
    const sku = (prod?.sku || stk.product_sku || '').toLowerCase()
    return name.includes(kw) || sku.includes(kw)
  })

  // ── Filtered Transactions ─────────────────────────────────────────────
  const filteredTransactions = transactions.filter((txn) => {
    // Ẩn lệnh chờ duyệt khỏi tab Lịch sử nếu người dùng không chủ động lọc theo 'pending'
    if (!txnStatusFilter && txn.status === 'pending') return false

    let match = true
    if (txnTypeFilter) {
      match = match && txn.type === txnTypeFilter
    }
    if (txnStatusFilter) {
      match = match && txn.status === txnStatusFilter
    }
    if (txnWarehouseFilter) {
      match = match && txn.warehouse === txnWarehouseFilter
    }
    if (txnSearchText.trim()) {
      const kw = txnSearchText.trim().toLowerCase()
      const code = (txn.transaction_code || '').toLowerCase()
      const prod = products.find((p) => p.id === txn.product)
      const name = (prod?.name || txn.product_name || '').toLowerCase()
      const sku = (prod?.sku || txn.product_sku || '').toLowerCase()
      match = match && (code.includes(kw) || name.includes(kw) || sku.includes(kw))
    }
    return match
  })

  const pendingExports = transactions.filter((txn) => txn.type === 'export' && txn.status === 'pending')

  const handleOpenApproveExport = (txn) => {
    setSelectedExportTxn(txn)
    setApproveWarehouseId(null)
    setExportApproveModalVisible(true)
  }

  const handleApproveExport = async () => {
    if (!approveWarehouseId) {
      messageApi.error('Vui lòng chọn kho xuất hàng.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/inventory/transactions/${selectedExportTxn.id}/approve/`, { warehouse_id: approveWarehouseId })
      messageApi.success('Duyệt xuất kho thành công!')
      setExportApproveModalVisible(false)
      fetchTransactions()
      fetchStockLevels()
    } catch (err) {
      messageApi.error(err.response?.data?.detail || 'Không đủ tồn kho hoặc lỗi hệ thống.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRejectExport = async (id) => {
    try {
      await api.post(`/inventory/transactions/${id}/reject/`)
      messageApi.success('Đã từ chối lệnh xuất kho.')
      fetchTransactions()
    } catch (err) {
      messageApi.error('Từ chối thất bại.')
    }
  }

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

  const handleWarehouseDelete = async (id) => {
    if (checkMaintenance()) return
    try {
      await api.delete(`/inventory/warehouses/${id}/`)
      messageApi.success('Đã xoá kho hàng thành công.')
      fetchWarehouses()
      fetchStockLevels()
    } catch (error) {
      if (error.response?.data?.has_stock) {
        const wh = warehouses.find((w) => w.id === id)
        setDeletingWarehouse(wh || { id, name: `Kho #${id}` })
        setTargetWarehouseId(null)
        setTransferModalVisible(true)
      } else {
        messageApi.error(error.response?.data?.detail || 'Không thể xoá kho hàng này vì đang có sản phẩm tồn kho.')
      }
    }
  }

  const handleConfirmTransferAndDelete = async () => {
    if (checkMaintenance()) return
    if (!targetWarehouseId) {
      messageApi.warning('Vui lòng chọn kho nhận sản phẩm!')
      return
    }
    if (!deletingWarehouse) return
    setSubmitting(true)
    try {
      await api.delete(`/inventory/warehouses/${deletingWarehouse.id}/?target_warehouse_id=${targetWarehouseId}`)
      messageApi.success('Đã chuyển toàn bộ sản phẩm sang kho mới và xoá kho thành công!')
      setTransferModalVisible(false)
      setDeletingWarehouse(null)
      fetchWarehouses()
      fetchStockLevels()
      fetchTransactions()
    } catch (err) {
      messageApi.error(err.response?.data?.detail || 'Chuyển kho và xoá thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmClearAllTxn = async () => {
    if (checkMaintenance()) return
    if (clearConfirmText !== 'XOA TOAN BO') {
      messageApi.error('Xác nhận không hợp lệ. Vui lòng nhập đúng: XOA TOAN BO')
      return
    }
    setSubmitting(true)
    try {
      const res = await api.delete('/inventory/transactions/clear-history/')
      messageApi.success(res.data?.detail || 'Đã xoá toàn bộ lịch sử giao dịch kho.')
      setClearTxnModalVisible(false)
      setClearConfirmText('')
      fetchTransactions()
    } catch {
      messageApi.error('Không thể xoá toàn bộ lịch sử giao dịch.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Transaction (Nhập kho / Điều chỉnh / Xuất kho) Handlers ──────────────────────
  const openTxnModal = (defaultType = 'import') => {
    if (checkMaintenance()) return
    txnForm.resetFields()
    setTxnModalMode(defaultType)
    txnForm.setFieldsValue({ type: defaultType, quantity: 1, unit_cost: 0 })
    setTxnModalVisible(true)
  }

  const handlePrintTxn = (txn) => {
    setSelectedTxnForPrint(txn)
    setTimeout(() => {
      const contentEl = document.querySelector('.printable-transaction-content')
      if (!contentEl) {
        window.print()
        return
      }

      const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((el) => el.outerHTML)
        .join('\n')

      const printWin = window.open('', '_blank', 'width=1180,height=850')
      if (!printWin) {
        window.print()
        return
      }

      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${txn.transaction_code}</title>
          ${styleTags}
          <style>
            @media print {
              body, html, .printable-transaction-content {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .printable-transaction-content {
                width: 794px !important; /* A4 width */
                max-width: 100% !important;
                height: auto !important;
                margin: 0 auto !important;
              }
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
            }
          </style>
        </head>
        <body>
          ${contentEl.outerHTML}
          <script>
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          </script>
        </body>
        </html>
      `)
      printWin.document.close()
    }, 100)
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
      console.error(error.response?.data)
      const errDetail = error.response?.data ? JSON.stringify(error.response.data) : 'Tạo phiếu kho thất bại.'
      messageApi.error(errDetail)
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
          <Text strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{val || r.template_name || 'Sản phẩm'}</Text>
          {r.attributes && Object.keys(r.attributes).length > 0 && (
            <Space size={[0, 4]} wrap style={{ marginTop: 4, marginBottom: 4 }}>
              {Object.entries(r.attributes).map(([k, v]) => (
                <Tag key={k} color="purple">{k}: {v}</Tag>
              ))}
            </Space>
          )}
          {r.description && <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{r.description}</Text>}
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
  const pendingTxnColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'transaction_code',
      key: 'transaction_code',
      render: (val) => <Tag color="purple" style={{ fontWeight: 600 }}>{val}</Tag>,
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
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'center',
      render: (v, r) => (
        <Text strong style={{ color: '#0f172a' }}>
          {v} {products.find(p => p.id === r.product)?.unit || 'cái'}
        </Text>
      ),
    },
    {
      title: 'Ghi chú',
      dataIndex: 'note',
      key: 'note',
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'right',
      render: (_, record) => (
        <Space>
          {(isCompanyAdmin || hasPermission('inventory.approve_export')) && (
            <Button
              type="primary"
              size="small"
              icon={<CheckCircleOutlined />}
              onClick={() => handleOpenApproveExport(record)}
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
            >
              Duyệt xuất
            </Button>
          )}
          {(isCompanyAdmin || hasPermission('inventory.approve_export')) && (
            <Popconfirm
              title="Từ chối lệnh xuất?"
              onConfirm={() => handleRejectExport(record.id)}
              okText="Từ chối"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button danger size="small" icon={<CloseCircleOutlined />}>Từ chối</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  const txnColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'transaction_code',
      key: 'transaction_code',
      render: (val) => <Tag color="purple" style={{ fontWeight: 600 }}>{val}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status_display',
      key: 'status',
      render: (val, r) => {
        if (r.status === 'pending') return <Tag color="warning">{val || 'Chờ duyệt'}</Tag>
        if (r.status === 'rejected') return <Tag color="default">{val || 'Đã hủy'}</Tag>
        return <Tag color="success">{val || 'Hoàn thành'}</Tag>
      },
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
    {
      title: 'Thao tác',
      key: 'action',
      align: 'right',
      render: (_, r) => (
        <Button
          type="text"
          icon={<PrinterOutlined />}
          onClick={() => handlePrintTxn(r)}
          title="In phiếu"
        />
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
            <DatabaseOutlined style={{ color: '#0284c7', marginRight: 10 }} />
            Quản lý Kho Vận
          </Title>
          <Text type="secondary">
            Kiểm soát tồn kho theo thời gian thực và lịch sử biến động kho.
          </Text>
        </Col>
        <Col>
          <Space>

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
                onClick={() => openTxnModal('import')}
                style={{ background: '#16a34a', fontWeight: 600, borderRadius: 8 }}
              >
                Tạo Phiếu Nhập / Điều Chỉnh
              </Button>
            )}
            {activeTab === 'transactions' && canManualExport && (
              <Button
                type="primary"
                icon={<MinusOutlined />}
                onClick={() => openTxnModal('export')}
                style={{ background: '#ea580c', fontWeight: 600, borderRadius: 8, marginLeft: 8 }}
              >
                Tạo Phiếu Xuất Kho
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
                    <Col xs={24} sm={9}>
                      <Input
                        placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
                        prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                        value={stockSearchText}
                        onChange={(e) => setStockSearchText(e.target.value)}
                        allowClear
                        style={{ borderRadius: 8 }}
                      />
                    </Col>
                    <Col xs={24} sm={8}>
                      <Select
                        placeholder="Lọc theo kho hàng..."
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
                    <Col xs={24} sm={7} style={{ textAlign: 'right' }}>
                      <Space>
                        <Text strong style={{ color: lowStockOnly ? '#dc2626' : 'inherit' }}>Chỉ hiện tồn kho báo động:</Text>
                        <Switch checked={lowStockOnly} onChange={setLowStockOnly} />
                      </Space>
                    </Col>
                  </Row>
                  <Table
                    columns={stockColumns}
                    dataSource={filteredStockLevels}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 800 }}
                  />
                </div>
              ),
            },
            {
              key: 'pending_exports',
              label: (
                <Space>
                  <AlertOutlined style={{ color: '#d97706' }} />
                  <span style={{ color: '#d97706' }}>Lệnh Xuất Chờ Duyệt</span>
                  {pendingExports.length > 0 && <Tag color="red">{pendingExports.length}</Tag>}
                </Space>
              ),
              children: (
                <div>
                  <Table
                    columns={pendingTxnColumns}
                    dataSource={pendingExports}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 800 }}
                  />
                </div>
              )
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
                <div>
                  <Row gutter={16} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
                    <Col xs={24} lg={18}>
                      <Space wrap>
                        <Input
                          placeholder="Tìm mã phiếu, tên/mã SP..."
                          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                          value={txnSearchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          allowClear
                          style={{ borderRadius: 8, minWidth: 250 }}
                        />
                        <Select
                          placeholder="Loại phiếu"
                          value={txnTypeFilter || undefined}
                          onChange={(val) => setTxnTypeFilter(val || '')}
                          allowClear
                          style={{ minWidth: 150 }}
                        >
                          <Option value="import">Nhập kho</Option>
                          <Option value="export">Xuất kho</Option>
                          <Option value="adjust">Điều chỉnh</Option>
                        </Select>
                        <Select
                          placeholder="Trạng thái"
                          value={txnStatusFilter || undefined}
                          onChange={(val) => setTxnStatusFilter(val || '')}
                          allowClear
                          style={{ minWidth: 130 }}
                        >
                          <Option value="completed">Hoàn thành</Option>
                          <Option value="pending">Chờ duyệt</Option>
                          <Option value="rejected">Đã hủy</Option>
                        </Select>
                        <Select
                          placeholder="Chọn kho hàng..."
                          value={txnWarehouseFilter || undefined}
                          onChange={(val) => setTxnWarehouseFilter(val || '')}
                          allowClear
                          style={{ minWidth: 180 }}
                        >
                          {warehouses.map((w) => (
                            <Option key={w.id} value={w.id}>{w.name}</Option>
                          ))}
                        </Select>
                      </Space>
                    </Col>
                    {canDelete && transactions.length > 0 && (
                      <Col xs={24} lg={6} style={{ textAlign: 'right', marginTop: window.innerWidth < 992 ? 16 : 0 }}>
                        <Button
                          danger
                          type="primary"
                          icon={<DeleteOutlined />}
                          style={{ fontWeight: 600, borderRadius: 8 }}
                          onClick={() => {
                            if (checkMaintenance()) return
                            setClearConfirmText('')
                            setClearTxnModalVisible(true)
                          }}
                        >
                          Xoá Toàn Bộ Lịch Sử ({transactions.length})
                        </Button>
                      </Col>
                    )}
                  </Row>
                  <Table
                    columns={txnColumns}
                    dataSource={filteredTransactions}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                    scroll={{ x: 1050 }}
                  />
                </div>
              ),
            },
            {
              key: 'warehouses',
              label: (
                <Space>
                  <ShopOutlined />
                  <span>Danh Sách Kho Hàng ({warehouses.length})</span>
                </Space>
              ),
              children: (
                <div>
                  {canCreate && (
                    <Row justify="end" style={{ marginBottom: 16 }}>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => openWarehouseModal()}
                        style={{ background: '#4f46e5', fontWeight: 600, borderRadius: 8 }}
                      >
                        + Thêm Kho Hàng Mới
                      </Button>
                    </Row>
                  )}
                  <Table
                    dataSource={warehouses}
                    rowKey="id"
                    columns={[
                      { title: 'Tên kho hàng', dataIndex: 'name', key: 'name', render: (v) => <Text strong style={{ fontSize: 15 }}>{v}</Text> },
                      { title: 'Vị trí / Địa chỉ', dataIndex: 'location', key: 'location', render: (v) => <Text type="secondary">{v || '—'}</Text> },
                      {
                        title: 'Trạng thái',
                        dataIndex: 'is_active',
                        key: 'is_active',
                        render: (v) => (v !== false ? <Tag color="success">Hoạt động</Tag> : <Tag color="default">Ngừng hoạt động</Tag>),
                      },
                      {
                        title: 'Hành động',
                        key: 'action',
                        align: 'right',
                        render: (_, r) => (
                          <Space>
                            {canEdit && (
                              <Button
                                type="text"
                                icon={<EditOutlined style={{ color: '#d97706' }} />}
                                onClick={() => openWarehouseModal(r)}
                                title="Sửa kho hàng"
                              />
                            )}
                            {canDelete && (
                              <Popconfirm
                                title="Xoá kho hàng?"
                                description="Bạn có chắc chắn muốn xoá kho hàng này không?"
                                onConfirm={() => handleWarehouseDelete(r.id)}
                                okText="Xoá"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button type="text" danger icon={<DeleteOutlined />} title="Xoá kho hàng" />
                              </Popconfirm>
                            )}
                          </Space>
                        ),
                      },
                    ]}
                    pagination={{ pageSize: 10 }}
                  />
                </div>
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
        title={<Text strong style={{ fontSize: 18 }}>{txnModalMode === 'export' ? 'Tạo Phiếu Xuất Kho' : 'Tạo Phiếu Nhập / Điều Chỉnh Kho'}</Text>}
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
                <Select placeholder="Chọn loại giao dịch" disabled={txnModalMode === 'export'}>
                  {txnModalMode === 'export' ? (
                    <Option value="export">Xuất kho (-)</Option>
                  ) : (
                    <>
                      <Option value="import">Nhập kho (+)</Option>
                      <Option value="adjust">Điều chỉnh (+/-)</Option>
                    </>
                  )}
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

      {/* ── Modal Chuyển Tồn Kho Trước Khi Xóa Kho ────────────────────────── */}
      <Modal
        title={
          <Space>
            <AlertOutlined style={{ color: '#d97706' }} />
            <Text strong style={{ fontSize: 17 }}>Chuyển Sản Phẩm & Xóa Kho Hàng</Text>
          </Space>
        }
        open={transferModalVisible}
        onCancel={() => {
          setTransferModalVisible(false)
          setDeletingWarehouse(null)
          setTargetWarehouseId(null)
        }}
        onOk={handleConfirmTransferAndDelete}
        confirmLoading={submitting}
        okText="Xác nhận chuyển kho & Xoá"
        okButtonProps={{ danger: true }}
        cancelText="Hủy"
        width={550}
      >
        <div style={{ marginTop: 12 }}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <span>
                Kho hàng <Text strong>{deletingWarehouse?.name}</Text> hiện đang chứa sản phẩm tồn kho.
              </span>
            }
            description="Để bảo toàn dữ liệu tồn kho, bạn bắt buộc phải chọn một kho hàng khác để chuyển toàn bộ sản phẩm sang trước khi xoá kho này."
          />
          <Form layout="vertical">
            <Form.Item
              label={<Text strong>Chọn kho nhận toàn bộ sản phẩm</Text>}
              required
            >
              <Select
                placeholder="Chọn kho đích nhận sản phẩm..."
                value={targetWarehouseId}
                onChange={setTargetWarehouseId}
                style={{ width: '100%' }}
                size="large"
              >
                {warehouses
                  .filter((w) => w.id !== deletingWarehouse?.id && w.is_active !== false)
                  .map((w) => (
                    <Option key={w.id} value={w.id}>
                      {w.name} {w.location ? `(${w.location})` : ''}
                    </Option>
                  ))}
              </Select>
            </Form.Item>
          </Form>
        </div>
      </Modal>

      {/* ── Clear Transaction History Modal ── */}
      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: '#dc2626' }} />
            <span style={{ color: '#dc2626' }}>Cảnh báo: Xoá toàn bộ lịch sử giao dịch</span>
          </Space>
        }
        open={clearTxnModalVisible}
        onCancel={() => {
          setClearTxnModalVisible(false)
          setClearConfirmText('')
        }}
        onOk={handleConfirmClearAllTxn}
        okText="Xác nhận Xoá toàn bộ"
        cancelText="Huỷ"
        okButtonProps={{
          danger: true,
          disabled: clearConfirmText !== 'XOA TOAN BO',
          loading: submitting,
        }}
      >
        <div style={{ padding: '8px 0' }}>
          <Text type="danger" style={{ display: 'block', marginBottom: 12, fontWeight: 500 }}>
            Hành động này sẽ xoá vĩnh viễn toàn bộ lịch sử nhập/xuất/điều chỉnh kho của công ty. Bạn KHÔNG THỂ khôi phục lại dữ liệu sau khi xoá.
          </Text>
          <Text style={{ display: 'block', marginBottom: 8 }}>
            Để xác nhận, vui lòng nhập chính xác dòng chữ: <strong>XOA TOAN BO</strong> vào ô bên dưới:
          </Text>
          <Input
            value={clearConfirmText}
            onChange={(e) => setClearConfirmText(e.target.value)}
            placeholder="XOA TOAN BO"
            style={{ fontWeight: 'bold', color: '#dc2626' }}
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal Approve Export */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#16a34a' }} />
            <Text strong style={{ fontSize: 18 }}>Duyệt Xuất Kho</Text>
          </Space>
        }
        open={exportApproveModalVisible}
        onCancel={() => setExportApproveModalVisible(false)}
        onOk={handleApproveExport}
        confirmLoading={submitting}
        okText="Xác nhận duyệt"
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#16a34a', borderColor: '#16a34a' } }}
      >
        {selectedExportTxn && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message={selectedExportTxn.note || "Vui lòng chọn kho để trừ số lượng sản phẩm này."}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text type="secondary">Sản phẩm cần xuất:</Text>
                <div>
                  <Text strong style={{ fontSize: 16 }}>{selectedExportTxn.product_name}</Text>
                  <Tag color="blue" style={{ marginLeft: 8 }}>SKU: {selectedExportTxn.product_sku}</Tag>
                </div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Số lượng cần xuất:</Text>
                <div>
                  <Text strong style={{ fontSize: 18, color: '#dc2626' }}>{selectedExportTxn.quantity}</Text> {products.find(p => p.id === selectedExportTxn.product)?.unit}
                </div>
              </Col>
              <Col span={24}>
                <Text type="secondary">Chọn Kho để xuất hàng:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="--- Chọn kho ---"
                  value={approveWarehouseId}
                  onChange={setApproveWarehouseId}
                >
                  {warehouses.map(w => {
                    const stock = stockLevels.find(s => s.warehouse === w.id && s.product === selectedExportTxn.product)
                    const qty = stock ? stock.quantity : 0
                    const isEnough = qty >= selectedExportTxn.quantity
                    return (
                      <Option key={w.id} value={w.id} disabled={!isEnough}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{w.name}</span>
                          <span style={{ color: isEnough ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            Tồn: {qty} {isEnough ? '' : '(Không đủ)'}
                          </span>
                        </div>
                      </Option>
                    )
                  })}
                </Select>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Hidden Print Container */}
      {selectedTxnForPrint && (
        <div style={{ display: 'none' }}>
          <TransactionPrintView
            transaction={selectedTxnForPrint}
            company={user?.company}
          />
        </div>
      )}

    </div>
  )
}
