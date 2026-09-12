import React, { useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '../store';
import { Novedad, Vigilador, hhmm, isoDate, uid, dmy } from '../model';
import { horaValida, fechaValida, turnoAbierto } from '../servicio';
import { puestos, franjasDe, etiquetaFranja } from '../logic';
import { Pantalla, SubCabecera, Btn, Card, Item, Empty, Sheet, Input, Selector, Seg, Banner, Hint, useToast } from '../ui';
import ServicioActual from './ServicioActual';
import { EditorNovedad } from './Novedades';

export default function Movimientos({ policial = false }: { policial?: boolean }) {
  const st = useStore(); const toast = useToast();
  const [nuevo, setNuevo] = useState(false); const [editar, setEditar] = useState<Novedad | null>(null);
  const [mov, setMov] = useState('ingreso'); const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState(isoDate()); const [hora, setHora] = useState(hhmm());
  const [puesto, setPuesto] = useState(st.me?.puestoId || ''); const [turno, setTurno] = useState('');
  const [error, setError] = useState('');
  const origen = policial ? 'policial' : 'guardia';
  const rows = st.list<Novedad>('novedades').filter(n => n.origenTipo === origen).sort((a,b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  const guardar = () => {
    try {
      if (nombre.trim().split(/\s+/).length < 2) throw new Error('Complete el nombre y apellido.');
      if (!horaValida(hora) || !fechaValida(fecha)) throw new Error('Revise la fecha y la hora.');
      if (!turno.trim()) throw new Error('Indique el turno.');
      const ps = st.S.posts.find(p => p.id === puesto)?.nombre;
      if (!policial && !ps) throw new Error('Seleccione el puesto.');
      const id = uid();
      st.put('novedades', { id, origenId: id, origenTipo: origen, fecha, hora, guardId: st.me!.id,
        categoria: policial ? 'Adicional policial' : 'Relevo',
        texto: 'Se registra el ' + mov + ' de ' + (policial ? 'personal adicional policial: ' : 'Gs ') + nombre.trim() +
          (!policial ? ', puesto ' + ps : '') + ', turno ' + turno.trim() + '.' });
      setNuevo(false); toast('Movimiento agregado al Informe general');
    } catch (e: any) { setError(e.message); }
  };
  return <Pantalla top>
    <SubCabecera titulo={policial ? 'Adicionales policiales' : 'Ingreso y egreso de guardias'} sub="Cada movimiento se agrega al Informe general." onBack={() => router.back()} />
    <ServicioActual />
    <Btn icon="plus" label={policial ? 'Registrar adicional policial' : 'Registrar movimiento'} variant="primary" onPress={() => {
      setNombre(''); setTurno(''); setMov('ingreso'); setFecha(isoDate()); setHora(hhmm()); setError(''); setNuevo(true);
    }} />
    <Card>{rows.length ? rows.map((n,i) => <Item key={n.id} last={i === rows.length-1} lead={n.hora} title={n.texto} tituloLineas={2} lineas={1} subs={[dmy(n.fecha)]} onPress={() => setEditar(n)} />) : <Empty>Sin movimientos registrados.</Empty>}</Card>
    <Sheet visible={nuevo} title={policial ? 'Adicional policial' : 'Movimiento de guardia'} onClose={() => setNuevo(false)} footer={<Btn label="Guardar movimiento" variant="primary" disabled={!turnoAbierto(st.S, st.me?.id)} onPress={guardar} />}>
      {!turnoAbierto(st.S, st.me?.id) ? <ServicioActual /> : null}
      <Seg valor={mov} onChange={setMov} opciones={[{ v: 'ingreso', t: 'Ingreso' }, { v: 'egreso', t: 'Egreso' }]} />
      {!policial ? <Selector label="Elegir del equipo (opcional)" valor="" onChange={v => {
        const g = st.byId<Vigilador>('guards', v); if (!g) return;
        setNombre((g.apellido + ' ' + g.nombre).trim()); setPuesto(g.puestoId || puesto);
        const f = st.S.franjas.find(f => f.id === g.franjaId); setTurno(f ? etiquetaFranja(f) : '');
      }} opciones={[{ v: '', t: 'Elegir guardia' }, ...st.list<Vigilador>('guards').map(g => ({ v: g.id, t: (g.apellido + ' ' + g.nombre).trim() }))]} /> : null}
      <Input label="Nombre completo" value={nombre} onChangeText={setNombre} />
      <Input label="Fecha" value={fecha} onChangeText={setFecha} placeholder="AAAA-MM-DD" mono />
      <Input label="Horario" value={hora} onChangeText={setHora} placeholder="HH:MM" mono keyboardType="numbers-and-punctuation" />
      {!policial ? <Selector label="Puesto" valor={puesto} onChange={setPuesto} opciones={puestos(st.S).map(p => ({ v: p.id, t: p.nombre }))} /> : null}
      <Input label="Turno" value={turno} onChangeText={setTurno} placeholder="Mañana · 07:00 a 15:00" />
      {error ? <Banner kind="warn">{error}</Banner> : null}
    </Sheet>
    <EditorNovedad abierto={!!editar} novedad={editar} fecha={editar?.fecha || fecha} onClose={() => setEditar(null)} />
  </Pantalla>;
}
