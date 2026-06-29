import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { A11yText } from '../context/AccessibilityContext';
import { getLandmarksForCode, getLandmarksForLetter } from '../services/doubtAiService';
import './SignKeyboard.css';

// MediaPipe skeleton connection lines
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[11,12],[12,13],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

// Keyboard categories and items
const KEYBOARD_CATEGORIES = {
  Alphabet: [
    { label: 'A', emoji: '✊', code: 'OUT-0000' },
    { label: 'B', emoji: '🤚', code: 'TUCKED-1111' },
    { label: 'C', emoji: '🤏', code: 'TUCKED-0000' },
    { label: 'D', emoji: '☝️', code: 'TUCKED-1000' },
    { label: 'E', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'F', emoji: '👌', code: 'TUCKED-0111' },
    { label: 'G', emoji: '✊', code: 'OUT-0000' },
    { label: 'H', emoji: '👈', code: 'OUT-1100' },
    { label: 'I', emoji: '☝️', code: 'TUCKED-1000' },
    { label: 'J', emoji: '☝️', code: 'TUCKED-1000' },
    { label: 'K', emoji: '✌️', code: 'TUCKED-1100' },
    { label: 'L', emoji: '☝️', code: 'OUT-1000' },
    { label: 'M', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'N', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'O', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'P', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'Q', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'R', emoji: '🤞', code: 'TUCKED-1100' },
    { label: 'S', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'T', emoji: '✊', code: 'TUCKED-0000' },
    { label: 'U', emoji: '☝️', code: 'TUCKED-1100' },
    { label: 'V', emoji: '✌️', code: 'TUCKED-1100' },
    { label: 'W', emoji: '🤟', code: 'TUCKED-1110' },
    { label: 'X', emoji: '☝️', code: 'TUCKED-1000' },
    { label: 'Y', emoji: '🤙', code: 'OUT-0001' },
    { label: 'Z', emoji: '☝️', code: 'TUCKED-1000' }
  ],
  Numbers: [
    { label: '0', emoji: '✊', code: 'TUCKED-0000' },
    { label: '1', emoji: '👆', code: 'TUCKED-1000' },
    { label: '2', emoji: '✌️', code: 'TUCKED-1100' },
    { label: '3', emoji: '🤟', code: 'TUCKED-1110' },
    { label: '4', emoji: '✊', code: 'TUCKED-1111' },
    { label: '5', emoji: '✋', code: 'OUT-1111' },
    { label: '6', emoji: '👍', code: 'UP-0000' },
    { label: '7', emoji: '🤙', code: 'OUT-0001' },
    { label: '8', emoji: '✌️', code: 'TUCKED-1100' },
    { label: '9', emoji: '☝️', code: 'TUCKED-1000' }
  ],
  Greetings: [
    { label: 'Hello', emoji: '👋', code: 'OUT-1111' },
    { label: 'Thank You', emoji: '🙏', code: 'TUCKED-1111' },
    { label: 'Goodbye', emoji: '👋', code: 'OUT-1111' },
    { label: 'Welcome', emoji: '🤝', code: 'OUT-1111' },
    { label: 'Good Morning', emoji: '🌅', code: 'OUT-1111' },
    { label: 'Nice to meet you', emoji: '🤝', code: 'OUT-1111' }
  ],
  Emergency: [
    { label: 'Help', emoji: '🆘', code: 'UP-0000' },
    { label: 'Danger', emoji: '⚠️', code: 'DOWN-0000' },
    { label: 'Fire', emoji: '🔥', code: 'DOWN-1111' },
    { label: 'Doctor', emoji: '👨‍⚕️', code: 'TUCKED-1100' },
    { label: 'Police', emoji: '👮', code: 'TUCKED-1000' },
    { label: 'Call', emoji: '📞', code: 'OUT-0001' }
  ],
  Education: [
    { label: 'School', emoji: '🏫', code: 'TUCKED-1111' },
    { label: 'Teacher', emoji: '👨‍🏫', code: 'TUCKED-1100' },
    { label: 'Book', emoji: '📖', code: 'TUCKED-1111' },
    { label: 'Class', emoji: '🏫', code: 'TUCKED-1111' },
    { label: 'Study', emoji: '✏️', code: 'TUCKED-1000' },
    { label: 'Write', emoji: '✍️', code: 'TUCKED-1000' }
  ],
  Hospital: [
    { label: 'Hospital', emoji: '🏥', code: 'TUCKED-1111' },
    { label: 'Doctor', emoji: '👨‍⚕️', code: 'TUCKED-1100' },
    { label: 'Medicine', emoji: '💊', code: 'TUCKED-1000' },
    { label: 'Pain', emoji: '😭', code: 'DOWN-1111' },
    { label: 'Sick', emoji: '🤢', code: 'DOWN-1110' },
    { label: 'Help', emoji: '🆘', code: 'UP-0000' }
  ],
  Daily: [
    { label: 'Yes', emoji: '👍', code: 'UP-0000' },
    { label: 'No', emoji: '👎', code: 'DOWN-0000' },
    { label: 'Please', emoji: '🙏', code: 'TUCKED-1111' },
    { label: 'Sorry', emoji: '🙇', code: 'TUCKED-0000' },
    { label: 'Excuse me', emoji: '✋', code: 'OUT-1111' },
    { label: 'What', emoji: '❓', code: 'OUT-0000' },
    { label: 'Where', emoji: '📍', code: 'OUT-1100' },
    { label: 'How', emoji: '🤷', code: 'OUT-1111' }
  ],
  Food: [
    { label: 'Water', emoji: '🥛', code: 'TUCKED-1110' },
    { label: 'Food', emoji: '🍎', code: 'TUCKED-1111' },
    { label: 'Hungry', emoji: '😋', code: 'TUCKED-0000' },
    { label: 'Thirsty', emoji: '🥵', code: 'TUCKED-1110' },
    { label: 'Eat', emoji: '🍽️', code: 'TUCKED-0000' },
    { label: 'Drink', emoji: '🥛', code: 'TUCKED-1110' },
    { label: 'Fruit', emoji: '🍌', code: 'TUCKED-1111' }
  ],
  Emotions: [
    { label: 'Happy', emoji: '😊', code: 'UP-0000' },
    { label: 'Sad', emoji: '😢', code: 'DOWN-0000' },
    { label: 'Angry', emoji: '😠', code: 'DOWN-1100' },
    { label: 'Scared', emoji: '😨', code: 'TUCKED-0000' },
    { label: 'Excited', emoji: '🤩', code: 'UP-1111' },
    { label: 'Tired', emoji: '🥱', code: 'DOWN-0000' }
  ],
  Travel: [
    { label: 'Go', emoji: '🚶', code: 'OUT-1100' },
    { label: 'Stop', emoji: '🛑', code: 'TUCKED-1111' },
    { label: 'Bus', emoji: '🚌', code: 'TUCKED-1111' },
    { label: 'Car', emoji: '🚗', code: 'TUCKED-1111' },
    { label: 'Train', emoji: '🚆', code: 'TUCKED-1111' },
    { label: 'Map', emoji: '🗺️', code: 'TUCKED-1111' },
    { label: 'Ticket', emoji: '🎟️', code: 'TUCKED-1000' }
  ]
};

