import { createContext, useContext, useState, useEffect } from 'react'

const A11yContext = createContext(null)

const DEFAULTS = {
  theme: 'dark',        // 'dark' | 'light' | 'high-contrast'
  font: 'default',      // 'default' | 'dyslexic'
  textSize: 'base',     // 'base' | 'large' | 'xlarge'
  tts: true,            // text-to-speech on/off
}

export function A11yProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('verdent_a11y') || '{}')
      return { ...DEFAULTS, ...saved }
    } catch { return DEFAULTS }
  })

  // Apply to <html> element whenever settings change
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme',     settings.theme)
    root.setAttribute('data-font',      settings.font)
    root.setAttribute('data-text-size', settings.textSize)
    localStorage.setItem('verdent_a11y', JSON.stringify(settings))
  }, [settings])

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }))

  return (
    <A11yContext.Provider value={{ settings, update }}>
      {children}
    </A11yContext.Provider>
  )
}

export const useA11y = () => useContext(A11yContext)

/**
 * A11yText — wraps any text element and reads it aloud on hover/focus
 * when TTS is enabled.
 */
export function A11yText({ as: Tag = 'span', children, className = '', ...props }) {
  const { settings } = useA11y()

  const speak = () => {
    if (!settings.tts || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const text = typeof children === 'string' ? children : ''
    if (!text.trim()) return
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate  = 0.95
    utt.pitch = 1
    window.speechSynthesis.speak(utt)
  }

  return (
    <Tag
      className={className}
      onMouseEnter={speak}
      onFocus={speak}
      tabIndex={props.tabIndex !== undefined ? props.tabIndex : 0}
      {...props}
    >
      {children}
    </Tag>
  )
}
