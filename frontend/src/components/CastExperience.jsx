import React, { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import {
  Volume2,
  VolumeX,
  RefreshCw,
  Copy,
  Trash2,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  Layers,
  HelpCircle,
  Camera,
  CameraOff
} from "lucide-react";

import ThreeParticleScene from "./ThreeParticleScene";
import HandSkeletonOverlay from "./HandSkeletonOverlay";
import { castWS } from "../services/castWebSocket";
import { tts } from "../services/ttsService";
import { predictSignLocally } from "../services/signAiService";

// Helper dictionary for visual prompt cheatsheet
const COMMON_SIGNS = [
  { sign: "OK", desc: "Thumb & Index circle, 3 fingers up", icon: "👌" },
  { sign: "HELLO", desc: "Open palm facing camera", icon: "👋" },
  { sign: "PEACE", desc: "V shape with Index & Middle", icon: "✌️" },
  { sign: "I LOVE YOU", desc: "Thumb, Index & Pinky extended", icon: "🤟" },
  { sign: "YES / GOOD", desc: "Thumbs up gesture", icon: "👍" },
  { sign: "HELP / THANK YOU", desc: "Flat palm over chest / Pinky thumb out", icon: "🙏" },
];

export default function CastExperience({ onBack }) {
  // --- UI & Detection States ---
  const [landmarks, setLandmarks] = useState([]);
  const [currentWord, setCurrentWord] = useState("");
  const [currentConfidence, setCurrentConfidence] = useState(0.0);
  const [sentence, setSentence] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [showDictionary, setShowDictionary] = useState(false);
  const [isFlourishActive, setIsFlourishActive] = useState(false);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [fps, setFps] = useState(0);

  const videoRef = useRef(null);
  const detectorRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastRecognizedWordRef = useRef({ word: "", timestamp: 0 });
  const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });

  // 1. Initialize WebSocket & Global window.CAST Bridge
  useEffect(() => {
    castWS.connect();

    const unsubscribe = castWS.subscribe((event) => {
      if (event.type === "status_change") {
        setConnectionStatus(event.status);
      } else if (event.type === "recognition" && event.word) {
        handleRecognitionEvent(event.word, event.confidence || 0.95);
      } else if (event.type === "landmarks" && event.landmarks) {
        setLandmarks(event.landmarks);
      }
    });

    // Provide tts to global CAST
    if (window.CAST) {
      window.CAST.tts = tts;
    }

    return () => {
      unsubscribe();
      castWS.disconnect();
    };
  }, []);

  // 2. Handle Recognized Word Landing (Flourish, Audio Cue, Sentence Builder)
  const handleRecognitionEvent = useCallback((word, confidence) => {
    if (!word || word === "WAITING" || word === "UNDERSTOOD") return;

    const now = Date.now();
    // Debounce duplicate recognitions within 1.2s to prevent rapid sentence spam
    if (
      lastRecognizedWordRef.current.word === word &&
      now - lastRecognizedWordRef.current.timestamp < 1200
    ) {
      return;
    }

    lastRecognizedWordRef.current = { word, timestamp: now };
    setCurrentWord(word);
    setCurrentConfidence(confidence);
    setIsFlourishActive(true);

    // Audio chime & speech synthesis
    tts.playRecognitionTone(confidence);
    tts.speak(word, { immediate: false });

    // Subtle celebration particles on high-confidence words
    if (confidence > 0.92) {
      triggerGlowBurst();
    }

    // Append to sentence buffer
    setSentence((prev) => {
      // Prevent consecutive duplicates in sentence list
      if (prev.length > 0 && prev[prev.length - 1] === word) return prev;
      return [...prev, word];
    });

    // Reset flourish animation state after 900ms
    setTimeout(() => {
      setIsFlourishActive(false);
    }, 900);
  }, []);

  // Visual Particle Flourish on Word Lock
  const triggerGlowBurst = () => {
    try {
      confetti({
        particleCount: 22,
        spread: 55,
        origin: { y: 0.62 },
        colors: ["#00f2fe", "#9d4edd", "#00f5d4", "#ffffff"],
        ticks: 120,
        disableForReducedMotion: true,
      });
    } catch (e) {}
  };

  // 3. Initialize Camera & MediaPipe Hand Detector
  useEffect(() => {
    let stream = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user",
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            initHandDetector();
          };
        }
      } catch (err) {
        console.warn("[C.A.S.T] Camera permission not granted or unavailable:", err);
        setIsCameraActive(false);
      }
    }

    async function initHandDetector() {
      try {
        // Dynamic import of handPoseDetection
        const handPoseDetection = await import("@tensorflow-models/hand-pose-detection");
        const tf = await import("@tensorflow/tfjs-core");
        await import("@tensorflow/tfjs-backend-webgl");

        await tf.ready();
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig = {
          runtime: "tfjs",
          modelType: "lite",
          maxHands: 1,
        };
        detectorRef.current = await handPoseDetection.createDetector(model, detectorConfig);
        startDetectionLoop();
      } catch (e) {
        console.warn("[C.A.S.T] Using lightweight landmark heuristic pipeline:", e);
        startDetectionLoop();
      }
    }

    if (isCameraActive) {
      startCamera();
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isCameraActive]);

  // 4. Real-Time Detection Loop (~20-30 fps)
  const startDetectionLoop = () => {
    const detect = async () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        // Calculate FPS
        const now = performance.now();
        fpsCounterRef.current.frames++;
        if (now - fpsCounterRef.current.lastTime >= 1000) {
          setFps(fpsCounterRef.current.frames);
          fpsCounterRef.current.frames = 0;
          fpsCounterRef.current.lastTime = now;
        }

        if (detectorRef.current) {
          try {
            const hands = await detectorRef.current.estimateHands(videoRef.current, {
              flipHorizontal: false,
            });

            if (hands && hands.length > 0) {
              const rawKeypoints = hands[0].keypoints;
              // Normalize landmarks (0..1)
              const vW = videoRef.current.videoWidth || 640;
              const vH = videoRef.current.videoHeight || 480;
              const normalized = rawKeypoints.map((pt) => ({
                x: pt.x / vW,
                y: pt.y / vH,
                z: (pt.z || 0) / vW,
              }));

              setLandmarks(normalized);

              // 1. Stream to WebSocket server (throttled to 20fps)
              castWS.sendLandmarks(normalized);

              // 2. Client-side fallback prediction for instantaneous response
              const localPred = predictSignLocally(normalized);
              if (localPred && localPred.label) {
                handleRecognitionEvent(localPred.label, localPred.confidence || 0.94);
              }
            } else {
              setLandmarks([]);
            }
          } catch (err) {
            // Detection frame skip
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(detect);
    };

    animationFrameRef.current = requestAnimationFrame(detect);
  };

  // Actions
  const handleCopySentence = () => {
    const fullText = sentence.join(" ");
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2000);
  };

  const handleClearSentence = () => {
    setSentence([]);
    setCurrentWord("");
    setCurrentConfidence(0);
    tts.stop();
  };

  const handleSpeakFullSentence = () => {
    const fullText = sentence.join(" ");
    if (fullText) {
      tts.speak(fullText, { immediate: true });
    }
  };

  const toggleAudio = () => {
    const enabled = tts.toggleAudio();
    setIsAudioEnabled(enabled);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050811] text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      {/* 1. Ambient 3D Reactive Particle Background */}
      <ThreeParticleScene
        confidence={currentConfidence}
        activityLevel={landmarks.length > 0 ? 0.9 : 0.2}
      />

      {/* 2. Top Header Navigation & Status Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-cyan-500/15 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-violet-600 shadow-[0_0_20px_rgba(0,242,254,0.4)]">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-violet-300 bg-clip-text text-transparent">
              C.A.S.T.
            </h1>
            <p className="text-xs text-cyan-400/80 font-medium tracking-wide">
              Real-Time Sign-to-Speech Neural Translation
            </p>
          </div>
        </div>

        {/* Center Live Connection Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 backdrop-blur-md text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-400 shadow-[0_0_10px_#10b981] animate-pulse"
                  : connectionStatus === "connecting"
                  ? "bg-amber-400 shadow-[0_0_10px_#f59e0b] animate-ping"
                  : "bg-cyan-400 shadow-[0_0_10px_#00f2fe]"
              }`}
            />
            <span className="font-mono text-slate-300">
              {connectionStatus === "connected"
                ? "WebSocket Live (20 fps)"
                : connectionStatus === "connecting"
                ? "Connecting..."
                : "Neural Pipeline Active"}
            </span>
            {fps > 0 && (
              <span className="text-slate-500 border-l border-slate-700 pl-2">
                {fps} FPS
              </span>
            )}
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDictionary(!showDictionary)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 transition-colors"
            title="View Sign Cheat Sheet"
          >
            <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
            <span>Gestures</span>
          </button>

          <button
            onClick={toggleAudio}
            className={`p-2 rounded-lg border transition-colors ${
              isAudioEnabled
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
                : "border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-400"
            }`}
            title={isAudioEnabled ? "Mute TTS Audio" : "Enable TTS Audio"}
          >
            {isAudioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 transition-colors"
            >
              Exit
            </button>
          )}
        </div>
      </header>

      {/* 3. Main Center Stage */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full p-6 flex flex-col gap-6 justify-between items-center">
        {/* Upper Video & Hero Skeleton Stage */}
        <div className="relative w-full max-w-3xl aspect-[4/3] max-h-[500px] rounded-3xl overflow-hidden border border-cyan-500/30 bg-slate-950/80 shadow-[0_0_50px_rgba(0,242,254,0.15)] backdrop-blur-xl">
          {/* Real Video Feed */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {/* Luminous Glowing Skeleton Overlay */}
          <HandSkeletonOverlay
            landmarks={landmarks}
            width={640}
            height={480}
            isMirrored={true}
          />

          {/* Floating Recognized Word Reveal Moment */}
          {currentWord && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                  isFlourishActive
                    ? "scale-110 opacity-100 filter drop-shadow-[0_0_25px_rgba(0,242,254,0.9)]"
                    : "scale-100 opacity-90"
                }`}
              >
                <div className="px-5 py-2 rounded-2xl bg-slate-950/80 border border-cyan-400/50 backdrop-blur-xl flex items-center gap-3 shadow-2xl">
                  <span className="text-2xl font-black tracking-wider bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                    {currentWord}
                  </span>
                  {/* Confidence Ring Indicator */}
                  <div className="relative flex items-center justify-center w-7 h-7">
                    <svg className="w-7 h-7 -rotate-90">
                      <circle
                        cx="14"
                        cy="14"
                        r="11"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        className="text-slate-800"
                      />
                      <circle
                        cx="14"
                        cy="14"
                        r="11"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="transparent"
                        strokeDasharray={69.1}
                        strokeDashoffset={69.1 - (currentConfidence * 69.1)}
                        className={`transition-all duration-300 ${
                          currentConfidence > 0.9
                            ? "text-emerald-400"
                            : currentConfidence > 0.75
                            ? "text-cyan-400"
                            : "text-amber-400"
                        }`}
                      />
                    </svg>
                    <span className="absolute text-[9px] font-mono font-bold text-white">
                      {Math.round(currentConfidence * 100)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-300/80 bg-slate-900/60 px-2 py-0.5 rounded-full border border-cyan-500/20">
                  Transcribed Voice Event
                </span>
              </div>
            </div>
          )}

          {/* Prompt when no hand detected */}
          {landmarks.length === 0 && isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-slate-950/20 backdrop-blur-[2px]">
              <div className="px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700/50 text-slate-400 text-xs flex items-center gap-2 animate-pulse">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>Show hand in frame to sign</span>
              </div>
            </div>
          )}

          {/* Corner Cyberpunk Frame Grids */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60" />
        </div>

        {/* 4. Real-Time Sentence Construction Bar */}
        <div className="relative w-full max-w-4xl z-20">
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-950/70 border border-cyan-500/20 shadow-2xl backdrop-blur-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold uppercase tracking-wider text-slate-300">
                  Sentence Stream & Voice Accumulator
                </span>
              </div>
              <span className="font-mono text-slate-500">
                {sentence.length} {sentence.length === 1 ? "word" : "words"}
              </span>
            </div>

            {/* Sentence Word Badges or Placeholder */}
            <div className="min-h-[52px] flex items-center flex-wrap gap-2 py-1">
              {sentence.length === 0 ? (
                <p className="text-slate-500 italic text-sm">
                  Signed words will materialize here and stitch into complete sentences...
                </p>
              ) : (
                sentence.map((word, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-violet-950/60 border border-cyan-500/30 text-cyan-200 font-medium text-sm shadow-[0_0_15px_rgba(0,242,254,0.15)] animate-in fade-in zoom-in duration-200"
                  >
                    {word}
                  </span>
                ))
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSpeakFullSentence}
                  disabled={sentence.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-[0_0_20px_rgba(0,242,254,0.3)] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Speak Aloud</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySentence}
                  disabled={sentence.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Copy text to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedNotice ? "Copied!" : "Copy"}</span>
                </button>

                <button
                  onClick={handleClearSentence}
                  disabled={sentence.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-red-950/50 hover:border-red-500/40 text-slate-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Clear sentence"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Gesture Dictionary Drawer */}
      {showDictionary && (
        <aside className="fixed right-6 top-20 bottom-6 w-80 z-30 p-5 rounded-3xl bg-slate-950/95 border border-cyan-500/30 shadow-2xl backdrop-blur-2xl flex flex-col gap-4 animate-in slide-in-from-right duration-300">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span>Gesture Cheat Sheet</span>
            </h3>
            <button
              onClick={() => setShowDictionary(false)}
              className="text-xs text-slate-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {COMMON_SIGNS.map((item, idx) => (
              <div
                key={idx}
                onClick={() => handleRecognitionEvent(item.sign, 0.98)}
                className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-cyan-500/40 hover:bg-slate-800/60 cursor-pointer transition-all flex items-start gap-3"
              >
                <span className="text-2xl">{item.icon}</span>
                <div>
                  <h4 className="font-semibold text-xs text-slate-200">{item.sign}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 text-center border-t border-slate-800/80 pt-3">
            Tip: Click any gesture to test voice & flourish playback
          </p>
        </aside>
      )}
    </div>
  );
}
