import { Link, useLocation, useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const { user, logout, isSuperAdmin, isCompanyAdmin } = useAuth()

  // ── Menu items (tuỳ theo quyền) ────────────────────────────────
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: <Link to="/dashboard">Dashboard</Link>,
    },
    {
      key: '/',
      icon: <TeamOutlined />,
      label: <Link to="/">Khách hàng</Link>,
    },
    {
      key: 'sales',
      icon: <ShoppingCartOutlined />,
      label: 'Bán hàng',
    },
    {
      key: 'orders',
      icon: <FileDoneOutlined />,
      label: 'Đơn hàng',
    },
    {
      key: 'warehouse',
      icon: <DatabaseOutlined />,
      label: 'Kho bãi',
    },
    {
      key: 'production',
      icon: <ToolOutlined />,
      label: 'Sản xuất',
    },

    // ── Admin section — chỉ hiển thị khi có quyền ────────────────
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

    ...(isSuperAdmin
      ? [
          {
            key: '/admin/companies',
            icon: <BankOutlined />,
            label: <Link to="/admin/companies">Hệ thống: Công ty</Link>,
          },
        ]
      : []),
  ]

  // ── Avatar dropdown menu ─────────────────────────────────────────
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
      disabled: true,
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

        {/* ── Company Badge ───────────────────────────────────────── */}
        {user?.company_name && (
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
        )}

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
    </Layout>
  )
}

export default MainLayout
