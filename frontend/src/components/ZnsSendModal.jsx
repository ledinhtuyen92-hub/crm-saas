import React, { useState, useEffect } from 'react'
import { Modal, Form, Select, Input, Alert, message, Button, Space, Typography, Divider } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import api from '../utils/api'

const { Option } = Select
const { Text, Paragraph } = Typography

export default function ZnsSendModal({ visible, onCancel, customer, customers, defaultTemplateType, defaultParams = {} }) {
  const [form] = Form.useForm()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  useEffect(() => {
    if (visible) {
      fetchTemplates()
      form.resetFields()
      setSelectedTemplate(null)
    }
  }, [visible])

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await api.get('/zalo/templates/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      const activeTemplates = data.filter(t => t.is_active)
      setTemplates(activeTemplates)
      
      if (defaultTemplateType) {
        const match = activeTemplates.find(t => t.template_type === defaultTemplateType)
        if (match) {
          form.setFieldsValue({ template_id: match.id })
          handleTemplateChange(match.id, activeTemplates)
        }
      }
    } catch {
      message.error('Lỗi tải danh sách Mẫu ZNS.')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateChange = (templateId, tplList = templates) => {
    const tpl = tplList.find(t => t.id === templateId)
    setSelectedTemplate(tpl)
    if (tpl && tpl.params_schema) {
      const initialParams = { ...defaultParams }
      // Chỉ auto-fill nếu gửi 1 người. Nếu gửi bulk, backend sẽ lo.
      if (customer && !customers) {
        Object.keys(tpl.params_schema).forEach(key => {
          if (!initialParams[key]) {
            if (key.includes('name') || key.includes('ten')) {
              initialParams[key] = customer.full_name || customer.name || ''
            }
          }
        })
      }
      form.setFieldsValue({ dynamic_params: initialParams })
    }
  }

  const handleSend = async () => {
    const isBulk = customers && customers.length > 0
    if (!isBulk && !customer?.phone) {
      message.error('Khách hàng này chưa có số điện thoại để gửi ZNS!')
      return
    }

    try {
      const values = await form.validateFields()
      setSending(true)
      
      if (isBulk) {
        const payload = {
          template_id: values.template_id,
          customer_ids: customers.map(c => c.id),
          params: values.dynamic_params || {}
        }
        const res = await api.post('/zalo/templates/bulk-send/', payload)
        message.success(res.data.detail || 'Đã đưa vào hàng đợi gửi ZNS hàng loạt!')
      } else {
        const payload = {
          template_id: values.template_id,
          recipient_phone: customer.phone,
          customer_id: customer.id,
          params: values.dynamic_params || {}
        }
        await api.post('/zalo/templates/send/', payload)
        message.success('Đã đưa vào hàng đợi gửi ZNS thành công!')
      }
      
      onCancel()
    } catch (err) {
      if (err.errorFields) return
      message.error(err.response?.data?.detail || 'Lỗi khi gửi ZNS.')
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal
      title={
        <Space>
          <MessageOutlined style={{ color: '#10b981' }} />
          <span>{customers && customers.length > 0 ? `Gửi ZNS Hàng loạt (${customers.length} khách hàng)` : 'Gửi thông báo Zalo ZNS'}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>Hủy</Button>,
        <Button 
          key="send" 
          type="primary" 
          icon={<MessageOutlined />} 
          loading={sending} 
          onClick={handleSend}
          style={{ background: '#10b981', borderColor: '#10b981' }}
        >
          Gửi ZNS
        </Button>
      ]}
      width={600}
      destroyOnClose
    >
      <Alert
        type="info"
        message={
          <span>
            Đang chuẩn bị gửi thông báo đến Khách hàng: <Text strong>{customer?.full_name || customer?.name}</Text> ({customer?.phone || 'Chưa có SĐT'})
          </span>
        }
        style={{ marginBottom: 24 }}
      />

      <Form form={form} layout="vertical">
        <Form.Item 
          name="template_id" 
          label="Chọn Mẫu ZNS" 
          rules={[{ required: true, message: 'Vui lòng chọn mẫu' }]}
        >
          <Select 
            placeholder="Chọn mẫu thông báo..." 
            loading={loading}
            onChange={(val) => handleTemplateChange(val)}
            showSearch
            optionFilterProp="children"
          >
            {templates.map(tpl => (
              <Option key={tpl.id} value={tpl.id}>
                {tpl.name} <Text type="secondary" style={{ fontSize: 12 }}>({tpl.zalo_template_id})</Text>
              </Option>
            ))}
          </Select>
        </Form.Item>

        {selectedTemplate && (
          <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
            <Text strong style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 8 }}>
              XEM TRƯỚC NỘI DUNG MẪU
            </Text>
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {selectedTemplate.content_preview || <Text type="secondary" italic>Không có nội dung xem trước</Text>}
            </Paragraph>
            <Divider style={{ margin: '12px 0' }} />
            
            <Text strong style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 12 }}>
              ĐIỀN THÔNG TIN THAM SỐ
            </Text>
            
            {selectedTemplate.params_schema && Object.keys(selectedTemplate.params_schema).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {Object.entries(selectedTemplate.params_schema).map(([key, label]) => (
                  <Form.Item 
                    key={key}
                    name={['dynamic_params', key]} 
                    label={label || key}
                    rules={[{ required: true, message: `Bắt buộc nhập ${label}` }]}
                  >
                    <Input placeholder={`Nhập ${String(label).toLowerCase()}...`} />
                  </Form.Item>
                ))}
              </div>
            ) : (
              <Alert type="success" message="Mẫu này không yêu cầu tham số động." showIcon />
            )}
          </div>
        )}
      </Form>
    </Modal>
  )
}
