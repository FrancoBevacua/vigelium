import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { horasDelMes, CICLOS, franjaPorId, franjasDe } from '../logic';
import {
  Turno, Vigilador, DOW, MES, addDays, dmy, isoDate, pad2, parseISO, uid,
} from '../model';
import { FONT, R } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Metric, Row, Stack, Chip, Chipbar,
  Input, Field, Selector, Sheet, Banner, Hint, Item, Empty, Eyebrow, Tag, useToast,
} from '../ui';
import {
  leerConfigIA, pedirIA, promptCronograma, parsearCronograma, JornadaIA, ErrorIA, fichaProveedor,
} from '../ai';
import { elegirDocumento, elegirFotoDocumento } from '../lectura';

const TIPOS: { v: Turno['tipo']; t: string }[] = [
  { v: 'turno', t: 'Turno' }, { v: 'franco', t: 'Franco' },
  { v: 'extra', t: 'Extra' }, { v: 'licencia', t: 'Licencia' },
];

export default function Turnos() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [gid, setGid] = useState(st.me!.id);
  const [ym, setYm] = useState(isoDate().slice(0, 7));
  const [dia, setDia] = useState<string | null>(null);
  const [diagrama, setDiagrama] = useState(false);
  const [lector, setLector] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState('');

  const G = st.byId<Vigilador>('guards', gid) || st.me!;
  const Y = +ym.slice(0, 4), M = +ym.slice(5, 7);
  const primero = new Date(Y, M - 1, 1);
  const inicio = new Date(primero);
  inicio.setDate(1 - primero.getDay());

  const mios = st.list<Turno>('shifts').filter(s => s.guardId === gid);
  const mapa: Record<string, Turno> = {};
  mios.forEach(s => (mapa[s.fecha] = s));

  const delMes = mios.filter(s => s.fecha.slice(0, 7) === ym);
  const nTurnos = delMes.filter(s => s.tipo === 'turno' || s.tipo === 'extra').length;
  const nFrancos = delMes.filter(s => s.tipo === 'franco').length;
  const prox = mios.filter(s => s.fecha >= isoDate() && s.tipo !== 'franco').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const proxF = mios.filter(s => s.fecha >= isoDate() && s.tipo === 'franco').sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const colorDia = (tipo?: string) =>
    tipo === 'turno' ? [t.accentSoft, t.accent]
      : tipo === 'franco' ? [t.okSoft, t.ok]
        : tipo === 'extra' ? [t.slateSoft, t.slate]
          : tipo === 'licencia' ? [t.critSoft, t.crit]
            : [t.surface2, t.text2];

  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const iso = isoDate(d);
    const s = mapa[iso];
    const fuera = d.getMonth() !== M - 1;
    const [bg, fg] = colorDia(s?.tipo);
    celdas.push(
      <Pressable key={iso} onPress={() => setDia(iso)} style={{
        width: '13.4%', aspectRatio: 1, margin: '0.3%', borderRadius: 8,
        alignItems: 'center', justifyContent: 'center', backgroundColor: bg,
        borderWidth: 1, borderColor: iso === isoDate() ? t.accent : 'transparent',
        opacity: fuera ? 0.32 : 1,
      }}>
        <Text style={{ fontFamily: FONT.mono, fontSize: 13, color: fg }}>{d.getDate()}</Text>
        {s ? (
          <Text style={{ fontFamily: FONT.dispBold, fontSize: 8, color: fg }}>
            {s.tipo === 'franco' ? 'F' : s.tipo === 'licencia' ? 'LIC' : (s.entrada || 'EX')}
          </Text>
        ) : null}
      </Pressable>
    );
  }

  return (
    <Pantalla top>
      <SubCabecera titulo="Turnos y francos"
        sub={st.esAdmin ? 'Diagrama de ' + G.apellido + ', ' + G.nombre : 'Su diagrama del mes y las horas acumuladas.'}
        onBack={() => router.back()} />

      {st.list('guards').length > 1 ? (
        <Chipbar>
          {st.list<Vigilador>('guards').map(g => (
            <Chip key={g.id} label={g.apellido} on={g.id === gid} onPress={() => setGid(g.id)} />
          ))}
        </Chipbar>
      ) : null}

      <Row gap={9}>
        <Metric valor={nTurnos} label="Turnos" />
        <Metric valor={nFrancos} label="Francos" />
        <Metric valor={Math.floor(horasDelMes(st.S, gid, ym) / 60)} label="Horas" />
      </Row>

      <Card pad>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <Btn icon="back" variant="ghost" size="sm" onPress={() => {
            const d = new Date(Y, M - 2, 1); setYm(d.getFullYear() + '-' + pad2(d.getMonth() + 1));
          }} />
          <Text style={{ fontFamily: FONT.disp, fontSize: 19, color: t.text, textTransform: 'capitalize' }}>
            {MES[M - 1] + ' ' + Y}
          </Text>
          <Btn icon="back" variant="ghost" size="sm" style={{ transform: [{ scaleX: -1 }] }} onPress={() => {
            const d = new Date(Y, M, 1); setYm(d.getFullYear() + '-' + pad2(d.getMonth() + 1));
          }} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {DOW.map(d => (
            <View key={d} style={{ width: '13.4%', margin: '0.3%', alignItems: 'center', paddingVertical: 4 }}>
              <Text style={{ fontFamily: FONT.dispBold, fontSize: 10, color: t.muted }}>{d[0]}</Text>
            </View>
          ))}
          {celdas}
        </View>
        <Row gap={6} style={{ marginTop: 11, flexWrap: 'wrap' }}>
          {[['Turno', t.accent], ['Franco', t.ok], ['Extra', t.slate], ['Licencia', t.crit]].map(([lab, c]) => (
            <View key={lab as string} style={{
              flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, height: 29,
              borderRadius: R.pill, borderWidth: 1, borderColor: t.line, backgroundColor: t.surface2,
            }}>
              <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: c as string }} />
              <Text style={{ fontFamily: FONT.bodyMed, fontSize: 12.5, color: t.text2 }}>{lab as string}</Text>
            </View>
          ))}
        </Row>
      </Card>

      {prox ? (
        <Banner kind="info" icon="clock">
          <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.slate }}>
            <Text style={{ fontFamily: FONT.bodyBold }}>Próximo turno: </Text>
            {DOW[parseISO(prox.fecha).getDay()] + ' ' + dmy(prox.fecha) +
              (prox.entrada ? ' de ' + prox.entrada + ' a ' + (prox.salida || '') : '')}
            {proxF ? (
              <Text>
                {'\n'}<Text style={{ fontFamily: FONT.bodyBold }}>Próximo franco: </Text>
                {DOW[parseISO(proxF.fecha).getDay()] + ' ' + dmy(proxF.fecha)}
              </Text>
            ) : null}
          </Text>
        </Banner>
      ) : null}

      {resultadoImportacion ? <Banner kind="info">{resultadoImportacion}</Banner> : null}
      {!delMes.length ? <Banner kind="info">{'Sin jornadas cargadas para ' + G.apellido + ' en ' + MES[M - 1] + ' ' + Y + '.'}</Banner> : null}
      <Btn label="Cargar diagrama del supervisor" icon="informes" variant="primary"
        onPress={() => setLector(true)} />
      <Hint>
        Cargue el PDF, la foto o la captura del diagrama que manda el supervisor: la IA lee los
        horarios y los francos de todo el equipo y los deja cargados acá.
      </Hint>
      <Btn label="Generar diagrama por patrón" variant="ghost" onPress={() => setDiagrama(true)} />

      <EditarDia fecha={dia} gid={gid} onClose={() => setDia(null)} />
      <GenerarDiagrama abierto={diagrama} gid={gid} onClose={() => setDiagrama(false)} />
      <LectorDiagrama abierto={lector} mes={ym} onClose={() => setLector(false)} onImportado={(registros) => {
        const primero = registros.find(r => r.guardId === st.me!.id) || registros[0];
        if (primero) { setGid(primero.guardId!); setYm(primero.fecha.slice(0, 7)); }
        setResultadoImportacion(registros.length + ' jornadas guardadas. El calendario muestra el mes y el guardia importados.');
      }} />
    </Pantalla>
  );
}

