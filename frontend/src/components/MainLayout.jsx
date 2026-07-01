import { Link, useLocation } from 'react-router-dom'
import { Avatar, Badge, Layout, Menu, Space, Switch, Typography, theme } from 'antd'
import {
  AppstoreOutlined,
  BellOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  MoonOutlined,
  ShoppingCartOutlined,
  SunOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = Layout
const { Text, Title } = Typography

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
]

function MainLayout({ children, isDarkMode, toggleTheme }) {
  const location = useLocation()
  const { token } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Sider
        width={260}
        theme="dark"
        style={{
          background: 'linear-gradient(180deg, #111827 0%, #172554 100%)',
          boxShadow: '8px 0 24px rgba(15, 23, 42, 0.16)',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            height: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '0 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
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
            style={{
              margin: 0,
              color: '#ffffff',
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            CRM SaaS
          </Title>
        </div>

        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            borderRight: 0,
            padding: '16px 12px',
            background: 'transparent',
            fontWeight: 600,
          }}
        />
      </Sider>

      <Layout style={{ minWidth: 0, background: token.colorBgLayout }}>
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
              style={{
                margin: 0,
                color: token.colorText,
                fontSize: 22,
                lineHeight: 1.2,
              }}
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

            <Space size={10} align="center">
              <Avatar
                size={36}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #0f766e 100%)',
                  boxShadow: '0 8px 18px rgba(37, 99, 235, 0.22)',
                }}
              />
              <Text strong>Admin</Text>
            </Space>
          </Space>
        </Header>

        <Content
          style={{
            margin: '0',
            padding: '24px',
            minHeight: '100vh',
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
