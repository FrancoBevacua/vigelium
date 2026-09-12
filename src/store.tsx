/* Estado de la aplicación: memoria, persistencia local y acciones. */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { prepararFoto, leerBytes, bytesBase64 } from './media';
import { File, Directory, Paths } from 'expo-file-system';
import {
  Estado, Col, Rec, Vigilador, estadoVacio, merge, uid, now, isoDate, titulo,
} from './model';
import { PUESTOS_BASE, ACCESOS_BASE, CONTACTOS_BASE, RONDA_BASE, VIGILADORES_BASE } from './seed';
import { setVocabulario } from './assistant';
import type { ModoTema } from './ui';
import { PALETA_DEFECTO, PaletaId } from './theme';
import { iniciarServicio, cerrarServicio, validarCambioNovedad, turnoAbierto, motivoSoloLectura, horaValida, fechaValida } from './servicio';
import { guardarPIN, tienePIN, borrarPIN } from './cuentas';
import { aplicarCambios, restaurarRespaldo } from './mutaciones';
import * as nube from './nube';
import {CODIGO_CORPORATIVO} from './provisionCorporativa';

const K_ESTADO = 'consigna.estado.v1';
const K_SESION = 'consigna.sesion.v1';
const K_TEMA = 'consigna.tema';
const K_PALETA = 'consigna.paleta';
const K_ASIS = 'consigna.asistente';
const K_AVISOS = 'consigna.avisos';

type Ctx = {
  listo: boolean;
  errorInicio:string;
  reintentarInicio:()=>void;
  S: Estado;
  me: Vigilador | null;
  tema: ModoTema;
  paleta: PaletaId;
  asistente: boolean;
  avisos: boolean;
  setTema: (m: ModoTema) => void;
  setPaleta: (p: PaletaId) => void;
  setAsistente: (v: boolean) => void;
  setAvisos: (v: boolean) => void;
  entrar: (id: string) => void;
  salir: () => Promise<void>;
  nube: nube.EstadoNube;
  ingresarNube: (dni:string,pin:string) => Promise<void>;
  vincularCuentaNube: (dni:string,pin:string,nombre:string,nacimiento:string) => Promise<void>;
  registrarNube: (g:Vigilador,pin:string) => Promise<void>;
    entrarCorporativo:(id:string,pin:string)=>Promise<void>;
  reintentarNube: () => Promise<void>;
  cargarCatalogoNube: () => Promise<void>;
  iniciarTurno: () => void;
  cerrarTurno: (cierre: string) => Promise<void>;
  list: <T = any>(c: Col) => T[];
  byId: <T = any>(c: Col, id: string) => T | undefined;
  put: <T extends Partial<Rec>>(c: Col, obj: T) => T & Rec;
  putVarios: (cambios: { col: Col; obj: any }[]) => void;
  drop: (c: Col, id: string) => void;
  setSite: (s: Partial<Estado['site']>) => void;
  reemplazar: (e: Estado) => void;
  guardarFoto: (uri: string) => Promise<string>;
  guardarArchivo: (uri: string, nombre: string) => Promise<string>;
  esAdmin: boolean;
};

const StoreCtx = createContext<Ctx>(null as any);
export const useStore = () => useContext(StoreCtx);

