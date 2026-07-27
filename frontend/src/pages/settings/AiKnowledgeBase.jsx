import { useState, useEffect } from 'react'
import { Card, Table, Button, Space, Typography, Tag, Modal, Form, Input, Upload, message, Radio, Divider, Spin, Collapse, Alert, Checkbox } from 'antd'
import { PlusOutlined, UploadOutlined, RobotOutlined, BookOutlined, EyeOutlined, EditOutlined, SyncOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons'
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
  const [manualSyncing, setManualSyncing] = useState(false)
  const [companySettings, setCompanySettings] = useState(null)
  const [settingsLoading, setSettingsLoading] = useState(false)
  
  const [isViewModalVisible, setIsViewModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [currentDoc, setCurrentDoc] = useState(null)
  const [editForm] = Form.useForm()
  const [editSubmitting, setEditSubmitting] = useState(false)
  
  const docType = Form.useWatch('doc_type', form)

  const fetchData = async (showLoading = true) => {
    if (showLoading) setLoading(true)
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
      if (showLoading) message.error('Lỗi khi tải dữ liệu Tri thức')
    } finally {
      if (showLoading) setLoading(false)
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

  const handleManualSyncProducts = async () => {
    setManualSyncing(true)
    try {
      const res = await api.post('ai_agents/settings/manual_sync_products/')
      message.success(res.data.status || 'Đã gửi yêu cầu đồng bộ danh sách sản phẩm thành công')
      fetchData()
      
      // Bắt đầu poll trạng thái file
      const checkInterval = setInterval(async () => {
         try {
            const fetchRes = await api.get('ai_agents/knowledge/')
            const docs = fetchRes.data.results || fetchRes.data
            const targetDoc = docs.find(d => d.title === 'Danh mục Sản phẩm Hệ thống (Auto)')
            if (targetDoc && targetDoc.status !== 'pending') {
                clearInterval(checkInterval)
                setManualSyncing(false)
                setDocuments(docs)
                message.success('Tiến trình đồng bộ dữ liệu đã hoàn tất!')
            }
         } catch (e) {
            clearInterval(checkInterval)
            setManualSyncing(false)
         }
      }, 3000)
    } catch (err) {
      message.error('Lỗi khi yêu cầu đồng bộ Sản phẩm')
      setManualSyncing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const hasPending = documents.some(doc => doc.status === 'pending' || doc.status === 'processing')
    let interval = null
    if (hasPending) {
      interval = setInterval(() => {
        fetchData(false)
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [documents])

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
      filters: agents.map(a => ({ text: a.name, value: a.id })),
      onFilter: (value, record) => record.agent === value,
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
      filters: [
        { text: 'Đã học xong', value: 'completed' },
        { text: 'Chờ xử lý', value: 'pending' },
        { text: 'Đang học', value: 'processing' },
        { text: 'Lỗi', value: 'failed' }
      ],
      onFilter: (value, record) => record.status === value,
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
      filters: [
        { text: 'OpenAI', value: 'openai' },
        { text: 'Google Gemini', value: 'gemini' }
      ],
      onFilter: (value, record) => record.embedding_provider === value,
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
          {(record.status === 'failed' || record.status === 'completed') && (
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

        <Collapse 
          style={{ marginBottom: 24, borderRadius: 12, border: '1px solid #1677ff40' }}
          items={[
            {
              key: '1',
              label: <Text strong style={{ color: '#1677ff' }}><BulbOutlined style={{ marginRight: 8 }}/> Bí kíp Huấn luyện Trợ lý AI & Chuẩn bị tài liệu</Text>,
              children: (
                <div style={{ lineHeight: '1.8' }}>
                  <Alert 
                    type="warning" 
                    showIcon 
                    message="Lưu ý cực kỳ quan trọng: Đồng nhất Nền tảng đọc (Embedding Model)" 
                    description="Các nền tảng (OpenAI, Gemini) sử dụng ngôn ngữ số hóa (vector) hoàn toàn khác nhau. Nếu bạn dùng Hệ thống đọc là OpenAI, Trợ lý AI sẽ KHÔNG THỂ tìm kiếm và đọc hiểu được những tài liệu đã được tải lên trước đó bằng mô hình Gemini. Lời khuyên: Hãy chốt sử dụng duy nhất 1 nền tảng đọc ngay từ đầu để tránh lỗi tìm kiếm!"
                    style={{ marginBottom: 16 }}
                  />
                  <Title level={5}>Thứ tự ưu tiên các loại tài liệu nên nạp cho AI (Từ hiệu quả cao nhất):</Title>
                  <ul>
                    <li><b>1. Hỏi & Đáp (Q&A) thực tế:</b> AI học nhanh và khôn nhất. Nên nạp các kịch bản từ chối, FAQ kèm theo câu trả lời mẫu chuẩn mực nhất của công ty.</li>
                    <li><b>2. Thông số sản phẩm & Bảng giá:</b> File Word/PDF chứa Bảng báo giá chi tiết, Specs sản phẩm (Nên trình bày dạng Bảng hoặc gạch đầu dòng rõ ràng).</li>
                    <li><b>3. Chính sách & Quy trình:</b> Chính sách bảo hành, đổi trả, quy định giao hàng, thời gian làm việc để AI không bao giờ tư vấn sai luật.</li>
                    <li><b>4. Kịch bản chốt Sale:</b> Cách xin số điện thoại, cách up-sell để AI học được "Giọng điệu" chuyên nghiệp của doanh nghiệp.</li>
                  </ul>
                  <Title level={5} style={{ marginTop: 12 }}>3 Bí kíp soạn thảo tài liệu (File PDF/Word):</Title>
                  <ul>
                    <li><Text strong type="danger">1. Không dùng file toàn Hình ảnh:</Text> AI hiện tại chỉ đọc hiểu chữ (Text), không đọc được chữ nằm trong ảnh chụp. Hãy đảm bảo File của bạn có thể bôi đen và copy chữ được.</li>
                    <li><Text strong>2. Tách nhỏ thay vì gộp chung:</Text> Đừng nén mọi thứ vào 1 file PDF 500 trang. Hãy chia nhỏ thành nhiều file chuyên đề (VD: Bảng giá Tủ lạnh, Chính sách bảo hành). Trợ lý AI sẽ lục tìm cực kỳ chính xác.</li>
                    <li><Text strong>3. Cấu trúc rõ ràng mạch lạc:</Text> Hãy dùng các Heading (Tiêu đề), Gạch đầu dòng để phân chia nội dung. File càng gọn gàng, AI càng thông minh.</li>
                  </ul>
                </div>
              )
            }
          ]}
        />

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
              
              <Form.Item name='auto_sync_products' valuePropName='checked' style={{ marginBottom: 0 }}>
                <Checkbox>
                  <Text strong>Tự động đồng bộ Sản phẩm làm Tri thức RAG</Text>
                </Checkbox>
              </Form.Item>
              <div style={{ paddingLeft: 24, marginBottom: 16, marginTop: 4 }}>
                <Text type='secondary' style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>Khi bật, phần mềm tự động lấy tên, giá và mô tả của tất cả Sản phẩm & Dịch vụ đưa vào Trí nhớ AI.</Text>
                <Button size="small" icon={<SyncOutlined />} onClick={handleManualSyncProducts} loading={manualSyncing}>
                  Đồng bộ thủ công ngay
                </Button>
              </div>

              <Form.Item name='enable_chat_extraction' valuePropName='checked' style={{ marginBottom: 0 }}>
                <Checkbox>
                  <Text strong>Cho phép Đóng gói Hội thoại (RAG)</Text>
                </Checkbox>
              </Form.Item>
              <div style={{ paddingLeft: 24, marginBottom: 16, marginTop: 4 }}>
                <Text type='secondary' style={{ fontSize: 13 }}>Hiển thị nút Đóng gói Hội thoại (tia sét) trong khung chat để lưu các ca tư vấn khó thành Cẩm nang xử lý từ chối cho AI.</Text>
              </div>

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
              <Radio value="image">Hình ảnh Mẫu (JPG/PNG)</Radio>
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
          ) : docType === 'image' ? (
            <>
              <Form.Item label={
                <span>
                  📷 Ảnh mẫu cần học&nbsp;
                  <Text type="secondary" style={{ fontSize: 12 }}>(.jpg, .jpeg, .png, .webp)</Text>
                </span>
              }>
                <Upload
                  beforeUpload={() => false}
                  onChange={(info) => {
                    setFileList(info.fileList.slice(-1))
                  }}
                  fileList={fileList}
                  onRemove={() => setFileList([])}
                  maxCount={1}
                  accept=".jpg,.jpeg,.png,.webp"
                  listType="picture"
                >
                  <Button icon={<UploadOutlined />}>Chọn ảnh tải lên</Button>
                </Upload>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    AI Vision sẽ còn quét và ghi nhớ dấu hiệu thị giác của ảnh này.
                  </Text>
                </div>
              </Form.Item>
              <Form.Item
                name="content"
                label={
                  <span>
                    📝 Mô tả / Kịch bản tư vấn cho ảnh này
                  </span>
                }
                rules={[{ required: true, message: 'Vui lòng nhập mô tả để AI biết cách tư vấn' }]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder={`Ví dụ:\nĐây là mẫu cửa nhựa Composite phống ngang, màu trắng sữa, sân cao cấp. Giá tham khảo từ 3.5 triệu/m2, tối thiểu 5m2. Chính sách: miễn phí vận chuyển nội thành, bảo hành 10 năm.`}
                />
              </Form.Item>
            </>
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
            <Input disabled={currentDoc?.title?.endsWith('(Auto)')} />
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