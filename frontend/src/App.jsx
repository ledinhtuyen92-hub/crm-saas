import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import 'antd/dist/reset.css'

import { AuthProvider } from './contexts/AuthContext'
import MainLayout from './components/MainLayout'
import {
  CompanyAdminRoute,
  ProtectedRoute,
  SuperAdminRoute,
  PermissionRoute,
} from './components/ProtectedRoute'

// Pages
import CustomerList from './pages/CustomerList'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import ProductionList from './pages/ProductionList'
import QuotationList from './pages/QuotationList'
import RegisterCompany from './pages/RegisterCompany'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSettings from './pages/admin/AdminSettings'
import CompanyManagement from './pages/admin/CompanyManagement'
import SystemUserManagement from './pages/admin/SystemUserManagement'
import RoleManagement from './pages/settings/RoleManagement'
import UserManagement from './pages/settings/UserManagement'
import DepartmentManagement from './pages/settings/DepartmentManagement'

function ApplicationLayout({ isDarkMode, toggleTheme }) {
  return (
    <ProtectedRoute>
      <MainLayout isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
        <Outlet />
      </MainLayout>
    </ProtectedRoute>
  )
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleTheme = () => {
    setIsDarkMode((currentMode) => !currentMode)
  }


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
            <Route element={<ApplicationLayout isDarkMode={isDarkMode} toggleTheme={toggleTheme} />}>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Main app routes */}
              <Route path="/dashboard" element={
                <PermissionRoute permissionCode="dashboard.view">
                  <Dashboard />
                </PermissionRoute>
              } />
              <Route path="/customers" element={<CustomerList />} />
              <Route path="/quotations" element={<QuotationList />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/production" element={<ProductionList />} />

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
              <Route
                path="/settings/departments"
                element={
                  <CompanyAdminRoute>
                    <DepartmentManagement />
                  </CompanyAdminRoute>
                }
              />

              {/* System Admin routes */}
              <Route
                path="/admin/dashboard"
                element={
                  <SuperAdminRoute>
                    <AdminDashboard />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="/admin/companies"
                element={
                  <SuperAdminRoute>
                    <CompanyManagement />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <SuperAdminRoute>
                    <SystemUserManagement />
                  </SuperAdminRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <SuperAdminRoute>
                    <AdminSettings />
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
