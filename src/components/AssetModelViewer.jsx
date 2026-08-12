import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const MODEL_URL = `${import.meta.env.BASE_URL}tinker.obj`;
/** Neutral white so the model is not read as a data/status color. */
const MODEL_COLOR = 0xf4f4f5;
const TARGET_SIZE = 2.2;

function fitObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = TARGET_SIZE / maxDim;
  object.scale.setScalar(scale);
  object.position.copy(center).multiplyScalar(-scale);
}

function applyMaterial(object) {
  const material = new THREE.MeshStandardMaterial({
    color: MODEL_COLOR,
    metalness: 0.08,
    roughness: 0.72,
  });
  object.traverse((child) => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => m?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
    child.material = material;
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

export default function AssetModelViewer() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    let disposed = false;
    let frameId = 0;
    let model = null;
    let sharedMaterial = null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8eaed);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(3.2, 2.1, 3.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    const key = new THREE.DirectionalLight(0xffffff, 1.05);
    key.position.set(4, 8, 5);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-4, 2, -3);
    scene.add(ambient, key, fill);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = false;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    const setSize = () => {
      const { clientWidth: width, clientHeight: height } = mount;
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    setSize();

    const resizeObserver = new ResizeObserver(setSize);
    resizeObserver.observe(mount);

    const loader = new OBJLoader();
    loader.load(
      MODEL_URL,
      (object) => {
        if (disposed) {
          object.traverse((child) => {
            if (child.isMesh) child.geometry?.dispose?.();
          });
          return;
        }
        applyMaterial(object);
        object.traverse((child) => {
          if (child.isMesh && child.material) sharedMaterial = child.material;
        });
        object.rotation.x = -Math.PI / 2;
        object.updateMatrixWorld(true);
        fitObject(object);
        model = object;
        scene.add(object);
      },
      undefined,
      (err) => {
        console.error('Failed to load asset model', err);
      }
    );

    const onWheel = (e) => e.stopPropagation();
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('wheel', onWheel);
      controls.dispose();
      if (model) {
        scene.remove(model);
        model.traverse((child) => {
          if (child.isMesh) child.geometry?.dispose?.();
        });
      }
      sharedMaterial?.dispose?.();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="asset-model-viewer"
      role="img"
      aria-label="3D building model preview"
    />
  );
}
