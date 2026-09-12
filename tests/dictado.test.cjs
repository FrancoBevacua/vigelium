require('./register.cjs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const listeners = new Set();
let permiso = async () => ({granted:true});
let transcribir = async () => 'Se recibe el puesto.';
let grabaciones=0;
const grabador = {uri:'file://dictado.m4a',isRecording:false,
  prepareToRecordAsync:async()=>{}, record:()=>{grabaciones++;grabador.isRecording=true;},
  stop:async()=>{grabador.isRecording=false;}};
const cargar=Module._load;
Module._load=function(name,...args){
  if(name==='react-native') return {Platform:{OS:'android'},AppState:{addEventListener:(_,f)=>{listeners.add(f);return {remove:()=>listeners.delete(f)};}}};
  if(name==='expo-audio') return {RecordingPresets:{HIGH_QUALITY:{}},AudioModule:{requestRecordingPermissionsAsync:()=>permiso()},setAudioModeAsync:async()=>{},useAudioRecorder:()=>grabador,useAudioRecorderState:()=>({durationMillis:1000})};
  if(name==='../ai') return {leerConfigIA:async()=>({apiKey:'test',proveedor:'gemini'}),fichaProveedor:()=>({audio:true}),transcribirAudio:()=>transcribir()};
  if(name==='../media') return {leerBytes:async()=>new Uint8Array(1024),bytesBase64:()=>''};
  if(name==='../ui') return Object.fromEntries(['Banner','Btn','Hint','Row','Stack'].map(n=>[n,props=>React.createElement(n,props,props.children)]));
  return cargar.call(this,name,...args);
};
const Dictado=require('../src/pantallas/Dictado.tsx').default;
const boton=(r,label)=>r.root.findAllByType('Btn').find(b=>b.props.label===label);
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('Dictar permanece visible cuando el permiso cambia AppState y devuelve la transcripción',async()=>{
  let r;const textos=[];const p=defer();permiso=()=>p.promise;
  await act(async()=>{r=create(React.createElement(Dictado,{onTexto:s=>textos.push(s)}));});
  let iniciar;
  await act(async()=>{iniciar=boton(r,'Dictar').props.onPress();});
  await act(async()=>{for(const f of listeners)f('background');});
  assert.ok(boton(r,'Preparando audio…'));
  await act(async()=>{p.resolve({granted:true});await iniciar;});
  assert.ok(boton(r,'Terminar dictado'));
  await act(async()=>{await boton(r,'Terminar dictado').props.onPress();});
  assert.deepEqual(textos,['Se recibe el puesto.']);assert.ok(boton(r,'Dictar'));
  await act(async()=>r.unmount());
});

test('fallo de conexión conserva el audio para reintentar sin grabar otra vez',async()=>{
  let r;const textos=[];permiso=async()=>({granted:true});transcribir=async()=>{throw new Error('Límite de Gemini.');};
  await act(async()=>{r=create(React.createElement(Dictado,{onTexto:s=>textos.push(s)}));});
  await act(async()=>{await boton(r,'Dictar').props.onPress();});const n=grabaciones;
  await act(async()=>{await boton(r,'Terminar dictado').props.onPress();});
  assert.ok(boton(r,'Reintentar transcripción'));assert.ok(r.root.findByType('Banner').props.children.includes('Límite'));
  transcribir=async()=>'Texto recuperado.';
  await act(async()=>{await boton(r,'Reintentar transcripción').props.onPress();});
  assert.equal(grabaciones,n);assert.deepEqual(textos,['Texto recuperado.']);
  await act(async()=>r.unmount());
});

test('cancelar durante una transcripción evita agregar resultados tardíos',async()=>{
  let r;const textos=[];const p=defer();transcribir=()=>p.promise;
  await act(async()=>{r=create(React.createElement(Dictado,{onTexto:s=>textos.push(s)}));});
  await act(async()=>{await boton(r,'Dictar').props.onPress();});
  let terminar;await act(async()=>{terminar=boton(r,'Terminar dictado').props.onPress();});
  assert.ok(boton(r,'Transcribiendo…'));
  await act(async()=>{await boton(r,'Cancelar dictado').props.onPress();p.resolve('Texto cancelado.');await terminar;});
  assert.deepEqual(textos,[]);assert.ok(boton(r,'Dictar'));
  await act(async()=>r.unmount());
});

test('cancelar mientras se guarda el audio no inicia una transcripción tardía',async()=>{
  let r;const p=defer();const stop=grabador.stop;let llamadas=0;
  grabador.stop=()=>{grabador.isRecording=false;return p.promise;};transcribir=async()=>{llamadas++;return 'Texto';};
  await act(async()=>{r=create(React.createElement(Dictado,{onTexto:()=>assert.fail('Cancelado')}));});
  await act(async()=>{await boton(r,'Dictar').props.onPress();});
  let terminar;await act(async()=>{terminar=boton(r,'Terminar dictado').props.onPress();});
  await act(async()=>{await boton(r,'Cancelar dictado').props.onPress();p.resolve();await terminar;});
  assert.equal(llamadas,0);assert.ok(boton(r,'Dictar'));
  await act(async()=>r.unmount());grabador.stop=stop;
});
