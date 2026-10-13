import * as THREE from 'three'

let pending

function paint(job) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./consoleArt.worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = ({ data }) => {
      worker.terminate()
      resolve(data)
    }
    worker.onerror = (event) => {
      worker.terminate()
      reject(event.error ?? new Error(event.message))
    }
    worker.postMessage(job)
  })
}

function texture({ width, height, data }, colorSpace) {
  const map = new THREE.DataTexture(new Uint8Array(data.buffer), width, height)
  map.colorSpace = colorSpace
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.magFilter = THREE.LinearFilter
  map.generateMipmaps = true
  map.anisotropy = 8
  map.needsUpdate = true
  return map
}

/** Paints the backdrop and console skins off the main thread, once per page load. */
export function loadConsoleArt() {
  pending ??= Promise.all([paint('backdrop'), paint('skins')])
    .then(([{ backdrop }, { skins, vent }]) => ({
      backdrop: texture(backdrop, THREE.NoColorSpace),
      skins: Object.fromEntries(Object.entries(skins).map(([name, image]) => [name, texture(image, THREE.SRGBColorSpace)])),
      vent: texture(vent, THREE.SRGBColorSpace),
    }))
    .catch((error) => {
      pending = undefined
      throw error
    })
  return pending
}
