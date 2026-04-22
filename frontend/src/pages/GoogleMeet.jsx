import React from 'react';
import { A11yText } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import './GoogleMeet.css';

export default function GoogleMeet({ setPage }) {
  const { userRole } = useAuth();
  
  const pptText = {
    title: "Verdent AI: Google Meet Accessibility Integration",
    problem: "Traditional video conferencing lacks seamless, real-time accessibility for hearing and speech-impaired users.",
    solution: "Verdent's Google Meet integration provides real-time ISL (Indian Sign Language) translation and AI-powered captions directly within the call.",
    features: [
      "Real-time Sign-to-Speech: Convert hand gestures into audio/text for all participants.",
      "Smart Transcriptions: High-accuracy AI captions for better clarity.",
      "Inclusive Classroom: Empowering students with differences to participate equally.",
      "Browser Companion: A seamless overlay that works alongside Google Meet."
    ]
  };

  const copyToClipboard = () => {
    const text = `
${pptText.title}

Problem: ${pptText.problem}
Solution: ${pptText.solution}

Key Features:
${pptText.features.map(f => `- ${f}`).join('\n')}
    `;
    navigator.clipboard.writeText(text);
    alert("PPT Content copied to clipboard! ✨");
  };

  const navigateBack = () => {
    setPage(userRole === 'teacher' ? 'teacherDashboard' : 'dashboard');
  };

  return (
    <div className="gm-root fade-in">
      <header className="gm-header container">
        <button onClick={navigateBack} className="btn btn-ghost btn-sm">← Back to Dashboard</button>
        <div className="gm-badge">New Feature</div>
      </header>

      <main className="gm-container container">
        <section className="gm-hero">
          <div className="gm-hero-content">
            <h1 className="gm-title gradient-text">Google Meet <br />Accessibility Companion</h1>
            <p className="gm-subtitle">
              Break communication barriers in every meeting. Verdent AI now integrates 
              seamlessly with Google Meet to provide real-time Sign Language interpretation 
              and AI-driven captions.
            </p>
            <div className="gm-actions">
              <button className="btn btn-primary btn-lg" onClick={() => window.open('https://meet.google.com/new', '_blank')}>
                🚀 Start Accessible Meet
              </button>
              <button className="btn btn-secondary btn-lg" onClick={copyToClipboard}>
                📋 Copy PPT Content
              </button>
            </div>
          </div>
          
          <div className="gm-hero-visual glass-card">
            <div className="gm-mock-meet">
               <div className="gm-meet-header">
                  <div className="gm-meet-dot red"></div>
                  <div className="gm-meet-dot yellow"></div>
                  <div className="gm-meet-dot green"></div>
                  <span className="gm-meet-url">meet.google.com/abc-defg-hij</span>
               </div>
               <div className="gm-meet-body">
                  <div className="gm-participant-grid">
                     <div className="gm-participant p1"><span>Teacher</span></div>
                     <div className="gm-participant p2"><span>You (Verdent Active)</span></div>
                  </div>
                  <div className="gm-verdent-overlay">
                     <div className="gm-overlay-tag">Verdent AI Live 🤟</div>
                     <div className="gm-overlay-box">
                        <span className="gm-overlay-text">"Good morning everyone!"</span>
                        <div className="gm-overlay-sub">Translating: ISL ↔ English</div>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        </section>

        <section className="gm-details-grid">
           <div className="gm-card glass-card">
              <div className="gm-card-icon">🤟</div>
              <h3>Sign2Speech</h3>
              <p>Your hand gestures are instantly converted into audio for other participants in the meeting.</p>
           </div>
           <div className="gm-card glass-card">
              <div className="gm-card-icon">🎙️</div>
              <h3>AI Transcriptions</h3>
              <p>Advanced noise-filtering captions that highlight important keywords and action items.</p>
           </div>
           <div className="gm-card glass-card">
              <div className="gm-card-icon">♿</div>
              <h3>Universal Bridge</h3>
              <p>Works as a companion window or overlay, ensuring you never miss a beat of the conversation.</p>
           </div>
        </section>

        <section className="gm-ppt-preview glass-card">
           <div className="preview-header">
              <h3>PPT Reference Content</h3>
              <span className="copy-hint">Ready to share</span>
           </div>
           <div className="preview-body">
              <pre>
{`Title: ${pptText.title}

Overview:
${pptText.solution}

Core Capabilities:
${pptText.features.map(f => `• ${f}`).join('\n')}`}
              </pre>
           </div>
        </section>
      </main>
    </div>
  );
}
