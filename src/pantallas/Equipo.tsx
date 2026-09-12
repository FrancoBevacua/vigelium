import { guardarPIN, verificarPIN, tienePIN } from '../cuentas';
import { cambiarPinNube } from '../nube';
import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { franjasDe, nombrePuesto, puestos, franjaPorId, etiquetaFranja, horasDelMes, fichajeAbierto } from '../logic';
import {
  Turno, Vigilador, titulo, uid, edadDe, isoDesdeDmy, mascaraDmy, dmy,
} from '../model';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Tag, Item, Stack, Row, Input, Selector,
  Sheet, Hint, Metric, Confirmar, useToast, Eyebrow,
} from '../ui';
import { Avatar } from './Gate';
import Credencial from './Credencial';

/* ================= editor de vigilador ================= */
export function EditorVigilador({ abierto, vigilador, onClose }: {
  abierto: boolean; vigilador: Vigilador | null; onClose: () => void;
}) {
  const st = useStore();
  const toast = useToast();
  const [sexo,setSexo]=useState('');
  const [apellido, setApellido] = useState('');
  const [nombre, setNombre] = useState('');
  const [nac, setNac] = useState('');
  const [legajo, setLegajo] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [puestoId, setPuestoId] = useState('');
  const [franjaId, setFranjaId] = useState('');
  const [rol, setRol] = useState<'admin' | 'vigilador'>('vigilador');
  const [francos, setFrancos] = useState('');
  const [foto, setFoto] = useState('');
  const [borrar, setBorrar] = useState(false);

  const puedeRol = st.esAdmin || !st.list('guards').length;

  useEffect(() => {
    if (!abierto) return;
    setSexo(vigilador?.sexo||'');
    setApellido(vigilador?.apellido || '');
    setNombre(vigilador?.nombre || '');
    setNac(vigilador?.fechaNac ? dmy(vigilador.fechaNac) : '');
    setLegajo(vigilador?.legajo || '');
    setTel(vigilador?.tel || '');
    setEmail(vigilador?.email || '');
    setPuestoId(vigilador?.puestoId || '');
    setFranjaId(vigilador?.franjaId || '');
    setRol(vigilador?.rol || 'vigilador');
    setFrancos(vigilador?.francos || '');
    setFoto(vigilador?.foto || '');
  }, [abierto, vigilador?.id]);

  const elegirFoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { toast('Necesito permiso para acceder a las fotos'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.6, allowsEditing: true });
    if (res.canceled || !res.assets?.[0]) return;
    setFoto(await st.guardarFoto(res.assets[0].uri));
  };

  const guardar = () => {
    if (!apellido.trim()) { toast('Falta el apellido'); return; }
    const fr = franjaPorId(st.S, franjaId);
    const fechaNac = isoDesdeDmy(nac);
    if (nac && !fechaNac) { toast('La fecha de nacimiento va como DD/MM/AAAA'); return; }
    const g = st.put('guards', {
      id: vigilador?.id || uid(), apellido: titulo(apellido), nombre: titulo(nombre),
      fechaNac, sexo:sexo as Vigilador['sexo'], edad: edadDe(fechaNac), cuenta: vigilador?.cuenta,
      legajo, dni: vigilador?.dni, tel, email, puestoId, franjaId, puesto: nombrePuesto(st.S, puestoId),
      rol: puedeRol ? rol : (vigilador?.rol || 'vigilador'),
      horaIn: fr?.entrada || vigilador?.horaIn || '06:00',
      horaOut: fr?.salida || vigilador?.horaOut || '14:00',
      francos, foto,
    });
    if (!st.list<Vigilador>('guards').some(x => x.rol === 'admin')) {
      st.put('guards', { ...g, rol: 'admin' });
    }
    onClose();
    toast('Datos guardados');
  };

  const esUnicoAdmin = vigilador?.rol === 'admin' &&
    st.list<Vigilador>('guards').filter(x => x.rol === 'admin').length < 2;

  return (
    <Sheet visible={abierto} title={vigilador ? 'Datos del vigilador' : 'Registrar vigilador'} onClose={onClose}
      footer={
        <>
          {vigilador && vigilador.id !== st.me?.id ? (
            <Btn icon="trash" variant="danger" onPress={() => {
              if (esUnicoAdmin) { toast('No puede eliminar al único administrador'); return; }
              setBorrar(true);
            }} />
          ) : null}
          <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={guardar} />
        </>
      }>
      <View style={{ alignItems: 'center', gap: 9 }}>
        <Avatar g={{ ...(vigilador || {} as any), apellido, nombre, foto }} size={82} />
        <Row gap={7}>
          <Btn label="Cambiar foto" variant="ghost" size="sm" onPress={elegirFoto} />
          {foto ? <Btn label="Quitar" variant="ghost" size="xs" onPress={() => setFoto('')} /> : null}
        </Row>
      </View>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}><Input label="Apellido" value={apellido} onChangeText={setApellido} /></View>
        <View style={{ flex: 1 }}><Input label="Nombre" value={nombre} onChangeText={setNombre} /></View>
      </Row>
      <Row gap={11} style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Input label="Fecha de nacimiento" value={nac} onChangeText={v => setNac(mascaraDmy(v))}
            mono keyboardType="number-pad" placeholder="24/07/1990"
            hint={edadDe(isoDesdeDmy(nac)) ? edadDe(isoDesdeDmy(nac)) + ' años' : undefined} />
        </View>
        <View style={{ flex: 1 }}><Input label="Legajo" value={legajo} onChangeText={setLegajo} mono /></View>
      </Row>
      <Selector label="Sexo" valor={sexo} onChange={setSexo} opciones={[{v:'',t:'Seleccionar'},{v:'masculino',t:'Masculino'},{v:'femenino',t:'Femenino'}]}/>
      <Selector label="Puesto" valor={puestoId}
        onChange={v => { setPuestoId(v); setFranjaId(franjasDe(st.S, v)[0]?.id || ''); }}
        opciones={[{ v: '', t: 'Sin puesto asignado' }, ...puestos(st.S).map(p => ({ v: p.id, t: p.nombre }))]} />
      <Selector label="Turno" valor={franjaId} onChange={setFranjaId}
        opciones={[
          { v: '', t: 'Sin turno' },
          ...franjasDe(st.S, puestoId).map(f => ({
            v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre, sub: f.entrada + ' a ' + f.salida,
          })),
        ]} />
      {puedeRol ? (
        <Selector label="Rol" valor={rol} onChange={v => setRol(v as any)}
          hint="El administrador puede crear puestos, turnos, directivas y diagramar a todo el equipo."
          opciones={[{ v: 'vigilador', t: 'Vigilador' }, { v: 'admin', t: 'Administrador' }]} />
      ) : null}
      <Input label="Celular" value={tel} onChangeText={setTel} keyboardType="phone-pad" placeholder="341 555 5555" />
      <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Francos" value={francos} onChangeText={setFrancos} placeholder="Miércoles y jueves"
        hint="Referencia. El diagrama real se arma en Turnos." />

      <Confirmar visible={borrar} mensaje="¿Eliminar a este vigilador del equipo? Sus registros quedan en el sistema."
        onCancel={() => setBorrar(false)}
        onOk={() => { if (vigilador) st.drop('guards', vigilador.id); setBorrar(false); onClose(); toast('Vigilador eliminado'); }} />
    </Sheet>
  );
}

