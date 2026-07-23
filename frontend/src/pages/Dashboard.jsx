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
import { Card, Col, Row, Space, Statistic, Table, Tag, Typography, theme, message, Segmented } from 'antd'
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
  const canViewRevenue = isCompanyAdmin || hasPermission('dashboard.view_revenue') || hasPermission('reports.view_all')
  const canViewDebt = isCompanyAdmin || hasPermission('dashboard.view_debt') || hasPermission('orders.view_all')
  const [messageApi, contextHolder] = message.useMessage()

  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('month') // today, week, month, quarter, year, all
  const [summary, setSummary] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [latestOrders, setLatestOrders] = useState([])
  const [topSellers, setTopSellers] = useState([])
  const [debtStats, setDebtStats] = useState({ total_debt: 0, chart_data: [] })

  useEffect(() => {
    if (isSuperAdmin) return
    fetchDashboardData()
  }, [isSuperAdmin, timeFilter])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const fetchSafe = (url, fallback) => api.get(url).catch(() => ({ data: fallback }))

      const filterParam = `?time_filter=${timeFilter}`
      const limitParam = timeFilter !== 'all' ? `&limit=100` : `?limit=100`
      const limitFilterParam = `?time_filter=${timeFilter}&limit=100`

      const [summaryRes, revenueRes, sellersRes, ordersRes, debtRes] = await Promise.all([
        fetchSafe(`dashboard/summary/${filterParam}`, {}),
        fetchSafe(`dashboard/revenue-chart/${filterParam}`, []),
        fetchSafe(`dashboard/top-sellers/${limitFilterParam}`, []),
        fetchSafe(`orders/orders/`, { results: [] }),
        fetchSafe(`dashboard/debt-stats/${filterParam}`, { total_debt: 0, chart_data: [] })
      ])

      setSummary(summaryRes.data)
      setRevenueData(revenueRes.data)
      setDebtStats(debtRes.data)
      
      const colors = ['#2563eb', '#0f766e', '#f59e0b', '#7c3aed', '#ef4444', '#64748b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
      setTopSellers(sellersRes.data.map((item, idx) => ({
        ...item,
        color: colors[idx % colors.length]
      })))
      
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
  
  const statisticCards = [
    {
      title: 'Doanh thu trong kỳ',
      value: canViewRevenue ? (summary?.orders?.revenue_in_period || 0) : '***',
      suffix: canViewRevenue ? 'đ' : '',
      icon: <DollarCircleOutlined />,
      valueStyle: { color: '#2563eb' },
      iconStyle: {
        color: '#2563eb',
        background: 'rgba(37, 99, 235, 0.12)',
      },
    },
    {
      title: 'Số lượng SP chốt',
      value: summary?.orders?.won_products_count || 0,
      suffix: 'SP',
      icon: <ProjectOutlined />,
      valueStyle: { color: '#0f766e' },
      iconStyle: {
        color: '#0f766e',
        background: 'rgba(15, 118, 110, 0.12)',
      },
      footer: `Trong đó hoàn thành: ${summary?.orders?.completed_products_count || 0}`
    },
    {
      title: 'Đơn hàng trong kỳ',
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
      title: 'Khách hàng trong kỳ',
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
    {
      title: 'Nợ phải thu',
      value: canViewDebt ? (debtStats?.total_debt || 0) : '***',
      suffix: canViewDebt ? 'đ' : '',
      icon: <DollarCircleOutlined />,
      valueStyle: { color: '#ef4444' },
      iconStyle: {
        color: '#ef4444',
        background: 'rgba(239, 68, 68, 0.12)',
      },
    },
  ]

  const timeFilterOptions = [
    { label: 'Hôm nay', value: 'today' },
    { label: 'Tuần này', value: 'week' },
    { label: 'Tháng này', value: 'month' },
    { label: 'Quý này', value: 'quarter' },
    { label: 'Năm nay', value: 'year' },
    { label: 'Toàn thời gian', value: 'all' },
  ]

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      {contextHolder}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Space direction="vertical" size={2}>
          <Title level={2} style={{ margin: 0 }}>
            Dashboard
          </Title>
          <Text type="secondary">
            Tổng quan hiệu quả kinh doanh và tiến độ thi công nội thất
          </Text>
        </Space>
        
        <Segmented 
          options={timeFilterOptions} 
          value={timeFilter} 
          onChange={setTimeFilter} 
          size="large"
          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
        />
      </div>

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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <Statistic
                    title={item.title}
                    value={item.value}
                    precision={item.suffix === '%' ? 1 : 0}
                    suffix={item.suffix}
                    valueStyle={{
                      fontSize: item.title === 'Doanh thu trong kỳ' && item.value > 1000000 ? 18 : 24,
                      fontWeight: 800,
                      letterSpacing: 0,
                      lineHeight: 1.2,
                      ...item.valueStyle,
                    }}
                    formatter={(value) => value === '***' ? value : Number(value).toLocaleString('vi-VN')}
                  />
                  {item.footer && (
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
                      {item.footer}
                    </Text>
                  )}
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24} lg={16}>
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

        <Col xs={24} lg={8}>
          <Card title="Sản lượng chốt theo Sales" bordered={false} style={{...cardStyle, height: '100%'}} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={topSellers}
                  dataKey="product_count"
                  nameKey="full_name"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={4}
                >
                  {topSellers.map((entry, index) => (
                    <Cell key={entry.user_id} fill={entry.color} />
                  ))}
                </Pie>
                <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 24, fontWeight: 'bold', fill: token.colorText }}>
                  {topSellers.reduce((sum, item) => sum + (item.product_count || 0), 0).toLocaleString('vi-VN')}
                </text>
                <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 14, fill: token.colorTextSecondary }}>
                  Tổng SP
                </text>
                <Tooltip
                  formatter={(value, name) => [`${value} SP`, name]}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgElevated,
                    color: token.colorText,
                  }}
                />
                <Legend 
                  iconType="circle" 
                  verticalAlign="bottom" 
                  wrapperStyle={{ maxHeight: 60, overflowY: 'auto' }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24} lg={12}>
          <Card title="Công nợ trong kỳ" bordered={false} style={cardStyle} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={debtStats?.chart_data || []} margin={{ top: 12, right: 8, left: 20, bottom: 0 }}>
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
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(value, name) => {
                    return [`${Number(value).toLocaleString('vi-VN')} đ`, name]
                  }}
                  cursor={{ fill: 'rgba(239, 68, 68, 0.08)' }}
                  contentStyle={{
                    borderRadius: 10,
                    borderColor: token.colorBorderSecondary,
                    background: token.colorBgElevated,
                    color: token.colorText,
                  }}
                />
                <Legend />
                <Bar dataKey="debt" name="Công nợ phát sinh" fill="#ef4444" radius={[10, 10, 0, 0]} barSize={42} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Doanh thu theo Sales" bordered={false} style={{...cardStyle, height: '100%'}} loading={loading}>
            <div style={{ height: 300, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
              <ResponsiveContainer width="100%" height={Math.max(300, topSellers.length * 45)}>
                <BarChart
                  data={topSellers}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={token.colorBorderSecondary} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="full_name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: token.colorTextSecondary, fontSize: 13, fontWeight: 500 }}
                    width={120}
                  />
                  <Tooltip 
                    formatter={(value) => [`${Number(value).toLocaleString('vi-VN')} đ`, 'Doanh thu']}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{
                      borderRadius: 10,
                      borderColor: token.colorBorderSecondary,
                      background: token.colorBgElevated,
                      color: token.colorText,
                    }}
                  />
                  <Bar dataKey="total_revenue" radius={[0, 4, 4, 0]} barSize={24}>
                    {topSellers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
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
