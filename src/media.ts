import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export async function leerBytes(uri: string): Promise<Uint8Array> {
  if (Platform.OS !== 'web') return new File(uri).bytes();
  const r = await fetch(uri);
  if (!r.ok) throw new Error('No se pudo leer el archivo.');
  return new Uint8Array(await r.arrayBuffer());
}

export function bytesBase64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 8192) binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binario);
}

/** Convierte también PNG/HEIC a JPEG; cambiar sólo la extensión no los convierte. */
export async function prepararFoto(uri: string, max = 1600) {
  const contexto = ImageManipulator.ImageManipulator.manipulate(uri);
  const original = await contexto.renderAsync();
  if (Math.max(original.width, original.height) > max) {
    contexto.resize(original.width >= original.height ? { width: max } : { height: max });
  }
  const imagen = await contexto.renderAsync();
  return imagen.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8, base64: true });
}
