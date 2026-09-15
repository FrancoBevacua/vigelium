import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useStore, crearObjetivo } from '../store';
import { puestos, nombrePuesto, franjasDe, etiquetaFranja, franjaPorId } from '../logic';
import { Vigilador, isoDesdeDmy, mascaraDmy, partirNombre } from '../model';
import { FONT } from '../theme';
import {
  useTheme, Card, Btn, Input, H1, Sub, Eyebrow, Divider,
  Banner, Stack, Row, useToast, Selector, Seg,
} from '../ui';
import { guardarPIN, verificarPIN, tienePIN, dniNormal, dniValido } from '../cuentas';
import { SelectorPaleta } from './Paletas';
import { EscudoMarca } from './Presentacion';

export function Avatar({ g, size = 38 }: { g: Vigilador; size?: number }) {
  const t = useTheme();
  const ini = ((g.apellido || '?')[0] + (g.nombre?.[0] || '')).toUpperCase();
  if (g.foto) {
    return <Image source={{ uri: g.foto }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2, backgroundColor: t.surface3,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.lineStrong,
    }}>
      <Text style={{ fontFamily: FONT.dispBold, fontSize: size * 0.38, color: t.muted }}>{ini}</Text>
    </View>
  );
}

/* La marca, arriba de todo. */
function Marca({ sub }: { sub?: string }) {
  const t = useTheme();
  return (
    <View>
      <Row gap={12} style={{ alignItems: 'center' }}>
        <EscudoMarca size={44} />
        <Text style={{ fontFamily: FONT.dispBold, fontSize: 42, lineHeight: 44, color: t.text }}>
          VIGEL<Text style={{ color: '#31C9DF' }}>IUM</Text>
        </Text>
      </Row>
      {sub ? <Sub style={{ marginTop: 8 }}>{sub}</Sub> : null}
    </View>
  );
}

