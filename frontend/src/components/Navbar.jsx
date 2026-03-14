import { useState } from "react";
import { useA11y } from "../context/AccessibilityContext";
import "./Navbar.css";

const NAV_LINKS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "dashboard", label: "Courses", icon: "📚" },
  { id: "detector", label: "Sign Detector", icon: "🤝" },
];

export default function Navbar({ page, setPage }) {
  const { settings, toggleTts } = useA11y();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div>
      {menuOpen && (
        <div className="navbar__mobile-menu">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              className={`navbar__mobile-link ${page === link.id ? "active" : ""}`}
              onClick={() => {
                setPage(link.id);
                setMenuOpen(false);
              }}
            >
              {link.icon} {link.label}
            </button>
          ))}
          <button
            className="navbar__mobile-link"
            onClick={() => {
              toggleTts();
              setMenuOpen(false);
            }}
            aria-label={`Text-to-speech is ${settings.tts ? "on" : "off"}`}
          >
            <span aria-hidden="true">{settings.tts ? "🔊" : "🔇"}</span>
            <span>{settings.tts ? "TTS On" : "TTS Off"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
