import { Navigate, useLocation } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute — Bảo vệ routes yêu cầu đăng nhập.
 * Nếu chưa đăng nhập: redirect về /login.
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

/**
 * SuperAdminRoute — Chỉ cho phép System Administrator (is_superuser=true).
 * Các tài khoản khác sẽ bị redirect về /dashboard.
 */
export function SuperAdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

/**
 * CompanyAdminRoute — Cho phép Company Admin hoặc System Admin.
 * Nhân viên thường sẽ bị redirect về /dashboard.
 */
export function CompanyAdminRoute({ children }) {
  const { isAuthenticated, isCompanyAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!isCompanyAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

/**
 * Hook kiểm tra permission dùng được bất kỳ đâu trong component tree.
 * @param {string} permissionCode - vd: 'crm.view', 'sales.create'
 * @returns {boolean}
 */
export function usePermission(permissionCode) {
  const { hasPermission } = useAuth()
  return hasPermission(permissionCode)
}
