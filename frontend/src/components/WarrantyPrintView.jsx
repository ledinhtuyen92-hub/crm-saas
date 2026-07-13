import React from 'react'
import { Row, Col, Typography } from 'antd'
import dayjs from 'dayjs'

const { Title, Text } = Typography

export default function WarrantyPrintView({ warranty, companyInfo, companySettings }) {
  if (!warranty) return null

  const displayContent = warranty.warranty_content || companySettings?.default_warranty_content || ''
  const displayRules = warranty.warranty_rules || companySettings?.default_warranty_rules || ''

  const renderTextWithNewlines = (text) => {
    if (!text) return null
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line}
        <br />
      </span>
    ))
  }

  return (
    <div
      className="warranty-print-container"
      style={{
        background: '#fff',
        width: '100%',
        maxWidth: 900,
        margin: '0 auto',
        padding: '20px 40px',
        color: '#000',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          background: '#1e3a8a',
          color: '#fff',
          padding: '24px 32px',
          borderRadius: 8,
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ flex: 1, paddingRight: 20 }}>
          {companyInfo?.logo ? (
            <img src={companyInfo.logo} alt="Logo" style={{ maxHeight: 60, marginBottom: 12, background: '#fff', padding: 4, borderRadius: 4 }} />
          ) : (
            <Title level={4} style={{ color: '#fff', margin: 0, marginBottom: 8, textTransform: 'uppercase' }}>
              {companyInfo?.name || 'CÔNG TY TNHH ABC'}
            </Title>
          )}
          <div style={{ fontSize: 12, lineHeight: 1.5, opacity: 0.9 }}>
            <div>{companyInfo?.address || 'Địa chỉ công ty'}</div>
            <div>Hotline: {companyInfo?.phone || '0988.xxx.xxx'}</div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Title level={1} style={{ color: '#fff', margin: 0, fontWeight: 800, fontSize: 32, letterSpacing: 1 }}>
            PHIẾU BẢO HÀNH
          </Title>
          <Text style={{ color: '#bfdbfe', fontSize: 14 }}>
            Mã BH: {warranty.warranty_code || '---'}
          </Text>
        </div>
      </div>

      <Row gutter={40}>
        <Col span={12}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: 12, color: '#1e3a8a', fontWeight: 800 }}>
            THÔNG TIN
          </Title>

          <div style={{ background: '#1e3a8a', color: '#fff', padding: '4px 12px', borderRadius: 4, display: 'inline-block', fontWeight: 'bold', marginBottom: 12 }}>
            KHÁCH HÀNG
          </div>
          
          <table style={{ width: '100%', marginBottom: 16, borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.6 }}>
            <tbody>
              <tr>
                <td style={{ width: 100, fontWeight: 600 }}>Họ và tên:</td>
                <td style={{ borderBottom: '1px dotted #ccc' }}>{warranty.customer_name}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>SĐT:</td>
                <td style={{ borderBottom: '1px dotted #ccc' }}>{warranty.customer_phone || '.........................'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, verticalAlign: 'top' }}>Địa chỉ:</td>
                <td style={{ borderBottom: '1px dotted #ccc' }}>
                  {warranty.customer?.address || '........................................................'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Mã Đơn hàng:</td>
                <td style={{ borderBottom: '1px dotted #ccc' }}>{warranty.order_number || '.........................'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: '#ef4444' }}>Ngày bàn giao:</td>
                <td style={{ borderBottom: '1px dotted #ccc', color: '#ef4444', fontWeight: 600 }}>
                  {warranty.start_date ? dayjs(warranty.start_date).format('DD/MM/YYYY') : '.........................'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600, color: '#ef4444' }}>Hạn bảo hành:</td>
                <td style={{ borderBottom: '1px dotted #ccc', color: '#ef4444', fontWeight: 600 }}>
                  {warranty.end_date ? dayjs(warranty.end_date).format('DD/MM/YYYY') : '.........................'}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ background: '#1e3a8a', color: '#fff', padding: '4px 12px', borderRadius: 4, display: 'inline-block', fontWeight: 'bold', marginBottom: 12 }}>
            NỘI DUNG BẢO HÀNH
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.4, textAlign: 'justify', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: 8, background: '#f8fafc' }}>
            {renderTextWithNewlines(displayContent)}
          </div>
        </Col>

        <Col span={12}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: 8, color: '#1e3a8a', fontWeight: 800 }}>
            QUY ĐỊNH BẢO HÀNH
          </Title>
          <div style={{ fontSize: 12, lineHeight: 1.4, textAlign: 'justify', border: '1px solid #e2e8f0', padding: '8px 10px', borderRadius: 8, background: '#fff' }}>
            {renderTextWithNewlines(displayRules)}
          </div>

          {/* ── CHỮ KÝ / ĐÓNG DẤU ── */}
          <div style={{ marginTop: 24, textAlign: 'center', pageBreakInside: 'avoid' }}>
            <Text strong style={{ fontSize: 16, display: 'block', color: '#1e3a8a' }}>
              {companyInfo?.director_title || 'ĐẠI DIỆN CÔNG TY'}
            </Text>
            <Text type="secondary" style={{ fontSize: 13, fontStyle: 'italic' }}>(Ký, đóng dấu)</Text>
            <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginTop: 8 }}>
              {companyInfo?.stamp_image && (
                <img
                  src={companyInfo.stamp_image}
                  alt="Stamp"
                  style={{ height: 110, maxWidth: 150, position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', opacity: 0.88, zIndex: 1, objectFit: 'contain' }}
                />
              )}
              {companyInfo?.director_signature && (
                <img
                  src={companyInfo.director_signature}
                  alt="Signature"
                  style={{ height: 90, maxWidth: 180, position: 'relative', zIndex: 2, objectFit: 'contain' }}
                />
              )}
            </div>
            <Text strong style={{ fontSize: 15, display: 'block', marginTop: 8, color: '#1e3a8a' }}>
              {companyInfo?.director_name || ''}
            </Text>
          </div>
        </Col>
      </Row>

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .warranty-print-container { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>
    </div>
  )
}