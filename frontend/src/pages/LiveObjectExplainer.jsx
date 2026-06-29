import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getObjectExplanation,
  OBJECT_KNOWLEDGE_BASE,
  getSpokenExplanation,
} from '../services/objectExplainerService';
import { getLandmarksForLetter, getLandmarksForCode } from '../services/doubtAiService';
import './LiveObjectExplainer.css';

// MediaPipe hand connection pairs for avatar skeleton
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Browsable objects (excluding default/person)
const BROWSE_OBJECTS = Object.entries(OBJECT_KNOWLEDGE_BASE)
  .filter(([k]) => !['default', 'person'].includes(k))
  .map(([key, val]) => ({ key, ...val }));

export default function LiveObjectExplainer({ setPage }) {
  // ── Mode: camera | browse ──────────────────────────────
  const [mode, setMode] = useState('camera');

  // ── Camera States ──────────────────────────────────────
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const tfModelRef = useRef(null);

  const [camState, setCamState] = useState('idle'); // idle | loading | active | error
  const [modelLoaded, setModelLoaded] = useState(false);

  // ── Detection States ───────────────────────────────────
  const [detections, setDetections] = useState([]); // [{bbox, class, score}]
  const [frozenEntry, setFrozenEntry] = useState(null); // locked explanation
  const [isFrozen, setIsFrozen] = useState(false);

  // ── Current explanation (live or frozen) ───────────────
  const [currentExplanation, setCurrentExplanation] = useState(null);

  // ── Speech States ──────────────────────────────────────
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ── Sign Language Avatar States ────────────────────────
  const avatarCanvasRef = useRef(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [avatarActiveWord, setAvatarActiveWord] = useState('');
  const [avatarActiveLetter, setAvatarActiveLetter] = useState('');
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [avatarFaceBlink, setAvatarFaceBlink] = useState(false);
  const currentHandRef = useRef(getLandmarksForCode('TUCKED-1111'));
  const targetHandRef = useRef(getLandmarksForCode('TUCKED-1111'));

  // ── Browse Mode Selected ───────────────────────────────
  const [browseSelected, setBrowseSelected] = useState(null);

  // ── TF.js CDN loader ──────────────────────────────────
  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

  // ── Load TF.js + COCO-SSD ─────────────────────────────
  const loadTensorFlow = useCallback(async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
      const model = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
      tfModelRef.current = model;
      setModelLoaded(true);
      return model;
    } catch (err) {
      console.error('TF.js load error:', err);
      return null;
    }
  }, []);

  // ── Start Camera ───────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCamState('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise(r => { videoRef.current.onloadedmetadata = r; });
        videoRef.current.play();
      }

      // Load model if not yet loaded
      let model = tfModelRef.current;
      if (!model) {
        model = await loadTensorFlow();
      }

      if (!model) {
        setCamState('error');
        return;
      }

      setCamState('active');
      runDetectionLoop(model);
    } catch (err) {
      console.error('Camera error:', err);
      setCamState('error');
    }
  }, [loadTensorFlow]);

  // ── Stop Camera ────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCamState('idle');
  }, []);

  // ── Detection Loop ─────────────────────────────────────
  const lastDetectTime = useRef(0);
  const runDetectionLoop = useCallback((model) => {
    const detect = async (time) => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      // Throttle to ~5fps for performance
      if (time - lastDetectTime.current > 200) {
        lastDetectTime.current = time;
        try {
          const preds = await model.detect(videoRef.current);
          if (!isFrozen) {
            setDetections(preds);
            drawBoundingBoxes(preds);

            // Pick highest-confidence detection
            if (preds.length > 0) {
              const top = preds.reduce((a, b) => a.score > b.score ? a : b);
              if (top.score > 0.45) {
                const exp = getObjectExplanation(top.class);
                setCurrentExplanation(exp);
              }
            } else {
              // No detection — clear after short delay
              setCurrentExplanation(null);
            }
          }
        } catch (e) {
          // Ignore frame errors
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };
    animFrameRef.current = requestAnimationFrame(detect);
  }, [isFrozen]);

  // ── Draw bounding boxes on canvas ─────────────────────
  const drawBoundingBoxes = (preds) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    preds.forEach(pred => {
      if (pred.score < 0.45) return;
      const [x, y, w, h] = pred.bbox;
      const exp = getObjectExplanation(pred.class);

      // Bounding box
      ctx.strokeStyle = exp.color || '#10b981';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = exp.color || '#10b981';
      ctx.strokeRect(x, y, w, h);
      ctx.shadowBlur = 0;

      // Label background
      const label = `${exp.emoji} ${exp.name}  ${Math.round(pred.score * 100)}%`;
      ctx.font = 'bold 14px Inter, sans-serif';
      const textW = ctx.measureText(label).width;
      ctx.fillStyle = exp.color || '#10b981';
      ctx.globalAlpha = 0.85;
      const labelY = y > 30 ? y - 6 : y + h + 24;
      ctx.fillRect(x, labelY - 20, textW + 16, 26);
      ctx.globalAlpha = 1;

      // Label text
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 8, labelY - 2);

      // Corner brackets
      const cs = 14;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      const corners = [
        [x, y, cs, 0, cs, 0],
        [x + w, y, -cs, 0, cs, 0],
        [x, y + h, cs, 0, -cs, 0],
        [x + w, y + h, -cs, 0, -cs, 0],
      ];
      corners.forEach(([cx, cy, dx1, dy1, dx2, dy2]) => {
        ctx.beginPath();
        ctx.moveTo(cx + dx1, cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + dy2);
        ctx.stroke();
      });
    });
  };

  // ── Freeze / Unfreeze ──────────────────────────────────
  const handleFreeze = () => {
    if (isFrozen) {
      setIsFrozen(false);
      setFrozenEntry(null);
    } else if (currentExplanation) {
      setIsFrozen(true);
      setFrozenEntry(currentExplanation);
    }
  };

  // ── Text-to-Speech ─────────────────────────────────────
  const handleSpeak = useCallback(() => {
    if (!window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsAvatarTalking(false);
      return;
    }

    const entry = isFrozen ? frozenEntry : currentExplanation;
    if (!entry) return;

    const text = getSpokenExplanation(entry);
    const words = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').split(/\s+/);
    let wi = 0;

    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.05;

    utter.onstart = () => {
      setIsSpeaking(true);
      setIsAvatarTalking(true);
      if (!showAvatar) setShowAvatar(true);
    };

    utter.onend = () => {
      setIsSpeaking(false);
      setIsAvatarTalking(false);
      setAvatarActiveWord('');
      setAvatarActiveLetter('');
      targetHandRef.current = getLandmarksForCode('TUCKED-1111');
    };

    const signInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) { clearInterval(signInterval); return; }
      if (wi < words.length) {
        const w = words[wi];
        setAvatarActiveWord(w);
        const letter = w[0] ? w[0].toUpperCase() : 'B';
        setAvatarActiveLetter(letter);
        targetHandRef.current = getLandmarksForLetter(letter);
        wi++;
      }
    }, 900);

    window.speechSynthesis.speak(utter);
  }, [isSpeaking, isFrozen, frozenEntry, currentExplanation, showAvatar]);

  // ── Avatar blink ──────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setAvatarFaceBlink(true);
      setTimeout(() => setAvatarFaceBlink(false), 180);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  // ── Avatar canvas render loop ──────────────────────────
  useEffect(() => {
    if (!showAvatar) return;
    const canvas = avatarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width, H = canvas.height;

      const cur = currentHandRef.current;
      const tgt = targetHandRef.current;
      const lerped = cur.map((pt, i) => {
        const t = tgt[i] || pt;
        const f = 0.16;
        return { x: pt.x + (t.x - pt.x) * f, y: pt.y + (t.y - pt.y) * f, z: pt.z + (t.z - pt.z) * f };
      });
      currentHandRef.current = lerped;

      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)';
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#0ea5e9';

      for (const [a, b] of HAND_CONNECTIONS) {
        const pA = lerped[a], pB = lerped[b];
        if (pA && pB) {
          ctx.beginPath();
          ctx.moveTo(pA.x * W * 0.95 + W * 0.025, pA.y * H * 0.9 - H * 0.05);
          ctx.lineTo(pB.x * W * 0.95 + W * 0.025, pB.y * H * 0.9 - H * 0.05);
          ctx.stroke();
        }
      }

      ctx.fillStyle = '#a78bfa';
      ctx.shadowBlur = 0;
      for (const pt of lerped) {
        ctx.beginPath();
        ctx.arc(pt.x * W * 0.95 + W * 0.025, pt.y * H * 0.9 - H * 0.05, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [showAvatar]);

  // ── Cleanup on unmount ─────────────────────────────────
  useEffect(() => {
    return () => {
      stopCamera();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [stopCamera]);

  // ── Browse mode selection ──────────────────────────────
  const handleBrowseSelect = (obj) => {
    setBrowseSelected(obj);
    setCurrentExplanation(obj);
    setShowAvatar(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const activeEntry = isFrozen ? frozenEntry : currentExplanation;
  const topDetection = detections.length > 0
    ? detections.reduce((a, b) => a.score > b.score ? a : b)
    : null;

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="loe-root">

      {/* ── Top Bar ── */}
      <header className="loe-topbar">
        <div className="loe-topbar__left">
          <button className="loe-back-btn" onClick={() => { stopCamera(); setPage('dashboard'); }}>
            ← Dashboard
          </button>
          <div className="loe-title-block">
            <span className="loe-title">📷 Live Object Explainer</span>
            <span className="loe-subtitle">AI-Powered Real-World Guide</span>
          </div>
        </div>

        <div className="loe-topbar__right">
          {/* Detection Status */}
          {mode === 'camera' && (
            <div className={`loe-status-pill ${
              camState === 'active' && topDetection ? 'detecting' :
              camState === 'loading' ? 'loading' :
              isFrozen ? 'locked' : 'idle'
            }`}>
              <div className="loe-status-dot" />
              {camState === 'loading' ? 'Loading AI Model...' :
               camState === 'active' && topDetection ? `Detecting: ${getObjectExplanation(topDetection.class).name}` :
               camState === 'active' ? 'Scanning...' :
               isFrozen ? 'Locked' : 'Camera Off'}
            </div>
          )}

          {/* Mode Toggle */}
          <div className="loe-mode-toggle">
            <button
              className={`loe-mode-btn ${mode === 'camera' ? 'active' : ''}`}
              onClick={() => { setMode('camera'); setBrowseSelected(null); }}
            >
              📷 Camera
            </button>
            <button
              className={`loe-mode-btn ${mode === 'browse' ? 'active' : ''}`}
              onClick={() => { setMode('browse'); stopCamera(); }}
            >
              📚 Browse
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Body ── */}
      <main className="loe-body">

        {/* ════════ LEFT — Camera Panel ════════ */}
        {mode === 'camera' && (
          <section className="loe-camera-panel">
            <div className="loe-camera-wrap">

              {/* Video */}
              <video
                ref={videoRef}
                className="loe-video"
                playsInline
                muted
                autoPlay
                style={{ display: camState === 'active' ? 'block' : 'none' }}
              />

              {/* Detection canvas overlay */}
              <canvas
                ref={canvasRef}
                className="loe-canvas"
                style={{ display: camState === 'active' ? 'block' : 'none' }}
              />

              {/* Scanning animation when active */}
              {camState === 'active' && !isFrozen && (
                <div className="loe-scan-overlay">
                  <div className="loe-scan-line" />
                  <div className="loe-corner tl" />
                  <div className="loe-corner tr" />
                  <div className="loe-corner bl" />
                  <div className="loe-corner br" />
                </div>
              )}

              {/* Loading overlay */}
              {camState === 'loading' && (
                <div className="loe-loading-overlay">
                  <div className="loe-loading-spinner" />
                  <p className="loe-loading-text">Loading AI Vision Model...</p>
                </div>
              )}

              {/* Placeholder / Start screen */}
              {(camState === 'idle' || camState === 'error') && (
                <div className="loe-cam-placeholder">
                  <div className="loe-cam-placeholder__icon">📷</div>
                  <p className="loe-cam-placeholder__text">
                    {camState === 'error' ? 'Camera Access Denied' : 'Camera Ready'}
                  </p>
                  <p className="loe-cam-placeholder__hint">
                    {camState === 'error'
                      ? 'Please allow camera access in your browser settings and try again.'
                      : 'Point your camera at any object — ATM, medicine, device, book — and AI will explain it!'
                    }
                  </p>
                  {camState !== 'error' && (
                    <button className="loe-start-btn" onClick={startCamera}>
                      🚀 Start Object Detection
                    </button>
                  )}
                  {camState === 'error' && (
                    <button className="loe-start-btn" onClick={startCamera}>
                      🔄 Try Again
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Detection bar */}
            {camState === 'active' && (
              <div className="loe-detection-bar">
                <div className="loe-detected-label">
                  {topDetection ? (
                    <>
                      <div className="dot" />
                      {getObjectExplanation(topDetection.class).emoji} {getObjectExplanation(topDetection.class).name}
                    </>
                  ) : (
                    <span style={{ color: '#475569' }}>No object detected — point camera at an object</span>
                  )}
                </div>

                {topDetection && (
                  <>
                    <div className="loe-confidence-bar">
                      <div className="loe-confidence-track">
                        <div
                          className="loe-confidence-fill"
                          style={{ width: `${Math.round(topDetection.score * 100)}%` }}
                        />
                      </div>
                      <span className="loe-confidence-text">{Math.round(topDetection.score * 100)}%</span>
                    </div>
                    <button
                      className={`loe-freeze-btn ${isFrozen ? 'active' : ''}`}
                      onClick={handleFreeze}
                    >
                      {isFrozen ? '🔓 Unfreeze' : '📌 Lock View'}
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {/* ════════ LEFT — Browse Mode Grid ════════ */}
        {mode === 'browse' && (
          <section className="loe-camera-panel">
            <div className="loe-browse-panel">
              {BROWSE_OBJECTS.map(obj => (
                <div
                  key={obj.key}
                  className={`loe-browse-card ${browseSelected?.key === obj.key ? 'selected' : ''}`}
                  onClick={() => handleBrowseSelect(obj)}
                >
                  <div className="loe-browse-card__emoji">{obj.emoji}</div>
                  <div className="loe-browse-card__name">{obj.name}</div>
                  <div className="loe-browse-card__cat">{obj.category}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ════════ RIGHT — Explanation Panel ════════ */}
        <section className="loe-info-panel">

          {activeEntry ? (
            <>
              {/* Object Identity Card */}
              <div className="loe-object-identity" style={{ borderColor: activeEntry.color + '33' }}>
                <div className="loe-object-emoji">{activeEntry.emoji}</div>
                <div className="loe-object-meta">
                  <h1 className="loe-object-name">{activeEntry.name}</h1>
                  <span className="loe-object-category">{activeEntry.category}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="loe-actions">
                <button
                  className={`loe-action-btn speak ${isSpeaking ? 'speaking' : ''}`}
                  onClick={handleSpeak}
                >
                  {isSpeaking ? '⏸ Stop' : '🔊 Speak Explanation'}
                </button>
                <button
                  className={`loe-action-btn sign ${showAvatar ? 'active' : ''}`}
                  onClick={() => setShowAvatar(v => !v)}
                >
                  🤟 Sign Language
                </button>
              </div>

              {/* Sign Language Avatar */}
              {showAvatar && (
                <div className="loe-avatar-panel">
                  <div className="loe-avatar-panel__header">
                    <span className="loe-avatar-panel__title">🤟 Sign Language Avatar</span>
                    {avatarActiveWord && (
                      <span className="loe-avatar-panel__word">Signing: {avatarActiveWord}</span>
                    )}
                  </div>
                  <div className="loe-avatar-body">
                    {/* Face SVG */}
                    <div className="loe-avatar-face-wrap">
                      <svg className="loe-avatar-face" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="#7c6af7" opacity="0.9" />
                        <circle cx="50" cy="50" r="39" fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                        {avatarFaceBlink ? (
                          <>
                            <line x1="33" y1="42" x2="43" y2="42" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
                            <line x1="57" y1="42" x2="67" y2="42" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
                          </>
                        ) : (
                          <>
                            <circle cx="38" cy="42" r="5" fill="#fff" />
                            <circle cx="62" cy="42" r="5" fill="#fff" />
                          </>
                        )}
                        {isAvatarTalking ? (
                          <ellipse cx="50" cy="65" rx="8" ry="5.5" fill="#fff" />
                        ) : (
                          <path d="M 40 62 Q 50 72 60 62" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
                        )}
                      </svg>
                    </div>

                    {/* Hand Skeleton Canvas */}
                    <div className="loe-avatar-canvas-wrap">
                      <canvas ref={avatarCanvasRef} width={280} height={90} className="loe-avatar-canvas" />
                      {avatarActiveLetter && (
                        <div className="loe-avatar-letter-badge">{avatarActiveLetter}</div>
                      )}
                      <div className="loe-avatar-label">
                        {isAvatarTalking ? 'Signing...' : 'Standby'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* What Is It */}
              <div className="loe-section">
                <div className="loe-section__header">
                  <span className="loe-section__icon">📖</span>
                  <span className="loe-section__title">What Is It?</span>
                </div>
                <div className="loe-section__body">{activeEntry.what}</div>
              </div>

              {/* How To Use */}
              <div className="loe-section">
                <div className="loe-section__header">
                  <span className="loe-section__icon">🛠️</span>
                  <span className="loe-section__title">How To Use It</span>
                </div>
                <div className="loe-section__body">
                  <ul className="loe-steps">
                    {activeEntry.howTo.split('\n').map((step, i) => {
                      const isSpecialLine = step.startsWith('🔴') || step.startsWith('🟡') || step.startsWith('🟢') || step.startsWith('Step');
                      return (
                        <li key={i} className="loe-step">
                          {!step.startsWith('🔴') && !step.startsWith('🟡') && !step.startsWith('🟢') ? (
                            <div className="loe-step-num">{i + 1}</div>
                          ) : (
                            <div style={{ minWidth: 24 }} />
                          )}
                          <span>{step}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>

              {/* Tips */}
              <div className="loe-section">
                <div className="loe-section__header">
                  <span className="loe-section__icon">💡</span>
                  <span className="loe-section__title">Pro Tip</span>
                </div>
                <div className="loe-section__body">
                  <div className="loe-tip-box">{activeEntry.tips}</div>
                </div>
              </div>
            </>
          ) : (
            /* Idle — no object yet */
            <div className="loe-idle-panel">
              <div className="loe-idle-panel__emoji">🔍</div>
              <p className="loe-idle-panel__title">
                {mode === 'camera' && camState !== 'active'
                  ? 'Start the camera to detect objects'
                  : mode === 'browse'
                  ? 'Select an object to learn about it'
                  : 'Point camera at an object'
                }
              </p>
              <p className="loe-idle-panel__hint">
                Supports: ATMs · Ticket Machines · Medicine · Mobile Phones · Laptops · TVs · Books · Clocks · and more!
              </p>
              {/* Quick browse chips */}
              <div className="loe-object-chips">
                {BROWSE_OBJECTS.slice(0, 8).map(obj => (
                  <button
                    key={obj.key}
                    className="loe-object-chip"
                    onClick={() => { setMode('browse'); handleBrowseSelect(obj); }}
                  >
                    {obj.emoji} {obj.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