function EditarDia({ fecha, gid, onClose }: { fecha: string | null; gid: string; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const G = st.byId<Vigilador>('guards', gid);
  const fr = franjaPorId(st.S, G?.franjaId);
  const previo = fecha ? st.list<Turno>('shifts').find(s => s.guardId === gid && s.fecha === fecha) : undefined;
  const [tipo, setTipo] = useState<Turno['tipo']>('turno');
  const [entrada, setEntrada] = useState('');
  const [salida, setSalida] = useState('');

  useEffect(() => {
    if (!fecha) return;
    setTipo(previo?.tipo || 'turno');
    setEntrada(previo?.entrada || fr?.entrada || G?.horaIn || '06:00');
    setSalida(previo?.salida || fr?.salida || G?.horaOut || '14:00');
  }, [fecha]);

  if (!fecha) return null;
  const conHoras = tipo === 'turno' || tipo === 'extra';

  return (
    <Sheet visible title={DOW[parseISO(fecha).getDay()] + ' ' + dmy(fecha)} onClose={onClose}
      footer={
        <>
          {previo ? (
            <Btn icon="trash" variant="danger" onPress={() => { st.drop('shifts', previo.id); onClose(); }} />
          ) : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            st.put('shifts', {
              id: previo?.id || uid(), guardId: gid, fecha, tipo,
              entrada: conHoras ? entrada : '', salida: conHoras ? salida : '',
            });
            onClose(); toast('Día guardado');
          }} />
        </>
      }>
      {G && G.id !== st.me!.id ? <Hint>{'Diagrama de ' + G.apellido + ', ' + G.nombre}</Hint> : null}
      <Field label="Tipo de día">
        <Chipbar>
          {TIPOS.map(x => <Chip key={x.v} label={x.t} on={tipo === x.v} onPress={() => setTipo(x.v)} />)}
        </Chipbar>
      </Field>
      {conHoras ? (
        <Row gap={11} style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Input label="Entrada" value={entrada} onChangeText={setEntrada} mono keyboardType="numbers-and-punctuation" />
          </View>
          <View style={{ flex: 1 }}>
            <Input label="Salida" value={salida} onChangeText={setSalida} mono keyboardType="numbers-and-punctuation" />
          </View>
        </Row>
      ) : null}
    </Sheet>
  );
}

