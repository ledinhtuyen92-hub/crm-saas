import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Row,
  Col,
  Input,
  Select,
  Modal,
  Form,
  DatePicker,
  message,
  Drawer,
} from 'antd'
import { CarOutlined, SearchOutlined, EditOutlined, EyeOutlined, PlusOutlined, DeleteOutlined, UserAddOutlined, FileTextOutlined, PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'
import QuotationPrintView from '../components/QuotationPrintView'

const { Title, Text } = Typography
const { Option } = Select

const statusConfig = {
  pending: { label: 'Chờ giao hàng', color: 'orange' },
  in_transit: { label: 'Đang giao', color: 'blue' },
  delivered: { label: 'Giao thành công', color: 'green' },
  failed: { label: 'Giao thất bại', color: 'red' },
}

export default function DeliveryList() {
  const { checkMaintenance, hasPermission } = useAuth()
  const [deliveries, setDeliveries] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)

  const [modalVisible, setModalVisible] = useState(false)
  const [editingDelivery, setEditingDelivery] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [availableOrders, setAvailableOrders] = useState([])

  const canEdit = hasPermission('delivery.edit')
  const canCreate = hasPermission('delivery.edit') // Reuse edit permission for simplicity or use delivery.create if exists
  const canDelete = hasPermission('delivery.delete')
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false)
  const [shippers, setShippers] = useState([])
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [assigningDelivery, setAssigningDelivery] = useState(null)
  const [selectedShipperId, setSelectedShipperId] = useState(null)
  
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [viewingOrder, setViewingOrder] = useState(null)
  const [activeTemplates, setActiveTemplates] = useState([])
  const [isPrinting, setIsPrinting] = useState(false)

  const fetchDataForForm = async () => {
    try {
      const resOrders = await api.get('/orders/orders/', { params: { limit: 100, status: 'approved' } })
      setAvailableOrders(Array.isArray(resOrders.data) ? resOrders.data : resOrders.data?.results ?? [])
      
      const resShippers = await api.get('/users/users/', { params: { role: 'shipper', limit: 100 } })
      setShippers(Array.isArray(resShippers.data) ? resShippers.data : resShippers.data?.results ?? [])

      const resTmpl = await api.get('/sales/quotation-templates/active/')
      setActiveTemplates(Array.isArray(resTmpl.data) ? resTmpl.data : resTmpl.data?.results ?? [])
    } catch {}
  }

  const getEffectiveTemplate = (order) => {
    if (order?.custom_data?.template_snapshot?.code) {
      return order.custom_data.template_snapshot
    }
    if (order?.quotation_detail?.custom_data?.template_snapshot?.code) {
      return order.quotation_detail.custom_data.template_snapshot
    }
    if (activeTemplates && activeTemplates.length > 0) {
      return activeTemplates.find(t => t.is_default) || activeTemplates[0]
    }
    return null
  }

  const fetchDeliveries = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (searchText) params.search = searchText
      const res = await api.get('/delivery/deliveries/', { params })
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setDeliveries(data)
    } catch {
      message.error('Lỗi khi tải danh sách giao hàng.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchText])

  useEffect(() => {
    fetchDeliveries()
    fetchDataForForm()
  }, [fetchDeliveries])

  const openModal = (record = null) => {
    if (checkMaintenance()) return
    setEditingDelivery(record)
    if (record) {
      form.setFieldsValue({
        order: record.order,
        status: record.status,
        shipper_name: record.shipper_name,
        shipper_phone: record.shipper_phone,
        shipping_address: record.shipping_address,
        expected_date: record.expected_date ? dayjs(record.expected_date) : null,
        actual_date: record.actual_date ? dayjs(record.actual_date) : null,
        notes: record.notes,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ status: 'pending' })
    }
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      const payload = {
        order: values.order,
        status: values.status,
        shipper_name: values.shipper_name,
        shipper_phone: values.shipper_phone,
        shipping_address: values.shipping_address,
        expected_date: values.expected_date ? values.expected_date.format('YYYY-MM-DD') : null,
        actual_date: values.actual_date ? values.actual_date.format('YYYY-MM-DD') : null,
        notes: values.notes,
      }
      if (editingDelivery) {
        await api.patch(`/delivery/deliveries/${editingDelivery.id}/`, payload)
        message.success('Cập nhật trạng thái giao hàng thành công!')
      } else {
        await api.post(`/delivery/deliveries/`, payload)
        message.success('Tạo Lệnh giao hàng thành công!')
      }
      setModalVisible(false)
      fetchDeliveries()
    } catch (error) {
      const data = error.response?.data
      let errorMsg = 'Có lỗi xảy ra khi lưu.'
      if (data) {
        if (Array.isArray(data.status)) errorMsg = data.status[0]
        else if (typeof data.status === 'string') errorMsg = data.status
        else if (data.detail) errorMsg = data.detail
        else if (Array.isArray(data.non_field_errors)) errorMsg = data.non_field_errors[0]
        else if (Array.isArray(data.order)) errorMsg = data.order[0]
        else if (Object.values(data).length > 0 && Array.isArray(Object.values(data)[0])) errorMsg = Object.values(data)[0][0]
        else if (typeof data === 'string') errorMsg = data
      }
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = (record) => {
    if (checkMaintenance()) return
    Modal.confirm({
      title: 'Xóa lệnh giao hàng',
      content: `Bạn có chắc chắn muốn xóa lệnh giao hàng ${record.delivery_code || `GH-${record.id}`} không?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await api.delete(`/delivery/deliveries/${record.id}/`)
          message.success('Đã xóa lệnh giao hàng!')
          fetchDeliveries()
        } catch {
          message.error('Lỗi khi xóa lệnh giao hàng.')
        }
      }
    })
  }

  const handleUpdateStatus = async (record, newStatus) => {
    if (checkMaintenance()) return
    setSubmitting(true)
    try {
      const payload = { status: newStatus }
      if (newStatus === 'delivered' && !record.actual_date) {
        payload.actual_date = dayjs().format('YYYY-MM-DD')
      }
      await api.patch(`/delivery/deliveries/${record.id}/`, payload)
      message.success('Cập nhật trạng thái thành công!')
      fetchDeliveries()
    } catch (error) {
      const data = error.response?.data
      let errorMsg = 'Có lỗi xảy ra khi cập nhật.'
      if (data) {
        if (Array.isArray(data.status)) errorMsg = data.status[0]
        else if (typeof data.status === 'string') errorMsg = data.status
        else if (data.detail) errorMsg = data.detail
        else if (Array.isArray(data.non_field_errors)) errorMsg = data.non_field_errors[0]
      }
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewOrder = async (record) => {
    if (checkMaintenance()) return
    try {
      const res = await api.get(`/orders/orders/${record.order}/`)
      setViewingOrder(res.data)
      setDrawerVisible(true)
    } catch {
      message.error('Không thể tải thông tin đơn hàng.')
    }
  }

  const handlePrintOrPDF = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 500)
  }

  const handleAssignShipper = async () => {
    if (!selectedShipperId) {
      message.error("Vui lòng chọn nhân viên giao hàng.")
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/delivery/deliveries/${assigningDelivery.id}/assign_shipper/`, {
        shipper_user_id: selectedShipperId
      })
      message.success('Gán nhân viên giao hàng thành công!')
      setAssignModalVisible(false)
      fetchDeliveries()
    } catch (error) {
      const data = error.response?.data
      let errorMsg = 'Lỗi khi gán nhân viên giao hàng.'
      if (data?.detail) errorMsg = data.detail
      else if (data && Object.values(data).length > 0 && Array.isArray(Object.values(data)[0])) errorMsg = Object.values(data)[0][0]
      message.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Mã GH',
      dataIndex: 'delivery_code',
      key: 'delivery_code',
      render: (v, r) => <Text strong style={{ color: '#0284c7' }}>{v || `GH-${r.id}`}</Text>,
    },
    {
      title: 'Đơn hàng',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      render: (_, r) => (
        <div>
          <Text strong>{r.customer_name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{r.customer_phone}</Text>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (st) => {
        const c = statusConfig[st] || { label: st, color: 'default' }
        return <Tag color={c.color}>{c.label}</Tag>
      },
    },
    {
      title: 'Giao hàng',
      key: 'shipper',
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.shipper_name ? (
            <>
              <div><Text strong>{r.shipper_name}</Text></div>
              <div>{r.shipper_phone}</div>
            </>
          ) : (
            <Text type="secondary">Chưa gán</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Thời gian',
      key: 'dates',
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          {r.expected_date && <div>Dự kiến: {dayjs(r.expected_date).format('DD/MM/YYYY')}</div>}
          {r.actual_date && <div style={{ color: '#16a34a' }}>Thực tế: {dayjs(r.actual_date).format('DD/MM/YYYY')}</div>}
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_, r) => (
        <Space>
          {canEdit && r.status === 'pending' && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<CarOutlined />}
              onClick={() => handleUpdateStatus(r, 'in_transit')}
            >
              Giao hàng
            </Button>
          )}
          {canEdit && r.status === 'in_transit' && (
            <>
              <Button
                size="small"
                style={{ color: '#16a34a', borderColor: '#16a34a' }}
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(r, 'delivered')}
              >
                Thành công
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleUpdateStatus(r, 'failed')}
              >
                Thất bại
              </Button>
            </>
          )}
          {canEdit && r.status === 'failed' && (
            <Button
              size="small"
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => handleUpdateStatus(r, 'pending')}
            >
              Giao lại
            </Button>
          )}
          {hasPermission('delivery.assign') && (
            <Button
              type="text"
              style={{ color: '#10b981' }}
              icon={<UserAddOutlined />}
              title="Gán nhân viên giao hàng"
              onClick={() => {
                setAssigningDelivery(r)
                setSelectedShipperId(r.shipper_user)
                setAssignModalVisible(true)
              }}
            />
          )}
          <Button
            type="text"
            style={{ color: '#0284c7' }}
            icon={<FileTextOutlined />}
            title="Xem chi tiết đơn hàng"
            onClick={() => handleViewOrder(r)}
          />
          <Button
            type="text"
            icon={canEdit ? <EditOutlined /> : <EyeOutlined />}
            onClick={() => openModal(r)}
          />
          {canDelete && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(r)}
            />
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <CarOutlined style={{ marginRight: 8, color: '#f59e0b' }} />
          Quản lý Giao hàng
        </Title>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} size="large" style={{ borderRadius: 8 }}>
            Tạo Giao Hàng Mới
          </Button>
        )}
      </Row>

      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Tìm kiếm mã GH, đơn hàng, người giao..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              style={{ width: '100%' }}
              placeholder="Lọc trạng thái"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
            >
              {Object.entries(statusConfig).map(([key, c]) => (
                <Option key={key} value={key}>{c.label}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Table scroll={{ x: 'max-content' }}
        dataSource={deliveries}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingDelivery ? (canEdit ? "Cập nhật Lệnh Giao hàng" : "Chi tiết Lệnh Giao hàng") : "Tạo Lệnh Giao Hàng Mới"}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !canEdit }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="order" label="Đơn hàng liên kết" rules={[{ required: !editingDelivery, message: 'Vui lòng chọn đơn hàng' }]}>
            <Select 
              disabled={!!editingDelivery || !canEdit} 
              placeholder="Chọn đơn hàng" 
              showSearch 
              optionFilterProp="children"
              onChange={(orderId) => {
                const order = availableOrders.find(o => o.id === orderId);
                if (order && order.customer_address) {
                  form.setFieldsValue({ shipping_address: order.customer_address });
                }
              }}
            >
              {availableOrders.map(o => (
                <Option key={o.id} value={o.id}>{o.order_number} - {o.customer_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="Trạng thái">
            <Select disabled={!canEdit}>
              {Object.entries(statusConfig).map(([key, c]) => (
                <Option key={key} value={key}>{c.label}</Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="shipper_name" label="Người giao hàng (Shipper)">
                <Input disabled={!canEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="shipper_phone" label="SĐT Shipper">
                <Input disabled={!canEdit} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="shipping_address" label="Địa chỉ giao hàng">
            <Input.TextArea rows={2} disabled={!canEdit} />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="expected_date" label="Ngày dự kiến">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={!canEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="actual_date" label="Ngày thực tế">
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={!canEdit} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} disabled={!canEdit} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Drawer View Order Details ──────────────────────────────────── */}
      <Drawer
        title={
          <Space>
            <PrinterOutlined style={{ color: '#10b981' }} />
            <Text strong>Chi tiết Đơn Hàng {viewingOrder?.order_number}</Text>
          </Space>
        }
        width={(() => {
          const et = getEffectiveTemplate(viewingOrder)
          return (et?.layout_config?.paper_orientation === 'landscape' || et?.code === 'production_landscape_a4') ? 1080 : 920
        })()}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        extra={
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrintOrPDF} style={{ background: '#10b981', borderColor: '#10b981' }}>
            In Đơn Hàng
          </Button>
        }
      >
        {viewingOrder && (
          <div>
            <div style={{ marginBottom: 24, border: '1px solid #e2e8f0', borderRadius: 8, padding: 16, background: '#fff', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
              <QuotationPrintView
                quotation={viewingOrder}
                type="order"
                effectiveTemplate={getEffectiveTemplate(viewingOrder)}
                isCompanyAdmin={isCompanyAdmin}
                products={[]}
              />
            </div>
            {isPrinting && (
              <style>{`
                @media print {
                  body * { visibility: hidden; }
                  .ant-drawer-body * { visibility: visible; }
                  .ant-drawer-body { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 100%;
                    padding: 0;
                  }
                  .ant-drawer-body > div > div:first-child {
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                  }
                }
              `}</style>
            )}
          </div>
        )}
      </Drawer>

      <Modal
        title="Gán nhân viên giao hàng"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        onOk={handleAssignShipper}
        confirmLoading={submitting}
      >
        <p>Lệnh giao hàng: <strong>{assigningDelivery?.delivery_code}</strong></p>
        <div style={{ marginBottom: 8 }}>Chọn nhân viên:</div>
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn nhân viên"
          value={selectedShipperId}
          onChange={setSelectedShipperId}
          showSearch
          optionFilterProp="children"
        >
          {shippers.map(u => (
            <Option key={u.id} value={u.id}>{u.full_name} ({u.email})</Option>
          ))}
        </Select>
      </Modal>
    </div>
  )
}
