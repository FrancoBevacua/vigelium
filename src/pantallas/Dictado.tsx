import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { File } from 'expo-file-system';
import { leerConfigIA, fichaProveedor, transcribirAudio } from '../ai';
import { leerBytes, bytesBase64 } from '../media';
import { Banner, Btn, Hint, Row, Stack } from '../ui';

type Fase = 'listo' | 'preparando' | 'grabando' | 'transcribiendo';
let propietario: symbol | null = null;
export default function Dictado({ onTexto, etiqueta = 'Dictar', size = 'sm', enabled = true }: {
  onTexto: (s: string) => void; etiqueta?: string; size?: 'md' | 'sm' | 'xs'; enabled?: boolean;
}) {
  const grabador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const estadoAudio = useAudioRecorderState(grabador, 250);
  const [fase, setFase] = useState<Fase>('listo'), faseRef = useRef<Fase>('listo');
  const [error, setError] = useState(''), [pendiente, setPendiente] = useState('');
  const id = useRef(Symbol('dictado')).current;
  const operacion = useRef(0), montado = useRef(true), habilitado = useRef(enabled);
  const audio = useRef(''), callback = useRef(onTexto);
  callback.current = onTexto; habilitado.current = enabled;
  const cambiar = (v: Fase) => { faseRef.current = v; if (montado.current) setFase(v); };
  const borrarAudio = (uri: string) => {
    if (uri && Platform.OS !== 'web') try { const f = new File(uri); if (f.exists) f.delete(); } catch {}
  };
  const cancelar = async () => {
    operacion.current++;
    if (propietario !== id) return;
    try { if (grabador.isRecording) await grabador.stop(); } catch {}
    borrarAudio(audio.current || grabador.uri || ''); audio.current = '';
    propietario = null; cambiar('listo');
    if (montado.current) setPendiente('');
  };
  const transcribir = async (uri: string) => {
    const n = ++operacion.current; cambiar('transcribiendo'); setError('');
    try {
      const bytes = await leerBytes(uri);
      if (bytes.length < 512) throw new Error('La grabación está vacía. Vuelva a dictar cerca del micrófono.');
      const cfg = await leerConfigIA();
      const texto = await transcribirAudio({ uri, mime: Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4', nombre: Platform.OS === 'web' ? 'dictado.webm' : 'dictado.m4a', base64: bytesBase64(bytes) }, cfg);
      if (n !== operacion.current || !montado.current || !habilitado.current) return;
      callback.current(texto); borrarAudio(uri); audio.current = ''; setPendiente(''); propietario = null;
    } catch (e: any) {
      if (n === operacion.current && montado.current) { setError(e.message || 'No se pudo transcribir. Su audio sigue disponible para reintentar.'); setPendiente(uri); }
    } finally { if (n === operacion.current && montado.current) cambiar('listo'); }
  };
  const terminar = async (enviar = true) => {
    if (propietario !== id || faseRef.current !== 'grabando') return;
    const n = ++operacion.current;
    cambiar('preparando');
    try {
      await grabador.stop();
      const uri = grabador.uri;
      if (n !== operacion.current || propietario !== id || !montado.current || !habilitado.current) { borrarAudio(uri || ''); return; }
      if (!uri) throw new Error('El teléfono no guardó el audio. Vuelva a intentarlo.');
      audio.current = uri;
      if (!montado.current || !habilitado.current) { borrarAudio(uri); propietario = null; return; }
      if (enviar) await transcribir(uri);
      else { setPendiente(uri); cambiar('listo'); setError('Se pausó el dictado al salir de la aplicación. Puede transcribir el audio guardado.'); }
    } catch (e: any) { if (montado.current && n === operacion.current) { setError(e.message); cambiar('listo'); } }
  };
  const iniciar = async () => {
    if (!enabled || faseRef.current !== 'listo') return;
    if (propietario && propietario !== id) { setError('Finalice el otro dictado antes de iniciar este.'); return; }
    if (audio.current) { await transcribir(audio.current); return; }
    propietario = id; const n = ++operacion.current; cambiar('preparando'); setError('');
    try {
      const cfg = await leerConfigIA();
      if (!cfg.apiKey && cfg.proveedor !== 'compatible') throw new Error('Configure su API key en Ajustes antes de dictar.');
      if (!fichaProveedor(cfg.proveedor)?.audio) throw new Error('El proveedor elegido no transcribe audio. Seleccione Gemini o Groq en Ajustes.');
      const permiso = await AudioModule.requestRecordingPermissionsAsync();
      if (!permiso.granted) throw new Error('Permití el acceso al micrófono para dictar.');
      if (!montado.current || !habilitado.current || n !== operacion.current) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await grabador.prepareToRecordAsync();
      if (!montado.current || !habilitado.current || n !== operacion.current) { await grabador.stop().catch(() => {}); borrarAudio(grabador.uri || ''); return; }
      grabador.record(); cambiar('grabando');
    } catch (e: any) { if (montado.current && n === operacion.current) { setError(e.message || 'No se pudo abrir el micrófono.'); cambiar('listo'); propietario = null; } }
  };
  const terminarRef = useRef(terminar); terminarRef.current = terminar;
  useEffect(() => {
    montado.current = true;
    // El diálogo de permiso no cancela la preparación del grabador.
    const sub = AppState.addEventListener('change', s => { if (s === 'background' && faseRef.current === 'grabando') void terminarRef.current(false); });
    return () => { montado.current = false; sub.remove(); void cancelar(); };
  }, []);
  useEffect(() => { if (!enabled) void cancelar(); }, [enabled]);
  useEffect(() => { if (estadoAudio.durationMillis >= 120000 && faseRef.current === 'grabando') void terminarRef.current(); }, [estadoAudio.durationMillis]);
  return <Stack gap={8}>
    <Row style={{flexWrap:'wrap'}}>
      <Btn label={fase === 'grabando' ? 'Terminar dictado' : fase === 'transcribiendo' ? 'Transcribiendo…' : fase === 'preparando' ? 'Preparando audio…' : pendiente ? 'Reintentar transcripción' : etiqueta}
        icon="bell" size={size} variant={fase === 'grabando' ? 'primary' : 'ghost'} disabled={!enabled || fase === 'preparando' || fase === 'transcribiendo'} onPress={() => fase === 'grabando' ? terminar() : iniciar()} />
      {fase !== 'listo' || pendiente ? <Btn label="Cancelar dictado" size="sm" variant="ghost" onPress={cancelar} /> : null}
    </Row>
    {fase === 'grabando' ? <Hint>{'Grabando · ' + Math.floor(estadoAudio.durationMillis / 1000) + ' s. Seleccione Terminar dictado para transcribir.'}</Hint> : null}
    {error ? <Banner kind="warn">{error}</Banner> : null}
  </Stack>;
}
