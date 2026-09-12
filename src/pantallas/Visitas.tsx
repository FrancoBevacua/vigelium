import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { visAdentro, visEspera, visNombre } from '../logic';
import {
  Acceso, AUTZ, Visita, accNormal, autLabel, autTag, dmy, fmtDNI, hhmm, isoDate,
  personasReales, toMin, uid,
} from '../model';
import {
  textoIngresoAcceso, textoEgresoAcceso, textoConfirmAcceso, sujetoAcceso,
} from '../text';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Empty, Stack, Row, Seg,
  Chip, Chipbar, Input, Field, Sheet, Banner, Hint, Confirmar, useToast,
} from '../ui';
import BloqueAcceso from './BloqueAcceso';

const TIPOS = ['Proveedor', 'Contratista', 'Visita', 'Empleado', 'Locatario'];

export default function Visitas() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [modo, setModo] = useState('dentro');
  const [editar, setEditar] = useState<Visita | null | undefined>(undefined);
  const [confirmar, setConfirmar] = useState<Visita | null>(null);


  const todas = st.list<Visita>('visits').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const dentro = todas.filter(visAdentro);
  const espera = todas.filter(visEspera);
  const rows = modo === 'dentro' ? dentro : todas;

  /* asienta el movimiento en el libro y devuelve la visita actualizada */
  const alLibro = (v: Visita, mov: 'in' | 'out' | 'conf'): Visita => {
    const key = mov === 'in' ? 'novIn' : mov === 'out' ? 'novOut' : 'novConf';
    const a = accNormal(v.acc, v);
    let texto = '', hora = '', fecha = '';
    if (mov === 'in') {
      texto = textoIngresoAcceso(a, v.tipo); hora = v.horaIn || hhmm(); fecha = v.fecha || isoDate();
    } else if (mov === 'out') {
      let min: number | null = null;
      if (v.horaIn && v.horaOut) { min = toMin(v.horaOut) - toMin(v.horaIn); if (min < 0) min += 1440; }
      texto = textoEgresoAcceso(a, v.tipo, min); hora = v.horaOut || hhmm(); fecha = isoDate();
    } else {
      texto = textoConfirmAcceso(a, v.tipo); hora = hhmm(); fecha = isoDate();
    }
    const nid = (v as any)[key] || uid();
    st.put('novedades', {
      id: nid, fecha, hora, guardId: v.guardId || st.me!.id,
      categoria: 'Acceso', visitId: v.id, mov, texto, acc: a,
    });
    return { ...v, [key]: nid } as Visita;
  };

  const egreso = (v: Visita) => {
    const conSalida = { ...v, horaOut: hhmm() };
    st.put('visits', alLibro(conSalida, 'out'));
    toast('Egreso ' + conSalida.horaOut + ' asentado en el libro');
  };

  const copiarPresentes = async () => {
    let x = '*PERSONAS EN EL PREDIO — ' + dmy(isoDate()) + ' ' + hhmm() + '*\n\n';
    if (!dentro.length) x += 'Sin personal de terceros dentro del predio.';
    dentro.forEach(v => {
      const a = accNormal(v.acc, v);
      x += v.horaIn + ' — ' + visNombre(v) + '\n';
      if (a.tarea) x += a.tarea + (a.lugar ? ' en ' + a.lugar : '') + '\n';
      personasReales(a).forEach(p => { x += p.nombre + (p.dni ? ' — DNI ' + fmtDNI(p.dni) : '') + '\n'; });
      x += autLabel(a.autoriz) +
        (a.vehiculo?.activo ? ' · ' + [a.vehiculo.tipo, a.vehiculo.dominio].filter(Boolean).join(' ') : '') + '\n\n';
    });
    await Clipboard.setStringAsync(x.trim());
    toast('Listado copiado');
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="Visitas y proveedores" sub="Cada ingreso y egreso se asienta solo en el libro."
        onBack={() => router.back()} />

      {espera.length ? (
        <Banner kind="warn">
          <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.warn }}>
            <Text style={{ fontFamily: FONT.bodyBold }}>
              {espera.length + ' ingreso' + (espera.length > 1 ? 's' : '') + ' sin confirmar'}
            </Text>
            {'\n' + espera.map(visNombre).join(' · ') + ' — aguardan confirmación del CCTV.'}
          </Text>
        </Banner>
      ) : null}

      <Seg acento valor={modo} onChange={setModo}
        opciones={[{ v: 'dentro', t: 'En el predio (' + dentro.length + ')' }, { v: 'hist', t: 'Historial' }]} />

      <Btn label="Registrar ingreso" icon="plus" variant="primary" onPress={() => setEditar(null)} />

      {rows.length ? (
        <Card>
          {rows.map((v, i) => {
            const a = accNormal(v.acc, v);
            const per = personasReales(a);
            const kind = v.horaOut ? 'mute' : a.autoriz === 'retiro' ? 'crit' : autTag(a.autoriz);
            return (
              <Item key={v.id} last={i === rows.length - 1} stripe={kind}
                lead={v.horaIn} title={visNombre(v)} tituloLineas={1} lineas={1}
                subs={[
                  [a.tarea, a.lugar].filter(Boolean).join(' · ') || v.tipo,
                  (per.length > 1 ? per.length + ' empleados' : per[0]?.dni ? 'DNI ' + fmtDNI(per[0].dni) : '') +
                  (a.vehiculo?.activo && a.vehiculo.dominio ? ' · ' + a.vehiculo.dominio : '') +
                  (v.horaOut ? ' · Egresó ' + v.horaOut : ''),
                ]}
                right={
                  v.horaOut ? <Tag label="Egresó" kind="mute" />
                    : a.autoriz === 'espera' ? <Btn label="Confirmar" variant="primary" size="xs" onPress={() => setConfirmar(v)} />
                      : a.autoriz === 'retiro' ? <Tag label="Se retiró" kind="crit" />
                        : <Btn label="Egreso" variant="primary" size="xs" onPress={() => egreso(v)} />
                }
                onPress={() => setEditar(v)} />
            );
          })}
        </Card>
      ) : (
        <Card>
          <Empty>{modo === 'dentro' ? 'No hay visitas ni proveedores dentro del predio.' : 'Sin registros.'}</Empty>
        </Card>
      )}

      {rows.length ? (
        <Btn label="Copiar listado de presentes" icon="copy" variant="ghost" onPress={copiarPresentes} />
      ) : null}

      <EditorVisita abierto={editar !== undefined} visita={editar || null}
        onClose={() => setEditar(undefined)} alLibro={alLibro} />
      <HojaConfirmar visita={confirmar} onClose={() => setConfirmar(null)} alLibro={alLibro} />
    </Pantalla>
  );
}

