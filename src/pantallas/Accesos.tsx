import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { motivoSoloLectura, turnoAbierto } from '../servicio';
import ServicioActual from './ServicioActual';
import { alogsDe, catalogoAccesos, ultimoPrecinto } from '../logic';
import {
  AccesoLog, AccesoCat, DOW,
  addDays, dmy, hhmm, isoDate, parseISO, uid,
  prefijoPrecinto, sufijoPrecinto, armarPrecinto, soloDigitos,
} from '../model';
import { gsName, textoInformeAccesos, textoAlogLibro, lineaPrecintos, OpcInforme } from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, Cabecera, Card, Btn, Tag, Seg, Item, Empty, Stack, Row, Chip, Chipbar,
  Input, Selector, Sheet, Toggle, Field, Eyebrow, useToast, Hint, Banner,
} from '../ui';

export default function Accesos() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [modo, setModo] = useState('reg');
  const [fecha, setFecha] = useState(isoDate());
  const [editar, setEditar] = useState<AccesoLog | null | undefined>(undefined);
  const [cat, setCat] = useState<AccesoCat | null | undefined>(undefined);
  const [informe, setInforme] = useState(false);


  const rows = alogsDe(st.S, fecha);
  const ap = rows.filter(r => r.tipo === 'apertura').length;
  const ci = rows.length - ap;
  const catalogo = catalogoAccesos(st.S);

  return (
    <Pantalla>
      <Cabecera titulo="Accesos" sub="Aperturas y cierres con precinto, listos para pasar al CCTV."
        derecha={modo === 'reg' ? <Btn icon="plus" variant="primary" onPress={() => setEditar(null)} /> : undefined} />

      <Seg acento valor={modo} onChange={setModo}
        opciones={[{ v: 'reg', t: 'Registros' }, { v: 'cat', t: 'Catálogo' }]} />

      {modo === 'reg' ? (
        <Stack gap={14}>
          <Row>
            <Btn icon="back" variant="ghost" size="sm" onPress={() => setFecha(f => addDays(f, -1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 18, color: t.text }}>
                {DOW[parseISO(fecha).getDay()] + ' ' + dmy(fecha)}
              </Text>
              <Hint>{ap + ' apertura' + (ap === 1 ? '' : 's') + ' · ' + ci + ' cierre' + (ci === 1 ? '' : 's')}</Hint>
            </View>
            <Btn icon="back" variant="ghost" size="sm" style={{ transform: [{ scaleX: -1 }] }}
              onPress={() => setFecha(f => addDays(f, 1))} />
          </Row>

          {rows.length ? (
            <>
              <Card>
                {rows.map((r, i) => (
                  <Item key={r.id} last={i === rows.length - 1}
                    stripe={r.tipo === 'apertura' ? 'acc' : 'info'}
                    lead={r.hora} title={r.acceso}
                    tituloLineas={1} lineas={1}
                    subs={[r.gs, lineaPrecintos(r).replace('\n', ' · ') || r.nota || null]}
                    right={<Tag label={r.tipo === 'apertura' ? 'Apert.' : 'Cierre'} kind={r.tipo === 'apertura' ? 'acc' : 'info'} />}
                    onPress={() => setEditar(r)} />
                ))}
              </Card>
              <Btn label="Generar informe para CCTV" icon="copy" variant="primary" onPress={() => setInforme(true)} />
            </>
          ) : (
            <Card><Empty>Sin registros para este día. Seleccione el botón + para cargar la primera apertura o cierre.</Empty></Card>
          )}
        </Stack>
      ) : (
        <Stack gap={14}>
          {catalogo.length ? (
            <Card>
              {catalogo.map((c, i) => (
                <Item key={c.id} last={i === catalogo.length - 1} lead={String(i + 1)}
                  title={c.nombre}
                  subs={[c.tipo.charAt(0).toUpperCase() + c.tipo.slice(1) + ' · ' +
                    (c.precintos ? c.precintos + ' precinto' + (c.precintos > 1 ? 's' : '') : 'sin precinto')]}
                  onPress={() => setCat(c)} />
              ))}
            </Card>
          ) : (
            <Card><Empty>Cargue acá las puertas, portones y accesos de su puesto. Después los seleccionás de una lista.</Empty></Card>
          )}
          <Btn label="Agregar acceso al catálogo" icon="plus" variant="ghost" onPress={() => setCat(null)} />
        </Stack>
      )}

      <EditorAlog abierto={editar !== undefined} registro={editar || null} fecha={fecha}
        onClose={() => setEditar(undefined)} />
      <EditorCatalogo abierto={cat !== undefined} item={cat || null} onClose={() => setCat(undefined)} />
      <HojaInforme visible={informe} fecha={fecha} onClose={() => setInforme(false)} />
    </Pantalla>
  );
}