export default function Gate() {
  const st = useStore();
  const ins = useSafeAreaInsets();
  const [modo, setModo] = useState(st.me && !st.me.dni ? 'migrar' : 'entrar');
  const [anterior, setAnterior] = useState(st.me?.id || '');
  const [nombreAnterior,setNombreAnterior]=useState('');
  const [dni, setDni] = useState('');
  const [pin, setPin] = useState('');
  const [nac, setNac] = useState('');
  const [nuevoPin, setNuevoPin] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(()=>{if(st.nube.vinculada&&!st.me)st.cargarCatalogoNube().catch(()=>setError('Conéctese a Internet para cargar los puestos e iniciar sesión.'));},[st.nube.vinculada,st.me?.id]);
  const wrap = { padding: 20, paddingTop: ins.top + 24, paddingBottom: ins.bottom + 28, gap: 20 };
  if (modo === 'registrar') return <CrearCuenta wrap={wrap} ps={puestos(st.S)} onBack={() => setModo('entrar')} />;
  const ingresar = async () => {
    setOcupado(true); setError('');
    try {
      if (!dniValido(dni)) throw new Error('Ingrese un DNI válido de 7 u 8 dígitos.');
      if(st.nube.vinculada){
        if(modo==='migrar')await st.vincularCuentaNube(dniNormal(dni),pin,nombreAnterior,isoDesdeDmy(nac));
        else await st.ingresarNube(dniNormal(dni),pin);
        return;
      }
      let g = st.list<Vigilador>('guards').find(g => g.cuenta && (modo === 'migrar' ? g.id === anterior && !g.dni : dniNormal(g.dni || '') === dniNormal(dni)));
      if (!g) throw new Error(modo === 'migrar' ? 'Seleccione su cuenta anterior.' : 'DNI o PIN incorrectos.');
      if (modo === 'migrar') {
        if (!g.fechaNac || isoDesdeDmy(nac) !== g.fechaNac) throw new Error('La fecha de nacimiento no coincide.');
        if (await tienePIN(g.id)) {
          if (!await verificarPIN(g.id, pin)) throw new Error('El PIN actual no coincide.');
        } else await guardarPIN(g.id, nuevoPin);
        st.put('guards', { ...g, dni: dniNormal(dni) });
      } else if (!await verificarPIN(g.id, pin)) throw new Error('DNI o PIN incorrectos.');
      await st.entrarCorporativo(g.id,pin||nuevoPin);
    } catch (e: any) { setError(e.message || 'No se pudo iniciar sesión.'); }
    finally { setOcupado(false); }
  };
  return <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={{ ...wrap, flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
    <Marca sub="Un teléfono del puesto. Una cuenta por guardia. Un informe compartido entre todos los turnos." />
    <Card pad><Stack gap={14}>
      <Eyebrow>{modo === 'migrar' ? 'Vincular DNI a mi cuenta anterior' : 'Iniciar sesión'}</Eyebrow>
      <Input label="DNI" value={dni} onChangeText={v => setDni(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={8} placeholder="Su DNI" />
      {modo === 'migrar' ? <>
        {st.nube.vinculada ? <Input label="Apellido y nombre de la cuenta anterior" value={nombreAnterior} onChangeText={setNombreAnterior} /> : <Selector label="Cuenta anterior" valor={anterior} onChange={setAnterior} opciones={st.list<Vigilador>('guards').filter(g => g.cuenta && !g.dni).map(g => ({ v: g.id, t: g.apellido + ', ' + g.nombre }))} />}
        <Input label="PIN actual" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />
        <Input label="Fecha de nacimiento registrada" value={nac} onChangeText={v => setNac(mascaraDmy(v))} keyboardType="number-pad" placeholder="DD/MM/AAAA" />
        {!st.nube.vinculada ? <Input label="PIN nuevo (sólo si aún no tenía uno)" value={nuevoPin} onChangeText={setNuevoPin} maxLength={6} secureTextEntry keyboardType="number-pad" /> : null}
      </> : <Input label="PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6} />}
      {error ? <Banner kind="warn">{error}</Banner> : null}
      <Btn label={ocupado ? 'Ingresando…' : modo === 'migrar' ? 'Vincular DNI e ingresar' : 'Iniciar sesión'} variant="primary" disabled={ocupado} onPress={ingresar} />
      {!st.me ? <Btn label="Registrarme" variant="ghost" onPress={() => { setModo('registrar'); setError(''); }} /> : null}
      <Btn label={modo === 'migrar' ? 'Volver a iniciar sesión' : 'Vincular DNI a mi cuenta anterior'} variant="ghost" size="sm" onPress={() => { setModo(modo === 'migrar' ? 'entrar' : 'migrar'); setError(''); }} />
    </Stack></Card>
  </KeyboardAwareScrollView>;
}

/* ================= alta de la cuenta ================= */
function CrearCuenta({ wrap, ps, onBack }: { wrap: any; ps: any[]; onBack: () => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();

  const sinObjetivo = !st.S.site.cliente;

  const [cliente, setCliente] = useState(st.S.site.cliente || '');
  const [region, setRegion] = useState(st.S.site.region || '');
  const [tituloInf, setTituloInf] = useState(st.S.site.nombre || '');
  const [prefijo, setPrefijo] = useState(st.S.site.prefijo || 'Gs');

  const [sexo,setSexo]=useState('');
  const [apellido,setApellido]=useState('');
  const [nombre,setNombre]=useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [nac, setNac] = useState('');
  const [dni, setDni] = useState('');
  const [foto, setFoto] = useState('');
  const [puestoId, setPuestoId] = useState(ps[0]?.id || '');
  const [franjaId, setFranjaId] = useState(franjasDe(st.S, ps[0]?.id)[0]?.id || '');
  const franjas = franjasDe(st.S, puestoId);

  const elegirFoto = async (camara: boolean) => {
    try {
      const perm = camara
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { toast('Hace falta el permiso para poder cargar la foto'); return; }
      const res = camara
        ? await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.6, allowsEditing: true, aspect: [1, 1] });
      if (res.canceled || !res.assets?.[0]) return;
      setFoto(await st.guardarFoto(res.assets[0].uri));
    } catch {
      toast('No se pudo cargar la foto');
    }
  };

  const crear = async () => {
    if (creando) return;
    setError('');
    if (!sexo) { setError('Seleccione su sexo.'); return; }
    if (!apellido || !nombre) { toast('Escriba su apellido y nombre completos'); return; }
    if (!puestoId) { toast('Seleccione su puesto'); return; }
    if (!franjaId) { toast('Seleccione su turno'); return; }
    if (!dniValido(dni)) { setError('Ingrese un DNI válido de 7 u 8 dígitos.'); return; }
    if (st.list<Vigilador>('guards').some(g => g.cuenta && dniNormal(g.dni || '') === dniNormal(dni))) { setError('Ese DNI ya tiene cuenta. Inicie sesión.'); return; }
    if (!/^\d{4,6}$/.test(pinNuevo) || pinNuevo !== confirmacion) { setError('Ingrese un PIN de 4 a 6 dígitos y repítalo en la confirmación.'); return; }
    if (!foto) { toast('Agregue su foto para la credencial'); return; }
    const fechaNac = isoDesdeDmy(nac);
    if (!fechaNac) { toast('Complete una fecha de nacimiento válida (DD/MM/AAAA)'); return; }

    /* Si el apellido coincide con alguien de la dotación precargada se reutiliza
       ese registro, así no queda duplicado en el equipo. */
    const norm = (x: string) => String(x || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
    const existente = st.list<Vigilador>('guards').find(g =>
      norm(g.apellido) === norm(apellido) &&
      (!nombre || !g.nombre || norm(g.nombre) === norm(nombre)));

    if (existente?.cuenta) { setError('Ya existe una cuenta con ese nombre. Inicie sesión con su DNI o vinculalo a la cuenta anterior.'); return; }
    setCreando(true);
    try {
    const { estado, guardId } = crearObjetivo(st.S, {
      cliente: cliente || 'Objetivo', region, nombre: tituloInf, prefijo,
      apellido, nombreVig: nombre, puestoId,
      franjaId: franjaId || franjas[0]?.id || '',
      dni: dniNormal(dni), fechaNac, foto, sexo: sexo as Vigilador['sexo'],
      guardId: existente?.id,
    });
    if(st.nube.vinculada)await st.registrarNube(estado.guards.find(g=>g.id===guardId)!,pinNuevo);
    else{await guardarPIN(guardId, pinNuevo);st.reemplazar(estado);await st.entrarCorporativo(guardId,pinNuevo);}
    } catch (e: any) { setError(e.message || 'No se pudo crear la cuenta.'); }
    finally { setCreando(false); }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={24} contentContainerStyle={wrap} keyboardShouldPersistTaps="handled">
      <Btn label="Volver a iniciar sesión" variant="ghost" onPress={onBack} />
      <Marca sub="Consola de puesto para vigiladores. Directivas, aperturas, informes y Informe general." />

      {sinObjetivo ? (
        <Card pad>
          <Stack gap={12}>
            <Eyebrow>El objetivo</Eyebrow>
            <Input label="Cliente / Site" value={cliente} onChangeText={setCliente} placeholder="Libertad Rosario" />
            <Input label="Región" value={region} onChangeText={setRegion} placeholder="Sur" />
            <Input label="Título de los informes" value={tituloInf} onChangeText={setTituloInf}
              placeholder="PASEO LIBERTAD ROSARIO"
              hint="Aparece en el encabezado del informe de seguridad." />
          </Stack>
        </Card>
      ) : null}

      <Card pad>
        <Stack gap={13}>
          <Eyebrow>Crear mi cuenta</Eyebrow>
          <Sub>Puede registrarse e ingresar sin una cuenta administradora previa. El rol de administrador se asigna desde la base de datos.</Sub>

          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 4 }}>
            {foto ? (
              <Image source={{ uri: foto }} style={{
                width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: t.accentLine,
              }} />
            ) : (
              <View style={{
                width: 104, height: 104, borderRadius: 52, backgroundColor: t.surface3,
                borderWidth: 1, borderColor: t.lineStrong, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: FONT.disp, fontSize: 12, color: t.muted, letterSpacing: 1 }}>FOTO</Text>
              </View>
            )}
            <Row gap={7}>
              <Btn label="Tomar foto" variant="ghost" size="sm" onPress={() => elegirFoto(true)} />
              <Btn label="De la galería" variant="ghost" size="sm" onPress={() => elegirFoto(false)} />
            </Row>
          </View>

          <Selector label="Sexo" valor={sexo} onChange={setSexo} opciones={[{v:'',t:'Seleccionar'},{v:'masculino',t:'Masculino'},{v:'femenino',t:'Femenino'}]}/>
          <Input label="Apellido" value={apellido} onChangeText={setApellido} placeholder="Apellido completo"/>
          <Input label="Nombre" value={nombre} onChangeText={setNombre} placeholder="Nombre completo" hint="Las firmas se muestran siempre como Apellido, Nombre."/>
          <Row gap={11} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Input label="Fecha de nacimiento" value={nac}
                onChangeText={v => setNac(mascaraDmy(v))}
                mono keyboardType="number-pad" placeholder="24/07/1990" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="DNI" value={dni} onChangeText={v => setDni(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={8} mono placeholder="Su DNI" />
            </View>
          </Row>

          <Selector label="Puesto" valor={puestoId}
            onChange={v => { setPuestoId(v); setFranjaId(franjasDe(st.S, v)[0]?.id || ''); }}
            opciones={ps.map(p => ({ v: p.id, t: p.nombre, sub: p.descripcion }))} />
          <Selector label="Turno" valor={franjaId} onChange={setFranjaId}
            hint="Este dato determina sus directivas y recordatorios. Puede modificarlo desde Perfil."
            opciones={franjas.map(f => ({
              v: f.id,
              t: (f.alias ? f.nombre + ' — ' + f.alias : f.nombre),
              sub: f.entrada + ' a ' + f.salida,
            }))} />

          <Input label="PIN (4 a 6 dígitos)" value={pinNuevo} onChangeText={setPinNuevo} keyboardType="number-pad" secureTextEntry maxLength={6} />
          <Input label="Repetir PIN" value={confirmacion} onChangeText={setConfirmacion} keyboardType="number-pad" secureTextEntry maxLength={6} />
          {error ? <Banner kind="warn">{error}</Banner> : null}
          <Divider />
          <Eyebrow>Apariencia</Eyebrow>
          <SelectorPaleta valor={st.paleta} onChange={st.setPaleta} oscuro={t.dark} />
          <Seg valor={st.tema} onChange={v => st.setTema(v as any)}
            opciones={[{ v: 'dark', t: 'Oscuro' }, { v: 'light', t: 'Claro' }, { v: 'auto', t: 'Automático' }]} />

          <Divider />
          <Banner kind="info" icon="perfil">
            <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.slate }}>
              Las novedades se comparten entre las cuentas de este teléfono. Cada guardia conserva su firma y sólo puede editar las de su turno abierto.
            </Text>
          </Banner>
          <Btn label={creando ? "Creando cuenta…" : "Crear cuenta y entrar"} disabled={creando} variant="primary" onPress={crear} />
        </Stack>
      </Card>
    </KeyboardAwareScrollView>
  );
}
