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
  const canViewRevenue = isCompanyAdmin || hasPermission('dashboard.view_revenue') || hasPermission('reports.view_all')
  const canViewDebt = isCompanyAdmin || hasPermission('dashboard.view_debt') || hasPermission('orders.view_all')
  const [messageApi, contextHolder] = message.useMessage()

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [orderStatusData, setOrderStatusData] = useState([])
  const [latestOrders, setLatestOrders] = useState([])
  const [topSellers, setTopSellers] = useState([])
  const [debtStats, setDebtStats] = useState({ total_debt: 0, chart_data: [] })

  useEffect(() => {
    if (isSuperAdmin) return
    fetchDashboardData()
  }, [isSuperAdmin])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const fetchSafe = (url, fallback) => api.get(url).catch(() => ({ data: fallback }))

      const [summaryRes, revenueRes, statusRes, sellersRes, ordersRes, debtRes] = await Promise.all([
        fetchSafe('dashboard/summary/', {}),
        fetchSafe('dashboard/revenue-chart/?period=6', []),
        fetchSafe('dashboard/orders-by-status/', []),
        fetchSafe('dashboard/top-sellers/?limit=100', []),
        fetchSafe('orders/orders/', { results: [] }),
        fetchSafe('dashboard/debt-stats/', { total_debt: 0, chart_data: [] })
      ])

      setSummary(summaryRes.data)
      setRevenueData(revenueRes.data)
      setDebtStats(debtRes.data)
      
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
  
  const maxRevenue = topSellers.length > 0 ? topSellers[0].total_revenue : 0;
  const bestSellers = maxRevenue > 0 ? topSellers.filter(s => s.total_revenue === maxRevenue) : [];

  const minRevenue = topSellers.length > 0 ? topSellers[topSellers.length - 1].total_revenue : 0;
  const worstSellers = (topSellers.length > 1 && maxRevenue > 0) ? topSellers.filter(s => s.total_revenue === minRevenue) : [];

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
                  formatter={(value) => value === '***' ? value : Number(value).toLocaleString('vi-VN')}
                />
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
          <Card title="Tỷ trọng trạng thái đơn hàng" bordered={false} style={{...cardStyle, height: '100%'}} loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={orderStatusData}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={90}
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
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ width: '100%', marginTop: 16, marginInline: 0 }}>
        <Col xs={24} lg={16}>
          <Card title="Công nợ (6 tháng gần nhất)" bordered={false} style={cardStyle} loading={loading}>
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

        <Col xs={24} lg={8}>
          <Card bordered={false} style={{...cardStyle, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center'}} loading={loading}>
            <Row gutter={[16, 32]}>
              <Col span={24}>
                <div style={{ width: '100%' }}>
                  <Space style={{ marginBottom: 16, background: '#fef9c3', padding: '6px 16px', borderRadius: 20 }}>
                    <TrophyOutlined style={{color: '#eab308', fontSize: 18}} />
                    <Text strong style={{fontSize: 14, color: '#ca8a04'}}>Sales Tốt nhất</Text>
                  </Space>
                  {bestSellers.length > 0 ? (
                    <>
                      <div 
                        title={bestSellers.map(s => s.full_name).join(', ')}
                        style={{ fontSize: 18, color: '#16a34a', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}
                      >
                        {bestSellers.map(s => s.full_name).join(', ')}
                      </div>
                      <Text type="secondary" style={{fontSize: 14, display: 'block', marginTop: 8}}>
                        <Space>
                          <Tag color="green" style={{ margin: 0, fontSize: 14, padding: '2px 8px' }}>
                            {Number(maxRevenue).toLocaleString('vi-VN')} đ
                          </Tag>
                          {bestSellers.length === 1 && <span>({bestSellers[0].order_count} đơn)</span>}
                        </Space>
                      </Text>
                    </>
                  ) : (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic', padding: '8px 0', fontSize: 14 }}>
                      Chưa có doanh thu phát sinh
                    </div>
                  )}
                </div>
              </Col>
              
              <Col span={24}>
                <div style={{ height: 1, background: token.colorBorderSecondary, margin: '8px 0', opacity: 0.6 }} />
              </Col>

              <Col span={24}>
                <div style={{ width: '100%' }}>
                  <Space style={{ marginBottom: 16, background: '#fee2e2', padding: '6px 16px', borderRadius: 20 }}>
                    <FrownOutlined style={{color: '#ef4444', fontSize: 18}} />
                    <Text strong style={{fontSize: 14, color: '#dc2626'}}>Sales Yếu nhất</Text>
                  </Space>
                  {worstSellers.length > 0 ? (
                    <>
                      <div 
                        title={worstSellers.map(s => s.full_name).join(', ')}
                        style={{ fontSize: 18, color: '#dc2626', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}
                      >
                        {worstSellers.map(s => s.full_name).join(', ')}
                      </div>
                      <Text type="secondary" style={{fontSize: 14, display: 'block', marginTop: 8}}>
                         <Space>
                          <Tag color="red" style={{ margin: 0, fontSize: 14, padding: '2px 8px' }}>
                            {Number(minRevenue).toLocaleString('vi-VN')} đ
                          </Tag>
                          {worstSellers.length === 1 && <span>({worstSellers[0].order_count} đơn)</span>}
                        </Space>
                      </Text>
                    </>
                  ) : (
                    <div style={{ color: '#9ca3af', fontStyle: 'italic', padding: '8px 0', fontSize: 14 }}>
                      Chưa có dữ liệu đánh giá
                    </div>
                  )}
                </div>
              </Col>
            </Row>
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
