import { GLTFLoader } from 'three-stdlib'

const attach = GLTFLoader.prototype.setDRACOLoader
GLTFLoader.prototype.setDRACOLoader = function (dracoLoader) {
  dracoLoader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`)
  dracoLoader.setDecoderConfig({ type: 'js' })
  return attach.call(this, dracoLoader)
}
