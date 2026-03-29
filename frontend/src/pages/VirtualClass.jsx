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
  ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(124, 106, 247, 0.9)';
  for (const [a, b] of HAND_CONNECTIONS) {
    const lA = landmarks[a], lB = landmarks[b];
    if (lA && lB) { ctx.beginPath(); ctx.moveTo(lA.x * W, lA.y * H); ctx.lineTo(lB.x * W, lB.y * H); ctx.stroke(); }
  }
  ctx.fillStyle = '#38bdf8'; ctx.shadowBlur = 10; ctx.shadowColor = '#38bdf8';
  for (const lm of landmarks) { ctx.beginPath(); ctx.arc(lm.x * W, lm.y * H, 4, 0, 2 * Math.PI); ctx.fill(); }
  ctx.restore();
}

export default function VirtualClass({ onBack, setPage }) {
  const { currentUser, userRole: authRole } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const overrideRole = urlParams.get('role');
  const userRole = overrideRole || authRole;
  const isTeacher = userRole === 'teacher';

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const holdStartRef = useRef(null);
  const lastDetectedRef = useRef(null);
  const confirmedRef = useRef(null);
  const lastReceivedRef = useRef({ time: 0 });
  const speechRef = useRef(null);

  const [camStatus, setCamStatus] = useState('idle');
  const [detectedSign, setDetectedSign] = useState(null);
  const [currentSentence, setCurrentSentence] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [lastReceivedSign, setLastReceivedSign] = useState(null);
  const [receivedSentence, setReceivedSentence] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState("");

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text || isTeacher) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.1; 
    window.speechSynthesis.speak(utt);
  }, [isTeacher]);

  const processIncomingSign = useCallback((data) => {
    if (!data) return;
    const { phrase, emoji, sentence, voiceTranscript, time } = data;
    // IF THIS IS NEWER DATA THAN WE ALREADY HAVE
    if (time > lastReceivedRef.current.time) {
      const oldSentence = lastReceivedRef.current?.sentence || "";
      const isNewSentence = sentence !== oldSentence && sentence !== "" && sentence !== "---";
      
      lastReceivedRef.current = data;
      setSessionActive(true); 
      setLastReceivedSign(phrase === "---" ? null : phrase); 
      setReceivedSentence(sentence); 
      setVoiceText(voiceTranscript);

      if (phrase !== "---") {
        const entry = { phrase, emoji: emoji || '🤟', time: new Date().toLocaleTimeString() };
        setBroadcastHistory(prev => [entry, ...prev].slice(0, 8));
        // ONLY SPEAK ON STUDENT SIDE
        if (!isTeacher) {
           if (isNewSentence && sentence.length > oldSentence.length) speak(sentence); 
           else speak(phrase);
        }
      }
    }
  }, [isTeacher, speak]);

  useEffect(() => {
    // If Teacher, ensure session is active in Firebase
    if (isTeacher && currentUser) startClassSession(currentUser.uid);

    const unsub = subscribeToClassSession((data) => {
      setSessionActive(!!data.active);
      if (data.active && data.lastSign) processIncomingSign(data.lastSign);
    });

    // POLLING LOCAL STORAGE AS FALLBACK (For open tabs on same machine)
    const localInterval = setInterval(() => {
      const localDataRaw = localStorage.getItem("liveSign");
      if (localDataRaw) {
        try {
          const localData = JSON.parse(localDataRaw);
          processIncomingSign(localData);
        } catch(e) {}
      }
    }, 400);

    return () => { unsub(); clearInterval(localInterval); if(isTeacher) endClassSession(); };
  }, [processIncomingSign, isTeacher, currentUser]);

  const broadcastRealTimeUpdate = useCallback((sentence, signPhrase, emoji, voiceTranscript) => {
     const data = { phrase: signPhrase || "---", emoji: emoji || "🤟", sentence: sentence || "", voiceTranscript: voiceTranscript || "", time: Date.now() };
     if (isTeacher) { 
        broadcastSign(data);
        localStorage.setItem("liveSign", JSON.stringify(data)); 
     }
  }, [isTeacher]);

  const analyzeHand = useCallback((landmarks) => {
    if (!landmarks || landmarks.length < 21) { holdStartRef.current = null; setDetectedSign(null); setHoldProgress(0); return; }
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
    const match = GESTURE_DICTIONARY.find(g => g.code === code);
    const currentDetect = match ? match.phrase : null;
    
    setDetectedSign(currentDetect);
    if (currentDetect) {
      if (lastDetectedRef.current === currentDetect) {
        if (!holdStartRef.current) holdStartRef.current = Date.now();
        const elapsed = Date.now() - holdStartRef.current;
        setHoldProgress(Math.min(100, (elapsed / POSE_HOLD_MS) * 100));
        if (elapsed >= POSE_HOLD_MS && confirmedRef.current !== currentDetect) {
          confirmedRef.current = currentDetect;
          const updatedSentence = currentSentence ? (currentSentence.endsWith(' ') ? currentSentence + currentDetect : currentSentence + " " + currentDetect) : currentDetect;
          setCurrentSentence(updatedSentence); setHoldProgress(0);
          if (isTeacher) broadcastRealTimeUpdate(updatedSentence, currentDetect, match.emoji, voiceText);
        }
      } else { lastDetectedRef.current = currentDetect; holdStartRef.current = Date.now(); confirmedRef.current = null; setHoldProgress(0); }
    } else { lastDetectedRef.current = null; holdStartRef.current = null; confirmedRef.current = null; setHoldProgress(0); }
  }, [isTeacher, currentSentence, voiceText, broadcastRealTimeUpdate]);

  const startCamera = useCallback(async () => {
    if (camStatus === 'active') return;
    setCamStatus('loading');
    try {
      if (window.localStream) window.localStream.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: isTeacher ? 1280 : 640, height: isTeacher ? 720 : 480 } });
      window.localStream = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => videoRef.current.play(); }

      const hands = new window.Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(r => {
        if (!canvasRef.current || !videoRef.current) return;
        const video = videoRef.current; const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
        const W = video.videoWidth; const H = video.videoHeight;
        if (canvas.width !== W) { canvas.width = W; canvas.height = H; }
        ctx.clearRect(0, 0, W, H);
        if (r.multiHandLandmarks?.[0]) { drawLandmarksOnly(ctx, r.multiHandLandmarks[0], W, H); analyzeHand(r.multiHandLandmarks[0]); }
      });
      let lastAI = 0;
      const loop = async (time) => {
        if (!videoRef.current) return;
        if (videoRef.current.readyState >= 2 && time - lastAI > 100) { await hands.send({ image: videoRef.current }); lastAI = time; }
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
      setCamStatus('active');
    } catch (err) { console.error(err); setCamStatus('error'); }
  }, [camStatus, analyzeHand, isTeacher]);

  const toggleVoice = useCallback(() => {
    if (isListening) { if (speechRef.current) speechRef.current.stop(); setIsListening(false); }
    else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
      const recognition = new SpeechRecognition();
      recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = (e) => {
         const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
         setVoiceText(transcript);
         if (isTeacher) broadcastRealTimeUpdate(currentSentence, lastReceivedSign, "🎙️", transcript);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.start(); speechRef.current = recognition; setIsListening(true);
    }
  }, [isListening, isTeacher, currentSentence, lastReceivedSign, broadcastRealTimeUpdate]);

  const handleClear = () => {
    setCurrentSentence(""); setVoiceText("");
    if (isTeacher) broadcastRealTimeUpdate("", "---", "🤟", "");
  };

  return (
    <div className="vc-root">
      <div className="vc-topbar">
        <div className="vc-topbar-left">
          <button onClick={onBack} className="vc-back-btn">← Back</button>
          <div className="vc-title-wrap">
            <div className={`vc-live-dot ${sessionActive ? 'active' : ''}`} />
            <span className="vc-title">{isTeacher ? "Teacher Portal" : "Student Portal"}</span>
          </div>
        </div>
        <div className="vc-topbar-right">
           {isTeacher && <button className={`vc-voice-btn ${isListening ? 'active' : ''}`} onClick={toggleVoice}>{isListening ? '🛑 Stop' : '🎙️ Voice'}</button>}
           <a href={`/virtual-class?role=${isTeacher ? 'student' : 'teacher'}`} className="vc-role-switch">Switch View ↗</a>
        </div>
      </div>

      <div className="vc-layout">
        <div className="vc-jitsi-panel">
          <iframe title="Jitsi" src={`https://meet.jit.si/${ROOM_NAME}#config.prejoinPageEnabled=false`} allow="camera; microphone; fullscreen" className="vc-jitsi-iframe" />
          
          {isTeacher && sessionActive && (currentSentence || voiceText) && (
            <div className="vc-video-captions">
              <div className="vc-caption-tag">STUDIO FEEDBACK</div>
              <div className="vc-caption-text">
                {voiceText && <div className="vc-voice-text">🎙️ {voiceText}</div>}
                {currentSentence && <div className="vc-sign-sentence">{currentSentence}</div>}
              </div>
            </div>
          )}
        </div>

        <div className="vc-comm-panel">
          <div className="vc-panel-section">
            <div className="vc-section-title">👨‍🏫 Teacher's Board (Live)</div>
            <div className="vc-student-sign-box">
              {!sessionActive ? <p>Awaiting teacher...</p> : (
                <div className="vc-sign-display">
                  <span className="vc-sign-phrase">{lastReceivedSign || "---"}</span>
                  {(receivedSentence || currentSentence) && <p className="vc-voice-small">{isTeacher ? currentSentence : receivedSentence}</p>}
                </div>
              )}
            </div>
            {isTeacher && <button className="vc-clear-btn" onClick={handleClear}>Reset Board</button>}
          </div>

          <div className="vc-panel-section">
            <div className="vc-section-title">{isTeacher ? "AI Studio Area" : "Practice Support"}</div>
            {isTeacher ? (
              <div className="vc-camera-box">
                <video ref={videoRef} playsInline muted autoPlay className="vc-video-element" />
                <canvas ref={canvasRef} className="vc-skeleton-canvas" />
                {camStatus !== 'active' && (
                  <div className="vc-camera-placeholder">
                    <p className="vc-placeholder-text">Camera Hidden</p>
                    <button className="vc-retry-btn" onClick={startCamera}>Start Studio AI</button>
                  </div>
                )}
                {detectedSign && (
                  <div className="vc-overlay-sign">
                    <span className="vc-overlay-text">{detectedSign}</span>
                    <div className="vc-hold-bar"><div className="vc-hold-fill" style={{ width: `${holdProgress}%` }} /></div>
                  </div>
                )}
              </div>
            ) : (
              <div className="vc-practice-hint">
                <div className="vc-sign-display">
                   {voiceText && <p className="vc-voice-text">🎙️ {voiceText}</p>}
                </div>
                <p>Observe the teacher on Jitsi. The translations will sync on the board above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}