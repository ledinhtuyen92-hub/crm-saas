import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import api from '../../utils/api'

const { Title, Text, Paragraph } = Typography

export default function FacebookConfigPage() {
  const { maintenanceMode } = useAuth()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(null)
  const [editingPage, setEditingPage] = useState(null)
  const [form] = Form.useForm()

  const fetchPages = async () => {
    setLoading(true)
    try {
      const res = await api.get('/facebook/pages/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setPages(data)
    } catch { message.error('Không thể tải danh sách Trang Facebook.') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPages() }, [])

  const handleOpenModal = (page = null) => {
    if (maintenanceMode) {
      message.warning('⚠️ Hệ thống đang bảo trì. Chức năng tạm khóa!')
      return
    }
    setEditingPage(page)
    if (page) {
      form.setFieldsValue({
        page_name: page.page_name,
        page_id: page.page_id,
        page_access_token: '',
        webhook_verify_token: page.webhook_verify_token,
        auto_create_customer_from_phone: page.auto_create_customer_from_phone,
        is_active: page.is_active,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({ is_active: true, auto_create_customer_from_phone: false })
    }
    setModalVisible(true)
  }

  const handleSave = async (values) => {
    setSaving(true)
    try {
      if (!values.page_access_token && editingPage) {
        delete values.page_access_token
      }
      if (editingPage) {
        await api.patch(`/facebook/pages/${editingPage.id}/`, values)
        message.success('Đã cập nhật cấu hình Trang Facebook!')
      } else {
        await api.post('/facebook/pages/', values)
        message.success('Đã thêm Trang Facebook thành công!')
      }
      setModalVisible(false)
      fetchPages()
    } catch (err) {
      message.error(err.response?.data?.detail || err.response?.data?.page_id?.[0] || 'Lỗi khi lưu cấu hình.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/facebook/pages/${id}/`)
      message.success('Đã xoá Trang Facebook.')
      fetchPages()
    } catch { message.error('Không thể xoá trang này.') }
  }

  const handleVerifyToken = async (page) => {
    setVerifying(page.id)
    try {
      const res = await api.post(`/facebook/pages/${page.id}/verify-token/`)
      Modal.success({
        title: 'Xác thực Token Trang Facebook',
        content: (
          <div style={{ marginTop: 12 }}>
            <p><b>Tên Trang trên Facebook:</b> {res.data?.data?.page_name}</p>
            <p><b>Page ID:</b> {res.data?.data?.page_id}</p>
            <p style={{ color: '#16a34a' }}>✅ Token đang kết nối chuẩn xác với Trang Facebook này!</p>
          </div>
        )
      })
      fetchPages()
    } catch (err) {
      message.error(err.response?.data?.error || 'Token không hợp lệ hoặc đã hết hạn.')
    } finally { setVerifying(null) }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Title level={4} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#1877f2', fontSize: 22 }}>𝐟</span>
            Cấu hình Facebook Multi-Page Inbox
          </Title>
          <Text type="secondary">Kết nối các Trang Facebook (Fanpage) để nhận tin nhắn và quản lý khách hàng</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
          style={{ background: '#1877f2', borderColor: '#1877f2', borderRadius: 20 }}
        >
          Thêm Trang Facebook
        </Button>
      </div>

      {/* Webhook URL Guide */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20, borderRadius: 10 }}
        message="Cài đặt Webhook trên Meta Developers"
        description={
          <div style={{ marginTop: 6 }}>
            <p style={{ margin: '2px 0' }}>Vào <b>Meta Developers → App → Messenger → Webhooks</b>, điền các thông tin sau:</p>
            <p style={{ margin: '2px 0' }}>• <b>Callback URL:</b> <code style={{ background: '#e8f4fd', padding: '1px 6px', borderRadius: 4 }}>{window.location.origin}/api/facebook/webhook/</code></p>
            <p style={{ margin: '2px 0' }}>• <b>Verify Token:</b> Nhập bất kỳ chuỗi bí mật nào bạn tự đặt (giống với trường Verify Token trong form dưới)</p>
            <p style={{ margin: '2px 0' }}>• <b>Subscribe:</b> Chọn <code>messages</code> và <code>messaging_postbacks</code></p>
          </div>
        }
      />

      {/* Pages List */}
      {pages.length === 0 && !loading ? (
        <Card style={{ textAlign: 'center', padding: '40px 20px', borderRadius: 12 }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>𝐟</span>
          <Title level={5} style={{ color: '#6b7280' }}>Chưa kết nối Trang Facebook nào</Title>
          <Paragraph type="secondary">Thêm Fanpage Facebook để bắt đầu nhận tin nhắn và tự động hóa CRM.</Paragraph>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}
            style={{ background: '#1877f2', borderColor: '#1877f2' }}>
            Thêm Trang Facebook
          </Button>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {pages.map(page => (
            <Col span={24} key={page.id}>
              <Card
                style={{
                  borderRadius: 12,
                  border: page.is_active ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                }}
                bodyStyle={{ padding: '20px 24px' }}
              >
                <Row align="middle" gutter={16}>
                  <Col>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: page.is_active ? '#dbeafe' : '#fef3c7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, color: '#1877f2', fontWeight: 900,
                    }}>𝐟</div>
                  </Col>
                  <Col flex="auto">
                    <Text strong style={{ fontSize: 16 }}>{page.page_name}</Text>
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <Tag color={page.is_active ? 'success' : 'warning'}>
                        {page.is_active ? '✅ Đang hoạt động' : '⚠️ Tạm dừng'}
                      </Tag>
                      {page.is_token_valid
                        ? <Tag icon={<CheckCircleOutlined />} color="blue">Có Token</Tag>
                        : <Tag icon={<CloseCircleOutlined />} color="red">Chưa có Token</Tag>}
                      <Tag color="default">Page ID: {page.page_id}</Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                      {page.auto_create_customer_from_phone
                        ? '🤖 Tự động tạo KH khi phát hiện SĐT'
                        : '👆 Thêm KH thủ công'}
                    </Text>
                  </Col>
                  <Col>
                    <Space>
                      <Button
                        icon={<InfoCircleOutlined />}
                        onClick={() => handleVerifyToken(page)}
                        loading={verifying === page.id}
                        disabled={!page.is_token_valid}
                      >
                        Kiểm tra Token
                      </Button>
                      <Button icon={<SettingOutlined />} onClick={() => handleOpenModal(page)}>
                        Chỉnh sửa
                      </Button>
                      <Popconfirm
                        title="Xoá Trang Facebook này?"
                        onConfirm={() => handleDelete(page.id)}
                        okText="Xoá" cancelText="Hủy"
                      >
                        <Button danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* Modal */}
      <Modal
        open={modalVisible}
        title={editingPage ? `Chỉnh sửa: ${editingPage.page_name}` : 'Thêm Trang Facebook mới'}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={580}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="page_name" label="Tên Trang Facebook" rules={[{ required: true, message: 'Vui lòng nhập tên trang' }]}>
            <Input placeholder="VD: Cửa hàng Nội Thất ABC" />
          </Form.Item>
          <Form.Item name="page_id" label="Page ID" rules={[{ required: true, message: 'Vui lòng nhập Page ID' }]}>
            <Input placeholder="VD: 123456789012345" />
          </Form.Item>
          <Form.Item
            name="page_access_token"
            label="Page Access Token"
            tooltip="Long-Lived Page Access Token từ Meta Developers"
            rules={editingPage ? [] : [{ required: true, message: 'Vui lòng nhập Page Access Token' }]}
          >
            <Input.Password placeholder={editingPage ? "Để trống nếu không thay đổi" : "Nhập Page Access Token..."} />
          </Form.Item>
          <Form.Item
            name="webhook_verify_token"
            label="Webhook Verify Token"
            tooltip="Chuỗi bí mật bạn tự đặt, điền trùng với trên Meta Developers"
          >
            <Input placeholder="VD: mysecret_webhook_token_2025" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="is_active" label="Trạng thái" valuePropName="checked">
                <Switch checkedChildren="Hoạt động" unCheckedChildren="Tạm dừng" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="auto_create_customer_from_phone"
                label="Tự động tạo KH từ SĐT"
                valuePropName="checked"
                tooltip="Khi bật, hệ thống tự động tạo Khách hàng vào CRM khi phát hiện SĐT trong tin nhắn"
              >
                <Switch checkedChildren="🤖 Tự động" unCheckedChildren="👆 Thủ công" />
              </Form.Item>
            </Col>
          </Row>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setModalVisible(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={saving} style={{ background: '#1877f2' }}>
              {editingPage ? 'Lưu thay đổi' : 'Thêm Trang'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