// AI Sentence building rules/mappings
const SENTENCE_MAPPING = {
  'hello,i,need,water': 'Hello! I need some water.',
  'hello,i,need,food': 'Hello! I need some food.',
  'hello,how,you': 'Hello, how are you?',
  'help,danger': 'Help! I am in danger.',
  'help,sick': 'Please help, I am feeling sick.',
  'help,pain': 'Help me, I am in pain.',
  'doctor,please': 'Please call a doctor.',
  'police,emergency': 'Call the police, this is an emergency!',
  'yes,please': 'Yes, please.',
  'no,thank you': 'No, thank you.',
  'excuse me,where,hospital': 'Excuse me, where is the hospital?',
  'excuse me,where,school': 'Excuse me, where is the school?',
  'i,go,home': 'I want to go home.',
  'teacher,good morning': 'Good morning, teacher!',
  'happy,excited': 'I am very happy and excited!',
  'tired,sad': 'I am feeling tired and sad.',
  'danger,stop': 'Danger, please stop immediately!'
};

const CATEGORY_SUGGESTIONS = {
  Greetings: ['Hello, how are you?', 'Thank you very much!', 'Nice to meet you.'],
  Emergency: ['I need emergency help!', 'Please call my family.', 'There is a fire!'],
  Education: ['Where is the classroom?', 'I want to study a book.', 'Thank you, teacher.'],
  Hospital: ['I need to see a doctor.', 'I am feeling very sick.', 'Where is the medicine?'],
  Daily: ['Yes, please.', 'No, thank you.', 'Excuse me, what is that?'],
  Food: ['Can I have some water?', 'I am very hungry.', 'I want to eat food.'],
  Emotions: ['I am very happy today.', 'I feel tired and sad.', 'I am excited for class.'],
  Travel: ['Where is the bus stop?', 'Please stop here.', 'I have a train ticket.']
};

