"""
Verdent Backend – Flask REST API for Sign Language Prediction
=============================================================
Endpoints:
  GET  /health          → health check
  POST /predict         → { "landmarks": [...N floats...] } → { "label", "confidence" }
  POST /predict-image   → { "image": "<base64>" } → { "label", "confidence" }
"""

import os, json, base64, io
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow requests from React frontend on a different port

# ── Load model & labels at startup ─────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(BASE_DIR, "..", "ai", "model.h5")
LABELS_PATH = os.path.join(BASE_DIR, "..", "ai", "labels.json")

model  = None
labels = {}

def load_model():
    global model, labels
    try:
        import tensorflow as tf
        print(f"[INFO] Loading model from {MODEL_PATH} …")
        model = tf.keras.models.load_model(MODEL_PATH)
        print(f"[INFO] Model input shape: {model.input_shape}")
        with open(LABELS_PATH) as f:
            labels = json.load(f)
        print(f"[INFO] Labels loaded ({len(labels)} classes): {list(labels.values())[:5]} …")
        print("[INFO] ✅ Model ready!")
    except Exception as e:
        print(f"[WARN] Could not load model: {e}")
        print("[WARN] Prediction endpoint will return demo data until model is trained.")

load_model()

# ── Helper ──────────────────────────────────────────────────────────────────────
def predict_from_array(arr: np.ndarray):
    """Run inference on a numpy array. Returns (label, confidence)."""
    if model is None:
        # Demo fallback before model is trained
        idx = np.random.randint(0, 26)
        return chr(ord('A') + idx), float(np.random.uniform(0.5, 0.99))

    inp = arr.reshape(1, -1).astype(np.float32)
    preds = model.predict(inp, verbose=0)[0]
    idx   = int(np.argmax(preds))
    conf  = float(preds[idx])
    label = labels.get(str(idx), chr(ord('A') + idx))
    return label, conf

# ── Routes ───────────────────────────────────────────────────────────────────────
@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model is not None,
        "num_classes": len(labels),
    })

@app.route("/predict", methods=["POST"])
def predict():
    """
    Accepts JSON:  { "landmarks": [float, ...] }
    landmarks = 63 float values (21 MediaPipe hand landmarks × x, y, z)
    OR flat 784 pixel values for image-based model.
    Returns: { "label": "A", "confidence": 0.97 }
    """
    data = request.get_json(force=True)
    if not data or "landmarks" not in data:
        return jsonify({"error": "Missing 'landmarks' key"}), 400

    landmarks = data["landmarks"]
    arr = np.array(landmarks, dtype=np.float32)

    # If pixel-based model expects 784, pad/trim as needed
    if model is not None:
        expected = int(np.prod(model.input_shape[1:]))
        if len(arr) != expected:
            if len(arr) < expected:
                arr = np.pad(arr, (0, expected - len(arr)))
            else:
                arr = arr[:expected]

    label, conf = predict_from_array(arr)
    return jsonify({"label": label, "confidence": round(conf, 4)})

@app.route("/predict-image", methods=["POST"])
def predict_image():
    """
    Accepts JSON: { "image": "<base64-encoded-grayscale-28x28-png>" }
    Returns: { "label": "A", "confidence": 0.97 }
    """
    data = request.get_json(force=True)
    if not data or "image" not in data:
        return jsonify({"error": "Missing 'image' key"}), 400

    try:
        import cv2
        img_bytes = base64.b64decode(data["image"])
        np_arr    = np.frombuffer(img_bytes, np.uint8)
        img       = cv2.imdecode(np_arr, cv2.IMREAD_GRAYSCALE)
        img       = cv2.resize(img, (28, 28))
        arr       = img.flatten().astype(np.float32) / 255.0
    except Exception as e:
        return jsonify({"error": f"Image decode failed: {e}"}), 400

    label, conf = predict_from_array(arr)
    return jsonify({"label": label, "confidence": round(conf, 4)})

@app.route("/labels")
def get_labels():
    return jsonify(labels)

# ── Run ──────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n🚀 Verdent Backend starting on http://localhost:5001\n")
    app.run(host="0.0.0.0", port=5001, debug=False)
