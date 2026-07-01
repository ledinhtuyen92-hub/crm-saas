import {
  AppstoreOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button, Col, Form, Input, Row, Space, Typography, message, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import authTechnology from '../assets/auth-technology.png'

const { Paragraph, Text, Title } = Typography

function Login() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [messageApi, contextHolder] = message.useMessage()

  const handleSubmit = async (values) => {
    try {
      const { data } = await api.post('/users/login/', values)
      if (data.access) localStorage.setItem('accessToken', data.access)
      if (data.refresh) localStorage.setItem('refreshToken', data.refresh)
      messageApi.success('Đăng nhập thành công')
      navigate('/dashboard')
    } catch (error) {
      const detail =
        error.response?.data?.detail ||
        'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin tài khoản.'
      messageApi.error(detail)
    }
  }

  return (
    <Row style={{ minHeight: '100vh', background: token.colorBgContainer }}>
      {contextHolder}
      <Col xs={0} lg={12} xl={13}>
        <section
          style={{
            minHeight: '100vh',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            padding: 'clamp(40px, 7vw, 104px)',
            backgroundImage: `linear-gradient(90deg, rgba(2, 8, 23, 0.32), rgba(2, 8, 23, 0.08)), url(${authTechnology})`,
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          <div
            style={{
              width: 'min(580px, 100%)',
              padding: '40px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              color: '#fff',
              background: 'rgba(8, 23, 52, 0.54)',
              boxShadow: '0 24px 64px rgba(2, 8, 23, 0.28)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
          >
            <Space size={12} style={{ marginBottom: 28 }}>
              <AppstoreOutlined style={{ color: '#67e8f9', fontSize: 28 }} />
              <Text strong style={{ color: '#fff', fontSize: 18 }}>
                CRM SaaS
              </Text>
            </Space>
            <Title style={{ margin: 0, color: '#fff', fontSize: 42, lineHeight: 1.18 }}>
              Nền tảng Quản trị Doanh nghiệp Toàn diện
            </Title>
            <Paragraph
              style={{ margin: '20px 0 0', color: 'rgba(255, 255, 255, 0.76)', fontSize: 17 }}
            >
              Số hóa quy trình - Tối ưu hiệu suất - Đột phá doanh thu
            </Paragraph>
          </div>
        </section>
      </Col>

      <Col xs={24} lg={12} xl={11}>
        <main
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            background: token.colorBgContainer,
          }}
        >
          <div style={{ width: '100%', maxWidth: 440 }}>
            <div style={{ marginBottom: 36 }}>
              <Title level={2} style={{ margin: '0 0 10px', color: token.colorText }}>
                Chào mừng trở lại
              </Title>
              <Text type="secondary">Đăng nhập để tiếp tục quản lý doanh nghiệp của bạn.</Text>
            </div>

            <Form layout="vertical" requiredMark={false} onFinish={handleSubmit}>
              <Form.Item
                name="workspace_id"
                label="Mã công ty"
                rules={[{ required: true, message: 'Vui lòng nhập mã công ty' }]}
              >
                <Input
                  size="large"
                  prefix={<SafetyCertificateOutlined />}
                  placeholder="Ví dụ: ANPHAT"
                  autoComplete="organization"
                />
              </Form.Item>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email chưa đúng định dạng' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  placeholder="admin@congty.vn"
                  autoComplete="email"
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                />
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '-4px 0 24px' }}>
                <Link to="/forgot-password" style={{ color: token.colorPrimary }}>
                  Quên mật khẩu?
                </Link>
              </div>

              <Form.Item style={{ marginBottom: 22 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  style={{ height: 48, fontWeight: 700, background: '#1649c9' }}
                >
                  Đăng nhập
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Chưa có tài khoản? </Text>
              <Link to="/register" style={{ color: token.colorPrimary, fontWeight: 600 }}>
                Đăng ký công ty mới
              </Link>
            </div>
          </div>
        </main>
      </Col>
    </Row>
  )
}

export default Login
