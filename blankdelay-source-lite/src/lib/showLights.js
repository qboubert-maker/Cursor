import * as THREE from 'three'

// One pair of spots shared by the Zero Delay, Premium Utility and Games scenes,
// which are never on screen at the same time. They stay in the scene at
// intensity 0 (reset every frame by Atmosphere) so the light count never
// changes; adding or removing lights would recompile every material mid-scroll.
export const showKey = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 3, 0, 2)
export const showFill = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 3, 0, 2)

export function resetShowLights() {
  showKey.intensity = 0
  showFill.intensity = 0
}

export function aimShowLight(light, { position, angle, penumbra, distance, intensity }) {
  light.position.set(position[0], position[1], position[2])
  light.angle = angle
  light.penumbra = penumbra
  light.distance = distance
  light.intensity = intensity
}
