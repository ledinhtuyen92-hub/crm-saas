import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import 'antd/dist/reset.css'

import { AuthProvider } from './contexts/AuthContext'
import MainLayout from './components/MainLayout'
import { CompanyAdminRoute, ProtectedRoute, SuperAdminRoute } from './components/ProtectedRoute'

// Pages
import CustomerList from './pages/CustomerList'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RegisterCompany from './pages/RegisterCompany'
import CompanyManagement from './pages/admin/CompanyManagement'
import RoleManagement from './pages/settings/RoleManagement'
import UserManagement from './pages/settings/UserManagement'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleTheme = () => {
    setIsDarkMode((currentMode) => !currentMode)
  }

  const ApplicationLayout = () => (
    <ProtectedRoute>
      <MainLayout isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: '#1649c9',
        },
      }}
    >
      <BrowserRouter>
        {/* AuthProvider must be inside BrowserRouter so useNavigate works */}
        <AuthProvider>
          <Routes>
            {/* ── Public routes ──────────────────────────────────── */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<RegisterCompany />} />

            {/* ── Protected routes (requires login) ──────────────── */}
            <Route element={<ApplicationLayout />}>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Main app routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<CustomerList />} />

              {/* Company Admin routes */}
              <Route
                path="/settings/users"
                element={
                  <CompanyAdminRoute>
                    <UserManagement />
                  </CompanyAdminRoute>
                }
              />
              <Route
                path="/settings/roles"
                element={
                  <CompanyAdminRoute>
                    <RoleManagement />
                  </CompanyAdminRoute>
                }
              />

              {/* System Admin routes */}
              <Route
                path="/admin/companies"
                element={
                  <SuperAdminRoute>
                    <CompanyManagement />
                  </SuperAdminRoute>
                }
              />
            </Route>

            {/* ── Fallback ────────────────────────────────────────── */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
