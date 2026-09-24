// Shared between the camera shim (setZoom) and the fake <camera-view>, so the
// "live preview" actually zooms and mirrors like the real one would.
const listeners = new Set()
export const store = { factor: 2, facing: 'back' }
export function update(patch) {
  Object.assign(store, patch)
  listeners.forEach((l) => l())
}
export function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}
