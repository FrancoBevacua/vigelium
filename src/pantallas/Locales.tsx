import SelectorFirma from './SelectorFirma';
import React, { useState } from 'react';
import { View, Linking } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { RecorridoLocales, hhmm, isoDate, uid, dmy } from '../model';
import { fechaValida, horaValida, turnoAbierto } from '../servicio';
import { textoRecorrido, urlWhatsApp } from '../operacion';
import { Pantalla, SubCabecera, Btn, Card, Item, Empty, Sheet, Input, Seg, Row, Stack, Banner, Hint, Eyebrow, useToast } from '../ui';
import ServicioActual from './ServicioActual';

export default function Locales() {
  const st = useStore(); const toast = useToast();
  const [firma,setFirma]=useState('');
  const [modo, setModo] = useState('apertura');
  const tipo = modo as 'apertura' | 'cierre';
  const [fecha, setFecha] = useState(isoDate()); const [hora, setHora] = useState(hhmm());
  const [obs, setObs] = useState(''); const [error, setError] = useState('');
  const [telefono, setTelefono] = useState(st.S.site.inmobiliariaTel || '');
  const [ver, setVer] = useState<RecorridoLocales | null>(null);
  const [guardando, setGuardando] = useState(false);
  const registros = st.list<RecorridoLocales>('recorridos').filter(r => r.tipo === modo).sort((a,b) => (b.fecha+b.hora).localeCompare(a.fecha+a.hora));
  const abrirWhatsApp = async (r: RecorridoLocales) => {
    const texto = textoRecorrido(r, st.S.site.cliente);
    try { await Linking.openURL(urlWhatsApp(texto, telefono)); }
    catch { await Clipboard.setStringAsync(texto); setError('No se pudo abrir WhatsApp. El mensaje quedó copiado para pegarlo en el chat de inmobiliaria.'); }
  };
  const finalizar = async () => {
    if (guardando) return;
    setGuardando(true); setError('');
    try {
      const turno = turnoAbierto(st.S, st.me?.id);
      if (!turno) throw new Error('Inicie su turno para guardar el recorrido.');
      if (!fechaValida(fecha) || !horaValida(hora)) throw new Error('Revise la fecha y hora del recorrido.');
      urlWhatsApp('', telefono);
      const id = uid(), novId = uid();
      const r: RecorridoLocales = { id, updatedAt: Date.now(), tipo, fecha, hora, guardId: firma, turnoId: turno.id, controles: [], observaciones: obs, novId };
      st.putVarios([
        { col: 'recorridos', obj: r },
        { col: 'novedades', obj: { id: novId, fecha, hora, guardId: firma, turnoId: turno.id, origenTipo: 'recorrido', origenId: id,
          categoria: 'Recorrido de locales', texto: textoRecorrido(r, st.S.site.cliente) } },
      ]);
      st.setSite({ inmobiliariaTel: telefono.trim() });
      await st.confirmarGuardado();
      setObs(''); setVer(r);
      toast('Recorrido guardado. Confirmá el envío en WhatsApp.');
      await abrirWhatsApp(r);
    } catch (e: any) { setError(e.message || 'No se pudo guardar el recorrido.'); }
    finally { setGuardando(false); }
  };
  return <Pantalla top>
    <SubCabecera titulo="Recorrido de locales" sub="Controles separados de apertura y cierre, con observaciones para inmobiliaria." onBack={() => router.back()} />
    <ServicioActual />
    <Card pad><Stack gap={12}>
      <SelectorFirma valor={firma} onChange={setFirma}/>
      <Seg valor={modo} onChange={v => { setModo(v); setError(''); }} opciones={[{ v: 'apertura', t: 'Control de aperturas' }, { v: 'cierre', t: 'Control de cierres' }]} />
      <Input label="Observaciones (si las hubiera)" value={obs} onChangeText={setObs} multiline rows={4} placeholder="Locales que no abrieron o cerraron en horario y otras observaciones…" />
      <Row><View style={{flex:1}}><Input label="Fecha" value={fecha} onChangeText={setFecha} mono /></View><View style={{flex:1}}><Input label="Hora" value={hora} onChangeText={setHora} mono /></View></Row>
      <Btn label={guardando ? 'Guardando…' : 'Finalizar y abrir WhatsApp'} variant="primary" disabled={guardando || !turnoAbierto(st.S, st.me?.id)} onPress={finalizar} />
    </Stack></Card>
    <Eyebrow>Recorridos registrados</Eyebrow>
    <Card>{registros.length ? registros.map((r,i) => <Item key={r.id} last={i===registros.length-1} title={(r.tipo === 'apertura' ? 'Locales abiertos' : 'Locales cerrados') + ' · ' + dmy(r.fecha)} lead={r.hora} subs={[r.observaciones || 'Sin observaciones registradas']} tituloLineas={1} lineas={1} onPress={() => setVer(r)} />) : <Empty>Sin recorridos registrados.</Empty>}</Card>
    <Card pad><Stack gap={9}>
      <Eyebrow>WhatsApp de inmobiliaria</Eyebrow>
      <Input value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" placeholder="Código de país + área + número" />
      <Hint>Al finalizar se abrirá el mensaje en WhatsApp. Revíselo y seleccione Enviar. Si deja el número vacío, podrá elegir el contacto.</Hint>
      <Btn label="Guardar contacto" variant="ghost" onPress={() => { try { urlWhatsApp('', telefono); st.setSite({ inmobiliariaTel: telefono.trim() }); setError(''); toast('Contacto guardado'); } catch (e: any) { setError(e.message); } }} />
    </Stack></Card>
    {error ? <Banner kind="warn">{error}</Banner> : null}
    <Sheet visible={!!ver} title="Recorrido registrado" onClose={() => setVer(null)} footer={<Btn label="Abrir mensaje en WhatsApp" icon="share" onPress={() => { if (ver) abrirWhatsApp(ver); }} />}>
      {ver ? <><Hint>Registro de sólo lectura. El envío se confirma dentro de WhatsApp.</Hint><Input value={textoRecorrido(ver, st.S.site.cliente)} editable={false} multiline rows={14} />{error ? <Banner kind="warn">{error}</Banner> : null}</> : null}
    </Sheet>
  </Pantalla>;
}
