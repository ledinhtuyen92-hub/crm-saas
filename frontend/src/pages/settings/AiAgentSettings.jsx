import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, Switch, message, Space, Typography, Tag, Collapse } from 'antd';
import { PlusOutlined, EditOutlined, RobotOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../utils/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;

export default function AiAgentSettings() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [form] = Form.useForm();

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

  useEffect(() => { fetchAgents(); }, []);

  const handleOpenModal = (agent = null) => {
    setEditingAgent(agent);
    if (agent) {
      form.setFieldsValue(agent);
    } else {
      form.resetFields();
      form.setFieldsValue({ 
        model_name: 'gpt-4o-mini', 
        temperature: 0.7, 
        is_active: true, 
        enable_auto_summary: true, 
        enable_human_typing: false, 
        enable_auto_tagging: false, 
        enable_drip_followup: false 
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
    { title: 'Mô hình', dataIndex: 'model_name', key: 'model_name', render: (t) => <Tag color='blue'>{t}</Tag> },
    { title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active', render: (isActive) => isActive ? <Tag color='green'>Đang hoạt động</Tag> : <Tag color='red'>Đã tắt</Tag> },
    { title: 'Thao tác', key: 'actions', render: (_, record) => (
      <Space>
        <Button type='text' icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
      </Space>
    ) }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title={<Title level={4}><RobotOutlined /> Quản lý Đội ngũ Trợ lý AI</Title>} extra={<Button type='primary' icon={<PlusOutlined />} onClick={() => handleOpenModal()}>Tạo Trợ lý AI mới</Button>}>
        <Table columns={columns} dataSource={agents} rowKey='id' loading={loading} />
      </Card>

      <Modal title={editingAgent ? 'Chỉnh sửa Trợ lý AI' : 'Tạo Trợ lý AI mới'} open={modalVisible} onCancel={() => setModalVisible(false)} onOk={() => form.submit()} width={700}>
        <Form form={form} layout='vertical' onFinish={handleSave}>
          <Form.Item name='name' label='Tên Trợ lý' rules={[{required:true}]}><Input placeholder='VD: AI Sale Facebook, AI CSKH Zalo' /></Form.Item>
          <Form.Item name='model_name' label='Mô hình AI (LLM)' rules={[{required:true}]}>
            <Select>
              <Select.Option value='gpt-4o-mini'>GPT-4o-mini (Nhanh, Rẻ - Khuyên dùng CSKH)</Select.Option>
              <Select.Option value='gpt-4o'>GPT-4o (Thông minh nhất - Khuyên dùng Sale)</Select.Option>
              <Select.Option value='claude-3-5-sonnet'>Claude 3.5 Sonnet (Logic, Kỹ thuật)</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name='system_prompt' label='Định hình Tính cách (System Prompt)' help='Mô tả tính cách, mục tiêu, và giọng điệu của AI. VD: "Bạn là 1 nữ nhân viên chốt Sale tên Lan Anh, giọng điệu vui vẻ, hay dùng emoji..."'>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name='temperature' label='Độ sáng tạo (0 - 1)'>
            <Input type='number' step='0.1' min='0' max='1' />
          </Form.Item>
          
          <Collapse defaultActiveKey={['1']}>
            <Panel header={<Space><SettingOutlined /> Tùy chọn Nâng cao (Toggles)</Space>} key='1'>
              <Form.Item name='enable_human_typing' valuePropName='checked'><Switch /> <Text>Giả lập người thật (Delay & gõ phím)</Text></Form.Item>
              <Form.Item name='enable_auto_summary' valuePropName='checked'><Switch /> <Text>Tự động tóm tắt hội thoại cho Sale</Text></Form.Item>
              <Form.Item name='enable_auto_tagging' valuePropName='checked'><Switch /> <Text>Tự động dán nhãn (Tag) hội thoại</Text></Form.Item>
              <Form.Item name='enable_drip_followup' valuePropName='checked'><Switch /> <Text>Bám đuổi (Follow-up) tự động sau 24h</Text></Form.Item>
            </Panel>
          </Collapse>
          <br/>
          <Form.Item name='is_active' valuePropName='checked'><Switch /> <Text>Đang hoạt động</Text></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}