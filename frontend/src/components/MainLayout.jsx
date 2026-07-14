import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import api from '../utils/api'
import {
  Alert,
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
  Popover,
  List,
} from 'antd'
import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  InboxOutlined,
  KeyOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SmileOutlined,
  SunOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  AppstoreAddOutlined,
  CarOutlined,
  SafetyCertificateOutlined,
  WechatOutlined,
  MessageOutlined,
} from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Text, Title } = Typography

function MainLayout({ children, isDarkMode, toggleTheme }) {
  const location = useLocation()
  const { token } = theme.useToken()
  const { user, logout, isSuperAdmin, isCompanyAdmin, hasPermission, maintenanceMode, isModuleActive } = useAuth()

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
        {
          key: '/admin/quotation-templates',
          icon: <FileTextOutlined />,
          label: <Link to="/admin/quotation-templates">Kho Mẫu Báo Giá</Link>,
        },
      ]
    : [
        ...(hasPermission('dashboard.view') ? [{
          key: '/dashboard',
          icon: <DashboardOutlined />,
          label: <Link to="/dashboard">Bảng điều khiển</Link>,
        }] : []),
        ...(isModuleActive('approvals') ? [{
          key: '/approvals',
          icon: <CheckCircleOutlined />,
          label: <Link to="/approvals">Phê duyệt</Link>,
        }] : []),
        ...(isModuleActive('crm') && hasPermission('crm.view') ? [{
          key: '/customers',
          icon: <TeamOutlined />,
          label: <Link to="/customers">Khách hàng</Link>,
        }] : []),
        ...(isModuleActive('products') && hasPermission('products.view') ? [{
          key: '/products',
          icon: <InboxOutlined />,
          label: <Link to="/products">Sản phẩm & Dịch vụ</Link>,
        }] : []),
        ...(isModuleActive('sales') && hasPermission('sales.view') ? [{
          key: '/quotations',
          icon: <ShoppingCartOutlined />,
          label: <Link to="/quotations">Bán hàng (Báo giá)</Link>,
        }] : []),
        ...(isModuleActive('orders') && hasPermission('orders.view') ? [{
          key: '/orders',
          icon: <FileDoneOutlined />,
          label: <Link to="/orders">Đơn hàng</Link>,
        }] : []),
        ...(isModuleActive('inventory') && hasPermission('inventory.view') ? [{
          key: '/inventory',
          icon: <DatabaseOutlined />,
          label: <Link to="/inventory">Kho vận</Link>,
        }] : []),
        ...(isModuleActive('production') && hasPermission('production.view') ? [{
          key: '/production',
          icon: <ToolOutlined />,
          label: <Link to="/production">Sản xuất</Link>,
        }] : []),
        ...(isModuleActive('delivery') && hasPermission('delivery.view') ? [{
          key: '/delivery',
          icon: <CarOutlined />,
          label: <Link to="/delivery">Giao hàng</Link>,
        }] : []),
        ...(isModuleActive('warranty') && hasPermission('warranty.view') ? [{
          key: '/warranty',
          icon: <SafetyCertificateOutlined />,
          label: <Link to="/warranty">Bảo hành</Link>,
        }] : []),
        ...(isModuleActive('zalo') && hasPermission('zalo.view') ? [{
          key: '/zalo/inbox',
          icon: <WechatOutlined style={{ color: '#0068ff' }} />,
          label: <Link to="/zalo/inbox">Zalo Inbox</Link>,
        }] : []),
        ...(isModuleActive('facebook') && hasPermission('facebook.view_inbox') ? [{
          key: '/facebook/inbox',
          icon: <span style={{ color: '#1877f2', fontWeight: 900, fontSize: 14 }}>𝐟</span>,
          label: <Link to="/facebook/inbox">Facebook Inbox</Link>,
        }] : []),
        ...(isCompanyAdmin
          ? [
              { type: 'divider' },
              {
                key: 'settings-group',
                icon: <SettingOutlined />,
                label: 'Quản lý công ty',
                children: [
                  {
                    key: '/settings/general',
                    icon: <SettingOutlined />,
                    label: <Link to="/settings/general">Cài đặt & Mẫu báo giá</Link>,
                  },
                  {
                    key: '/settings/users',
                    icon: <UsergroupAddOutlined />,
                    label: <Link to="/settings/users">Nhân viên</Link>,
                  },
                  {
                    key: '/settings/departments',
                    icon: <TeamOutlined />,
                    label: <Link to="/settings/departments">Phòng ban</Link>,
                  },
                  {
                    key: '/settings/roles',
                    icon: <KeyOutlined />,
                    label: <Link to="/settings/roles">Vai trò & Quyền</Link>,
                  },
                  ...(isModuleActive('zalo') && hasPermission('zalo.config') ? [{
                    key: '/settings/zalo',
                    icon: <WechatOutlined />,
                    label: <Link to="/settings/zalo">Cấu hình Zalo OA</Link>,
                  }, {
                    key: '/settings/zalo-templates',
                    icon: <MessageOutlined />,
                    label: <Link to="/settings/zalo-templates">Mẫu Zalo ZNS</Link>,
                  }] : []),
                  ...(isModuleActive('facebook') && hasPermission('facebook.manage_config') ? [{
                    key: '/settings/facebook',
                    icon: <span style={{ color: '#1877f2', fontWeight: 900 }}>𝐟</span>,
                    label: <Link to="/settings/facebook">Cấu hình Facebook</Link>,
                  }] : []),
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
      await api.patch('/users/me/change-password/', values)
      message.success('Đổi mật khẩu thành công!')
      setPasswordModalOpen(false)
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

  // ── Thông báo ──────────────────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifVisible, setNotifVisible] = useState(false)

  React.useEffect(() => {
    if (user) {
      api.get('/notifications/unread-count/').then(res => {
        setUnreadCount(res.data.unread_count || 0)
      }).catch(() => {})
    }
  }, [user])

  const handleNotifVisibleChange = (newVisible) => {
    setNotifVisible(newVisible)
    if (newVisible) {
      api.get('/notifications/').then(res => {
        const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
        setNotifications(data)
      }).catch(() => {})
    }
  }

  const handleMarkAsRead = async (item) => {
    if (!item.is_read) {
      try {
        await api.patch(`/notifications/${item.id}/read/`)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setNotifications(prev => prev.map(n => n.id === item.id ? { ...n, is_read: true } : n))
      } catch {}
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read/')
      setUnreadCount(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      message.success('Đã đánh dấu tất cả là đã đọc.')
    } catch {}
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

  // ── Lời chào tùy chỉnh ───────────────────────────────────────────
  let greetingMessage = 'Chào mừng bạn quay lại hệ thống. Chúc bạn một ngày làm việc hiệu quả!'
  if (user?.is_superuser) {
    greetingMessage = 'Hệ thống đang hoạt động ổn định. Chúc bạn một ngày làm việc hiệu quả!'
  } else if (user?.is_company_admin) {
    greetingMessage = 'Chào mừng Giám đốc. Cùng xem qua tình hình kinh doanh hôm nay nhé!'
  } else if (hasPermission('crm.view') || hasPermission('crm.create')) {
    greetingMessage = 'Chào mừng bạn quay lại. Hôm nay có lịch hẹn khách hàng nào không?'
  }

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
              alignItems: 'center',
              gap: 16,
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: isDarkMode 
                  ? 'linear-gradient(135deg, #1e3a8a 0%, #312e81 100%)' 
                  : 'linear-gradient(135deg, #eff6ff 0%, #e0e7ff 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isDarkMode 
                  ? '0 4px 14px rgba(0,0,0,0.5)' 
                  : '0 4px 14px rgba(59, 130, 246, 0.15)',
              }}
            >
              <SmileOutlined style={{ fontSize: 24, color: isDarkMode ? '#60a5fa' : '#2563eb', animation: 'wave 2.5s infinite', transformOrigin: '70% 70%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Title
                level={3}
                style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 800,
                }}
              >
                <span
                  style={{
                    backgroundImage: isDarkMode 
                      ? 'linear-gradient(90deg, #60a5fa, #c084fc)' 
                      : 'linear-gradient(90deg, #2563eb, #9333ea)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  }}
                >
                  Xin chào, {user?.full_name || user?.username}!
                </span>
              </Title>
              <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
                {greetingMessage}
              </Text>
            </div>
            <style>
              {`
                @keyframes wave {
                  0% { transform: rotate(0deg); }
                  10% { transform: rotate(14deg); }
                  20% { transform: rotate(-8deg); }
                  30% { transform: rotate(14deg); }
                  40% { transform: rotate(-4deg); }
                  50% { transform: rotate(10deg); }
                  60% { transform: rotate(0deg); }
                  100% { transform: rotate(0deg); }
                }
              `}
            </style>
          </div>

          <Space size={20} align="center">
            <Switch
              checked={isDarkMode}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              onChange={toggleTheme}
            />

            <Popover
              content={
                <div style={{ width: 300, maxHeight: 400, overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text strong>Thông báo</Text>
                    {notifications.length > 0 && (
                      <Button type="link" size="small" onClick={handleMarkAllRead} style={{ padding: 0 }}>
                        Đánh dấu tất cả đã đọc
                      </Button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <Text type="secondary" style={{ display: 'block', textAlign: 'center', padding: '20px 0' }}>
                      Không có thông báo nào.
                    </Text>
                  ) : (
                    <List
                      itemLayout="horizontal"
                      dataSource={notifications}
                      renderItem={(item) => (
                        <List.Item
                          style={{
                            cursor: 'pointer',
                            background: item.is_read ? 'transparent' : '#f0f5ff',
                            padding: '8px 12px',
                            borderBottom: '1px solid #f0f0f0',
                            borderRadius: 4,
                            marginBottom: 4,
                          }}
                          onClick={() => handleMarkAsRead(item)}
                        >
                          <List.Item.Meta
                            title={
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Text strong={!item.is_read} style={{ fontSize: 13, color: item.is_read ? '#595959' : '#1890ff' }}>
                                  {item.title}
                                </Text>
                                {!item.is_read && <Badge status="processing" />}
                              </div>
                            }
                            description={
                              <div>
                                <Text style={{ fontSize: 12, color: item.is_read ? '#8c8c8c' : '#595959', display: 'block', marginTop: 4 }}>
                                  {item.message}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                                  {new Date(item.created_at).toLocaleString('vi-VN')}
                                </Text>
                              </div>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              }
              trigger="click"
              placement="bottomRight"
              open={notifVisible}
              onOpenChange={handleNotifVisibleChange}
            >
              <Badge count={unreadCount} offset={[-2, 4]} size="small">
                <BellOutlined
                  style={{
                    color: token.colorTextSecondary,
                    cursor: 'pointer',
                    fontSize: 20,
                  }}
                />
              </Badge>
            </Popover>

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
          {maintenanceMode && (
            <Alert
              message="⚠️ HỆ THỐNG ĐANG TRONG CHẾ ĐỘ BẢO TRÌ DỮ LIỆU"
              description="Toàn bộ chức năng thêm, sửa, xóa dữ liệu trên hệ thống tạm thời bị khóa để phục vụ bảo trì kỹ thuật. Bạn vẫn có thể tra cứu, truy cập và xem báo cáo bình thường."
              type="warning"
              showIcon
              banner
              style={{ marginBottom: 20, borderRadius: 8, border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', fontWeight: 500 }}
            />
          )}
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
