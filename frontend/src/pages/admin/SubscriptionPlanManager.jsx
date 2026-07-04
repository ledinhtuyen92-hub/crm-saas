import { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  message,
  Popconfirm,
  Tag
} from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import api from '../../utils/api'

export default function SubscriptionPlanManager({ onPlansChange }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [form] = Form.useForm()

  const fetchPlans = async () => {
    setLoading(true)
    try {
      const res = await api.get('users/subscription-plans/')
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setPlans(data)
      if (onPlansChange) {
        onPlansChange(data)
      }
    } catch (err) {
      console.error(err)
      message.error('Không thể lấy danh sách gói')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleAdd = () => {
    setEditingPlan(null)
    form.resetFields()
    setIsModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditingPlan(record)
    form.setFieldsValue(record)
    setIsModalVisible(true)
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`users/subscription-plans/${id}/`)
      message.success('Xóa gói thành công')
      fetchPlans()
    } catch (err) {
      console.error(err)
      message.error('Lỗi khi xóa gói')
    }
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingPlan) {
        await api.patch(`users/subscription-plans/${editingPlan.id}/`, values)
        message.success('Cập nhật gói thành công')
      } else {
        await api.post('users/subscription-plans/', values)
        message.success('Thêm gói thành công')
      }
      setIsModalVisible(false)
      fetchPlans()
    } catch (err) {
      if (err.response) {
         message.error('Lỗi: ' + JSON.stringify(err.response.data))
      }
      console.error(err)
    }
  }

  const columns = [
    {
      title: 'Mã gói',
      dataIndex: 'code',
      key: 'code',
    },
    {
      title: 'Tên gói',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          {text}
          {record.is_default && <Tag color="blue">Mặc định</Tag>}
        </Space>
      )
    },
    {
      title: 'Giới hạn (User)',
      dataIndex: 'user_limit',
      key: 'user_limit',
      render: (val) => val === 99999 ? 'Không giới hạn' : val
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          {!record.is_default && (
            <Popconfirm title="Chắc chắn xóa gói này?" onConfirm={() => handleDelete(record.id)}>
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Quản lý Các gói dịch vụ SaaS</div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Thêm Gói Tùy chỉnh</Button>
      </div>
      
      <Table 
        columns={columns} 
        dataSource={plans} 
        rowKey="id" 
        loading={loading}
        pagination={false}
        size="small"
      />

      <Modal
        title={editingPlan ? 'Sửa Gói' : 'Thêm Gói Tùy chỉnh'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="Mã gói (Code)" rules={[{ required: true }]}>
            <Input disabled={editingPlan?.is_default} placeholder="Ví dụ: custom-1" />
          </Form.Item>
          <Form.Item name="name" label="Tên gói" rules={[{ required: true }]}>
            <Input placeholder="Ví dụ: Gói VIP" />
          </Form.Item>
          <Form.Item name="user_limit" label="Giới hạn người dùng" rules={[{ required: true }]}>
            <InputNumber min={1} max={99999} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
