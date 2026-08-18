import React, { useEffect, useRef } from "react";

/**
 * HandSkeletonOverlay
 * Luminous, glowing cybernetic hand-skeleton overlay.
 * Renders smoothed bone connections with energy pulses and glowing joint nodes
 * directly over the video canvas feed.
 */

// MediaPipe 21-hand landmark connections
const HAND_CONNECTIONS = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm base cross-links
  [5, 9], [9, 13], [13, 17]
];

const FINGERTIPS = [4, 8, 12, 16, 20];

export default function HandSkeletonOverlay({ landmarks, width = 640, height = 480, isMirrored = true }) {
  const canvasRef = useRef(null);
  const smoothedRef = useRef([]);
  const pulsePhaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      pulsePhaseRef.current += 0.04;
      const pulse = Math.sin(pulsePhaseRef.current);

      if (landmarks && landmarks.length >= 21) {
        // Temporal EMA smoothing for silky-smooth motion
        if (!smoothedRef.current || smoothedRef.current.length !== landmarks.length) {
          smoothedRef.current = landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z || 0 }));
        } else {
          const alpha = 0.45; // Smoothing factor
          for (let i = 0; i < landmarks.length; i++) {
            smoothedRef.current[i].x += (landmarks[i].x - smoothedRef.current[i].x) * alpha;
            smoothedRef.current[i].y += (landmarks[i].y - smoothedRef.current[i].y) * alpha;
            if (landmarks[i].z !== undefined) {
              smoothedRef.current[i].z += (landmarks[i].z - smoothedRef.current[i].z) * alpha;
            }
          }
        }

        const pts = smoothedRef.current.map(lm => {
          let x = lm.x * width;
          let y = lm.y * height;
          if (isMirrored) {
            x = width - x;
          }
          return { x, y, z: lm.z || 0 };
        });

        // 1. Draw Glowing Bone Lines
        HAND_CONNECTIONS.forEach(([startIdx, endIdx], connectionIdx) => {
          const p1 = pts[startIdx];
          const p2 = pts[endIdx];
          if (!p1 || !p2) return;

          // Depth-based color & energy calculation
          const avgZ = (p1.z + p2.z) / 2;
          const energyPulse = Math.sin(pulsePhaseRef.current * 2 + connectionIdx * 0.4) * 0.5 + 0.5;

          // Outer luminous glow line
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 242, 254, ${0.35 + energyPulse * 0.25})`;
          ctx.lineWidth = 7 + energyPulse * 3;
          ctx.lineCap = "round";
          ctx.shadowColor = "#00f2fe";
          ctx.shadowBlur = 16 + energyPulse * 8;
          ctx.stroke();

          // Inner crisp core line
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 + energyPulse * 0.15})`;
          ctx.lineWidth = 2.5;
          ctx.shadowBlur = 4;
          ctx.shadowColor = "#ffffff";
          ctx.stroke();
        });

        // 2. Draw Palm Hologram Core
        const wrist = pts[0];
        const midBase = pts[9];
        if (wrist && midBase) {
          const palmCenterX = (wrist.x + midBase.x) / 2;
          const palmCenterY = (wrist.y + midBase.y) / 2;
          const palmRadius = 14 + pulse * 3;

          ctx.beginPath();
          ctx.arc(palmCenterX, palmCenterY, palmRadius, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(168, 85, 247, 0.7)";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 12;
          ctx.stroke();

          // Inner rotating tick
          ctx.beginPath();
          const tickAngle = pulsePhaseRef.current * 1.5;
          ctx.arc(palmCenterX, palmCenterY, palmRadius * 0.6, tickAngle, tickAngle + Math.PI * 1.2);
          ctx.strokeStyle = "rgba(0, 245, 212, 0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // 3. Draw Luminous Joint Nodes
        pts.forEach((p, idx) => {
          const isTip = FINGERTIPS.includes(idx);
          const isWrist = idx === 0;

          const radius = isTip ? 6 + pulse * 2 : (isWrist ? 7 : 4);

          // Outer halo
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius + (isTip ? 6 : 3), 0, Math.PI * 2);
          ctx.fillStyle = isTip ? "rgba(0, 245, 212, 0.3)" : "rgba(0, 242, 254, 0.25)";
          ctx.shadowColor = isTip ? "#00f5d4" : "#00f2fe";
          ctx.shadowBlur = 12;
          ctx.fill();

          // Core node
          ctx.beginPath();
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = isTip ? "#ffffff" : "#cffafe";
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 6;
          ctx.fill();

          // Extra concentric ring on fingertips
          if (isTip) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius + 10 + pulse * 4, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(0, 245, 212, 0.4)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        });
      } else {
        // Fade out smoothed positions when hand disappears
        smoothedRef.current = [];
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [landmarks, width, height, isMirrored]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full object-cover"
    />
  );
}
