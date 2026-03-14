import React, { useState, useEffect, useRef } from "react";

const LiveSpeechPanel = () => {
  const [transcript, setTranscript] = useState("");
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    startCamera();
  }, []);

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    videoRef.current.srcObject = stream;
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true; // real time updates
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let liveTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        liveTranscript += event.results[i][0].transcript;
      }

      setTranscript(liveTranscript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const speakText = () => {
    const speech = new SpeechSynthesisUtterance(transcript);
    window.speechSynthesis.speak(speech);
  };

  return (
    <div style={styles.container}>
      <h2>Live Speech Communication</h2>

      <div style={styles.panel}>
        {/* Video */}
        <div style={styles.videoBox}>
          <video ref={videoRef} autoPlay muted style={styles.video} />
        </div>

        {/* Live Text */}
        <div style={styles.textBox}>
          <h3>Live Subtitles</h3>
          <p style={styles.text}>{transcript || "Waiting for speech..."}</p>
        </div>
      </div>

      <div style={styles.buttons}>
        <button onClick={startListening}>🎤 Start Listening</button>
        <button onClick={speakText}>🔊 Speak</button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    marginTop: "50px",
    padding: "30px",
    background: "#f0f4f8",
    borderRadius: "12px",
  },

  panel: {
    display: "flex",
    gap: "30px",
    marginTop: "20px",
  },

  videoBox: {
    flex: 1,
  },

  textBox: {
    flex: 1,
    background: "white",
    padding: "20px",
    borderRadius: "10px",
    minHeight: "200px",
  },

  video: {
    width: "100%",
    borderRadius: "10px",
  },

  text: {
    fontSize: "22px",
    lineHeight: "1.6",
  },

  buttons: {
    marginTop: "20px",
    display: "flex",
    gap: "20px",
  },
};

export default LiveSpeechPanel;