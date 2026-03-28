import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useA11y } from '../context/AccessibilityContext';
import { GESTURE_DICTIONARY } from '../data/gestures';
import { ISL_SIGNS } from '../data/islSigns';
import {
  broadcastSign,
  subscribeToClassSession,
  startClassSession,
  endClassSession,
} from '../services/virtualClassService';
import './VirtualClass.css';

const POSE_HOLD_MS = 1200;
const ROOM_NAME = 'VardaanInclusiveClassroom_101';

// ISL Specific Detection Mapping
const ISL_MAPPING = {
  'TUCKED-0000': { phrase: "Letter A", emoji: "✊" },
  'UP-1111':     { phrase: "Letter B", emoji: "🤚" },
  'OUT-0000':    { phrase: "Letter C", emoji: "🫲" },
  'TUCKED-1000': { phrase: "Letter D", emoji: "☝️" },
  'OUT-1111':    { phrase: "Letter E", emoji: "🖐️" },
  'SPECIAL-OK':  { phrase: "Letter F", emoji: "👌" },
  'UP-1100':     { phrase: "Letter V/H", emoji: "✌️" },
  'TUCKED-0001': { phrase: "Letter I", emoji: "☝️" },
  'OUT-1000':    { phrase: "Letter L", emoji: "🫲" },
};

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Separate Video Background Drawer
function drawVideoBackground(ctx, video, W, H) {
  if (!ctx || !video || video.readyState < 2) return;
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-W, 0);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.restore();
}

