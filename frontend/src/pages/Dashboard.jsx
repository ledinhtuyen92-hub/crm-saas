import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  BankOutlined,
  DollarCircleOutlined,
  PercentageOutlined,
  ProjectOutlined,
  TeamOutlined,
  TrophyOutlined,
  FrownOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Card, Col, Row, Space, Statistic, Table, Tag, Typography, theme, message } from 'antd'
import {
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  ComposedChart
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'

const { Text, Title } = Typography

const contractColumns = [
  {
    title: 'Mã ĐH',
    dataIndex: 'order_number',
    key: 'order_number',
    render: (text) => <Text strong>{text}</Text>
  },
  {
    title: 'Tên khách hàng',
    dataIndex: ['customer', 'name'],
    key: 'customerName',
  },
  {
    title: 'Tổng tiền',
    dataIndex: 'total_amount',
    key: 'total_amount',
    render: (amount) => `${Number(amount).toLocaleString('vi-VN')} đ`,
  },
  {
    title: 'Người tạo',
    dataIndex: ['created_by', 'full_name'],
    key: 'created_by',
    render: (name) => (
      <Space size={6}>
        <BankOutlined style={{ color: '#2563eb' }} />
        <Text>{name || 'N/A'}</Text>
      </Space>
    ),
  },
  {
    title: 'Người duyệt',
    dataIndex: ['approved_by', 'full_name'],
    key: 'approved_by',
    render: (name) => name ? <Text>{name}</Text> : <Text type="secondary">Chưa có</Text>,
  },
  {
    title: 'Trạng thái',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      const colorMap = {
        'completed': 'green',
        'in_production': 'blue',
        'approved': 'gold',
        'pending': 'orange',
        'rejected': 'red',
        'cancelled': 'default'
      }
      
      const labelMap = {
        'completed': 'Hoàn thành',
        'in_production': 'Đang sản xuất',
        'approved': 'Đã duyệt',
        'pending': 'Chờ duyệt',
        'rejected': 'Từ chối',
        'cancelled': 'Đã huỷ'
      }

      return <Tag color={colorMap[status] ?? 'default'}>{labelMap[status] ?? status}</Tag>
    },
  },
]

