import {
  AppstoreOutlined,
  BankOutlined,
  IdcardOutlined,
  LockOutlined,
  MailOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Col, Form, Input, Row, Space, Typography, message, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import authTechnology from '../assets/auth-technology.png'

const { Paragraph, Text, Title } = Typography

function RegisterCompany() {
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const [messageApi, contextHolder] = message.useMessage()

  const handleSubmit = async (allValues) => {
    // Loại bỏ confirm_password trước khi gửi API
    // eslint-disable-next-line no-unused-vars
    const { confirm_password, ...values } = allValues
    try {
      await api.post('/users/register-company/', {
        ...values,
        username: values.email.split('@')[0],
      })
      messageApi.success('Đăng ký công ty thành công. Bạn có thể đăng nhập ngay.')
      navigate('/login')
    } catch (error) {
      const responseData = error.response?.data
      const firstError = responseData && Object.values(responseData).flat()[0]
      messageApi.error(firstError || 'Không thể đăng ký công ty. Vui lòng thử lại.')
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
          <div style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ marginBottom: 28 }}>
              <Title level={2} style={{ margin: '0 0 10px', color: token.colorText }}>
                Khởi tạo doanh nghiệp
              </Title>
              <Text type="secondary">Thiết lập không gian làm việc của bạn chỉ trong vài phút.</Text>
            </div>

            <Form layout="vertical" requiredMark={false} onFinish={handleSubmit}>
              <Form.Item
                name="company_name"
                label="Tên công ty"
                rules={[{ required: true, message: 'Vui lòng nhập tên công ty' }]}
              >
                <Input size="large" prefix={<BankOutlined />} placeholder="Công ty TNHH An Phát" />
              </Form.Item>
              <Form.Item
                name="tax_code"
                label="Mã số thuế"
                rules={[{ required: true, message: 'Vui lòng nhập mã số thuế' }]}
              >
                <Input size="large" prefix={<IdcardOutlined />} placeholder="Nhập mã số thuế" />
              </Form.Item>
              <Form.Item
                name="full_name"
                label="Họ tên Giám đốc"
                rules={[{ required: true, message: 'Vui lòng nhập họ tên Giám đốc' }]}
              >
                <Input size="large" prefix={<UserOutlined />} placeholder="Nguyễn Văn An" />
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
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="password"
                    label="Mật khẩu"
                    rules={[
                      { required: true, message: 'Vui lòng nhập mật khẩu' },
                      { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' },
                    ]}
                  >
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined />}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="confirm_password"
                    label="Xác nhận mật khẩu"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) return Promise.resolve()
                          return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                        },
                      }),
                    ]}
                  >
                    <Input.Password
                      size="large"
                      prefix={<LockOutlined />}
                      placeholder="Nhập lại mật khẩu"
                      autoComplete="new-password"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item style={{ margin: '4px 0 22px' }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  block
                  style={{ height: 48, fontWeight: 700, background: '#1649c9' }}
                >
                  Tạo tài khoản doanh nghiệp
                </Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Đã có tài khoản? </Text>
              <Link to="/login" style={{ color: token.colorPrimary, fontWeight: 600 }}>
                Đăng nhập ngay
              </Link>
            </div>
          </div>
        </main>
      </Col>
    </Row>
  )
}

export default RegisterCompany