function drawLandmarksOnly(ctx, landmarks, W, H) {
  if (!ctx || !landmarks || landmarks.length === 0) return;

  // Calculate bounding box for hand box effect
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const lm of landmarks) {
    minX = Math.min(minX, lm.x); minY = Math.min(minY, lm.y);
    maxX = Math.max(maxX, lm.x); maxY = Math.max(maxY, lm.y);
  }

  const padX = (maxX - minX) * 0.2;
  const padY = (maxY - minY) * 0.2;
  minX = Math.max(0, minX - padX); minY = Math.max(0, minY - padY);
  maxX = Math.min(1, maxX + padX); maxY = Math.min(1, maxY + padY);

  ctx.save();
  ctx.rect(minX * W, minY * H, (maxX - minX) * W, (maxY - minY) * H);
  ctx.clip();

  // Draw Bones
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(124,106,247,0.95)';
  for (const [a, b] of HAND_CONNECTIONS) {
    const lA = landmarks[a], lB = landmarks[b];
    if (!lA || !lB) continue;
    ctx.beginPath();
    ctx.moveTo(lA.x * W, lA.y * H);
    ctx.lineTo(lB.x * W, lB.y * H);
    ctx.stroke();
  }

  // Draw Joints
  ctx.fillStyle = '#38bdf8';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, 5.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.arc(lm.x * W, lm.y * H, 7.5, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

export default function VirtualClass({ onBack, setPage }) {
  const { currentUser, userRole } = useAuth();
  const isTeacher = userRole === 'teacher';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mpHandsRef = useRef(null);
  const animFrameRef = useRef(null);
  const holdStartRef = useRef(null);
  const lastDetectedRef = useRef(null);
  const confirmedRef = useRef(null);
  const joinedAtRef = useRef(Date.now());
  const lastReceivedRef = useRef(null);

  const [camStatus, setCamStatus] = useState('idle'); // idle | loading | active | error
  const [detectedSign, setDetectedSign] = useState(null);
  const [confirmedSign, setConfirmedSign] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [lastReceivedSign, setLastReceivedSign] = useState(null);
  const [lastSignEmoji, setLastSignEmoji] = useState('🤟');
  const [holdProgress, setHoldProgress] = useState(0);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.92;
      utt.pitch = 1.05;
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utt);
    }, 60);
  }, []);

  // ── FIREBASE RECEIVE UPDATE ──────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToClassSession((data) => {
      setSessionActive(!!data.active);

      const signTime = data.lastSignAt?.toMillis?.() ?? 0;
      const isNew = signTime > joinedAtRef.current;

      if (data.lastSign && isNew) {
        const signData = typeof data.lastSign === "object" 
          ? data.lastSign 
          : { 
              phrase: data.lastSign, 
              emoji: data.lastSignEmoji || "🤟", 
              confidence: data.lastSignConfidence || 90 
            };

        if (signData.phrase !== lastReceivedRef.current) {
          const entry = {
            phrase: signData.phrase,
            emoji: signData.emoji || '🤟',
            confidence: signData.confidence || 0,
            time: new Date().toLocaleTimeString(),
          };

          setBroadcastHistory(prev => [entry, ...prev].slice(0, 8));

          lastReceivedRef.current = signData.phrase;
          setLastReceivedSign(signData.phrase);
          setLastSignEmoji(signData.emoji || '🤟');

          if (!isTeacher) {
            speak(`Teacher is signing ${signData.phrase}`);
          }
        }
      }
    });

    return () => unsub();
  }, [isTeacher, speak]);

  // ── Gesture analysis ────────────────────────────────────────────────────────
  const analyzeHand = useCallback((landmarks) => {
    if (!landmarks || landmarks.length < 21) {
      holdStartRef.current = null;
      lastDetectedRef.current = null;
      confirmedRef.current = null;
      setDetectedSign(null);
      setHoldProgress(0);
      return;
    }

    const palmSize = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
    const indexExt = landmarks[8].y < landmarks[6].y;
    const middleExt = landmarks[12].y < landmarks[10].y;
    const ringExt   = landmarks[16].y < landmarks[14].y;
    const pinkyExt  = landmarks[20].y < landmarks[18].y;

    const thumbUp   = landmarks[4].y < landmarks[3].y && landmarks[4].y < landmarks[5].y - palmSize * 0.3;
    const thumbDown = landmarks[4].y > landmarks[3].y && landmarks[4].y > landmarks[5].y + palmSize * 0.3;
    const thumbOut  = Math.abs(landmarks[4].x - landmarks[9].x) > palmSize * 0.8;

    let thState = 'TUCKED';
    if (thumbUp)   thState = 'UP';
    else if (thumbDown) thState = 'DOWN';
    else if (thumbOut)  thState = 'OUT';

    const code = `${thState}-${indexExt?'1':'0'}${middleExt?'1':'0'}${ringExt?'1':'0'}${pinkyExt?'1':'0'}`;
    
    let match = ISL_MAPPING[code];
    const thumbIndexDist = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
    if (thumbIndexDist < palmSize * 0.6 && middleExt && ringExt && pinkyExt && !indexExt) {
      match = ISL_MAPPING['SPECIAL-OK'];
    }

    if (!match) match = GESTURE_DICTIONARY.find(g => g.code === code);

    const currentDetect = match ? match.phrase : null;
    const currentEmoji  = match ? match.emoji  : '🖐️';
    setDetectedSign(currentDetect);

    // ── BROADCAST UPDATE ────────────────────────────────────────────────────────
    if (currentDetect) {
      if (lastDetectedRef.current === currentDetect) {
        if (!holdStartRef.current) holdStartRef.current = Date.now();
        const elapsed = Date.now() - holdStartRef.current;
        setHoldProgress(Math.min(100, (elapsed / POSE_HOLD_MS) * 100));

        if (elapsed >= POSE_HOLD_MS && confirmedRef.current !== currentDetect) {
          confirmedRef.current = currentDetect;
          setConfirmedSign(currentDetect);
          setHoldProgress(0);

          const confidence = Math.min(100, Math.round((elapsed / POSE_HOLD_MS) * 100));

          if (isTeacher) {
            broadcastSign({
              phrase: currentDetect,
              emoji: currentEmoji,
              confidence,
            });

            const entry = {
              phrase: currentDetect,
              emoji: currentEmoji,
              confidence,
              time: new Date().toLocaleTimeString(),
            };
            setBroadcastHistory(prev => [entry, ...prev].slice(0, 8));
          } else {
            speak(`You signed: ${currentDetect}`);
          }
        }
      } else {
        lastDetectedRef.current = currentDetect;
        holdStartRef.current = Date.now();
        confirmedRef.current = null;
        setHoldProgress(0);
      }
    } else {
      lastDetectedRef.current = null;
      holdStartRef.current = null;
      confirmedRef.current = null;
      setHoldProgress(0);
    }
  }, [isTeacher, speak]);

  // ── Camera ──────────────────────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (camStatus === 'active') return;
    setCamStatus('loading');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480, facingMode: "user" } 
      });

      console.log("[VC] Stream acquired:", stream.id);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => console.error("[VC] Auto-play failed:", e));
        };
      }

      await new Promise((res, rej) => {
        const timeout = setTimeout(() => rej(new Error("MediaPipe load timeout")), 8000);
        const wait = () => {
          if (window.Hands) {
            clearTimeout(timeout);
            res();
          } else {
            setTimeout(wait, 200);
          }
        };
        wait();
      });

      const hands = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
      });

      hands.setOptions({ 
        maxNumHands: 1, 
        modelComplexity: 1, 
        minDetectionConfidence: 0.6, 
        minTrackingConfidence: 0.5 
      });

      const latestResults = { current: null };
      let frameCount = 0;
      hands.onResults(results => {
        latestResults.current = results;
        if (results.multiHandLandmarks?.length > 0) {
          frameCount++;
          if (frameCount % 6 === 0) analyzeHand(results.multiHandLandmarks[0]);
        } else {
          analyzeHand(null);
        }
      });

      mpHandsRef.current = hands;

      // ULTIMATE RENDER LOOP
      const renderLoop = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const W = video.videoWidth || 640;
        const H = video.videoHeight || 480;
        if (canvas.width !== W) { canvas.width = W; canvas.height = H; }

        ctx.clearRect(0, 0, W, H);
        drawVideoBackground(ctx, video, W, H);
        if (latestResults.current?.multiHandLandmarks?.length > 0) {
          drawLandmarksOnly(ctx, latestResults.current.multiHandLandmarks[0], W, H);
        }

        if (video.readyState >= 2 && frameCount % 2 === 0) {
           try { await hands.send({ image: video }); } catch(e){}
        }
        frameCount++;
        animFrameRef.current = requestAnimationFrame(renderLoop);
      };
      
      animFrameRef.current = requestAnimationFrame(renderLoop);
      setCamStatus('active');
      if (isTeacher) startClassSession(currentUser?.uid || 'teacher');
    } catch (err) {
      console.error("[VC] Camera failure:", err);
      setCamStatus('error');
    }
  }, [analyzeHand, isTeacher, currentUser, camStatus]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    if (mpHandsRef.current) {
      mpHandsRef.current.close();
      mpHandsRef.current = null;
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setCamStatus('idle');
    setDetectedSign(null);
    setHoldProgress(0);
    if (isTeacher) endClassSession();
  }, [isTeacher]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleBack = () => {
    stopCamera();
    if (onBack) onBack();
    else if (setPage) setPage(isTeacher ? 'teacherDashboard' : 'dashboard');
  };

  return (
    <div className="vc-root">
      <div className="vc-topbar">
        <div className="vc-topbar-left">
          <button className="vc-back-btn" onClick={handleBack}>
            <span>←</span> Back
          </button>
          <div className="vc-title-wrap">
            <div className="vc-live-dot" />
            <h1 className="vc-title">
              {isTeacher ? '🎓 Teaching Session' : '👩‍🎓 Joining Class'}
            </h1>
            <span className={`vc-session-badge ${sessionActive ? 'active' : 'inactive'}`}>
              {sessionActive ? 'LIVE' : 'WAITING'}
            </span>
          </div>
        </div>
        <div className="vc-room-label">Room: {ROOM_NAME}</div>
      </div>

      <div className="vc-layout">
        <div className="vc-jitsi-panel">
          <iframe
            title="Jitsi Meeting"
            src={`https://meet.jit.si/${ROOM_NAME}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false`}
            allow="camera; microphone; fullscreen; display-capture"
            className="vc-iframe"
          />
        </div>

        <div className="vc-comm-panel">
          {isTeacher ? (
            <>
              <div className="vc-section-header">
                <span className="vc-section-icon">🤟</span>
                <div>
                  <h2 className="vc-section-title">Sign Broadcaster</h2>
                  <p className="vc-section-sub">Hold a sign for 1.2s to broadcast</p>
                </div>
              </div>

              <div className="vc-camera-box">
                {camStatus === 'active' ? (
                  <div className="vc-video-wrap">
                    <video ref={videoRef} playsInline muted autoPlay className="vc-video" />
                    <canvas ref={canvasRef} className="vc-canvas" />
                    {detectedSign && (
                      <div className="vc-overlay-sign">
                        <span className="vc-overlay-text">{detectedSign}</span>
                        <div className="vc-hold-bar">
                          <div className="vc-hold-fill" style={{ width: `${holdProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="vc-camera-placeholder">
                    {camStatus === 'loading' && <div className="vc-spinner" />}
                    <p>{camStatus === 'loading' ? 'Loading…' : 'Camera off'}</p>
                  </div>
                )}
              </div>

              <button
                className={`vc-cam-btn ${camStatus === 'active' ? 'stop' : 'start'}`}
                onClick={camStatus === 'active' ? stopCamera : startCamera}
                disabled={camStatus === 'loading'}
              >
                {camStatus === 'active' ? '⏹ Stop Broadcasting' : '🎬 Start Broadcasting'}
              </button>

              {confirmedSign && (
                <div className="vc-confirmed-box">
                  <p className="vc-confirmed-label">Last Broadcast</p>
                  <div className="vc-confirmed-text">✅ {confirmedSign}</div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="vc-section-header">
                <span className="vc-section-icon">👂</span>
                <div>
                  <h2 className="vc-section-title">Teacher's Signs</h2>
                  <p className="vc-section-sub">Watch signs here</p>
                </div>
              </div>

              <div className={`vc-student-sign-box ${lastReceivedSign ? 'has-sign' : ''}`}>
                {!sessionActive ? (
                  <div className="vc-waiting">
                    <div className="vc-waiting-pulse">⏳</div>
                    <p>Waiting for teacher…</p>
                  </div>
                ) : lastReceivedSign ? (
                  <div className="vc-sign-display">
                    <div className="vc-sign-emoji">{lastSignEmoji}</div>
                    <div className="vc-sign-phrase">👨‍🏫 Teacher: {lastReceivedSign}</div>
                    <div className="vc-confidence">Confidence: {broadcastHistory[0]?.confidence || 0}%</div>
                  </div>
                ) : (
                  <div className="vc-waiting">
                    <div className="vc-waiting-pulse">🎙️</div>
                    <p>Awaiting teacher…</p>
                  </div>
                )}
              </div>

              <div className="vc-section-header" style={{ marginTop: '1rem' }}>
                <span className="vc-section-icon">📷</span>
                <div>
                  <h2 className="vc-section-title">Practice Area</h2>
                  <p className="vc-section-sub">Respond with your own signs</p>
                </div>
              </div>
              
              <div className="vc-camera-box">
                {camStatus === 'active' ? (
                  <div className="vc-video-wrap">
                    <video ref={videoRef} playsInline muted autoPlay className="vc-video" />
                    <canvas ref={canvasRef} className="vc-canvas" />
                    {detectedSign && (
                      <div className="vc-overlay-sign">
                        <span className="vc-overlay-text">{detectedSign}</span>
                        <div className="vc-hold-bar">
                          <div className="vc-hold-fill" style={{ width: `${holdProgress}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="vc-camera-placeholder">
                    {camStatus === 'loading' && <div className="vc-spinner" />}
                    <p>Camera is off</p>
                  </div>
                )}
              </div>

              <button
                className={`vc-cam-btn ${camStatus === 'active' ? 'stop' : 'start'}`}
                onClick={camStatus === 'active' ? stopCamera : startCamera}
                disabled={camStatus === 'loading'}
                style={{ marginTop: '0.5rem' }}
              >
                {camStatus === 'active' ? '⏹ Stop My Camera' : '🎬 Start My Analyzer'}
              </button>
            </>
          )}

          {broadcastHistory.length > 0 && (
            <div className="vc-history">
              <p className="vc-history-label">📜 Recent Signs</p>
              <div className="vc-history-list">
                {broadcastHistory.map((h, i) => (
                  <div key={i} className="vc-history-item" style={{ opacity: 1 - i * 0.1 }}>
                    <span className="vc-hist-emoji">{h.emoji}</span>
                    <span className="vc-hist-phrase">{h.phrase} ({h.confidence || 0}%)</span>
                    <span className="vc-hist-time">{h.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}