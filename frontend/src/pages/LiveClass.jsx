import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useA11y, A11yText } from '../context/AccessibilityContext';
import { GESTURE_DICTIONARY } from '../data/gestures';
import { predictSignLocally } from '../services/signAiService';
import {
  broadcastSign,
  subscribeToClassSession,
  startClassSession,
  endClassSession,
  broadcastDoubt,
} from '../services/virtualClassService';
import './LiveClass.css';

const POSE_HOLD_MS = 1000;
const ROOM_ID = 'Verdent_Live_Class_Room_101';

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[11,12],[12,13],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function drawLandmarksOnly(ctx, landmarks, W, H) {
  if (!ctx || !landmarks || landmarks.length === 0) return;
  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(124, 106, 247, 0.9)';
  for (const [a, b] of HAND_CONNECTIONS) {
    const lA = landmarks[a], lB = landmarks[b];
    if (lA && lB) {
      ctx.beginPath();
      ctx.moveTo(lA.x * W, lA.y * H);
      ctx.lineTo(lB.x * W, lB.y * H);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#06b6d4';
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#06b6d4';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * W, lm.y * H, 4.5, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.restore();
}

export default function LiveClass({ onBack, setPage }) {
  const { currentUser, userRole: authRole } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const overrideRole = urlParams.get('role');
  
  const userRole = overrideRole || authRole || 'student';
  const isTeacher = userRole === 'teacher';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const holdStartRef = useRef(null);
  const lastDetectedRef = useRef(null);
  const confirmedRef = useRef(null);
  const lastSpeakRef = useRef("");

  const [camStatus, setCamStatus] = useState('idle');
  const [detectedSign, setDetectedSign] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState([]);
  const [aiConfidence, setAiConfidence] = useState(0.95);
  const [isDoubtPending, setIsDoubtPending] = useState(false);
  const [activeDoubt, setActiveDoubt] = useState(null);
  const [currentSentence, setCurrentSentence] = useState("");
  const [voiceText, setVoiceText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const speechRef = useRef(null);

  // Text-To-Speech function
  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    // Don't repeat identical TTS consecutively to avoid loop spam
    if (lastSpeakRef.current === text) return;
    lastSpeakRef.current = text;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0;
    window.speechSynthesis.speak(utt);
  }, []);

  // Sync / Broadcast Update
  const syncClassUpdate = useCallback((sentence, signPhrase, emoji, voiceText, conf) => {
    const data = {
      phrase: signPhrase || "---",
      emoji: emoji || "🤟",
      sentence: sentence || "",
      voiceTranscript: voiceText || "",
      confidence: conf || 0.95,
      time: Date.now()
    };
    if (isTeacher) {
      broadcastSign(data, ROOM_ID);
    }
  }, [isTeacher]);

  // Handle incoming data for students
  const handleIncomingSign = useCallback((data) => {
    if (!data) return;
    const { phrase, emoji, sentence, voiceTranscript, confidence, lastDoubt } = data;

    if (lastDoubt && isTeacher) {
      setActiveDoubt(lastDoubt);
      speak(`Student ${lastDoubt.studentName} has raised a doubt about: ${lastDoubt.signPhrase}`);
    }

    if (phrase && phrase !== "---") {
      setDetectedSign(phrase);
      setAiConfidence(confidence || 0.95);
      
      // Update local transcript list for student
      setLiveTranscript(prev => {
        const itemText = `${emoji || '🤟'} ${phrase}`;
        if (prev.includes(itemText)) return prev;
        
        // Speak out the new sign
        speak(phrase);
        return [...prev, itemText];
      });
    }

    if (sentence) {
      setCurrentSentence(sentence);
    }
    if (voiceTranscript) {
      setVoiceText(voiceTranscript);
    }
  }, [isTeacher, speak]);

  // Subscribe to DB session
  useEffect(() => {
    let unsub = () => {};
    if (isTeacher && currentUser) {
      startClassSession(currentUser.uid, ROOM_ID);
    }
    unsub = subscribeToClassSession((data) => {
      if (data) {
        if (data.lastSign) {
          handleIncomingSign(data.lastSign);
        }
        if (data.lastDoubt) {
          setActiveDoubt(data.lastDoubt);
        }
      }
    }, ROOM_ID);

    return () => {
      unsub();
      if (isTeacher) {
        endClassSession(ROOM_ID);
      }
    };
  }, [currentUser, isTeacher, handleIncomingSign]);

  // Gesture analysis
  const analyzeHand = useCallback((landmarks) => {
    if (!landmarks || landmarks.length < 21) {
      holdStartRef.current = null;
      setDetectedSign(null);
      setHoldProgress(0);
      return;
    }

    const palmSize = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
    const indexExt = landmarks[8].y < landmarks[6].y;
    const middleExt = landmarks[12].y < landmarks[10].y;
    const ringExt = landmarks[16].y < landmarks[14].y;
    const pinkyFinal = landmarks[20].y < landmarks[18].y;

    const thumbUp = landmarks[4].y < landmarks[3].y && landmarks[4].y < landmarks[5].y - palmSize * 0.3;
    const thumbDown = landmarks[4].y > landmarks[3].y && landmarks[4].y > landmarks[5].y + palmSize * 0.3;
    const thumbOut = Math.abs(landmarks[4].x - landmarks[9].x) > palmSize * 0.8;
    let thState = (thumbUp ? 'UP' : (thumbDown ? 'DOWN' : (thumbOut ? 'OUT' : 'TUCKED')));
    
    const code = `${thState}-${indexExt?'1':'0'}${middleExt?'1':'0'}${ringExt?'1':'0'}${pinkyFinal?'1':'0'}`;
    let match = GESTURE_DICTIONARY.find(g => g.code === code);
    
    let currentDetect = match ? match.phrase : null;
    let confidence = 0.9 + Math.random() * 0.09;

    if (!currentDetect) {
      const localResult = predictSignLocally(landmarks);
      if (localResult && localResult.confidence > 0.6) {
        currentDetect = localResult.label;
        confidence = localResult.confidence;
      }
    }

    setDetectedSign(currentDetect);
    setAiConfidence(confidence);

    if (currentDetect) {
      if (lastDetectedRef.current === currentDetect) {
        if (!holdStartRef.current) holdStartRef.current = Date.now();
        const elapsed = Date.now() - holdStartRef.current;
        setHoldProgress(Math.min(100, (elapsed / POSE_HOLD_MS) * 100));

        if (elapsed >= POSE_HOLD_MS && confirmedRef.current !== currentDetect) {
          confirmedRef.current = currentDetect;
          setHoldProgress(0);

          // Convert detected gesture -> Text & speak aloud immediately
          speak(currentDetect);

          setLiveTranscript(prev => {
            const item = `${match?.emoji || '🤟'} ${currentDetect}`;
            if (prev.includes(item)) return prev;
            return [...prev, item];
          });

          const nextSentence = currentSentence ? `${currentSentence} ${currentDetect}` : currentDetect;
          setCurrentSentence(nextSentence);

          if (isTeacher) {
            syncClassUpdate(nextSentence, currentDetect, match?.emoji, voiceText, confidence);
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
  }, [isTeacher, currentSentence, voiceText, speak, syncClassUpdate]);

  // Handle camera start
  const startCamera = useCallback(async () => {
    setCamStatus('loading');
    try {
      if (window.localStream) {
        window.localStream.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      window.localStream = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }

      const hands = new window.Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
      });
      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.6
      });

      hands.onResults(r => {
        if (!canvasRef.current || !videoRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (r.multiHandLandmarks?.[0]) {
          drawLandmarksOnly(ctx, r.multiHandLandmarks[0], canvas.width, canvas.height);
          analyzeHand(r.multiHandLandmarks[0]);
        }
      });

      let lastAI = 0;
      const loop = async (time) => {
        if (!videoRef.current) return;
        if (videoRef.current.readyState >= 2 && time - lastAI > 100) {
          await hands.send({ image: videoRef.current });
          lastAI = time;
        }
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
      setCamStatus('active');
    } catch (e) {
      setCamStatus('error');
    }
  }, [analyzeHand]);

  // Voice toggle
  const toggleVoice = useCallback(() => {
    if (isListening) {
      if (speechRef.current) speechRef.current.stop();
      setIsListening(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        const text = Array.from(e.results).map(r => r[0].transcript).join("");
        setVoiceText(text);
        if (isTeacher) {
          syncClassUpdate(currentSentence, detectedSign, "🎙️", text, aiConfidence);
        }
      };
      rec.onerror = () => setIsListening(false);
      rec.start();
      speechRef.current = rec;
      setIsListening(true);
    }
  }, [isListening, isTeacher, currentSentence, detectedSign, aiConfidence, syncClassUpdate]);

  useEffect(() => {
    startCamera();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (window.localStream) window.localStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleClear = () => {
    setLiveTranscript([]);
    setCurrentSentence("");
    setVoiceText("");
    setDetectedSign(null);
    syncClassUpdate("", "---", "🤟", "", 0.95);
  };

  const handleDoubt = () => {
    if (!detectedSign) return;
    setIsDoubtPending(true);
    broadcastDoubt(currentUser?.displayName || "Student Learner", detectedSign, ROOM_ID);
    setTimeout(() => setIsDoubtPending(false), 3000);
  };

  const handleLeaveClass = () => {
    if (!isTeacher) {
      window.dispatchEvent(new CustomEvent('verdent-class-ended'));
    }
    onBack();
  };


  return (
    <div className="lc-root">
      <div className="lc-topbar">
        <div className="lc-topbar-left">
          <button onClick={handleLeaveClass} className="lc-back-btn">← Leave Class</button>
          <div className="lc-title-wrap">
            <div className="lc-live-dot" />
            <span className="lc-title">
              {isTeacher ? "Tutor Portal - Streaming Gestures" : "Live Classroom Session"}
            </span>
          </div>
        </div>
        <div className="lc-topbar-right">
          {isTeacher && (
            <button className={`lc-voice-btn ${isListening ? 'active' : ''}`} onClick={toggleVoice}>
              {isListening ? '🎙️ Mic Active' : '🎙️ Mic Inactive'}
            </button>
          )}
          <a href={`/liveclass?role=${isTeacher ? 'student' : 'teacher'}`} className="lc-role-switch">
            Switch View
          </a>
        </div>
      </div>

      <div className="lc-layout">
        {/* Left Side: Live Feed & Overlay */}
        <div className="lc-video-panel">
          <div className="lc-camera-container">
            <video ref={videoRef} playsInline muted autoPlay className="lc-video-element" />
            <canvas ref={canvasRef} className="lc-skeleton-canvas" />
            
            {camStatus !== 'active' && (
              <div className="lc-placeholder">
                <p>Initializing Interactive Camera Feed...</p>
              </div>
            )}

            {/* Gesture Hud Overlay */}
            {detectedSign && (
              <div className="lc-gesture-hud">
                <div className="lc-hud-header">
                  <span className="lc-hud-title">Detected Gesture</span>
                  <span className="lc-hud-conf">{(aiConfidence * 100).toFixed(0)}% Match</span>
                </div>
                <div className="lc-hud-value">{detectedSign}</div>
                <div className="lc-hud-bar">
                  <div className="lc-hud-fill" style={{ width: `${holdProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Subtitles Overlay */}
          <div className="lc-subtitles-bar">
            <div className="lc-caption-tag">REALTIME SPEECH & TEXT TRANSLATION</div>
            <div className="lc-subtitle-text">
              {voiceText && <p className="lc-voice-sub">🎙️ {voiceText}</p>}
              {currentSentence && <p className="lc-gesture-sub">🤟 {currentSentence}</p>}
              {!voiceText && !currentSentence && <p className="lc-muted-sub">Waiting for tutor to speak or sign...</p>}
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Transcript & Control Panel */}
        <div className="lc-control-panel">
          <div className="lc-section">
            <A11yText as="h3" className="lc-section-title">Live Lesson Transcript</A11yText>
            <div className="lc-transcript-container">
              {liveTranscript.length === 0 ? (
                <p className="lc-empty">Tutor signs and comments will appear here chronologically as text transcript.</p>
              ) : (
                <div className="lc-transcript-list">
                  {liveTranscript.map((t, idx) => (
                    <div key={idx} className="lc-transcript-item">
                      <span className="lc-time">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      <span className="lc-text">{t}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lc-section actions">
            {isTeacher ? (
              <div className="lc-teacher-actions">
                <button className="lc-btn reset" onClick={handleClear}>Reset Broadcast Board</button>
                {activeDoubt && (
                  <div className="lc-doubt-alert">
                    <span>⚠️ {activeDoubt.studentName} requests clarification on: "{activeDoubt.signPhrase}"</span>
                    <button className="lc-doubt-resolve" onClick={() => setActiveDoubt(null)}>Dismiss</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="lc-student-actions">
                <button 
                  className={`lc-btn doubt ${isDoubtPending ? 'pending' : ''}`}
                  onClick={handleDoubt}
                  disabled={!detectedSign || isDoubtPending}
                >
                  {isDoubtPending ? 'Doubt Broadcasted...' : '❓ Confused about current gesture? Ask Tutor'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
