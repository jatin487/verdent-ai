import { useRef, useEffect, useState, useCallback } from 'react'
import { useA11y } from '../context/AccessibilityContext'
import { ASL_SIGNS } from '../data/aslSigns'
import './SignDetector.css'

const BACKEND_URL = 'http://localhost:5001'
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const NUMBERS_1_10 = [
  { num: 1, hint: 'Index finger up', emoji: '☝️' },
  { num: 2, hint: 'Peace sign — index + middle', emoji: '✌️' },
  { num: 3, hint: 'Three fingers up', emoji: '🤟' },
  { num: 4, hint: 'Four fingers up, thumb tucked', emoji: '🖖' },
  { num: 5, hint: 'All 5 fingers spread', emoji: '🖐️' },
  { num: 6, hint: 'Thumb touches pinky, others up', emoji: '🤙' },
  { num: 7, hint: 'Thumb touches ring finger', emoji: '7️⃣' },
  { num: 8, hint: 'Thumb touches middle finger', emoji: '8️⃣' },
  { num: 9, hint: 'Thumb touches index finger', emoji: '9️⃣' },
  { num: 10, hint: 'Thumbs up or shake fist', emoji: '👍' },
]

// Step-by-step: A–Z letters + 1–10 numbers
const LETTER_STEPS = ALPHABET.map((letter, i) => ({
  id: i + 1,
  type: 'letter',
  value: letter,
  label: `Sign the letter ${letter}`,
  hint: ASL_SIGNS[letter]?.desc || `ASL sign for ${letter}`,
  emoji: ASL_SIGNS[letter]?.emoji || letter,
}))
const NUMBER_STEPS = NUMBERS_1_10.map((n, i) => ({
  id: 27 + i,
  type: 'number',
  value: n.num,
  label: `Sign the number ${n.num}`,
  hint: n.hint,
  emoji: n.emoji,
}))
const STEPS = [...LETTER_STEPS, ...NUMBER_STEPS]
const POSE_HOLD_MS = 800

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
function detectNumberPose(landmarks) {
  if (!landmarks || landmarks.length < 21) return null
  const lm = landmarks
  const palmCenter = {
    x: (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5,
    y: (lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5,
  }
  const d4 = dist(lm[4], palmCenter), d8 = dist(lm[8], palmCenter)
  const d12 = dist(lm[12], palmCenter), d16 = dist(lm[16], palmCenter), d20 = dist(lm[20], palmCenter)
  const tips = [d4, d8, d12, d16, d20]
  const extended = tips.map(d => d > 0.1)
  const count = extended.filter(Boolean).length
  if (d8 > 0.11 && !extended[2] && !extended[3] && !extended[4]) return 1
  if (d8 > 0.11 && d12 > 0.11 && !extended[3] && !extended[4]) return 2
  if (d8 > 0.11 && d12 > 0.11 && d16 > 0.11 && !extended[4]) return 3
  if (d8 > 0.11 && d12 > 0.11 && d16 > 0.11 && d20 > 0.11 && d4 < 0.12) return 4
  if (count >= 4 && d4 > 0.1) return 5
  return null
}

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
  
  // Calculate bounding box for hand only
  let minX = 1, minY = 1, maxX = 0, maxY = 0
  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x)
    minY = Math.min(minY, lm.y)
    maxX = Math.max(maxX, lm.x)
    maxY = Math.max(maxY, lm.y)
  }
  
  // Add padding around hand (20% margin)
  const padX = (maxX - minX) * 0.2
  const padY = (maxY - minY) * 0.2
  minX = Math.max(0, minX - padX)
  minY = Math.max(0, minY - padY)
  maxX = Math.min(1, maxX + padX)
  maxY = Math.min(1, maxY + padY)
  
  // Calculate crop dimensions
  const cropX = minX * W
  const cropY = minY * H
  const cropW = (maxX - minX) * W
  const cropH = (maxY - minY) * H
  
  // Clear and crop canvas to hand area only
  ctx.clearRect(0, 0, W, H)
  ctx.save()
  ctx.rect(cropX, cropY, cropW, cropH)
  ctx.clip()
  
  // Draw connections
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(124,106,247,0.95)'
  for (const [a, b] of HAND_CONNECTIONS) {
    const lA = landmarks[a], lB = landmarks[b]
    if (!lA || !lB) continue
    ctx.beginPath()
    ctx.moveTo(lA.x * W, lA.y * H)
    ctx.lineTo(lB.x * W, lB.y * H)
    ctx.stroke()
  }
  
  // Draw larger, brighter dots
  ctx.fillStyle = '#38bdf8'
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 5.5, 0, 2 * Math.PI)
    ctx.fill()
  }
  
  // Draw outer ring for each dot
  ctx.strokeStyle = 'rgba(56,189,248,0.4)'
  ctx.lineWidth = 2
  for (const lm of landmarks) {
    ctx.beginPath()
    ctx.arc(lm.x * W, lm.y * H, 8, 0, 2 * Math.PI)
    ctx.stroke()
  }
  
  ctx.restore()
}

