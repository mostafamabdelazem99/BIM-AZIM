// Real WebXR "Enter VR" button for the #arvr section. model-viewer (used for the AR half of
// this section) only drives handheld AR sessions (WebXR AR / Scene Viewer / Quick Look) — it has
// no immersive-vr mode — so headset VR needs its own minimal Three.js scene with
// renderer.xr enabled, loading the same sample .glb this page already ships.
import * as THREE from "three";
import { GLTFLoader } from "https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const vrBtn = document.getElementById("arvr-vr-btn");
const statusEl = document.getElementById("arvr-vr-status");
if (vrBtn && statusEl) {
  let renderer, scene, camera, loadPromise;

  function ensureScene() {
    if (loadPromise) return loadPromise;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x15181b);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 6, 2);
    scene.add(dir);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    Object.assign(renderer.domElement.style, {
      position: "fixed", top: "0", left: "0", zIndex: "9999", display: "none",
    });
    document.body.appendChild(renderer.domElement);
    renderer.setAnimationLoop(() => renderer.render(scene, camera));

    const loader = new GLTFLoader();
    loadPromise = loader.loadAsync("assets/sample-building.glb").then((gltf) => {
      // Model is ~12 units tall; scale/position it so a standing VR user sees it a few meters
      // ahead at roughly table/room scale rather than towering over them.
      gltf.scene.scale.setScalar(0.18);
      gltf.scene.position.set(0, -1.2, -4);
      scene.add(gltf.scene);
    });
    return loadPromise;
  }

  vrBtn.addEventListener("click", async () => {
    if (!("xr" in navigator)) {
      statusEl.textContent = "WebXR isn't available in this browser.";
      return;
    }
    try {
      const supported = await navigator.xr.isSessionSupported("immersive-vr");
      if (!supported) {
        statusEl.textContent = "No VR headset/runtime detected on this device.";
        return;
      }
      statusEl.textContent = "Loading model…";
      await ensureScene();

      statusEl.textContent = "Starting VR session…";
      const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor"],
      });
      session.addEventListener("end", () => {
        renderer.domElement.style.display = "none";
        statusEl.textContent = "VR session ended.";
      });
      renderer.domElement.style.display = "block";
      await renderer.xr.setSession(session);
      statusEl.textContent = "In VR — put on your headset.";
    } catch (err) {
      statusEl.textContent = `Couldn't start VR: ${err.message}`;
    }
  });
}
