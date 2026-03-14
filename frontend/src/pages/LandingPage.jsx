import { A11yText } from '../context/AccessibilityContext'
import './LandingPage.css'

const FEATURES = [
  {
    icon: '🤝',
    badge: 'AI Detection',
    badgeCls: 'badge-violet',
    title: 'Sign Language Detector',
    desc: 'Real-time CNN-powered ASL gesture recognition. Show your hand — Verdent reads and speaks every letter instantly.',
    delay: 'delay-1',
  },
  {
    icon: '🔊',
    badge: 'Audio Learning',
    badgeCls: 'badge-sky',
    title: 'Audio-First Learning',
    desc: 'Every element on the platform reads itself aloud on hover/focus. Full TTS support for visually impaired learners.',
    delay: 'delay-2',
  },
  {
    icon: '♿',
    badge: 'Adaptive UI',
    badgeCls: 'badge-green',
    title: 'Adaptive Accessibility',
    desc: 'Dark, Light, High-Contrast themes. Dyslexia-friendly fonts. Text scaling. Keyboard-first navigation.',
    delay: 'delay-3',
  },
  {
    icon: '🧠',
    badge: 'AI Adaptive',
    badgeCls: 'badge-amber',
    title: 'Personalised Learning',
    desc: 'The AI adapts content complexity and pace to each student's learning pattern and accessibility needs.',
    delay: 'delay-4',
  },
]

const STATS = [
  { value: '26',  label: 'ASL Signs',       unit: '' },
  { value: '90',  label: 'Model Accuracy',  unit: '%+' },
  { value: '4',   label: 'Accessibility Modes', unit: '' },
  { value: '∞',   label: 'Learners Served', unit: '' },
]

export default function LandingPage({ setPage }) {
  return (
    <main id="main-content" className="landing">
      {/* Hero */}
      <section className="landing__hero" aria-label="Hero section">
        {/* Decorative orbs */}
        <div className="orb landing__orb-1" aria-hidden="true" />
        <div className="orb landing__orb-2" aria-hidden="true" />

        <div className="container landing__hero-inner">
          <div className="landing__badges fade-in-up">
            <span className="badge badge-violet">🏆 Hackathon 2025</span>
            <span className="badge badge-sky">Dev Bhoomi Uttarakhand University</span>
          </div>

          <A11yText as="h1" className="landing__headline fade-in-up delay-1">
            Education For
            <span className="landing__headline-accent"> Every Ability</span>
          </A11yText>

          <A11yText as="p" className="landing__subheadline fade-in-up delay-2">
            Verdent is an <strong>inclusive AI-powered e-learning platform</strong> with real-time sign language
            detection, adaptive audio learning, and intelligent accessibility tools that empower
            <em> every differently-abled student</em> to learn without barriers.
          </A11yText>

          <div className="landing__cta fade-in-up delay-3">
            <button className="btn btn-primary" onClick={() => setPage('detector')} id="cta-detector">
              🤝 Try Sign Detector
            </button>
            <button className="btn btn-ghost" onClick={() => setPage('dashboard')} id="cta-courses">
              📚 Explore Courses
            </button>
          </div>

          {/* Workflow diagram preview */}
          <div className="landing__flow fade-in-up delay-4" aria-label="System workflow">
            {['📷 Camera', '🔬 Preprocess', '🧠 CNN Model', '💬 Text', '🔊 TTS Audio'].map((step, i) => (
              <div key={i} className="landing__flow-step">
                <div className="landing__flow-node">{step}</div>
                {i < 4 && <div className="landing__flow-arrow" aria-hidden="true">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="landing__stats" aria-label="Platform statistics">
        <div className="container landing__stats-grid">
          {STATS.map((s, i) => (
            <div key={i} className={`landing__stat glass-card fade-in-up delay-${i + 1}`}>
              <span className="landing__stat-value gradient-text">{s.value}<sup>{s.unit}</sup></span>
              <span className="landing__stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="landing__features" aria-label="Platform features">
        <div className="container">
          <div className="landing__section-header">
            <span className="badge badge-violet">Features</span>
            <A11yText as="h2" className="landing__section-title">
              Built for <span className="gradient-text">Every Learner</span>
            </A11yText>
            <p className="landing__section-sub">
              Every feature is designed from the ground up with accessibility-first principles.
            </p>
          </div>

          <div className="landing__features-grid">
            {FEATURES.map((f, i) => (
              <article key={i} className={`landing__feature-card glass-card fade-in-up ${f.delay}`} aria-labelledby={`feat-title-${i}`}>
                <div className="landing__feature-icon">{f.icon}</div>
                <div>
                  <span className={`badge ${f.badgeCls}`}>{f.badge}</span>
                  <A11yText as="h3" id={`feat-title-${i}`} className="landing__feature-title">{f.title}</A11yText>
                  <p className="landing__feature-desc">{f.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* USP Banner */}
      <section className="landing__usp" aria-label="Unique Selling Propositions">
        <div className="container">
          <div className="landing__usp-card glass-card">
            <h2 className="landing__usp-title">Why Verdent?</h2>
            <ul className="landing__usp-list">
              {[
                '🤝 AI-powered sign language detection delivering maximum accessibility impact',
                '🧠 Adaptive learning system that personalises content for each differently-abled student',
                '🎧 Strong audio-based learning support for visually impaired learners',
                '⚡ All-in-one inclusive platform combining accessibility + AI in one seamless experience',
              ].map((item, i) => (
                <li key={i} className="landing__usp-item">
                  <A11yText>{item}</A11yText>
                </li>
              ))}
            </ul>
            <button className="btn btn-primary" onClick={() => setPage('detector')} id="usp-cta">
              🚀 Get Started Free
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing__footer" role="contentinfo">
        <div className="container">
          <span>🌿 <strong className="gradient-text">Verdent</strong> — Hardik / Sudo-l · Dev Bhoomi Uttarakhand University</span>
          <span className="landing__footer-tagline">Quality Education for Every Ability</span>
        </div>
      </footer>
    </main>
  )
}
