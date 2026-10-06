import { GLTFLoader } from 'three-stdlib'

const attach = GLTFLoader.prototype.setDRACOLoader
GLTFLoader.prototype.setDRACOLoader = function (dracoLoader) {
  dracoLoader.setDecoderPath('/draco/')
  dracoLoader.setDecoderConfig({ type: 'js' })
  return attach.call(this, dracoLoader)
}
