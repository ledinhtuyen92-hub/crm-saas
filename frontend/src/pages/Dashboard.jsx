import { Navigate } from 'react-router-dom'
import {
  BankOutlined,
  DollarCircleOutlined,
  PercentageOutlined,
  ProjectOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Space, Statistic, Table, Tag, Typography, theme } from 'antd'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'

const { Text, Title } = Typography

const revenueData = [
  { month: 'Tháng 1', revenue: 2.8 },
  { month: 'Tháng 2', revenue: 3.4 },
  { month: 'Tháng 3', revenue: 4.1 },
  { month: 'Tháng 4', revenue: 3.7 },
  { month: 'Tháng 5', revenue: 5.2 },
  { month: 'Tháng 6', revenue: 6.4 },
]

const materialRevenueData = [
  { name: 'Gỗ óc chó', value: 42, color: '#2563eb' },
  { name: 'Gỗ sồi', value: 28, color: '#0f766e' },
  { name: 'Gỗ công nghiệp', value: 22, color: '#f59e0b' },
  { name: 'Phụ kiện cao cấp', value: 8, color: '#7c3aed' },
]

const latestContracts = [
  {
    id: 1,
    customerName: 'Anh Minh - Biệt thự Cửa Lò',
    category: 'Thi công nội thất gỗ óc chó',
    branch: 'TP Vinh',
    status: 'Đang khảo sát',
  },
  {
    id: 2,
    customerName: 'Chị Hà - Chung cư Times City',
    category: 'Tủ bếp gỗ sồi và phòng khách',
    branch: 'Hà Nội',
    status: 'Đã ký hợp đồng',
  },
  {
    id: 3,
    customerName: 'Công ty An Phát',
    category: 'Nội thất văn phòng trọn gói',
    branch: 'TP Vinh',
    status: 'Đang thi công',
  },
  {
    id: 4,
    customerName: 'Anh Tuấn - Nhà phố Hà Đông',
    category: 'Phòng ngủ master',
    branch: 'Hà Nội',
    status: 'Chờ báo giá',
  },
  {
    id: 5,
    customerName: 'Chị Lan - Villa Ecopark',
    category: 'Thiết kế và thi công full house',
    branch: 'Hà Nội',
    status: 'Nghiệm thu',
  },
]

const contractColumns = [
  {
    title: 'Tên khách hàng',
    dataIndex: 'customerName',
    key: 'customerName',
  },
  {
    title: 'Hạng mục',
    dataIndex: 'category',
    key: 'category',
  },
  {
    title: 'Chi nhánh thực hiện',
    dataIndex: 'branch',
    key: 'branch',
    render: (branch) => (
      <Space size={6}>
        <BankOutlined style={{ color: '#2563eb' }} />
        <Text>{branch}</Text>
      </Space>
    ),
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      const colorMap = {
        'Đã ký hợp đồng': 'green',
        'Đang thi công': 'blue',
        'Đang khảo sát': 'gold',
        'Chờ báo giá': 'orange',
        'Nghiệm thu': 'purple',
      }

      return <Tag color={colorMap[status] ?? 'default'}>{status}</Tag>
    },
  },
]

const statisticCards = [
  {
    title: 'Tổng doanh thu',
    value: 18.75,
    suffix: 'tỷ',
    icon: <DollarCircleOutlined />,
    valueStyle: { color: '#2563eb' },
    iconStyle: {
      color: '#2563eb',
      background: 'rgba(37, 99, 235, 0.12)',
    },
  },
  {
    title: 'Dự án đang thi công',
    value: 24,
    suffix: 'dự án',
    icon: <ProjectOutlined />,
    valueStyle: { color: '#0f766e' },
    iconStyle: {
      color: '#0f766e',
      background: 'rgba(15, 118, 110, 0.12)',
    },
  },
  {
    title: 'Khách hàng mới',
    value: 86,
    suffix: 'khách',
    icon: <TeamOutlined />,
    valueStyle: { color: '#f59e0b' },
    iconStyle: {
      color: '#f59e0b',
      background: 'rgba(245, 158, 11, 0.14)',
    },
  },
  {
    title: 'Tỷ lệ chốt Sales',
    value: 38.6,
    suffix: '%',
    icon: <PercentageOutlined />,
    valueStyle: { color: '#7c3aed' },
    iconStyle: {
      color: '#7c3aed',
      background: 'rgba(124, 58, 237, 0.12)',
    },
  },
]

function Dashboard() {
  const { token } = theme.useToken()
  const { isSuperAdmin } = useAuth()

  if (isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const cardStyle = {
    height: '100%',
    borderRadius: 12,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.07)',
  }

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <Space direction="vertical" size={2} style={{ width: '100%', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          Dashboard
        </Title>
        <Text type="secondary">
          Tổng quan hiệu quả kinh doanh và tiến độ thi công nội thất
        </Text>
      </Space>

      <Row gutter={[16, 16]} style={{ width: '100%', marginInline: 0 }}>
        {statisticCards.map((item) => (
          <Col xs={24} sm={12} md={12} lg={6} xl={6} xxl={6} key={item.title}>
            <Card bordered={false} style={cardStyle}>
              <Space size={14} align="start" style={{ width: '100%' }}>
                <div
                  style={{
                    width: 46,
                    height: 46,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                    fontSize: 23,
                    ...item.iconStyle,
                  }}
                >
                  {item.icon}
                </div>
                <Statistic
                  title={item.title}
                  value={item.value}
                  precision={item.suffix === '%' ? 1 : 0}
                  suffix={item.suffix}
                  valueStyle={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: 0,
                    lineHeight: 1.2,
                    ...item.valueStyle,
                  }}
                  formatter={(value) => Number(value).toLocaleString('vi-VN')}
                />
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24} sm={24} md={24} lg={15} xl={16} xxl={17}>
          <Card title="Doanh thu 6 tháng gần nhất" bordered={false} style={cardStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={token.colorBorderSecondary} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: token.colorTextSecondary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: token.colorTextSecondary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${value} tỷ`}
                />
                <Tooltip
                  formatter={(value) => [`${value} tỷ VNĐ`, 'Doanh thu']}
                  cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgElevated,
                    color: token.colorText,
                  }}
                />
                <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} sm={24} md={24} lg={9} xl={8} xxl={7}>
          <Card title="Tỷ trọng doanh thu theo vật liệu" bordered={false} style={cardStyle}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={materialRevenueData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={68}
                  outerRadius={106}
                  paddingAngle={4}
                >
                  {materialRevenueData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${value}%`, 'Tỷ trọng']}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgElevated,
                    color: token.colorText,
                  }}
                />
                <Legend iconType="circle" verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24}>
          <Card title="5 hợp đồng mới nhất" bordered={false} style={cardStyle}>
            <Table
              columns={contractColumns}
              dataSource={latestContracts}
              rowKey="id"
              pagination={false}
              size="middle"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
