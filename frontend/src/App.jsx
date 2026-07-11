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
  ModuleRoute,
} from './components/ProtectedRoute'

// Pages
import CustomerList from './pages/CustomerList'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Products from './pages/Products'
import Login from './pages/Login'
import OrderList from './pages/OrderList'
import ProductionList from './pages/ProductionList'
import DeliveryList from './pages/DeliveryList'
import WarrantyList from './pages/WarrantyList'
import QuotationList from './pages/QuotationList'
import PublicQuotation from './pages/PublicQuotation'
import ApprovalList from './pages/ApprovalList'
import RegisterCompany from './pages/RegisterCompany'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSettings from './pages/admin/AdminSettings'
import CompanyManagement from './pages/admin/CompanyManagement'
import SystemUserManagement from './pages/admin/SystemUserManagement'
import QuotationTemplateManagement from './pages/admin/QuotationTemplateManagement'
import RoleManagement from './pages/settings/RoleManagement'
import UserManagement from './pages/settings/UserManagement'
import DepartmentManagement from './pages/settings/DepartmentManagement'
import CompanyGeneralSettings from './pages/settings/CompanyGeneralSettings'

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
            <Route path="/quote/:token" element={<PublicQuotation />} />

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

              <Route path="/approvals" element={
                <ApprovalList />
              } />

              <Route path="/customers" element={
                <ModuleRoute moduleCode="crm">
                  <PermissionRoute permissionCode="crm.view" fallback="/dashboard">
                    <CustomerList />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/quotations" element={
                <ModuleRoute moduleCode="sales">
                  <PermissionRoute permissionCode="sales.view" fallback="/dashboard">
                    <QuotationList />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/orders" element={
                <ModuleRoute moduleCode="orders">
                  <PermissionRoute permissionCode="orders.view" fallback="/dashboard">
                    <OrderList />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/products" element={
                <ModuleRoute moduleCode="products">
                  <PermissionRoute permissionCode="products.view" fallback="/dashboard">
                    <Products />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/inventory" element={
                <ModuleRoute moduleCode="inventory">
                  <PermissionRoute permissionCode="inventory.view" fallback="/dashboard">
                    <Inventory />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/production" element={
                <ModuleRoute moduleCode="production">
                  <PermissionRoute permissionCode="production.view" fallback="/dashboard">
                    <ProductionList />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/delivery" element={
                <ModuleRoute moduleCode="delivery">
                  <PermissionRoute permissionCode="delivery.view" fallback="/dashboard">
                    <DeliveryList />
                  </PermissionRoute>
                </ModuleRoute>
              } />
              <Route path="/warranty" element={
                <ModuleRoute moduleCode="warranty">
                  <PermissionRoute permissionCode="warranty.view" fallback="/dashboard">
                    <WarrantyList />
                  </PermissionRoute>
                </ModuleRoute>
              } />

              {/* Company Admin routes */}
              <Route
                path="/settings/general"
                element={
                  <CompanyAdminRoute>
                    <CompanyGeneralSettings />
                  </CompanyAdminRoute>
                }
              />
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
              <Route
                path="/admin/quotation-templates"
                element={
                  <SuperAdminRoute>
                    <QuotationTemplateManagement />
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
