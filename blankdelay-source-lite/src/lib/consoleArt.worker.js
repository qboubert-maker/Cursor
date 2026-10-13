import { paintBackdrop, paintSkins, paintVent } from './consoleArtwork.js'

self.onmessage = ({ data: job }) => {
  if (job === 'backdrop') {
    const backdrop = paintBackdrop()
    self.postMessage({ backdrop }, [backdrop.data.buffer])
    return
  }
  const skins = paintSkins()
  const vent = paintVent()
  self.postMessage({ skins, vent }, [...Object.values(skins), vent].map((image) => image.data.buffer))
}
