const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
require.extensions['.tsx'] = require.extensions['.ts'] = (mod, file) => {
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText, file);
};

// Sólo se sustituyen los adaptadores nativos; se ejecuta el código de dominio real.
const memoria = new Map();
const stubs = {
  platform: { OS: 'android' },
  picker: { getDocumentAsync: async () => ({ canceled: true }) },
  bytes: new Uint8Array(),
};
const cargar = Module._load;
Module._load = function (name, ...args) {
  if (name === 'expo-sqlite') return require('./sqlite-native.cjs');
  if (name === 'react-native') return { Platform: stubs.platform };
  if (name === 'expo-crypto') return {
    CryptoDigestAlgorithm: { SHA256: 'sha256' },
    getRandomBytesAsync: async n => require('node:crypto').randomBytes(n),
    digestStringAsync: async (alg, s) => require('node:crypto').createHash(alg).update(s).digest('hex'),
  };
  if (name === 'expo-secure-store') return {
    getItemAsync: async k => memoria.get(k) || null,
    setItemAsync: async (k, v) => memoria.set(k, v),
    deleteItemAsync: async k => {memoria.delete(k);},
  };
  if (name === 'expo-document-picker') return stubs.picker;
  if (name === 'expo-image-picker') return {};
  if (name === 'expo-image-manipulator') return {};
  if (name === 'expo-file-system') return { File: class { async bytes() { return stubs.bytes; } } };
  return cargar.call(this, name, ...args);
};
stubs.memoria = memoria;
module.exports = stubs;
