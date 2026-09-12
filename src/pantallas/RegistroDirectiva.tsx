import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useStore } from '../store';
import { dlogDe } from '../logic';
import { Directiva } from '../model';
import { hhmm, isoDate, uid } from '../model';
import { FONT } from '../theme';
import { Sheet, Btn, Seg, Input, Banner, Toggle, useTheme, useToast } from '../ui';
import SelectorFirma from './SelectorFirma';

export default function RegistroDirectiva({ directiva, onClose }: { directiva: Directiva | null; onClose: () => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const hoy = isoDate();
  const previo = directiva ? dlogDe(st.S, hoy, directiva.id) : undefined;

  const [estado, setEstado] = useState('ok');
  const [hora, setHora] = useState(hhmm());
  const [nov, setNov] = useState('');
  const [alLibro, setAlLibro] = useState(false);
  const [firma,setFirma]=useState('');

  useEffect(() => {
    if (!directiva) return;
    setEstado(previo?.estado || 'ok');
    setHora(previo?.horaReal || hhmm());
    setNov(previo?.novedades || '');
    setAlLibro(false);
    setFirma('');
  }, [directiva?.id]);

  if (!directiva) return null;

  const guardar = () => {
    if(alLibro&&!st.S.guards.some(g=>g.id===firma&&!g.deleted)){toast('Seleccione el vigilador que realizó la novedad');return;}
    try {
    st.putVarios([
      { col: 'dlogs', obj: {
        id: previo?.id || uid(), fecha: hoy, directiveId: directiva.id, guardId: st.me!.id,
        estado, horaReal: hora, novedades: nov,
      } },
      ...(alLibro ? [{ col: 'novedades' as const, obj: {
        id: uid(), fecha: hoy, hora: hora || hhmm(), guardId: firma, categoria: 'Novedad',
        texto: directiva.nombre + (nov ? '. ' + nov : '. Sin novedad.'), acc: null,
      } }] : []),
    ]);
    onClose();
    toast('Directiva registrada');
    }catch(e:any){toast(e.message);}
  };

  return (
    <Sheet
      visible={!!directiva} title={directiva.nombre} onClose={onClose}
      footer={
        <>
          {previo ? (
            <Btn label="Deshacer" variant="ghost" style={{ flex: 1 }}
              onPress={() => { st.drop('dlogs', previo.id); onClose(); toast('Registro deshecho'); }} />
          ) : null}
          <Btn label="Registrar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Banner kind="info" icon="clock">
        <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.slate }}>
          {'Directiva pautada para las ' + directiva.hora + (directiva.novedades ? '\n' + directiva.novedades : '')}
        </Text>
      </Banner>
      <Seg valor={estado} onChange={setEstado}
        opciones={[{ v: 'ok', t: 'Cumplida' }, { v: 'na', t: 'No aplica' }]} />
      <Input label="Hora real" value={hora} onChangeText={setHora} mono placeholder="HH:MM"
        hint="Se guarda la hora en la que efectivamente la hiciste." />
      <Input label="Novedades" value={nov} onChangeText={setNov} multiline rows={3}
        placeholder="Sin novedad / Precinto N° …" />
      <Toggle label="Copiar también al Informe general" value={alLibro} onChange={setAlLibro} />
      {alLibro?<SelectorFirma valor={firma} onChange={setFirma}/>:null}
    </Sheet>
  );
}