function GenerarDiagrama({ abierto, gid, onClose }: { abierto: boolean; gid: string; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const G = st.byId<Vigilador>('guards', gid);
  const fr = franjaPorId(st.S, G?.franjaId);
  const [patron, setPatron] = useState('12x36');
  const [desde, setDesde] = useState(isoDate());
  const [hasta, setHasta] = useState(addDays(isoDate(), 60));
  const [entrada, setEntrada] = useState(fr?.entrada || G?.horaIn || '06:00');
  const [salida, setSalida] = useState(fr?.salida || G?.horaOut || '14:00');

  const generar = () => {
    if (!desde || !hasta || hasta < desde) { toast('Revise el período'); return; }
    const ciclo = CICLOS[patron];
    const cambios: { col: 'shifts'; obj: any }[] = [];
    let f = desde, i = 0, n = 0;
    const existentes = st.list<Turno>('shifts').filter(s => s.guardId === gid);
    while (f <= hasta && n < 400) {
      const trabaja = patron === '5x2'
        ? [1, 2, 3, 4, 5].includes(parseISO(f).getDay())
        : (ciclo as number[])[i % (ciclo as number[]).length] === 1;
      const ex = existentes.find(s => s.fecha === f);
      cambios.push({
        col: 'shifts',
        obj: {
          id: ex?.id || uid(), guardId: gid, fecha: f,
          tipo: trabaja ? 'turno' : 'franco',
          entrada: trabaja ? entrada : '', salida: trabaja ? salida : '',
        },
      });
      f = addDays(f, 1); i++; n++;
    }
    st.putVarios(cambios);
    onClose();
    toast('Diagrama generado: ' + n + ' días');
  };

  return (
    <Sheet visible={abierto} title="Generar diagrama" onClose={onClose}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          <Btn label="Generar" variant="primary" style={{ flex: 1 }} onPress={generar} />
        </>
      }>
      <Hint>Se completan los días del período según el patrón elegido. Los días ya cargados se sobrescriben.</Hint>
      <Selector label="Patrón" valor={patron} onChange={setPatron} opciones={[
        { v: '12x36', t: '12x36', sub: 'un día sí, un día no' },
        { v: '6x1', t: '6x1', sub: 'seis días de trabajo, uno franco' },
        { v: '5x2', t: '5x2', sub: 'lunes a viernes' },
        { v: '4x2', t: '4x2', sub: 'cuatro de trabajo, dos francos' },
        { v: '2x2', t: '2x2', sub: 'dos y dos' },
        { v: 'todos', t: 'Todos los días', sub: '' },
      ]} />
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Input label="Desde" value={desde} onChangeText={setDesde} mono /></View>
        <View style={{ flex: 1 }}><Input label="Hasta" value={hasta} onChangeText={setHasta} mono /></View>
      </Row>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Input label="Entrada" value={entrada} onChangeText={setEntrada} mono /></View>
        <View style={{ flex: 1 }}><Input label="Salida" value={salida} onChangeText={setSalida} mono /></View>
      </Row>
      <Hint>El primer día del período se toma como día de trabajo.</Hint>
    </Sheet>
  );
}


