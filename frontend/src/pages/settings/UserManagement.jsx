import {
  DeleteOutlined,
  EditOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  UnlockOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  theme,
} from 'antd'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../utils/api'

const { Title, Text } = Typography

// Màu avatar ngẫu nhiên theo tên
const avatarColors = ['#2563eb', '#7c3aed', '#dc2626', '#d97706', '#059669', '#0891b2']
function getAvatarColor(name) {
  const idx = (name?.charCodeAt(0) ?? 0) % avatarColors.length
  return avatarColors[idx]
}
function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export default function UserManagement() {
  const { token } = theme.useToken()
  const { user: currentUser } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()

  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [form] = Form.useForm()

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get('users/users/'),
        api.get('users/roles/'),
      ])
      setUsers(usersRes.data)
      setRoles(rolesRes.data)
    } catch {
      messageApi.error('Không thể tải dữ liệu nhân viên.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // ── Modal ─────────────────────────────────────────────────────────
  const openModal = (user = null) => {
    setEditingUser(user)
    form.setFieldsValue(
      user
        ? {
            full_name: user.full_name,
            email: user.email,
            username: user.username,
            phone: user.phone,
            job_title: user.job_title,
            role: user.role,
            is_active: user.is_active,
            is_company_admin: user.is_company_admin,
            password: '',
          }
        : {
            full_name: '',
            email: '',
            username: '',
            phone: '',
            job_title: '',
            role: undefined,
            is_active: true,
            is_company_admin: false,
            password: '',
          },
    )
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    const payload = { ...values }
    // Xóa password nếu để trống khi sửa
    if (!payload.password) delete payload.password

    try {
      if (editingUser) {
        await api.patch(`users/users/${editingUser.id}/`, payload)
        messageApi.success('Cập nhật nhân viên thành công.')
      } else {
        await api.post('users/users/', payload)
        messageApi.success('Tạo tài khoản nhân viên thành công.')
      }
      setModalOpen(false)
      fetchData()
    } catch (err) {
      const errors = err.response?.data
      if (errors && typeof errors === 'object') {
        messageApi.error(Object.values(errors).flat().join(' '))
      } else {
        messageApi.error('Có lỗi xảy ra.')
      }
    }
  }

  const toggleActive = async (user) => {
    try {
      await api.patch(`users/users/${user.id}/`, { is_active: !user.is_active })
      messageApi.success(user.is_active ? 'Đã khóa tài khoản.' : 'Đã kích hoạt tài khoản.')
      fetchData()
    } catch {
      messageApi.error('Không thể thay đổi trạng thái.')
    }
  }

  const handleDelete = (user) => {
    Modal.confirm({
      title: `Xóa tài khoản "${user.full_name}"?`,
      content: 'Hành động không thể hoàn tác. Mọi dữ liệu liên quan sẽ bị ảnh hưởng.',
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await api.delete(`users/users/${user.id}/`)
          messageApi.success('Đã xóa tài khoản.')
          fetchData()
        } catch {
          messageApi.error('Không thể xóa tài khoản này.')
        }
      },
    })
  }

  // ── Columns ───────────────────────────────────────────────────────
  const columns = [
    {
      title: 'Nhân viên',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar
            size={40}
            style={{
              background: `linear-gradient(135deg, ${getAvatarColor(record.full_name)} 0%, #1e3a8a 100%)`,
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {getInitials(record.full_name)}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: token.colorText }}>{record.full_name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              @{record.username}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 13 }}>
            <MailOutlined style={{ marginRight: 4, color: token.colorTextSecondary }} />
            {record.email}
          </div>
          {record.phone && (
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
              <PhoneOutlined style={{ marginRight: 4 }} />
              {record.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Chức danh',
      key: 'role',
      render: (_, record) => (
        <div>
          {record.role_name ? (
            <Tag color="purple" style={{ fontWeight: 600 }}>
              {record.role_name}
            </Tag>
          ) : (
            <Text type="secondary">Chưa gán vai trò</Text>
          )}
          {record.job_title && (
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
              {record.job_title}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Phân quyền',
      key: 'admin',
      align: 'center',
      render: (_, record) => (
        <div>
          {record.is_company_admin && (
            <Tag color="gold" style={{ fontWeight: 600 }}>
              Admin công ty
            </Tag>
          )}
          {!record.is_company_admin && (
            <Tag color="default">Nhân viên</Tag>
          )}
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      key: 'status',
      align: 'center',
      render: (_, record) =>
        record.is_active ? (
          <Tag color="success">Đang làm việc</Tag>
        ) : (
          <Tag color="error">Đã khóa</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const isSelf = record.id === currentUser?.id
        return (
          <Space>
            <Tooltip title="Chỉnh sửa">
              <Button type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
            </Tooltip>
            <Tooltip title={record.is_active ? 'Khóa tài khoản' : 'Mở khóa'}>
              <Button
                type="text"
                danger={record.is_active}
                icon={record.is_active ? <LockOutlined /> : <UnlockOutlined />}
                disabled={isSelf}
                onClick={() => toggleActive(record)}
              />
            </Tooltip>
            <Tooltip title={isSelf ? 'Không thể xóa chính mình' : 'Xóa'}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={isSelf}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          </Space>
        )
      },
    },
  ]

  return (
    <div id="user-management-page">
      {contextHolder}

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
          <Title level={2} style={{ margin: 0 }}>
            Quản lý Nhân viên
          </Title>
          <Text type="secondary">
            Tạo tài khoản, gán chức danh và phân quyền cho nhân viên trong công ty
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => openModal()}
          style={{ background: '#1649c9' }}
          id="btn-add-user"
        >
          Thêm nhân viên
        </Button>
      </div>

      <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
        <Table
          id="user-table"
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showTotal: (total) => `${total} nhân viên` }}
        />
      </Card>

      {/* ── Modal ──────────────────────────────────────────────── */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            <span>
              {editingUser ? `Sửa: ${editingUser.full_name}` : 'Thêm nhân viên mới'}
            </span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={580}
        styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          style={{ marginTop: 16 }}
        >
          <Row gutter={12}>
            <Col span={14}>
              <Form.Item
                name="full_name"
                label="Họ và tên"
                rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
              >
                <Input size="large" placeholder="Nguyễn Văn An" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item name="phone" label="Số điện thoại">
                <Input size="large" placeholder="0901234567" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' },
                ]}
              >
                <Input size="large" placeholder="nhanvien@congty.vn" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Tên đăng nhập"
                rules={[{ required: true, message: 'Vui lòng nhập tên đăng nhập' }]}
              >
                <Input size="large" placeholder="nguyenvanan" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="job_title" label="Chức danh">
                <Input size="large" placeholder="Vd: Giám đốc Kinh doanh" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Vai trò (nhóm quyền)">
                <Select
                  size="large"
                  placeholder="Chọn vai trò..."
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="password"
            label={editingUser ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
            rules={
              editingUser
                ? []
                : [
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 8, message: 'Tối thiểu 8 ký tự' },
                  ]
            }
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined />}
              placeholder={editingUser ? '••••••••' : 'Tối thiểu 8 ký tự'}
            />
          </Form.Item>

          <Divider style={{ margin: '8px 0 16px' }} />

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="is_active" label="Tình trạng" valuePropName="checked">
                <Switch checkedChildren="Đang làm việc" unCheckedChildren="Đã nghỉ việc" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="is_company_admin" label="Quyền Admin công ty" valuePropName="checked">
                <Switch checkedChildren="Admin" unCheckedChildren="Nhân viên" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" style={{ background: '#1649c9' }}>
              {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
