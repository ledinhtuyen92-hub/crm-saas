import { useState, useEffect } from 'react'
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Form,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
  theme,
} from 'antd'
import api from '../../utils/api'
import SubscriptionPlanManager from './SubscriptionPlanManager'
import { useAuth } from '../../contexts/AuthContext'

const { Title, Text } = Typography

export default function AdminSettings() {
  const { token } = theme.useToken()
  const { refreshSettings } = useAuth()
  const [messageApi, contextHolder] = message.useMessage()
  const [loading, setLoading] = useState(false)

  const [form] = Form.useForm()
  const currentPlan = Form.useWatch('default_plan', form)

  const [plans, setPlans] = useState([])

  const handlePlanChange = (value) => {
    const selectedPlan = plans.find(p => p.code === value)
    if (selectedPlan) {
      form.setFieldsValue({ default_user_limit: selectedPlan.user_limit })
    }
  }

  const handlePlansChange = (newPlans) => {
    setPlans(newPlans)
  }

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('users/system-settings/')
        form.setFieldsValue({
          require_strong_password: res.data.require_strong_password,
          enable_public_registration: res.data.enable_public_registration,
          default_plan: res.data.default_plan,
          default_user_limit: res.data.default_user_limit,
          tenant_isolation_mode: res.data.tenant_isolation_mode,
          jwt_expiration_hours: res.data.jwt_expiration_hours,
          max_file_upload_mb: res.data.max_file_upload_mb,
          maintenance_mode: res.data.maintenance_mode,
        })
      } catch (err) {
        console.error("Failed to fetch system settings:", err)
      }
    }
    fetchSettings()
  }, [form])

  const handleSave = async (values) => {
    setLoading(true)
    try {
      await api.patch('users/system-settings/', {
        require_strong_password: values.require_strong_password,
        enable_public_registration: values.enable_public_registration,
        default_plan: values.default_plan,
        default_user_limit: values.default_user_limit,
        tenant_isolation_mode: values.tenant_isolation_mode,
        jwt_expiration_hours: values.jwt_expiration_hours,
        max_file_upload_mb: values.max_file_upload_mb,
        maintenance_mode: values.maintenance_mode,
      })
      if (refreshSettings) refreshSettings()
      messageApi.success('Đã lưu cấu hình hệ thống SaaS thành công!')
    } catch (err) {
      console.error(err)
      messageApi.error('Lưu cấu hình thất bại!')
    } finally {
      setLoading(false)
    }
  }

  const cardStyle = {
    borderRadius: 12,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)',
    marginBottom: 20,
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {contextHolder}

      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: 16,
          padding: '24px 28px',
          marginBottom: 24,
          color: '#ffffff',
          boxShadow: '0 14px 34px rgba(15, 23, 42, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <Space align="center" size={12}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(245, 158, 11, 0.35)',
            }}
          >
            <SettingOutlined style={{ fontSize: 24, color: '#ffffff' }} />
          </div>
          <div>
            <Title level={3} style={{ color: '#ffffff', margin: 0, fontWeight: 800 }}>
              Cấu hình Hệ thống SaaS & Gói Hạn mức
            </Title>
            <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
              Thiết lập tham số nền tảng, giới hạn người dùng và chính sách bảo mật đa khách hàng (Multi-tenant)
            </Text>
          </div>
        </Space>

        <Button
          type="primary"
          size="large"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={() => form.submit()}
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            border: 0,
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
          }}
        >
          Lưu Cấu Hình
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          default_user_limit: 5,
          default_plan: 'starter',
          jwt_expiration_hours: 24,
          tenant_isolation_mode: 'strict',
          max_file_upload_mb: 25,
          maintenance_mode: false,
        }}
      >
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={14}>
            <Card style={cardStyle} title={<Text style={{ fontWeight: 700, fontSize: 16 }}>📦 Quản lý Gói Đăng ký & Hạn mức mặc định</Text>}>
              <Alert
                message="Chính sách hạn mức người dùng (License Seats Policy)"
                description="Hệ thống tự động kiểm soát số lượng tài khoản nhân viên được phép tạo trong mỗi Workspace công ty. Khi đạt giới hạn, quản trị viên công ty sẽ nhận cảnh báo yêu cầu nâng gói."
                type="info"
                showIcon
                style={{ marginBottom: 20, borderRadius: 8 }}
              />

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="default_plan"
                    label="Gói mặc định khi tự đăng ký mới"
                    tooltip="Gói được gán tự động khi khách hàng đăng ký qua trang /register"
                  >
                    <Select size="large" onChange={handlePlanChange}>
                      {plans.map(p => (
                        <Select.Option key={p.code} value={p.code}>
                          {p.name} ({p.user_limit === 99999 ? 'Không giới hạn' : `${p.user_limit} user`})
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="default_user_limit"
                    label="Số tài khoản mặc định (Trial Seat Limit)"
                    rules={[{ required: true, message: 'Vui lòng nhập số user' }]}
                  >
                    <InputNumber 
                      size="large" 
                      min={1} 
                      max={999999} 
                      style={{ width: '100%' }} 
                      addonAfter="tài khoản" 
                      disabled={true} // Vô hiệu hóa, limit phụ thuộc vào gói đã chọn
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="enable_public_registration"
                label="Cho phép các doanh nghiệp mới tự đăng ký (Public Registration)"
                valuePropName="checked"
              >
                <Switch checkedChildren="Mở tự đăng ký" unCheckedChildren="Khóa (Chỉ Admin tạo)" />
              </Form.Item>
              
              <Divider />
              
              <SubscriptionPlanManager onPlansChange={handlePlansChange} />

              <Divider />

              <Title level={5} style={{ marginBottom: 12, fontWeight: 700 }}>
                📋 Bảng thông số Các gói Dịch vụ SaaS (Tiers Overview)
              </Title>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <Row gutter={[12, 12]}>
                  <Col span={6}>
                    <Tag color="blue" style={{ fontWeight: 700 }}>Starter</Tag>
                    <Text style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Tối đa 5 nhân viên</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Dành cho nhóm nhỏ</Text>
                  </Col>
                  <Col span={6}>
                    <Tag color="cyan" style={{ fontWeight: 700 }}>Standard</Tag>
                    <Text style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Tối đa 15 nhân viên</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Được ưa chuộng nhất</Text>
                  </Col>
                  <Col span={6}>
                    <Tag color="purple" style={{ fontWeight: 700 }}>Professional</Tag>
                    <Text style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Tối đa 50 nhân viên</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Dành cho công ty vừa</Text>
                  </Col>
                  <Col span={6}>
                    <Tag color="gold" style={{ fontWeight: 700 }}>Enterprise</Tag>
                    <Text style={{ display: 'block', fontSize: 12, marginTop: 4 }}>Không giới hạn (∞)</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Tùy chỉnh VIP</Text>
                  </Col>
                </Row>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card style={cardStyle} title={<Text style={{ fontWeight: 700, fontSize: 16 }}>🛡️ Bảo mật & Cô lập Dữ liệu Multi-Tenant</Text>}>
              <Form.Item
                name="tenant_isolation_mode"
                label="Chế độ Cô lập Dữ liệu (Tenant Isolation Mode)"
              >
                <Select size="large">
                  <Select.Option value="strict">Strict RBAC (Mỗi Workspace hoàn toàn cô lập)</Select.Option>
                  <Select.Option value="flexible">Flexible (Cho phép liên kết đối tác)</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="jwt_expiration_hours"
                label="Thời gian hết hạn Phiên làm việc (JWT Token Timeout)"
              >
                <Select size="large">
                  <Select.Option value={12}>12 giờ (Tiêu chuẩn)</Select.Option>
                  <Select.Option value={24}>24 giờ (Khuyên dùng)</Select.Option>
                  <Select.Option value={72}>72 giờ (Dài hạn)</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                name="max_file_upload_mb"
                label="Dung lượng tải file tối đa cho mỗi tài liệu (Media File Size)"
              >
                <InputNumber size="large" min={5} max={100} style={{ width: '100%' }} addonAfter="MB" />
              </Form.Item>

              <Form.Item
                name="require_strong_password"
                label="Yêu cầu mật khẩu mạnh cho toàn hệ thống"
                valuePropName="checked"
              >
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>

              <Divider />

              <Form.Item
                name="maintenance_mode"
                label={
                  <Space>
                    <Text style={{ fontWeight: 700, color: '#dc2626', fontSize: 14 }}>
                      🛑 Chế độ Bảo trì Hệ thống (Khóa thao tác thêm/sửa/xóa dữ liệu)
                    </Text>
                  </Space>
                }
                valuePropName="checked"
                help="Khi bật, toàn bộ chức năng thêm, sửa, xóa dữ liệu trên hệ thống sẽ bị khóa để bảo trì kỹ thuật (trừ System Admin). Các tính năng xem, tra cứu và báo cáo vẫn hoạt động bình thường."
              >
                <Switch 
                  checkedChildren="ĐANG BẢO TRÌ" 
                  unCheckedChildren="Hoạt động bình thường" 
                  style={{ backgroundColor: Form.useWatch('maintenance_mode', form) ? '#dc2626' : undefined }}
                />
              </Form.Item>
            </Card>

            <Card style={cardStyle} title={<Text style={{ fontWeight: 700, fontSize: 16 }}>⚡ Trạng thái Nền tảng SaaS</Text>}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><ThunderboltOutlined style={{ color: '#10b981' }} /><Text>CRM SaaS Core Engine</Text></Space>
                  <Tag color="success" icon={<CheckCircleOutlined />}>v2.5 Enterprise</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><DatabaseOutlined style={{ color: '#3b82f6' }} /><Text>PostgreSQL Tenant Pool</Text></Space>
                  <Tag color="processing">Connected (0.2ms)</Tag>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><SafetyCertificateOutlined style={{ color: '#8b5cf6' }} /><Text>RBAC Security Shield</Text></Space>
                  <Tag color="purple">Active & Protected</Tag>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  )
}
