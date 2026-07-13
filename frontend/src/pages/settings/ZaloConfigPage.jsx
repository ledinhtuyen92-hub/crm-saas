import React, { useState, useEffect } from 'react'
import {
  Alert, Button, Card, Col, Collapse, Descriptions, Divider, Form, Input, InputNumber,
  message, Modal, Row, Space, Switch, Tag, Tooltip, Typography
} from 'antd'
import {
  ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  EditOutlined, InfoCircleOutlined, KeyOutlined,
  ReloadOutlined, SettingOutlined, WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import api from '../../utils/api'
import { useAuth } from '../../contexts/AuthContext'

const { Title, Text, Paragraph } = Typography

export default function ZaloConfigPage() {
  const { maintenanceMode } = useAuth()
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [form] = Form.useForm()

  const fetchConfig = async () => {
    setLoading(true)
    try {
      const res = await api.get('/zalo/config/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setConfig(data[0] || null)
    } catch { message.error('Không thể tải cấu hình Zalo.') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    fetchConfig()

    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    if (code) {
      // Xoá code khỏi URL ngay lập tức để tránh React StrictMode chạy 2 lần
      window.history.replaceState({}, document.title, window.location.pathname)
      setLoading(true)
      api.post('/zalo/config/exchange-oauth-code/', { code })
        .then(() => {
          message.success('Đăng nhập và cấp quyền Zalo thành công! Token đã được tự động cập nhật.')
          fetchConfig()
        })
        .catch((err) => {
          message.error(err.response?.data?.error || 'Lỗi khi đổi mã xác thực Zalo.')
          fetchConfig()
        })
    }
  }, [])

  const handleZaloOAuthLogin = () => {
    if (!config || !config.app_id) {
      message.warning('Vui lòng điền và lưu App ID trước khi bấm Uỷ quyền.')
      return
    }
    const redirectUri = window.location.origin + window.location.pathname
    const oauthUrl = `https://oauth.zaloapp.com/v4/oa/permission?app_id=${config.app_id}&redirect_uri=${encodeURIComponent(redirectUri)}`
    window.location.href = oauthUrl
  }

  const handleOpenModal = () => {
    if (maintenanceMode) { message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!'); return }
    if (config) {
      form.setFieldsValue({
        oa_name: config.oa_name,
        app_id: config.app_id,
        oa_id: config.oa_id,
        webhook_secret: '',
        access_token: config.access_token,
        refresh_token: config.refresh_token,
        auto_send_payment_zns: config.auto_send_payment_zns,
        auto_send_delivery_zns: config.auto_send_delivery_zns,
        auto_send_birthday_zns: config.auto_send_birthday_zns,
        lead_cleanup_days: config.lead_cleanup_days,
        is_active: config.is_active,
      })
    }
    setModalVisible(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (config) {
        await api.patch(`/zalo/config/${config.id}/`, values)
        message.success('Cập nhật cấu hình Zalo thành công!')
      } else {
        await api.post('/zalo/config/', values)
        message.success('Kết nối Zalo OA thành công!')
      }
      setModalVisible(false)
      fetchConfig()
    } catch (err) {
      message.error(err.response?.data?.detail || 'Lỗi khi lưu cấu hình.')
    } finally { setSaving(false) }
  }

  const handleRefreshToken = async () => {
    if (!config) return
    setRefreshing(true)
    try {
      await api.post(`/zalo/config/${config.id}/refresh-token/`)
      message.success('Token đã được làm mới!')
      fetchConfig()
    } catch {
      message.error('Không thể làm mới token. Vui lòng kiểm tra refresh_token.')
    } finally { setRefreshing(false) }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApiOutlined style={{ color: '#0068ff' }} />
            Cấu hình Zalo OA
          </Title>
          <Text type="secondary">Kết nối Official Account Zalo để nhận Lead và gửi ZNS tự động</Text>
        </div>
        <Button
          type="primary"
          icon={<SettingOutlined />}
          onClick={handleOpenModal}
          style={{ background: '#0068ff', borderColor: '#0068ff' }}
        >
          {config ? 'Chỉnh sửa cấu hình' : 'Kết nối Zalo OA'}
        </Button>
      </div>

      {!config ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 12 }}>
          <ApiOutlined style={{ fontSize: 48, color: '#d1d5db', marginBottom: 16, display: 'block' }} />
          <Title level={5} style={{ color: '#6b7280' }}>Chưa kết nối Zalo OA</Title>
          <Paragraph type="secondary" style={{ maxWidth: 400, margin: '0 auto 20px' }}>
            Kết nối Zalo Official Account để bắt đầu nhận Lead tự động từ Zalo và gửi thông báo ZNS đến khách hàng.
          </Paragraph>
          <Button type="primary" icon={<ApiOutlined />} onClick={handleOpenModal}
            style={{ background: '#0068ff', borderColor: '#0068ff' }}>
            Kết nối ngay
          </Button>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {/* Card trạng thái kết nối */}
          <Col span={24}>
            <Card
              style={{ borderRadius: 12, border: config.is_active ? '1px solid #bbf7d0' : '1px solid #fed7aa' }}
              bodyStyle={{ padding: '20px 24px' }}
            >
              <Row align="middle" gutter={16}>
                <Col>
                  <div style={{
                    width: 48, height: 48, borderRadius: 12,
                    background: config.is_active ? '#dcfce7' : '#fef3c7',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {config.is_active
                      ? <CheckCircleOutlined style={{ fontSize: 24, color: '#16a34a' }} />
                      : <CloseCircleOutlined style={{ fontSize: 24, color: '#d97706' }} />
                    }
                  </div>
                </Col>
                <Col flex="auto">
                  <Text strong style={{ fontSize: 16 }}>{config.oa_name}</Text>
                  <div style={{ marginTop: 2 }}>
                    <Tag color={config.is_active ? 'success' : 'warning'}>
                      {config.is_active ? '✅ Đang hoạt động' : '⚠️ Tạm dừng'}
                    </Tag>
                    {config.is_token_near_expiry && (
                      <Tag color="error" icon={<WarningOutlined />}>Token sắp hết hạn!</Tag>
                    )}
                  </div>
                </Col>
                <Col>
                  <Space>
                    <Button
                      type="primary"
                      onClick={handleZaloOAuthLogin}
                      style={{ background: '#0068ff', borderColor: '#0068ff' }}
                    >
                      Đăng nhập & Lấy Token tự động
                    </Button>
                    <Button
                      icon={<ReloadOutlined />}
                      loading={refreshing}
                      onClick={handleRefreshToken}
                    >
                      Làm mới Token
                    </Button>
                  </Space>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Thông báo hướng dẫn Callback URL cho Zalo OAuth */}
          <Col span={24}>
            <Alert
              type="info"
              showIcon
              message="Cấu hình Callback URL trên Zalo Developers"
              description={
                <div>
                  Để nút <b>Đăng nhập & Lấy Token tự động</b> không bị lỗi <code>Invalid redirect uri (-14003)</code>, bạn hãy vào trang <a href="https://developers.zalo.me" target="_blank" rel="noreferrer">Zalo Developers</a> &gt; App của bạn &gt; <b>Cài đặt (Settings)</b> &gt; điền chính xác đường dẫn sau vào ô <b>Official Account Callback Url</b>:
                  <div style={{ marginTop: 8, background: '#f3f4f6', padding: '6px 12px', borderRadius: 6, display: 'inline-block', fontWeight: 600, color: '#1f2937' }}>
                    {window.location.origin + window.location.pathname}
                  </div>
                </div>
              }
            />
          </Col>

          {/* Thông tin chi tiết */}
          <Col span={24}>
            <Card style={{ borderRadius: 12 }} title={<><InfoCircleOutlined style={{ marginRight: 8 }} />Chi tiết kết nối</>}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="App ID">
                  <Text code>{config.app_id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="OA ID">
                  <Text code>{config.oa_id || '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Token hết hạn" span={2}>
                  {config.token_expires_at_display || '—'}
                  {config.is_token_near_expiry && (
                    <Tag color="error" style={{ marginLeft: 8 }}>Cần refresh!</Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Divider style={{ margin: '16px 0' }} />

              <Alert
                type="info"
                showIcon
                message="Cấu hình Webhook"
                description={
                  <div>
                    <div>Cài đặt URL Webhook sau vào trang Zalo Developers:</div>
                    <Text code style={{ display: 'block', marginTop: 8, wordBreak: 'break-all' }}>
                      {window.location.origin}/api/zalo/webhook/
                    </Text>
                  </div>
                }
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Modal Form */}
      <Modal
        title={
          <Space>
            <SettingOutlined style={{ color: '#0068ff' }} />
            {config ? 'Chỉnh sửa cấu hình Zalo OA' : 'Kết nối Zalo Official Account'}
          </Space>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="Lưu cấu hình"
        cancelText="Huỷ"
        confirmLoading={saving}
        width={560}
        okButtonProps={{ style: { background: '#0068ff', borderColor: '#0068ff' } }}
      >
        <Alert
          type="info" showIcon style={{ marginBottom: 20 }}
          message="Lấy thông tin App ID và Secret Key từ trang Zalo for Developers tại: developers.zalo.me"
        />
        <Form form={form} layout="vertical">
          <Form.Item name="oa_name" label="Tên Zalo OA" rules={[{ required: true, message: 'Vui lòng nhập tên OA' }]}>
            <Input placeholder="VD: Fujitech Door Official" prefix={<ApiOutlined />} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="app_id" label="App ID" rules={[{ required: true, message: 'Bắt buộc' }]}>
                <Input placeholder="App ID từ Zalo Dev" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="oa_id" label="OA ID">
                <Input placeholder="Official Account ID" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="secret_key"
            label={<span>App Secret Key <Text type="secondary" style={{ fontSize: 11 }}>(để trống nếu không đổi)</Text></span>}
          >
            <Input.Password placeholder="Nhập Secret Key..." prefix={<KeyOutlined />} />
          </Form.Item>
          <Collapse
            ghost
            items={[
              {
                key: '1',
                label: <Text type="secondary" style={{ fontSize: 13 }}>⚙️ Cấu hình nâng cao (Webhook Secret & Token thủ công)</Text>,
                children: (
                  <>
                    <Form.Item name="webhook_secret" label={<span>Webhook Secret <Tooltip title="Dùng để bảo mật Webhook (tuỳ chọn)"><InfoCircleOutlined /></Tooltip></span>}>
                      <Input.Password placeholder="Webhook secret (tùy chọn)" />
                    </Form.Item>
                    <Form.Item name="access_token" label="Access Token thủ công (Nếu không dùng nút Đăng nhập tự động)">
                      <Input.TextArea rows={2} placeholder="Nhập Access Token (nếu có)" />
                    </Form.Item>
                    <Form.Item name="refresh_token" label="Refresh Token thủ công">
                      <Input.TextArea rows={2} placeholder="Nhập Refresh Token" />
                    </Form.Item>
                  </>
                ),
              },
            ]}
          />

          <Divider orientation="left" plain>Cấu hình Tự động & Dọn dẹp</Divider>
          <Form.Item name="auto_send_payment_zns" label="Tự động gửi ZNS khi Thu tiền" valuePropName="checked">
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
          <Form.Item name="auto_send_delivery_zns" label="Tự động gửi ZNS khi Hoàn thành đơn" valuePropName="checked">
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
          <Form.Item name="auto_send_birthday_zns" label="Tự động gửi ZNS chúc mừng sinh nhật" valuePropName="checked" help="Chạy tự động lúc 08:00 sáng mỗi ngày.">
            <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
          </Form.Item>
          <Form.Item
            name="lead_cleanup_days"
            label="Số ngày dọn dẹp Lead rác"
            rules={[{ required: true, message: 'Vui lòng nhập số ngày' }]}
            help="SocialLead không tương tác sau số ngày này sẽ bị ẩn (archived)."
          >
            <InputNumber min={1} max={365} style={{ width: '100%' }} suffix="ngày" />
          </Form.Item>

          <Divider />
          <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tạm dừng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
