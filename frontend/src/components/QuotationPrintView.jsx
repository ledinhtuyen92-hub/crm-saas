import React from 'react'
import { Card, Col, Divider, Row, Space, Table, Tag, Typography, Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

// Helper to compute line total consistently
const computeLineTotal = (item, templateOverride) => {
  const qty = Number(item.quantity || 1)
  const price = Number(item.unit_price || 0)
  const discount = Number(item.discount_percent || 0)
  const tmpl = templateOverride
  const tmplCode = tmpl?.code || 'STANDARD'
  const isLandscape = tmplCode === 'production_landscape_a4' || tmpl?.layout_config?.paper_orientation === 'landscape'
  if (isLandscape) {
    return Number((qty * price * (1 - discount / 100)).toFixed(0))
  }
  const area = Number(item.area || 0)
  if ((item.unit === 'm²' || item.custom_data?.unit === 'm²' || (area > 0 && item.width > 0 && item.height > 0)) && area > 0) {
    return Number((area * qty * price * (1 - discount / 100)).toFixed(0))
  }
  return Number((qty * price * (1 - discount / 100)).toFixed(0))
}

const computeRowSpan = (data, index, field = 'product') => {
  if (!data || !data[index]) return 1
  const currentVal = data[index]?.[field]
  if (!currentVal) return 1
  if (index > 0 && data[index - 1]?.[field] === currentVal) {
    return 0
  }
  let count = 1
  for (let i = index + 1; i < data.length; i++) {
    if (data[i]?.[field] === currentVal) {
      count++
    } else {
      break
    }
  }
  return count
}

const computeProductSTT = (data, index, field = 'product') => {
  if (!data) return 0
  let count = 0
  for (let i = 0; i <= index; i++) {
    if (i === 0 || data[i]?.[field] !== data[i - 1]?.[field]) {
      count++
    }
  }
  return count
}

export default function QuotationPrintView({ quotation, type = 'quotation', effectiveTemplate, isCompanyAdmin, products = [], renderCustomerSignature }) {
  if (!quotation) return null
  
  const isLand = effectiveTemplate?.layout_config?.paper_orientation === 'landscape' || effectiveTemplate?.code === 'production_landscape_a4'
  const themeColor = effectiveTemplate?.layout_config?.theme_color || '#1649c9'

  const docNumber = type === 'order' ? quotation.order_number : quotation.quotation_number;
  const defaultTitle = type === 'order' ? 'ĐƠN HÀNG SẢN XUẤT' : (isLand ? 'BÁO GIÁ SẢN XUẤT CỬA COMPOSITE' : 'Bảng Báo Giá Chi Tiết');
  
  let docTitle = effectiveTemplate?.layout_config?.custom_title || defaultTitle;
  if (type === 'quotation' && quotation?.company_info?.custom_quotation_title) {
      docTitle = quotation.company_info.custom_quotation_title;
  } else if (type === 'order' && quotation?.company_info?.custom_order_title) {
      docTitle = quotation.company_info.custom_order_title;
  }

  return (
    <div className="printable-quotation-content" style={{ fontFamily: effectiveTemplate?.layout_config?.font_family || 'Inter, sans-serif' }}>
      {/* ── Header: Bên trái Logo, Bên phải TT Công ty ───────────── */}
      <div
        style={{
          marginBottom: 20,
          padding: '20px 24px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
        }}
      >
        <Row justify="space-between" align="middle" gutter={24}>
          <Col xs={24} sm={8} style={{ textAlign: 'left' }}>
            {(quotation?.company_info?.logo || effectiveTemplate?.company_info?.logo) ? (
              <img
                src={quotation?.company_info?.logo || effectiveTemplate?.company_info?.logo}
                alt="Logo công ty"
                style={{ maxHeight: 75, maxWidth: '100%', objectFit: 'contain', borderRadius: 4 }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  background: '#e0e7ff',
                  color: '#3730a3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                LOGO
              </div>
            )}
          </Col>

          <Col xs={24} sm={16} style={{ textAlign: 'right' }}>
            <Title level={4} style={{ margin: '0 0 4px 0', color: '#1e3a8a', fontWeight: 700 }}>
              {quotation?.company_info?.name || effectiveTemplate?.company_info?.name || 'TÊN CÔNG TY CỦA BẠN'}
            </Title>
            <div style={{ color: '#475569', fontSize: 13.5, lineHeight: '1.6' }}>
              <div><strong>MST:</strong> {quotation?.company_info?.tax_code || effectiveTemplate?.company_info?.tax_code || 'Chưa cập nhật'}</div>
              <div><strong>Địa chỉ:</strong> {quotation?.company_info?.address || effectiveTemplate?.company_info?.address || 'Chưa cập nhật'}</div>
              <div><strong>Hotline:</strong> {quotation?.company_info?.phone || effectiveTemplate?.company_info?.phone || 'Chưa cập nhật'}</div>
            </div>
            {isCompanyAdmin && (
              <div style={{ marginTop: 8 }}>
                <Button
                  size="small"
                  type="dashed"
                  icon={<SettingOutlined />}
                  onClick={() => window.location.href = '/settings/general'}
                >
                  ⚙️ Sửa thông tin & Logo
                </Button>
              </div>
            )}
          </Col>
        </Row>
      </div>

      <div style={{ textAlign: 'center', margin: '24px 0 24px', padding: '0 16px' }}>
        <Title level={2} style={{ margin: '0 0 8px 0', color: '#1649c9', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
          {docTitle}
        </Title>
        <div style={{ marginBottom: 12 }}>
          <Space size={16} style={{ justifyContent: 'center', display: 'inline-flex', background: '#eff6ff', padding: '4px 16px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
            <span style={{ color: '#1d4ed8', fontSize: 13.5 }}>Số {type === 'order' ? 'đơn hàng' : 'báo giá'}: <strong>{docNumber}</strong></span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#334155', fontSize: 13.5 }}>Ngày {type === 'order' ? 'tạo' : 'báo giá'}: <strong>{dayjs(quotation.created_at).format('DD/MM/YYYY')}</strong></span>
          </Space>
        </div>
        <div
          style={{
            color: '#475569',
            fontSize: 14,
            fontStyle: 'italic',
            maxWidth: 680,
            margin: '0 auto',
            lineHeight: '1.6',
          }}
        >
          Kính gửi Quý khách hàng, chúng tôi xin trân trọng gửi bảng {type === 'order' ? 'đơn hàng' : 'báo giá'} các hạng mục sản phẩm / dịch vụ chi tiết dưới đây:
        </div>
      </div>

      {isLand ? (
        <Row gutter={16} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ background: '#f8fafc', borderColor: '#cbd5e1', borderRadius: 10, height: '100%' }}>
              <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 13.5, marginBottom: 8, borderBottom: '1px solid #e2e8f0', paddingBottom: 4 }}>
                🏢 BÊN BÁN (BÊN B): {quotation?.company_info?.name || effectiveTemplate?.company_info?.name || 'CÔNG TY CỦA BẠN'}
              </div>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: '1.7' }}>
                <div><strong>Đại diện:</strong> {quotation?.company_info?.director_name || effectiveTemplate?.company_info?.director_name || 'Nguyễn Anh Tuấn'} • <strong>Chức vụ:</strong> {quotation?.company_info?.director_title || effectiveTemplate?.company_info?.director_title || 'Giám đốc'}</div>
                <div><strong>Mã số thuế:</strong> {quotation?.company_info?.tax_code || effectiveTemplate?.company_info?.tax_code || '0111100289'}</div>
                <div><strong>Điện thoại:</strong> {quotation?.company_info?.phone || effectiveTemplate?.company_info?.phone || '0961442882'}</div>
                <div><strong>Địa chỉ:</strong> {quotation?.company_info?.address || effectiveTemplate?.company_info?.address || 'Hà Đông, Hà Nội'}</div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card size="small" style={{ background: '#eff6ff', borderColor: '#bfdbfe', borderRadius: 10, height: '100%' }}>
              <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, marginBottom: 8, borderBottom: '1px solid #bfdbfe', paddingBottom: 4 }}>
                👤 BÊN MUA (BÊN A): {quotation.customer_name || 'Khách hàng lẻ'}
              </div>
              <div style={{ fontSize: 13, color: '#334155', lineHeight: '1.7' }}>
                <div><strong>Khách hàng:</strong> {quotation.customer_name || 'Khách hàng lẻ'}</div>
                <div><strong>Số điện thoại:</strong> <Text strong>{quotation.customer_phone || '—'}</Text></div>
                <div><strong>Email / MST:</strong> {quotation.customer_email || '—'}</div>
                <div><strong>Địa chỉ:</strong> {quotation.customer_address || quotation.customer_city || '—'}</div>
                <div>
                  <strong>Ngày lắp đặt dự kiến:</strong>{' '}
                  <strong style={{ color: '#2563eb' }}>
                    {quotation.installation_date ? dayjs(quotation.installation_date).format('DD/MM/YYYY') : 'Chưa xác định'}
                  </strong>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      ) : (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 18px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
          }}
        >
          <div style={{ fontWeight: 700, color: '#1d4ed8', fontSize: 13.5, marginBottom: 8, borderBottom: '1px solid #dbeafe', paddingBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>👤 THÔNG TIN KHÁCH HÀNG / ĐỐI TÁC</span>
            {quotation.installation_date && (
              <span style={{ fontSize: 13, fontWeight: 600, color: '#2563eb' }}>
                📅 Ngày lắp đặt dự kiến: {dayjs(quotation.installation_date).format('DD/MM/YYYY')}
              </span>
            )}
          </div>
          <Row gutter={[20, 6]} style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.7 }}>
            <Col xs={24} sm={12}>
              <strong>Khách hàng:</strong> <span style={{ fontWeight: 600, color: '#1e3a8a' }}>{quotation.customer_name || 'Khách hàng lẻ'}</span>
            </Col>
            <Col xs={24} sm={12}>
              <strong>Điện thoại:</strong> <span style={{ fontWeight: 600 }}>{quotation.customer_phone || '—'}</span>
            </Col>
            <Col xs={24} sm={12}>
              <strong>Địa chỉ:</strong> {quotation.customer_address || quotation.customer_city || '—'}
            </Col>
            <Col xs={24} sm={12}>
              <strong>Email:</strong> {quotation.customer_email || '—'}
            </Col>
          </Row>
        </div>
      )}

      <Title level={5}>Danh sách hạng mục báo giá</Title>
      <Table
        dataSource={quotation.items || []}
        rowKey="id"
        pagination={false}
        size="small"
        columns={
          isLand ? [
            {
              title: 'STT',
              key: 'stt',
              width: 50,
              align: 'center',
              render: (_, __, idx) => {
                const rowSpan = computeRowSpan(quotation.items || [], idx, 'product')
                const sttNum = computeProductSTT(quotation.items || [], idx, 'product')
                return {
                  children: <Text strong>{sttNum}</Text>,
                  props: { rowSpan },
                }
              },
            },
            {
              title: 'MẪU CỬA / SẢN PHẨM',
              key: 'product_info',
              width: 240,
              render: (_, r, idx) => {
                const prodObj = (products || []).find((p) => p && p.id === r?.product)
                const imgUrl = r?.product_image || (prodObj ? (prodObj.image_url || prodObj.image) : null)
                const rowSpan = computeRowSpan(quotation.items || [], idx, 'product')
                return {
                  children: (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '6px 4px', gap: 6, width: '100%' }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt="prod" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }} />
                      ) : null}
                      <Text strong style={{ display: 'block', color: '#0f172a', fontSize: 13.5, textAlign: 'left', width: '100%', lineHeight: 1.3 }}>
                        {r.product_name || (prodObj ? prodObj.name : '—')}
                      </Text>
                      {(r.spec || (prodObj && prodObj.description) || r.note) && (
                        <div style={{ fontSize: 11.5, color: '#475569', textAlign: 'left', width: '100%', lineHeight: 1.4, marginTop: 2, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>
                          {r.spec || (prodObj && prodObj.description) || r.note}
                        </div>
                      )}
                    </div>
                  ),
                  props: { rowSpan },
                }
              },
            },
            {
              title: 'KÍCH THƯỚC Ô CHỜ (mm)',
              children: [
                {
                  title: 'Cao',
                  dataIndex: 'height',
                  width: 70,
                  align: 'center',
                  render: (v) => <Text>{v || 0}</Text>,
                },
                {
                  title: 'Rộng',
                  dataIndex: 'width',
                  width: 70,
                  align: 'center',
                  render: (v) => <Text>{v || 0}</Text>,
                },
                {
                  title: 'Dày',
                  dataIndex: 'thickness',
                  width: 70,
                  align: 'center',
                  render: (v, r) => <Text>{v || r.custom_data?.thickness || 0}</Text>,
                },
              ],
            },
            {
              title: 'KÝ HIỆU',
              key: 'symbol',
              width: 90,
              align: 'center',
              render: (_, r) => {
                const sym = r.custom_data?.symbol || r.symbol
                return sym ? <Tag color="blue" style={{ fontWeight: 600 }}>{sym}</Tag> : <Text type="secondary">—</Text>
              },
            },
            {
              title: 'GHI CHÚ KỸ THUẬT',
              dataIndex: 'note',
              key: 'note',
              width: 150,
              render: (val) => <Text style={{ fontSize: 12 }}>{val || '—'}</Text>,
            },
            {
              title: 'SL',
              dataIndex: 'quantity',
              key: 'quantity',
              align: 'center',
              width: 50,
            },
            {
              title: 'ĐVT',
              key: 'unit',
              align: 'center',
              width: 60,
              render: (_, r) => <Text>{r.unit || r.custom_data?.unit || 'bộ'}</Text>,
            },
            {
              title: 'ĐƠN GIÁ/BỘ',
              dataIndex: 'unit_price',
              key: 'unit_price',
              align: 'right',
              width: 120,
              render: (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`,
            },
            {
              title: 'TỔNG TIỀN',
              key: 'total',
              align: 'right',
              width: 130,
              render: (_, r) => {
                const tot = computeLineTotal(r, effectiveTemplate)
                return <Text strong style={{ color: '#16a34a' }}>{tot.toLocaleString('vi-VN')} đ</Text>
              },
            },
          ] : [
            {
              title: 'STT',
              key: 'stt',
              width: 42,
              align: 'center',
              render: (_, __, idx) => <Text strong style={{ color: themeColor }}>{idx + 1}</Text>,
            },
            {
              title: 'Sản phẩm / Hàng hoá',
              dataIndex: 'product_name',
              key: 'product_name',
              width: 240,
              render: (val) => <Text strong style={{ color: '#0f172a', lineHeight: 1.4 }}>{val}</Text>,
            },
            {
              title: 'Kích thước / Ghi chú',
              dataIndex: 'note',
              key: 'note',
              width: 175,
              render: (val) => val
                ? <Text style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', color: '#334155', lineHeight: 1.4 }}>{val}</Text>
                : <Text type="secondary">—</Text>,
            },
            {
              title: 'ĐVT',
              key: 'unit',
              width: 55,
              align: 'center',
              render: (_, r) => <Text>{r.unit || r.custom_data?.unit || 'cái'}</Text>,
            },
            {
              title: 'SL',
              dataIndex: 'quantity',
              key: 'quantity',
              align: 'center',
              width: 48,
              render: (v) => <Text strong>{v || 1}</Text>,
            },
            {
              title: 'Đơn giá',
              dataIndex: 'unit_price',
              key: 'unit_price',
              align: 'right',
              width: 110,
              render: (v) => `${Number(v || 0).toLocaleString('vi-VN')} đ`,
            },
            {
              title: 'CK%',
              dataIndex: 'discount_percent',
              key: 'discount_percent',
              align: 'center',
              width: 50,
              render: (v) => v > 0 ? <Text type="warning">{v}%</Text> : <Text type="secondary">—</Text>,
            },
            {
              title: 'Thành tiền',
              key: 'total',
              align: 'right',
              width: 125,
              render: (_, r) => {
                const tot = computeLineTotal(r, effectiveTemplate)
                return <Text strong style={{ color: '#16a34a' }}>{tot.toLocaleString('vi-VN')} đ</Text>
              },
            },
          ]
        }
      />

      <Divider />
      <Row justify="end">
        <Col span={12} style={{ textAlign: 'right' }}>
          {Number(quotation.shipping_fee || 0) > 0 && (
            <div><Text type="secondary">Phí vận chuyển:</Text> <Text strong>+{Number(quotation.shipping_fee).toLocaleString('vi-VN')} đ</Text></div>
          )}
          {Number(quotation.installation_fee || 0) > 0 && (
            <div><Text type="secondary">Phí thi công / lắp đặt:</Text> <Text strong>+{Number(quotation.installation_fee).toLocaleString('vi-VN')} đ</Text></div>
          )}
          <div><Text type="secondary">Chiết khấu chung:</Text> <Text strong>-{Number(quotation.discount_total || 0).toLocaleString('vi-VN')} đ</Text></div>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">TỔNG THANH TOÁN:</Text>{' '}
            <Title level={4} style={{ display: 'inline', color: '#16a34a', margin: 0 }}>
              {Number(quotation.total_amount || 0).toLocaleString('vi-VN')} đ
            </Title>
          </div>
        </Col>
      </Row>

      {(quotation.notes || effectiveTemplate?.company_default_terms || effectiveTemplate?.footer_content) && (
        <Card size="small" style={{ marginTop: 24, background: '#f8fafc', borderColor: '#e2e8f0' }}>
          <Text strong style={{ color: '#0f172a' }}>Ghi chú & Điều khoản thanh toán:</Text>
          <Paragraph style={{ margin: '8px 0 0', color: '#334155', whiteSpace: 'pre-wrap' }}>
            {quotation.notes || effectiveTemplate?.company_default_terms || effectiveTemplate?.footer_content}
          </Paragraph>
        </Card>
      )}

      {/* Khối Chữ Ký & Con Dấu */}
      <Row justify="space-between" className="signature-block" style={{ marginTop: 40, textAlign: 'center', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        <Col span={10}>
          <Text strong style={{ display: 'block', fontSize: 13, color: '#1e293b' }}>BÊN MUA / KHÁCH HÀNG</Text>
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</Text>
          
          {renderCustomerSignature ? (
            renderCustomerSignature()
          ) : (
            quotation?.status === 'accepted' && quotation?.signature_image ? (
              <div style={{ height: 145, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                <img 
                  src={quotation.signature_image} 
                  alt="Customer Signature" 
                  style={{ height: 100, objectFit: 'contain' }}
                />
                <Text strong style={{ fontSize: 14, color: '#0f172a', marginTop: 8 }}>{quotation.customer_name_signed}</Text>
                <Tag color="green" style={{ marginTop: 4 }}>Đã ký: {dayjs(quotation.signed_at).format('DD/MM/YYYY HH:mm')}</Tag>
              </div>
            ) : (
              <div style={{ height: 130 }} />
            )
          )}
        </Col>
        <Col span={10} style={{ position: 'relative' }}>
          <Text strong style={{ display: 'block', fontSize: 13, color: '#1e293b' }}>
            {quotation?.company_info?.director_title || effectiveTemplate?.company_info?.director_title || 'ĐẠI DIỆN CÔNG TY'}
          </Text>
          <Text type="secondary" style={{ fontSize: 11, fontStyle: 'italic' }}>(Ký, đóng dấu)</Text>
          <div style={{ height: 145, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 12 }}>
            {(() => {
              const stImg = quotation?.company_info?.stamp || quotation?.company_info?.stamp_image || effectiveTemplate?.company_info?.stamp || effectiveTemplate?.company_info?.stamp_image
              const sigImg = quotation?.company_info?.signature || quotation?.company_info?.director_signature || effectiveTemplate?.company_info?.signature || effectiveTemplate?.company_info?.director_signature
              return (
                <>
                  {stImg && (
                    <img
                      src={stImg}
                      alt="Stamp"
                      style={{ height: 135, maxWidth: 165, position: 'absolute', opacity: 0.88, zIndex: 1, objectFit: 'contain' }}
                    />
                  )}
                  {sigImg && (
                    <img
                      src={sigImg}
                      alt="Signature"
                      style={{ height: 115, maxWidth: 200, position: 'relative', zIndex: 2, objectFit: 'contain' }}
                    />
                  )}
                </>
              )
            })()}
          </div>
          <Text strong style={{ display: 'block', fontSize: 15, color: '#0f172a', marginTop: 8 }}>
            {quotation?.company_info?.director_name || effectiveTemplate?.company_info?.director_name || ''}
          </Text>
        </Col>
      </Row>
    </div>
  )
}
