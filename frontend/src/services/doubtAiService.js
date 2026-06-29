/**
 * doubtAiService.js
 * AI Doubt Assistant Brain
 * Handles simplified explanations and procedural sign language avatar animation landmarks.
 */

import { GESTURE_DICTIONARY } from '../data/gestures';

// Simplified explanations for common doubts
export const DOUBT_DICTIONARY = {
  gravity: "Gravity is like an invisible magnetic pull from the Earth! It keeps your feet on the ground, makes apples fall from trees, and stops us from floating off into outer space.",
  gravitation: "Gravitation is the universal pulling force that pulls all objects toward each other. The bigger the object (like the Earth or Sun), the stronger its pull!",
  photosynthesis: "Photosynthesis is how plants cook their own food! They use sunlight, water from the dirt, and air to make sweet energy to grow, and in return, they release fresh oxygen for us to breathe.",
  loop: "A loop in coding is like doing a repeat timer! It tells the computer to run the same code instructions over and over again until a rule stops it. This saves you from writing the same code 100 times.",
  variable: "A variable is like a labeled storage box in a computer's memory. You can put things inside it (like your name or high score), change them whenever you want, and look inside it later.",
  friction: "Friction is the rubbing force that slows things down when they slide against each other. It helps your shoes grip the floor so you don't slip, and it lets car brakes stop the wheels!",
  fraction: "A fraction is like sharing a pizza! The bottom number (denominator) shows how many slices the whole pizza is cut into, and the top number (numerator) is how many slices you get.",
  evaporation: "Evaporation is liquid water getting warm and turning into invisible gas (water vapor). It rises up into the sky to create fluffy clouds!",
  html: "HTML is the skeleton of a website! It stands for HyperText Markup Language, and it sets up all the buttons, images, and text boxes on a page.",
  css: "CSS is like dressing up a website in cool clothes! It adds colors, fonts, layouts, and animations to make the bare skeleton (HTML) look beautiful.",
  javascript: "JavaScript is the brain of a website! It makes buttons clickable, starts games, triggers animations, and lets users interact with a webpage.",
  force: "A force is a push or a pull on something! It can make things start moving, speed up, slow down, stop, or change direction.",
  atom: "An atom is like a tiny Lego brick that builds everything in the universe! Everything you see - water, air, toys, and even you - is made of billions of these tiny atoms.",
  energy: "Energy is the power to do work and make things move! It comes in many forms, like heat from a fire, light from the sun, or electricity powering your computer."
};

/**
 * Gets a simplified explanation for a user query.
 */
export const getSimplifiedExplanation = (query) => {
  if (!query) return "I'm ready! Please ask me a doubt in Text, Voice, or Sign Language.";
  
  const clean = query.toLowerCase().trim().replace(/[?.,!]/g, "");
  
  // Direct match
  if (DOUBT_DICTIONARY[clean]) {
    return DOUBT_DICTIONARY[clean];
  }
  
  // Keyword check
  for (const [key, val] of Object.entries(DOUBT_DICTIONARY)) {
    if (clean.includes(key)) {
      return val;
    }
  }

  // Generative fallback
  const fallbacks = [
    `That is a wonderful question! Think of "${query}" as a helpful concept. Let's break it down: it is basically a way of describing how things work together step-by-step. Let me know if you want me to explain it using simple terms!`,
    `A great doubt! In simple words, "${query}" is like a system where different parts work together. Just like gears in a clock, when one moves, it helps the other parts work.`,
    `Wow, learning about "${query}" is fun! Imagine it like a game of blocks. You stack pieces together to form a structure. Each block plays a specific role to keep the tower standing.`
  ];
  
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
};

/**
 * Procedurally generates 21 hand landmarks based on finger extension states.
 * This is used to render the Sign Language Avatar hand skeleton.
 * 
 * code = "THUMB-INDEX_MIDDLE_RING_PINKY" e.g., "TUCKED-1000" (D)
 */
