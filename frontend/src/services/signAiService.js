/**
 * SignAiService.js - Client-Side AI Interpreter
 * Performs sign language prediction directly in the browser using 
 * geometric heuristics and (optional) lightweight TF.js models.
 */

import { GESTURE_DICTIONARY } from '../data/gestures';

/**
 * Predicts the sign from MediaPipe landmarks.
 * @param {Array} landmarks - 21 hand landmarks from MediaPipe
 * @returns {Object} { label, confidence, emoji, explanation }
 */
export const predictSignLocally = (landmarks) => {
  if (!landmarks || landmarks.length < 21) return null;

  // 1. Calculate basic finger states (Extended or Not)
  const palmSize = Math.hypot(landmarks[5].x - landmarks[17].x, landmarks[5].y - landmarks[17].y);
  
  // A finger is "extended" if its tip is further from the wrist than its PIP joint
  // and it's generally "above" the base joint (for vertical orientation)
  const isExtended = (tipIdx, pipIdx, baseIdx) => {
    // Basic vertical check
    const verticalExt = landmarks[tipIdx].y < landmarks[pipIdx].y;
    // Euclidean distance check to handle tilted hands
    const wrist = landmarks[0];
    const tipDist = Math.hypot(landmarks[tipIdx].x - wrist.x, landmarks[tipIdx].y - wrist.y);
    const pipDist = Math.hypot(landmarks[pipIdx].x - wrist.x, landmarks[pipIdx].y - wrist.y);
    return verticalExt || (tipDist > pipDist * 1.1);
  };

  const indexExt  = isExtended(8, 6, 5);
  const middleExt = isExtended(12, 10, 9);
  const ringExt   = isExtended(16, 14, 13);
  const pinkyExt  = isExtended(20, 18, 17);

  // 2. Calculate Thumb State
  const thumbTip = landmarks[4];
  const thumbBase = landmarks[2];
  const indexBase = landmarks[5];
  
  const thumbUp = thumbTip.y < thumbBase.y && thumbTip.y < indexBase.y - (palmSize * 0.2);
  const thumbDown = thumbTip.y > thumbBase.y + (palmSize * 0.2);
  const thumbOut = Math.abs(thumbTip.x - landmarks[9].x) > (palmSize * 0.7);

  let thState = "TUCKED";
  if (thumbUp) thState = "UP";
  else if (thumbDown) thState = "DOWN";
  else if (thumbOut) thState = "OUT";

  // 3. Generate Code and match against GESTURE_DICTIONARY
  const code = `${thState}-${indexExt ? '1' : '0'}${middleExt ? '1' : '0'}${ringExt ? '1' : '0'}${pinkyExt ? '1' : '0'}`;
  
  // Find match in primary dictionary
  let match = GESTURE_DICTIONARY.find(g => g.code === code);

  // 4. Handle Special Gestures (Distance-based)
  const thumbIndexDist = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
  const isOk = thumbIndexDist < (palmSize * 0.4) && middleExt && ringExt && pinkyExt && !indexExt;
  
  if (isOk) {
    match = { phrase: "Everything is OK", emoji: "👌", explanation: "Heuristic: Thumb and Index touching with other fingers extended." };
  }

  // 5. Alphabet Fallback (Heuristic Logic for A-Z)
  if (!match) {
    // Simple A-Z heuristics
    if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
       if (thState === "OUT") return { label: "A", confidence: 0.9, emoji: "✊", explanation: "AI identified 'A' (Fist with thumb out)" };
       return { label: "S", confidence: 0.8, emoji: "✊", explanation: "AI identified 'S' (Closed fist)" };
    }
    if (indexExt && middleExt && ringExt && pinkyExt && thState === "TUCKED") {
       return { label: "B", confidence: 0.9, emoji: "🤚", explanation: "AI identified 'B' (Flat hand)" };
    }
    if (indexExt && !middleExt && !ringExt && !pinkyExt) {
       if (thState === "OUT") return { label: "L", confidence: 0.9, emoji: "☝️", explanation: "AI identified 'L' (Index and Thumb extended)" };
       return { label: "D", confidence: 0.9, emoji: "☝️", explanation: "AI identified 'D' (Index pointing up)" };
    }
    if (indexExt && middleExt && !ringExt && !pinkyExt) {
       return { label: "V", confidence: 0.9, emoji: "✌️", explanation: "AI identified 'V' (Victory/Peace sign)" };
    }
    if (indexExt && middleExt && ringExt && !pinkyExt) {
       return { label: "W", confidence: 0.9, emoji: "🤟", explanation: "AI identified 'W' (Three fingers up)" };
    }
    if (!indexExt && !middleExt && !ringExt && pinkyExt && thState === "OUT") {
       return { label: "Y", confidence: 0.9, emoji: "🤙", explanation: "AI identified 'Y' (Pinky and Thumb out)" };
    }
    if (!indexExt && middleExt && ringExt && pinkyExt && thState === "TUCKED") {
       const thumbIndexDist = Math.hypot(landmarks[4].x - landmarks[8].x, landmarks[4].y - landmarks[8].y);
       if (thumbIndexDist < palmSize * 0.4) return { label: "F", confidence: 0.9, emoji: "👌", explanation: "AI identified 'F' (OK sign)" };
    }
  }

  if (match) {
    return {
      label: match.phrase,
      confidence: 0.95,
      emoji: match.emoji || "✨",
      explanation: match.explanation || `Matched sign pattern: ${code}`
    };
  }

  return null;
};
