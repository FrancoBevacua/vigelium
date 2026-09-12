import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { franjasDe, nombrePuesto, puestos, nombreFranja } from '../logic';
import { Contacto, Directiva, Franja, Puesto, DOW, titulo, toMin, uid } from '../model';
import { PUESTOS_BASE } from '../seed';
import { interpretarDocumento } from '../importacionIA';
import { leerConfigIA, pedirIA, promptDirectivas, parsearDirectivasIA, ErrorIA, ImagenIA, fichaProveedor } from '../ai';
import { elegirDocumento, elegirFotoDocumento } from '../lectura';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Empty, Stack, Row, Tile,
  Chip, Chipbar, Input, Field, Selector, Sheet, Banner, Hint, Eyebrow, Confirmar, useToast,
} from '../ui';
import EditorDirectiva from './EditorDirectiva';

/* ================= tablero ================= */
export default function Admin() {
  const st = useStore();
  const ir = (r: string) => () => router.push(r as any);
  if (!st.esAdmin) {
    return (
      <Pantalla top>
        <SubCabecera titulo="Administración" onBack={() => router.back()} />
        <Banner kind="warn">
          Esta sección es solo para el administrador del puesto. Pedile a quien administra la app que te asigne el rol.
        </Banner>
      </Pantalla>
    );
  }
  const n = (c: any) => st.list(c).length;
  return (
    <Pantalla top>
      <SubCabecera titulo="Administración" sub="Configuración del objetivo y del equipo." onBack={() => router.back()} />
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="perfil" titulo="Puestos y turnos" sub={n('posts') + ' puestos · ' + n('franjas') + ' turnos'} onPress={ir('/puestos')} />
        <Tile icon="directivas" titulo="Directivas" sub={n('directives') + ' en total'} onPress={ir('/admdirectivas')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="informes" titulo="Importar directivas" sub="Desde PDF o texto" onPress={ir('/importar')} />
        <Tile icon="equipo" titulo="Equipo y roles" sub={n('guards') + ' vigiladores'} onPress={ir('/equipo')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="turnos" titulo="Turnos del equipo" sub="Diagramar a cualquiera" onPress={ir('/turnos')} />
        <Tile icon="accesos" titulo="Catálogo de accesos" sub={n('accesses') + ' accesos'} onPress={ir('/accesos')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="ronda" titulo="Recorridos" sub={n('rtemplates') + ' plantillas'} onPress={ir('/rondas')} />
        <Tile icon="ajustes" titulo="Datos del site" sub={st.S.site.cliente || 'Sin configurar'} onPress={ir('/ajustes')} />
      </Row>
    </Pantalla>
  );
}

/* ================= puestos y turnos ================= */
export function Puestos() {
  const st = useStore();
  const toast = useToast();
  const [editar, setEditar] = useState<Puesto | null | undefined>(undefined);
  const ps = puestos(st.S);

  const sumarTipicos = () => {
    const hay = ps.map(p => p.nombre.toLowerCase());
    const cambios: any[] = [];
    let n = 0;
    PUESTOS_BASE.forEach((p, i) => {
      if (hay.includes(p.n.toLowerCase())) return;
      const id = uid();
      cambios.push({ col: 'posts', obj: { id, nombre: p.n, descripcion: p.d, orden: ps.length + i } });
      p.turnos.forEach((tn, k) => {
        const fid = uid();
        cambios.push({ col: 'franjas', obj: { id: fid, puestoId: id, nombre: tn.nombre, alias: tn.alias, entrada: tn.entrada, salida: tn.salida, orden: k } });
        tn.dirs.forEach(d => cambios.push({
          col: 'directives',
          obj: { id: uid(), hora: d[0], nombre: d[1], novedades: d[2] || '', dias: [], puestoId: id, franjaId: fid, puesto: p.n, activa: true },
        }));
      });
      n++;
    });
    if (!n) { toast('Ya estaban todos cargados'); return; }
    st.putVarios(cambios);
    toast(n + ' puestos agregados con sus turnos y directivas');
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="Puestos y turnos" sub="Cada vigilador elige su puesto y su turno."
        onBack={() => router.back()} />
      {ps.length ? (
        <Card>
          {ps.map((p, i) => {
            const fs = franjasDe(st.S, p.id);
            const nd = st.list<Directiva>('directives').filter(d => d.puestoId === p.id).length;
            return (
              <Item key={p.id} last={i === ps.length - 1} stripe="acc"
                title={p.nombre}
                subs={[
                  p.descripcion,
                  fs.map(f => (f.alias || f.nombre) + ' ' + f.entrada + '–' + f.salida).join('  ·  ') || 'Sin turnos',
                  nd + ' directivas',
                ]}
                onPress={() => setEditar(p)} />
            );
          })}
        </Card>
      ) : <Card><Empty>Sin puestos cargados.</Empty></Card>}
      <Btn label="Nuevo puesto" icon="plus" variant="primary" onPress={() => setEditar(null)} />
      <Btn label="Agregar puestos típicos" variant="ghost" onPress={sumarTipicos} />
      <Hint>Suma los puestos que falten con sus turnos y directivas base. No toca los que ya tiene.</Hint>

      <EditorPuesto abierto={editar !== undefined} puesto={editar || null} onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}

function EditorPuesto({ abierto, puesto, onClose }: { abierto: boolean; puesto: Puesto | null; onClose: () => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [desc, setDesc] = useState('');
  const [borrar, setBorrar] = useState(false);
  const [turno, setTurno] = useState<Franja | null | undefined>(undefined);

  useEffect(() => {
    if (!abierto) return;
    setNombre(puesto?.nombre || '');
    setDesc(puesto?.descripcion || '');
  }, [abierto, puesto?.id]);

  const fs = puesto ? franjasDe(st.S, puesto.id) : [];

  return (
    <>
      <Sheet visible={abierto} title={puesto ? 'Editar puesto' : 'Nuevo puesto'} onClose={onClose}
        footer={
          <>
            {puesto ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
            <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
              if (!nombre.trim()) { toast('Ingrese un nombre'); return; }
              st.put('posts', {
                id: puesto?.id || uid(), nombre, descripcion: desc,
                orden: puesto?.orden ?? puestos(st.S).length,
              });
              onClose(); toast('Puesto guardado');
            }} />
          </>
        }>
        <Input label="Nombre del puesto" value={nombre} onChangeText={setNombre} placeholder="Playa 1" />
        <Input label="Descripción" value={desc} onChangeText={setDesc} multiline rows={2}
          placeholder="Playa de estacionamiento: barreras, circulación y bicicletero." />

        {puesto ? (
          <>
            <Eyebrow>Turnos del puesto</Eyebrow>
            <Card>
              {fs.length ? fs.map((f, i) => (
                <Item key={f.id} last={i === fs.length - 1}
                  lead={f.entrada} title={f.alias ? f.nombre + ' — ' + f.alias : f.nombre}
                  subs={[f.entrada + ' a ' + f.salida]}
                  right={<Tag label={String(st.list<Directiva>('directives').filter(d => d.franjaId === f.id).length) + ' dir.'} kind="mute" />}
                  onPress={() => setTurno(f)} />
              )) : <Empty>Este puesto todavía no tiene turnos.</Empty>}
            </Card>
            <Btn label="Agregar turno" icon="plus" variant="ghost" size="sm" onPress={() => setTurno(null)} />
          </>
        ) : (
          <Hint>Guarde el puesto y después le cargás los turnos.</Hint>
        )}

        <Confirmar visible={borrar}
          mensaje="¿Eliminar el puesto? Sus turnos se borran y sus directivas quedan sin puesto."
          onCancel={() => setBorrar(false)}
          onOk={() => {
            if (puesto) {
              franjasDe(st.S, puesto.id).forEach(f => st.drop('franjas', f.id));
              st.list<Directiva>('directives').forEach(d => {
                if (d.puestoId === puesto.id) st.put('directives', { ...d, puestoId: '', franjaId: '' });
              });
              st.drop('posts', puesto.id);
            }
            setBorrar(false); onClose(); toast('Puesto eliminado');
          }} />
      </Sheet>

      {puesto ? (
        <EditorTurno abierto={turno !== undefined} franja={turno || null} puestoId={puesto.id}
          onClose={() => setTurno(undefined)} />
      ) : null}
    </>
  );
}

function EditorTurno({ abierto, franja, puestoId, onClose }: {
  abierto: boolean; franja: Franja | null; puestoId: string; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [nombre, setNombre] = useState('Mañana');
  const [alias, setAlias] = useState('');
  const [entrada, setEntrada] = useState('06:00');
  const [salida, setSalida] = useState('14:00');
  const [borrar, setBorrar] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(franja?.nombre || 'Mañana');
    setAlias(franja?.alias || '');
    setEntrada(franja?.entrada || '06:00');
    setSalida(franja?.salida || '14:00');
  }, [abierto, franja?.id]);

  return (
    <Sheet visible={abierto} title={franja ? 'Editar turno' : 'Nuevo turno'} onClose={onClose}
      footer={
        <>
          {franja ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            st.put('franjas', {
              id: franja?.id || uid(), puestoId, nombre, alias, entrada, salida,
              orden: franja?.orden ?? franjasDe(st.S, puestoId).length,
            });
            onClose(); toast('Turno guardado');
          }} />
        </>
      }>
      <Field label="Turno">
        <Chipbar>
          {['Mañana', 'Tarde', 'Noche'].map(x => (
            <Chip key={x} label={x} on={nombre === x} onPress={() => setNombre(x)} />
          ))}
        </Chipbar>
      </Field>
      <Input label="Nombre" value={nombre} onChangeText={setNombre} />
      <Input label="Alias (opcional)" value={alias} onChangeText={setAlias} placeholder="Rondín nocturno"
        hint="Si el turno tiene un nombre propio en el objetivo." />
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Input label="Entrada" value={entrada} onChangeText={setEntrada} mono /></View>
        <View style={{ flex: 1 }}><Input label="Salida" value={salida} onChangeText={setSalida} mono /></View>
      </Row>
      <Hint>Si la salida es menor que la entrada, la app entiende que el turno cruza la medianoche.</Hint>
      <Confirmar visible={borrar} mensaje="¿Eliminar este turno? Sus directivas quedan en el puesto, sin turno."
        onCancel={() => setBorrar(false)}
        onOk={() => {
          if (franja) {
            st.list<Directiva>('directives').forEach(d => {
              if (d.franjaId === franja.id) st.put('directives', { ...d, franjaId: '' });
            });
            st.drop('franjas', franja.id);
          }
          setBorrar(false); onClose();
        }} />
    </Sheet>
  );
}

/* ================= directivas por puesto ================= */
export function AdmDirectivas() {
  const st = useStore();
  const ps = puestos(st.S);
  const [pid, setPid] = useState(ps[0]?.id || '');
  const [editar, setEditar] = useState<Directiva | null | undefined>(undefined);

  const ds = st.list<Directiva>('directives')
    .filter(d => (d.puestoId || '') === pid)
    .sort((a, b) => toMin(a.hora) - toMin(b.hora));
  const huerfanas = st.list<Directiva>('directives').filter(d => !d.puestoId).length;

  return (
    <Pantalla top>
      <SubCabecera titulo="Directivas por puesto" sub="Se aplican a todos los vigiladores del turno."
        onBack={() => router.back()} />
      <Chipbar>
        {ps.map(p => <Chip key={p.id} label={p.nombre} on={pid === p.id} onPress={() => setPid(p.id)} />)}
        {huerfanas ? <Chip label={'Sin puesto (' + huerfanas + ')'} on={pid === ''} onPress={() => setPid('')} /> : null}
      </Chipbar>

      {ds.length ? (
        <Card>
          {ds.map((d, i) => (
            <Item key={d.id} last={i === ds.length - 1} stripe={d.activa === false ? 'mute' : 'acc'}
              lead={d.hora || '--:--'} title={d.nombre}
              subs={[
                d.novedades,
                (d.dias?.length && d.dias.length < 7 ? d.dias.map(x => DOW[x]).join(' ') : 'Todos los días') +
                (d.franjaId ? ' · ' + nombreFranja(st.S, d.franjaId) : ' · Todos los turnos'),
              ]}
              right={d.activa === false ? <Tag label="Pausada" kind="mute" /> : undefined}
              onPress={() => setEditar(d)} />
          ))}
        </Card>
      ) : <Card><Empty>Este puesto no tiene directivas cargadas todavía.</Empty></Card>}

      <Row gap={9}>
        <Btn label="Importar" variant="ghost" style={{ flex: 1 }} onPress={() => router.push('/importar')} />
        <Btn label="Nueva" icon="plus" variant="primary" style={{ flex: 1 }} onPress={() => setEditar(null)} />
      </Row>

      <EditorDirectiva abierto={editar !== undefined} directiva={editar || null} onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}

/* ================= importador ================= */
type ItemImp = {
  hora: string; nombre: string; novedades: string;
  puesto: string; puestoId: string; franjaId: string; off?: boolean;
};

export function Importar() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [texto, setTexto] = useState('');
  const [items, setItems] = useState<ItemImp[]>([]);
  const [destino, setDestino] = useState('');
  const [destinoFranja, setDestinoFranja] = useState('');
  const [editando, setEditando] = useState<number | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [adjunto, setAdjunto] = useState<ImagenIA | undefined>();
  const [error, setError] = useState('');
  const [avance, setAvance] = useState('');
  const lectura = useRef(0);
  useEffect(() => () => { lectura.current++; }, []);

  const norm = (x: string) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  /* busca el puesto y el turno que nombró el documento */
  const resolver = (nombrePuestoTexto: string, nombreTurno: string) => {
    const ps = puestos(st.S);
    let pid = '';
    if (nombrePuestoTexto) {
      const q = norm(nombrePuestoTexto);
      const similares = ps.filter(p => norm(p.nombre).includes(q) || q.includes(norm(p.nombre)));
      const m = ps.find(p => norm(p.nombre) === q) || (similares.length === 1 ? similares[0] : undefined);
      if (m) pid = m.id;
    }
    let fid = '';
    if (pid && nombreTurno) {
      const q = norm(nombreTurno);
      const f = franjasDe(st.S, pid).find(x => norm(x.nombre) === q || norm(x.alias || '') === q) ||
        franjasDe(st.S, pid).find(x => norm(x.nombre).includes(q) || q.includes(norm(x.nombre)));
      if (f) fid = f.id;
    }
    return { pid, fid };
  };

  const interpretarIA = async (crudo: string, imagen?: ImagenIA) => {
    if (!imagen && (!crudo || crudo.trim().length < 20)) { toast('Primero cargue el documento o pegá el texto'); return; }
    const numero = ++lectura.current;
    setPensando(true); setError(''); setItems([]);
    try {
      const cfg = await leerConfigIA();
      if (imagen && !fichaProveedor(cfg.proveedor)?.vision) throw new Error('Seleccione un proveedor que lea documentos e imágenes, como Gemini.');
      const ps = puestos(st.S);
      const turnos = Array.from(new Set(st.list<Franja>('franjas').map(f => f.nombre)));
      const leidas = await interpretarDocumento(crudo, ps.map(p => p.nombre), turnos, cfg, imagen,
        (hechas, total) => setAvance('Leyendo el documento: ' + hechas + ' de ' + total + ' partes.'), () => lectura.current === numero);
      setItems(leidas.map(d => {
        const { pid, fid } = resolver(d.puesto, d.turno);
        return {
          hora: d.hora, nombre: d.nombre, novedades: d.novedades,
          puesto: d.puesto, puestoId: pid, franjaId: fid,
        };
      }));
      if (crudo) setTexto(crudo);
      toast(leidas.length + ' directivas interpretadas por la IA. Revisalas antes de importar.');
    } catch (e: any) {
      if (lectura.current === numero) setError(e.message || 'No se pudo consultar la IA');
    } finally { if (lectura.current === numero) setPensando(false); }
  };

  const cargar = async (origen: 'archivo' | 'camara' | 'galeria') => {
    setLeyendo(true);
    try {
      const doc = origen === 'archivo' ? await elegirDocumento() : await elegirFotoDocumento(origen === 'camara');
      if (doc.clase === 'vacio') { if (doc.motivo) toast(doc.motivo); return; }
      lectura.current++; setItems([]); setError('');
      if (doc.clase === 'texto') { setTexto(doc.texto); setAdjunto(undefined); }
      else { setTexto(''); setAdjunto(doc.imagen); }

    } catch (e: any) { toast(e?.message || 'No se pudo abrir el documento'); }
    finally { setLeyendo(false); }
  };

  const importar = () => {
    const vivos = items.filter(x => !x.off);
    if (!vivos.length) { toast('No hay directivas para importar'); return; }
    const cambios: any[] = [];
    const nuevos: Record<string, string> = {};
    vivos.forEach(it => {
      let pid = it.puestoId;
      if (!pid && it.puesto) {
        const clave = norm(it.puesto);
        if (!nuevos[clave]) {
          const id = uid();
          nuevos[clave] = id;
          cambios.push({ col: 'posts', obj: { id, nombre: titulo(it.puesto), descripcion: '', orden: puestos(st.S).length } });
        }
        pid = nuevos[clave];
      }
      if (!pid) pid = destino;
      cambios.push({
        col: 'directives',
        obj: {
          id: uid(), hora: it.hora, nombre: it.nombre, novedades: it.novedades, dias: [],
          puestoId: pid, franjaId: it.franjaId || (pid === destino ? destinoFranja : '') || '',
          puesto: nombrePuesto(st.S, pid) || titulo(it.puesto), activa: true,
        },
      });
    });
    st.putVarios(cambios);
    const np = Object.keys(nuevos).length;
    setItems([]); setTexto(''); setAdjunto(undefined);
    toast(vivos.length + ' directivas importadas' + (np ? ' y ' + np + ' puestos creados' : ''));
    router.push('/admdirectivas');
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="Importar directivas"
        sub="Cargue el PDF de las directivas del objetivo y la app las ordena por horario."
        onBack={() => router.back()} />

      <Card pad>
        <Stack gap={12}>
          <Btn label={leyendo ? 'Leyendo el documento…' : 'Elegir archivo (PDF, texto o foto)'} icon="informes"
            variant="primary" disabled={leyendo || pensando} onPress={() => cargar('archivo')} />
          <Row gap={9}>
            <Btn label="Sacar foto" variant="ghost" style={{ flex: 1 }} disabled={leyendo || pensando}
              onPress={() => cargar('camara')} />
            <Btn label="De la galería" variant="ghost" style={{ flex: 1 }} disabled={leyendo || pensando}
              onPress={() => cargar('galeria')} />
          </Row>
          <Hint>
            Un PDF de texto se lee de inmediato. Si el documento está escaneado o le toma una foto,
            lo interpreta la IA: para eso hace falta un proveedor que lea imágenes, como Gemini.
          </Hint>
          <Input label="O pegá el texto de las directivas" value={texto} onChangeText={v => { lectura.current++; setTexto(v); setItems([]); setAdjunto(undefined); }}
            multiline rows={6} fixedHeight editable={!pensando}
            placeholder={'PUESTO: Paseo\n06:00 Recepción del puesto y relevo\n…'} />
          {adjunto ? <Hint>Documento adjunto listo para interpretar.</Hint> : null}
          <Btn label={pensando ? 'Interpretando…' : 'Interpretar con IA'} icon="bell" variant="primary" disabled={pensando || leyendo} onPress={() => interpretarIA(texto, adjunto)} />
          {pensando ? <Row><ActivityIndicator color={t.accent} /><Hint>{avance || 'La IA está leyendo el documento…'}</Hint></Row> : null}
          {error ? <Banner kind="warn">{error}</Banner> : null}
          <Hint>La IA extrae y organiza las directivas por puesto y turno. Revise el resultado antes de importarlo.</Hint>
        </Stack>
      </Card>

      {items.length ? (
        <>
          <Eyebrow>{items.length + ' directivas detectadas'}</Eyebrow>
          <Card>
            {items.map((d, i) => (
              <Item key={i} last={i === items.length - 1} stripe={d.off ? 'mute' : 'acc'}
                lead={d.hora} title={d.nombre}
                subs={[d.novedades, d.puestoId ? nombrePuesto(st.S, d.puestoId) : (d.puesto || 'Sin puesto')]}
                right={
                  <Btn label={d.off ? 'Incluir' : 'Quitar'} variant="ghost" size="xs"
                    onPress={() => setItems(xs => xs.map((x, j) => (j === i ? { ...x, off: !x.off } : x)))} />
                }
                onPress={() => setEditando(i)} />
            ))}
          </Card>
          <Selector label="Puesto para las que no tienen" valor={destino}
            onChange={v => { setDestino(v); setDestinoFranja(''); }}
            opciones={[{ v: '', t: 'Dejar sin puesto' }, ...puestos(st.S).map(p => ({ v: p.id, t: p.nombre }))]} />
          {destino ? (
            <Selector label="Turno para las que no tienen" valor={destinoFranja} onChange={setDestinoFranja}
              opciones={[
                { v: '', t: 'Todos los turnos' },
                ...franjasDe(st.S, destino).map(f => ({ v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre, sub: f.entrada + ' a ' + f.salida })),
              ]} />
          ) : null}
          <Btn label={'Importar ' + items.filter(d => !d.off).length + ' directivas'} variant="primary" onPress={importar} />
        </>
      ) : null}

      <RevisarItem indice={editando} items={items} setItems={setItems} onClose={() => setEditando(null)} />
    </Pantalla>
  );
}

function RevisarItem({ indice, items, setItems, onClose }: {
  indice: number | null; items: ItemImp[]; setItems: (f: (x: ItemImp[]) => ItemImp[]) => void; onClose: () => void;
}) {
  const st = useStore();
  const [hora, setHora] = useState('');
  const [nombre, setNombre] = useState('');
  const [nov, setNov] = useState('');
  const [pid, setPid] = useState('');
  const [fid, setFid] = useState('');

  useEffect(() => {
    if (indice == null) return;
    const it = items[indice];
    setHora(it.hora); setNombre(it.nombre); setNov(it.novedades);
    setPid(it.puestoId); setFid(it.franjaId);
  }, [indice]);

  if (indice == null) return null;

  return (
    <Sheet visible title="Revisar directiva" onClose={onClose}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          <Btn label="Listo" variant="primary" style={{ flex: 1 }} onPress={() => {
            setItems(xs => xs.map((x, j) => (j === indice
              ? { ...x, hora, nombre, novedades: nov, puestoId: pid, franjaId: fid } : x)));
            onClose();
          }} />
        </>
      }>
      <Input label="Hora" value={hora} onChangeText={setHora} mono />
      <Input label="Nombre" value={nombre} onChangeText={setNombre} />
      <Input label="Novedades" value={nov} onChangeText={setNov} multiline rows={3} />
      <Selector label="Puesto" valor={pid} onChange={v => { setPid(v); setFid(''); }}
        opciones={[{ v: '', t: 'Sin puesto' }, ...puestos(st.S).map(p => ({ v: p.id, t: p.nombre }))]} />
      <Selector label="Turno" valor={fid} onChange={setFid}
        opciones={[
          { v: '', t: 'Todos los turnos' },
          ...franjasDe(st.S, pid).map(f => ({ v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre })),
        ]} />
    </Sheet>
  );
}

/* ================= contactos ================= */
export function Contactos() {
  const st = useStore();
  const [editar, setEditar] = useState<Contacto | null | undefined>(undefined);
  const cs = st.list<Contacto>('contacts');
  return (
    <Pantalla top>
      <SubCabecera titulo="Contactos del puesto" sub="Los números que necesitás a mano en una emergencia."
        onBack={() => router.back()} />
      {cs.length ? (
        <Card>
          {cs.map((c, i) => (
            <Item key={c.id} last={i === cs.length - 1} title={c.nombre} subs={[c.rol, c.tel]}
              onPress={() => setEditar(c)} />
          ))}
        </Card>
      ) : (
        <Card><Empty>Cargue acá CCTV, supervisor, jefatura, bomberos, policía y emergencias médicas.</Empty></Card>
      )}
      <Btn label="Agregar contacto" icon="plus" variant="primary" onPress={() => setEditar(null)} />
      <EditorContacto abierto={editar !== undefined} contacto={editar || null} onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}

function EditorContacto({ abierto, contacto, onClose }: { abierto: boolean; contacto: Contacto | null; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState('');
  const [tel, setTel] = useState('');
  const [borrar, setBorrar] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setNombre(contacto?.nombre || ''); setRol(contacto?.rol || ''); setTel(contacto?.tel || '');
  }, [abierto, contacto?.id]);

  return (
    <Sheet visible={abierto} title={contacto ? 'Editar contacto' : 'Nuevo contacto'} onClose={onClose}
      footer={
        <>
          {contacto ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            if (!nombre.trim()) { toast('Falta el nombre'); return; }
            st.put('contacts', { id: contacto?.id || uid(), nombre, rol, tel });
            onClose(); toast('Contacto guardado');
          }} />
        </>
      }>
      <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="CCTV Libertad" />
      <Input label="Rol" value={rol} onChangeText={setRol} placeholder="Central de monitoreo" />
      <Input label="Teléfono" value={tel} onChangeText={setTel} mono keyboardType="phone-pad" />
      <Confirmar visible={borrar} mensaje="¿Eliminar este contacto?"
        onCancel={() => setBorrar(false)}
        onOk={() => { if (contacto) st.drop('contacts', contacto.id); setBorrar(false); onClose(); }} />
    </Sheet>
  );
}