function Dashboard() {
  const { token } = theme.useToken()
  const { isSuperAdmin, hasPermission, isCompanyAdmin } = useAuth()
  const canViewRevenue = isCompanyAdmin || hasPermission('dashboard.view_revenue')
  const [messageApi, contextHolder] = message.useMessage()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [orderStatusData, setOrderStatusData] = useState([])
  const [latestOrders, setLatestOrders] = useState([])
  const [topSellers, setTopSellers] = useState([])

  useEffect(() => {
    if (isSuperAdmin) return
    fetchDashboardData()
  }, [isSuperAdmin])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const fetchSafe = (url, fallback) => api.get(url).catch(() => ({ data: fallback }))

      const [summaryRes, revenueRes, statusRes, sellersRes, ordersRes] = await Promise.all([
        fetchSafe('dashboard/summary/', {}),
        fetchSafe('dashboard/revenue-chart/?period=6', []),
        fetchSafe('dashboard/orders-by-status/', []),
        fetchSafe('dashboard/top-sellers/?limit=100', []),
        fetchSafe('orders/orders/', { results: [] })
      ])

      setSummary(summaryRes.data)
      setRevenueData(revenueRes.data)
      
      // Map colors for pie chart
      const colors = ['#2563eb', '#0f766e', '#f59e0b', '#7c3aed', '#ef4444', '#64748b']
      setOrderStatusData(statusRes.data.map((item, idx) => ({
        ...item,
        color: colors[idx % colors.length]
      })))

      setTopSellers(sellersRes.data)
      
      const orders = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data?.results ?? []
      setLatestOrders(orders.slice(0, 10))
      
    } catch (error) {
      console.error(error)
      messageApi.error('Không thể tải dữ liệu Dashboard.')
    } finally {
      setLoading(false)
    }
  }

  if (isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const cardStyle = {
    height: '100%',
    borderRadius: 12,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.07)',
  }
  
  const bestSeller = topSellers.length > 0 ? topSellers[0] : null
  const worstSeller = topSellers.length > 1 ? topSellers[topSellers.length - 1] : null

  const statisticCards = [
    {
      title: 'Tổng doanh thu',
      value: canViewRevenue ? (summary?.orders?.total_revenue_all_time || 0) : '***',
      suffix: canViewRevenue ? 'đ' : '',
      icon: <DollarCircleOutlined />,
      valueStyle: { color: '#2563eb' },
      iconStyle: {
        color: '#2563eb',
        background: 'rgba(37, 99, 235, 0.12)',
      },
    },
    {
      title: 'Tổng đơn hàng',
      value: summary?.orders?.total || 0,
      suffix: 'đơn',
      icon: <ProjectOutlined />,
      valueStyle: { color: '#0f766e' },
      iconStyle: {
        color: '#0f766e',
        background: 'rgba(15, 118, 110, 0.12)',
      },
    },
    {
      title: 'Số nhân viên',
      value: summary?.employees?.total_active || 0,
      suffix: 'người',
      icon: <TeamOutlined />,
      valueStyle: { color: '#f59e0b' },
      iconStyle: {
        color: '#f59e0b',
        background: 'rgba(245, 158, 11, 0.14)',
      },
    },
    {
      title: 'Khách hàng',
      value: summary?.customers?.total || 0,
      suffix: 'khách',
      icon: <UserOutlined />,
      valueStyle: { color: '#0ea5e9' },
      iconStyle: {
        color: '#0ea5e9',
        background: 'rgba(14, 165, 233, 0.12)',
      },
    },
    {
      title: 'Tỷ lệ chốt Sales',
      value: summary?.quotations?.win_rate || 0,
      suffix: '%',
      icon: <PercentageOutlined />,
      valueStyle: { color: '#7c3aed' },
      iconStyle: {
        color: '#7c3aed',
        background: 'rgba(124, 58, 237, 0.12)',
      },
    },
  ]

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {contextHolder}
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
          <Col xs={24} sm={12} md={8} style={{ flex: '1 1 200px' }} key={item.title}>
            <Card bordered={false} style={cardStyle} loading={loading}>
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
                    fontSize: item.title === 'Tổng doanh thu' && item.value > 1000000 ? 18 : 24,
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
          <Card title="Doanh thu & Số lượng đơn hàng (6 tháng gần nhất)" bordered={false} style={cardStyle} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueData} margin={{ top: 12, right: 8, left: 20, bottom: 0 }}>
                <CartesianGrid stroke={token.colorBorderSecondary} strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: token.colorTextSecondary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: token.colorTextSecondary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: token.colorTextSecondary, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'Doanh thu') return [`${Number(value).toLocaleString('vi-VN')} đ`, name]
                    return [value, name]
                  }}
                  cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgElevated,
                    color: token.colorText,
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[10, 10, 0, 0]} barSize={42} />
                <Line yAxisId="right" type="monotone" dataKey="count" name="Số đơn hàng" stroke="#f59e0b" strokeWidth={3} dot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} sm={24} md={24} lg={9} xl={8} xxl={7}>
          <Space direction="vertical" size={16} style={{ width: '100%', height: '100%' }}>
            <Card title="Tỷ trọng trạng thái đơn hàng" bordered={false} style={{...cardStyle, height: 320}} loading={loading}>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {orderStatusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} đơn`, 'Số lượng']}
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

            <Card bordered={false} style={{...cardStyle, height: 'auto', minHeight: 120}} loading={loading}>
              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title={
                      <Space>
                        <TrophyOutlined style={{color: '#eab308'}} />
                        <Text strong>Sales Tốt nhất</Text>
                      </Space>
                    }
                    value={bestSeller ? bestSeller.full_name : 'N/A'}
                    valueStyle={{ fontSize: 16, color: '#16a34a', marginTop: 8 }}
                  />
                  <Text type="secondary" style={{fontSize: 12}}>
                    {bestSeller ? `${Number(bestSeller.total_revenue).toLocaleString('vi-VN')}đ (${bestSeller.order_count} đơn)` : 'Chưa có DL'}
                  </Text>
                </Col>
                <Col span={12}>
                  <Statistic
                    title={
                      <Space>
                        <FrownOutlined style={{color: '#ef4444'}} />
                        <Text strong>Sales Yếu nhất</Text>
                      </Space>
                    }
                    value={worstSeller ? worstSeller.full_name : 'N/A'}
                    valueStyle={{ fontSize: 16, color: '#dc2626', marginTop: 8 }}
                  />
                  <Text type="secondary" style={{fontSize: 12}}>
                     {worstSeller ? `${Number(worstSeller.total_revenue).toLocaleString('vi-VN')}đ (${worstSeller.order_count} đơn)` : 'Chưa có DL'}
                  </Text>
                </Col>
              </Row>
            </Card>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24}>
          <Card title="10 đơn hàng mới nhất" bordered={false} style={cardStyle} loading={loading}>
            <Table
              columns={contractColumns}
              dataSource={latestOrders}
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
