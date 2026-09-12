import React, { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ConfigIA, leerConfigIA, guardarConfigIA, PROVEEDORES, pedirIA, promptNovedad, ErrorIA } from '../ai';
import { Banner, Btn, Hint, Input, Row, Selector, Sheet, Stack, useTheme } from '../ui';

/** Los errores y el resultado permanecen dentro del formulario visible. */
export default function RedaccionIA({ texto, categoria = 'Novedad', onTexto, disabled = false, generarPrompt, validar }: {
  texto: string; categoria?: string; onTexto: (s: string) => void; disabled?: boolean;
  generarPrompt?: (texto: string) => string; validar?: (original: string, respuesta: string) => void;
}) {
  const t = useTheme();
  const actual = useRef(texto); actual.current = texto;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState('');
  const [cfg, setCfg] = useState<ConfigIA | null>(null);
  const [configurar, setConfigurar] = useState(false);
  const redactar = async (config?: ConfigIA) => {
    if (ocupado) return;
    if (!texto.trim()) { setError('Escriba o dictá la novedad antes de redactarla.'); return; }
    setOcupado(true); setError(''); setResultado('');
    const original = texto;
    try {
      const c = config || await leerConfigIA(); setCfg(c);
      if (!c.apiKey && c.proveedor !== 'compatible') { setConfigurar(true); throw new ErrorIA('sin_clave', 'Configure la clave del proveedor para usar la IA.'); }
      const salida = await pedirIA(generarPrompt ? generarPrompt(original) : promptNovedad(original, categoria), c);
      validar?.(original, salida);
      if (actual.current !== original) { setResultado(salida); setError('El texto cambió mientras se redactaba. Revise la propuesta antes de aplicarla.'); }
      else { onTexto(salida); setResultado(''); }
    } catch (e: any) { setError(e?.message || 'No se pudo redactar la novedad. Vuelva a intentarlo.'); }
    finally { setOcupado(false); }
  };
  return <Stack gap={8}>
    <Btn label={ocupado ? 'Redactando…' : 'Redactar con IA'} icon="edit" variant="ghost" size="sm" disabled={disabled || ocupado} onPress={() => redactar()} />
    {ocupado ? <Row><ActivityIndicator color={t.accent} /><Hint>Preparando la redacción…</Hint></Row> : null}
    {error ? <Banner kind="warn">{error}</Banner> : null}
    {error ? <Btn label="Configurar IA" size="xs" variant="ghost" onPress={async () => { setCfg(await leerConfigIA()); setConfigurar(true); }} /> : null}
    {resultado ? <View><Input label="Propuesta" value={resultado} onChangeText={setResultado} multiline rows={5} /><Btn label="Aplicar propuesta" onPress={() => {
      try { validar?.(actual.current, resultado); onTexto(resultado); setResultado(''); setError(''); }
      catch (e: any) { setError(e.message); }
    }} /></View> : null}
    <Sheet visible={configurar && !!cfg} title="Configurar IA" onClose={() => setConfigurar(false)} footer={<Btn label="Guardar y redactar" variant="primary" onPress={async () => {
      if (!cfg) return;
      try { await guardarConfigIA(cfg); setConfigurar(false); await redactar(cfg); }
      catch (e: any) { setError(e.message); }
    }} />}>
      <Hint>La clave se guarda en este teléfono compartido y se usa con el proveedor elegido.</Hint>
      <Selector label="Proveedor" valor={cfg?.proveedor || 'gemini'} onChange={p => setCfg(c => c && ({ ...c, proveedor: p as any, modelo: '' }))} opciones={PROVEEDORES.map(p => ({ v: p.v, t: p.t }))} />
      <Input label="Clave de API" value={cfg?.apiKey || ''} onChangeText={apiKey => setCfg(c => c && ({ ...c, apiKey }))} secureTextEntry />
      <Input label="Modelo (opcional)" value={cfg?.modelo || ''} onChangeText={modelo => setCfg(c => c && ({ ...c, modelo }))} />
      {cfg?.proveedor === 'compatible' ? <Input label="URL del servidor" value={cfg.baseUrl} onChangeText={baseUrl => setCfg(c => c && ({ ...c, baseUrl }))} /> : null}
    </Sheet>
  </Stack>;
}
