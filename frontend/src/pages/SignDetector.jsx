import { useRef, useEffect, useState, useCallback } from 'react'
import { useA11y } from '../context/AccessibilityContext'
import './SignDetector.css'

const BACKEND_URL = 'http://localhost:5001'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// MediaPipe hand connections for drawing landmarks
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],         // thumb
  [0,5],[5,6],[6,7],[7,8],         // index
  [0,9],[9,10],[10,11],[11,12],    // middle
  [0,13],[13,14],[14,15],[15,16],  // ring
  [0,17],[17,18],[18,19],[19,20],  // pinky
  [5,9],[9,13],[13,17],            // palm
]

function drawLandmarks(ctx, landmarks, W, H) {
  if (!landmarks || landmarks.length === 0) return
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(124,106,247,0.85)'
  ctx.fillStyle = '#38bdf8'

  // Draw connections
  for (const [a, b] of HAND_CONNECTIONS) {
    const lA = landmarks[a], lB = landmarks[b]
    if (!lA || !lB) continue
    ctx.beginPath()
    ctx.moveTo(lA.x * W, lA.y * H)
    ctx.lineTo(lB.x * W, lB.y * H)
    ctx.stroke()
  }

  // Draw dots
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 4, 0, 2 * Math.PI)
    ctx.fill()
  }
}

