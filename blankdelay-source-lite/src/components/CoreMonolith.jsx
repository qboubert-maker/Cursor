import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CORE_POSITION, rig } from '../lib/rig'

const OUTER_RADIUS = 34
const INNER_RADIUS = 15
const FRAGMENT_COUNT = 3200

const hash = (n) => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return s - Math.floor(s)
}

function indexedSphere(radius, detail) {
  const geo = new THREE.IcosahedronGeometry(radius, detail)
  geo.deleteAttribute('normal')
  geo.deleteAttribute('uv')
  return mergeVertices(geo)
}

// Wireframe where every segment knows its own midpoint + seed, so it can shatter independently.
function createShatterLines(radius, detail, seedOffset) {
  const wire = new THREE.WireframeGeometry(indexedSphere(radius, detail))
  const pos = wire.attributes.position
  const mids = new Float32Array(pos.count * 3)
  const rands = new Float32Array(pos.count)
  for (let i = 0; i < pos.count; i += 2) {
    const mx = (pos.getX(i) + pos.getX(i + 1)) / 2
    const my = (pos.getY(i) + pos.getY(i + 1)) / 2
    const mz = (pos.getZ(i) + pos.getZ(i + 1)) / 2
    const r = hash(i * 0.5 + seedOffset)
    mids.set([mx, my, mz, mx, my, mz], i * 3)
    rands[i] = r
    rands[i + 1] = r
  }
  wire.setAttribute('aMid', new THREE.BufferAttribute(mids, 3))
  wire.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
  return wire
}

function createNodes(radius, detail) {
  const geo = indexedSphere(radius, detail)
  const nodes = new THREE.BufferGeometry()
  nodes.setAttribute('position', geo.attributes.position.clone())
  const rands = new Float32Array(geo.attributes.position.count)
  for (let i = 0; i < rands.length; i++) rands[i] = hash(i + 3.7)
  nodes.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
  geo.dispose()
  return nodes
}

function createFragments() {
  const dirs = new Float32Array(FRAGMENT_COUNT * 3)
  const rands = new Float32Array(FRAGMENT_COUNT)
  const v = new THREE.Vector3()
  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const u = hash(i * 1.31) * 2 - 1
    const theta = hash(i * 2.17 + 9.1) * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    v.set(s * Math.cos(theta), u, s * Math.sin(theta))
    dirs.set([v.x, v.y, v.z], i * 3)
    rands[i] = hash(i * 0.73 + 4.2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FRAGMENT_COUNT * 3), 3))
  geo.setAttribute('aDir', new THREE.BufferAttribute(dirs, 3))
  geo.setAttribute('aRand', new THREE.BufferAttribute(rands, 1))
  return geo
}

const sharedChunks = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  uniform float uShatter;
  uniform float uOpacity;
  uniform float uFog;
  uniform float uScatter;

  float revealMask(vec3 dir) {
    float sweep = 1.0 - (dir.y * 0.5 + 0.5);
    return smoothstep(sweep, sweep + 0.12, uReveal * 1.12);
  }

  float shatterK(float seed, float spread) {
    float k = clamp((uShatter - seed * spread) / (1.0 - spread), 0.0, 1.0);
    return k * k * (3.0 - 2.0 * k);
  }

  float fogFactor(float depth) {
    return exp(-pow(uFog * depth, 2.0));
  }
`

const lineVertex = /* glsl */ `
  attribute vec3 aMid;
  attribute float aRand;
  ${sharedChunks}
  varying float vAlpha;

  mat3 rotationMatrix(vec3 axis, float angle) {
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat3(
      oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s,
      oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s,
      oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c
    );
  }

  void main() {
    vec3 dir = normalize(aMid);
    float rv = revealMask(dir);
    float ek = shatterK(aRand, 0.35);
    vec3 axis = vec3(aRand - 0.5, fract(aRand * 7.31) - 0.5, fract(aRand * 3.17) - 0.5) + vec3(0.001);
    vec3 local = rotationMatrix(axis, ek * (2.0 + aRand * 7.0)) * (position - aMid);
    local *= mix(0.15, 1.0, rv);
    vec3 p = aMid + local + dir * ek * uScatter * (0.4 + aRand);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    vec3 nView = normalize(mat3(modelViewMatrix) * dir);
    float facing = nView.z * 0.5 + 0.5;
    float scan = smoothstep(0.08, 0.0, abs(dir.y - sin(uTime * 0.5) * 0.95));
    vAlpha = uOpacity * rv * (1.0 - ek) * (mix(0.12, 0.9, pow(facing, 1.5)) + scan * 0.9) * fogFactor(-mv.z);
  }
`

const lineFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(1.0), vAlpha);
    #include <colorspace_fragment>
  }
`

