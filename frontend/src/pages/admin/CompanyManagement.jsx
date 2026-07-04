import {
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import api from '../../utils/api'

const { Title, Text } = Typography

export default function CompanyManagement() {
  const { token } = theme.useToken()
  const [messageApi, contextHolder] = message.useMessage()

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [form] = Form.useForm()

  // ── Fetch danh sách công ty ─────────────────────────────────────
  const fetchCompanies = useCallback(async () => {
    await Promise.resolve()
    setLoading(true)
    try {
      const { data } = await api.get('users/companies/')
      setCompanies(Array.isArray(data) ? data : data?.results ?? [])
    } catch {
      messageApi.error('Không thể tải danh sách công ty.')
    } finally {
      setLoading(false)
    }
  }, [messageApi])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // ── Mở modal tạo mới / chỉnh sửa ───────────────────────────────
  const openModal = (company = null) => {
    setEditingCompany(company)
    form.setFieldsValue(
      company
        ? {
            name: company.name,
            workspace_id: company.workspace_id,
            tax_code: company.tax_code,
            address: company.address,
            user_limit: company.user_limit ?? 15,
          }
        : { name: '', workspace_id: '', tax_code: '', address: '', user_limit: 15 },
    )
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editingCompany) {
        await api.patch(`users/companies/${editingCompany.id}/`, values)
        messageApi.success('Cập nhật công ty thành công.')
      } else {
        await api.post('users/companies/', values)
        messageApi.success('Tạo công ty thành công.')
      }
      setModalOpen(false)
      fetchCompanies()
    } catch (err) {
      const errors = err.response?.data
      if (errors && typeof errors === 'object') {
        const msgs = Object.values(errors).flat().join(' ')
        messageApi.error(msgs)
      } else {
        messageApi.error('Có lỗi xảy ra. Vui lòng thử lại.')
      }
    }
  }

  // ── Toggle trạng thái công ty ───────────────────────────────────
  const toggleActive = async (company) => {
    try {
      await api.patch(`users/companies/${company.id}/`, {
        is_active: !company.is_active,
      })
      messageApi.success(
        company.is_active
          ? `Đã khóa công ty "${company.name}".`
          : `Đã kích hoạt công ty "${company.name}".`,
      )
      fetchCompanies()
    } catch {
      messageApi.error('Không thể cập nhật trạng thái.')
    }
  }

  // ── Stats ────────────────────────────────────────────────────────
  const totalCompanies = companies.length
  const activeCompanies = companies.filter((c) => c.is_active).length
  const totalUsers = companies.reduce((sum, c) => sum + (c.user_count || 0), 0)

  // ── Columns ──────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Công ty',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600, color: token.colorText }}>{name}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            MST: {record.tax_code}
          </Text>
        </div>
      ),
    },
    {
      title: 'Workspace ID',
      dataIndex: 'workspace_id',
      key: 'workspace_id',
      render: (id) => (
        <Tag color="blue" style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
          {id}
        </Tag>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'owner_email',
      key: 'owner_email',
      render: (email) => email || <Text type="secondary">—</Text>,
    },
    {
      title: 'Gói / Hạn mức NS',
      key: 'user_limit_status',
      align: 'left',
      render: (_, record) => {
        const count = record.user_count || 0
        const limit = record.user_limit || 0
        const percent = limit > 0 ? Math.min(Math.round((count / limit) * 100), 100) : 0
        return (
          <div style={{ minWidth: 150 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: 600 }}>
                <TeamOutlined style={{ marginRight: 6, color: '#2563eb' }} />
                {count} / {limit > 0 ? `${limit} user` : '∞ VIP'}
              </Text>
              {limit > 0 && (
                <Tag
                  color={percent >= 100 ? 'error' : percent > 80 ? 'warning' : 'processing'}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {percent >= 100 ? 'Đã đầy' : `${percent}%`}
                </Tag>
              )}
            </div>
            {limit > 0 ? (
              <Progress
                percent={percent}
                status={percent >= 100 ? 'exception' : 'normal'}
                size="small"
                showInfo={false}
              />
            ) : (
              <Tag color="purple" style={{ margin: 0 }}>
                Không giới hạn
              </Tag>
            )}
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      key: 'is_active',
      align: 'center',
      render: (active) =>
        active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Hoạt động
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            Đã khóa
          </Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'center',
      render: (_, record) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Tooltip title={record.is_active ? 'Khóa công ty' : 'Kích hoạt'}>
            <Button
              type="text"
              danger={record.is_active}
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => toggleActive(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div id="company-management-page">
      {contextHolder}

      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: token.colorText }}>
            Quản lý Công ty
          </Title>
          <Text type="secondary">Danh sách tất cả công ty đang sử dụng hệ thống CRM SaaS</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => openModal()}
          style={{ background: '#1649c9' }}
          id="btn-add-company"
        >
          Thêm công ty
        </Button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[
          {
            title: 'Tổng công ty',
            value: totalCompanies,
            icon: <BankOutlined />,
            color: '#2563eb',
          },
          {
            title: 'Đang hoạt động',
            value: activeCompanies,
            icon: <CheckCircleOutlined />,
            color: '#16a34a',
          },
          {
            title: 'Tổng nhân viên',
            value: totalUsers,
            icon: <TeamOutlined />,
            color: '#7c3aed',
          },
        ].map((stat) => (
          <Col xs={24} sm={8} key={stat.title}>
            <Card
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 12px rgba(15,23,42,0.08)',
              }}
            >
              <Statistic
                title={
                  <Space>
                    <span style={{ color: stat.color }}>{stat.icon}</span>
                    <Text type="secondary">{stat.title}</Text>
                  </Space>
                }
                value={stat.value}
                valueStyle={{ color: stat.color, fontWeight: 700, fontSize: 32 }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Table ───────────────────────────────────────────────── */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 12px rgba(15,23,42,0.08)',
        }}
      >
        <Table
          id="company-table"
          columns={columns}
          dataSource={companies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} công ty` }}
        />
      </Card>

      {/* ── Modal Tạo / Sửa ────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <BankOutlined />
            <span>{editingCompany ? 'Chỉnh sửa công ty' : 'Thêm công ty mới'}</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={520}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          style={{ marginTop: 20 }}
        >
          <Form.Item
            name="name"
            label="Tên công ty"
            rules={[{ required: true, message: 'Vui lòng nhập tên công ty' }]}
          >
            <Input size="large" placeholder="Công ty TNHH An Phát" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="workspace_id"
                label="Workspace ID"
                tooltip="Mã định danh khi đăng nhập. Để trống để tự động tạo từ MST."
              >
                <Input
                  size="large"
                  placeholder="ANPHAT"
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tax_code"
                label="Mã số thuế"
                rules={[{ required: true, message: 'Vui lòng nhập MST' }]}
              >
                <Input size="large" placeholder="0123456789" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="address" label="Địa chỉ">
            <Input.TextArea rows={2} placeholder="Địa chỉ trụ sở..." />
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="user_limit"
                label="Gói / Giới hạn nhân viên"
                tooltip="Số lượng tài khoản tối đa công ty được phép tạo."
                rules={[{ required: true, message: 'Vui lòng chọn hạn mức' }]}
              >
                <Select size="large" placeholder="Chọn gói hạn mức">
                  <Select.Option value={5}>Gói Starter (5 user)</Select.Option>
                  <Select.Option value={15}>Gói Standard (15 user)</Select.Option>
                  <Select.Option value={30}>Gói Business (30 user)</Select.Option>
                  <Select.Option value={50}>Gói Professional (50 user)</Select.Option>
                  <Select.Option value={100}>Gói Enterprise (100 user)</Select.Option>
                  <Select.Option value={0}>Không giới hạn (0 / VIP)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="Số điện thoại">
                <Input size="large" placeholder="02438889999" />
              </Form.Item>
            </Col>
          </Row>

          {editingCompany && (
            <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
              <Switch
                checkedChildren="Hoạt động"
                unCheckedChildren="Đã khóa"
              />
            </Form.Item>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#1649c9' }}>
              {editingCompany ? 'Lưu thay đổi' : 'Tạo công ty'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