/* ================= listado del equipo ================= */
export default function Equipo() {
  const st = useStore();
  const [editar, setEditar] = useState<Vigilador | null | undefined>(undefined);
  const gs = st.list<Vigilador>('guards');

  return (
    <Pantalla top>
      <SubCabecera titulo="Equipo del objetivo"
        sub={gs.length + (gs.length === 1 ? ' vigilador registrado' : ' vigiladores registrados')}
        onBack={() => router.back()} />
      <Card>
        {gs.map((g, i) => (
          <Item key={g.id} last={i === gs.length - 1}
            lead={<Avatar g={g} />}
            title={g.apellido + ', ' + g.nombre}
            subs={[
              (nombrePuesto(st.S, g.puestoId) || 'Sin puesto') +
              (g.franjaId ? ' · ' + etiquetaFranja(franjaPorId(st.S, g.franjaId)) : ''),
              [g.tel, g.email].filter(Boolean).join(' · '),
            ]}
            right={
              <>
                {g.rol === 'admin' ? <Tag label="Admin" kind="acc" /> : null}
                {g.id === st.me?.id ? <Tag label="Vos" kind="mute" /> : null}
              </>
            }
            onPress={() => setEditar(g)} />
        ))}
      </Card>
      <Btn label="Registrar vigilador" icon="plus" variant="primary" onPress={() => setEditar(null)} />
      {!st.esAdmin ? <Hint>Solo el administrador puede cambiar roles y puestos ajenos.</Hint> : null}

      <EditorVigilador abierto={editar !== undefined} vigilador={editar || null} onClose={() => setEditar(undefined)} />
    </Pantalla>
  );
}

