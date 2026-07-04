import { useEffect, useState, useCallback } from 'react'
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from 'antd'
import {
  HistoryOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons'
import api from '../utils/api'
import { useAuth } from '../contexts/AuthContext'

const { Title, Text, Paragraph } = Typography
const { Option } = Select
const { TextArea } = Input

const STATUS_MAP = {
  new: { label: 'Mới (Lead)', color: 'blue' },
  potential: { label: 'Tiềm năng', color: 'cyan' },
  active: { label: 'Đang giao dịch', color: 'green' },
  lost: { label: 'Thất bại', color: 'red' },
  inactive: { label: 'Ngừng giao dịch', color: 'default' },
}

const SOURCE_MAP = {
  facebook: 'Facebook',
  zalo: 'Zalo',
  referral: 'Giới thiệu',
  walk_in: 'Khách tự đến',
  website: 'Website',
  other: 'Khác',
}

const SOURCE_ICON = {
  facebook: '📱',
  zalo: '💬',
  referral: '🤝',
  walk_in: '🚪',
  website: '🌐',
  other: '✏️',
}

const INTERACTION_TYPES = {
  call: { label: 'Cuộc gọi', color: 'blue' },
  meeting: { label: 'Gặp mặt', color: 'purple' },
  email: { label: 'Email', color: 'cyan' },
  zalo: { label: 'Zalo / Chat', color: 'green' },
  quotation: { label: 'Báo giá', color: 'orange' },
  care: { label: 'Chăm sóc định kỳ', color: 'magenta' },
}

const INTERACTION_RESULTS = {
  interested: { label: 'Quan tâm', color: 'success' },
  not_interested: { label: 'Không quan tâm', color: 'error' },
  need_follow_up: { label: 'Cần theo dõi thêm', color: 'warning' },
  closed: { label: 'Đã chốt', color: 'processing' },
}

function CustomerList() {
  const { isCompanyAdmin, hasPermission } = useAuth()
  const [customers, setCustomers] = useState([])
  const [salesUsers, setSalesUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modal Add / Edit Customer
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)

  // Modal Assign
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [assignTargetCustomer, setAssignTargetCustomer] = useState(null)
  const [selectedSaleId, setSelectedSaleId] = useState(null)
  const [assigning, setAssigning] = useState(false)

  // Drawer Details & Timeline
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [currentCustomer, setCurrentCustomer] = useState(null)
  const [contacts, setContacts] = useState([])
  const [interactions, setInteractions] = useState([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  // Modal Add Interaction
  const [interactionModalVisible, setInteractionModalVisible] = useState(false)
  const [interactionForm] = Form.useForm()
  const [submittingInteraction, setSubmittingInteraction] = useState(false)

  // Modal Add Contact
  const [contactModalVisible, setContactModalVisible] = useState(false)
  const [contactForm] = Form.useForm()
  const [submittingContact, setSubmittingContact] = useState(false)

  const fetchCustomers = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (searchQuery) params.search = searchQuery
      if (statusFilter) params.status = statusFilter

      const response = await api.get('/crm/customers/', { params })
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.results ?? []
      setCustomers(data)
    } catch {
      setError('Không thể tải danh sách khách hàng. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter])

  const fetchSalesUsers = useCallback(async () => {
    if (!isCompanyAdmin && !hasPermission('crm.assign')) return
    await Promise.resolve()
    try {
      const res = await api.get('/users/users/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setSalesUsers(data.filter((u) => u.is_active))
    } catch {
      // ignore
    }
  }, [isCompanyAdmin, hasPermission])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    fetchSalesUsers()
  }, [fetchSalesUsers])

  // ── Handlers: Add / Edit Customer ──────────────────────────────────
  const handleOpenAddModal = () => {
    setEditingCustomer(null)
    form.resetFields()
    form.setFieldsValue({ status: 'new', source: 'other' })
    setIsModalVisible(true)
  }

  const handleOpenEditModal = (record, e) => {
    e?.stopPropagation()
    setEditingCustomer(record)
    form.setFieldsValue({
      name: record.name,
      phone: record.phone,
      email: record.email,
      address: record.address,
      city: record.city,
      source: record.source || 'other',
      status: record.status || 'new',
      notes: record.notes,
    })
    setIsModalVisible(true)
  }

  const handleSaveCustomer = async (values) => {
    setSubmitting(true)
    try {
      if (editingCustomer) {
        await api.patch(`/crm/customers/${editingCustomer.id}/`, values)
        message.success('Cập nhật khách hàng thành công!')
      } else {
        await api.post('/crm/customers/', values)
        message.success('Thêm khách hàng thành công!')
      }
      setIsModalVisible(false)
      fetchCustomers()
    } catch (err) {
      const msg = err.response?.data?.phone?.[0] || err.response?.data?.detail || 'Có lỗi xảy ra, vui lòng kiểm tra lại.'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteCustomer = async (id, e) => {
    e?.stopPropagation()
    try {
      await api.delete(`/crm/customers/${id}/`)
      message.success('Đã xóa khách hàng.')
      fetchCustomers()
    } catch {
      message.error('Không thể xóa khách hàng này.')
    }
  }

  // ── Handlers: Assign Sale ──────────────────────────────────────────
  const handleOpenAssignModal = (record, e) => {
    e?.stopPropagation()
    setAssignTargetCustomer(record)
    setSelectedSaleId(record.assigned_to ? record.assigned_to.id : null)
    setAssignModalVisible(true)
  }

  const handleConfirmAssign = async () => {
    if (!selectedSaleId) {
      message.warning('Vui lòng chọn nhân viên Sale.')
      return
    }
    setAssigning(true)
    try {
      await api.post(`/crm/customers/${assignTargetCustomer.id}/assign/`, {
        assigned_to: selectedSaleId,
      })
      message.success('Phân công khách hàng thành công!')
      setAssignModalVisible(false)
      fetchCustomers()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Phân công thất bại.')
    } finally {
      setAssigning(false)
    }
  }

  const handleRoundRobinAssign = async () => {
    try {
      const res = await api.post('/crm/customers/round-robin-assign/')
      message.success(res.data.detail || 'Đã phân bổ tự động.')
      fetchCustomers()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Không thể thực hiện Round-robin.')
    }
  }

  // ── Handlers: Drawer Details & Timeline ────────────────────────────
  const handleOpenDrawer = async (record) => {
    setCurrentCustomer(record)
    setDrawerVisible(true)
    setLoadingDetails(true)
    try {
      const [contactRes, interactRes] = await Promise.all([
        api.get('/crm/contacts/', { params: { customer_id: record.id } }),
        api.get('/crm/interactions/', { params: { customer_id: record.id } }),
      ])
      setContacts(Array.isArray(contactRes.data) ? contactRes.data : contactRes.data?.results ?? [])
      setInteractions(Array.isArray(interactRes.data) ? interactRes.data : interactRes.data?.results ?? [])
    } catch {
      message.error('Không thể tải chi tiết khách hàng.')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleAddInteraction = async (values) => {
    setSubmittingInteraction(true)
    try {
      await api.post('/crm/interactions/', {
        ...values,
        customer: currentCustomer.id,
      })
      message.success('Đã ghi nhận lịch sử chăm sóc!')
      setInteractionModalVisible(false)
      interactionForm.resetFields()
      // reload interactions
      const res = await api.get('/crm/interactions/', { params: { customer_id: currentCustomer.id } })
      setInteractions(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch {
      message.error('Có lỗi khi lưu lịch sử chăm sóc.')
    } finally {
      setSubmittingInteraction(false)
    }
  }

  const handleAddContact = async (values) => {
    setSubmittingContact(true)
    try {
      await api.post('/crm/contacts/', {
        ...values,
        customer: currentCustomer.id,
      })
      message.success('Đã thêm đầu mối liên hệ!')
      setContactModalVisible(false)
      contactForm.resetFields()
      // reload contacts
      const res = await api.get('/crm/contacts/', { params: { customer_id: currentCustomer.id } })
      setContacts(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch {
      message.error('Có lỗi khi thêm đầu mối liên hệ.')
    } finally {
      setSubmittingContact(false)
    }
  }

  // ── Table Columns ──────────────────────────────────────────────────
  const columns = [
    {
      title: 'Khách hàng',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ color: '#1649c9', cursor: 'pointer' }}
            onClick={() => handleOpenDrawer(record)}
          >
            {text}
          </Text>
          {record.city && <Text type="secondary" style={{ fontSize: 12 }}>{record.city}</Text>}
        </Space>
      ),
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text><PhoneOutlined style={{ marginRight: 6, color: '#52c41a' }} />{record.phone}</Text>
          {record.email && <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>}
        </Space>
      ),
    },
    {
      title: 'Nguồn',
      key: 'source',
      render: (_, record) => {
        const sourceLabel = SOURCE_MAP[record.source] || record.source || '—'
        const sourceIcon = SOURCE_ICON[record.source] || '✏️'
        const creator = record.created_by?.full_name || record.created_by?.username
        return (
          <Space direction="vertical" size={0}>
            <Text>
              <span style={{ marginRight: 5 }}>{sourceIcon}</span>
              {sourceLabel}
            </Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {creator ? `👤 ${creator}` : 'Sale nhập tay'}
            </Text>
          </Space>
        )
      },
    },
    {
      title: 'Địa chỉ',
      key: 'address',
      render: (_, record) => {
        const parts = [record.address, record.city].filter(Boolean)
        return parts.length > 0
          ? <Text style={{ fontSize: 13 }}>{parts.join(', ')}</Text>
          : <Text type="secondary">Chưa có</Text>
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const item = STATUS_MAP[status] || { label: status, color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: 'Phụ trách (Sale)',
      key: 'assigned_to',
      render: (_, record) => {
        if (!record.assigned_to) {
          return <Text type="secondary" style={{ fontStyle: 'italic' }}>Chưa có nhân viên phụ trách</Text>
        }
        return (
          <Space size={6}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1649c9' }} />
            <Text>{record.assigned_to.full_name || record.assigned_to.username}</Text>
          </Space>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          {(isCompanyAdmin || hasPermission('crm.assign')) && (
            <Tooltip title="Phân công Sale">
              <Button
                size="small"
                icon={<UserSwitchOutlined />}
                onClick={(e) => handleOpenAssignModal(record, e)}
              />
            </Tooltip>
          )}
          {(isCompanyAdmin || hasPermission('crm.edit')) && (
            <Button size="small" onClick={(e) => handleOpenEditModal(record, e)}>
              Sửa
            </Button>
          )}
          {(isCompanyAdmin || hasPermission('crm.delete')) && (
            <Popconfirm
              title="Xóa khách hàng này?"
              onConfirm={(e) => handleDeleteCustomer(record.id, e)}
              onCancel={(e) => e?.stopPropagation()}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button size="small" danger onClick={(e) => e?.stopPropagation()}>
                Xóa
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ marginRight: 10, color: '#1649c9' }} />
            Quản lý Khách hàng & Leads
          </Title>
          <Text type="secondary">Theo dõi hành trình khách hàng từ Lead đến giao dịch</Text>
        </div>

        <Space>
          {isCompanyAdmin && (
            <Tooltip title="Tự động chia đều khách hàng chưa phân công cho Sale">
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRoundRobinAssign}
              >
                Phân bổ khách tự động
              </Button>
            </Tooltip>
          )}
          {(isCompanyAdmin || hasPermission('crm.add')) && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenAddModal}
              style={{ backgroundColor: '#1649c9' }}
            >
              Thêm khách hàng
            </Button>
          )}
        </Space>
      </div>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {/* Filter Bar */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={12} md={10}>
            <Input
              placeholder="Tìm theo tên hoặc số điện thoại..."
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Lọc theo trạng thái"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              allowClear
            >
              <Option value="">Tất cả trạng thái</Option>
              {Object.entries(STATUS_MAP).map(([key, item]) => (
                <Option key={key} value={key}>
                  <Badge color={item.color} text={item.label} />
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={6} style={{ textAlign: 'right' }}>
            <Button onClick={fetchCustomers} icon={<ReloadOutlined />}>
              Làm mới
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Table */}
      <Table
        columns={columns}
        dataSource={customers}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        onRow={(record) => ({
          onClick: () => handleOpenDrawer(record),
          style: { cursor: 'pointer' },
        })}
      />

      {/* Modal Add/Edit Customer */}
      <Modal
        title={editingCustomer ? 'Cập nhật Khách hàng' : 'Thêm Khách hàng mới'}
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Lưu thông tin"
        cancelText="Hủy"
        width={650}
      >
        <Form form={form} layout="vertical" onFinish={handleSaveCustomer}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Tên khách hàng / Công ty"
                rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}
              >
                <Input placeholder="VD: Công ty ABC hoặc Nguyễn Văn A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[{ required: true, message: 'Vui lòng nhập SĐT!' }]}
              >
                <Input placeholder="VD: 0901234567" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" placeholder="email@domain.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="Thành phố / Tỉnh">
                <Input placeholder="VD: TP. Hồ Chí Minh" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="Địa chỉ">
            <Input placeholder="Số nhà, đường, phường/xã..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="Nguồn khách hàng" initialValue="other">
                <Select placeholder="Chọn nguồn khách hàng">
                  {Object.entries(SOURCE_MAP).map(([key, label]) => (
                    <Option key={key} value={key}>
                      <Space size={6}>
                        <span>{SOURCE_ICON[key]}</span>
                        <span>{label}</span>
                      </Space>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Trạng thái quy trình (Pipeline)" initialValue="new">
                <Select>
                  {Object.entries(STATUS_MAP).map(([key, item]) => (
                    <Option key={key} value={key}>
                      <Badge color={item.color} text={item.label} />
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Ghi chú thêm">
            <TextArea rows={3} placeholder="Ghi chú về nhu cầu, đặc điểm khách hàng..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Assign Sale */}
      <Modal
        title={`Phân công Sale cho khách hàng: ${assignTargetCustomer?.name || ''}`}
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        onOk={handleConfirmAssign}
        confirmLoading={assigning}
        okText="Xác nhận phân công"
        cancelText="Hủy"
      >
        <div style={{ padding: '10px 0' }}>
          <Text style={{ display: 'block', marginBottom: 8 }}>Chọn nhân viên Sale phụ trách:</Text>
          <Select
            style={{ width: '100%' }}
            placeholder="Chọn nhân viên Sale"
            value={selectedSaleId}
            onChange={(val) => setSelectedSaleId(val)}
            showSearch
            optionFilterProp="children"
          >
            {salesUsers.map((u) => (
              <Option key={u.id} value={u.id}>
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <Text>{u.full_name || u.username}</Text>
                  <Text type="secondary">({u.email})</Text>
                </Space>
              </Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Drawer Details & Timeline */}
      <Drawer
        title={
          <Space>
            <TeamOutlined style={{ color: '#1649c9' }} />
            <Text strong>{currentCustomer?.name}</Text>
            {currentCustomer && (
              <Tag color={STATUS_MAP[currentCustomer.status]?.color || 'default'}>
                {STATUS_MAP[currentCustomer.status]?.label || currentCustomer.status}
              </Tag>
            )}
          </Space>
        }
        width={700}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {currentCustomer && (
          <Tabs
            defaultActiveKey="timeline"
            items={[
              {
                key: 'timeline',
                label: (
                  <span>
                    <HistoryOutlined /> Lịch sử chăm sóc ({interactions.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          interactionForm.resetFields()
                          interactionForm.setFieldsValue({ type: 'call', result: 'interested' })
                          setInteractionModalVisible(true)
                        }}
                      >
                        Ghi nhận tương tác
                      </Button>
                    </div>

                    {loadingDetails ? (
                      <Paragraph>Đang tải dữ liệu...</Paragraph>
                    ) : interactions.length === 0 ? (
                      <Alert message="Chưa có lịch sử chăm sóc nào được ghi nhận." type="info" />
                    ) : (
                      <Timeline
                        mode="left"
                        items={interactions.map((item) => ({
                          color: INTERACTION_TYPES[item.type]?.color || 'blue',
                          label: new Date(item.created_at).toLocaleString('vi-VN'),
                          children: (
                            <Card size="small" style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Tag color={INTERACTION_TYPES[item.type]?.color}>
                                  {INTERACTION_TYPES[item.type]?.label || item.type}
                                </Tag>
                                <Tag color={INTERACTION_RESULTS[item.result]?.color}>
                                  {INTERACTION_RESULTS[item.result]?.label || item.result}
                                </Tag>
                              </div>
                              <Paragraph style={{ margin: 0, whiteSpace: 'pre-line' }}>
                                {item.content}
                              </Paragraph>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                Thực hiện bởi: {item.created_by?.full_name || item.created_by?.username || 'Admin'}
                              </Text>
                            </Card>
                          ),
                        }))}
                      />
                    )}
                  </div>
                ),
              },
              {
                key: 'contacts',
                label: (
                  <span>
                    <UserAddOutlined /> Đầu mối liên hệ ({contacts.length})
                  </span>
                ),
                children: (
                  <div>
                    <div style={{ marginBottom: 16, textAlign: 'right' }}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          contactForm.resetFields()
                          setContactModalVisible(true)
                        }}
                      >
                        Thêm đầu mối
                      </Button>
                    </div>

                    <Table
                      dataSource={contacts}
                      rowKey="id"
                      pagination={false}
                      size="small"
                      columns={[
                        { title: 'Họ tên', dataIndex: 'name', key: 'name' },
                        { title: 'Chức vụ', dataIndex: 'position', key: 'position' },
                        { title: 'SĐT', dataIndex: 'phone', key: 'phone' },
                        { title: 'Email', dataIndex: 'email', key: 'email' },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: 'info',
                label: 'Thông tin chi tiết',
                children: (
                  <Form layout="vertical">
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Số điện thoại">
                          <Input value={currentCustomer.phone} readOnly />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Email">
                          <Input value={currentCustomer.email || '—'} readOnly />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Địa chỉ">
                      <Input value={currentCustomer.address || '—'} readOnly />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="Thành phố">
                          <Input value={currentCustomer.city || '—'} readOnly />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="Nguồn">
                          <Input value={SOURCE_MAP[currentCustomer.source] || currentCustomer.source || '—'} readOnly />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="Ghi chú">
                      <TextArea value={currentCustomer.notes || 'Không có ghi chú.'} rows={4} readOnly />
                    </Form.Item>
                  </Form>
                ),
              },
            ]}
          />
        )}
      </Drawer>

      {/* Modal Add Interaction */}
      <Modal
        title="Ghi nhận Lịch sử chăm sóc"
        open={interactionModalVisible}
        onCancel={() => setInteractionModalVisible(false)}
        onOk={() => interactionForm.submit()}
        confirmLoading={submittingInteraction}
        okText="Lưu lại"
        cancelText="Hủy"
      >
        <Form form={interactionForm} layout="vertical" onFinish={handleAddInteraction}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Hình thức tương tác" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(INTERACTION_TYPES).map(([key, item]) => (
                    <Option key={key} value={key}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="result" label="Kết quả đánh giá" rules={[{ required: true }]}>
                <Select>
                  {Object.entries(INTERACTION_RESULTS).map(([key, item]) => (
                    <Option key={key} value={key}>{item.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="content" label="Nội dung trao đổi / chi tiết" rules={[{ required: true, message: 'Vui lòng nhập nội dung!' }]}>
            <TextArea rows={4} placeholder="VD: Khách hàng hỏi giá chi tiết sản phẩm X, yêu cầu gửi báo giá qua email..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Add Contact */}
      <Modal
        title="Thêm Đầu mối liên hệ mới"
        open={contactModalVisible}
        onCancel={() => setContactModalVisible(false)}
        onOk={() => contactForm.submit()}
        confirmLoading={submittingContact}
        okText="Thêm mới"
        cancelText="Hủy"
      >
        <Form form={contactForm} layout="vertical" onFinish={handleAddContact}>
          <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập tên!' }]}>
            <Input placeholder="VD: Nguyễn Văn B" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="phone" label="Số điện thoại">
                <Input placeholder="090..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email">
                <Input type="email" placeholder="email@company.com" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="position" label="Chức vụ / Phòng ban">
            <Input placeholder="VD: Trưởng phòng Mua hàng" />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  )
}

export default CustomerList