export default function SignDetector() {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const mpHandsRef = useRef(null)
  const animFrameRef = useRef(null)

  const { settings } = useA11y()

  const [status, setStatus]     = useState('idle')   // idle | loading | active | error
  const [prediction, setPrediction] = useState(null) // { label, confidence }
  const [sentence, setSentence] = useState('')
  const [backendOk, setBackendOk] = useState(null)
  const [handsDetected, setHandsDetected] = useState(false)
  const lastSpokenRef = useRef('')
  const lastPredRef   = useRef('')
  const speakTimerRef = useRef(null)

  // ── Check backend health ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then(r => r.json())
      .then(d => setBackendOk(d.model_loaded))
      .catch(() => setBackendOk(false))
  }, [])

  // ── TTS helper ───────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!settings.tts || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95; utt.pitch = 1.1
    window.speechSynthesis.speak(utt)
  }, [settings.tts])

  // ── Call Flask backend with landmarks ────────────────────────────────────────
  const callBackend = useCallback(async (landmarks) => {
    try {
      const flat = landmarks.flatMap(lm => [lm.x, lm.y, lm.z])
      const res = await fetch(`${BACKEND_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarks: flat }),
      })
      const data = await res.json()
      if (data.label) {
        setPrediction({ label: data.label, confidence: data.confidence })

        // TTS: speak if prediction changed and confidence is high
        if (data.label !== lastPredRef.current && data.confidence > 0.75) {
          lastPredRef.current = data.label
          clearTimeout(speakTimerRef.current)
          speakTimerRef.current = setTimeout(() => {
            if (data.label !== lastSpokenRef.current) {
              lastSpokenRef.current = data.label
              speak(data.label)
            }
          }, 600)
        }
      }
    } catch {
      // Backend offline — use demo mode
      const idx = Math.floor(Math.random() * 26)
      setPrediction({ label: ALPHABET[idx], confidence: Math.random() * 0.3 + 0.4 })
    }
  }, [speak])

  // ── Start camera + MediaPipe ─────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setStatus('loading')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Load MediaPipe Hands (loaded via CDN script tag)
      const waitForMP = (resolve, reject, t = 0) => {
        if (window.Hands) resolve()
        else if (t > 6000) reject(new Error('MediaPipe not loaded'))
        else setTimeout(() => waitForMP(resolve, reject, t + 100), 100)
      }
      await new Promise((res, rej) => waitForMP(res, rej))

      const hands = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      })
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
      })

      let frameCount = 0
      hands.onResults(results => {
        const canvas = canvasRef.current
        const video  = videoRef.current
        if (!canvas || !video) return

        const W = canvas.width  = video.videoWidth
        const H = canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, W, H)

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
          const lms = results.multiHandLandmarks[0]
          setHandsDetected(true)
          drawLandmarks(ctx, lms, W, H)

          // Call backend every 10 frames (~500ms at 20fps)
          frameCount++
          if (frameCount % 10 === 0) callBackend(lms)
        } else {
          setHandsDetected(false)
        }
      })

      mpHandsRef.current = hands

      // Process frames
      const processFrame = async () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await hands.send({ image: videoRef.current })
        }
        animFrameRef.current = requestAnimationFrame(processFrame)
      }
      animFrameRef.current = requestAnimationFrame(processFrame)

      setStatus('active')
    } catch (err) {
      console.error(err)
      setStatus('error')
    }
  }, [callBackend])

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const addToSentence = () => {
    if (prediction?.label) {
      setSentence(s => s + prediction.label)
    }
  }
  const addSpace = () => setSentence(s => s + ' ')
  const clearSentence = () => setSentence('')
  const readSentence = () => { if (sentence) speak(sentence) }

  const confidencePct = prediction ? Math.round(prediction.confidence * 100) : 0
  const confColor = confidencePct > 80 ? 'var(--clr-accent-3)'
                  : confidencePct > 55 ? 'var(--clr-accent-warn)'
                  : 'var(--clr-accent-rose)'

  return (
    <main id="main-content" className="detector">
      <div className="container">
        {/* Header */}
        <div className="detector__header fade-in-up">
          <div>
            <h1 className="detector__title">Sign Language Detector</h1>
            <p className="detector__subtitle">
              Show an ASL hand sign to your camera — the AI reads it and speaks it aloud.
            </p>
          </div>
          <div className="detector__status-badges">
            <span className={`badge ${backendOk === true ? 'badge-green' : backendOk === false ? 'badge-amber' : 'badge-sky'}`}>
              {backendOk === true ? '✅ AI Model Loaded' : backendOk === false ? '⚠️ Demo Mode (train model first)' : '⏳ Checking backend…'}
            </span>
            <span className={`badge ${status === 'active' ? 'badge-green' : 'badge-sky'}`}>
              {status === 'idle' ? '📷 Camera Off' : status === 'loading' ? '⏳ Starting…' : status === 'active' ? '🔴 Live' : '❌ Error'}
            </span>
          </div>
        </div>

        <div className="detector__layout">
          {/* Camera Panel */}
          <div className="detector__camera-panel glass-card fade-in-up delay-1">
            <div className="detector__video-wrap">
              {status === 'idle' && (
                <div className="detector__placeholder">
                  <div className="detector__placeholder-icon animate-float">🤝</div>
                  <p>Camera will appear here</p>
                  <p className="detector__placeholder-sub">Click "Start Camera" to begin</p>
                </div>
              )}
              {status === 'error' && (
                <div className="detector__placeholder">
                  <div style={{ fontSize: '3rem' }}>❌</div>
                  <p>Camera access denied</p>
                  <p className="detector__placeholder-sub">Please allow camera permissions and try again.</p>
                </div>
              )}
              {status === 'loading' && (
                <div className="detector__placeholder">
                  <div className="detector__spinner" />
                  <p>Loading AI model…</p>
                  <p className="detector__placeholder-sub">Initialising MediaPipe Hands</p>
                </div>
              )}
              <video
                ref={videoRef}
                id="detector-video"
                className={`detector__video ${status === 'active' ? 'visible' : ''}`}
                playsInline muted
                aria-label="Webcam feed"
              />
              <canvas
                ref={canvasRef}
                className="detector__canvas"
                aria-hidden="true"
              />
              {status === 'active' && handsDetected && (
                <div className="detector__hand-badge">👋 Hand detected</div>
              )}
            </div>

            {/* Controls */}
            <div className="detector__controls">
              {status === 'idle' || status === 'error' ? (
                <button className="btn btn-primary" id="start-camera-btn" onClick={startCamera}>
                  📷 Start Camera
                </button>
              ) : (
                <button className="btn btn-ghost" id="stop-camera-btn" onClick={() => {
                  cancelAnimationFrame(animFrameRef.current)
                  if (videoRef.current?.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop())
                    videoRef.current.srcObject = null
                  }
                  setStatus('idle'); setPrediction(null); setHandsDetected(false)
                }}>
                  ⏹ Stop Camera
                </button>
              )}
            </div>
          </div>

          {/* Prediction Panel */}
          <div className="detector__right fade-in-up delay-2">
            {/* Big prediction display */}
            <div className="detector__prediction glass-card">
              <p className="detector__pred-label">Detected Sign</p>
              <div className="detector__pred-letter" style={{ color: confColor }}>
                {prediction ? prediction.label : '?'}
              </div>

              {/* Confidence */}
              <div className="detector__confidence">
                <div className="detector__conf-header">
                  <span>Confidence</span>
                  <span style={{ color: confColor, fontWeight: 700 }}>{confidencePct}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${confidencePct}%`, background: confColor }} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="detector__pred-actions">
                <button className="btn btn-primary btn-sm" id="add-letter-btn" onClick={addToSentence} disabled={!prediction}>
                  + Add Letter
                </button>
                <button className="btn btn-ghost btn-sm" id="add-space-btn" onClick={addSpace}>
                  ␣ Space
                </button>
              </div>
            </div>

            {/* Sentence builder */}
            <div className="detector__sentence glass-card">
              <p className="detector__pred-label">Sentence Builder</p>
              <div className="detector__sentence-display" aria-live="polite" aria-label="Built sentence">
                {sentence || <span className="detector__sentence-placeholder">Start signing to build a sentence…</span>}
              </div>
              <div className="detector__sentence-actions">
                <button id="read-sentence-btn" className="btn btn-primary btn-sm" onClick={readSentence} disabled={!sentence}>
                  🔊 Read Aloud
                </button>
                <button id="clear-sentence-btn" className="btn btn-ghost btn-sm" onClick={clearSentence} disabled={!sentence}>
                  🗑 Clear
                </button>
              </div>
            </div>

            {/* Reference Chart */}
            <div className="detector__chart glass-card">
              <p className="detector__pred-label">ASL Alphabet Reference</p>
              <div className="detector__alphabet">
                {ALPHABET.map(l => (
                  <div
                    key={l}
                    className={`detector__alpha-cell ${prediction?.label === l ? 'active' : ''}`}
                    aria-label={`Letter ${l}`}
                  >
                    {l}
                  </div>
                ))}
              </div>
            </div>

            {/* How to use */}
            <div className="detector__tips glass-card">
              <p className="detector__pred-label">How to Use</p>
              <ol className="detector__tips-list">
                <li>Click <strong>Start Camera</strong> and allow access</li>
                <li>Hold your hand clearly in front of the camera</li>
                <li>Make an <strong>ASL hand sign</strong> (A–Z)</li>
                <li>AI detects the sign → letter appears + is spoken aloud</li>
                <li>Press <strong>+ Add Letter</strong> to build a sentence</li>
                <li>Press <strong>🔊 Read Aloud</strong> to hear your sentence</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* MediaPipe CDN script */}
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" crossOrigin="anonymous" />
      <script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" crossOrigin="anonymous" />
    </main>
  )
}
