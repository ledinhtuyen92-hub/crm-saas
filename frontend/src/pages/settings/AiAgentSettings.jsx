import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, message, Space, Typography, Tag, Collapse, Row, Col, Divider, Alert, Slider, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, RobotOutlined, SettingOutlined, KeyOutlined, SyncOutlined, InfoCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

const DEFAULT_CORE_PROMPT = `{
    "thought": "Phân tích tâm lý khách hàng và lên chiến thuật trả lời (Suy nghĩ nháp trước khi chat)",
    "reply": "Câu trả lời gửi khách. Nếu KHÔNG BIẾT/không chắc chắn, xin phép đợi nhân viên kiểm tra.",
    "sentiment": "angry / handoff / neutral (BẮT BUỘC chọn 'handoff' nếu bạn không biết, thiếu dữ liệu, phải nhờ người khác kiểm tra, báo khách đợi, hoặc khách đòi gặp Sale. Chọn 'angry' nếu khách chửi bậy/đe dọa. Còn lại chọn 'neutral')",
    "extracted_info": {
        "phone": "Trích xuất SĐT nếu có (nếu không có thì để rỗng)",
        "address": "Trích xuất địa chỉ nếu có (nếu không có thì để rỗng)",
        "notes": "Ghi chú (size, màu sắc...)"
    },
    "tags": ["Hỏi giá", "Khách VIP", "Đã chốt"...],
    "summary": "Tóm tắt ngắn gọn lịch sử chat"
}`;