/* ---------- semillas y migraciones ---------- */
function sembrarPuestos(S: Estado) {
  if (S.posts.length) return;
  PUESTOS_BASE.forEach((p, i) => {
    const id = uid();
    S.posts.push({ id, nombre: p.n, descripcion: p.d, orden: i, updatedAt: now() });
    p.turnos.forEach((tn, k) => {
      const fid = uid();
      S.franjas.push({
        id: fid, puestoId: id, nombre: tn.nombre, alias: tn.alias,
        entrada: tn.entrada, salida: tn.salida, orden: k, updatedAt: now(),
      });
      tn.dirs.forEach(d => S.directives.push({
        id: uid(), hora: d[0], nombre: d[1], novedades: d[2] || '',
        dias: [], puestoId: id, puesto: p.n, franjaId: fid, activa: true, updatedAt: now(),
      }));
    });
  });
}
export function sembrarEquipo(S: Estado) {
  if (S.guards.length) return;
  VIGILADORES_BASE.forEach(([apellido, nombre]) => S.guards.push({
    id: uid(), apellido, nombre, edad: '', email: '', tel: '',
    puestoId: '', franjaId: '', legajo: '', foto: '',
    horaIn: '', horaOut: '', francos: '', rol: 'vigilador', updatedAt: now(),
  }));
}
export function sembrarCatalogo(S: Estado) {
  if (S.accesses.length) return;
  ACCESOS_BASE.forEach((n: string, i: number) => S.accesses.push({
    id: uid(), nombre: n,
    tipo: /Pecera/.test(n) ? 'pecera' : /Puerta/.test(n) ? 'puerta' : 'porton',
    precintos: /Pecera|Bar Cup/.test(n) ? 0 : /Puerta E/.test(n) ? 2 : 1,
    orden: i, updatedAt: now(),
  }));
  S.rtemplates.push({ id: uid(), nombre: RONDA_BASE.nombre, puntos: RONDA_BASE.puntos.slice(), updatedAt: now() });
  CONTACTOS_BASE.forEach((c: string[]) => S.contacts.push({ id: uid(), nombre: c[0], rol: c[1], tel: c[2], updatedAt: now() }));
}
function migrar(S: Estado) {
  if (!S.posts) (S as any).posts = [];
  if (!S.franjas) (S as any).franjas = [];
  const vivos = <T extends Rec>(a: T[]) => (a || []).filter(x => !x.deleted);
  if (!S.posts.length && !vivos(S.guards).length) { sembrarPuestos(S); }
  else if (!S.posts.length) {
    const nombres: string[] = [];
    const add = (n?: string) => { n = String(n || '').trim(); if (n && nombres.indexOf(n) < 0) nombres.push(n); };
    vivos(S.guards).forEach(g => add(g.puesto));
    vivos(S.directives).forEach(d => add(d.puesto));
    const mapa: Record<string, string> = {};
    nombres.forEach((n, i) => { const id = uid(); mapa[n] = id; S.posts.push({ id, nombre: n, descripcion: '', orden: i, updatedAt: now() }); });
    vivos(S.guards).forEach(g => { if (g.puesto && mapa[g.puesto]) { g.puestoId = mapa[g.puesto]; g.updatedAt = now(); } });
    vivos(S.directives).forEach(d => { if (d.puesto && mapa[d.puesto]) { d.puestoId = mapa[d.puesto]; d.updatedAt = now(); } });
  }
  const gs = vivos(S.guards);
  gs.forEach(g => {
    if (!g.puestoId && g.puesto) {
      const p = vivos(S.posts).find(x => x.nombre === g.puesto);
      if (p) { g.puestoId = p.id; g.updatedAt = now(); }
    }
    if (!g.franjaId && g.puestoId) {
      const f = vivos(S.franjas).filter(x => x.puestoId === g.puestoId).sort((a, b) => a.orden - b.orden)[0];
      if (f) { g.franjaId = f.id; g.horaIn = g.horaIn || f.entrada; g.horaOut = g.horaOut || f.salida; g.updatedAt = now(); }
    }
  });
}
function vocabulario(S: Estado): string[] {
  const out: string[] = [];
  S.accesses.forEach(a => out.push(a.nombre));
  S.posts.forEach(p => out.push(p.nombre));
  S.franjas.forEach(f => out.push(f.alias || ''));
  S.guards.forEach(g => { out.push(g.apellido); out.push(g.nombre); });
  out.push(S.site.cliente, S.site.nombre);
  return out.filter(Boolean);
}

