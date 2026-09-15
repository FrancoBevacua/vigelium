/* Informe general de las novedades de 12 o 24 horas, el que va al supervisor.
   Se arma solo con lo que ya está cargado en el turno; el vigilador elige la
   ventana horaria, agrega lo que falte, adjunta evidencia y lo exporta. */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import {
  InformeDia, Novedad, addDays, dmy, hhmm, isoDate, uid, pad2, toMin,
} from '../model';
import {
  EntradaDia, entradasDeVentana, textoInformeDia, cierrePorDefecto, ventanaHoy, horaCorte, hayTrascendentes, resumenCorto, validarRedaccionDia,
  limites, horaFin, ventanaParaEntrega, ventanaReciente,
} from '../informedia';
import { CATEGORIAS } from '../seed';
import { asistir } from '../assistant';
import { leerConfigIA, pedirIA, promptInformeDia, ErrorIA } from '../ai';
import { pdfInformeDia } from '../pdf';
import { gsName } from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Item, Empty, Stack, Row, Chip, Chipbar,
  Input, Field, Sheet, Eyebrow, Hint, Banner, Tag, Toggle, useToast,
} from '../ui';
import { EditorNovedad } from './Novedades';
import ImportarLibro from './ImportarLibro';
import ServicioActual from './ServicioActual';
import RedaccionIA from './RedaccionIA';
import { turnoAbierto, fechaValida } from '../servicio';