export default function AiAgentSettings() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form] = Form.useForm();
  
  // Company API Settings
  const [companySettings, setCompanySettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [settingsForm] = Form.useForm();
  
  // Dynamic model fetching
  const [fetchedModels, setFetchedModels] = useState([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedKey, setFetchedKey] = useState("");

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('ai_agents/agents/');
      setAgents(Array.isArray(data) ? data : data.results || []);
    } catch (error) {
      message.error('Không thể tải danh sách Trợ lý AI.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProviders = async () => {
    try {
      const { data } = await api.get('ai_agents/settings/available_providers/');
      setAvailableProviders(data.available_providers || []);
    } catch (error) {
      console.error('Lỗi khi tải danh sách nhà cung cấp có sẵn', error);
    }
  };

  const fetchCompanySettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await api.get('ai_agents/settings/mine/');
      setCompanySettings(data);
      settingsForm.setFieldsValue(data);
    } catch (error) {
      console.error(error);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => { 
    fetchAgents(); 
    fetchCompanySettings();
    fetchKeys();
    fetchAvailableProviders();
  }, []);

  const handleFetchModels = async (provider) => {
    if (!provider) return;
    setFetchingModels(true);
    setFetchedModels([]);
    setFetchedKey("");
    try {
      const { data } = await api.get(`ai_agents/settings/fetch_models/?provider=${provider}`);
      if (data.models && data.models.length > 0) {
        setFetchedModels(data.models);
        setFetchedKey(data.used_key || "");
        message.success(`✅ Lấy được ${data.count} mô hình từ API Key (${data.used_key})!`);
      } else {
        message.warning('Không tìm thấy mô hình nào hợp lệ.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Lỗi khi kết nối tới nhà cung cấp.';
      message.error(`❌ ${errMsg}`);
    } finally {
      setFetchingModels(false);
    }
  };

  // Company AI Keys (Custom Keys)
  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keyModalVisible, setKeyModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [keyForm] = Form.useForm();

  const fetchKeys = async () => {
    setKeysLoading(true);
    try {
      const res = await api.get('ai_agents/company-keys/');
      setKeys(Array.isArray(res.data) ? res.data : res.data?.results ?? []);
    } catch (error) {
      message.error('Lỗi khi tải danh sách API Key cá nhân');
    } finally {
      setKeysLoading(false);
    }
  };

  const handleOpenKeyModal = (record = null) => {
    setEditingKey(record);
    if (record) {
      keyForm.setFieldsValue(record);
    } else {
      keyForm.resetFields();
      keyForm.setFieldsValue({ provider: 'openai', is_active: true, priority: 0 });
    }
    setKeyModalVisible(true);
  };

  const handleSaveKey = async (values) => {
    try {
      if (editingKey) {
        await api.put(`ai_agents/company-keys/${editingKey.id}/`, values);
        message.success('Cập nhật API Key thành công');
      } else {
        await api.post('ai_agents/company-keys/', values);
        message.success('Thêm API Key thành công');
      }
      setKeyModalVisible(false);
      fetchKeys();
      fetchAvailableProviders();
    } catch (error) {
      message.error('Có lỗi xảy ra khi lưu API Key');
    }
  };

  const handleDeleteKey = async (id) => {
    try {
      await api.delete(`ai_agents/company-keys/${id}/`);
      message.success('Đã xóa API Key');
      fetchKeys();
      fetchAvailableProviders();
    } catch (error) {
      message.error('Lỗi khi xóa API Key');
    }
  };

  const keyColumns = [
    { title: 'Nhà cung cấp', dataIndex: 'provider', key: 'provider', render: (t) => <Tag color='blue'>{t?.toUpperCase()}</Tag> },
    { title: 'API Key', dataIndex: 'api_key', key: 'api_key', render: (t) => <Text>{t?.substring(0, 8)}...{t?.slice(-4)}</Text> },
    { title: 'Độ ưu tiên', dataIndex: 'priority', key: 'priority' },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', render: (isActive) => isActive ? <Tag color='green'>Đang hoạt động</Tag> : <Tag color='red'>Tạm ngưng</Tag> },
    { title: 'Thao tác', key: 'actions', render: (_, record) => (
      <Space>
        <Button type='text' icon={<EditOutlined />} onClick={() => handleOpenKeyModal(record)} />
        <Button type='text' danger icon={<DeleteOutlined />} onClick={() => handleDeleteKey(record.id)} />
      </Space>
    ) }
  ];

  const handleSaveCompanySettings = async (values) => {
    setSettingsLoading(true);
    try {
      await api.put('ai_agents/settings/mine/', values);
      message.success('Cập nhật cấu hình API Key thành công.');
      fetchCompanySettings();
      fetchAvailableProviders();
    } catch (error) {
      message.error('Lỗi khi lưu cấu hình API Key.');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleOpenModal = (agent = null) => {
    setEditingAgent(agent);
    if (agent) {
      form.setFieldsValue({
        ...agent,
        core_prompt_template: agent.core_prompt_template || DEFAULT_CORE_PROMPT
      });
    } else {
      form.resetFields();
      
      const defaultProvider = availableProviders.length > 0 ? availableProviders[0] : null;
      let defaultModel = undefined;
      
      if (defaultProvider === 'openai') defaultModel = 'gpt-4o-mini';
      else if (defaultProvider === 'gemini') defaultModel = 'gemini-2.5-flash';
      else if (defaultProvider === 'anthropic') defaultModel = 'claude-3-5-sonnet';

      form.setFieldsValue({ 
        provider: defaultProvider,
        model_name: defaultModel, 
        temperature: 0.7, 
        is_active: true, 
        enable_auto_summary: true, 
        enable_human_typing: false, 
        enable_auto_tagging: false, 
        enable_drip_followup: false,
        drip_followup_hours: 24,
        core_prompt_template: DEFAULT_CORE_PROMPT
      });
    }
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingAgent) {
        await api.put(`ai_agents/agents/${editingAgent.id}/`, values);
        message.success('Cập nhật thành công.');
      } else {
        await api.post('ai_agents/agents/', values);
        message.success('Tạo Trợ lý AI thành công.');
      }
      setModalVisible(false);
      fetchAgents();
    } catch (error) {
      message.error('Có lỗi xảy ra khi lưu.');
    }
  };

  const columns = [
    { title: 'Tên Trợ lý AI', dataIndex: 'name', key: 'name', render: (t) => <Text strong><RobotOutlined /> {t}</Text> },
    { title: 'Nền tảng', dataIndex: 'provider', key: 'provider', render: (t) => <Tag color='purple'>{t?.toUpperCase()}</Tag> },
    { title: 'Mô hình', dataIndex: 'model_name', key: 'model_name', render: (t) => <Tag color='blue'>{t}</Tag> },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', render: (isActive) => isActive ? <Tag color='green'>Đang hoạt động</Tag> : <Tag color='red'>Đã tắt</Tag> },
    { title: 'Thao tác', key: 'actions', render: (_, record) => (
      <Space>
        <Button type='text' icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
      </Space>
    ) }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      
      {/* CẤU HÌNH API KEY CÔNG TY */}
      <Card 
        title={<Title level={4}><KeyOutlined /> Cấu hình API Key & Phân bổ Quota</Title>} 
        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', marginBottom: 24 }}
        loading={settingsLoading}
      >


        <Row gutter={[32, 32]}>
          <Col xs={24} lg={16}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5} style={{ margin: 0 }}>Kho API Key cá nhân</Title>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenKeyModal()}>Thêm Key Mới</Button>
            </div>
            <Table 
              columns={keyColumns} 
              dataSource={keys} 
              rowKey="id" 
              loading={keysLoading} 
              pagination={false} 
              size="middle"
              style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}
            />
          </Col>
          
          <Col xs={24} lg={8}>
            <div style={{ 
              padding: 24, 
              background: 'linear-gradient(145deg, #f8fafc 0%, #f1f5f9 100%)', 
              borderRadius: 12,
              border: '1px solid #e2e8f0'
            }}>
              <Form form={settingsForm} layout='vertical' onFinish={handleSaveCompanySettings}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <RobotOutlined style={{ fontSize: 20, color: '#1677ff' }} />
                  <Title level={5} style={{ margin: 0 }}>Cơ chế Dự phòng (Fallback)</Title>
                </div>
                
                <Text type='secondary' style={{ display: 'block', marginBottom: 20, lineHeight: '1.6' }}>
                  Nếu Key riêng của bạn bị hết hạn mức (hết tiền), hệ thống sẽ tự động trượt sang dùng kho Key dự phòng của Server (System Quota) để đảm bảo Trợ lý AI luôn hoạt động 24/7.
                </Text>
                
                {!companySettings?.allow_system_keys ? (
                  <Alert
                    message="Tính năng bị khóa"
                    description="Bạn chưa được Admin hệ thống cấp quyền dùng Quota dự phòng. Vui lòng liên hệ Admin để nâng cấp."
                    type="error"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 8 }}
                  />
                ) : (
                  <Alert
                    message="Đã được cấp quyền"
                    description="Bạn có thể tự do bật/tắt tính năng sử dụng Quota dự phòng bên dưới."
                    type="success"
                    showIcon
                    style={{ marginBottom: 20, borderRadius: 8 }}
                  />
                )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <Text strong>Cho phép dùng System Quota</Text>
                    <Form.Item name='use_system_keys' valuePropName='checked' style={{ margin: 0 }}>
                      <Switch 
                        disabled={!companySettings?.allow_system_keys} 
                        checkedChildren="Bật" 
                        unCheckedChildren="Tắt" 
                      />
                    </Form.Item>
                  </div>
                
                <Divider style={{ margin: '20px 0' }} />
                
                <Button type='primary' htmlType='submit' block size='large' style={{ borderRadius: 8 }}>
                  Lưu Cấu Hình
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Card>

      {/* QUẢN LÝ TRỢ LÝ AI */}
      <Card 
        title={<Title level={4}><RobotOutlined /> Quản lý Đội ngũ Trợ lý AI</Title>} 
        extra={<Button type='primary' size='large' icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Tạo Trợ lý AI mới</Button>}
        style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
      >
        <Table columns={columns} dataSource={agents} rowKey='id' loading={loading} pagination={false} />
      </Card>

      <Modal 
        title={<Space><RobotOutlined style={{color: '#1677ff', fontSize: 20}} /> <span style={{fontSize: 18, fontWeight: 600}}>{editingAgent ? 'Chỉnh sửa Trợ lý AI' : 'Tạo Trợ lý AI mới'}</span></Space>} 
        open={modalVisible} 
        onCancel={() => setModalVisible(false)} 
        onOk={() => form.submit()} 
        width={850}
        okText="Lưu lại"
        cancelText="Hủy"
        okButtonProps={{ size: 'large', icon: <ThunderboltOutlined /> }}
        cancelButtonProps={{ size: 'large' }}
      >
        <Form form={form} layout='vertical' onFinish={handleSave} style={{ marginTop: 16 }}>
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Form.Item name='name' label={<Text strong>Tên Trợ lý</Text>} rules={[{required:true}]}>
                <Input size="large" placeholder='VD: AI Sale Facebook, AI CSKH Zalo' />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name='is_active' label={<Text strong>Trạng thái hoạt động</Text>} valuePropName='checked'>
                <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Tạm dừng" style={{ marginTop: 4 }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={10}>
              <Form.Item name='provider' label={<Text strong>Nền tảng AI</Text>} rules={[{required:true}]} help={availableProviders.length === 0 ? "⚠️ Cần nạp API Key trước." : ""}>
                <Select 
                  size="large"
                  onChange={() => form.setFieldsValue({ model_name: undefined })}
                  placeholder={availableProviders.length === 0 ? "Chưa có API Key" : "Chọn nền tảng AI"}
                >
                  <Select.Option value='openai' disabled={!availableProviders.includes('openai')}>OpenAI (ChatGPT) {!availableProviders.includes('openai') && '(Chưa có)'}</Select.Option>
                  <Select.Option value='gemini' disabled={!availableProviders.includes('gemini')}>Google Gemini {!availableProviders.includes('gemini') && '(Chưa có)'}</Select.Option>
                  <Select.Option value='anthropic' disabled={!availableProviders.includes('anthropic')}>Anthropic (Claude) {!availableProviders.includes('anthropic') && '(Chưa có)'}</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.provider !== curr.provider}>
                {({ getFieldValue }) => {
                  const provider = getFieldValue('provider');
                  const useDynamic = fetchedModels.length > 0;
                  return (
                    <Form.Item 
                      name='model_name' 
                      label={
                        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Text strong>Mô hình AI (LLM)</Text>
                          {provider && (
                            <Button size='small' type='primary' ghost icon={<SyncOutlined spin={fetchingModels} />} loading={fetchingModels} onClick={() => handleFetchModels(provider)}>
                              Lấy mô hình thực tế
                            </Button>
                          )}
                        </Space>
                      }
                      rules={[{required:true}]}
                    >
                      <Select size="large" disabled={!provider} placeholder="Vui lòng chọn Nền tảng AI trước">
                        {useDynamic
                          ? fetchedModels.map(m => (<Select.Option key={m.id} value={m.id}>{m.name}</Select.Option>))
                          : (<>
                              {provider === 'openai' && (<>
                                <Select.Option value='gpt-4o-mini'>GPT-4o-mini (Nhanh, Rẻ - Khuyên dùng)</Select.Option>
                                <Select.Option value='gpt-4o'>GPT-4o (Thông minh, Phổ biến)</Select.Option>
                                <Select.Option value='gpt-4.5-turbo'>GPT-4.5 Turbo (Nâng cấp lớn)</Select.Option>
                                <Select.Option value='gpt-5'>GPT-5 (Tối tân nhất)</Select.Option>
                                <Select.Option value='o1-mini'>O1 Mini (Lập luận logic)</Select.Option>
                                <Select.Option value='o1'>O1 (Siêu trí tuệ)</Select.Option>
                              </>)}
                              {provider === 'gemini' && (<>
                                <Select.Option value='gemini-flash-lite-latest'>Gemini Flash Lite (Siêu nhẹ)</Select.Option>
                                <Select.Option value='gemini-flash-latest'>Gemini Flash Latest (Khuyên dùng)</Select.Option>
                                <Select.Option value='gemini-pro-latest'>Gemini Pro Latest (Thông minh nhất)</Select.Option>
                              </>)}
                              {provider === 'anthropic' && (<>
                                <Select.Option value='claude-3-5-haiku-20241022'>Claude 3.5 Haiku (Nhanh, Rẻ)</Select.Option>
                                <Select.Option value='claude-3-5-sonnet-20241022'>Claude 3.5 Sonnet (Cân bằng)</Select.Option>
                                <Select.Option value='claude-sonnet-4-5'>Claude Sonnet 4.5 (Thế hệ mới)</Select.Option>
                                <Select.Option value='claude-opus-4-5'>Claude Opus 4.5 (Thông minh nhất)</Select.Option>
                              </>)}
                            </>)
                        }
                      </Select>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          {fetchedModels.length > 0 && (
            <div style={{ marginTop: -15, marginBottom: 15 }}>
              <Text type="success" style={{ fontSize: 13 }}>✅ Đang hiển thị {fetchedModels.length} mô hình thực tế từ API Key [{fetchedKey}]</Text>
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Form.Item 
                name='system_prompt' 
                label={
                  <Space>
                    <Text strong>Định hình Tính cách (System Prompt)</Text>
                    <Tooltip title='Mô tả tính cách, mục tiêu, và giọng điệu của AI. VD: "Bạn là 1 nữ nhân viên chốt Sale tên Lan Anh, giọng điệu vui vẻ, hay dùng emoji..."'>
                      <InfoCircleOutlined style={{ color: '#888' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Input.TextArea rows={6} placeholder="Nhập kịch bản, tính cách cho AI tại đây..." style={{ borderRadius: 8 }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item 
                name='temperature' 
                label={
                  <Space>
                    <Text strong>Độ sáng tạo (0 - 1)</Text>
                    <Tooltip title="Giá trị càng gần 1, AI càng sáng tạo và bay bổng. Gần 0 thì AI nghiêm túc và chính xác hơn. Khuyên dùng: 0.7">
                      <InfoCircleOutlined style={{ color: '#888' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Slider min={0} max={1} step={0.1} marks={{0: '0', 0.5: '0.5', 1: '1'}} />
              </Form.Item>
            </Col>
          </Row>

          <Collapse ghost style={{ background: '#f5f5f5', borderRadius: 8, marginBottom: 12 }}>
            <Panel header={<Text strong style={{ color: '#d9363e' }}>Tùy chỉnh Cốt lõi AI (Dành cho Chuyên gia - Developer Mode)</Text>} key="1">
              <Form.Item 
                name='core_prompt_template' 
                label={
                  <Space>
                    <Text strong>Cấu trúc Dữ liệu JSON (Core Prompt)</Text>
                    <Tooltip title="Mặc định hệ thống đã cấu hình 1 JSON hoàn hảo (trích xuất SĐT, Nhãn, Tóm tắt). Chỉ chỉnh sửa nếu bạn hiểu về JSON và muốn thêm trường tuỳ chỉnh (VD: trích xuất Email, Ngân sách).">
                      <InfoCircleOutlined style={{ color: '#888' }} />
                    </Tooltip>
                  </Space>
                }
              >
                <Input.TextArea 
                  rows={8} 
                  style={{ fontFamily: 'monospace', fontSize: 13, backgroundColor: '#1e1e1e', color: '#d4d4d4' }} 
                  placeholder="Để trống để sử dụng JSON thông minh mặc định của hệ thống..." 
                />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Lưu ý: Nếu nhập sai cú pháp JSON, AI có thể không hoạt động đúng. Khuyến cáo nên để trống nếu không rõ.
              </Text>
            </Panel>
          </Collapse>


          <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 20px', marginTop: 8 }}>
            <div style={{ marginBottom: 16 }}>
              <Space>
                <SettingOutlined style={{ fontSize: 16, color: '#1677ff' }} />
                <Text strong style={{ fontSize: 15 }}>Tính năng Nâng cao (Tự động hóa)</Text>
              </Space>
            </div>
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Form.Item name='enable_human_typing' valuePropName='checked' style={{ marginBottom: 0 }}>
                    <Switch />
                  </Form.Item>
                  <Text style={{ marginLeft: 8 }}>Giả lập người thật (Delay & gõ phím)</Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Form.Item name='enable_auto_summary' valuePropName='checked' style={{ marginBottom: 0 }}>
                    <Switch />
                  </Form.Item>
                  <Text style={{ marginLeft: 8 }}>Tự động tóm tắt hội thoại cho Sale</Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Form.Item name='enable_auto_tagging' valuePropName='checked' style={{ marginBottom: 0 }}>
                    <Switch />
                  </Form.Item>
                  <Text style={{ marginLeft: 8 }}>Tự động dán nhãn (Tag) khách hàng</Text>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Form.Item name='enable_drip_followup' valuePropName='checked' style={{ marginBottom: 0 }}>
                    <Switch />
                  </Form.Item>
                  <Text style={{ marginLeft: 8 }}>Bám đuổi (Follow-up) tự động sau</Text>
                  <Form.Item name='drip_followup_hours' style={{ marginBottom: 0, marginLeft: 8 }}>
                    <InputNumber min={1} max={720} style={{ width: 65 }} />
                  </Form.Item>
                  <Text style={{ marginLeft: 8 }}>giờ</Text>
                </div>
              </Col>
            </Row>
          </div>
        </Form>
      </Modal>

      <Modal title={editingKey ? 'Sửa API Key' : 'Thêm API Key mới'} open={keyModalVisible} onCancel={() => setKeyModalVisible(false)} onOk={() => keyForm.submit()}>
        <Form form={keyForm} layout='vertical' onFinish={handleSaveKey}>
          <Form.Item name='provider' label='Nhà cung cấp AI' rules={[{required: true}]}>
            <Select>
              <Select.Option value='openai'>OpenAI (ChatGPT)</Select.Option>
              <Select.Option value='gemini'>Google Gemini</Select.Option>
              <Select.Option value='anthropic'>Anthropic (Claude)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name='api_key' label='API Key' rules={[{required: true}]}>
            <Input.Password placeholder='Nhập API Key...' />
          </Form.Item>
          <Form.Item name='priority' label='Độ ưu tiên (Ưu tiên cao nhất = 100)' help='Các Key có priority cao hơn sẽ được gọi trước, nếu hết tiền sẽ tự trượt xuống Key có priority thấp hơn.'>
            <Input type='number' />
          </Form.Item>
          <Form.Item name='is_active' valuePropName='checked'>
            <Switch checkedChildren="Đang hoạt động" unCheckedChildren="Tạm ngưng" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}