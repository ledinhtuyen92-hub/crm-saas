import { useEffect, useState } from 'react'
import { Alert, Table, Typography } from 'antd'
import api from '../utils/api'

const { Title } = Typography

function CustomerList() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoading(true)
      setError('')

      try {
        const response = await api.get('/crm/customers/')
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.results ?? []

        setCustomers(data)
      } catch {
        setError('Khong the tai danh sach khach hang. Vui long thu lai sau.')
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [])

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Address',
      dataIndex: 'address',
      key: 'address',
    },
  ]

  return (
    <section>
      <Title level={2}>Customers</Title>

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        columns={columns}
        dataSource={customers}
        loading={loading}
        rowKey={(record, index) => record.id ?? record.email ?? record.phone ?? index}
        pagination={{ pageSize: 10 }}
      />
    </section>
  )
}

export default CustomerList
