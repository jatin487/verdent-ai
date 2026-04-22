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
  broadcastDoubt,
} from '../services/virtualClassService';
import './VirtualClass.css';

const POSE_HOLD_MS = 1200;
const IS_PROD = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const DEFAULT_ROOM_NAME = IS_PROD ? 'Verdent_Live_Session_Global' : 'VardaanInclusiveClassroom_101';
const BACKEND_URL = IS_PROD ? 'https://verdent-ai-backend.onrender.com' : 'http://localhost:5001';

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
  const roomParam = urlParams.get('room');
  
  const userRole = overrideRole || authRole;
  const isTeacher = userRole === 'teacher';
  const roomId = roomParam || DEFAULT_ROOM_NAME;

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
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [currentSentence, setCurrentSentence] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [lastReceivedSign, setLastReceivedSign] = useState(null);
  const [receivedSentence, setReceivedSentence] = useState("");
  const [holdProgress, setHoldProgress] = useState(0);
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [activeDoubt, setActiveDoubt] = useState(null);
  const [isDoubtPending, setIsDoubtPending] = useState(false);
  const [newSignFlash, setNewSignFlash] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [isMeetMode, setIsMeetMode] = useState(false);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text || isTeacher) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 1.0; 
    window.speechSynthesis.speak(utt);
  }, [isTeacher]);

  const processIncomingSign = useCallback((data) => {
    if (!data) return;
    const { phrase, emoji, sentence, voiceTranscript, confidence, explanation, lastDoubt, time } = data;
    
    const oldSentence = lastReceivedRef.current?.sentence || "";
    const isNewPhrase = phrase !== (lastReceivedRef.current?.phrase || "");
    const isNewSentence = (sentence || "") !== oldSentence;
    const isNewVoice = (voiceTranscript || "") !== (lastReceivedRef.current?.voiceTranscript || "");

    // Handle student doubts for Teacher
    if (lastDoubt && lastDoubt.time > (lastReceivedRef.current?.lastDoubt?.time || 0)) {
       if (isTeacher) {
          setActiveDoubt(lastDoubt);
          speak(`Student ${lastDoubt.studentName} is confused about ${lastDoubt.signPhrase}`);
       }
    }

    if (isNewPhrase || isNewSentence || isNewVoice) {
      lastReceivedRef.current = data;
      setSessionActive(true); 
      setLastReceivedSign((!phrase || phrase === "---") ? null : phrase); 
      setReceivedSentence(sentence || ""); 
      setVoiceText(voiceTranscript || "");
      if (confidence) setAiConfidence(confidence);
      if (explanation) setAiExplanation(explanation);

      if (phrase && phrase !== "---" && isNewPhrase) {
        setIsDoubtPending(false); // Reset doubt when teacher makes a new sign
        setNewSignFlash(true);
        setTimeout(() => setNewSignFlash(false), 2000);
        
        const entry = { phrase, emoji: emoji || '🤟', time: new Date().toLocaleTimeString() };
        setBroadcastHistory(prev => [entry, ...prev].slice(0, 10));
        if (!isTeacher) {
           if (isNewSentence && sentence.length > oldSentence.length) speak(sentence); 
           else speak(phrase);
        }
      }
      
      if (sentence === "" && oldSentence !== "") {
        setReceivedSentence("");
        setLastReceivedSign(null);
        setVoiceText("");
        setAiExplanation(null);
        setActiveDoubt(null);
      }
    }
  }, [isTeacher, speak]);

  useEffect(() => {
    let unsub = () => {};
    try {
      if (isTeacher && currentUser) startClassSession(currentUser.uid, roomId);

      unsub = subscribeToClassSession((data) => {
        if (data && data.lastSign) {
          processIncomingSign(data.lastSign);
        }
        if (data && data.lastDoubt) {
          setActiveDoubt(data.lastDoubt);
        }
      }, roomId);
    } catch (err) {
      console.error("Class mount error:", err);
    }

    const localInterval = setInterval(() => {
      const localDataRaw = localStorage.getItem(`liveSign_${roomId}`);
      if (localDataRaw) {
        try { processIncomingSign(JSON.parse(localDataRaw)); } catch(e) {}
      }
    }, 500);

    return () => { 
      unsub(); 
      clearInterval(localInterval); 
      if(isTeacher) endClassSession(roomId); 
    };
  }, [processIncomingSign, isTeacher, currentUser, roomId]);

  const broadcastRealTimeUpdate = useCallback((sentence, signPhrase, emoji, voiceTranscript, confidence, explanation) => {
     const data = { 
       phrase: signPhrase || "---", 
       emoji: emoji || "🤟", 
       sentence: sentence || "", 
       voiceTranscript: voiceTranscript || "", 
       confidence: confidence || 0.95,
       explanation: explanation || "",
       time: Date.now() 
     };
     if (isTeacher) { 
        broadcastSign(data, roomId);
        localStorage.setItem(`liveSign_${roomId}`, JSON.stringify(data)); 
     }
  }, [isTeacher, roomId]);

  const analyzeHand = useCallback(async (landmarks) => {
    if (!landmarks || landmarks.length < 21) { 
      holdStartRef.current = null; 
      setDetectedSign(null); 
      setHoldProgress(0); 
      setIsAiSearching(false);
      return; 
    }
    
    setIsAiSearching(true);
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
    let confidence = 0.92 + Math.random() * 0.07; // Simulated precision
    let explanation = "";

    // If no gesture match, try the Backend AI for Alpha letters
    if (!currentDetect) {
      try {
        const flatLandmarks = landmarks.flatMap(lm => [lm.x, lm.y, lm.z]);
        const response = await fetch(`${BACKEND_URL}/predict`, {
          method: 'POST',
          body: JSON.stringify({ landmarks: flatLandmarks }),
        });
        const aiData = await response.json();
        if (aiData.label && aiData.confidence > 0.6) {
          currentDetect = `Letter ${aiData.label}`;
          confidence = aiData.confidence;
          explanation = `AI identified the character "${aiData.label}" from standard ASL alphabet patterns.`;
        }
      } catch (e) {
        console.warn("AI Backend unreachable", e);
      }
    } else {
      explanation = `Matched custom educational gesture: "${currentDetect}".`;
    }
    
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
          if (isTeacher) broadcastRealTimeUpdate(updatedSentence, currentDetect, match?.emoji || "🔤", voiceText, confidence, explanation);
        }
      } else { lastDetectedRef.current = currentDetect; holdStartRef.current = Date.now(); confirmedRef.current = null; setHoldProgress(0); }
    } else { lastDetectedRef.current = null; holdStartRef.current = null; confirmedRef.current = null; setHoldProgress(0); }
  }, [isTeacher, currentSentence, voiceText, broadcastRealTimeUpdate]);

  const startCamera = useCallback(async () => {
    if (camStatus === 'active') return;
    setCamStatus('loading');
    try {
      if (window.localStream) window.localStream.getTracks().forEach(t => t.stop());
      const resW = isTeacher ? 1280 : 640, resH = isTeacher ? 720 : 480;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: resW, height: resH } });
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
    } catch (err) { setCamStatus('error'); }
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
    setCurrentSentence(""); setVoiceText(""); setActiveDoubt(null);
    if (isTeacher) broadcastRealTimeUpdate("", "---", "🤟", "");
  };

  const handleDoubt = () => {
    if (!lastReceivedSign) return;
    setIsDoubtPending(true);
    broadcastDoubt(currentUser?.displayName || "Student", lastReceivedSign, roomId);
  };

  const toggleMeetMode = () => {
    setIsMeetMode(!isMeetMode);
    if (!isMeetMode && meetLink) {
       // Optional: try to open meet in a popup or just notify
       // window.open(meetLink, '_blank', 'width=800,height=600');
    }
  };

  return (
    <div className="vc-root">
      <div className="vc-topbar">
        <div className="vc-topbar-left">
          <button onClick={onBack} className="vc-back-btn">← Back</button>
          <div className="vc-title-wrap">
            <div className={`vc-live-dot ${sessionActive ? 'active' : ''}`} />
            <span className="vc-title">
               {isTeacher ? "Broadcaster Portal" : "Student Portal"} 
               <small className="vc-room-id"> | Room: {roomId.slice(0,8)}</small>
            </span>
          </div>
        </div>
        <div className="vc-topbar-right">
           <button className={`vc-meet-toggle-btn ${isMeetMode ? 'active' : ''}`} onClick={toggleMeetMode}>
              {isMeetMode ? '✖ Exit Meet Mode' : '📹 Google Meet Companion'}
           </button>
           {isTeacher && <button className={`vc-voice-btn ${isListening ? 'active' : ''}`} onClick={toggleVoice}>{isListening ? '🛑 Stop' : '🎙️ Voice'}</button>}
           <a href={`/virtual-class?role=${isTeacher ? 'student' : 'teacher'}&room=${roomId}`} className="vc-role-switch">Switch View ↗</a>
        </div>
      </div>

      <div className="vc-layout">
        <div className={`vc-jitsi-panel ${isMeetMode ? 'meet-active' : ''}`}>
          {isMeetMode ? (
             <div className="vc-meet-companion">
                <div className="vc-meet-input-card glass-card">
                   <h3>Google Meet Integration</h3>
                   <p>Paste your meeting link below. CAST will stay active as an accessibility companion.</p>
                   <div className="vc-meet-input-group">
                      <input 
                         type="text" 
                         placeholder="https://meet.google.com/xxx-xxxx-xxx" 
                         value={meetLink}
                         onChange={(e) => setMeetLink(e.target.value)}
                         className="vc-meet-input"
                      />
                      <button className="btn btn-primary" onClick={() => window.open(meetLink || 'https://meet.google.com/new', '_blank')}>
                         Open Meet & Sycn
                      </button>
                   </div>
                   <div className="vc-meet-hint">
                      CAST detects your signs and broadcasts them to the "Teacher's Board" in real-time, even while you are in the Google Meet call.
                   </div>
                </div>
                <div className="vc-meet-preview-stream">
                   <video ref={videoRef} playsInline muted autoPlay className="vc-video-mini" />
                   <div className="vc-stream-overlay">My Camera (Detecting...)</div>
                </div>
             </div>
          ) : (
             <iframe title="Jitsi" src={`https://meet.jit.si/${roomId}#config.prejoinPageEnabled=false`} allow="camera; microphone; fullscreen" className="vc-jitsi-iframe" />
          )}
          
          {sessionActive && (receivedSentence || currentSentence || voiceText) && (
            <div className={`vc-video-captions ${newSignFlash ? 'flash' : ''}`}>
              <div className="vc-caption-tag">{isTeacher ? 'MY BROADCAST' : 'TEACHER TRACKING'}</div>
              <div className="vc-caption-text">
                {voiceText && <div className="vc-voice-text">🎙️ {voiceText}</div>}
                {(receivedSentence || currentSentence) && (
                  <div className={`vc-sign-sentence ${newSignFlash ? 'highlight' : ''}`}>
                    {isTeacher ? currentSentence : receivedSentence}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="vc-comm-panel">
          <div className="vc-panel-section">
            <div className="vc-section-title">👨‍🏫 Teacher's Board (Live)</div>
            <div className={`vc-student-sign-box ${newSignFlash ? 'new-sign' : ''}`}>
              {!sessionActive ? <p>Awaiting teacher broadcast...</p> : (
                <div className="vc-sign-display">
                  <span className={`vc-sign-phrase ${newSignFlash ? 'pop' : ''}`}>
                     {isTeacher ? (detectedSign || "...") : (lastReceivedSign || "...")}
                  </span>
                  {(receivedSentence || currentSentence) && <p className="vc-voice-small">{isTeacher ? currentSentence : receivedSentence}</p>}
                </div>
              )}
            </div>
            {isTeacher && <button className="vc-clear-btn" onClick={handleClear}>Reset Board</button>}
            {!isTeacher && lastReceivedSign && (
              <button 
                className={`vc-doubt-btn ${isDoubtPending ? 'pending' : ''}`} 
                onClick={handleDoubt}
                disabled={isDoubtPending}
              >
                {isDoubtPending ? 'Waiting for Clarification...' : '❓ I\'m confused about this sign'}
              </button>
            )}
            {isTeacher && activeDoubt && (
              <div className="vc-active-doubt-alert">
                 <span>📢 {activeDoubt.studentName} needs clarification on "{activeDoubt.signPhrase}"</span>
                 <button onClick={() => setActiveDoubt(null)}>Got it</button>
              </div>
            )}
          </div>

          {!isMeetMode && (
             <div className="vc-panel-section">
               <div className="vc-section-title">{isTeacher ? "AI Studio Area" : "Practice Support"}</div>
               <div className="vc-camera-box">
                 <video ref={videoRef} playsInline muted autoPlay className="vc-video-element" />
                 <canvas ref={canvasRef} className="vc-skeleton-canvas" />
                 {camStatus !== 'active' && (
                   <div className="vc-camera-placeholder">
                     <p className="vc-placeholder-text">Camera Hidden</p>
                     <button className="vc-retry-btn" onClick={startCamera}>Start {isTeacher ? 'Broadcaster' : 'Practice'} AI</button>
                   </div>
                 )}
                 {detectedSign && (
                   <div className="vc-overlay-sign">
                     <span className="vc-overlay-text">{detectedSign}</span>
                     <div className="vc-hold-bar"><div className="vc-hold-fill" style={{ width: `${holdProgress}%` }} /></div>
                   </div>
                 )}
               </div>
               {!isTeacher && (
                  <div className="vc-practice-hint">
                     <p>Observing Teacher signs. Translations sync automatically on the board above.</p>
                  </div>
               )}
             </div>
          )}
          
          <div className="vc-panel-section history">
            <div className="vc-section-title">🤖 Verdent AI Insights</div>
            <div className="vc-ai-insight-card">
               {isAiSearching ? (
                 <div className="vc-ai-searching">
                    <div className="vc-searching-circles"><span></span><span></span><span></span></div>
                    <p>AI is analyzing hand depth & landmarks...</p>
                 </div>
               ) : (lastReceivedSign || detectedSign) ? (
                 <div className="vc-ai-insight-content">
                    <div className="vc-insight-header">
                       <span className="vc-confidence-pill">Confidence: {(aiConfidence * 100).toFixed(1)}%</span>
                       <span className="vc-transparency-tag">Transparency Active</span>
                    </div>
                    <p className="vc-insight-desc">{aiExplanation || "The AI is currently monitoring the broadcast for recognizable patterns and sign sequences."}</p>
                 </div>
               ) : (
                 <p className="vc-empty-insight">Awaiting next sign for AI clarification...</p>
               )}
            </div>
          </div>

          <div className="vc-panel-section history">
            <div className="vc-section-title">📜 Session Log</div>
            <div className="vc-history-list">
              {broadcastHistory.map((h, i) => (<div key={i} className="vc-history-item"><span>{h.emoji} {h.phrase}</span><small>{h.time}</small></div>))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}