import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../utils/api'
import {
  Avatar,
  Badge,
  Dropdown,
  Layout,
  Menu,
  Space,
  Switch,
  Typography,
  theme,
  Modal,
  Form,
  Input,
  Button,
  message,
} from 'antd'
import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SunOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Text, Title } = Typography

function MainLayout({ children, isDarkMode, toggleTheme }) {
  const location = useLocation()
  const { token } = theme.useToken()
  const { user, logout, isSuperAdmin, isCompanyAdmin } = useAuth()

  // ── Menu items (tuỳ theo quyền) ────────────────────────────────
  const menuItems = isSuperAdmin
    ? [
        {
          key: '/admin/dashboard',
          icon: <DashboardOutlined />,
          label: <Link to="/admin/dashboard">Dashboard Hệ thống</Link>,
        },
        {
          key: '/admin/companies',
          icon: <BankOutlined />,
          label: <Link to="/admin/companies">Quản lý Khách hàng SaaS</Link>,
        },
        {
          key: '/admin/users',
          icon: <TeamOutlined />,
          label: <Link to="/admin/users">Quản lý Tài khoản</Link>,
        },
        {
          key: '/admin/settings',
          icon: <SettingOutlined />,
          label: <Link to="/admin/settings">Cấu hình Gói & Hạn mức</Link>,
        },
      ]
    : [
        {
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: <Link to="/dashboard">Dashboard</Link>,
        },
        {
          key: '/customers',
          icon: <TeamOutlined />,
          label: <Link to="/customers">Khách hàng</Link>,
        },
        {
          key: '/quotations',
          icon: <ShoppingCartOutlined />,
          label: <Link to="/quotations">Bán hàng (Báo giá)</Link>,
        },
        {
          key: '/orders',
          icon: <FileDoneOutlined />,
          label: <Link to="/orders">Đơn hàng</Link>,
        },
        {
          key: '/inventory',
          icon: <DatabaseOutlined />,
          label: <Link to="/inventory">Kho bãi & SP</Link>,
        },
        {
          key: '/production',
          icon: <ToolOutlined />,
          label: <Link to="/production">Sản xuất</Link>,
        },
        ...(isCompanyAdmin
          ? [
              { type: 'divider' },
              {
                key: 'settings-group',
                icon: <SettingOutlined />,
                label: 'Quản lý công ty',
                children: [
                  {
                    key: '/settings/users',
                    icon: <UsergroupAddOutlined />,
                    label: <Link to="/settings/users">Nhân viên</Link>,
                  },
                  {
                    key: '/settings/roles',
                    icon: <KeyOutlined />,
                    label: <Link to="/settings/roles">Vai trò & Quyền</Link>,
                  },
                ],
              },
            ]
          : []),
      ]

  // ── Modal Đổi mật khẩu ───────────────────────────────────────────
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [passwordForm] = Form.useForm()

  const handlePasswordSubmit = async (values) => {
    try {
      await api.post('users/change-password/', {
        old_password: values.old_password,
        new_password: values.new_password,
      })
      message.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.')
      setPasswordModalOpen(false)
      passwordForm.resetFields()
      logout()
    } catch (err) {
      const errData = err.response?.data
      if (errData && typeof errData === 'object') {
        const msg = Object.values(errData).flat().join(' ')
        message.error(msg || 'Mật khẩu cũ không đúng hoặc có lỗi xảy ra.')
      } else {
        message.error('Có lỗi xảy ra khi đổi mật khẩu.')
      }
    }
  }

  // ── Avatar dropdown menu ─────────────────────────────────────────
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
      disabled: true,
    },
    {
      key: 'change-password',
      icon: <KeyOutlined />,
      label: 'Đổi mật khẩu',
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
    },
  ]

  const onUserMenuClick = ({ key }) => {
    if (key === 'logout') logout()
    if (key === 'change-password') {
      setPasswordModalOpen(true)
      passwordForm.resetFields()
    }
  }

  // ── Tên hiển thị ─────────────────────────────────────────────────
  const displayName = user?.full_name || user?.username || 'Người dùng'
  const initials = displayName
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarGradient = user?.is_superuser
    ? 'linear-gradient(135deg, #f59e0b 0%, #dc2626 100%)'
    : user?.is_company_admin
      ? 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)'
      : 'linear-gradient(135deg, #059669 0%, #0891b2 100%)'

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Sider
        width={260}
        theme="dark"
        style={{
          background: 'linear-gradient(180deg, #111827 0%, #172554 100%)',
          boxShadow: '8px 0 24px rgba(15, 23, 42, 0.16)',
          minHeight: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflowY: 'auto',
        }}
      >
        {/* ── Logo ───────────────────────────────────────────────── */}
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)',
              boxShadow: '0 10px 24px rgba(37, 99, 235, 0.35)',
            }}
          >
            <AppstoreOutlined style={{ fontSize: 20 }} />
          </div>
          <Title
            level={4}
            style={{ margin: 0, color: '#ffffff', fontWeight: 800, letterSpacing: 0 }}
          >
            CRM SaaS
          </Title>
        </div>

        {/* ── Company or SuperAdmin Badge ─────────────────────────── */}
        {isSuperAdmin ? (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)',
                border: '1px solid rgba(249, 115, 22, 0.35)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <SettingOutlined style={{ color: '#fdba74', fontSize: 16 }} />
              <div>
                <Text style={{ color: '#fdba74', fontSize: 11, fontWeight: 800, display: 'block', letterSpacing: 0.5 }}>
                  SYSTEM ADMIN
                </Text>
                <Text style={{ color: '#e5e7eb', fontSize: 11 }}>
                  SaaS Platform Console
                </Text>
              </div>
            </div>
          </div>
        ) : user?.company_name ? (
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div
              style={{
                background: 'rgba(37, 99, 235, 0.2)',
                borderRadius: 8,
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <BankOutlined style={{ color: '#93c5fd', fontSize: 12 }} />
              <Text style={{ color: '#93c5fd', fontSize: 12, fontWeight: 600 }}>
                {user.company_name}
              </Text>
            </div>
          </div>
        ) : null}

        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          defaultOpenKeys={['settings-group']}
          items={menuItems}
          style={{
            borderRight: 0,
            padding: '12px 12px',
            background: 'transparent',
            fontWeight: 600,
          }}
        />
      </Sider>

      {/* ── Main content area (offset by sider width) ────────────── */}
      <Layout style={{ minWidth: 0, background: token.colorBgLayout, marginLeft: 260 }}>
        <Header
          style={{
            height: 80,
            minHeight: 80,
            lineHeight: 'normal',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: token.colorBgContainer,
            boxShadow: isDarkMode
              ? '0 4px 18px rgba(0, 0, 0, 0.28)'
              : '0 4px 18px rgba(15, 23, 42, 0.08)',
            padding: '0 24px',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 5,
              minWidth: 0,
            }}
          >
            <Title
              level={3}
              style={{ margin: 0, color: token.colorText, fontSize: 22, lineHeight: 1.2 }}
            >
              Customer Relationship Management
            </Title>
            <Text type="secondary" style={{ lineHeight: 1.3 }}>
              Quản lý vận hành và chăm sóc khách hàng
            </Text>
          </div>

          <Space size={20} align="center">
            <Switch
              checked={isDarkMode}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              onChange={toggleTheme}
            />

            <Badge dot offset={[-2, 4]}>
              <BellOutlined
                style={{
                  color: token.colorTextSecondary,
                  cursor: 'pointer',
                  fontSize: 20,
                }}
              />
            </Badge>

            {/* ── User Avatar Dropdown ──────────────────────────── */}
            <Dropdown
              menu={{ items: userMenuItems, onClick: onUserMenuClick }}
              placement="bottomRight"
              trigger={['click']}
            >
              <Space
                size={10}
                align="center"
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <Avatar
                  size={36}
                  style={{
                    background: avatarGradient,
                    boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {initials || <UserOutlined />}
                </Avatar>
                <div style={{ lineHeight: 1.3 }}>
                  <div>
                    <Text strong style={{ fontSize: 14 }}>
                      {displayName}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {user?.is_superuser
                      ? 'System Admin'
                      : user?.role_name || user?.job_title || 'Nhân viên'}
                  </Text>
                </div>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '0',
            padding: '24px',
            minHeight: 'calc(100vh - 80px)',
            width: '100%',
            minWidth: 0,
            overflow: 'auto',
            background: token.colorBgLayout,
          }}
        >
          {children}
        </Content>
      </Layout>

      {/* Modal Đổi Mật Khẩu */}
      <Modal
        title={<span><KeyOutlined /> Đổi mật khẩu cá nhân</span>}
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={handlePasswordSubmit}
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="old_password"
            label="Mật khẩu cũ"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu cũ' }]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 6, message: 'Mật khẩu mới phải có ít nhất 6 ký tự' }
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Nhập lại mật khẩu mới"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Hai mật khẩu không khớp!'))
                },
              }),
            ]}
          >
            <Input.Password size="large" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setPasswordModalOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit">Xác nhận đổi</Button>
          </div>
        </Form>
      </Modal>
    </Layout>
  )
}

export default MainLayout