const nodeVertex = /* glsl */ `
  attribute float aRand;
  uniform float uPixelRatio;
  ${sharedChunks}
  varying float vAlpha;

  void main() {
    vec3 dir = normalize(position);
    float rv = revealMask(dir);
    float ek = shatterK(aRand, 0.35);
    vec3 p = position + dir * ek * uScatter * (0.5 + aRand);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    vec3 nView = normalize(mat3(modelViewMatrix) * dir);
    float facing = nView.z * 0.5 + 0.5;
    float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + aRand * 40.0);
    gl_PointSize = clamp((2.0 + 3.5 * facing) * uPixelRatio * (60.0 / max(depth, 1.0)), 0.0, 14.0 * uPixelRatio);
    vAlpha = uOpacity * rv * (1.0 - ek) * mix(0.15, 1.0, facing) * pulse * fogFactor(depth);
  }
`

const fragmentVertex = /* glsl */ `
  attribute vec3 aDir;
  attribute float aRand;
  uniform float uPixelRatio;
  uniform float uRadius;
  ${sharedChunks}
  varying float vAlpha;

  void main() {
    float k = clamp((uShatter - aRand * 0.2) / 0.8, 0.0, 1.0);
    float ek = 1.0 - pow(1.0 - k, 3.0);
    float r = uRadius * (0.86 + aRand * 0.24) + ek * (40.0 + aRand * 170.0);
    vec3 swirl = vec3(
      sin(uTime * 0.3 + aRand * 20.0),
      cos(uTime * 0.25 + aRand * 13.0),
      sin(uTime * 0.2 + aRand * 7.0)
    ) * (0.6 + ek * 9.0);
    vec3 p = aDir * r + swirl;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    gl_PointSize = clamp((1.2 + aRand * 2.2) * uPixelRatio * (70.0 / max(depth, 1.0)), 0.0, 8.0 * uPixelRatio);
    float twinkle = 0.5 + 0.5 * sin(uTime * (1.0 + aRand * 3.0) + aRand * 90.0);
    float alive = uReveal * 0.22 * (1.0 - ek) + sin(3.14159 * k) * 0.95;
    vAlpha = uOpacity * alive * (0.4 + 0.6 * twinkle) * fogFactor(depth);
  }
`

const pointFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(1.0), a);
    #include <colorspace_fragment>
  }
`

const glowVertex = /* glsl */ `
  uniform vec2 uSize;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mv.xy += position.xy * uSize;
    gl_Position = projectionMatrix * mv;
  }
`

const glowFragment = /* glsl */ `
  uniform float uMode;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float a = 0.0;
    if (uMode < 0.5) {
      a = pow(max(1.0 - r, 0.0), 2.6) * 0.65;
    } else if (uMode < 1.5) {
      a = pow(max(1.0 - r, 0.0), 6.0) * 1.6 + smoothstep(0.18, 0.0, r);
    } else if (uMode < 2.5) {
      a = exp(-abs(p.y) * 9.0) * pow(max(1.0 - abs(p.x), 0.0), 1.6) * 0.8;
    } else {
      float ang = atan(p.y, p.x);
      float rays = pow(abs(sin(ang * 6.0 + uTime * 0.05)), 18.0)
        + pow(abs(sin(ang * 11.0 - uTime * 0.03 + 1.3)), 30.0) * 0.7;
      a = rays * pow(max(1.0 - r, 0.0), 2.2) * 0.45;
    }
    a *= uIntensity;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vec3(1.0), a);
    #include <colorspace_fragment>
  }
