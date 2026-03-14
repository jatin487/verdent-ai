import { useState } from 'react'
import { A11yProvider } from './context/AccessibilityContext'
import Navbar from './components/Navbar'
import A11yWidget from './components/A11yWidget'
import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'
import SignDetector from './pages/SignDetector'
import './App.css'

export default function App() {
  const [page, setPage] = useState('home')

  return (
    <A11yProvider>
      <Navbar page={page} setPage={setPage} />
      {page === 'home'      && <LandingPage setPage={setPage} />}
      {page === 'dashboard' && <Dashboard />}
      {page === 'detector'  && <SignDetector />}
      <A11yWidget />
    </A11yProvider>
  )
}
