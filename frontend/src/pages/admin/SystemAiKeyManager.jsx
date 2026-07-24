import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, Space, Tag, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Title, Text } = Typography;

export default function SystemAiKeyManager() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [form] = Form.useForm();

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await api.get('ai_agents/system-keys/');
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? [];
      setKeys(data);
    } catch (error) {
      message.error('Lỗi khi tải danh sách AI Key');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleOpenModal = (record = null) => {
    setEditingKey(record);
    if (record) {
      form.setFieldsValue(record);
    } else {
      form.resetFields();
      form.setFieldsValue({ provider: 'openai', is_active: true, priority: 0 });
    }
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      if (editingKey) {
        await api.put(`ai_agents/system-keys/${editingKey.id}/`, values);
        message.success('Cập nhật API Key thành công');
      } else {
        await api.post('ai_agents/system-keys/', values);
        message.success('Thêm API Key thành công');
      }
      setModalVisible(false);
      fetchKeys();
    } catch (error) {
      message.error('Có lỗi xảy ra khi lưu API Key');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`ai_agents/system-keys/${id}/`);
      message.success('Đã xóa API Key');
      fetchKeys();
    } catch (error) {
      message.error('Lỗi khi xóa API Key');
    }
  };

  const columns = [
    { title: 'Nhà cung cấp', dataIndex: 'provider', key: 'provider', render: (t) => <Tag color='blue'>{t?.toUpperCase()}</Tag> },
    { title: 'API Key', dataIndex: 'api_key', key: 'api_key', render: (t) => <Text>{t?.substring(0, 8)}...{t?.slice(-4)}</Text> },
    { title: 'Độ ưu tiên', dataIndex: 'priority', key: 'priority' },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', render: (isActive) => isActive ? <Tag color='green'>Đang hoạt động</Tag> : <Tag color='red'>Tạm ngưng</Tag> },
    { title: 'Thao tác', key: 'actions', render: (_, record) => (
      <Space>
        <Button type='text' icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
        <Button type='text' danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
      </Space>
    ) }
  ];

  return (
    <>
      <Card
        title={<Text style={{ fontWeight: 700, fontSize: 16 }}><RobotOutlined /> Cấu hình Trí tuệ Nhân tạo (AI System Keys)</Text>}
        extra={<Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Thêm Key</Button>}
        style={{ borderRadius: 12, boxShadow: '0 10px 28px rgba(15, 23, 42, 0.06)', marginBottom: 20 }}
      >
        <Table columns={columns} dataSource={keys} rowKey="id" loading={loading} pagination={false} size="small" />
      </Card>

      <Modal title={editingKey ? 'Sửa AI Key' : 'Thêm AI Key mới'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()}>
        <Form form={form} layout='vertical' onFinish={handleSave}>
          <Form.Item name='provider' label='Nhà cung cấp AI' rules={[{required: true}]}>
            <Select>
              <Select.Option value='openai'>OpenAI (ChatGPT)</Select.Option>
              <Select.Option value='gemini'>Google Gemini</Select.Option>
              <Select.Option value='anthropic'>Anthropic (Claude)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name='api_key' label='API Key (Secret Key)' rules={[{required: true}]}>
            <Input.Password placeholder='sk-...' />
          </Form.Item>
          <Form.Item name='priority' label='Độ ưu tiên (Số cao chạy trước)'>
            <Input type='number' />
          </Form.Item>
          <Form.Item name='is_active' valuePropName='checked'>
            <Switch /> <Text>Kích hoạt</Text>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
