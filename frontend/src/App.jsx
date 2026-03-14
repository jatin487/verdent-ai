import { useState } from "react";

import { A11yProvider } from "./context/AccessibilityContext";

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
};

export default function App() {
  const [page, setPage] = useState("home");

  const PageComponent = PAGE_COMPONENTS[page] || LandingPage;

  return (
    <A11yProvider>
      <Navbar page={page} setPage={setPage} />

      <PageComponent setPage={setPage} />

      <A11yWidget />

      <LiveSpeechPanel />
    </A11yProvider>
  );
}
