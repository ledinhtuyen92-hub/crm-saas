import React from 'react'
import { Row, Col, Typography, Table, Divider, Space } from 'antd'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const TransactionPrintView = ({ transaction, company }) => {
  if (!transaction) return null

  const isImport = transaction.type === 'import'
  const isExport = transaction.type === 'export'
  const isAdjust = transaction.type === 'adjust'

  const title = isImport ? 'PHIẾU NHẬP KHO' : isExport ? 'PHIẾU XUẤT KHO' : 'PHIẾU ĐIỀU CHỈNH KHO'
  const codeLabel = 'Số phiếu:'
  const dateLabel = 'Ngày lập:'

  // Helper cho định dạng tiền
  const formatMoney = (val) => {
    if (val == null) return '-'
    return new Intl.NumberFormat('vi-VN').format(val)
  }

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 50,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Mã SP',
      dataIndex: 'product_sku',
      key: 'product_sku',
      width: 120,
    },
    {
      title: 'Tên vật tư, hàng hoá',
      dataIndex: 'product_name',
      key: 'product_name',
    },
    {
      title: 'ĐVT',
      key: 'dvt',
      width: 80,
      align: 'center',
      render: () => 'Cái' // Mặc định vì transaction hiện tại chưa lưu ĐVT gốc. Tương lai có thể map từ product.
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'right',
      render: (val) => <Text strong>{val}</Text>
    }
  ]

  if (isImport) {
    columns.push({
      title: 'Đơn giá',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 120,
      align: 'right',
      render: (val) => formatMoney(val)
    })
    columns.push({
      title: 'Thành tiền',
      key: 'total',
      width: 140,
      align: 'right',
      render: (_, record) => {
        const qty = record.quantity || 0
        const price = record.unit_cost || 0
        return <Text strong>{formatMoney(qty * price)}</Text>
      }
    })
  }

  // Dữ liệu bảng (chỉ có 1 sản phẩm cho mỗi phiếu vì cấu trúc CSDL hiện tại)
  const tableData = [
    {
      key: transaction.id,
      product_sku: transaction.product_sku,
      product_name: transaction.product_name,
      quantity: transaction.quantity,
      unit_cost: transaction.unit_cost
    }
  ]

  // Tính tổng
  const totalAmount = transaction.quantity * (transaction.unit_cost || 0)

  const effectiveCompany = transaction.company_info || company

  return (
    <div className="printable-transaction-content" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000', padding: '20px 40px', background: '#fff', width: '100%', minHeight: 'auto' }}>
      
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 20 }}>
        <Col span={14}>
          <Space align="start" size="middle">
            {effectiveCompany?.logo && (
              <img
                src={effectiveCompany.logo}
                alt="Logo công ty"
                style={{ maxHeight: 75, maxWidth: 120, objectFit: 'contain', borderRadius: 4 }}
              />
            )}
            <div>
              <Title level={4} style={{ margin: 0, fontSize: 16, textTransform: 'uppercase' }}>{effectiveCompany?.name || 'TÊN CÔNG TY'}</Title>
              <Text style={{ display: 'block', fontSize: 13 }}>Địa chỉ: {effectiveCompany?.address || '.....................................'}</Text>
              <Text style={{ display: 'block', fontSize: 13 }}>Điện thoại: {effectiveCompany?.phone || '......................'}</Text>
            </div>
          </Space>
        </Col>
      </Row>

      {/* Title */}
      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <Title level={2} style={{ margin: 0, textTransform: 'uppercase', fontSize: 24, letterSpacing: '1px' }}>{title}</Title>
        <Text style={{ fontSize: 14, fontStyle: 'italic' }}>
          Ngày {dayjs(transaction.created_at).format('DD')} tháng {dayjs(transaction.created_at).format('MM')} năm {dayjs(transaction.created_at).format('YYYY')}
        </Text>
        <div style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 14 }}>{codeLabel} <Text strong>{transaction.transaction_code}</Text></Text>
        </div>
      </div>

      {/* Info Info */}
      <div style={{ marginBottom: 20, fontSize: 14, lineHeight: '1.8' }}>
        <Row>
          <Col span={24}>
            <Text>- Họ và tên người {isImport ? 'giao hàng' : 'nhận hàng'}: ......................................................................................................................</Text>
          </Col>
          <Col span={24}>
            <Text>- Kho hàng: <Text strong>{transaction.warehouse_name || '..........................................'}</Text></Text>
          </Col>
          <Col span={24}>
            <Text>- Lý do {isImport ? 'nhập' : 'xuất'}: {transaction.note || '.............................................................................................................................'}</Text>
          </Col>
          {transaction.reference_order && (
            <Col span={24}>
              <Text>- Kèm theo Đơn hàng số: <Text strong>{transaction.reference_order}</Text></Text>
            </Col>
          )}
        </Row>
      </div>

      {/* Table */}
      <Table
        dataSource={tableData}
        columns={columns}
        pagination={false}
        bordered
        size="middle"
        className="transaction-print-table"
      />

      {isImport && (
        <Row style={{ marginTop: 12 }}>
          <Col span={24}>
            <Text style={{ fontSize: 14 }}>- Tổng số tiền (Viết bằng chữ): ...............................................................................................................................</Text>
          </Col>
        </Row>
      )}

      {/* Signatures */}
      <Row style={{ marginTop: 50, textAlign: 'center', fontSize: 14 }}>
        <Col span={6}>
          <Text strong>Người lập phiếu</Text>
          <div style={{ fontStyle: 'italic', fontSize: 12 }}>(Ký, họ tên)</div>
          <div style={{ marginTop: 80 }}><Text>{transaction.created_by_name}</Text></div>
        </Col>
        <Col span={6}>
          <Text strong>Người {isImport ? 'giao hàng' : 'nhận hàng'}</Text>
          <div style={{ fontStyle: 'italic', fontSize: 12 }}>(Ký, họ tên)</div>
        </Col>
        <Col span={6}>
          <Text strong>Thủ kho</Text>
          <div style={{ fontStyle: 'italic', fontSize: 12 }}>(Ký, họ tên)</div>
        </Col>
        <Col span={6}>
          <Text strong>Kế toán trưởng</Text>
          <div style={{ fontStyle: 'italic', fontSize: 12 }}>(Ký, họ tên)</div>
        </Col>
      </Row>

      <style dangerouslySetInnerHTML={{ __html: `
        .transaction-print-table .ant-table-thead > tr > th {
          background-color: #f0f2f5 !important;
          color: #000 !important;
          font-weight: bold !important;
          text-align: center !important;
          border-color: #000 !important;
        }
        .transaction-print-table .ant-table-tbody > tr > td {
          border-color: #000 !important;
          color: #000 !important;
        }
        .transaction-print-table {
          border-color: #000 !important;
        }
      `}} />
    </div>
  )
}

export default TransactionPrintView
