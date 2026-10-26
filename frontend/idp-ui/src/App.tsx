import { Route, Routes } from 'react-router-dom'
import { AdminApp } from './pages/admin/AdminApp'
import { ConsentPage } from './pages/auth/ConsentPage'
import { HomePage } from './pages/auth/HomePage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}