/* ---------------- registro de apertura o cierre ---------------- */
function EditorAlog({ abierto, registro, fecha, onClose }: {
  abierto: boolean; registro: AccesoLog | null; fecha: string; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [tipo, setTipo] = useState<'apertura' | 'cierre'>('apertura');
  const [acceso, setAcceso] = useState('');
  const [hora, setHora] = useState(hhmm());
  const [guardId, setGuardId] = useState('');
  const [p1, setP1] = useState('');   // solo los últimos tres dígitos
  const [p2, setP2] = useState('');
  const [nota, setNota] = useState('');

  const catalogo = catalogoAccesos(st.S);
  const sug = ultimoPrecinto(st.S);
  /* El prefijo sale del último precinto cargado; si todavía no hay ninguno,
     del que esté guardado en Ajustes. */
  const pref = prefijoPrecinto(sug) || soloDigitos(st.S.site.precintoPrefijo).slice(0, 4);

  useEffect(() => {
    if (!abierto) return;
    setTipo((registro?.tipo as any) || 'apertura');
    setAcceso(registro?.acceso || '');
    setHora(registro?.hora || hhmm());
    setGuardId(registro?.guardId || '');
    setP1(registro?.p1 || '');
    setP2(registro?.p2 || '');
    setNota(registro?.nota || '');
  }, [abierto, registro?.id]);

  const elegir = (c: AccesoCat) => {
    setAcceso(c.nombre);
  };

  const guardar = () => {
    if (!acceso.trim()) { toast('Indique el acceso'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) { toast('Ingrese una hora válida (HH:MM)'); return; }
    if ([p1, p2].some(p => p && !(p.length === 7 || (p.length === 3 && pref.length === 4) || (registro && [registro.p1, registro.p2].includes(p))))) {
      toast('El precinto debe tener 7 números, o los últimos 3 si hay un prefijo guardado'); return;
    }
    const g = st.byId<any>('guards', guardId);
    if(!g||g.deleted){toast('Seleccione el vigilador que realizó la novedad');return;}
    const n1 = pref ? armarPrecinto(pref, p1) : soloDigitos(p1);
    const n2 = pref ? armarPrecinto(pref, p2) : soloDigitos(p2);
    const nuevoPref = prefijoPrecinto(n2 || n1) || pref;
    const id = registro?.id || uid();
    const vinculadas = st.list<any>('novedades').filter(n => n.alogId === id);
    const novId = registro?.novId || vinculadas[0]?.id || (st.S.site.alogLibro ? uid() : undefined);
    const r = {
      id, tipo, hora: hora || hhmm(), guardId: g.id,
      gs: gsName(g, st.S.site), acceso, p1: n1, p2: n2,
      nota, fecha,
      orden: registro?.orden ?? Date.now(),
      novId, p1tipo: '', p2tipo: '',
    };
    const cambios: any[] = [{ col: 'alogs', obj: r }];
    if (!st.list<AccesoCat>('accesses').some(c => c.nombre.toLowerCase() === acceso.toLowerCase())) {
      cambios.push({ col: 'accesses', obj: {
        id: uid(), nombre: acceso, tipo: 'acceso',
        precintos: n2 ? 2 : n1 ? 1 : 0, orden: Date.now(),
      } });
    }
    if (novId) {
      cambios.push({ col: 'novedades', obj: {
        id: novId, fecha: r.fecha, hora: r.hora, guardId: r.guardId,
        categoria: 'Acceso', texto: textoAlogLibro(r as any), alogId: r.id, acc: null,
      } });
      vinculadas.filter(n => n.id !== novId).forEach(n => cambios.push({ col: 'novedades', obj: { id: n.id, deleted: true } }));
    }
    st.putVarios(cambios);
    if (nuevoPref) st.setSite({ precintoPrefijo: nuevoPref });
    onClose();
    toast('Registro guardado');
  };

  const motivo = registro ? motivoSoloLectura(st.S, { ...registro, guardId: registro.createdBy || registro.guardId } as any, st.me?.id) : '';
  if (motivo) return <Sheet visible={abierto} title="Detalle del acceso" onClose={onClose}><Banner kind="info">{motivo}</Banner><Input label="Registro" value={textoAlogLibro(registro!)} editable={false} multiline rows={8} /></Sheet>;
  if (!turnoAbierto(st.S, st.me?.id)) return <Sheet visible={abierto} title="Registrar acceso" onClose={onClose}><ServicioActual /></Sheet>;

  return (
    <Sheet visible={abierto} title={registro ? 'Editar registro' : 'Registrar acceso'} onClose={onClose}
      footer={
        <>
          {registro ? (
            <Btn icon="trash" variant="danger" onPress={() => {
              st.putVarios([{ col: 'alogs', obj: { id: registro.id, deleted: true } },
                ...st.list<any>('novedades').filter(n => n.alogId === registro.id || n.id === registro.novId).map(n => ({ col: 'novedades' as const, obj: { id: n.id, deleted: true } }))]); onClose(); toast('Registro eliminado');
            }} />
          ) : null}
          <Btn label={registro ? 'Guardar' : 'Agregar a la lista'} variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Seg acento valor={tipo} onChange={v => setTipo(v as any)}
        opciones={[{ v: 'apertura', t: 'Apertura' }, { v: 'cierre', t: 'Cierre' }]} />
      {catalogo.length ? (
        <Field label="Acceso">
          <Chipbar>
            {catalogo.map(c => <Chip key={c.id} label={c.nombre} on={acceso === c.nombre} onPress={() => elegir(c)} />)}
          </Chipbar>
        </Field>
      ) : null}
      <Input label="Nombre del acceso" value={acceso} onChangeText={setAcceso} placeholder="Portón ingreso Oroño" />
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input label="Hora" value={hora} onChangeText={setHora} mono keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Selector label="Vigilador" valor={guardId} onChange={setGuardId}
            opciones={[{v:'',t:'Seleccione el vigilador'},...st.list<any>('guards')
              .slice().sort((a, b) => a.apellido.localeCompare(b.apellido))
              .map(g => ({ v: g.id, t: gsName(g, st.S.site) }))]} />
        </View>
      </Row>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input label="Precinto N°" value={p1}
            onChangeText={v => setP1(soloDigitos(v).slice(0, 7))}
            mono keyboardType="number-pad" maxLength={7} placeholder={pref} />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Segundo precinto" value={p2}
            onChangeText={v => setP2(soloDigitos(v).slice(0, 7))}
            mono keyboardType="number-pad" maxLength={7} placeholder={pref} />
        </View>
      </Row>
      <Input label="Nota (opcional)" value={nota} onChangeText={setNota} placeholder="Camión de descarga KFC" />
    </Sheet>
  );
}

/* ---------------- catálogo ---------------- */
function EditorCatalogo({ abierto, item, onClose }: { abierto: boolean; item: AccesoCat | null; onClose: () => void }) {
  const st = useStore();
  const toast = useToast();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('porton');
  const [precintos, setPrecintos] = useState('1');

  useEffect(() => {
    if (!abierto) return;
    setNombre(item?.nombre || '');
    setTipo(item?.tipo || 'porton');
    setPrecintos(String(item?.precintos ?? 1));
  }, [abierto, item?.id]);

  return (
    <Sheet visible={abierto} title={item ? 'Editar acceso' : 'Nuevo acceso'} onClose={onClose}
      footer={
        <>
          {item ? <Btn icon="trash" variant="danger" onPress={() => { st.drop('accesses', item.id); onClose(); toast('Acceso quitado'); }} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={() => {
            if (!nombre.trim()) { toast('Ingrese un nombre'); return; }
            st.put('accesses', {
              id: item?.id || uid(), nombre, tipo, precintos: +precintos,
              orden: item?.orden ?? Date.now(),
            });
            onClose(); toast('Acceso guardado');
          }} />
        </>
      }>
      <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Portón ingreso Oroño" />
      <Selector label="Tipo" valor={tipo} onChange={setTipo} opciones={[
        { v: 'puerta', t: 'Puerta' }, { v: 'porton', t: 'Portón' },
        { v: 'pecera', t: 'Pecera' }, { v: 'acceso', t: 'Acceso' }]} />
      <Selector label="Precintos" valor={precintos} onChange={setPrecintos} opciones={[
        { v: '0', t: 'Sin precinto' }, { v: '1', t: 'Un precinto' }, { v: '2', t: 'Dos precintos' }]} />
    </Sheet>
  );
}

/* ---------------- informe para CCTV ---------------- */
function HojaInforme({ visible, fecha, onClose }: { visible: boolean; fecha: string; onClose: () => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [o, setO] = useState<OpcInforme>({ orden: 'carga', tipo: 'ambos', encabezado: false });
  const texto = textoInformeAccesos(alogsDe(st.S, fecha), fecha, o, st.S.site);

  return (
    <Sheet visible={visible} title="Informe para CCTV" onClose={onClose}
      footer={
        <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
          onPress={async () => { await Clipboard.setStringAsync(texto); toast('Informe copiado. Péguelo en el chat del CCTV.'); }} />
      }>
      <Field label="Incluir">
        <Seg valor={o.tipo} onChange={v => setO(x => ({ ...x, tipo: v as any }))}
          opciones={[{ v: 'ambos', t: 'Todo' }, { v: 'apertura', t: 'Aperturas' }, { v: 'cierre', t: 'Cierres' }]} />
      </Field>
      <Field label="Ordenar por">
        <Chipbar>
          {[['carga', 'Orden de carga'], ['hora', 'Hora'], ['guardia', 'Vigilador'], ['acceso', 'Acceso']].map(([v, lab]) => (
            <Chip key={v} label={lab} on={o.orden === v} onPress={() => setO(x => ({ ...x, orden: v as any }))} />
          ))}
        </Chipbar>
      </Field>
      <Toggle label="Encabezado con fecha y site" value={o.encabezado}
        onChange={v => setO(x => ({ ...x, encabezado: v }))} />
      <Eyebrow>Vista previa</Eyebrow>
      <View style={{
        backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14,
      }}>
        <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12.5, lineHeight: 20, color: t.text }}>
          {texto || 'Sin registros para el filtro elegido.'}
        </Text>
      </View>
    </Sheet>
  );
}