/* ================= alta y edición ================= */
function EditorVisita({ abierto, visita, onClose, alLibro }: {
  abierto: boolean; visita: Visita | null; onClose: () => void;
  alLibro: (v: Visita, mov: 'in' | 'out' | 'conf') => Visita;
}) {
  const st = useStore();
  const toast = useToast();
  const [tipo, setTipo] = useState('Proveedor');
  const [acc, setAcc] = useState<Acceso>(accNormal());
  const [horaIn, setHoraIn] = useState(hhmm());
  const [horaOut, setHoraOut] = useState('');
  const [obs, setObs] = useState('');
  const [borrar, setBorrar] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setTipo(visita?.tipo || 'Proveedor');
    setAcc(accNormal(visita?.acc, visita));
    setHoraIn(visita?.horaIn || hhmm());
    setHoraOut(visita?.horaOut || '');
    setObs(accNormal(visita?.acc, visita).obs || '');
  }, [abierto, visita?.id]);

  const guardar = () => {
    const a = { ...acc, obs };
    if (!a.empresa && !personasReales(a).length) { toast('Ingrese la razón social o al menos un empleado'); return; }
    let salida = horaOut;
    if (a.autoriz === 'retiro' && !salida) salida = horaIn;
    let v: Visita = {
      id: visita?.id || uid(), updatedAt: 0, tipo, acc: a,
      nombre: a.empresa || personasReales(a)[0]?.nombre || '',
      horaIn: horaIn || hhmm(), horaOut: salida,
      fecha: visita?.fecha || isoDate(), guardId: visita?.guardId || st.me!.id,
      createdAt: visita?.createdAt || Date.now(),
      novIn: visita?.novIn, novOut: visita?.novOut, novConf: visita?.novConf,
    };
    v = alLibro(v, 'in');
    if (v.horaOut && a.autoriz !== 'retiro') v = alLibro(v, 'out');
    st.put('visits', v);
    onClose();
    toast(a.autoriz === 'retiro'
      ? 'Registrado: personal sin confirmación, se retira'
      : 'Registrado y asentado en el libro');
  };

  return (
    <Sheet visible={abierto} title={visita ? 'Editar registro' : 'Registrar ingreso'} onClose={onClose}
      footer={
        <>
          {visita ? <Btn icon="trash" variant="danger" onPress={() => setBorrar(true)} /> : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Field label="Tipo">
        <Chipbar>
          {TIPOS.map(x => <Chip key={x} label={x} on={tipo === x} onPress={() => setTipo(x)} />)}
        </Chipbar>
      </Field>
      <BloqueAcceso valor={acc} onChange={setAcc} />
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input label="Hora de ingreso" value={horaIn} onChangeText={setHoraIn} mono keyboardType="numbers-and-punctuation" />
        </View>
        {visita ? (
          <View style={{ flex: 1 }}>
            <Input label="Hora de egreso" value={horaOut} onChangeText={setHoraOut} mono keyboardType="numbers-and-punctuation" />
          </View>
        ) : null}
      </Row>
      <Input label="Observaciones" value={obs} onChangeText={setObs} multiline rows={2}
        placeholder="Ingresa con herramienta propia…" />
      <Banner kind="info" icon="libro">
        Al guardar se genera el asiento en el Informe general con este mismo texto.
      </Banner>

      <Confirmar visible={borrar} mensaje="¿Eliminar este registro? También se quitan sus asientos del libro."
        onCancel={() => setBorrar(false)}
        onOk={() => {
          if (visita) {
            st.putVarios([
              ...(['novIn', 'novOut', 'novConf'] as const).map(k => visita[k]).filter(Boolean)
                .map(id => ({ col: 'novedades' as const, obj: { id, deleted: true } })),
              { col: 'visits', obj: { id: visita.id, deleted: true } },
            ]);
          }
          setBorrar(false); onClose(); toast('Registro eliminado');
        }} />
    </Sheet>
  );
}

/* ================= confirmación posterior ================= */
function HojaConfirmar({ visita, onClose, alLibro }: {
  visita: Visita | null; onClose: () => void;
  alLibro: (v: Visita, mov: 'in' | 'out' | 'conf') => Visita;
}) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [resultado, setResultado] = useState<'cctv' | 'admin' | 'retiro'>('cctv');
  const [confirmo, setConfirmo] = useState('');

  useEffect(() => {
    if (!visita) return;
    setResultado('cctv');
    setConfirmo(accNormal(visita.acc, visita).confirmo || '');
  }, [visita?.id]);

  if (!visita) return null;
  const a = accNormal(visita.acc, visita);

  const guardar = () => {
    const nuevo: Acceso = { ...a, autoriz: resultado, confirmo };
    let v: Visita = { ...visita, acc: nuevo };
    if (resultado === 'retiro') {
      v.horaOut = hhmm();
      v = alLibro(v, 'out');
    } else {
      v = alLibro(v, 'conf');
    }
    // La autorización se agrega como un nuevo hecho; el asiento anterior conserva su contenido.
    st.put('visits', v);
    onClose();
    toast(resultado === 'retiro' ? 'Asentado: se retira sin confirmación' : 'Autorización confirmada y asentada');
  };

  return (
    <Sheet visible={!!visita} title="Confirmar autorización" onClose={onClose}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onClose} />
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <Banner kind="info" icon="bell">
        <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.slate }}>
          {sujetoAcceso(a, visita.tipo) + (a.tarea ? ' — ' + a.tarea : '') +
            '\nIngreso registrado a las ' + visita.horaIn + ' aguardando confirmación.'}
        </Text>
      </Banner>
      <Field label="Resultado">
        <Chipbar>
          {AUTZ.filter(x => x[0] !== 'espera').map(([v, lab]) => (
            <Chip key={v} label={lab} on={resultado === v} onPress={() => setResultado(v as any)} />
          ))}
        </Chipbar>
      </Field>
      <Input label="Quién confirmó" value={confirmo} onChangeText={setConfirmo} placeholder="Op. Gómez" />
    </Sheet>
  );
}
