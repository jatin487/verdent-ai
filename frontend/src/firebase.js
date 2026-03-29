import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyC88JJ8odYgdPO9Q0s7gbvX6IxIcjzCn0o",
  authDomain: "verdent-45e21.firebaseapp.com",
  projectId: "verdent-45e21",
  storageBucket: "verdent-45e21.firebasestorage.app",
  messagingSenderId: "639111507256",
  appId: "1:639111507256:web:98b2c4f4966382892625cd",
  measurementId: "G-E1B8JSMJJY"
};

// ✅ Prevent multiple Firebase instances
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);

// ✅ Handle offline persistence safely
if (typeof window !== "undefined") {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Multiple tabs open, persistence disabled");
    } else if (err.code === 'unimplemented') {
      console.warn("Browser doesn't support persistence");
    }
  });
}

// ✅ Analytics (safe init)
let analytics = null;
isSupported().then((yes) => {
  if (yes) {
    analytics = getAnalytics(app);
  }
}).catch(() => { });

export { auth, db, analytics };