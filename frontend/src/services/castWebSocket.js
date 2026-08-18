/**
 * C.A.S.T. Real-Time WebSocket & Global Bridge Client
 * Connects to the FastAPI backend WebSocket stream, throttles packets,
 * provides exponential backoff auto-reconnect, and binds to window.CAST.
 */

class CastWebSocketClient {
  constructor() {
    this.ws = null;
    this.url = this.getWebSocketUrl();
    this.status = "disconnected"; // "connected" | "connecting" | "disconnected" | "local_fallback"
    this.listeners = new Set();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 8000;
    this.reconnectTimeout = null;
    this.lastSendTime = 0;
    this.sendInterval = 1000 / 20; // 20 fps throttle
    this.isManualClose = false;

    // Attach to window.CAST API
    this.bindGlobalAPI();
  }

  getWebSocketUrl() {
    if (typeof window === "undefined") return "ws://localhost:8000/ws";
    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    // In dev / production, connect to port 8000 or same host
    if (loc.hostname === "localhost" || loc.hostname === "127.0.0.1") {
      return `${protocol}//127.0.0.1:8000/ws`;
    }
    return `${protocol}//${loc.host}/ws`;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback({ type: "status_change", status: this.status });
    return () => this.listeners.delete(callback);
  }

  notify(event) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error("[C.A.S.T WS Listener Error]", err);
      }
    });
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.notify({ type: "status_change", status: newStatus });
    }
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isManualClose = false;
    this.setStatus("connecting");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus("connected");
        this.notify({ type: "connected" });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data);

          // If recognition event received, dispatch to global listeners
          if (data.type === "recognition" && data.word) {
            if (window.CAST && typeof window.CAST.onRecognize === "function") {
              window.CAST.onRecognize(data.word, data.confidence);
            }
          }
        } catch (e) {
          console.warn("[C.A.S.T WS Message Parse]", e);
        }
      };

      this.ws.onclose = () => {
        this.ws = null;
        if (!this.isManualClose) {
          this.setStatus("disconnected");
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.setStatus("disconnected");
      };
    } catch (e) {
      this.setStatus("disconnected");
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  sendLandmarks(landmarks) {
    const now = performance.now();
    if (now - this.lastSendTime < this.sendInterval) {
      return false; // Throttled
    }
    this.lastSendTime = now;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "landmarks",
          landmarks: landmarks,
          timestamp: Date.now(),
        })
      );
      return true;
    }
    return false;
  }

  disconnect() {
    this.isManualClose = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("disconnected");
  }

  bindGlobalAPI() {
    if (typeof window === "undefined") return;

    window.CAST = {
      client: this,
      setLandmarks: (landmarks) => {
        this.sendLandmarks(landmarks);
        this.notify({ type: "local_landmarks", landmarks });
      },
      recognize: (word, confidence = 0.95) => {
        this.notify({
          type: "recognition",
          word,
          confidence,
          timestamp: Date.now(),
        });
      },
      speak: (text) => {
        if (window.CAST && window.CAST.tts) {
          window.CAST.tts.speak(text);
        }
      },
      onRecognize: null, // User configurable hook
    };
  }
}

export const castWS = new CastWebSocketClient();
