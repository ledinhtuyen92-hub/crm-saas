import { useState } from 'react'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import 'antd/dist/reset.css'
import MainLayout from './components/MainLayout'
import CustomerList from './pages/CustomerList'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import RegisterCompany from './pages/RegisterCompany'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleTheme = () => {
    setIsDarkMode((currentMode) => !currentMode)
  }

  const ApplicationLayout = () => (
    <MainLayout isDarkMode={isDarkMode} toggleTheme={toggleTheme}>
      <Outlet />
    </MainLayout>
  )

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterCompany />} />
          <Route element={<ApplicationLayout />}>
            <Route path="/" element={<CustomerList />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}

export default App