export const getLandmarksForCode = (code) => {
  const parts = code.split("-");
  const thState = parts[0] || "TUCKED";
  const fingers = parts[1] || "0000";
  
  const indexExt = fingers[0] === '1';
  const middleExt = fingers[1] === '1';
  const ringExt = fingers[2] === '1';
  const pinkyExt = fingers[3] === '1';

  const landmarks = Array(21).fill(0).map(() => ({ x: 0.5, y: 0.8, z: 0 }));

  // 1. Wrist
  landmarks[0] = { x: 0.5, y: 0.85, z: 0 };

  // Knuckle bases
  const bases = {
    thumb: { x: 0.42, y: 0.75 },
    index: { x: 0.46, y: 0.65 },
    middle: { x: 0.5, y: 0.64 },
    ring: { x: 0.54, y: 0.65 },
    pinky: { x: 0.58, y: 0.67 }
  };

  // 2. Thumb
  landmarks[1] = { x: bases.thumb.x, y: bases.thumb.y, z: 0 };
  if (thState === "UP") {
    landmarks[2] = { x: bases.thumb.x - 0.02, y: bases.thumb.y - 0.06, z: -0.02 };
    landmarks[3] = { x: bases.thumb.x - 0.04, y: bases.thumb.y - 0.12, z: -0.04 };
    landmarks[4] = { x: bases.thumb.x - 0.06, y: bases.thumb.y - 0.18, z: -0.05 };
  } else if (thState === "DOWN") {
    landmarks[2] = { x: bases.thumb.x - 0.02, y: bases.thumb.y + 0.05, z: 0.02 };
    landmarks[3] = { x: bases.thumb.x - 0.04, y: bases.thumb.y + 0.09, z: 0.03 };
    landmarks[4] = { x: bases.thumb.x - 0.05, y: bases.thumb.y + 0.13, z: 0.04 };
  } else if (thState === "OUT") {
    landmarks[2] = { x: bases.thumb.x - 0.05, y: bases.thumb.y, z: -0.02 };
    landmarks[3] = { x: bases.thumb.x - 0.10, y: bases.thumb.y - 0.01, z: -0.03 };
    landmarks[4] = { x: bases.thumb.x - 0.15, y: bases.thumb.y - 0.02, z: -0.04 };
  } else { // TUCKED
    landmarks[2] = { x: bases.thumb.x + 0.03, y: bases.thumb.y, z: 0.02 };
    landmarks[3] = { x: bases.thumb.x + 0.06, y: bases.thumb.y - 0.01, z: 0.03 };
    landmarks[4] = { x: bases.thumb.x + 0.09, y: bases.thumb.y - 0.02, z: 0.04 };
  }

  // 3. Fingers procedural calculation helper
  const computeFinger = (startIdx, base, isExt, spreadX) => {
    landmarks[startIdx] = { x: base.x, y: base.y, z: 0 };
    if (isExt) {
      landmarks[startIdx + 1] = { x: base.x + spreadX * 0.3, y: base.y - 0.08, z: -0.02 };
      landmarks[startIdx + 2] = { x: base.x + spreadX * 0.6, y: base.y - 0.15, z: -0.04 };
      landmarks[startIdx + 3] = { x: base.x + spreadX * 0.9, y: base.y - 0.22, z: -0.06 };
    } else { // curled
      landmarks[startIdx + 1] = { x: base.x + 0.01, y: base.y + 0.05, z: 0.03 };
      landmarks[startIdx + 2] = { x: base.x + 0.02, y: base.y + 0.09, z: 0.05 };
      landmarks[startIdx + 3] = { x: base.x + 0.02, y: base.y + 0.12, z: 0.06 };
    }
  };

  computeFinger(5, bases.index, indexExt, -0.03);
  computeFinger(9, bases.middle, middleExt, 0);
  computeFinger(13, bases.ring, ringExt, 0.03);
  computeFinger(17, bases.pinky, pinkyExt, 0.06);

  return landmarks;
};

/**
 * Translates a character into a matching hand landmark configuration.
 */
export const getLandmarksForLetter = (letter) => {
  const upper = letter.toUpperCase();
  
  const letterCodes = {
    A: "OUT-0000",
    B: "TUCKED-1111",
    C: "TUCKED-0000", // Will be rendered with semi-curled fingers in Canvas
    D: "TUCKED-1000",
    E: "TUCKED-0000",
    F: "TUCKED-0111",
    L: "OUT-1000",
    S: "TUCKED-0000",
    V: "TUCKED-1100",
    W: "TUCKED-1110",
    Y: "OUT-0001"
  };

  const code = letterCodes[upper] || "TUCKED-1111"; // default to open hand
  let lms = getLandmarksForCode(code);

  // Apply special curves for C shape
  if (upper === 'C') {
    lms = lms.map((lm, idx) => {
      if (idx >= 5) {
        // Curve fingers to the left and slightly down
        return {
          x: lm.x - 0.05,
          y: lm.y + (idx % 4) * 0.02,
          z: lm.z
        };
      }
      return lm;
    });
  }
  
  return lms;
};