`

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
}

const GLOW_LAYERS = [
  { mode: 0, size: [340, 340], gain: 1 },
  { mode: 3, size: [440, 440], gain: 0.9 },
  { mode: 2, size: [760, 16], gain: 0.9 },
  { mode: 1, size: [42, 42], gain: 1.2 },
]

// Per-layer intensity/size retained when the camera is right next to the core.
const GLOW_FALLOFF = {
  0: { intensity: 0.35, size: 0.45 },
  1: { intensity: 1, size: 1 },
  2: { intensity: 0.35, size: 0.5 },
  3: { intensity: 0.15, size: 0.4 },
}

const corePosition = new THREE.Vector3(...CORE_POSITION)

const lineUniforms = (scatter, opacity) => ({
  uTime: { value: 0 },
  uReveal: { value: 0 },
  uShatter: { value: 0 },
  uOpacity: { value: opacity },
  uFog: { value: rig.fog },
  uScatter: { value: scatter },
  uPixelRatio: { value: 1 },
  uRadius: { value: OUTER_RADIUS },
})

const createPointsAndLines = () => ({
  outerMat: new THREE.ShaderMaterial({ vertexShader: lineVertex, fragmentShader: lineFragment, uniforms: lineUniforms(120, 0.85), ...additive }),
  innerMat: new THREE.ShaderMaterial({ vertexShader: lineVertex, fragmentShader: lineFragment, uniforms: lineUniforms(70, 0.7), ...additive }),
  nodeMat: new THREE.ShaderMaterial({ vertexShader: nodeVertex, fragmentShader: pointFragment, uniforms: lineUniforms(130, 1), ...additive }),
  fragmentMat: new THREE.ShaderMaterial({ vertexShader: fragmentVertex, fragmentShader: pointFragment, uniforms: lineUniforms(0, 1), ...additive }),
})

export default function CoreMonolith() {
  const outerRef = useRef()
  const innerRef = useRef()
  const slabRef = useRef()
  const glowRefs = useRef([])

  const geometries = useMemo(
    () => ({
      outerLines: createShatterLines(OUTER_RADIUS, 3, 1.1),
      outerNodes: createNodes(OUTER_RADIUS, 3),
      innerLines: createShatterLines(INNER_RADIUS, 1, 7.3),
      fragments: createFragments(),
      slab: new THREE.BoxGeometry(6, 16, 1.6),
      slabEdges: new THREE.EdgesGeometry(new THREE.BoxGeometry(6.02, 16.02, 1.62)),
      glow: new THREE.PlaneGeometry(1, 1),
    }),
    [],
  )

  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])

  const materials = useMemo(() => createPointsAndLines(), [])
  const { outerMat, innerMat, nodeMat, fragmentMat } = materials
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])

  const glowMats = useMemo(
    () =>
      GLOW_LAYERS.map(
        (layer) =>
          new THREE.ShaderMaterial({
            vertexShader: glowVertex,
            fragmentShader: glowFragment,
            uniforms: {
              uMode: { value: layer.mode },
              uIntensity: { value: 1 },
              uTime: { value: 0 },
              uSize: { value: new THREE.Vector2(...layer.size) },
            },
            ...additive,
          }),
      ),
    [],
  )
  useEffect(() => () => glowMats.forEach((m) => m.dispose()), [glowMats])

  const slabMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#030303',
        roughness: 0.22,
        metalness: 0.65,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.4,
      }),
    [],
  )
  const slabEdgeMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  )
  useEffect(
    () => () => {
      slabMat.dispose()
      slabEdgeMat.dispose()
    },
    [slabMat, slabEdgeMat],
  )

  useFrame(({ camera, clock, gl }) => {
    const t = clock.elapsedTime
    const pr = gl.getPixelRatio()

    for (const m of [outerMat, innerMat, nodeMat, fragmentMat]) {
      const u = m.uniforms
      u.uTime.value = t
      u.uReveal.value = rig.reveal
      u.uShatter.value = rig.shatter
      u.uFog.value = rig.fog
      u.uPixelRatio.value = pr
    }
    fragmentMat.uniforms.uOpacity.value = 1 - rig.abyss * 0.6

    outerRef.current.rotation.set(0.28, t * 0.05, 0.12)
    innerRef.current.rotation.set(t * 0.07, -t * 0.12, 0.2)

    const collapse = THREE.MathUtils.smoothstep(rig.shatter, 0, 0.3)
    slabRef.current.rotation.set(0, t * 0.15, 0)
    slabRef.current.scale.set(1 + collapse * 0.6, Math.max(1 - collapse, 0.0001), 1)
    slabRef.current.visible = collapse < 0.999
    slabEdgeMat.opacity = 0.85 * rig.reveal * (1 - collapse) + collapse * (1 - collapse) * 3

    // Far away the core must pierce the cloud front; up close it must never drown the UI.
    const far = THREE.MathUtils.smoothstep(camera.position.distanceTo(corePosition), 110, 400)
    const light = rig.light * (1 + rig.flare * 1.2)
    const flareGrow = 1 + rig.flare * 0.35
    glowMats.forEach((m, i) => {
      const layer = GLOW_LAYERS[i]
      const { intensity, size } = GLOW_FALLOFF[layer.mode]
      m.uniforms.uTime.value = t
      m.uniforms.uIntensity.value = light * layer.gain * (intensity + (1 - intensity) * far)
      const scale = (size + (1 - size) * far) * flareGrow
      m.uniforms.uSize.value.set(layer.size[0] * scale, layer.size[1] * (layer.mode === 2 ? flareGrow : scale))
      glowRefs.current[i].visible = light > 0.002
    })
  })

  return (
    <group position={CORE_POSITION}>
      {GLOW_LAYERS.map((layer, i) => (
        <mesh
          key={layer.mode}
          ref={(el) => (glowRefs.current[i] = el)}
          geometry={geometries.glow}
          material={glowMats[i]}
          frustumCulled={false}
          renderOrder={-5}
        />
      ))}

      <group ref={outerRef}>
        <lineSegments geometry={geometries.outerLines} material={outerMat} frustumCulled={false} renderOrder={6} />
        <points geometry={geometries.outerNodes} material={nodeMat} frustumCulled={false} renderOrder={7} />
      </group>

      <group ref={innerRef}>
        <lineSegments geometry={geometries.innerLines} material={innerMat} frustumCulled={false} renderOrder={6} />
      </group>

      <group ref={slabRef}>
        <mesh geometry={geometries.slab} material={slabMat} />
        <lineSegments geometry={geometries.slabEdges} material={slabEdgeMat} renderOrder={8} />
      </group>

      <points geometry={geometries.fragments} material={fragmentMat} frustumCulled={false} renderOrder={7} />
    </group>
  )
}
