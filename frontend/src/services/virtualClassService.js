import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const SESSION_ID = 'VardaanInclusiveClassroom_101';

/**
 * Teacher starts (or re-activates) the class session.
 */
export const startClassSession = async (teacherId) => {
  const sessionRef = doc(db, 'sessions', SESSION_ID);
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
export const endClassSession = async () => {
  const sessionRef = doc(db, 'sessions', SESSION_ID);
  await updateDoc(sessionRef, {
    active: false,
    lastUpdated: serverTimestamp(),
  });
};

/**
 * Broadcast the sign and session data.
 */
export const broadcastSign = async (signData) => {
  const sessionRef = doc(db, 'sessions', SESSION_ID);
  
  // Store the full complex object (phrase, sentence, voice, etc.) so students get the whole package.
  await updateDoc(sessionRef, {
    lastSign: signData, 
    lastSignAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    active: true
  });
};

/**
 * Subscribe to the class session in real-time (used by both teacher and student).
 */
export const subscribeToClassSession = (onUpdate) => {
  const sessionRef = doc(db, 'sessions', SESSION_ID);
  return onSnapshot(sessionRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate(docSnap.data());
    } else {
      onUpdate({ active: false, lastSign: null });
    }
  });
};
