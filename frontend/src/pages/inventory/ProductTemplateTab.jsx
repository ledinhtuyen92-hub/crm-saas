import {
  AppstoreAddOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SisternodeOutlined
} from '@ant-design/icons'
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography, message
} from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import api from '../../utils/api'

const { Text } = Typography

export default function ProductTemplateTab({ categories }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)
  
  const [form] = Form.useForm()
  const [variantForm] = Form.useForm()

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/inventory/product-templates/')
      setTemplates(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch {
      message.error('Không thể tải danh sách mẫu sản phẩm.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleOpenModal = (template = null) => {
    setEditingTemplate(template)
    form.setFieldsValue(
      template
        ? { name: template.name, category: template.category, description: template.description }
        : { name: '', category: null, description: '' }
    )
    setModalOpen(true)
  }

  const handleSubmit = async (values) => {
    try {
      if (editingTemplate) {
        await api.patch(`/inventory/product-templates/${editingTemplate.id}/`, values)
        message.success('Cập nhật thành công.')
      } else {
        await api.post('/inventory/product-templates/', values)
        message.success('Tạo mẫu sản phẩm thành công.')
      }
      setModalOpen(false)
      fetchTemplates()
    } catch {
      message.error('Có lỗi xảy ra.')
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/inventory/product-templates/${id}/`)
      message.success('Đã xóa mẫu sản phẩm.')
      fetchTemplates()
    } catch {
      message.error('Không thể xóa.')
    }
  }

  const handleOpenVariantModal = (template) => {
    setEditingTemplate(template)
    variantForm.setFieldsValue({
      attributes: [
        { name: 'Màu sắc', values: [] },
        { name: 'Kích thước', values: [] }
      ]
    })
    setVariantModalOpen(true)
  }

  const handleGenerateVariants = async (values) => {
    try {
      // attributes structure: [{name: 'Màu', values: ['Đỏ', 'Xanh']}]
      const validAttributes = values.attributes.filter(a => a.name && a.values && a.values.length > 0)
      await api.post(`/inventory/product-templates/${editingTemplate.id}/generate_variants/`, {
        attributes: validAttributes
      })
      message.success('Sinh biến thể thành công! Bạn có thể xem trong tab Sản phẩm.')
      setVariantModalOpen(false)
    } catch (err) {
      message.error('Có lỗi khi sinh biến thể.')
    }
  }

  const columns = [
    {
      title: 'Tên mẫu sản phẩm',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <Text strong>{name}</Text>
    },
    {
      title: 'Loại sản phẩm',
      dataIndex: 'category',
      key: 'category',
      render: (catId) => {
        const c = categories.find(x => x.id === catId)
        return c ? <Tag color="blue">{c.name}</Tag> : <Text type="secondary">—</Text>
      }
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description'
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            icon={<SisternodeOutlined />} 
            onClick={() => handleOpenVariantModal(record)}
            size="small"
          >
            Sinh biến thể
          </Button>
          <Button icon={<EditOutlined />} onClick={() => handleOpenModal(record)} size="small" />
          <Popconfirm title="Xóa mẫu này?" onConfirm={() => handleDelete(record.id)}>
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => handleOpenModal()}>
          Tạo Mẫu Sản Phẩm
        </Button>
      </div>

      <Table columns={columns} dataSource={templates} rowKey="id" loading={loading} />

      {/* CRUD Modal */}
      <Modal
        title={editingTemplate ? "Sửa mẫu sản phẩm" : "Tạo mẫu sản phẩm"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Tên mẫu" rules={[{ required: true }]}>
            <Input placeholder="VD: Áo thun Polo nam..." />
          </Form.Item>
          <Form.Item name="category" label="Loại sản phẩm">
            <Select placeholder="Chọn loại...">
              {categories.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Variant Generator Modal */}
      <Modal
        title={
          <Space>
            <SisternodeOutlined />
            <span>Sinh biến thể cho: {editingTemplate?.name}</span>
          </Space>
        }
        open={variantModalOpen}
        onCancel={() => setVariantModalOpen(false)}
        onOk={() => variantForm.submit()}
        width={600}
        okText="Tiến hành sinh"
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">Nhập các thuộc tính để hệ thống tự động nhân bản thành các sản phẩm con (biến thể).</Text>
        </div>
        <Form form={variantForm} layout="vertical" onFinish={handleGenerateVariants}>
          <Form.List name="attributes">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={12} style={{ marginBottom: 8, alignItems: 'center' }}>
                    <Col span={8}>
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        rules={[{ required: true, message: 'Nhập tên thuộc tính' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Tên: Màu sắc, Size..." />
                      </Form.Item>
                    </Col>
                    <Col span={14}>
                      <Form.Item
                        {...restField}
                        name={[name, 'values']}
                        style={{ marginBottom: 0 }}
                      >
                        <Select
                          mode="tags"
                          style={{ width: '100%' }}
                          placeholder="Nhập giá trị và ấn Enter: Đỏ, Xanh..."
                        />
                      </Form.Item>
                    </Col>
                    <Col span={2}>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} type="text" />
                    </Col>
                  </Row>
                ))}
                <Form.Item style={{ marginTop: 16 }}>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Thêm thuộc tính
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  )
}
