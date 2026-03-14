import { useState } from "react";
import { A11yText } from "../context/AccessibilityContext";
import "./Dashboard.css";

const COURSES = [
  {
    id: 1,
    emoji: "🤝",
    title: "ASL Alphabet Basics",
    category: "Sign Language",
    level: "Beginner",
    badgeCls: "badge-violet",
    progress: 72,
    lessons: 12,
    duration: "2h 30m",
    desc: "Learn all 26 American Sign Language alphabet letters with real AI-powered feedback.",
  },
  {
    id: 2,
    emoji: "🔢",
    title: "Numbers in Sign Language",
    category: "Sign Language",
    level: "Beginner",
    badgeCls: "badge-violet",
    progress: 45,
    lessons: 8,
    duration: "1h 45m",
    desc: "Master signing numbers 1–100 for everyday communication.",
  },
  {
    id: 3,
    emoji: "📖",
    title: "Braille Introduction",
    category: "Visually Impaired",
    level: "Beginner",
    badgeCls: "badge-sky",
    progress: 20,
    lessons: 10,
    duration: "3h 00m",
    desc: "Audio-first course teaching Braille reading through sound and tactile description.",
  },
  {
    id: 4,
    emoji: "🗣️",
    title: "Speech Therapy Exercises",
    category: "Communication",
    level: "Intermediate",
    badgeCls: "badge-green",
    progress: 89,
    lessons: 15,
    duration: "4h 15m",
    desc: "AI-guided exercises to improve pronunciation, fluency, and confidence.",
  },
  {
    id: 5,
    emoji: "🎨",
    title: "Creative Arts & Expression",
    category: "Arts",
    level: "All Levels",
    badgeCls: "badge-amber",
    progress: 35,
    lessons: 20,
    duration: "5h 00m",
    desc: "Fully accessible art course adapted for motor and sensory differences.",
  },
  {
    id: 6,
    emoji: "💻",
    title: "Coding with Accessibility",
    category: "Technology",
    level: "Intermediate",
    badgeCls: "badge-sky",
    progress: 58,
    lessons: 18,
    duration: "6h 30m",
    desc: "Build accessible web apps — learn coding and a11y principles side-by-side.",
  },
  {
    id: 7,
    emoji: "🎥",
    title: "Live Video Transcriber",
    category: "Accessible Tool",
    level: "All Levels",
    badgeCls: "badge-amber",
    progress: 0,
    lessons: 1,
    duration: "Live",
    desc: "Real-time subtitles for anything spoken into the camera.",
  },
  {
    id: 8,
    emoji: "🤟",
    title: "Sign Language Interpreter",
    category: "Accessible Tool",
    level: "All Levels",
    badgeCls: "badge-green",
    progress: 0,
    lessons: 1,
    duration: "Live",
    desc: "Use your camera to translate sign language gestures into real-time text and speech."
  }
];

const LEVELS = ["All", "Beginner", "Intermediate", "All Levels"];

const COURSE_PAGE_MAP = {
  1: "alphabet",
  2: "numbers",
  3: null,
  4: "speech",
  5: "arts",
  6: "coding",
  7: "transcriber",
  8: "signdetector",   // 👈 ADD THIS
};

export default function Dashboard({ setPage }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const visible = COURSES.filter((c) => {
    const matchLevel = filter === "All" || c.level === filter;
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const totalProgress = Math.round(
    COURSES.reduce((s, c) => s + c.progress, 0) / COURSES.length,
  );

  return (
    <main id="main-content" className="dashboard">
      <div className="container">
        {/* Header */}
        <div className="dashboard__header fade-in-up">
          <div>
            <A11yText as="h1" className="dashboard__title">
              Your Learning Journey
            </A11yText>
            <p className="dashboard__subtitle">
              {COURSES.length} courses · Overall progress:{" "}
              <strong className="gradient-text">{totalProgress}%</strong>
            </p>
          </div>
          <div className="dashboard__overall-progress glass-card">
            <div className="dashboard__ring">
              <svg
                viewBox="0 0 64 64"
                aria-label={`${totalProgress}% overall progress`}
              >
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="rgba(255,255,255,0.07)"
                  strokeWidth="6"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="url(#prog-grad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 26}`}
                  strokeDashoffset={`${2 * Math.PI * 26 * (1 - totalProgress / 100)}`}
                  transform="rotate(-90 32 32)"
                />
                <defs>
                  <linearGradient
                    id="prog-grad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop offset="0%" stopColor="#7c6af7" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="dashboard__ring-label">{totalProgress}%</span>
            </div>
            <span className="dashboard__ring-text">Overall</span>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="dashboard__controls fade-in-up delay-1">
          <div className="dashboard__search-wrap">
            <span aria-hidden="true">🔍</span>
            <input
              id="course-search"
              type="search"
              className="dashboard__search"
              placeholder="Search courses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search courses"
            />
          </div>
          <div
            className="dashboard__filters"
            role="group"
            aria-label="Filter by level"
          >
            {LEVELS.map((l) => (
              <button
                key={l}
                className={`btn btn-sm btn-ghost ${filter === l ? "active-filter" : ""}`}
                onClick={() => setFilter(l)}
                aria-pressed={filter === l}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Course Grid */}
        <div className="dashboard__grid" role="list" aria-label="Course list">
          {visible.length === 0 ? (
            <div className="dashboard__empty">
              <span>😕</span>
              <p>No courses match your search.</p>
            </div>
          ) : (
            visible.map((c, i) => (
              <article
                key={c.id}
                className={`course-card glass-card fade-in-up delay-${(i % 5) + 1}`}
                role="listitem"
                aria-labelledby={`course-title-${c.id}`}
              >
                <div className="course-card__top">
                  <span className="course-card__emoji animate-float">
                    {c.emoji}
                  </span>
                  <span className={`badge ${c.badgeCls}`}>{c.category}</span>
                </div>

                <A11yText
                  as="h2"
                  id={`course-title-${c.id}`}
                  className="course-card__title"
                >
                  {c.title}
                </A11yText>
                <p className="course-card__desc">{c.desc}</p>

                <div className="course-card__meta">
                  <span>📚 {c.lessons} lessons</span>
                  <span>⏱ {c.duration}</span>
                  <span
                    className={`badge ${c.level === "Beginner" ? "badge-green" : c.level === "Intermediate" ? "badge-amber" : "badge-sky"}`}
                  >
                    {c.level}
                  </span>
                </div>

                <div className="course-card__progress">
                  <div className="course-card__progress-label">
                    <span>Progress</span>
                    <span className="gradient-text">{c.progress}%</span>
                  </div>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuenow={c.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-bar__fill"
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  className={`btn course-card__btn ${COURSE_PAGE_MAP[c.id] ? "btn-primary" : "btn-ghost"}`}
                  id={`continue-course-${c.id}`}
                  onClick={() =>
                    COURSE_PAGE_MAP[c.id]
                      ? setPage(COURSE_PAGE_MAP[c.id])
                      : setPage("dashboard")
                  }
                  disabled={!COURSE_PAGE_MAP[c.id]}
                  title={!COURSE_PAGE_MAP[c.id] ? "Coming Soon" : undefined}
                >
                  {!COURSE_PAGE_MAP[c.id]
                    ? "🔜 Coming Soon"
                    : c.progress === 0
                      ? "▶ Start"
                      : c.progress === 100
                        ? "✓ Review"
                        : "▶ Continue"}
                </button>
              </article>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
