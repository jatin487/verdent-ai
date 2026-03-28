import { useState } from "react";

import { A11yProvider, useA11y } from "./context/AccessibilityContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Navbar from "./components/Navbar";
import A11yWidget from "./components/A11yWidget";
import LiveSpeechPanel from "./components/LiveSpeechPanel";

import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import SignDetector from "./pages/SignDetector";
import AlphabetLearner from "./pages/AlphabetLearner";
import NumbersSignLanguage from "./pages/NumbersSignLanguage";
import SpeechTherapy from "./pages/SpeechTherapy";
import CreativeArts from "./pages/CreativeArts";
import CodingAccessibility from "./pages/CodingAccessibility";
import VideoTranscriber from "./pages/VideoTranscriber";

import RoleSelection from "./pages/RoleSelection";
import AuthPage from "./pages/AuthPage";
import TeacherDashboard from "./pages/TeacherDashboard";

const PAGE_COMPONENTS = {
  home: LandingPage,
  dashboard: Dashboard,
  signdetector: SignDetector,
  alphabet: AlphabetLearner,
  numbers: NumbersSignLanguage,
  speech: SpeechTherapy,
  arts: CreativeArts,
  coding: CodingAccessibility,
  transcriber: VideoTranscriber,
  teacherDashboard: TeacherDashboard,
};

function MainRouter() {
  const [page, setPage] = useState("home");
  const [selectedRoleForAuth, setSelectedRoleForAuth] = useState('student');
  const { currentUser, userRole } = useAuth();

  // Route guarding / Custom pages
  if (page === 'roleselect') {
     return (
       <RoleSelection onSelectRole={(role) => {
         setSelectedRoleForAuth(role);
         setPage('auth');
       }} />
     );
  }

  if (page === 'auth') {
    return (
      <AuthPage 
        role={selectedRoleForAuth} 
        onBack={() => setPage('roleselect')}
        onAuthSuccess={() => {
          // If login success, jump directly to dashboard
          if (selectedRoleForAuth === 'teacher' || userRole === 'teacher') {
            setPage('teacherDashboard');
          } else {
            setPage('dashboard');
          }
        }} 
      />
    );
  }

  // Determine standard component
  let PageComponent = PAGE_COMPONENTS[page] || LandingPage;

  // Render the default structure
  return (
    <>
      {page !== "home" && page !== "dashboard" && page !== "transcriber" && page !== "teacherDashboard" && page !== "alphabet" && page !== "signdetector" && <Navbar page={page} setPage={setPage} />}
      <PageComponent setPage={setPage} />
      <A11yWidget />
      <LiveSpeechPanel />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <A11yProvider>
        <MainRouter />
      </A11yProvider>
    </AuthProvider>
  );
}
