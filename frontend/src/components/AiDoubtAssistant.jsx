import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSimplifiedExplanation, getLandmarksForLetter, getLandmarksForCode } from '../services/doubtAiService';
import './AiDoubtAssistant.css';

// MediaPipe skeleton connection lines
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[11,12],[12,13],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

export default function AiDoubtAssistant() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hello! 🤖 I'm your AI Doubt Assistant. You can ask me questions in Text, Voice, or Sign Language, and I'll explain them in simple terms! Ask me about 'gravity', 'loops', or 'photosynthesis'." }
  ]);
  
  // Return null if not logged in
  if (!currentUser) return null;

  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState('text'); // text, voice, sign
  
  // Voice Input States
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef(null);

  // Background Wake Word Detection States
  const [isWakeWordListening, setIsWakeWordListening] = useState(true);
  const wakeWordRecRef = useRef(null);

  // Sign Language Input States (User Camera)
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [camStatus, setCamStatus] = useState('idle');
  const [detectedLetter, setDetectedLetter] = useState(null);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStartRef = useRef(null);
  const lastDetectedRef = useRef(null);
  const confirmedLetterRef = useRef(null);
  const userCameraStreamRef = useRef(null);
  const animFrameRef = useRef(null);

  // Avatar Output States (AI Avatar)
  const avatarCanvasRef = useRef(null);
  const [avatarActiveWord, setAvatarActiveWord] = useState('');
  const [avatarActiveLetter, setAvatarActiveLetter] = useState('');
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [avatarFaceBlink, setAvatarFaceBlink] = useState(false);
  
  // Interpolation points for the avatar hand skeleton
  const currentHandLandmarksRef = useRef(getLandmarksForCode("TUCKED-1111"));
  const targetHandLandmarksRef = useRef(getLandmarksForCode("TUCKED-1111"));

  // Post-Class Overlay state
  const [showPostClassModal, setShowPostClassModal] = useState(false);

  // Synthesize sound beep
  const playNotificationBeep = useCallback((freq = 550, duration = 0.2) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  // Text-To-Speech function
  const speakAIResponse = useCallback((text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Split text into words to synchronize the avatar
    const words = text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
    let wordIndex = 0;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    
    utterance.onstart = () => {
      setIsAvatarTalking(true);
    };

    utterance.onend = () => {
      setIsAvatarTalking(false);
      setAvatarActiveWord('');
      setAvatarActiveLetter('');
      targetHandLandmarksRef.current = getLandmarksForCode("TUCKED-1111"); // Return to neutral flat hand
    };

    // Cycle through words and letters to show active sign shapes
    const signInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(signInterval);
        return;
      }
      
      if (wordIndex < words.length) {
        const currentWord = words[wordIndex];
        setAvatarActiveWord(currentWord);
        
        // Pick the first letter of the word or spell it if short
        const letter = currentWord[0] ? currentWord[0].toUpperCase() : 'B';
        setAvatarActiveLetter(letter);
        
        // Set target handlandmarks for the avatar to sign
        targetHandLandmarksRef.current = getLandmarksForLetter(letter);
        
        wordIndex++;
      }
    }, 900);

    window.speechSynthesis.speak(utterance);
  }, []);

  // Listen to Global "classEnded" events to prompt students
  useEffect(() => {
    const handleClassEndEvent = () => {
      setShowPostClassModal(true);
      playNotificationBeep(650, 0.35);
    };
    
    window.addEventListener('verdent-class-ended', handleClassEndEvent);
    return () => {
      window.removeEventListener('verdent-class-ended', handleClassEndEvent);
    };
  }, [playNotificationBeep]);

  // Background Wake Word Detection
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const startWakeWordListener = () => {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (event) => {
          const result = event.results[event.results.length - 1][0].transcript.toLowerCase();
          if (result.includes('ai doubt assistant') || result.includes('doubt assistant') || result.includes('open doubt')) {
            playNotificationBeep(520, 0.1);
            setTimeout(() => playNotificationBeep(650, 0.15), 100);
            setIsOpen(true);
            setShowPostClassModal(false);
          }
        };

        rec.onerror = (e) => {
          // Restart on error/timeout
          if (isWakeWordListening) {
            setTimeout(startWakeWordListener, 1000);
          }
        };

        rec.onend = () => {
          if (isWakeWordListening && !isOpen) {
            rec.start();
          }
        };

        rec.start();
        wakeWordRecRef.current = rec;
      } catch (err) {
        console.warn("Wake word activation error:", err);
      }
    };

    if (isWakeWordListening && !isOpen) {
      startWakeWordListener();
    }

    return () => {
      if (wakeWordRecRef.current) {
        wakeWordRecRef.current.onend = null;
        wakeWordRecRef.current.stop();
      }
    };
  }, [isWakeWordListening, isOpen, playNotificationBeep]);

  // Handle opening / closing state
  const handleOpenPanel = () => {
    setIsOpen(true);
    setShowPostClassModal(false);
    setIsWakeWordListening(false);
    if (wakeWordRecRef.current) {
      wakeWordRecRef.current.stop();
    }
  };

  const handleClosePanel = () => {
    setIsOpen(false);
    setIsWakeWordListening(true);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopUserCamera();
  };

  // Sound and Avatar mouth movement sync
  useEffect(() => {
    if (!isAvatarTalking) return;
    const interval = setInterval(() => {
      // Toggle mouth status
      setIsAvatarTalking(prev => prev);
    }, 150);
    return () => clearInterval(interval);
  }, [isAvatarTalking]);

  // Simple eye blink animation for Avatar face
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setAvatarFaceBlink(true);
      setTimeout(() => setAvatarFaceBlink(false), 200);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Avatar hand rendering and LERP interpolation loop
  useEffect(() => {
    const canvas = avatarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      // Draw active coordinates by smoothly interpolating toward target hand landmarks
      const current = currentHandLandmarksRef.current;
      const target = targetHandLandmarksRef.current;
      
      const lerped = current.map((pt, idx) => {
        const tgtPt = target[idx] || pt;
        const lerpFactor = 0.16; // Smoothness factor
        return {
          x: pt.x + (tgtPt.x - pt.x) * lerpFactor,
          y: pt.y + (tgtPt.y - pt.y) * lerpFactor,
          z: pt.z + (tgtPt.z - pt.z) * lerpFactor
        };
      });
      currentHandLandmarksRef.current = lerped;

      // Draw skeleton hand
      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.85)'; // cyan lines
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#0ea5e9';

      for (const [a, b] of HAND_CONNECTIONS) {
        const pA = lerped[a];
        const pB = lerped[b];
        if (pA && pB) {
          ctx.beginPath();
          // Scale and shift landmarks to center on canvas nicely
          ctx.moveTo(pA.x * (W * 0.95) + (W * 0.025), pA.y * (H * 0.9) - (H * 0.05));
          ctx.lineTo(pB.x * (W * 0.95) + (W * 0.025), pB.y * (H * 0.9) - (H * 0.05));
          ctx.stroke();
        }
      }

      // Draw joint dots
      ctx.fillStyle = '#a78bfa'; // violet joints
      for (const pt of lerped) {
        ctx.beginPath();
        ctx.arc(pt.x * (W * 0.95) + (W * 0.025), pt.y * (H * 0.9) - (H * 0.05), 3, 0, 2 * Math.PI);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isOpen]);

  // Voice Query Capture (Mic Mode inside widget)
  const toggleListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onresult = (event) => {
          const text = Array.from(event.results).map(r => r[0].transcript).join("");
          setVoiceTranscript(text);
          setInputText(text);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onerror = () => {
          setIsListening(false);
        };

        rec.start();
        recognitionRef.current = rec;
        setIsListening(true);
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  // Sign Language Webcam Hand Tracking
  const stopUserCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (userCameraStreamRef.current) {
      userCameraStreamRef.current.getTracks().forEach(track => track.stop());
      userCameraStreamRef.current = null;
    }
    setCamStatus('idle');
  };

  const startUserCamera = async () => {
    setCamStatus('loading');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      userCameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }

      // Check if MediaPipe Hands is loaded in window
      if (!window.Hands) {
        // Dynamic inject script if not found (fallback)
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
          script.onload = resolve;
          document.head.appendChild(script);
        });
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

      hands.onResults((r) => {
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
          const landmarks = r.multiHandLandmarks[0];
          // Draw user hand skeleton inside assistant
          ctx.save();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#10b981'; // green tracking
          for (const [a, b] of HAND_CONNECTIONS) {
            const pA = landmarks[a], pB = landmarks[b];
            if (pA && pB) {
              ctx.beginPath();
              ctx.moveTo(pA.x * canvas.width, pA.y * canvas.height);
              ctx.lineTo(pB.x * canvas.width, pB.y * canvas.height);
              ctx.stroke();
            }
          }
          ctx.restore();

          // Predict Sign locally
          import('../services/signAiService').then(({ predictSignLocally }) => {
            const result = predictSignLocally(landmarks);
            if (result && result.label) {
              const letter = result.label.length === 1 ? result.label : result.label.split(" ")[0]; // Get single letter
              setDetectedLetter(letter);
              analyzeUserSign(letter);
            }
          });
        } else {
          setDetectedLetter(null);
          setHoldProgress(0);
          holdStartRef.current = null;
        }
      });

      let lastFrame = 0;
      const loop = async (time) => {
        if (!videoRef.current) return;
        if (videoRef.current.readyState >= 2 && time - lastFrame > 150) {
          await hands.send({ image: videoRef.current });
          lastFrame = time;
        }
        animFrameRef.current = requestAnimationFrame(loop);
      };
      animFrameRef.current = requestAnimationFrame(loop);
      setCamStatus('active');
    } catch (e) {
      setCamStatus('error');
    }
  };

  const analyzeUserSign = (letter) => {
    const POSE_HOLD_MS = 1200;
    if (lastDetectedRef.current === letter) {
      if (!holdStartRef.current) holdStartRef.current = Date.now();
      const elapsed = Date.now() - holdStartRef.current;
      setHoldProgress(Math.min(100, (elapsed / POSE_HOLD_MS) * 100));

      if (elapsed >= POSE_HOLD_MS && confirmedLetterRef.current !== letter) {
        confirmedLetterRef.current = letter;
        setHoldProgress(0);
        playNotificationBeep(620, 0.1);
        
        // Append sign to input text
        setInputText(prev => prev + letter);
      }
    } else {
      lastDetectedRef.current = letter;
      holdStartRef.current = Date.now();
      confirmedLetterRef.current = null;
      setHoldProgress(0);
    }
  };

  // Submit Doubt Question
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputText('');
    setVoiceTranscript('');
    
    // Simulate AI thinking and explanation
    setTimeout(() => {
      const explanation = getSimplifiedExplanation(userText);
      setMessages(prev => [...prev, { sender: 'ai', text: explanation }]);
      
      // Play Audio response + Start avatar signing
      speakAIResponse(explanation);
    }, 700);
  };

  const handleClearSignedText = () => {
    setInputText('');
    setVoiceTranscript('');
  };

  return (
    <>
      {/* Background listener status or minimized button */}
      {!isOpen && (
        <button 
          className={`doubt-assistant__launcher ${isWakeWordListening ? 'listening' : ''}`}
          onClick={handleOpenPanel}
          title="Open AI Doubt Assistant (Wake word active)"
        >
          🤖
        </button>
      )}

      {/* Main Panel View */}
      {isOpen && (
        <div className="doubt-assistant__panel">
          
          {/* Header */}
          <div className="doubt-assistant__header">
            <div className="doubt-assistant__title-block">
              <span className="doubt-assistant__status-icon">🤖</span>
              <div>
                <span className="doubt-assistant__title">Doubt Assistant</span>
                <span className="doubt-assistant__subtitle">Adaptive AI Explainer</span>
              </div>
            </div>
            <div className="doubt-assistant__controls">
              <button className="doubt-assistant__close-btn" onClick={handleClosePanel} title="Minimize">
                ✖
              </button>
            </div>
          </div>

          {/* Animated Avatar Box */}
          <div className="doubt-assistant__avatar-container">
            <div className="doubt-assistant__avatar-face-wrap">
              <svg className="doubt-assistant__avatar-face" viewBox="0 0 100 100">
                {/* Face Base */}
                <circle cx="50" cy="50" r="42" fill="#7c6af7" opacity="0.9" />
                {/* Inner Glow */}
                <circle cx="50" cy="50" r="39" fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
                {/* Eyes */}
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
                {/* Mouth */}
                {isAvatarTalking ? (
                  // Talking Open mouth
                  <ellipse cx="50" cy="65" rx="8" ry="5.5" fill="#fff" />
                ) : (
                  // Smiling closed mouth
                  <path d="M 40 62 Q 50 72 60 62" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
                )}
              </svg>
            </div>

            {/* Hand Skeleton canvas for Sign Language avatar output */}
            <div className="doubt-assistant__avatar-hand-wrap">
              <canvas ref={avatarCanvasRef} width={280} height={120} className="doubt-assistant__avatar-canvas" />
              {avatarActiveWord ? (
                <>
                  <div className="doubt-assistant__avatar-sign-bubble">{avatarActiveLetter}</div>
                  <div className="doubt-assistant__avatar-overlay-text">signing: {avatarActiveWord}</div>
                </>
              ) : (
                <div className="doubt-assistant__avatar-overlay-text">Avatar Standby</div>
              )}
            </div>
          </div>

          {/* Messages Logs */}
          <div className="doubt-assistant__chat-body">
            {messages.map((msg, index) => (
              <div key={index} className={`doubt-assistant__message ${msg.sender}`}>
                <span className="doubt-assistant__msg-sender">
                  {msg.sender === 'ai' ? '💡 AI Assistant' : '👤 Me'}
                </span>
                <div className="doubt-assistant__msg-bubble">
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Interactive input area */}
          <div className="doubt-assistant__input-wrap">
            <div className="doubt-assistant__mode-selector">
              <button 
                className={`doubt-assistant__mode-btn ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => { setInputMode('text'); stopUserCamera(); }}
              >
                ⌨️ Text
              </button>
              <button 
                className={`doubt-assistant__mode-btn ${inputMode === 'voice' ? 'active' : ''}`}
                onClick={() => { setInputMode('voice'); stopUserCamera(); }}
              >
                🎙️ Voice
              </button>
              <button 
                className={`doubt-assistant__mode-btn ${inputMode === 'sign' ? 'active' : ''}`}
                onClick={() => { setInputMode('sign'); startUserCamera(); }}
              >
                🤟 Sign Language
              </button>
            </div>

            {/* Text Input Panel */}
            {inputMode === 'text' && (
              <form onSubmit={handleSubmit} className="doubt-assistant__text-controls">
                <input 
                  type="text" 
                  className="doubt-assistant__text-input"
                  placeholder="Ask your doubt here..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button type="submit" className="doubt-assistant__send-btn">
                  ✈️
                </button>
              </form>
            )}

            {/* Voice Input Panel */}
            {inputMode === 'voice' && (
              <div className="doubt-assistant__voice-panel">
                <button 
                  type="button" 
                  className={`doubt-assistant__mic-trigger ${isListening ? 'recording' : ''}`}
                  onClick={toggleListening}
                >
                  🎙️
                </button>
                <div className="doubt-assistant__voice-hint">
                  {isListening ? 'Listening... Speak your doubt!' : 'Tap mic and ask your question.'}
                </div>
                {voiceTranscript && (
                  <div className="doubt-assistant__voice-text">"{voiceTranscript}"</div>
                )}
                {inputText && (
                  <button onClick={handleSubmit} className="doubt-assistant__cam-toggle" style={{ marginTop: '0.4rem' }}>
                    Ask Doubt ✈️
                  </button>
                )}
              </div>
            )}

            {/* Sign Language Input Panel */}
            {inputMode === 'sign' && (
              <div className="doubt-assistant__cam-panel">
                <div className="doubt-assistant__video-container">
                  <video ref={videoRef} className="doubt-assistant__video" playsInline muted autoPlay style={{ display: camStatus === 'active' ? 'block' : 'none' }} />
                  <canvas ref={canvasRef} className="doubt-assistant__canvas" style={{ display: camStatus === 'active' ? 'block' : 'none' }} />
                  {camStatus !== 'active' && (
                    <div className="doubt-assistant__cam-placeholder">
                      <p>{camStatus === 'loading' ? 'Loading MediaPipe Hand Models...' : 'Camera feed is closed.'}</p>
                      <button className="doubt-assistant__cam-toggle" onClick={startUserCamera} disabled={camStatus === 'loading'}>
                        {camStatus === 'loading' ? 'Starting...' : 'Start Camera'}
                      </button>
                    </div>
                  )}
                </div>

                {detectedLetter && (
                  <div className="doubt-assistant__sign-hud">
                    <span className="doubt-assistant__sign-text">Sign Detected:</span>
                    <span className="doubt-assistant__sign-val">{detectedLetter}</span>
                    <div style={{ width: '40px', background: 'rgba(255,255,255,0.1)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${holdProgress}%`, background: '#10b981', height: '100%' }}></div>
                    </div>
                  </div>
                )}

                <div className="doubt-assistant__text-controls" style={{ width: '100%' }}>
                  <input 
                    type="text" 
                    className="doubt-assistant__text-input"
                    placeholder="Signed text builds up here..."
                    value={inputText}
                    readOnly
                  />
                  {inputText && (
                    <button onClick={handleClearSignedText} className="doubt-assistant__close-btn" style={{ borderRadius: '6px' }} title="Clear text">
                      🗑️
                    </button>
                  )}
                  <button onClick={handleSubmit} className="doubt-assistant__send-btn" disabled={!inputText}>
                    ✈️
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-Class Modal Trigger */}
      {showPostClassModal && (
        <div className="doubt-assistant__post-modal-overlay">
          <div className="doubt-assistant__post-modal">
            <div className="doubt-assistant__post-emoji">👨‍🎓 🚀</div>
            <h2 className="doubt-assistant__post-title">Class is Finished!</h2>
            <p className="doubt-assistant__post-desc">
              Great job in today's class! If you have any remaining doubts or questions, let's clear them up right now. Ask me using Text, Voice, or Sign Language!
            </p>
            <div className="doubt-assistant__post-btns">
              <button 
                className="doubt-assistant__post-btn primary"
                onClick={handleOpenPanel}
              >
                🤖 Ask AI Assistant
              </button>
              <button 
                className="doubt-assistant__post-btn secondary"
                onClick={() => setShowPostClassModal(false)}
              >
                No doubts, exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
