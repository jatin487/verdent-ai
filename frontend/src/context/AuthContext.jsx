import { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null); // 'student' | 'teacher'
  const [loading, setLoading] = useState(true);

  // MOCK fallback for when Firebase is not configured with real keys yet.
  // This allows the UI to work flawlessly until credentials are provided.
  const isMock = !auth || auth.app.options.apiKey === "YOUR_API_KEY";

  useEffect(() => {
    // 🚦 TIMEOUT FALLBACK: If Firebase hangs, allow the app to boot after 8s
    const timer = setTimeout(() => {
      if (loading) {
        console.warn("Firebase Auth timed out. Falling back to Guest mode.");
        setLoading(false);
      }
    }, 8000);

    if (isMock) {
      console.log("🔥 Running with Local Storage Mock Auth (Firebase not configured yet)");
      const storedLocal = localStorage.getItem('mock_user_cast');
      if (storedLocal) {
        const mockUser = JSON.parse(storedLocal);
        setCurrentUser(mockUser);
        setUserRole(mockUser.role || 'student');
      }
      setLoading(false);
      clearTimeout(timer);
      return;
    }

    // Real Firebase listener
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timer);
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().role) {
            setUserRole(docSnap.data().role);
          } else {
            setUserRole('student'); // Default fallback
          }
        } catch (e) {
          console.error("Firestore read error", e);
          setUserRole('student'); 
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [isMock]);

  const signup = async (email, password, role) => {
    if (isMock) {
      const mockUser = { uid: Date.now().toString(), email, role };
      localStorage.setItem('mock_user_cast', JSON.stringify(mockUser));
      setCurrentUser(mockUser);
      setUserRole(role);
      return;
    }
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Store role in Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email,
      role
    });
    setUserRole(role);
  };

  const login = async (email, password) => {
    if (isMock) {
      const storedLocal = localStorage.getItem('mock_user_cast');
      if (!storedLocal) {
        throw new Error("No user found. Please sign up first.");
      }
      const mockUser = JSON.parse(storedLocal);
      setCurrentUser(mockUser);
      setUserRole(mockUser.role || 'student');
      return;
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // Fetch role after login explicitly just to be safe
    const docRef = doc(db, 'users', userCredential.user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().role) {
       setUserRole(docSnap.data().role);
    } else {
       setUserRole('student'); // Default fallback
    }
  };

  const logout = async () => {
    if (isMock) {
      localStorage.removeItem('mock_user_cast');
      setCurrentUser(null);
      setUserRole(null);
      return;
    }
    await signOut(auth);
    setCurrentUser(null);
    setUserRole(null);
  };

  const value = {
    currentUser,
    userRole,
    login,
    signup,
    logout
  };

  // Prevent a blank screen by showing a loading status
   if (loading) {
      return (
        <div style={{
          height: '100vh', 
          backgroundColor: '#fff5e4', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>✨</div>
          <h2 style={{color: '#1e293b', margin: '0 0 10px 0', fontSize: '2rem'}}>Initializing Verdant</h2>
          <p style={{color: '#64748b', marginBottom: '20px', fontSize: '1.1rem'}}>Connecting to your Firebase project...</p>
          <div className="loader-spinner" style={{
            width: '40px', height: '40px', border: '4px solid #7c6af7', 
            borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite'
          }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          
          <button 
            onClick={() => setLoading(false)}
            style={{
               marginTop: '30px', padding: '10px 20px', background: '#7c6af7', 
               color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer'
            }}
          >
            Force Enter
          </button>
        </div>
      );
   }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
