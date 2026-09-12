import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../store';
import { puestos, nombrePuesto, franjasDe } from '../logic';
import { Directiva, DOW, uid } from '../model';
import { Sheet, Btn, Input, Field, Chip, Chipbar, Toggle, useToast, Selector } from '../ui';

export default function EditorDirectiva({ abierto, directiva, onClose }: {
  abierto: boolean; directiva: Directiva | null; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [hora, setHora] = useState('');
  const [nombre, setNombre] = useState('');
  const [nov, setNov] = useState('');
  const [dias, setDias] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [puestoId, setPuestoId] = useState('');
  const [franjaId, setFranjaId] = useState('');
  const [activa, setActiva] = useState(true);

  useEffect(() => {
    if (!abierto) return;
    setHora(directiva?.hora || '');
    setNombre(directiva?.nombre || '');
    setNov(directiva?.novedades || '');
    setDias(directiva?.dias?.length ? directiva.dias : [0, 1, 2, 3, 4, 5, 6]);
    setPuestoId(directiva?.puestoId || st.me?.puestoId || '');
    setFranjaId(directiva?.franjaId || st.me?.franjaId || '');
    setActiva(directiva?.activa !== false);
  }, [abierto, directiva?.id]);

  const guardar = () => {
    if (!nombre.trim()) { toast('Ingrese un nombre a la directiva'); return; }
    st.put('directives', {
      id: directiva?.id || uid(), hora, nombre, novedades: nov,
      dias: dias.length === 7 ? [] : dias,
      puestoId, franjaId, puesto: nombrePuesto(st.S, puestoId), activa,
    });
    onClose();
    toast('Directiva guardada');
  };

  return (
    <Sheet
      visible={abierto} title={directiva ? 'Editar directiva' : 'Nueva directiva'} onClose={onClose}
      footer={
        <>
          {directiva ? (
            <Btn icon="trash" variant="danger" onPress={() => {
              st.drop('directives', directiva.id); onClose(); toast('Directiva eliminada');
            }} />
          ) : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Input label="Hora" value={hora} onChangeText={setHora} mono placeholder="04:45"
        hint="A qué hora hay que ejecutarla." keyboardType="numbers-and-punctuation" />
      <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Apertura de accesos del paseo" />
      <Input label="Novedades / detalle" value={nov} onChangeText={setNov} multiline rows={3}
        placeholder="Verificar precinto, dejar constancia en el libro…" />
      <Field label="Días" hint="Si están todos marcados, la directiva corre todos los días.">
        <Chipbar>
          {DOW.map((n, i) => (
            <Chip key={i} label={n} on={dias.includes(i)}
              onPress={() => setDias(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort())} />
          ))}
        </Chipbar>
      </Field>
      <Selector label="Puesto" valor={puestoId}
        onChange={v => { setPuestoId(v); setFranjaId(''); }}
        hint="Sin puesto, la ven todos los vigiladores."
        opciones={[{ v: '', t: 'Sin puesto asignado' }, ...puestos(st.S).map(p => ({ v: p.id, t: p.nombre }))]} />
      <Selector label="Turno" valor={franjaId} onChange={setFranjaId}
        hint="Sin turno, la directiva corre en todos los turnos del puesto."
        opciones={[
          { v: '', t: 'Todos los turnos' },
          ...franjasDe(st.S, puestoId).map(f => ({
            v: f.id,
            t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre,
            sub: f.entrada + ' a ' + f.salida,
          })),
        ]} />
      {directiva ? <Toggle label="Directiva activa" value={activa} onChange={setActiva} /> : null}
    </Sheet>
  );
}