/* ================= mi perfil ================= */
export function Perfil() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [editar, setEditar] = useState(false);
  const [pinAbierto, setPinAbierto] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAnterior, setPinAnterior] = useState('');
  const me = st.me!;
  const enTurno = fichajeAbierto(st.S, me.id);

  return (
    <Pantalla top>
      <SubCabecera titulo="Mi perfil" sub="Sus datos, su foto y su acceso." onBack={() => router.back()} />

      <Credencial g={me} />

      <Card pad>
        <Stack gap={14}>
          <Eyebrow>Mi puesto</Eyebrow>
          <Selector label="Puesto" valor={me.puestoId}
            onChange={v => {
              const f = franjasDe(st.S, v)[0];
              st.put('guards', {
                ...me, puestoId: v, puesto: nombrePuesto(st.S, v),
                franjaId: f?.id || '', horaIn: f?.entrada || '', horaOut: f?.salida || '',
              });
              toast('Puesto actualizado');
            }}
            opciones={puestos(st.S).map(p => ({ v: p.id, t: p.nombre, sub: p.descripcion }))} />
          <Selector label="Turno" valor={me.franjaId}
            hint="De acá salen sus directivas y sus recordatorios."
            onChange={v => {
              const f = franjaPorId(st.S, v);
              st.put('guards', { ...me, franjaId: v, horaIn: f?.entrada || '', horaOut: f?.salida || '' });
              toast('Turno actualizado');
            }}
            opciones={franjasDe(st.S, me.puestoId).map(f => ({
              v: f.id, t: f.alias ? f.nombre + ' — ' + f.alias : f.nombre, sub: f.entrada + ' a ' + f.salida,
            }))} />
          <Row gap={9}>
            <Metric valor={Math.floor(horasDelMes(st.S, me.id) / 60)} label="Horas mes" />
            <Metric valor={st.list<Turno>('shifts').filter(s =>
              s.guardId === me.id && s.tipo === 'franco' && s.fecha.slice(0, 7) === new Date().toISOString().slice(0, 7)
            ).length} label="Francos" />
            <Metric valor={enTurno ? 'SÍ' : 'NO'} label="En turno" />
          </Row>
          <Btn label="Editar mis datos" icon="edit" variant="primary" onPress={() => setEditar(true)} />
        </Stack>
      </Card>

      <Card>
        <Item title="PIN de acceso"
          subs={['PIN personal para iniciar sesión en el teléfono compartido.']}
          onPress={() => { setPin(''); setPinAnterior(''); setPinAbierto(true); }} />
        <Item title="Mis turnos y francos" subs={['Diagrama del mes y horas acumuladas']}
          onPress={() => router.push('/turnos')} />
        <Item last title="Cerrar sesión" subs={['Vuelve a la pantalla de acceso de su cuenta']}
          onPress={async () => { try { await st.salir(); } catch (e: any) { toast(e.message); } }} />
      </Card>

      <EditorVigilador abierto={editar} vigilador={me} onClose={() => setEditar(false)} />

      <Sheet visible={pinAbierto} title="PIN de acceso" onClose={() => setPinAbierto(false)}
        footer={
          <>
            <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setPinAbierto(false)} />
            <Btn label="Guardar" variant="primary" style={{ flex: 1 }} onPress={async () => {
              try{
                if(st.nube.vinculada)await cambiarPinNube(pinAnterior,pin);
                else{if (await tienePIN(me.id) && !await verificarPIN(me.id, pinAnterior)) { toast('El PIN actual no coincide'); return; }await guardarPIN(me.id, pin);}
                setPinAbierto(false); toast('PIN actualizado');
              }catch(e:any){toast(e.message);}
            }} />
          </>
        }>
        <Input label="PIN actual (si ya tiene uno)" value={pinAnterior} onChangeText={setPinAnterior} keyboardType="number-pad" maxLength={6} secureTextEntry />
        <Input label="Nuevo PIN (4 a 6 dígitos)" value={pin} onChangeText={setPin} keyboardType="number-pad" maxLength={6} secureTextEntry />
      </Sheet>
    </Pantalla>
  );
}
