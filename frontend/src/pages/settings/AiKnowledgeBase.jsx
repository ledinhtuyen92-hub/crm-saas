import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Typography, Tag, Modal, Form, Input, Upload, message, Radio, Divider, Spin } from 'antd'
import { PlusOutlined, UploadOutlined, RobotOutlined, BookOutlined, EyeOutlined, EditOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons'
import api from '../../utils/api'

const { Title, Text } = Typography

export default function AiKnowledgeBase() {
  const [agents, setAgents] = useState([])
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [form] = Form.useForm()
  const [settingsForm] = Form.useForm()
  const [fileList, setFileList] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [companySettings, setCompanySettings] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  
  const [isViewModalVisible, setIsViewModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [currentDoc, setCurrentDoc] = useState(null)
  const [editForm] = Form.useForm()
  const [editSubmitting, setEditSubmitting] = useState(false)
  
  const docType = Form.useWatch('doc_type', form)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [agentsRes, docsRes, settingsRes] = await Promise.all([
        api.get('/ai_agents/agents/'),
        api.get('/ai_agents/knowledge/'),
        api.get('/ai_agents/settings/mine/')
      ])
      setAgents(agentsRes.data.results || agentsRes.data)
      setDocuments(docsRes.data.results || docsRes.data)
      setCompanySettings(settingsRes.data)
      settingsForm.setFieldsValue(settingsRes.data)
    } catch (err) {
      message.error('Lỗi khi tải dữ liệu Tri thức')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompanySettings = async (values) => {
    setSettingsLoading(true)
    try {
      await api.put('ai_agents/settings/mine/', values)
      message.success('Đã lưu cấu hình Hệ thống Đọc')
      fetchData()
    } catch (error) {
      console.error(error)
      message.error(error.response?.data?.detail || 'Lỗi khi lưu cấu hình')
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id) => {
    try {
      await api.delete(`/ai_agents/knowledge/${id}/`)
      message.success('Đã xóa tài liệu')
      fetchData()
    } catch (err) {
      message.error('Lỗi khi xóa tài liệu')
    }
  }

  const handleRetry = async (id) => {
    try {
      await api.post(`/ai_agents/knowledge/${id}/retry/`)
      message.success('Đã gửi yêu cầu học lại')
      fetchData()
    } catch (err) {
      message.error('Lỗi khi yêu cầu học lại')
    }
  }

  const handleView = (record) => {
    if (record.doc_type === 'file' && record.file_attachment) {
      window.open(record.file_attachment, '_blank')
    } else {
      setCurrentDoc(record)
      setIsViewModalVisible(true)
    }
  }

  const handleEdit = (record) => {
    setCurrentDoc(record)
    editForm.setFieldsValue({
      title: record.title,
      agent: record.agent,
      content: record.content
    })
    setIsEditModalVisible(true)
  }

  const handleSaveEdit = async (values) => {
    setEditSubmitting(true)
    try {
      await api.patch(`/ai_agents/knowledge/${currentDoc.id}/`, values)
      message.success('Đã lưu thông tin tài liệu')
      setIsEditModalVisible(false)
      fetchData()
    } catch (err) {
      message.error('Lỗi khi sửa tài liệu')
    } finally {
      setEditSubmitting(false)
    }
  }

  const handleFinish = async (values) => {
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('title', values.title)
      formData.append('agent', values.agent)
      formData.append('doc_type', values.doc_type)
      
      if (docType === 'file' && fileList.length > 0) {
        formData.append('file_attachment', fileList[0].originFileObj || fileList[0])
      } else if (values.doc_type === 'qa') {
        formData.append('content', values.content)
      }

      await api.post('/ai_agents/knowledge/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      message.success('Đã thêm tài liệu, hệ thống đang tiến hành học (Mã hóa Vector ngầm)')
      setIsModalVisible(false)
      form.resetFields()
      setFileList([])
      fetchData()
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi khi lưu tài liệu')
    } finally {
      setSubmitting(false)
    }
  }

  const columns = [
    {
      title: 'Tiêu đề tài liệu',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space>
          {record.doc_type === 'file' ? <BookOutlined style={{color: '#1890ff'}} /> : <RobotOutlined style={{color: '#52c41a'}}/>}
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Trợ lý AI',
      dataIndex: 'agent',
      key: 'agent',
      render: (agentId) => {
        const agent = agents.find(a => a.id === agentId)
        return <Tag color="blue">{agent ? agent.name : 'Unknown'}</Tag>
      }
    },
    {
      title: 'Loại',
      dataIndex: 'doc_type',
      key: 'doc_type',
      render: (type) => type === 'file' ? 'File PDF/Word' : 'Hỏi & Đáp'
    },
    {
      title: 'Trạng thái học',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        let color = 'default'
        let text = status
        if (status === 'pending') { color = 'default'; text = 'Chờ xử lý' }
        else if (status === 'processing') { color = 'processing'; text = 'Đang học (Embedding)...' }
        else if (status === 'completed') { color = 'success'; text = 'Đã học xong' }
        else if (status === 'failed') { color = 'error'; text = 'Lỗi' }
        
        let errorMsg = record.error_message || ''
        if (errorMsg) {
          if (errorMsg.includes('401')) errorMsg = 'Lỗi 401: Chìa khóa API (API Key) không hợp lệ hoặc bị từ chối.'
          else if (errorMsg.includes('429')) errorMsg = 'Lỗi 429: Tài khoản AI đã hết tiền (Quota) hoặc gửi quá nhanh.'
          else if (errorMsg.includes('503')) errorMsg = 'Lỗi 503: Máy chủ AI quá tải (Thường gặp ở tài khoản Free). Vui lòng thử lại.'
          else if (errorMsg.includes('500')) errorMsg = 'Lỗi 500: Máy chủ OpenAI đang gặp sự cố.'
        }
        
        return (
          <Space direction="vertical" size={0}>
            <Tag color={color}>{text}</Tag>
            {status === 'failed' && <Text type="danger" style={{fontSize: 12}}>{errorMsg}</Text>}
          </Space>
        )
      }
    },
    {
      title: 'Nền tảng đọc',
      dataIndex: 'embedding_provider',
      key: 'embedding_provider',
      render: (provider) => (
        <Tag color={provider === 'gemini' ? 'purple' : 'geekblue'}>
          {provider === 'gemini' ? 'Google Gemini' : 'OpenAI'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Button type="text" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          {record.status === 'failed' && (
            <Button type="text" style={{ color: '#faad14' }} icon={<SyncOutlined />} onClick={() => handleRetry(record.id)} />
          )}
          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      )
    }
  ]

  return (
    <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>Huấn luyện Trợ lý AI (RAG)</Title>
            <Text type="secondary">Quản lý kho tri thức, tài liệu bán hàng để AI học và trả lời khách</Text>
          </div>
          <Space>
            <Button icon={<RobotOutlined />} onClick={fetchData}>Làm mới trạng thái</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
              Dạy thêm kiến thức
            </Button>
          </Space>
        </div>

        <Card 
          title={<Title level={5}><BookOutlined /> Hệ thống Đọc Dữ liệu (Embedding Model)</Title>}
          style={{ marginBottom: 24, borderRadius: 12 }}
          bordered={false}
        >
          <Spin spinning={settingsLoading}>
            <Form form={settingsForm} layout='vertical' onFinish={handleSaveCompanySettings}>
              <Text type='secondary' style={{ display: 'block', marginBottom: 12, lineHeight: '1.6' }}>
                Nền tảng được sử dụng để đọc và băm tài liệu. <b>Lưu ý:</b> Nếu thay đổi nền tảng, toàn bộ tài liệu đã đọc bằng hệ thống cũ sẽ không thể tìm kiếm được, bạn cần xóa tài liệu cũ và tải lại.
              </Text>
              
              <Form.Item name='default_embedding_provider' style={{ marginBottom: 16 }}>
                <Radio.Group style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Radio value="openai">OpenAI (1536 chiều - Đề xuất, nhanh và rẻ nhất)</Radio>
                    <Radio value="gemini">Google Gemini (768 chiều)</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              
              <div style={{ textAlign: 'left' }}>
                <Button type='primary' htmlType='submit'>
                  Lưu Hệ Thống Đọc
                </Button>
              </div>
            </Form>
          </Spin>
        </Card>

        <Card bordered={false} style={{ borderRadius: 12 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Kho tài liệu đã huấn luyện</Title>
          <Table 
            columns={columns} 
            dataSource={documents} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

      <Modal
        title="Dạy thêm kiến thức cho AI"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false)
          form.resetFields()
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ doc_type: 'file' }}
        >
          <Form.Item
            name="agent"
            label="Chọn Trợ lý AI để dạy"
            rules={[{ required: true, message: 'Vui lòng chọn trợ lý AI' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {agents.map(agent => (
                  <Radio key={agent.id} value={agent.id}>{agent.name}</Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="title"
            label="Tiêu đề tài liệu"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input placeholder="Ví dụ: Chính sách bảo hành tủ lạnh 2026" />
          </Form.Item>

          <Form.Item name="doc_type" label="Hình thức cung cấp kiến thức">
            <Radio.Group optionType="button" buttonStyle="solid">
              <Radio value="file">Tải lên File (PDF/DOCX/TXT)</Radio>
              <Radio value="qa">Nhập trực tiếp Hỏi - Đáp</Radio>
            </Radio.Group>
          </Form.Item>

          {docType === 'file' ? (
            <Form.Item label="File tài liệu">
              <Upload
                beforeUpload={() => false}
                onChange={(info) => {
                  setFileList(info.fileList.slice(-1))
                }}
                fileList={fileList}
                onRemove={() => setFileList([])}
                maxCount={1}
                accept=".pdf,.doc,.docx,.txt"
              >
                <Button icon={<UploadOutlined />}>Chọn file tải lên</Button>
              </Upload>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  * Hỗ trợ PDF, Word, Text. Backend sẽ tự động băm nhỏ và nhúng Vector.
                </Text>
              </div>
            </Form.Item>
          ) : (
            <Form.Item
              name="content"
              label="Nội dung Kiến thức (QA)"
              rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
            >
              <Input.TextArea 
                rows={6} 
                placeholder="Hỏi: Bên em có giao hàng chủ nhật không?`nĐáp: Dạ bên em có giao hàng chủ nhật nhưng thu thêm phí 50k anh nhé." 
              />
            </Form.Item>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                Lưu và Bắt đầu học
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>

      {/* View Modal */}
      <Modal
        title={currentDoc?.title || "Xem tài liệu"}
        open={isViewModalVisible}
        onCancel={() => setIsViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsViewModalVisible(false)}>Đóng</Button>
        ]}
        width={600}
      >
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, minHeight: 200, whiteSpace: 'pre-wrap' }}>
          {currentDoc?.content}
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Sửa thông tin tài liệu"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleSaveEdit}
        >
          <Form.Item
            name="title"
            label="Tiêu đề tài liệu"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="agent"
            label="Chọn Trợ lý AI"
            rules={[{ required: true, message: 'Vui lòng chọn trợ lý AI' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                {agents.map(agent => (
                  <Radio key={agent.id} value={agent.id}>{agent.name}</Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>

          {currentDoc?.doc_type === 'qa' && (
            <Form.Item
              name="content"
              label="Nội dung Kiến thức (QA)"
              rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
              extra="Lưu ý: Thay đổi nội dung sẽ yêu cầu AI phải học lại từ đầu."
            >
              <Input.TextArea rows={6} />
            </Form.Item>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <Space>
              <Button onClick={() => setIsEditModalVisible(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={editSubmitting}>
                Lưu thay đổi
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </div>
  )
}