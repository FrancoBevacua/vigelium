import React, { useState } from 'react';
import { useStore } from '../store';
import { turnoAbierto } from '../servicio';
import { dmy } from '../model';
import { Banner, Btn, Card, Hint, Input, Row, Sheet, Stack, Tag } from '../ui';

export default function ServicioActual() {
  const st = useStore();
  const p = turnoAbierto(st.S, st.me?.id);
  const [cerrar, setCerrar] = useState(false);
  const [cierre, setCierre] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  return <Card pad><Stack gap={10}>
    <Row style={{ justifyContent: 'space-between' }}>
      <Tag kind={p ? 'ok' : 'mute'} label={p ? 'Turno abierto' : 'Fuera de turno'} />
      {p ? <Hint>{dmy(p.fecha) + ' · ' + p.in}</Hint> : null}
    </Row>
    {p ? <>
      <Hint>{[p.puesto, p.turno].filter(Boolean).join(' · ')}</Hint>
      <Btn label="Cerrar turno" variant="ghost" onPress={() => { setCerrar(true); setError(''); }} />
    </> : <>
      <Hint>Puede leer el informe compartido. Inicie su turno para agregar novedades.</Hint>
      <Btn label="Iniciar turno" icon="clock" variant="primary" disabled={guardando} onPress={async () => {setGuardando(true);try { st.iniciarTurno(); await st.confirmarGuardado();setError(''); } catch (e: any) { setError(e.message); }finally{setGuardando(false);} }} />
    </>}
    {error && !cerrar ? <Banner kind="warn">{error}</Banner> : null}
    <Sheet visible={cerrar} title="Cierre de turno" onClose={() => { if (!guardando) setCerrar(false); }} footer={<Btn label={guardando ? "Guardando cierre…" : "Confirmar cierre y salir"} disabled={guardando} variant="primary" onPress={async () => {
      setGuardando(true);
      try { await st.cerrarTurno(cierre); setCerrar(false); } catch (e: any) { setError(e.message); } finally { setGuardando(false); }
    }} />}>
      <Banner kind="info">Se registrará su egreso. Sus novedades quedarán de sólo lectura y el guardia entrante podrá consultarlas desde su cuenta.</Banner>
      <Input label="Pendientes y estado del puesto" value={cierre} onChangeText={setCierre} multiline rows={5} placeholder="Indique las novedades que debe seguir el guardia entrante." />
      {error ? <Banner kind="warn">{error}</Banner> : null}
    </Sheet>
  </Stack></Card>;
}
