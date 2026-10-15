import * as THREE from 'three'

function spot(distance, angle, penumbra, x, y, z) {
  const light = new THREE.SpotLight('#ffffff', 0, distance, angle, penumbra, 2)
  light.position.set(x, y, z)
  return light
}

// These stay in the scene from the first frame at intensity 0. Turning them on
// later would change the light count and force every material to recompile.
export const padKey = spot(22, 0.38, 0.45, 0, 7.5, 3.2)
export const padRim = spot(18, 0.65, 0.7, 0, 0.4, 7)
export const padLeft = spot(16, 0.45, 0.8, -4, 3.2, 3)
export const padRight = spot(16, 0.5, 0.75, 4, 2.4, 3)