export default function InformeDiaPantalla() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();

  const [fechaEntrega, setFechaEntrega] = useState(() => isoDate());
  const [corte, setCorte] = useState(() => horaCorte(st.S));
  const [duracion,setDuracion]=useState<12|24>(24);
  const [guardando,setGuardando]=useState(false);
  const [cierrePersonal, setCierrePersonal] = useState<string | null>(null);
  const [marcadoTrascendente, setMarcadoTrascendente] = useState(false);
  const [fotos, setFotos] = useState<string[]>([]);
  const [editar, setEditar] = useState<Novedad | null | undefined>(undefined);
  const [vista, setVista] = useState(false);
  const [leerLibro, setLeerLibro] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [texto, setTexto] = useState('');
  const [fuente, setFuente] = useState('');
  const [detalle, setDetalle] = useState<EntradaDia | null>(null);

  const fechaCorrecta=fechaValida(fechaEntrega);
  const ventana = ventanaParaEntrega(fechaCorrecta?fechaEntrega:isoDate(),corte,duracion);
  const {fecha}=ventana,fin=horaFin(ventana),hasta=limites(ventana).hasta.fecha;
  const entradas = useMemo(() => fechaCorrecta?entradasDeVentana(st.S, ventana):[], [st.S, fecha, corte,duracion,fechaCorrecta]);

  /* El informe guardado de esta ventana, si ya se hizo uno. */
  const guardado = st.list<InformeDia>('infdias').find(x => x.fecha === fecha && x.desde === corte && (x.duracion??24)===duracion);
  const detectadas = hayTrascendentes(st.S, ventana);
  const trascendentes = detectadas || marcadoTrascendente;
  const cierreDefault = cierrePorDefecto(st.S, ventana);
  const cierre = cierrePersonal ?? (trascendentes ? '' : cierreDefault);

  useEffect(() => {
    setCierrePersonal(guardado && guardado.cierre !== cierrePorDefecto(st.S, ventana) ? guardado.cierre : null);
    setMarcadoTrascendente(guardado?.trascendentes || false);
    setFotos(guardado?.fotos || []);
    setTexto(guardado?.texto || '');
    setFuente(guardado?.fuente || '');
  }, [fecha, corte, duracion, guardado?.id]);

  const fotosDelLibro = entradas.filter(e => e.origen === 'novedad').flatMap(e => st.byId<Novedad>('novedades', e.ids[0])?.fotos || []);
  const fotosParaPDF = [...new Set([...fotos, ...fotosDelLibro])];
  const borrador = textoInformeDia(entradas, {
    site: st.S.site.cliente, fecha, cierre, fotos: fotosParaPDF.length,ventana,
  });
  const redaccionVigente = !!texto && fuente === borrador;
  const definitivo = redaccionVigente ? texto : borrador;

  /* ---------- acciones ---------- */
  const guardar = async () => {
    if(!fechaCorrecta)throw Error('Revise la fecha de entrega (AAAA-MM-DD).');
    st.put('infdias', {
      id: guardado?.id || uid(), fecha, desde: corte, hasta: fin, duracion, fechaHasta:hasta,
      cierre, texto: definitivo, fotos,
      fuente: borrador, trascendentes: marcadoTrascendente,
      createdBy: st.me!.id, createdAt: guardado?.createdAt || Date.now(),
    });
    await st.confirmarGuardado();
    toast('Informe guardado en el teléfono');
  };

  const agregarFoto = async (camara: boolean) => {
    try {
      const perm = camara
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast('Hace falta el permiso para la ' + (camara ? 'cámara' : 'galería')); return; }
      const res = camara
        ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7, allowsMultipleSelection: true });
      if (res.canceled || !res.assets?.length) return;
      const nuevas: string[] = [];
      for (const a of res.assets) nuevas.push(await st.guardarFoto(a.uri));
      setFotos(f => [...f, ...nuevas]);
    } catch {
      toast('No se pudo agregar la imagen');
    }
  };

  const exportar = async (supervisor=false) => {
    if(guardando)return;
    setGuardando(true);
    try {
      await guardar();
      const r = await pdfInformeDia(
        { fecha, corte, cierre, fotos: fotosParaPDF, texto: definitivo },
        st.S, gsName(st.me, st.S.site),supervisor?(st.S.site.supervisorTel||''):undefined);
      toast(r === 'compartido' ? 'PDF listo para compartir' : 'PDF generado');
    } catch (e:any) {
      console.warn(e);
      toast(e.message||'No se pudo generar el PDF');
    }finally{setGuardando(false);}
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="Informe general"
        sub="Registro cronológico del servicio para supervisión."
        onBack={() => router.back()} />

      <ServicioActual />
      {/* ---------- ventana horaria ---------- */}
      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Período</Eyebrow>
          <Chipbar>{[{desde:'07:00',horas:12,etiqueta:'07 → 19 · 12 h'},{desde:'19:00',horas:12,etiqueta:'19 → 07 · 12 h'},{desde:'19:00',horas:24,etiqueta:'19 → 19 · 24 h'}].map(p=><Chip key={p.etiqueta} label={p.etiqueta} on={corte===p.desde&&duracion===p.horas} onPress={()=>{setCorte(p.desde);setDuracion(p.horas as 12|24);}}/>)}</Chipbar>
          <Chipbar>{([12,24] as const).map(h=><Chip key={h} label={h+' horas'} on={duracion===h} onPress={()=>setDuracion(h)}/>)}</Chipbar>
          <Input label="Fecha de entrega / fin" value={fechaEntrega} onChangeText={setFechaEntrega} placeholder="AAAA-MM-DD" mono hint="La app calcula el día de inicio automáticamente."/>
          <Row>
            <Btn icon="back" variant="ghost" size="sm" disabled={!fechaCorrecta} onPress={() => setFechaEntrega(f => addDays(f, -1))} />
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>
                {dmy(fecha) + '  ' + corte}
              </Text>
              <Hint>{'hasta ' + dmy(hasta) + ' ' + fin+' · '+duracion+' horas'}</Hint>
            </View>
            <Btn icon="back" variant="ghost" size="sm" style={{ transform: [{ scaleX: -1 }] }}
              disabled={!fechaCorrecta} onPress={() => setFechaEntrega(f => addDays(f, 1))} />
          </Row>
          <Row><Btn label="Termina hoy" size="sm" variant="ghost" onPress={()=>setFechaEntrega(isoDate())}/><Btn label="Último finalizado" size="sm" variant="ghost" onPress={()=>setFechaEntrega(limites(ventanaReciente(corte,duracion,true)).hasta.fecha)}/></Row>
          <Field label="Hora de inicio" hint="El fin se calcula según la duración elegida. A igual horario, son 24 horas.">
            <Chipbar>
              {['06:00', '07:00', '14:00', '19:00', '22:00', '23:00', '00:00'].map(h => (
                <Chip key={h} label={h} on={corte === h} onPress={() => {
                  setCorte(h);
                }} />
              ))}
            </Chipbar>
          </Field>
          {!fechaCorrecta?<Banner kind="warn">Revise la fecha de entrega (AAAA-MM-DD).</Banner>:<Hint>{entradas.length+' registros incluidos. Desde el inicio indicado hasta antes del horario de fin.'}</Hint>}
        </Stack>
      </Card>

      {/* ---------- entradas ---------- */}
      {entradas.length ? [...new Set(entradas.map(e => e.fecha))].map(dia => (
        <Stack key={dia} gap={8}>
          <Eyebrow>{'Día ' + dmy(dia)}</Eyebrow>
          <Card>{entradas.filter(e => e.fecha === dia).map((e, i, lista) => (
            <FilaEntrada key={e.clave} e={e} last={i === lista.length - 1} onPress={() => {
              if (e.origen === 'novedad') { setEditar(st.byId<Novedad>('novedades', e.ids[0]) || null); return; }
              if (e.origen === 'acceso') {
                const registros = st.S.alogs.filter(a => e.ids.includes(a.id)).sort((a,b) => a.hora.localeCompare(b.hora));
                const g = registros[registros.length - 1]?.guardId || '';
                setEditar({ id: 'auto:' + e.clave, autoKey: e.clave, fecha: e.fecha, hora: e.hora,
                  guardId: g, createdBy:registros[0]?.createdBy||g, turnoId:registros[0]?.turnoId, lockedAt:registros[0]?.lockedAt, categoria: e.categoria||'Apertura', texto: e.texto + (e.items || []).map(x => '\n• ' + x).join(''), updatedAt: 0 });
              } else setDetalle(e);
            }} />
          ))}</Card>
        </Stack>
      )) : <Card><Empty>No hay novedades en este período. Revise las fechas y el horario antes de generar el informe.</Empty></Card>}
      <Row gap={9}>
        <Btn label="Agregar novedad" icon="plus" variant="primary" style={{ flex: 1 }}
          disabled={!fechaCorrecta} onPress={() => setEditar(null)} />
        <Btn label="Ver informe" icon="informes" variant="ghost" style={{ flex: 1 }}
          onPress={() => setVista(true)} />
      </Row>

      <Btn label="Leer foto del libro físico" icon="informes" variant="ghost" onPress={() => setLeerLibro(true)} />
      {/* ---------- cierre y evidencia ---------- */}
      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Párrafo de cierre</Eyebrow>
          {detectadas ? <Banner kind="warn">Hay incidencias o informes de seguridad en este período. El cierre sin novedades queda desactivado.</Banner> :
            <Toggle label="Hubo novedades de trascendencia" value={marcadoTrascendente} onChange={v => {
              setMarcadoTrascendente(v); setCierrePersonal(null);
            }} />}
          <Input label="Cierre del servicio" value={cierre} onChangeText={setCierrePersonal} multiline rows={4}
            placeholder={trascendentes ? 'Detalle el estado final y el seguimiento de las novedades.' : ''} />
          {cierrePersonal !== null ? <Btn label="Restablecer cierre" variant="ghost" size="sm" onPress={() => setCierrePersonal(null)} /> : null}
          <Eyebrow>Evidencia</Eyebrow>
          {fotosDelLibro.length ? <Hint>{new Set(fotosDelLibro).size + ' fotos del libro físico incluidas desde sus novedades.'}</Hint> : null}
          {fotos.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {fotos.map((f, i) => (
                <View key={f + i}>
                  <Image source={{ uri: f }} style={{
                    width: 92, height: 92, borderRadius: 8, borderWidth: 1, borderColor: t.line,
                  }} />
                  <View style={{ position: 'absolute', top: 4, right: 4 }}>
                    <Btn icon="x" variant="danger" size="xs"
                      onPress={() => setFotos(x => x.filter((_, k) => k !== i))} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : <Hint>Sin imágenes. Se adjuntan al final del PDF.</Hint>}
          <Row gap={9}>
            <Btn label="Sacar foto" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => agregarFoto(true)} />
            <Btn label="De la galería" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => agregarFoto(false)} />
          </Row>
        </Stack>
      </Card>

      {/* ---------- salida ---------- */}
      <Card pad>
        <Stack gap={11}>
          <Eyebrow>Compartir</Eyebrow>
          <RedaccionIA texto={borrador} categoria="Informe general"
            generarPrompt={v => promptInformeDia(v, { site: st.S.site.cliente, fecha: dmy(fecha), desde: corte, hasta: fin })}
            validar={validarRedaccionDia} onTexto={v => { setTexto(v); setFuente(borrador); setVista(true); }} />
          {redaccionVigente ? (
            <Banner kind="info" icon="check">
              {'El informe quedó redactado por la IA. Si desea volver al armado automático, seleccione Descartar redacción.'}
            </Banner>
          ) : null}
          {texto && !redaccionVigente ? <Banner kind="info">Los registros cambiaron. El informe ya incluye los datos actuales; puede volver a revisar la redacción con IA.</Banner> : null}
          {texto ? <Btn label="Descartar redacción" variant="ghost" size="sm" onPress={() => setTexto('')} /> : null}
          <Row gap={9}>
            <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
              disabled={guardando||!fechaCorrecta} onPress={async () => {setGuardando(true);try{await guardar(); await Clipboard.setStringAsync(definitivo); toast('Informe copiado. Péguelo en el chat del supervisor.');}catch(e:any){toast(e.message);}finally{setGuardando(false);} }} />
            <Btn label={guardando?'Guardando…':'Exportar PDF'} disabled={guardando||!fechaCorrecta} icon="share" variant="ghost" style={{ flex: 1 }} onPress={()=>exportar()} />
          </Row>
          <Btn label="Compartir con supervisor" disabled={guardando||!fechaCorrecta} icon="share" variant="primary" onPress={()=>{if(!st.S.site.supervisorTel){toast('Configure el número del supervisor en Configuración.');router.push('/ajustes');return;}void exportar(true);}}/>
        </Stack>
      </Card>

      <ImportarLibro abierto={leerLibro} fecha={fecha} onClose={() => setLeerLibro(false)} />
      <EditorNovedad abierto={editar !== undefined} novedad={editar || null} fecha={fecha} corte={corte} duracion={duracion} onClose={() => setEditar(undefined)} />
      <Sheet visible={!!detalle} title={detalle ? detalle.hora + ' · Detalle' : 'Detalle'} onClose={() => setDetalle(null)}>
        <Text selectable style={{ fontFamily: FONT.body, fontSize: 15, lineHeight: 23, color: t.text }}>
          {detalle?.texto}{detalle?.items?.map(i => '\n• ' + i).join('')}
        </Text>
      </Sheet>

      <Sheet visible={vista} title="Informe de novedades" onClose={() => setVista(false)}
        footer={
          <Btn label="Copiar" icon="copy" variant="primary" style={{ flex: 1 }}
            onPress={async () => { await Clipboard.setStringAsync(definitivo); toast('Informe copiado'); }} />
        }>
        <View style={{
          backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 12, padding: 14,
        }}>
          <Text selectable style={{ fontFamily: FONT.mono, fontSize: 12, lineHeight: 19, color: t.text }}>
            {definitivo}
          </Text>
        </View>
      </Sheet>
    </Pantalla>
  );
}

/* ---------------- una entrada de la lista ---------------- */
function FilaEntrada({ e, last, onPress }: { e: EntradaDia; last: boolean; onPress: () => void }) {
  const resumen = resumenCorto(e);
  return (
    <Item last={last} lead={e.hora} onPress={onPress} tituloLineas={2} lineas={1}
      title={e.items && e.items.length ? e.texto.replace(/:$/, '') : e.texto}
      subs={[e.firma||null,e.items && e.items.length ? resumen : null]}
      right={<Tag label={e.categoria||'NOVEDAD'}
        kind={e.origen === 'acceso' ? 'acc' : 'mute'} />} />
  );
}

