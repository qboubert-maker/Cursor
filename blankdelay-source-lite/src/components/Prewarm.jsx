import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { quality } from '../lib/quality'

const WARM_LAYER = 30

function isDrawable(object) {
  return Boolean(object.material) && (object.isMesh || object.isPoints || object.isLine || object.isSprite)
}

function materialsOf(object) {
  return Array.isArray(object.material) ? object.material : [object.material]
}

function toBatches(objects, maxItems) {
  const maxVertices = quality.mobile ? 40000 : 90000
  const batches = []
  let batch = []
  let vertices = 0
  objects.forEach((object) => {
    const count = object.geometry?.attributes?.position?.count ?? 0
    if (batch.length && (batch.length >= maxItems || vertices + count > maxVertices)) {
      batches.push(batch)
      batch = []
      vertices = 0
    }
    batch.push(object)
    vertices += count
  })
  if (batch.length) batches.push(batch)
  return batches
}

/** Lights the renderer counts right now; warm-up must use exactly these or it compiles the wrong shader variants. */
function countedLights(scene) {
  const lights = []
  scene.traverseVisible((object) => {
    if (object.isLight) lights.push(object)
  })
  return lights
}

function compileHidden(gl, scene, camera) {
  const counted = new Set(countedLights(scene))
  const changed = []
  scene.traverse((object) => {
    if (object.isLight) {
      if (!counted.has(object) && object.visible) {
        changed.push(object)
        object.visible = false
      }
    } else if (!object.visible) {
      changed.push(object)
      object.visible = true
    }
  })
  let pending
  try {
    pending = gl.compileAsync(scene, camera)
  } finally {
    changed.forEach((object) => {
      object.visible = !object.visible
    })
  }
  return pending
}

function warmBatch(gl, scene, camera, batch) {
  const lights = countedLights(scene)
  const shown = []
  const culled = []

  lights.forEach((light) => light.layers.enable(WARM_LAYER))
  batch.forEach((object) => {
    object.layers.enable(WARM_LAYER)
    if (object.frustumCulled) {
      culled.push(object)
      object.frustumCulled = false
    }
    for (let node = object; node; node = node.parent) {
      if (!node.visible) {
        shown.push(node)
        node.visible = true
      }
    }
  })

  const mask = camera.layers.mask
  const target = gl.getRenderTarget()
  camera.layers.set(WARM_LAYER)
  gl.setRenderTarget(null)
  gl.setScissorTest(true)
  gl.setScissor(0, 0, 1, 1)
  try {
    gl.render(scene, camera)
  } finally {
    gl.setScissorTest(false)
    gl.setRenderTarget(target)
    camera.layers.mask = mask
    shown.forEach((node) => {
      node.visible = false
    })
    culled.forEach((object) => {
      object.frustumCulled = true
    })
    batch.forEach((object) => object.layers.disable(WARM_LAYER))
    lights.forEach((light) => light.layers.disable(WARM_LAYER))
  }
}

/**
 * Compiles every shader and uploads every mesh / texture to the GPU in small
 * slices right after load, invisibly (into a 1px scissor). Without this the
 * browser does that work the first time each section appears, which froze the
 * page for seconds on nav clicks and fast scrolls.
 */
export default function Prewarm() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const queue = useRef(null)

  useEffect(() => {
    let cancelled = false
    let timer = 0
    let quietSince = 0
    const parallel = gl.extensions.has('KHR_parallel_shader_compile')

    const start = async () => {
      if (parallel) {
        await Promise.race([compileHidden(gl, scene, camera), new Promise((r) => setTimeout(r, 8000))]).catch(() => {})
      }
      if (cancelled) return
      const drawables = []
      scene.traverse((object) => {
        if (isDrawable(object)) drawables.push(object)
      })
      // Without parallel compile every new shader links synchronously, so take
      // fewer objects per frame to keep each hitch short.
      const maxItems = parallel ? (quality.mobile ? 6 : 12) : 2
      const batches = toBatches(drawables, maxItems)
      // While glass (transmission) is on screen, opaque objects are drawn a
      // second time with different shaders; warm those pairings as well.
      const glass = drawables.find((object) => materialsOf(object).some((m) => m.transmission > 0))
      if (glass) {
        const opaque = drawables.filter((object) => materialsOf(object).every((m) => !m.transparent && !(m.transmission > 0)))
        toBatches(opaque, maxItems).forEach((batch) => batches.push([glass, ...batch]))
      }
      queue.current = { batches, index: 0 }
    }

    const waitForAssets = () => {
      if (cancelled) return
      const now = performance.now()
      if (useProgress.getState().active) quietSince = 0
      else if (!quietSince) quietSince = now
      if (quietSince && now - quietSince > 500) start()
      else timer = setTimeout(waitForAssets, 200)
    }
    timer = setTimeout(waitForAssets, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [gl, scene, camera])

  useFrame(() => {
    const job = queue.current
    if (!job) return
    const batch = job.batches[job.index++].filter((object) => object.parent)
    if (batch.length) warmBatch(gl, scene, camera, batch)
    if (job.index >= job.batches.length) queue.current = null
  })

  return null
}
