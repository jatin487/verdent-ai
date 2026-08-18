import { useEffect, useRef, useState } from "react";
import { A11yText } from "../context/AccessibilityContext";
import HeroThreeBackground from "../components/HeroThreeBackground";
import "./LandingPage.css";

const FEATURE_PILLS = [
  { icon: "🤝", label: "Sign Language AI" },
  { icon: "🎙️", label: "Speech Therapy" },
  { icon: "📖", label: "Interactive Learning" },
  { icon: "🌐", label: "Inclusive Design" },
];

const FLOATING_SIGNS = [
  { sign: "👋", label: "Hello", delay: "0s",  top: "18%", left: "8%"  },
  { sign: "🤟", label: "Love",  delay: "0.6s", top: "30%", right: "7%" },
  { sign: "✌️", label: "Peace", delay: "1.2s", top: "65%", left: "12%" },
  { sign: "🤙", label: "Connect", delay: "1.8s", bottom: "20%", right: "10%" },
  { sign: "👁️", label: "See",   delay: "0.3s", top: "75%", left: "45%" },
];

export default function LandingPage({ setPage }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="lp-root">
      {/* ── Three.js Background ─────────────────────────────── */}
      <HeroThreeBackground />

      {/* ── Gradient noise veil so text stays readable ──────── */}
      <div className="lp-veil" />

      {/* ── Floating sign cards ─────────────────────────────── */}
      {FLOATING_SIGNS.map((s, i) => (
        <div
          key={i}
          className="lp-sign-bubble"
          style={{
            top: s.top, left: s.left, right: s.right, bottom: s.bottom,
            animationDelay: s.delay,
          }}
        >
          <span className="lp-sign-bubble__emoji">{s.sign}</span>
          <span className="lp-sign-bubble__label">{s.label}</span>
        </div>
      ))}

      {/* ── Hero Content ─────────────────────────────────────── */}
      <div className={`lp-hero ${mounted ? "lp-hero--visible" : ""}`}>

        {/* AI badge */}
        <div className="lp-badge lp-hero__anim" style={{ "--d": "0s" }}>
          <span className="lp-badge__dot" />
          AI-Powered Sign Language Recognition
        </div>

        {/* Main title */}
        <A11yText as="h1" className="lp-title lp-hero__anim" style={{ "--d": "0.15s" }}>
          <span className="lp-title__cast">C.A.S.T.</span>
          <br />
          <span className="lp-title__sub">Communication Assistance &amp;</span>
          <br />
          <span className="lp-title__sub">Sign Translation</span>
        </A11yText>

        {/* Tagline */}
        <p className="lp-tagline lp-hero__anim" style={{ "--d": "0.3s" }}>
          Breaking barriers between the hearing and deaf communities —
          <br />
          <em>real-time, AI-powered, beautifully accessible.</em>
        </p>

        {/* Feature pills */}
        <div className="lp-pills lp-hero__anim" style={{ "--d": "0.45s" }}>
          {FEATURE_PILLS.map((p, i) => (
            <span key={i} className="lp-pill">
              {p.icon} {p.label}
            </span>
          ))}
        </div>

        {/* CTA – single creative Get Started */}
        <div className="lp-ctas lp-hero__anim" style={{ "--d": "0.6s" }}>
          <button
            id="btn-get-started"
            className="lp-btn-gs"
            onClick={() => setPage("roleselect")}
          >
            <span className="lp-btn-gs__ring" />
            <span className="lp-btn-gs__ring lp-btn-gs__ring--2" />
            <span className="lp-btn-gs__glow" />
            <span className="lp-btn-gs__content">
              <span className="lp-btn-gs__label">Get Started</span>
              <span className="lp-btn-gs__arrow">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </span>
            </span>
          </button>
        </div>

        {/* Trust strip */}
        <p className="lp-trust lp-hero__anim" style={{ "--d": "0.75s" }}>
          🔒 Free to try &nbsp;·&nbsp; 🌍 50+ sign gestures &nbsp;·&nbsp; ⚡ Real-time AI
        </p>
      </div>
    </main>
  );
}