/* ---------- proveedor ---------- */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<Estado>(() => estadoVacio());
  const [me, setMe] = useState<Vigilador | null>(null);
  const meRef=useRef<Vigilador|null>(null);meRef.current=me;
  const [listo, setListo] = useState(false);
  const [errorInicio,setErrorInicio]=useState('');
  const [intentoInicio,setIntentoInicio]=useState(0);
  const [tema, setTemaEstado] = useState<ModoTema>('dark');
  const [paleta, setPaletaEstado] = useState<PaletaId>(PALETA_DEFECTO);
  const [asistente, setAsisEstado] = useState(true);
  const [avisos, setAvisosEstado] = useState(true);
  const [estadoNube,setEstadoNube]=useState(nube.verEstadoNube());
  useEffect(()=>nube.escucharNube(setEstadoNube),[]);
  const ref = useRef<Estado>(S);
  const guardarTimer = useRef<any>(null);
  ref.current = S;

  /* carga inicial */
  useEffect(() => {
    setListo(false);setErrorInicio('');
    (async () => {
      try {
        // Desde 1.4.2 no se ejecuta ninguna limpieza de cuentas, claves ni historial.
        let vinculada=await nube.iniciarNube();
        if(Platform.OS!=='web'){await nube.conectarTelefono();vinculada=true;}
        const [crudo, sesion, tm, pal, asis, avi] = await Promise.all([
          vinculada ? Promise.resolve(null) : AsyncStorage.getItem(K_ESTADO), vinculada ? Promise.resolve(null) : AsyncStorage.getItem(K_SESION),
          AsyncStorage.getItem(K_TEMA), AsyncStorage.getItem(K_PALETA),
          AsyncStorage.getItem(K_ASIS), AsyncStorage.getItem(K_AVISOS),
        ]);
        let e = crudo ? merge(estadoVacio(), JSON.parse(crudo)) : estadoVacio();
        if(vinculada){try{e=await nube.catalogoNube();}catch{e=estadoVacio();}}
        else migrar(e);
        for (const g of e.guards) {
          if (g.cuenta && g.pin) {
            if (!await tienePIN(g.id)) await guardarPIN(g.id, g.pin);
            delete g.pin;
          }
        }
        setVocabulario(vocabulario(e));
        ref.current = e; setS(e);
        if(!vinculada)await AsyncStorage.setItem(K_ESTADO, JSON.stringify(e));
        if (sesion && Platform.OS==='web') {
          const g = e.guards.find(x => x.id === sesion && !x.deleted);
          if (g?.cuenta) setMe(g);
        }
        if (tm) setTemaEstado(tm as ModoTema);
        if (pal) setPaletaEstado(pal as PaletaId);
        if (asis != null) setAsisEstado(asis !== '0');
        if (avi != null) setAvisosEstado(avi !== '0');
      } catch (err) {
        setErrorInicio(err instanceof Error?err.message:'No se pudo preparar el acceso. Vuelva a intentar.');
        console.warn('No se pudo leer el estado guardado', err);
      } finally {
        setListo(true);
      }
    })();
  }, [intentoInicio]);

  const persistir = useCallback((e: Estado) => {
    clearTimeout(guardarTimer.current);
    guardarTimer.current = setTimeout(() => {
      if(nube.verEstadoNube().vinculada)nube.guardarEnNube(e).then(()=>{
        const confirmado=nube.estadoConfirmado();
        if(confirmado&&ref.current===e){ref.current=confirmado;setS(confirmado);setMe(g=>g?confirmado.guards.find(x=>x.id===g.id)||g:null);setVocabulario(vocabulario(confirmado));}
      }).catch(()=>{});
      else AsyncStorage.setItem(K_ESTADO, JSON.stringify(e)).catch(() => {});
    }, 350);
  }, []);

  const aplicar = useCallback((mut: (e: Estado) => void) => {
      const prev = ref.current;
      const e: Estado = { ...prev };
      (Object.keys(e) as (keyof Estado)[]).forEach(k => {
        if (Array.isArray((e as any)[k])) (e as any)[k] = ((prev as any)[k] as any[]).slice();
      });
      e.site = { ...prev.site };
      mut(e);
      e.updatedAt = now();
      setVocabulario(vocabulario(e));
      persistir(e);
      ref.current = e;
      setS(e);
  }, [persistir]);

  const lote = useCallback((cambios: { col: Col; obj: any }[], servicio = false) => {
    aplicar(e => Object.assign(e, aplicarCambios(e, cambios, me, servicio)));
  }, [aplicar, me]);

  const aceptarNube=async(r:{estado:Estado;guardia:string})=>{
    clearTimeout(guardarTimer.current);
    ref.current=r.estado;setS(r.estado);meRef.current=r.estado.guards.find(g=>g.id===r.guardia&&!g.deleted)||null;setMe(meRef.current);
    setVocabulario(vocabulario(r.estado));
    await AsyncStorage.removeItem(K_ESTADO);await AsyncStorage.removeItem(K_SESION);
  };

  const api: Ctx = useMemo(() => ({
    listo, S, me, tema, paleta, asistente, avisos,
    errorInicio,reintentarInicio:()=>setIntentoInicio(v=>v+1),
    nube:estadoNube,
    ingresarNube:async(dni,pin)=>aceptarNube(await nube.ingresarNube(dni,pin)),
    vincularCuentaNube:async(dni,pin,nombre,nacimiento)=>aceptarNube(await nube.vincularCuentaNube(dni,pin,nombre,nacimiento)),
    registrarNube:async(g,pin)=>aceptarNube(await nube.registrarNube(g,pin)),
      entrarCorporativo:async(id,pin)=>{
        const g=ref.current.guards.find(x=>x.id===id&&!x.deleted);if(!g)throw Error('Cuenta no disponible.');
        if(Platform.OS==='web'){setMe(g);return;}
        clearTimeout(guardarTimer.current);
        await AsyncStorage.setItem(K_ESTADO,JSON.stringify(ref.current));
        await aceptarNube(await nube.vincularNube(CODIGO_CORPORATIVO,ref.current,g,pin));
      },
    reintentarNube:async()=>{clearTimeout(guardarTimer.current);await nube.guardarEnNube(ref.current);await nube.reintentarNube();await aceptarNube(await nube.consultarNube());},
    cargarCatalogoNube:async()=>{const e=await nube.catalogoNube();if(!meRef.current){ref.current=e;setS(e);}},
    esAdmin: !!me && me.rol === 'admin',
    setTema: (m) => { setTemaEstado(m); AsyncStorage.setItem(K_TEMA, m).catch(() => {}); },
    setPaleta: (p) => { setPaletaEstado(p); AsyncStorage.setItem(K_PALETA, p).catch(() => {}); },
    setAsistente: (v) => { setAsisEstado(v); AsyncStorage.setItem(K_ASIS, v ? '1' : '0').catch(() => {}); },
    setAvisos: (v) => { setAvisosEstado(v); AsyncStorage.setItem(K_AVISOS, v ? '1' : '0').catch(() => {}); },
    entrar: (id) => {
      const g = ref.current.guards.find(x => x.id === id);
      if (g) { setMe(g); AsyncStorage.setItem(K_SESION, id).catch(() => {}); }
    },
    salir: async () => {
      if (turnoAbierto(ref.current, me?.id)) throw new Error('Cierre su turno desde Inicio o Informe general antes de salir.');
      if(nube.verEstadoNube().vinculada){clearTimeout(guardarTimer.current);await nube.guardarEnNube(ref.current);await nube.cerrarSesionNube();ref.current=estadoVacio();setS(estadoVacio());}
      setMe(null); AsyncStorage.removeItem(K_SESION).catch(() => {});
    },
    iniciarTurno: () => {
      if (!me) throw new Error('Inicie sesión.');
      lote(iniciarServicio(ref.current, me), true);
    },
    cerrarTurno: async cierre => {
      if (!me) throw new Error('Inicie sesión.');
      const e = aplicarCambios(ref.current, cerrarServicio(ref.current, me, cierre), me, true);
      e.updatedAt = now();
      clearTimeout(guardarTimer.current);
      if(nube.verEstadoNube().vinculada){
        try{await nube.guardarEnNube(e);}catch(err){if(nube.verEstadoNube().pendiente){ref.current=e;setS(e);}throw err;}
        ref.current=e;setS(e);await nube.cerrarSesionNube();setMe(null);ref.current=estadoVacio();setS(estadoVacio());return;
      }
      try { await AsyncStorage.setItem(K_ESTADO, JSON.stringify(e)); }
      catch { throw new Error('No se pudo guardar el cierre en el teléfono. Liberá espacio y vuelva a intentarlo.'); }
      ref.current = e; setS(e);
      setMe(null); await AsyncStorage.removeItem(K_SESION).catch(() => {});
    },
    list: (c) => ((S as any)[c] || []).filter((r: Rec) => !r.deleted),
    byId: (c, id) => ((S as any)[c] || []).find((r: Rec) => r.id === id),
    put: (c, obj: any) => {
      const guardado = { ...obj, id: obj.id || uid(), updatedAt: now() };
      lote([{ col: c, obj: guardado }]);
      if (me && c === 'guards' && guardado.id === me.id) setMe(g => ({ ...(g as any), ...guardado }));
      return guardado;
    },
    putVarios: (cambios) => {
      lote(cambios);
    },
    drop: (c, id) => { if ((ref.current[c] as Rec[]).some(r => r.id === id)) lote([{ col: c, obj: { id, deleted: true } }]); },
    setSite: (s) => aplicar(e => { e.site = { ...e.site, ...s }; }),
    reemplazar: (e) => { if (me) e = restaurarRespaldo(ref.current, e, me); migrar(e); setVocabulario(vocabulario(e)); ref.current = e; setS(e); persistir(e); },
    guardarArchivo: async (uri: string, nombre: string) => {
      try {
        if (Platform.OS === 'web' || nube.verEstadoNube().vinculada) {
          const mime = /\.pdf$/i.test(nombre) ? 'application/pdf' : 'application/octet-stream';
          return 'data:' + mime + ';base64,' + bytesBase64(await leerBytes(uri));
        }
        const dir = new Directory(Paths.document, 'adjuntos');
        if (!dir.exists) dir.create({ intermediates: true });
        const ext = (nombre.match(/\.[a-z0-9]+$/i) || ['.bin'])[0];
        const destino = new File(dir, uid() + ext);
        new File(uri).copy(destino);
        return destino.uri;
      } catch (err) {
        console.warn('No se pudo copiar el archivo', err);
        return uri;
      }
    },
    guardarFoto: async (uri: string) => {
      try {
        const foto = await prepararFoto(uri);
        if (Platform.OS === 'web' || nube.verEstadoNube().vinculada) {if(nube.verEstadoNube().vinculada)nube.borrarTemporalNube(foto.uri);return 'data:image/jpeg;base64,' + foto.base64;}
        const dir = new Directory(Paths.document, 'fotos');
        if (!dir.exists) dir.create({ intermediates: true });
        const destino = new File(dir, uid() + '.jpg');
        const origen = new File(foto.uri);
        origen.copy(destino);
        return destino.uri;
      } catch (err) {
        console.warn('No se pudo copiar la foto', err);
        throw new Error('No se pudo guardar la foto en este dispositivo.');
      }
    },
  }), [listo, S, me, tema, paleta, asistente, avisos, estadoNube, aplicar, persistir, lote, errorInicio]);

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

