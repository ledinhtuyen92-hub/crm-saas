import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true) // kiểm tra token lúc khởi động
  const navigate = useNavigate()

  // ── Khi khởi động app: tải lại thông tin user từ token đã lưu ─────
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get('users/me/')
      .then(({ data }) => setUser(data))
      .catch(() => {
        localStorage.clear()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Đăng nhập ──────────────────────────────────────────────────────
  const login = useCallback(async (workspace_id, username, password) => {
    const { data } = await api.post('users/login/', {
      workspace_id,
      username,
      password,
    })
    localStorage.setItem('accessToken', data.access)
    localStorage.setItem('refreshToken', data.refresh)
    setUser(data.user)
    return data.user
  }, [])

  // ── Đăng xuất ──────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
    navigate('/login')
  }, [navigate])

  // ── Kiểm tra quyền ─────────────────────────────────────────────────
  const hasPermission = useCallback(
    (permissionCode) => {
      if (!user) return false
      if (user.is_superuser || user.is_company_admin) return true
      return (user.permissions || []).includes(permissionCode)
    },
    [user],
  )

  const isSuperAdmin = user?.is_superuser === true
  const isCompanyAdmin = user?.is_company_admin === true || user?.is_superuser === true
  const isAuthenticated = !!user

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated,
      isSuperAdmin,
      isCompanyAdmin,
      login,
      logout,
      hasPermission,
      refreshUser: async () => {
        const { data } = await api.get('users/me/')
        setUser(data)
      },
    }),
    [user, loading, isAuthenticated, isSuperAdmin, isCompanyAdmin, login, logout, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider')
  return ctx
}
