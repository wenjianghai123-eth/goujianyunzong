'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box, LoaderCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ModelViewer({ url, label }: { url?: string; label: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const [error, setError] = useState('');

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef3f7');
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    camera.position.set(5, 4, 7);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 1;
    controls.maxDistance = 100;
    const ambient = new THREE.HemisphereLight(0xffffff, 0x59708c, 2.2);
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(6, 10, 7);
    scene.add(ambient, key);
    const grid = new THREE.GridHelper(24, 24, 0xa8b5c5, 0xd9e1e9);
    scene.add(grid);

    let currentObject: THREE.Object3D | null = null;
    const fit = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxSize = Math.max(size.x, size.y, size.z, 1);
      camera.position.copy(center).add(new THREE.Vector3(maxSize * 1.25, maxSize * 0.9, maxSize * 1.4));
      camera.near = Math.max(maxSize / 1000, 0.01);
      camera.far = maxSize * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(center);
      controls.update();
    };

    if (url) {
      new GLTFLoader().load(
        url,
        (gltf) => {
          currentObject = gltf.scene;
          scene.add(gltf.scene);
          fit(gltf.scene);
          setLoading(false);
        },
        undefined,
        () => {
          setError('模型加载失败，请检查 GLB 文件');
          setLoading(false);
        },
      );
    } else {
      const material = new THREE.MeshStandardMaterial({ color: '#315f9e', roughness: 0.58, metalness: 0.08 });
      const group = new THREE.Group();
      const column = new THREE.Mesh(new THREE.BoxGeometry(1.35, 4.4, 1.35), material);
      column.position.y = 2.2;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.35, 2.3), material);
      base.position.y = 0.18;
      group.add(column, base);
      currentObject = group;
      scene.add(group);
      fit(group);
      queueMicrotask(() => setLoading(false));
    }
    resetRef.current = () => currentObject && fit(currentObject);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url]);

  return (
    <div className="model-viewer" aria-label={`${label}三维模型`}>
      <div ref={hostRef} className="h-full min-h-[300px] w-full" />
      <div className="model-viewer-toolbar">
        <span><Box className="size-4" />{url ? 'GLB 模型' : '模型预览'}</span>
        <Button variant="secondary" size="icon-sm" aria-label="复位模型视角" onClick={() => resetRef.current?.()}><RotateCcw /></Button>
      </div>
      {loading && <div className="model-viewer-message"><LoaderCircle className="animate-spin" />正在加载模型…</div>}
      {error && <div className="model-viewer-message text-red-700">{error}</div>}
      {!url && !loading && <div className="model-placeholder-note">尚未上传 GLB，当前显示构件占位体</div>}
    </div>
  );
}