/* ================= lectura del diagrama que manda el supervisor ================= */
function LectorDiagrama({ abierto, mes, onClose, onImportado }: { abierto: boolean; mes: string; onClose: () => void; onImportado: (jornadas: JornadaIA[]) => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [leyendo, setLeyendo] = useState(false);
  const [jornadas, setJornadas] = useState<JornadaIA[]>([]);
  const [fuente, setFuente] = useState('');
  const [error, setError] = useState('');
  const [pagina, setPagina] = useState(0);
  const [asignaciones, setAsignaciones] = useState<Record<string, string>>({});

  useEffect(() => { if (!abierto) { setJornadas([]); setFuente(''); setPagina(0); setAsignaciones({}); } }, [abierto]);

  const gs = st.list<Vigilador>('guards');
  const norm = (x: string) => String(x || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').trim();

  /* Empareja el nombre que trae el papel con alguien de la dotación. */
  const buscarGuardia = (nombre: string): Vigilador | undefined => {
    if (asignaciones[nombre]) return gs.find(g => g.id === asignaciones[nombre]);
    const q = norm(nombre);
    if (!q) return undefined;
    const partes = q.split(/\s+/).filter(Boolean);
    const exactos = gs.filter(g => norm(g.apellido + ' ' + g.nombre) === q || norm(g.nombre + ' ' + g.apellido) === q);
    if (exactos.length === 1) return exactos[0];
    const candidatos = gs.filter(g => partes.some(p => p.length > 3 && norm(g.apellido) === p));
    return candidatos.length === 1 ? candidatos[0] : undefined;
  };

  const interpretar = async (texto: string, imagen?: any, nombre?: string) => {
    const cfg = await leerConfigIA();
    setError('');
    if (imagen && !fichaProveedor(cfg.proveedor)?.vision) {
      setError('Para leer una foto seleccione Google Gemini o Claude en Ajustes.');
      return;
    }
    setLeyendo(true);
    try {
      const salida = await pedirIA(
        promptCronograma(mes, gs.map(g => g.apellido + ' ' + g.nombre), imagen ? undefined : texto),
        cfg, undefined, imagen ? [imagen] : undefined, { maxTokens: 24000, timeoutMs: 180000 });
      const leidas = parsearCronograma(salida);
      if (!leidas.length) { setError('No se reconocieron jornadas. Usá una foto nítida de la grilla completa, con los nombres, las fechas y la leyenda de horarios.'); return; }
      setJornadas(leidas);
      setPagina(0); setAsignaciones({});
      setFuente(nombre || '');
      toast(leidas.length + ' jornadas leídas. Revisalas antes de importar.');
    } catch (e: any) {
      setError(e?.message || 'No se pudo consultar la IA');
    } finally { setLeyendo(false); }
  };

  const cargar = async (origen: 'archivo' | 'camara' | 'galeria') => {
    setLeyendo(true); setError('');
    try {
      const cfg = await leerConfigIA();
      const doc = origen === 'archivo' ? await elegirDocumento({ conservarPDF: ['gemini', 'anthropic'].includes(cfg.proveedor) }) : await elegirFotoDocumento(origen === 'camara');
      if (doc.clase === 'vacio') { if (doc.motivo) setError(doc.motivo); return; }
      if (doc.clase === 'texto') await interpretar(doc.texto, undefined, doc.nombre);
      else await interpretar('', doc.imagen, doc.nombre);
    } catch (e: any) { setError(e?.message || 'No se pudo cargar el diagrama'); }
    finally { setLeyendo(false); }
  };

  const importar = () => {
    if (jornadas.some(j => !buscarGuardia(j.vigilador))) { toast('Asigne un vigilador a cada nombre antes de cargar el diagrama.'); return; }
    const cambios: any[] = [];
    const porDia = new Map<string, JornadaIA>();
    for (const j of jornadas) {
      const key = buscarGuardia(j.vigilador)!.id + ':' + j.fecha;
      const previo = porDia.get(key);
      if (previo && (previo.tipo !== j.tipo || previo.entrada !== j.entrada || previo.salida !== j.salida)) {
        toast('Hay jornadas contradictorias para ' + j.vigilador + ' el ' + dmy(j.fecha) + '. Revise el documento.'); return;
      }
      porDia.set(key, j);
    }
    let sinDueno = 0;
    [...porDia.values()].forEach(j => {
      const g = buscarGuardia(j.vigilador);
      if (!g) { sinDueno++; return; }
      const previo = st.list<Turno>('shifts').find(x => x.guardId === g.id && x.fecha === j.fecha);
      cambios.push({
        col: 'shifts',
        obj: {
          id: previo?.id || uid(), guardId: g.id, fecha: j.fecha,
          tipo: j.tipo as Turno['tipo'],
          entrada: j.tipo === 'turno' || j.tipo === 'extra' ? j.entrada : '',
          salida: j.tipo === 'turno' || j.tipo === 'extra' ? j.salida : '',
        },
      });
    });
    if (!cambios.length) { toast('Ninguno de los nombres del diagrama coincide con el equipo cargado.'); return; }
    st.putVarios(cambios);
    onImportado(cambios.map(c => ({ ...c.obj, vigilador: gs.find(g => g.id === c.obj.guardId)?.apellido || '' })));
    onClose();
    toast(cambios.length + ' jornadas cargadas' +
      (sinDueno ? ' · ' + sinDueno + ' sin vigilador reconocido' : ''));
  };

  const reconocidas = jornadas.filter(j => buscarGuardia(j.vigilador)).length;

  return (
    <Sheet visible={abierto} title="Diagrama del supervisor" onClose={onClose}
      footer={jornadas.length ? (
        <>
          <Btn label="Descartar" variant="ghost" style={{ flex: 1 }} onPress={() => setJornadas([])} />
          <Btn label={'Cargar ' + reconocidas + ' jornadas'} disabled={reconocidas !== jornadas.length} variant="primary" style={{ flex: 1 }} onPress={importar} />
        </>
      ) : undefined}>
      {error ? <Stack gap={8}><Banner kind="warn">{error}</Banner><Btn label="Abrir ajustes de IA" variant="ghost" size="sm" onPress={() => { onClose(); router.push('/ajustes'); }} /></Stack> : null}
      {!jornadas.length ? (
        <Stack gap={12}>
          <Hint>
            Sirve el PDF, una captura de pantalla o una foto del papel. La IA lee la grilla y arma
            el diagrama digital: horarios, francos y licencias de cada vigilador.
          </Hint>
          <Btn label="Elegir archivo (PDF, texto o foto)" icon="informes" variant="primary"
            disabled={leyendo} onPress={() => cargar('archivo')} />
          <Row gap={9}>
            <Btn label="Sacar foto" variant="ghost" style={{ flex: 1 }} disabled={leyendo}
              onPress={() => cargar('camara')} />
            <Btn label="De la galería" variant="ghost" style={{ flex: 1 }} disabled={leyendo}
              onPress={() => cargar('galeria')} />
          </Row>
          {leyendo ? (
            <Row gap={10}><ActivityIndicator color={t.accent} /><Hint>Leyendo el diagrama…</Hint></Row>
          ) : null}
        </Stack>
      ) : (
        <Stack gap={12}>
          <Eyebrow>{jornadas.length + ' jornadas leídas' + (fuente ? ' de ' + fuente : '')}</Eyebrow>
          {reconocidas < jornadas.length ? (
            <Banner kind="warn" icon="alerta">
              {(jornadas.length - reconocidas) + ' jornadas necesitan que asignes un vigilador. Seleccione el nombre correspondiente debajo.'}
            </Banner>
          ) : null}
          {[...new Set(jornadas.map(j => j.vigilador))].map(nombre => (
            <Selector key={nombre} label={nombre} valor={buscarGuardia(nombre)?.id || ''}
              onChange={id => setAsignaciones(m => ({ ...m, [nombre]: id }))}
              opciones={[{ v: '', t: 'Elegir vigilador' }, ...gs.map(g => ({ v: g.id, t: g.apellido + ', ' + g.nombre, sub: g.legajo ? 'Legajo ' + g.legajo : undefined }))]} />
          ))}
          <Card>
            {jornadas.slice(pagina * 40, (pagina + 1) * 40).map((j, i, lista) => {
              const g = buscarGuardia(j.vigilador);
              return (
                <Item key={i} last={i === lista.length - 1}
                  lead={dmy(j.fecha).slice(0, 5)}
                  title={g ? g.apellido + ', ' + g.nombre : j.vigilador}
                  subs={[j.tipo === 'turno' || j.tipo === 'extra'
                    ? (j.entrada || '--:--') + ' a ' + (j.salida || '--:--')
                    : j.tipo]}
                  right={g ? undefined : <Tag label="Sin reconocer" kind="warn" />} />
              );
            })}
          </Card>
          {jornadas.length > 40 ? <Row>
            <Btn label="Anterior" size="sm" disabled={pagina === 0} onPress={() => setPagina(p => p - 1)} />
            <Hint>{(pagina + 1) + ' / ' + Math.ceil(jornadas.length / 40)}</Hint>
            <Btn label="Siguiente" size="sm" disabled={(pagina + 1) * 40 >= jornadas.length} onPress={() => setPagina(p => p + 1)} />
          </Row> : null}
        </Stack>
      )}
    </Sheet>
  );
}