export default function SignDetector() {
  const videoRef  = useRef(null)
  const canvasRef = useRef(null)
  const mpHandsRef = useRef(null)
  const animFrameRef = useRef(null)

  const { settings } = useA11y()

  const [status, setStatus]     = useState('idle')   // idle | loading | active | error
  const [handsDetected, setHandsDetected] = useState(false)
  // Step-by-step mode: validate hand poses (open → fist → etc.)
  const [currentStep, setCurrentStep] = useState(0)
  const [detectedLetter, setDetectedLetter] = useState(null)
  const [stepComplete, setStepComplete] = useState(false)
  const holdStartRef = useRef(null)
  const currentStepRef = useRef(0)
  currentStepRef.current = currentStep
  // "I Speak" and "Show me the sign"
  const [spokenText, setSpokenText] = useState('')
  const [showSignLetter, setShowSignLetter] = useState('')

  // ── TTS helper ───────────────────────────────────────────────────────────────
  const speak = useCallback((text) => {
    if (!settings.tts || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = 0.95; utt.pitch = 1.1
    window.speechSynthesis.speak(utt)
  }, [settings.tts])

  // ── Step validation: letters via backend, numbers via client-side pose ─
  const validateStep = useCallback(async (landmarks) => {
    const stepIdx = currentStepRef.current
    const step = STEPS[stepIdx]
    if (!step) return

    let matches = false
    let display = null

    if (step.type === 'letter') {
      try {
        const flat = landmarks.flatMap(lm => [lm.x, lm.y, lm.z])
        const res = await fetch(`${BACKEND_URL}/predict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ landmarks: flat }),
        })
        const data = await res.json()
        display = data?.label ? data.label.toUpperCase() : null
        setDetectedLetter(display)
        matches = display === step.value
      } catch {
        setDetectedLetter(null)
        holdStartRef.current = null
        return
      }
    } else {
      // Number step: client-side pose detection (1-5) or hand-held for 6-10
      const num = detectNumberPose(landmarks)
      const handHeld = step.value >= 6 && step.value <= 10 && landmarks?.length >= 21
      matches = num === step.value || handHeld
      display = num != null ? String(num) : (handHeld ? String(step.value) : null)
      setDetectedLetter(display)
    }

    if (!matches) {
      holdStartRef.current = null
      setStepComplete(false)
      return
    }

    const now = Date.now()
    if (!holdStartRef.current) holdStartRef.current = now
    if (now - holdStartRef.current >= POSE_HOLD_MS) {
      setStepComplete(true)
      speak(`${step.value}! Step ${step.id} complete.`)
      holdStartRef.current = null
      if (stepIdx < STEPS.length - 1) {
        setTimeout(() => {
          setCurrentStep(c => c + 1)
          setStepComplete(false)
        }, 600)
      }
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

          // Step validation every 5 frames (~250ms)
          frameCount++
          if (frameCount % 5 === 0) validateStep(lms)
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
  }, [validateStep])

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current)
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const resetSteps = () => {
    setCurrentStep(0)
    setStepComplete(false)
    setDetectedLetter(null)
    holdStartRef.current = null
  }

  return (
    <main id="main-content" className="detector">
      <div className="container">
        {/* Header */}
        <div className="detector__header fade-in-up">
          <div>
            <h1 className="detector__title">🖐️ ASL Sign Detector (Age 10+)</h1>
            <p className="detector__subtitle">
              Step-by-step A–Z + 1–10: sign each letter and number, hold for ~1 second.
            </p>
          </div>
          <div className="detector__status-badges">
            <span className={`badge ${status === 'active' ? 'badge-green' : 'badge-sky'}`}>
              {status === 'idle' ? '📷 Camera Off' : status === 'loading' ? '⏳ Loading…' : status === 'active' ? '🔴 LIVE' : '❌ Error'}
            </span>
          </div>
        </div>

        <div className="detector__layout">
          {/* Camera Panel */}
          <div className="detector__camera-panel glass-card fade-in-up delay-1">
            <div className="detector__video-wrap">
              {status === 'idle' && (
                <div className="detector__placeholder">
                  <div className="detector__placeholder-icon animate-float">👋</div>
                  <p>Ready to learn? Click below to start!</p>
                  <p className="detector__placeholder-sub">Make sure the camera can see your hands</p>
                </div>
              )}
              {status === 'error' && (
                <div className="detector__placeholder">
                  <div style={{ fontSize: '3rem' }}>❌</div>
                  <p>Oops! Camera didn't work</p>
                  <p className="detector__placeholder-sub">Please let Verdent use your camera and try again.</p>
                </div>
              )}
              {status === 'loading' && (
                <div className="detector__placeholder">
                  <div className="detector__spinner" />
                  <p>Getting ready…</p>
                  <p className="detector__placeholder-sub">Starting up the AI hand recognizer</p>
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
                  🎬 Turn On Camera
                </button>
              ) : (
                <button className="btn btn-ghost" id="stop-camera-btn" onClick={() => {
                  cancelAnimationFrame(animFrameRef.current)
                  if (videoRef.current?.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop())
                    videoRef.current.srcObject = null
                  }
                  setStatus('idle'); setHandsDetected(false); resetSteps()
                }}>
                  ⏹ Stop Camera
                </button>
              )}
            </div>
          </div>

          {/* Prediction Panel */}
          <div className="detector__right fade-in-up delay-2">
            {/* Step-by-step: A–Z alphabet */}
            <div className="detector__steps-card glass-card">
              <p className="detector__pred-label">🔄 A–Z Step-by-step</p>
              <p className="detector__steps-desc">Sign each letter (A–Z) and number (1–10). Hold for ~1 second. Step {currentStep + 1} of {STEPS.length}.</p>
              <div className="detector__step-letters">
                {STEPS.map((s, i) => (
                  <span
                    key={`${s.type}-${s.value}`}
                    className={`detector__step-letter ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}`}
                  >
                    {i < currentStep ? '✓' : s.value}
                  </span>
                ))}
              </div>
              <div className="detector__step-current glass-card">
                <p className="detector__pred-label">Sign: {STEPS[currentStep]?.type === 'letter' ? 'Letter' : 'Number'} {STEPS[currentStep]?.value}</p>
                <div className="detector__step-big-letter">
                  {STEPS[currentStep]?.value}
                </div>
                <p className="detector__step-hint">{STEPS[currentStep]?.hint}</p>
                <p className={`detector__step-status ${detectedLetter === String(STEPS[currentStep]?.value) ? 'match' : ''}`}>
                  {detectedLetter ? `Detected: ${detectedLetter}` : 'Show your hand…'}
                </p>
                {stepComplete && currentStep === STEPS.length - 1 && (
                  <p className="detector__step-done">🎉 All {STEPS.length} steps complete!</p>
                )}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={resetSteps}>
                ↩ Restart from A
              </button>
            </div>

            {/* Show me the sign — Type a letter, see the hand gesture */}
            <div className="detector__show-sign glass-card">
              <p className="detector__pred-label">🖐️ Show me the sign</p>
              <p className="detector__show-sign-desc">Type a letter or click below to see the ASL hand gesture</p>
              <input
                type="text"
                maxLength={1}
                className="detector__show-sign-input"
                placeholder="Type letter (A–Z)"
                value={showSignLetter || ''}
                onChange={(e) => {
                  const v = e.target.value.toUpperCase().slice(-1)
                  setShowSignLetter(/[A-Z]/.test(v) ? v : '')
                }}
                aria-label="Type a letter to see its ASL sign"
              />
              {showSignLetter && ASL_SIGNS[showSignLetter] && (
                <div className="detector__sign-visual">
                  <div className="detector__sign-emoji">{ASL_SIGNS[showSignLetter].emoji}</div>
                  <div className="detector__sign-demo">{ASL_SIGNS[showSignLetter].demo}</div>
                  <p className="detector__sign-desc">{ASL_SIGNS[showSignLetter].desc}</p>
                </div>
              )}
              <div className="detector__show-sign-grid">
                {ALPHABET.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`detector__show-sign-cell ${showSignLetter === l ? 'active' : ''}`}
                    onClick={() => setShowSignLetter(l)}
                    aria-label={`Show ASL sign for ${l}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* I Speak — Show what you say */}
            <div className="detector__speak-card glass-card">
              <p className="detector__pred-label">🗣️ I Speak — Show what you say</p>
              <p className="detector__speak-desc">Type words so the other person can see them on screen</p>
              <div className="detector__spoken-display" aria-live="polite">
                {spokenText || <span className="detector__sentence-placeholder">Type below…</span>}
              </div>
              <div className="detector__speak-controls">
                <input
                  type="text"
                  className="detector__speak-input"
                  placeholder="Type words here…"
                  value={spokenText}
                  onChange={(e) => setSpokenText(e.target.value.toUpperCase())}
                  aria-label="Type words to show"
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setSpokenText('')} disabled={!spokenText}>
                  Clear
                </button>
              </div>
              {spokenText && (
                <div className="detector__spelled-letters">
                  {spokenText.split('').map((char, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`detector__spelled-char ${/[A-Z]/.test(char) ? 'letter' : ''}`}
                      onClick={() => setShowSignLetter(char)}
                      title={`Show sign for ${char}`}
                    >
                      {char === ' ' ? '␣' : char}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* How to use */}
            <div className="detector__tips glass-card">
              <p className="detector__pred-label">🎯 How It Works</p>
              <ol className="detector__tips-list">
                <li>Click <strong>🎬 Turn On Camera</strong> and allow camera access</li>
                <li>Sign <strong>A–Z</strong> then <strong>1–10</strong> in order</li>
                <li>Hold each sign steady for ~1 second to advance</li>
                <li>Use "Show me the sign" below to see how each letter looks</li>
                <li>Backend on port 5001 for letters; numbers use camera detection</li>
              </ol>
            </div>

            {/* Fun Challenge */}
            <div className="detector__tips glass-card" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(59,130,246,0.1))' }}>
              <p className="detector__pred-label">💡 Tip</p>
              <ul className="detector__tips-list">
                <li>Hold the pose steady for about 1 second — no random letters!</li>
                <li>Use "Show me the sign" below to see how each letter looks</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

    </main>
  )
}
