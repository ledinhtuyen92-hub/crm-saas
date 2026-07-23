import React, { useState, useEffect } from 'react';
import { 
    Card, Table, Button, Space, Tag, Modal, Form, 
    Input, Upload, Switch, message, Popconfirm, Typography, Select, Drawer, Badge, Divider
} from 'antd';
import { 
    NotificationOutlined, PlusOutlined, DeleteOutlined, 
    UploadOutlined, PushpinOutlined, PushpinFilled,
    EyeOutlined, PaperClipOutlined, EditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import JoditEditor from 'jodit-react';

import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import announcementApi from '../api/announcementApi';

const { Title, Text } = Typography;

const Announcements = () => {
    const { hasPermission, isSuperAdmin, isCompanyAdmin, checkMaintenance } = useAuth();
    const canCreate = hasPermission('notifications.create_announcements') || isSuperAdmin || isCompanyAdmin;
    const canDelete = hasPermission('notifications.delete_announcements') || isSuperAdmin || isCompanyAdmin;

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filter lists
    const [usersList, setUsersList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [categoriesList, setCategoriesList] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [editingId, setEditingId] = useState(null);

    // Modal Create
    const [createModalVisible, setCreateModalVisible] = useState(false);
    const [form] = Form.useForm();
    const [fileList, setFileList] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [isAllCompany, setIsAllCompany] = useState(true);

    // Detail Drawer
    const [detailVisible, setDetailVisible] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const promises = [announcementApi.getAll({ page, page_size: pageSize })];
            if (canCreate) {
                promises.push(api.get('/users/users/', { params: { limit: 1000 } }));
                promises.push(api.get('/users/departments/', { params: { limit: 1000 } }));
                promises.push(announcementApi.getCategories());
            }
            
            const results = await Promise.all(promises);
            const announcementsRes = results[0];
            
            setAnnouncements(announcementsRes.data.results || []);
            setTotal(announcementsRes.data.count || 0);
            
            if (canCreate) {
                const usersRes = results[1];
                const deptsRes = results[2];
                // Map lists for Select options
                setUsersList((usersRes.data?.results || usersRes.data || []).map(u => ({
                    label: `${u.full_name || u.username} - ${u.department_name || 'Không có PB'}`,
                    value: u.id
                })));
                setDepartmentsList((deptsRes.data?.results || deptsRes.data || []).map(d => ({
                    label: d.name,
                    value: d.id
                })));
                setCategoriesList(results[3]?.data || []);
            }
        } catch (error) {
            console.error('Fetch data error:', error);
            message.error('Lỗi: ' + (error.response?.data?.detail || error.message || 'Không thể tải dữ liệu'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, pageSize]);

    const handleSubmit = async (values) => {
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', values.title);
            formData.append('content', values.content);
            if (values.priority) formData.append('priority', values.priority);
            if (values.category) formData.append('category', values.category);
            if (values.is_pinned !== undefined) formData.append('is_pinned', values.is_pinned);
            
            formData.append('is_all_company', isAllCompany);
            
            if (!isAllCompany) {
                if (values.target_users && values.target_users.length > 0) {
                    formData.append('target_users', JSON.stringify(values.target_users));
                }
                if (values.departments && values.departments.length > 0) {
                    values.departments.forEach(d => formData.append('departments', d));
                }
            }
            
            // Append files
            fileList.forEach(file => {
                formData.append('attachments', file.originFileObj || file);
            });

            if (editingId) {
                await announcementApi.update(editingId, formData);
                message.success('Cập nhật thông báo thành công');
            } else {
                await announcementApi.create(formData);
                message.success('Tạo thông báo thành công');
            }
            setCreateModalVisible(false);
            setEditingId(null);
            form.resetFields();
            setFileList([]);
            setIsAllCompany(true);
            fetchData(); // reload
        } catch (error) {
            message.error('Có lỗi xảy ra khi lưu thông báo');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await announcementApi.delete(id);
            message.success('Đã xóa thông báo');
            fetchData();
        } catch (error) {
            message.error('Có lỗi xảy ra khi xóa');
        }
    };

    const handleEdit = (record) => {
        setEditingId(record.id);
        setIsAllCompany(record.is_all_company);
        form.setFieldsValue({
            title: record.title,
            content: record.content,
            priority: record.priority,
            category: record.category,
            is_pinned: record.is_pinned,
            target_users: record.target_users || [],
            departments: record.departments || []
        });
        setFileList([]);
        setCreateModalVisible(true);
    };

    const handleViewDetail = async (record) => {
        try {
            const res = await announcementApi.get(record.id);
            setSelectedAnnouncement(res.data);
            setDetailVisible(true);
            
            // Nếu chưa đọc thì mark as read
            if (!record.is_read) {
                await announcementApi.markRead(record.id);
                // Trigger global update if needed, and update local list
                window.dispatchEvent(new Event('refresh-notifications'));
                setAnnouncements(prev => prev.map(a => 
                    a.id === record.id 
                    ? { ...a, is_read: true }
                    : a
                ));
            }
        } catch (error) {
            message.error('Không thể tải chi tiết thông báo');
        }
    };

    const columns = [
        {
            title: 'Tiêu đề',
            dataIndex: 'title',
            key: 'title',
            render: (text, record) => {
                const isRead = record.is_read;
                return (
                    <Space>
                        {record.is_pinned ? <PushpinFilled style={{ color: '#f5222d' }} /> : null}
                        <Text strong={!isRead}>{text}</Text>
                        {!isRead && <Badge dot color="blue" />}
                    </Space>
                );
            }
        },
        {
            title: 'Loại',
            dataIndex: 'category',
            key: 'category',
            width: 150,
            render: (text) => text ? <Tag color="cyan">{text}</Tag> : <span style={{ color: '#ccc' }}>--</span>
        },
        {
            title: 'Độ ưu tiên',
            dataIndex: 'priority',
            key: 'priority',
            width: 120,
            render: (priority) => {
                const colors = {
                    high: 'red',
                    normal: 'blue',
                    low: 'default'
                };
                const labels = {
                    high: 'Cao',
                    normal: 'Thường',
                    low: 'Thấp'
                };
                return <Tag color={colors[priority]}>{labels[priority]}</Tag>;
            }
        },
        {
            title: 'Ngày đăng',
            dataIndex: 'created_at',
            key: 'created_at',
            width: 150,
            render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm')
        },
        {
            title: 'Người đăng',
            dataIndex: 'created_by_name',
            key: 'created_by_name',
            width: 180,
            render: (text) => text || 'Hệ thống'
        },
        {
            title: 'Thao tác',
            key: 'action',
            width: 120,
            render: (_, record) => (
                <Space size="middle">
                    <Button 
                        type="text" 
                        icon={<EyeOutlined />} 
                        onClick={() => handleViewDetail(record)} 
                    />
                    {canCreate && (
                        <Button
                            type="text"
                            icon={<EditOutlined style={{ color: '#faad14' }} />}
                            onClick={() => handleEdit(record)}
                        />
                    )}
                    {canDelete && (
                        <Popconfirm
                            title="Xóa thông báo"
                            description="Bạn có chắc chắn muốn xóa thông báo này?"
                            onConfirm={() => handleDelete(record.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                        >
                            <Button type="text" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                    )}
                </Space>
            ),
        },
    ];

    const uploadProps = {
        onRemove: (file) => {
            setFileList(prev => prev.filter(item => item.uid !== file.uid));
        },
        beforeUpload: (file) => {
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error(`${file.name} vượt quá dung lượng 10MB!`);
                return Upload.LIST_IGNORE;
            }
            setFileList(prev => [...prev, file]);
            return false; // prevent default upload action
        },
        fileList,
        multiple: true,
    };

    return (
        <div style={{ padding: '24px' }}>
            <Card 
                title={<Space><NotificationOutlined /> Thông báo nội bộ</Space>}
                extra={
                    canCreate && (
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />} 
                            onClick={() => {
                                if (checkMaintenance()) return;
                                setCreateModalVisible(true);
                            }}
                        >
                            Đăng thông báo
                        </Button>
                    )
                }
            >
                <Table 
                    columns={columns} 
                    dataSource={announcements} 
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize: pageSize,
                        total: total,
                        onChange: (p, s) => {
                            setPage(p);
                            setPageSize(s);
                        },
                        showSizeChanger: true
                    }}
                    scroll={{ x: 'max-content' }}
                />
            </Card>

            {/* Modal Create Announcement */}
            <Modal
                title={editingId ? "Cập nhật thông báo" : "Đăng thông báo mới"}
                open={createModalVisible}
                onOk={() => form.submit()}
                onCancel={() => {
                    setCreateModalVisible(false);
                    setEditingId(null);
                    form.resetFields();
                    setFileList([]);
                    setIsAllCompany(true);
                }}
                confirmLoading={submitting}
                width={800}
                maskClosable={false}
            >
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={{
                        priority: 'normal',
                        is_pinned: false,
                        target_users: [],
                        departments: []
                    }}
                >

                    <Form.Item
                        name="title"
                        label="Tiêu đề"
                        rules={[{ required: true, message: 'Vui lòng nhập tiêu đề' }]}
                    >
                        <Input placeholder="Nhập tiêu đề thông báo" />
                    </Form.Item>

                    <Form.Item
                        name="content"
                        label="Nội dung"
                        rules={[{ required: true, message: 'Vui lòng nhập nội dung' }]}
                    >
                        <JoditEditor config={{ height: 300, readonly: false }} />
                    </Form.Item>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <Form.Item name="category" label="Loại thông báo" style={{ minWidth: 200, flex: 1 }}>
                            <Select
                                placeholder="Chọn hoặc nhập loại mới"
                                showSearch
                                allowClear
                                dropdownRender={(menu) => (
                                    <>
                                        {menu}
                                        <Divider style={{ margin: '8px 0' }} />
                                        <Space style={{ padding: '0 8px 4px' }}>
                                            <Input
                                                placeholder="Loại mới..."
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                            <Button type="text" icon={<PlusOutlined />} onClick={() => {
                                                if (newCategory && !categoriesList.includes(newCategory)) {
                                                    setCategoriesList([...categoriesList, newCategory]);
                                                    form.setFieldValue('category', newCategory);
                                                    setNewCategory('');
                                                }
                                            }}>
                                                Tạo
                                            </Button>
                                        </Space>
                                    </>
                                )}
                            >
                                {categoriesList.map(cat => (
                                    <Select.Option key={cat} value={cat}>{cat}</Select.Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item name="priority" label="Độ ưu tiên" style={{ minWidth: 150 }}>
                            <Select>
                                <Select.Option value="low">Thấp</Select.Option>
                                <Select.Option value="normal">Thường</Select.Option>
                                <Select.Option value="high">Cao</Select.Option>
                            </Select>
                        </Form.Item>

                        <Form.Item label="Gửi toàn công ty (Tất cả)">
                            <Switch 
                                checked={isAllCompany} 
                                onChange={(checked) => setIsAllCompany(checked)} 
                                checkedChildren="Bật" 
                                unCheckedChildren="Tắt"
                            />
                        </Form.Item>

                        {!isAllCompany && (
                            <>
                                <Form.Item name="target_users" label="Nhân viên nhận" style={{ minWidth: 200, flex: 1 }}>
                                    <Select 
                                        mode="multiple" 
                                        options={usersList} 
                                        placeholder="Chọn nhân viên"
                                        filterOption={(input, option) =>
                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                        showSearch
                                    />
                                </Form.Item>

                                <Form.Item name="departments" label="Phòng ban nhận" style={{ minWidth: 200, flex: 1 }}>
                                    <Select 
                                        mode="multiple" 
                                        options={departmentsList} 
                                        placeholder="Chọn phòng ban"
                                        filterOption={(input, option) =>
                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                        }
                                        showSearch
                                    />
                                </Form.Item>
                            </>
                        )}
                    </div>

                    <Form.Item name="is_pinned" valuePropName="checked">
                        <Switch checkedChildren="Đã ghim" unCheckedChildren="Không ghim" />
                    </Form.Item>

                    <Form.Item label="Đính kèm file">
                        <Upload {...uploadProps}>
                            <Button icon={<UploadOutlined />}>Chọn file</Button>
                        </Upload>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Drawer Detail */}
            <Drawer
                title={
                    <Space>
                        {selectedAnnouncement?.is_pinned && <PushpinFilled style={{ color: '#f5222d' }} />}
                        {selectedAnnouncement?.title}
                    </Space>
                }
                placement="right"
                size="large"
                onClose={() => setDetailVisible(false)}
                open={detailVisible}
            >
                {selectedAnnouncement && (
                    <div>
                        <div style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            <Text type="secondary">
                                Đăng bởi: <strong style={{ color: '#000' }}>{selectedAnnouncement.created_by_name || 'Hệ thống'}</strong>
                            </Text>
                            <Text type="secondary">
                                Thời gian: <strong style={{ color: '#000' }}>{dayjs(selectedAnnouncement.created_at).format('DD/MM/YYYY HH:mm')}</strong>
                            </Text>
                            <Tag color={
                                selectedAnnouncement.priority === 'high' ? 'red' :
                                selectedAnnouncement.priority === 'normal' ? 'blue' : 'default'
                            }>
                                Ưu tiên: {
                                    selectedAnnouncement.priority === 'high' ? 'Cao' :
                                    selectedAnnouncement.priority === 'normal' ? 'Thường' : 'Thấp'
                                }
                            </Tag>
                        </div>
                        
                        <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">Đối tượng nhận: </Text>
                            {selectedAnnouncement.is_all_company ? (
                                <Tag color="green">Toàn công ty</Tag>
                            ) : (
                                <>
                                    {selectedAnnouncement.departments && selectedAnnouncement.departments.length > 0 && (
                                        <Tag color="cyan">{selectedAnnouncement.departments.length} Phòng ban</Tag>
                                    )}
                                    {selectedAnnouncement.target_users && selectedAnnouncement.target_users.length > 0 && (
                                        <Tag color="purple">{selectedAnnouncement.target_users.length} Nhân viên</Tag>
                                    )}
                                    {(!selectedAnnouncement.departments?.length && !selectedAnnouncement.target_users?.length) && (
                                        <Text type="secondary">Chỉ định</Text>
                                    )}
                                </>
                            )}
                        </div>
                        
                        <div 
                            className="ql-editor"
                            style={{ 
                                background: '#f5f5f5', 
                                padding: 16, 
                                borderRadius: 8,
                                minHeight: 200,
                                marginBottom: 24
                            }}
                            dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }} 
                        />

                        {selectedAnnouncement.attachments && selectedAnnouncement.attachments.length > 0 && (
                            <div>
                                <Title level={5}><PaperClipOutlined /> File đính kèm</Title>
                                <ul>
                                    {selectedAnnouncement.attachments.map(att => (
                                        <li key={att.id} style={{ marginBottom: 8 }}>
                                            <a href={att.file} target="_blank" rel="noreferrer">
                                                {att.file_name || 'Tải xuống'}
                                            </a>
                                            <Text type="secondary" style={{ marginLeft: 8 }}>
                                                ({Math.round(att.file_size / 1024)} KB)
                                            </Text>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </Drawer>
        </div>
    );
};

export default Announcements;