/* ---------- alta inicial ---------- */
export function crearObjetivo(
  S: Estado,
  datos: {
    cliente: string; region: string; nombre: string; prefijo: string;
    apellido: string; nombreVig: string; puestoId: string; franjaId: string;
    legajo?: string; dni?: string; fechaNac?: string; foto?: string; sexo?: Vigilador['sexo'];
    guardId?: string;
  }
): { estado: Estado; guardId: string } {
  const e: Estado = JSON.parse(JSON.stringify(S));
  e.site = {
    ...e.site,
    cliente: datos.cliente, region: datos.region,
    nombre: datos.nombre || datos.cliente, prefijo: datos.prefijo || 'Gs', alogLibro: false,
  };
  const fr = e.franjas.find(f => f.id === datos.franjaId);
  const puestoNombre = (e.posts.find(p => p.id === datos.puestoId) || { nombre: '' }).nombre;
  const existente = datos.guardId ? e.guards.find(x => x.id === datos.guardId) : undefined;
  let g: Vigilador;
  if (existente) {
    Object.assign(existente, {
      puestoId: datos.puestoId, franjaId: datos.franjaId, puesto: puestoNombre,
      horaIn: fr?.entrada || '06:00', horaOut: fr?.salida || '14:00',
      legajo: datos.legajo ?? existente.legajo, dni: datos.dni ?? existente.dni,
      fechaNac: datos.fechaNac ?? existente.fechaNac, sexo: datos.sexo ?? existente.sexo,
      foto: datos.foto || existente.foto,
      cuenta: true, rol: 'vigilador', updatedAt: now(),
    });
    g = existente;
  } else {
    g = {
      id: uid(), apellido: titulo(datos.apellido), nombre: titulo(datos.nombreVig),
      edad: '', email: '', tel: '', puestoId: datos.puestoId, franjaId: datos.franjaId,
      puesto: puestoNombre, legajo: datos.legajo || '', dni: datos.dni || '', foto: datos.foto || '',
      fechaNac: datos.fechaNac || '', sexo: datos.sexo,
      horaIn: fr?.entrada || '06:00', horaOut: fr?.salida || '14:00', francos: '',
      cuenta: true, rol: 'vigilador', updatedAt: now(),
    };
    e.guards.push(g);
  }
  sembrarCatalogo(e);
  e.updatedAt = now();
  return { estado: e, guardId: g.id };
}

