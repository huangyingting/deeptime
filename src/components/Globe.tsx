"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  asset,
  reconstruct,
  findPlate,
  plateRotation,
  type Coordinate,
  type Fossil,
  type Layers,
  type Plate,
  type Rotations,
} from "@/lib/earth";

type Props = {
  age: number;
  layers: Layers;
  iceLatitude: number;
  plates: Plate[];
  rotations: Rotations | null;
  fossils: Fossil[];
  pin: Coordinate | null;
  focus: Coordinate | null;
  onReady: () => void;
  onFossil: (fossil: Fossil | null, x: number, y: number) => void;
};

function vector(point: Coordinate, radius = 1): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(point.lat);
  const lon = THREE.MathUtils.degToRad(point.lon);
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  uniform sampler2D earthMap;
  uniform sampler2D cloudMap;
  uniform float age;
  uniform float ice;
  uniform float iceLatitude;
  uniform vec3 sunlight;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
      mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
  }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 view = normalize(cameraPosition - vPosition);
    vec3 color = texture2D(earthMap, vUv).rgb;
    float latitude = abs(vUv.y - 0.5) * 180.;
    float relief = noise(vUv * vec2(900.,450.)) * .13 + .92;
    if (age > 1.) color *= relief;
    if (age > 1100.) {
      float continent = noise(vUv * vec2(13.,8.)) * .6 + noise(vUv * vec2(25.,14.)) * .4;
      color = mix(vec3(.015,.07,.12), vec3(.24,.25,.18), smoothstep(.57,.61,continent));
      if (age > 4000.) {
        float lava = pow(noise(vUv * vec2(35.,20.)), 5.);
        color = vec3(.11,.055,.04) + vec3(1.,.22,.015) * lava * 3.;
      }
    }
    float frozen = smoothstep(iceLatitude - 2., iceLatitude + 2., latitude) * ice;
    color = mix(color, vec3(.78,.86,.89), frozen * .94);
    float cloud = texture2D(cloudMap, vUv).r * .48;
    if (age < 4000.) color = mix(color,vec3(.87,.9,.93),cloud);
    float day = max(dot(n,normalize(sunlight)),0.);
    color *= .2 + .75 * pow(day,.55);
    float ocean = step(color.g * .93, color.b);
    vec3 halfVector = normalize(normalize(sunlight) + view);
    float specular = pow(max(dot(n, halfVector),0.),85.) * .25 * ocean;
    color += vec3(specular);
    float atmosphere = pow(1. - max(dot(n,view),0.),3.);
    color = mix(color,vec3(.15,.32,.55),atmosphere * .62);
    gl_FragColor = vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function oldMap(
  age: number,
  plates: Plate[],
  rotations: Rotations,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0e2945";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const plate of plates) {
    if (age > (plate.begin ?? 4567) || age < (plate.end ?? 0)) continue;
    if (!plateRotation(plate.pid, age, rotations)) continue;
    for (const ring of plate.rings) {
      const points: number[][] = [];
      let previous = 0;
      for (const [lon, lat] of ring) {
        const point = reconstruct({ lat, lon }, plate.pid, age, rotations);
        if (!point) continue;
        let x = ((point.lon + 180) / 360) * 1024;
        if (points.length) {
          while (x - previous > 512) x -= 1024;
          while (x - previous < -512) x += 1024;
        }
        points.push([x, ((90 - point.lat) / 180) * 512]);
        previous = x;
      }
      for (const offset of [-1024, 0, 1024]) {
        ctx.beginPath();
        points.forEach(([x, y], i) =>
          i ? ctx.lineTo(x + offset, y) : ctx.moveTo(x + offset, y),
        );
        ctx.closePath();
        ctx.fillStyle = "#747955";
        ctx.strokeStyle = "#37808c";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fill();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function Globe(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    latest.current = props;
  }, [props]);

  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => {
        setFallback(true);
        latest.current.onReady();
      });
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x02030a, 0);
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive Earth globe. Drag to rotate; scroll to zoom.",
    );
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 150);
    const initial = vector({ lat: 18, lon: -27 });
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 12;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    const geometry = new THREE.SphereGeometry(1, 128, 96);
    const blank = new THREE.DataTexture(
      new Uint8Array([19, 47, 76, 255]),
      1,
      1,
    );
    blank.needsUpdate = true;
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        earthMap: { value: blank },
        cloudMap: { value: blank },
        age: { value: 0 },
        ice: { value: 1 },
        iceLatitude: { value: 70 },
        sunlight: { value: vector({ lat: 35, lon: -60 }) },
      },
    });
    scene.add(new THREE.Mesh(geometry, material));
    const atmosphere = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float rim = pow(1. - abs(dot(normalize(vNormal),normalize(cameraPosition-vPosition))), 4.);
          gl_FragColor = vec4(.19,.42,.88,rim*.48);
        }
      `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    atmosphere.scale.setScalar(1.018);
    scene.add(atmosphere);
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = [];
    let seed = 41;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 1600; i++) {
      const direction = new THREE.Vector3(
        random() - 0.5,
        random() - 0.5,
        random() - 0.5,
      )
        .normalize()
        .multiplyScalar(65);
      starPositions.push(direction.x, direction.y, direction.z);
    }
    starGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starPositions, 3),
    );
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({
          size: 0.055,
          color: "#b2b5c3",
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, 12, 12),
      new THREE.MeshBasicMaterial({ color: "#f6ca7b" }),
    );
    pin.visible = false;
    scene.add(pin);
    const pinHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.014, 0.019, 32),
      new THREE.MeshBasicMaterial({ color: "#f6ca7b", side: THREE.DoubleSide }),
    );
    pin.add(pinHalo);
    const fossilGeometry = new THREE.BufferGeometry();
    const fossilPoints = new THREE.Points(
      fossilGeometry,
      new THREE.PointsMaterial({
        color: "#f4bf72",
        size: 0.014,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
      }),
    );
    scene.add(fossilPoints);
    let visibleFossils: Fossil[] = [];
    const ghost = new THREE.Group();
    scene.add(ghost);
    let disposed = false;
    fetch(asset("/data/coastlines.geojson"))
      .then((response) => response.json())
      .then((data) => {
        if (disposed) return;
        const points: number[] = [];
        for (const feature of data.features) {
          const rings =
            feature.geometry.type === "LineString"
              ? [feature.geometry.coordinates]
              : feature.geometry.coordinates;
          for (const ring of rings) {
            for (let i = 1; i < ring.length; i++) {
              for (const coordinate of [ring[i - 1], ring[i]]) {
                const v = vector(
                  { lon: coordinate[0], lat: coordinate[1] },
                  1.006,
                );
                points.push(v.x, v.y, v.z);
              }
            }
          }
        }
        const lines = new THREE.BufferGeometry();
        lines.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(points, 3),
        );
        ghost.add(
          new THREE.LineSegments(
            lines,
            new THREE.LineBasicMaterial({
              color: "#f0d08a",
              transparent: true,
              opacity: 0.55,
            }),
          ),
        );
      })
      .catch(() => {});
    const textureLoader = new THREE.TextureLoader();
    const cloudTexture = textureLoader.load(
      asset("/assets/clouds.jpg"),
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        material.uniforms.cloudMap.value = texture;
      },
    );
    const textures = new Map<string, THREE.Texture>();
    let activeKey = "",
      pendingKey = "",
      oldKey = "";
    let oldTexture: THREE.Texture | null = null;
    let assetsVersion = "",
      lastFocus: Coordinate | null = null;
    let targetDirection: THREE.Vector3 | null = null;
    function loadTexture(key: string) {
      if (pendingKey === key || activeKey === key) return;
      if (textures.has(key)) {
        material.uniforms.earthMap.value = textures.get(key);
        activeKey = key;
        return;
      }
      pendingKey = key;
      textureLoader.load(
        asset(key),
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          textures.set(key, texture);
          if (pendingKey === key) {
            material.uniforms.earthMap.value = texture;
            activeKey = key;
            pendingKey = "";
          }
          if (textures.size > 12) {
            const oldest = [...textures.keys()].find(
              (entry) => entry !== key && entry !== "/assets/earth.jpg",
            );
            if (oldest) {
              textures.get(oldest)?.dispose();
              textures.delete(oldest);
            }
          }
          latest.current.onReady();
        },
        undefined,
        () => {
          if (!disposed) {
            pendingKey = "";
            latest.current.onReady();
          }
        },
      );
    }
    const resize = () => {
      const width = container.clientWidth,
        height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      camera.position.copy(
        initial.clone().multiplyScalar(Math.max(3.4, 3.2 / camera.aspect)),
      );
      renderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points!.threshold = 0.025;
    const onMove = (event: PointerEvent) => {
      if (!latest.current.layers.fossils || event.buttons) return;
      const rect = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const intersection = raycaster.intersectObject(fossilPoints)[0];
      let fossil: Fossil | null = null;
      if (
        intersection &&
        intersection.point
          .clone()
          .normalize()
          .dot(camera.position.clone().normalize()) > 0
      ) {
        fossil = visibleFossils[intersection.index ?? 0] || null;
      }
      latest.current.onFossil(fossil, event.clientX, event.clientY);
    };
    const onLeave = () => latest.current.onFossil(null, 0, 0);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    const onControl = () => {
      targetDirection = null;
    };
    controls.addEventListener("start", onControl);
    let frame = 0;
    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      const current = latest.current;
      material.uniforms.age.value = current.age;
      material.uniforms.ice.value = current.layers.ice ? 1 : 0;
      material.uniforms.iceLatitude.value = current.iceLatitude;
      ghost.visible = current.layers.coastlines;
      const mapAge = Math.min(540, Math.round(current.age / 5) * 5);
      if (current.age <= 540) {
        loadTexture(
          current.age < 0.01 ? "/assets/earth.jpg" : `/data/maps/${mapAge}.png`,
        );
        oldKey = "";
      } else if (
        current.age <= 1100 &&
        current.rotations &&
        current.plates.length
      ) {
        const key = String(Math.round(current.age / 10) * 10);
        if (oldKey !== key) {
          const texture = oldMap(
            Number(key),
            current.plates,
            current.rotations,
          );
          oldTexture?.dispose();
          cloudTexture.dispose();
          oldTexture = texture;
          material.uniforms.earthMap.value = texture;
          oldKey = key;
          activeKey = "";
          pendingKey = "";
        }
      }
      const version = `${Math.round(current.age)}:${current.layers.fossils}:${current.fossils.length}:${current.plates.length}`;
      if (version !== assetsVersion) {
        assetsVersion = version;
        const positions: number[] = [];
        visibleFossils = [];
        if (current.layers.fossils && current.rotations && current.age <= 540) {
          for (const fossil of current.fossils) {
            if (current.age < fossil.min || current.age > fossil.max) continue;
            const point = reconstruct(
              fossil,
              findPlate(fossil, current.plates),
              current.age,
              current.rotations,
            );
            if (!point) continue;
            const v = vector(point, 1.012);
            positions.push(v.x, v.y, v.z);
            visibleFossils.push(fossil);
          }
        }
        fossilGeometry.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(positions, 3),
        );
        fossilGeometry.computeBoundingSphere();
      }
      pin.visible = current.pin !== null;
      if (current.pin) {
        pin.position.copy(vector(current.pin, 1.018));
        pinHalo.lookAt(camera.position);
      }
      if (current.focus && current.focus !== lastFocus) {
        lastFocus = current.focus;
        targetDirection = vector(current.focus);
      }
      if (targetDirection) {
        camera.position.lerp(
          targetDirection.clone().multiplyScalar(camera.position.length()),
          0.06,
        );
        if (
          camera.position.clone().normalize().distanceTo(targetDirection) <
          0.001
        )
          targetDirection = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loadTexture("/assets/earth.jpg");
    animate();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.LineSegments
        ) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((value: THREE.Material) => value.dispose());
        }
      });
      textures.forEach((texture) => texture.dispose());
      oldTexture?.dispose();
      blank.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, []);

  return (
    <div ref={host} className="globe-stage" data-testid="globe">
      {fallback && (
        <div
          className="fallback-earth"
          style={{ backgroundImage: `url("${asset("/assets/earth.jpg")}")` }}
          role="img"
          aria-label="Earth image. WebGL is unavailable."
        />
      )}
      {fallback && (
        <p className="fallback-note">
          3D is unavailable in this browser. The timeline and chapters still
          work.
        </p>
      )}
    </div>
  );
}
