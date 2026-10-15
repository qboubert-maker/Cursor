import * as THREE from 'three'

// Units are decimetres. Case-local axes: -X is the glass side, +X the solid side,
// +Y up and +Z the front glass that carries the logo.
export const CASE = { w: 2.4, h: 4.8, d: 4.6 }
export const HALF = { x: CASE.w / 2, y: CASE.h / 2, z: CASE.d / 2 }

export const BOARD = { x: 0.9, y: 0.32, z: -0.6, height: 3.05, width: 2.44, thickness: 0.035 }
export const BOARD_FACE = BOARD.x - BOARD.thickness / 2

export const CPU = { y: 1.0, z: -0.72 }
export const PUMP = { radius: 0.3, height: 0.44 }

export const RAM = { slots: [-0.08, 0.025, 0.13, 0.235], y: 1.0, length: 1.33, height: 0.44, thickness: 0.07 }

export const GPU = { x: 0.19, y: -0.43, z: -0.63, depth: 1.36, thickness: 0.6, length: 3.1 }

export const SHROUD = { top: -1.38, bottom: -HALF.y + 0.06, inner: 0.95, outer: -HALF.x + 0.06, front: 1.9, back: -HALF.z + 0.06 }

export const FRONT_LOGO = { y: 0.62, width: 1.12 }

export const SIDE_YAW = Math.PI / 2

const yAxis = new THREE.Vector3(0, 1, 0)

/** Case-local point → world point for a tower yawed by `yaw` and sitting at the origin. */
export const toWorld = (local, yaw = SIDE_YAW) => new THREE.Vector3(...local).applyAxisAngle(yAxis, yaw)

export const POINTS = {
  pumpTop: [BOARD_FACE - PUMP.height, CPU.y, CPU.z],
  ramTop: [BOARD_FACE - RAM.height, RAM.y, RAM.slots[2]],
  gpuEdge: [GPU.x - GPU.depth / 2, GPU.y, GPU.z + 0.35],
  boardCenter: [BOARD_FACE, BOARD.y, BOARD.z],
  frontLogo: [0, FRONT_LOGO.y, HALF.z + 0.02],
}
