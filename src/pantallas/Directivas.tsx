import React, { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useStore } from '../store';
import {
  directivasDeHoy, dlogDe, estadoDirectiva, nombrePuesto, tagDirectiva,
  franjaPorId, etiquetaFranja, nombreFranja,
} from '../logic';
import { Directiva, DOW, isoDate, toMin, uid, dmy } from '../model';
import { gsName } from '../text';
import {
  Pantalla, Cabecera, Card, Btn, Tag, Seg, Item, Empty, Stack, Banner, Hint, useToast,
} from '../ui';
import RegistroDirectiva from './RegistroDirectiva';
import EditorDirectiva from './EditorDirectiva';

const TAG_TXT: Record<string, string> = { ok: 'Hecha', na: 'N/A', vencida: 'Vencida', ahora: 'Ahora', pend: '' };

export default function Directivas() {
  const st = useStore();
  const toast = useToast();
  const [modo, setModo] = useState('hoy');
  const [registrar, setRegistrar] = useState<Directiva | null>(null);
  const [editar, setEditar] = useState<Directiva | null | undefined>(undefined);

  const me = st.me!;
  const hoy = isoDate();
  const ds = directivasDeHoy(st.S, me, hoy);
  const todas = st.list<Directiva>('directives')
    .filter(d => !me.puestoId || !d.puestoId || d.puestoId === me.puestoId)
    .sort((a, b) => toMin(a.hora) - toMin(b.hora));

  const parte = async () => {
    let t = 'PARTE DE CONSIGNA — ' + dmy(hoy) + '\n' +
      (st.S.site.cliente ? st.S.site.cliente + '\n' : '') + gsName(me, st.S.site) + '\n\n';
    if (!ds.length) t += 'Sin directivas cargadas.\n';
    ds.forEach(d => {
      const l = dlogDe(st.S, hoy, d.id);
      const est = l ? (l.estado === 'na' ? 'N/A' : 'CUMPLIDA ' + (l.horaReal || '')) : 'PENDIENTE';
      t += d.hora + ' — ' + d.nombre + '\n' + est + '\n' + ((l && l.novedades) ? l.novedades + '\n' : '') + '\n';
    });
    await Clipboard.setStringAsync(t.trim());
    toast('Parte de consigna copiado');
  };

  return (
    <Pantalla>
      <Cabecera
        titulo="Directivas"
        sub={me.puestoId
          ? nombrePuesto(st.S, me.puestoId) + (me.franjaId ? '  ·  ' + etiquetaFranja(franjaPorId(st.S, me.franjaId)) : '')
          : 'Las tareas fijas de su consigna, en orden de horario.'}
        derecha={st.esAdmin ? <Btn icon="plus" variant="primary" onPress={() => setEditar(null)} /> : undefined} />

      <Seg acento valor={modo} onChange={setModo}
        opciones={[{ v: 'hoy', t: 'Hoy' }, { v: 'todas', t: st.esAdmin ? 'Administrar' : 'Toda la consigna' }]} />

      {modo === 'hoy' ? (
        <Stack gap={14}>
          {ds.length ? (
            <Card>
              {ds.map((d, i) => {
                const e = estadoDirectiva(st.S, d);
                const l = dlogDe(st.S, hoy, d.id);
                return (
                  <Item key={d.id} last={i === ds.length - 1} stripe={tagDirectiva[e]}
                    lead={d.hora || '--:--'} title={d.nombre}
                    subs={[
                      d.novedades,
                      l && l.horaReal ? 'Registrada ' + l.horaReal + (l.novedades ? ' — ' + l.novedades : '') : null,
                    ]}
                    right={TAG_TXT[e] ? <Tag label={TAG_TXT[e]} kind={tagDirectiva[e]} /> : undefined}
                    onPress={() => setRegistrar(d)} />
                );
              })}
            </Card>
          ) : (
            <Card>
              <Empty>
                {me.puestoId
                  ? 'El puesto ' + nombrePuesto(st.S, me.puestoId) + ' no tiene directivas para hoy.'
                  : 'No tiene puesto asignado. Seleccione uno en Mi perfil para recibir sus directivas.'}
              </Empty>
            </Card>
          )}
          {st.avisos && ds.length ? (
            <Banner kind="info" icon="bell">
              {'Vas a recibir un aviso 10 minutos antes de cada directiva y otro en el horario.'}
            </Banner>
          ) : null}
          <Btn label="Copiar parte de consigna" icon="copy" variant="ghost" onPress={parte} />
          <Btn label="Cargar documento de directivas" icon="informes" variant="ghost"
            onPress={() => router.push('/importar')} />
          <Hint>
            Cargás el PDF o una foto de las directivas del puesto y la IA arma el listado,
            ordenado por horario y repartido en el puesto y el turno que corresponda.
          </Hint>
        </Stack>
      ) : (
        <Stack gap={14}>
        <Card>
          {todas.length ? todas.map((d, i) => (
            <Item key={d.id} last={i === todas.length - 1}
              stripe={d.activa === false ? 'mute' : 'acc'}
              lead={d.hora || '--:--'} title={d.nombre}
              subs={[
                d.novedades,
                (d.dias && d.dias.length && d.dias.length < 7 ? d.dias.map(x => DOW[x]).join(' ') : 'Todos los días') +
                (d.puestoId ? ' · ' + nombrePuesto(st.S, d.puestoId) : '') +
                (d.franjaId ? ' · ' + nombreFranja(st.S, d.franjaId) : ''),
              ]}
              right={d.activa === false ? <Tag label="Pausada" kind="mute" /> : undefined}
              onPress={st.esAdmin ? () => setEditar(d) : undefined} />
          )) : <Empty>Sin directivas cargadas.</Empty>}
        </Card>
        <Btn label="Cargar documento de directivas" icon="informes" variant="primary"
          onPress={() => router.push('/importar')} />
        </Stack>
      )}

      <RegistroDirectiva directiva={registrar} onClose={() => setRegistrar(null)} />
      <EditorDirectiva
        abierto={editar !== undefined} directiva={editar || null}
        onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}
