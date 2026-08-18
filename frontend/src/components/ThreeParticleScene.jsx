import React, { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * ThreeParticleScene
 * Ambient, reactive 3D particle constellation.
 * Particle colors, swirl velocity, and field vibrancy dynamically react
 * to sign language recognition events and confidence scores.
 */
export default function ThreeParticleScene({ confidence = 0.8, activityLevel = 0.5 }) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    targetHue: 0.55, // Cyan base
    currentHue: 0.55,
    targetSpeed: 0.0015,
    currentSpeed: 0.0015,
    activity: 0.5,
    reducedMotion: false,
  });

  // Update target dynamics based on props
  useEffect(() => {
    // Check user preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    stateRef.current.reducedMotion = mediaQuery.matches;

    // Shift hue: Cyan (0.55) -> Violet (0.75) -> Emerald (0.4) based on confidence
    if (confidence > 0.9) {
      stateRef.current.targetHue = 0.42; // Emerald success
    } else if (confidence > 0.75) {
      stateRef.current.targetHue = 0.55; // Vibrant Cyan
    } else {
      stateRef.current.targetHue = 0.76; // Electric Violet
    }

    stateRef.current.targetSpeed = 0.001 + (activityLevel * 0.0035);
    stateRef.current.activity = activityLevel;
  }, [confidence, activityLevel]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Particle System 1: Ambient Floating Cosmic Dust
    const particleCount = stateRef.current.reducedMotion ? 300 : 1200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const scales = new Float32Array(particleCount);
    const originalPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 200;
      const y = (Math.random() - 0.5) * 160;
      const z = (Math.random() - 0.5) * 120;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      originalPositions[i * 3] = x;
      originalPositions[i * 3 + 1] = y;
      originalPositions[i * 3 + 2] = z;

      scales[i] = Math.random() * 2.5 + 0.8;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));

    // Shader Material for smooth luminous round particles
    const particleTexture = createCircleTexture();
    const material = new THREE.PointsMaterial({
      size: 3.2,
      map: particleTexture,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color().setHSL(0.55, 0.9, 0.6),
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Particle System 2: Geometric Orbiting Ring Nodes
    const ringCount = 180;
    const ringGeo = new THREE.BufferGeometry();
    const ringPos = new Float32Array(ringCount * 3);
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      const r = 45 + (Math.random() - 0.5) * 8;
      ringPos[i * 3] = Math.cos(angle) * r;
      ringPos[i * 3 + 1] = Math.sin(angle) * r * 0.4;
      ringPos[i * 3 + 2] = (Math.random() - 0.5) * 25;
    }
    ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));

    const ringMat = new THREE.PointsMaterial({
      size: 2.2,
      map: particleTexture,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: new THREE.Color().setHSL(0.75, 0.85, 0.6),
    });
    const ringMesh = new THREE.Points(ringGeo, ringMat);
    scene.add(ringMesh);

    // Animation Loop
    let animationId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Smooth lerp hue & speed
      stateRef.current.currentHue += (stateRef.current.targetHue - stateRef.current.currentHue) * 0.05;
      stateRef.current.currentSpeed += (stateRef.current.targetSpeed - stateRef.current.currentSpeed) * 0.05;

      const currentHue = stateRef.current.currentHue;
      const speed = stateRef.current.reducedMotion ? 0.0003 : stateRef.current.currentSpeed;

      // Update particle material colors
      material.color.setHSL(currentHue, 0.9, 0.65);
      ringMat.color.setHSL((currentHue + 0.18) % 1.0, 0.85, 0.6);

      // Rotation & Gentle Wave Dynamics
      particles.rotation.y += speed * 0.8;
      particles.rotation.x += speed * 0.3;
      ringMesh.rotation.z -= speed * 1.2;
      ringMesh.rotation.x = Math.sin(time * 0.3) * 0.2;

      // Subtle vertex pulse when active
      if (!stateRef.current.reducedMotion) {
        const posAttr = geometry.attributes.position;
        for (let i = 0; i < particleCount; i += 8) {
          const idx = i * 3;
          posAttr.array[idx + 1] = originalPositions[idx + 1] + Math.sin(time * 1.5 + originalPositions[idx]) * 3;
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity: 0.85 }}
    />
  );
}

// Utility: Generate high-quality circular glow texture programmatically
function createCircleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
  gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
  gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.2)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