export default function SignKeyboard() {
  const { currentUser } = useAuth();
  
  // Return null if not logged in
  if (!currentUser) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Greetings');
  
  // Output and Sentence states
  const [typedWords, setTypedWords] = useState([]);
  const [constructedSentence, setConstructedSentence] = useState('');
  
  // Voice Toast state
  const [showVoiceToast, setShowVoiceToast] = useState(false);
  const [voiceToastText, setVoiceToastText] = useState('');

  // Favorites state
  const [favorites, setFavorites] = useState([]);

  // Avatar states
  const avatarCanvasRef = useRef(null);
  const [avatarActiveWord, setAvatarActiveWord] = useState('');
  const [avatarActiveLetter, setAvatarActiveLetter] = useState('');
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);
  const [avatarFaceBlink, setAvatarFaceBlink] = useState(false);

  const currentHandLandmarksRef = useRef(getLandmarksForCode("TUCKED-1111"));
  const targetHandLandmarksRef = useRef(getLandmarksForCode("TUCKED-1111"));

  // Beep Audio helper
  const playBeep = useCallback((freq = 550, duration = 0.2) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  }, []);

  // Sync Favorites with localStorage
  useEffect(() => {
    const storedFavs = localStorage.getItem('cast_sign_keyboard_favs');
    if (storedFavs) {
      try {
        setFavorites(JSON.parse(storedFavs));
      } catch (e) {
        setFavorites([]);
      }
    }
  }, []);

  const saveFavoritesToLocal = (newFavs) => {
    setFavorites(newFavs);
    localStorage.setItem('cast_sign_keyboard_favs', JSON.stringify(newFavs));
  };

  // Background Wake Word Detection
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let rec = null;
    const startWakeWordListener = () => {
      try {
        rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (event) => {
          const result = event.results[event.results.length - 1][0].transcript.toLowerCase();
          
          const hasWakeCommand = 
            result.includes('cast, open the keyboard') || 
            result.includes('cast open the keyboard') ||
            result.includes('open sign keyboard') || 
            result.includes('start sign keyboard') ||
            result.includes('launch keyboard');

          if (hasWakeCommand) {
            playBeep(520, 0.1);
            setTimeout(() => playBeep(650, 0.15), 100);
            
            setVoiceToastText('Voice Command Detected! Opening Keyboard...');
            setShowVoiceToast(true);
            setIsOpen(true);
            setTimeout(() => setShowVoiceToast(false), 2500);
          }
        };

        rec.onerror = () => {
          // Restart listener after a delay on error
          setTimeout(startWakeWordListener, 1500);
        };

        rec.onend = () => {
          if (!isOpen) {
            try { rec.start(); } catch (e) {}
          }
        };

        rec.start();
      } catch (err) {
        console.warn("Sign Keyboard Wake word activation error:", err);
      }
    };

    if (!isOpen) {
      startWakeWordListener();
    }

    return () => {
      if (rec) {
        rec.onend = null;
        try { rec.stop(); } catch (e) {}
      }
    };
  }, [isOpen, playBeep]);

  // AI Sentence Builder Logic
  const runAiSentenceBuilder = useCallback((wordsList) => {
    if (wordsList.length === 0) {
      setConstructedSentence('');
      return;
    }

    // Try direct lookup of combinations
    const key = wordsList.map(w => w.toLowerCase()).join(',');
    
    // Exact match
    if (SENTENCE_MAPPING[key]) {
      setConstructedSentence(SENTENCE_MAPPING[key]);
      return;
    }

    // Fuzzy matching: search if key is contained or similar
    for (const [mapWords, sentence] of Object.entries(SENTENCE_MAPPING)) {
      const splitMap = mapWords.split(',');
      const matchesAll = splitMap.every(mw => wordsList.some(w => w.toLowerCase().includes(mw)));
      if (matchesAll && wordsList.length >= splitMap.length) {
        setConstructedSentence(sentence);
        return;
      }
    }

    // Fallback: Clean join & capitalization
    const joined = wordsList.map((w, idx) => {
      if (idx === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      return w.toLowerCase();
    }).join(' ');

    setConstructedSentence(joined + '.');
  }, []);

  // Handlers
  const handleKeyClick = (keyItem) => {
    playBeep(480, 0.08);

    // Trigger Avatar signing on key click
    if (keyItem.code) {
      targetHandLandmarksRef.current = getLandmarksForCode(keyItem.code);
      setAvatarActiveWord(keyItem.label);
      setAvatarActiveLetter(keyItem.label[0]?.toUpperCase() || '');
      
      // Auto-clear preview after 1.5s
      setTimeout(() => {
        setAvatarActiveWord(prev => prev === keyItem.label ? '' : prev);
        setAvatarActiveLetter(prev => prev === (keyItem.label[0]?.toUpperCase() || '') ? '' : prev);
      }, 1500);
    }

    // Don't duplicate letters/words rapidly
    const newWords = [...typedWords, keyItem.label];
    setTypedWords(newWords);
    runAiSentenceBuilder(newWords);
  };

  const handleSuggestionClick = (phrase) => {
    playBeep(480, 0.08);
    setConstructedSentence(phrase);
    // Parse words out of the phrase
    const words = phrase.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
    setTypedWords(words);
  };

  const handleClear = () => {
    playBeep(350, 0.15);
    setTypedWords([]);
    setConstructedSentence('');
  };

  const handleTextChange = (e) => {
    setConstructedSentence(e.target.value);
  };

  const handleCopy = () => {
    if (!constructedSentence) return;
    navigator.clipboard.writeText(constructedSentence);
    playBeep(600, 0.1);
    
    // Reuse toast
    setVoiceToastText('Sentence copied to clipboard!');
    setShowVoiceToast(true);
    setTimeout(() => setShowVoiceToast(false), 2000);
  };

  const handleSaveFavorite = () => {
    if (!constructedSentence.trim()) return;
    if (favorites.includes(constructedSentence)) return;

    const newFavs = [...favorites, constructedSentence];
    saveFavoritesToLocal(newFavs);
    playBeep(620, 0.1);
  };

  const handleDeleteFavorite = (e, indexToDelete) => {
    e.stopPropagation();
    const newFavs = favorites.filter((_, idx) => idx !== indexToDelete);
    saveFavoritesToLocal(newFavs);
    playBeep(300, 0.12);
  };

  // Speech Output & Avatar sync
  const handleSpeak = () => {
    if (!constructedSentence || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const words = constructedSentence.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
    let wordIndex = 0;
    
    const utterance = new SpeechSynthesisUtterance(constructedSentence);
    utterance.rate = 0.85; // A bit slower for signing sync
    
    utterance.onstart = () => {
      setIsAvatarTalking(true);
    };

    utterance.onend = () => {
      setIsAvatarTalking(false);
      setAvatarActiveWord('');
      setAvatarActiveLetter('');
      targetHandLandmarksRef.current = getLandmarksForCode("TUCKED-1111");
    };

    // Cycle signs along with speech
    const signInterval = setInterval(() => {
      if (!window.speechSynthesis.speaking) {
        clearInterval(signInterval);
        return;
      }
      
      if (wordIndex < words.length) {
        const currentWord = words[wordIndex];
        setAvatarActiveWord(currentWord);
        
        // Match word first or fallback to spelling first letter
        const matchLetter = currentWord[0]?.toUpperCase() || 'A';
        setAvatarActiveLetter(matchLetter);
        
        // Find if this word is in our keyboard codes
        let code = 'TUCKED-1111';
        for (const catItems of Object.values(KEYBOARD_CATEGORIES)) {
          const matchItem = catItems.find(item => item.label.toLowerCase() === currentWord.toLowerCase());
          if (matchItem && matchItem.code) {
            code = matchItem.code;
            break;
          }
        }
        
        if (code === 'TUCKED-1111' && matchLetter) {
          // If no word gesture code, procedurally get standard sign for letter
          targetHandLandmarksRef.current = getLandmarksForLetter(matchLetter);
        } else {
          targetHandLandmarksRef.current = getLandmarksForCode(code);
        }
        
        wordIndex++;
      }
    }, 1000);

    window.speechSynthesis.speak(utterance);
  };

  // Avatar Eye Blink Loop
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setAvatarFaceBlink(true);
      setTimeout(() => setAvatarFaceBlink(false), 200);
    }, 4200);
    return () => clearInterval(blinkInterval);
  }, []);

  // Render Hand Canvas LERP
  useEffect(() => {
    if (!isOpen) return;
    const canvas = avatarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId = null;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const W = canvas.width;
      const H = canvas.height;

      const current = currentHandLandmarksRef.current;
      const target = targetHandLandmarksRef.current;
      
      const lerped = current.map((pt, idx) => {
        const tgtPt = target[idx] || pt;
        const lerpFactor = 0.16;
        return {
          x: pt.x + (tgtPt.x - pt.x) * lerpFactor,
          y: pt.y + (tgtPt.y - pt.y) * lerpFactor,
          z: pt.z + (tgtPt.z - pt.z) * lerpFactor
        };
      });
      currentHandLandmarksRef.current = lerped;

      // Draw skeleton hand
      ctx.save();
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)'; // green lines
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#10b981';

      for (const [a, b] of HAND_CONNECTIONS) {
        const pA = lerped[a];
        const pB = lerped[b];
        if (pA && pB) {
          ctx.beginPath();
          ctx.moveTo(pA.x * (W * 0.9) + (W * 0.05), pA.y * (H * 0.8) + (H * 0.05));
          ctx.lineTo(pB.x * (W * 0.9) + (W * 0.05), pB.y * (H * 0.8) + (H * 0.05));
          ctx.stroke();
        }
      }

      // Draw joints
      ctx.fillStyle = '#6ee7b7'; // emerald joints
      for (const pt of lerped) {
        ctx.beginPath();
        ctx.arc(pt.x * (W * 0.9) + (W * 0.05), pt.y * (H * 0.8) + (H * 0.05), 2.5, 0, 2 * Math.PI);
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

  const handleOpenPanel = () => {
    playBeep(520, 0.1);
    setIsOpen(true);
  };

  const handleClosePanel = () => {
    playBeep(350, 0.1);
    setIsOpen(false);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  return (
    <>
      {/* Floating launcher launcher button */}
      {!isOpen && (
        <button 
          className="sign-keyboard__launcher listening"
          onClick={handleOpenPanel}
          title="Open Sign Keyboard (Wake word active)"
        >
          ⌨️🤟
        </button>
      )}

      {/* Voice Notification Toast */}
      {showVoiceToast && (
        <div className="sign-keyboard__voice-alert">
          <div className="sign-keyboard__wave">
            <div className="sign-keyboard__bar"></div>
            <div className="sign-keyboard__bar"></div>
            <div className="sign-keyboard__bar"></div>
          </div>
          <span>{voiceToastText}</span>
        </div>
      )}

      {/* Main Overlay panel */}
      {isOpen && (
        <div className="sign-keyboard__overlay" onClick={handleClosePanel}>
          <div className="sign-keyboard__panel" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="sign-keyboard__header">
              <div className="sign-keyboard__title-block">
                <span className="sign-keyboard__status-icon">⌨️🤟</span>
                <div>
                  <h2 className="sign-keyboard__title">Digital Sign Language Keyboard</h2>
                  <span className="sign-keyboard__subtitle">Voice-Activated AI communicator</span>
                </div>
              </div>
              <button className="sign-keyboard__close-btn" onClick={handleClosePanel} title="Close Keyboard">
                ✖
              </button>
            </div>

            {/* Layout body */}
            <div className="sign-keyboard__body">
              
              {/* Left column: Outputs and Avatar */}
              <div className="sign-keyboard__left-col">
                
                {/* Generated Text area */}
                <div className="sign-keyboard__output-box">
                  <span className="sign-keyboard__output-label">Generated Message</span>
                  <textarea 
                    className="sign-keyboard__output-textarea"
                    placeholder="Selected signs will construct sentences here..."
                    value={constructedSentence}
                    onChange={handleTextChange}
                  />
                  <div className="sign-keyboard__output-actions">
                    <button className="sign-keyboard__action-btn" onClick={handleClear} disabled={!constructedSentence}>
                      🗑️ Clear
                    </button>
                    <button className="sign-keyboard__action-btn" onClick={handleCopy} disabled={!constructedSentence}>
                      📋 Copy
                    </button>
                    <button className="sign-keyboard__action-btn" onClick={handleSaveFavorite} disabled={!constructedSentence}>
                      ❤️ Save
                    </button>
                    <button className="sign-keyboard__action-btn primary" onClick={handleSpeak} disabled={!constructedSentence}>
                      🔊 Speak
                    </button>
                  </div>
                </div>

                {/* Interactive Avatar */}
                <div className="sign-keyboard__avatar-wrap">
                  <div className="sign-keyboard__avatar-inner">
                    
                    {/* Face */}
                    <div className="sign-keyboard__avatar-face-wrap">
                      <svg className="sign-keyboard__avatar-face" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="#10b981" opacity="0.85" />
                        <circle cx="50" cy="50" r="39" fill="none" stroke="#6ee7b7" strokeWidth="2" />
                        {avatarFaceBlink ? (
                          <>
                            <line x1="33" y1="42" x2="43" y2="42" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                            <line x1="57" y1="42" x2="67" y2="42" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                          </>
                        ) : (
                          <>
                            <circle cx="38" cy="42" r="4" fill="#fff" />
                            <circle cx="62" cy="42" r="4" fill="#fff" />
                          </>
                        )}
                        {isAvatarTalking ? (
                          <ellipse cx="50" cy="65" rx="7" ry="5" fill="#fff" />
                        ) : (
                          <path d="M 42 63 Q 50 71 58 63" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                        )}
                      </svg>
                    </div>

                    {/* Canvas skeletal hand */}
                    <div className="sign-keyboard__avatar-hand-wrap">
                      <canvas ref={avatarCanvasRef} width={180} height={90} className="sign-keyboard__avatar-canvas" />
                      {avatarActiveWord && (
                        <div className="sign-keyboard__avatar-speech">
                          {avatarActiveWord}
                        </div>
                      )}
                      <span className="sign-keyboard__avatar-label">CAST Avatar</span>
                    </div>

                  </div>
                </div>

                {/* Favorites Manager */}
                <div className="sign-keyboard__favorites">
                  <h3 className="sign-keyboard__favorites-title">
                    ❤️ Saved Phrases
                  </h3>
                  <div className="sign-keyboard__favorites-list">
                    {favorites.length === 0 ? (
                      <div className="sign-keyboard__no-favs">No saved phrases yet. Tap Save above to save one.</div>
                    ) : (
                      favorites.map((fav, index) => (
                        <button 
                          key={index} 
                          className="sign-keyboard__fav-item"
                          onClick={() => handleSuggestionClick(fav)}
                        >
                          <span>{fav}</span>
                          <button 
                            className="sign-keyboard__fav-delete"
                            onClick={(e) => handleDeleteFavorite(e, index)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </button>
                      ))
                    )}
                  </div>
                </div>

              </div>

              {/* Right column: Keyboard Grid */}
              <div className="sign-keyboard__right-col">
                
                {/* Horizontal Category selection Tabs */}
                <div className="sign-keyboard__tabs">
                  {Object.keys(KEYBOARD_CATEGORIES).map(catName => (
                    <button
                      key={catName}
                      className={`sign-keyboard__tab-btn ${selectedCategory === catName ? 'active' : ''}`}
                      onClick={() => { playBeep(520, 0.05); setSelectedCategory(catName); }}
                    >
                      {catName}
                    </button>
                  ))}
                </div>

                {/* Suggestions Box (under tabs, context specific) */}
                {CATEGORY_SUGGESTIONS[selectedCategory] && (
                  <div className="sign-keyboard__suggestions">
                    <h4 className="sign-keyboard__suggestions-title">💡 Smart Suggestions</h4>
                    <div className="sign-keyboard__suggestions-list">
                      {CATEGORY_SUGGESTIONS[selectedCategory].map((phrase, idx) => (
                        <button
                          key={idx}
                          className="sign-keyboard__sug-btn"
                          onClick={() => handleSuggestionClick(phrase)}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Grid of keys for selected category */}
                <div className="sign-keyboard__grid-container">
                  <div className="sign-keyboard__grid">
                    {KEYBOARD_CATEGORIES[selectedCategory]?.map((keyItem, index) => (
                      <button
                        key={index}
                        className="sign-keyboard__key"
                        onClick={() => handleKeyClick(keyItem)}
                        title={`Tap to type: ${keyItem.label}`}
                      >
                        <span className="sign-keyboard__key-icon">{keyItem.emoji}</span>
                        <span className="sign-keyboard__key-label">{keyItem.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}
    </>
  );
}
