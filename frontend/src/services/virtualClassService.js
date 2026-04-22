import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const IS_PROD = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
const DEFAULT_ROOM_ID = IS_PROD ? 'Verdent_Live_Session_Global' : 'VardaanInclusiveClassroom_101';

/**
 * Teacher starts (or re-activates) the class session.
 */
export const startClassSession = async (teacherId, roomId = DEFAULT_ROOM_ID) => {
  const sessionRef = doc(db, 'sessions', roomId);
  await setDoc(sessionRef, {
    teacherId,
    active: true,
    lastSign: null,
    lastSignEmoji: null,
    lastSignAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  }, { merge: true });
};

/**
 * Teacher ends the class session.
 */
export const endClassSession = async (roomId = DEFAULT_ROOM_ID) => {
  const sessionRef = doc(db, 'sessions', roomId);
  await updateDoc(sessionRef, {
    active: false,
    lastUpdated: serverTimestamp(),
  });
};

/**
 * Broadcast the sign and session data.
 */
export const broadcastSign = async (signData, roomId = DEFAULT_ROOM_ID) => {
  try {
    const sessionRef = doc(db, 'sessions', roomId);
    await updateDoc(sessionRef, {
      lastSign: signData, 
      lastSignAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      active: true
    });
  } catch (error) {
    console.error("Firebase broadcastSign failed:", error);
  }
};

/**
 * Subscribe to the class session in real-time (used by both teacher and student).
 */
export const subscribeToClassSession = (onUpdate, roomId = DEFAULT_ROOM_ID) => {
  const sessionRef = doc(db, 'sessions', roomId);
  return onSnapshot(sessionRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onUpdate({ active: false, lastSign: null });
    }
  });
};

/**
 * Student requests clarification for a sign.
 */
export const broadcastDoubt = async (studentName, signPhrase, roomId = DEFAULT_ROOM_ID) => {
  const sessionRef = doc(db, 'sessions', roomId);
  await updateDoc(sessionRef, {
    lastDoubt: {
      studentName,
      signPhrase,
      time: Date.now()
    },
    lastUpdated: serverTimestamp()
  });
};
