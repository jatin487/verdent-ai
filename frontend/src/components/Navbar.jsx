import { useState } from 'react'
import { useA11y } from '../context/AccessibilityContext'
import './Navbar.css'

const NAV_LINKS = [
  { id: 'home',     label: 'Home',          icon: '🏠' },
  { id: 'dashboard',label: 'Courses',       icon: '📚' },
  { id: 'detector', label: 'Sign Detector', icon: '🤝' },
]

export default function Navbar({ page, setPage }) {
  const { settings } = useA11y()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="navbar" role="banner">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <nav className="navbar__inner container" aria-label="Main navigation">
        {/* Logo */}
        <button className="navbar__logo" onClick={() => setPage('home')} aria-label="Verdent Home">
          <span className="navbar__logo-icon">🌿</span>
          <span className="navbar__logo-text gradient-text">Verdent</span>
        </button>

        {/* Desktop links */}
        <ul className="navbar__links" role="list">
          {NAV_LINKS.map(link => (
            <li key={link.id}>
              <button
                className={`navbar__link ${page === link.id ? 'active' : ''}`}
                onClick={() => setPage(link.id)}
                aria-current={page === link.id ? 'page' : undefined}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </button>
            </li>
          ))}
        </ul>

        {/* TTS indicator */}
        <div className="navbar__tts-pill" aria-label={`Text-to-speech is ${settings.tts ? 'on' : 'off'}`}>
          <span className={`tts-dot ${settings.tts ? 'on' : 'off'}`} />
          <span>{settings.tts ? '🔊 TTS On' : '🔇 TTS Off'}</span>
        </div>

        {/* Mobile hamburger */}
        <button
          className="navbar__hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="navbar__mobile-menu">
          {NAV_LINKS.map(link => (
            <button
              key={link.id}
              className={`navbar__mobile-link ${page === link.id ? 'active' : ''}`}
              onClick={() => { setPage(link.id); setMenuOpen(false) }}
            >
              {link.icon} {link.label}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}
