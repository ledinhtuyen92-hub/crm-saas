import { useEffect, useState } from 'react'
import { Card, Typography, Switch, Button, message, Space, Divider, Alert, Input } from 'antd'
import { ApiOutlined, ReloadOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const { Title, Text, Paragraph } = Typography

export default function WebsiteIntegration() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await api.get('users/company-settings/')
      setSettings(res.data)
    } catch (error) {
      message.error('Không thể tải cài đặt.')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (checked) => {
    try {
      await api.patch('users/company-settings/', { is_website_integration_active: checked })
      setSettings(prev => ({ ...prev, is_website_integration_active: checked }))
      message.success(checked ? 'Đã bật nhận dữ liệu từ Website' : 'Đã tắt nhận dữ liệu từ Website')
    } catch (error) {
      message.error('Không thể cập nhật trạng thái.')
    }
  }

  const generateNewKey = async () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let newKey = 'crm_'
    for (let i = 0; i < 40; i++) {
      newKey += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    try {
      await api.patch('users/company-settings/', { website_api_key: newKey })
      setSettings(prev => ({ ...prev, website_api_key: newKey }))
      message.success('Đã tạo API Key mới thành công!')
    } catch (error) {
      message.error('Lỗi khi tạo API Key.')
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    message.success('Đã copy!')
  }

  const endpointUrl = `${window.location.origin.replace(':5173', ':8000')}/api/crm/webhooks/website/`

  const curlSnippet = `curl -X POST ${endpointUrl} \\
  -H "X-API-Key: ${settings?.website_api_key || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Nguyễn Văn A",
    "phone": "0987654321",
    "email": "nguyenvana@gmail.com",
    "source": "Landing Page Tet",
    "notes": "Khách quan tâm dịch vụ thiết kế",
    "utm_source": "facebook",
    "utm_medium": "cpc",
    "utm_campaign": "Tet_2026"
  }'`

  const jsSnippet = `fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${settings?.website_api_key || 'YOUR_API_KEY'}"
  },
  body: JSON.stringify({
    name: "Nguyễn Văn A",
    phone: "0987654321",
    source: "Website",
    notes: "Khách quan tâm tư vấn thiết kế",
    utm_source: "google",
    utm_medium: "search",
    utm_campaign: "Sale_T10"
  })
})
.then(res => res.json())
.then(data => console.log(data));`

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            Tích hợp Website (Webhooks)
          </Title>
          <Text type="secondary">
            Đấu nối và tự động đẩy dữ liệu khách hàng từ Website/Landing Page về CRM
          </Text>
        </div>
        <Space style={{ background: '#fff', padding: '12px 20px', borderRadius: 8, border: '1px solid #d9d9d9' }}>
          <Text strong>Trạng thái nhận dữ liệu:</Text>
          <Switch 
            checked={settings?.is_website_integration_active} 
            onChange={handleToggle} 
            checkedChildren="Đang bật"
            unCheckedChildren="Đã tắt"
          />
        </Space>
      </div>

      <Card loading={loading} style={{ borderRadius: 12, marginBottom: 24, boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          
          <Alert
            message="Bảo mật API Key"
            description="API Key này được dùng để xác thực hệ thống bên ngoài đẩy dữ liệu vào CRM của công ty bạn. Tuyệt đối không chia sẻ mã này cho người không có thẩm quyền. Nếu nghi ngờ lộ lọt, hãy bấm Tạo mã mới ngay lập tức."
            type="warning"
            showIcon
          />

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>API Endpoint URL (Đường dẫn nhận Webhook):</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={endpointUrl} readOnly size="large" />
              <Button icon={<CopyOutlined />} size="large" onClick={() => copyToClipboard(endpointUrl)}>Copy</Button>
            </div>
          </div>

          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>API Key (Token xác thực):</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input.Password value={settings?.website_api_key || ''} readOnly size="large" visibilityToggle />
              <Button icon={<CopyOutlined />} size="large" onClick={() => copyToClipboard(settings?.website_api_key)}>Copy</Button>
              <Button type="primary" danger icon={<ReloadOutlined />} size="large" onClick={generateNewKey}>
                Tạo mã mới
              </Button>
            </div>
            {!settings?.website_api_key && (
              <Text type="danger" style={{ marginTop: 8, display: 'block' }}>* Hiện tại chưa có mã xác thực. Vui lòng bấm Tạo mã mới.</Text>
            )}
          </div>
          
        </Space>
      </Card>

      <Title level={4}>Tài liệu Hướng dẫn Gửi dữ liệu (Dành cho Developer)</Title>
      
      <Card style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(15,23,42,0.08)' }}>
        <Title level={5}>Yêu cầu bắt buộc:</Title>
        <ul>
          <li><strong>Method:</strong> POST</li>
          <li><strong>Header:</strong> <code>X-API-Key</code> phải chứa mã API Key ở trên.</li>
          <li><strong>Body (JSON):</strong> Bắt buộc phải truyền lên tham số <code>phone</code> (Số điện thoại). Các tham số khác (name, email, notes, source, utm_source, utm_medium, utm_campaign...) là tùy chọn.</li>
        </ul>
        <Divider />
        
        <Title level={5}>Ví dụ dùng cURL:</Title>
        <div style={{ position: 'relative' }}>
          <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
            {curlSnippet}
          </pre>
          <Button 
            icon={<CopyOutlined />} 
            size="small" 
            style={{ position: 'absolute', top: 12, right: 12 }}
            onClick={() => copyToClipboard(curlSnippet)}
          >Copy</Button>
        </div>

        <Title level={5} style={{ marginTop: 24 }}>Ví dụ dùng JavaScript (Fetch API):</Title>
        <div style={{ position: 'relative' }}>
          <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: 16, borderRadius: 8, overflowX: 'auto' }}>
            {jsSnippet}
          </pre>
          <Button 
            icon={<CopyOutlined />} 
            size="small" 
            style={{ position: 'absolute', top: 12, right: 12 }}
            onClick={() => copyToClipboard(jsSnippet)}
          >Copy</Button>
        </div>

      </Card>
    </div>
  )
}
