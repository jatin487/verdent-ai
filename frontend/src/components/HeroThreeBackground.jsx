import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroThreeBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x050a14, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 2000);
    camera.position.set(0, 0, 110);

    function makeGlowTexture(r, g, b) {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(0.25, `rgba(${r},${g},${b},0.7)`);
      grad.addColorStop(0.6, `rgba(${r},${g},${b},0.15)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      return new THREE.CanvasTexture(canvas);
    }

    function makeAuroraPlane(colorHex, yPos, xOffset) {
      const geo = new THREE.PlaneGeometry(220, 90, 80, 30);
      const posArr = geo.attributes.position.array;
      const origY = new Float32Array(posArr.length / 3);
      for (let i = 0; i < posArr.length / 3; i++) origY[i] = posArr[i * 3 + 1];
      geo.userData.origY = origY;
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true, opacity: 0.075, side: THREE.DoubleSide,
        wireframe: false, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(xOffset, yPos, -60);
      mesh.rotation.x = -Math.PI / 6;
      scene.add(mesh);
      return mesh;
    }

    const aurora1 = makeAuroraPlane(0x00f2fe, 20, 0);
    const aurora2 = makeAuroraPlane(0x7c6af7, -10, 10);
    const aurora3 = makeAuroraPlane(0x34d399, 5, -10);

    const DUST = 1600;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(DUST * 3);
    const dustOrig = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      const r = 90 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      const z = r * Math.cos(phi);
      dustPos[i*3]=x; dustOrig[i*3]=x;
      dustPos[i*3+1]=y; dustOrig[i*3+1]=y;
      dustPos[i*3+2]=z; dustOrig[i*3+2]=z;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 2.4, map: makeGlowTexture(140, 200, 255),
      transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
      depthWrite: false, color: new THREE.Color(0x7bbfff), sizeAttenuation: true,
    });
    const dustCloud = new THREE.Points(dustGeo, dustMat);
    scene.add(dustCloud);

    const RING = 260;
    const ringGeo = new THREE.BufferGeometry();
    const ringPos = new Float32Array(RING * 3);
    for (let i = 0; i < RING; i++) {
      const ang = (i / RING) * Math.PI * 2;
      const r = 58 + (Math.random() - 0.5) * 6;
      ringPos[i*3] = Math.cos(ang) * r;
      ringPos[i*3+1] = Math.sin(ang) * r * 0.35;
      ringPos[i*3+2] = (Math.random() - 0.5) * 18;
    }
    ringGeo.setAttribute("position", new THREE.BufferAttribute(ringPos, 3));
    const ringMat = new THREE.PointsMaterial({
      size: 2.0, map: makeGlowTexture(200, 150, 255),
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending,
      depthWrite: false, color: new THREE.Color(0xb57bff), sizeAttenuation: true,
    });
    const ringMesh = new THREE.Points(ringGeo, ringMat);
    scene.add(ringMesh);

    function makeOrb(colorHex, x, y, z, sz) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex), transparent: true, opacity: 0.07,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(sz, 24, 24), mat);
      m.position.set(x, y, z);
      scene.add(m);
      return m;
    }
    const orb1 = makeOrb(0x00f2fe, -35, 15, -30, 28);
    const orb2 = makeOrb(0x7c6af7, 40, -10, -40, 22);
    const orb3 = makeOrb(0x34d399, 0, -25, -20, 18);

    let mouse = { x: 0, y: 0 };
    const onMouseMove = (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMouseMove);

    const clock = new THREE.Clock();
    let animId;

    function animateAurora(mesh, t, freq, amp) {
      const posAttr = mesh.geometry.attributes.position;
      const origY = mesh.geometry.userData.origY;
      const arr = posAttr.array;
      const total = arr.length / 3;
      for (let i = 0; i < total; i++) {
        const ox = arr[i * 3];
        arr[i * 3 + 1] = origY[i] + Math.sin(t * freq + ox * 0.05) * amp + Math.cos(t * 0.7 + i * 0.03) * (amp * 0.4);
      }
      posAttr.needsUpdate = true;
    }

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      animateAurora(aurora1, t, 0.4, 5);
      animateAurora(aurora2, t, 0.35, 4);
      animateAurora(aurora3, t, 0.5, 3.5);
      dustCloud.rotation.y = t * 0.018;
      dustCloud.rotation.x = t * 0.006;
      ringMesh.rotation.z = -t * 0.014;
      ringMesh.rotation.x = Math.sin(t * 0.25) * 0.18;
      orb1.scale.setScalar(Math.sin(t * 0.9) * 0.018 + 1);
      orb2.scale.setScalar(Math.sin(t * 0.7 + 1) * 0.018 + 1);
      orb3.scale.setScalar(Math.sin(t * 1.1 + 2) * 0.018 + 1);
      scene.rotation.y += (mouse.x * 0.06 - scene.rotation.y) * 0.04;
      scene.rotation.x += (mouse.y * 0.04 - scene.rotation.x) * 0.04;
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={mountRef} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }} />
  );
}
