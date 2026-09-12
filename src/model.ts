/* Tipos y utilidades de dominio. Puerto directo de la versión web. */

export type Rec = { id: string; updatedAt: number; deleted?: boolean };

export type Persona = { nombre: string; dni: string };

export type ClaseAdjunto = 'seguro' | 'dni' | 'autorizacion' | 'cedula' | 'otro';
export type Adjunto = {
  id: string; uri: string; nombre: string;
  tipo: 'imagen' | 'pdf' | 'otro'; clase: ClaseAdjunto;
};
export const CLASES_ADJUNTO: [ClaseAdjunto, string][] = [
  ['seguro', 'Seguro'], ['dni', 'DNI'], ['autorizacion', 'Autorización'],
  ['cedula', 'Cédula del vehículo'], ['otro', 'Otro'],
];

export type Vehiculo = {
  activo: boolean; tipo: string;
  chofer: string; dniChofer: string;
  marca: string; modelo: string; dominio: string;
  poliza: string; obs: string;
  adjuntos: Adjunto[];
};
export const TIPOS_VEHICULO = ['Camión', 'Camioneta', 'Utilitario', 'Maquinaria', 'Automóvil', 'Moto'];
export const vehiculoVacio = (): Vehiculo => ({
  activo: false, tipo: 'Camión', chofer: '', dniChofer: '',
  marca: '', modelo: '', dominio: '', poliza: '', obs: '', adjuntos: [],
});
export type AutorizEstado = 'cctv' | 'admin' | 'espera' | 'retiro';
export type Acceso = {
  empresa: string; tarea: string; lugar: string;
  personas: Persona[];
  autoriz: AutorizEstado; confirmo: string;
  patente: string; credencial: string; obs: string;
  vehiculo?: Vehiculo;
};

export type Puesto = Rec & { nombre: string; descripcion: string; orden: number };
export type Franja = Rec & {
  puestoId: string; nombre: string; alias?: string;
  entrada: string; salida: string; orden: number;
};
export type Vigilador = Rec & {
  apellido: string; nombre: string; edad: string; email: string; tel: string;
  puestoId: string; puesto?: string; franjaId: string; legajo: string; dni?: string; foto: string;
  horaIn: string; horaOut: string; francos: string;
  rol: 'admin' | 'vigilador'; pin?: string;
  /* Fecha de nacimiento en ISO. La edad se calcula, no se carga a mano. */
  fechaNac?: string;
  sexo?: 'masculino' | 'femenino';
  /* Marca la cuenta creada en este teléfono, para distinguirla de la dotación
     precargada que solo sirve para elegir quién hizo cada apertura. */
  cuenta?: boolean;
};

/** Edad cumplida a partir de la fecha de nacimiento en ISO. */
export function edadDe(fechaNac?: string): string {
  if (!fechaNac || !/^\d{4}-\d{2}-\d{2}$/.test(fechaNac)) return '';
  const n = new Date(fechaNac + 'T00:00:00');
  if (isNaN(n.getTime())) return '';
  const h = new Date();
  let a = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) a--;
  return a >= 0 && a < 120 ? String(a) : '';
}

/** DD/MM/AAAA -> AAAA-MM-DD. Devuelve '' si la fecha no es válida. */
export function isoDesdeDmy(v: string): string {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length !== 8) return '';
  const dia = +d.slice(0, 2), mes = +d.slice(2, 4), anio = +d.slice(4);
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || anio < 1900) return '';
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getDate() !== dia || fecha.getMonth() !== mes - 1 || fecha > new Date()) return '';
  return anio + '-' + pad2(mes) + '-' + pad2(dia);
}
/** Va escribiendo la máscara DD/MM/AAAA mientras el vigilador tipea. */
export function mascaraDmy(v: string): string {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return d.slice(0, 2) + '/' + d.slice(2);
  return d.slice(0, 2) + '/' + d.slice(2, 4) + '/' + d.slice(4);
};

/** Parte un nombre completo en apellido y nombres, al uso del rubro. */
export function partirNombre(completo: string): { apellido: string; nombre: string } {
  const p = String(completo || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!p.length) return { apellido: '', nombre: '' };
  if (p.length === 1) return { apellido: titulo(p[0]), nombre: '' };
  return { apellido: titulo(p[0]), nombre: titulo(p.slice(1).join(' ')) };
}
export type Directiva = Rec & {
  hora: string; nombre: string; novedades: string;
  dias: number[]; puestoId: string; puesto?: string; franjaId: string; activa: boolean;
};
export type DirectivaLog = Rec & {
  fecha: string; directiveId: string; guardId: string;
  estado: 'ok' | 'na'; horaReal: string; novedades: string;
};
export type AccesoCat = Rec & { nombre: string; tipo: string; precintos: number; orden: number; playa?: boolean };
export type TipoPrecinto = 'plastico' | 'chapa' | '';
export const TIPOS_PRECINTO: [TipoPrecinto, string, string][] = [
  ['plastico', 'Plástico', 'rojo'],
  ['chapa', 'Chapa', 'gris'],
  ['', 'Sin aclarar', ''],
];
export const nombrePrecinto = (t?: TipoPrecinto) =>
  t === 'plastico' ? 'plástico' : t === 'chapa' ? 'chapa' : '';

export type AccesoLog = Rec & {
  tipo: 'apertura' | 'cierre'; hora: string; fecha: string;
  guardId: string; gs: string; acceso: string;
  p1: string; p2: string; p1tipo?: TipoPrecinto; p2tipo?: TipoPrecinto;
  nota: string; orden: number; novId?: string;
  createdBy?: string; turnoId?: string; lockedAt?: number;
};
export type Novedad = Rec & {
  createdBy?: string;
  fecha: string; hora: string; guardId: string; categoria: string;
  texto: string; acc?: Acceso | null; visitId?: string;
  mov?: 'in' | 'out' | 'conf'; alogId?: string;
  trascendente?: boolean;
  turnoId?: string;
  lockedAt?: number;
  fotos?: string[];
  origenId?: string;
  origenTipo?: 'policial' | 'guardia' | 'recorrido' | 'libro-foto';
  autoKey?: string;
  datos?: import('./reporte').DatosAsiento;
};
export type Visita = Rec & {
  tipo: string; acc: Acceso; nombre: string; horaIn: string; horaOut: string;
  fecha: string; guardId: string; createdAt: number;
  novIn?: string; novOut?: string; novConf?: string;
};
export type PuntoRonda = { n: string; hora: string; estado: string; obs: string };
export type Ronda = Rec & {
  tplId: string; nombre: string; guardId: string; fecha: string;
  inicio: string; fin: string; createdAt: number; puntos: PuntoRonda[];
};
export type RondaTpl = Rec & { nombre: string; puntos: string[] };
export type Turno = Rec & {
  guardId: string; fecha: string;
  tipo: 'turno' | 'franco' | 'extra' | 'licencia';
  entrada: string; salida: string;
};
export type Fichaje = Rec & {
  guardId: string; fecha: string; in: string; out: string;
  fechaOut?: string; startedAt?: number; closedAt?: number;
  puestoId?: string; puesto?: string; franjaId?: string; turno?: string;
  cierre?: string;
};
export type LocalComercial = Rec & { nombre: string; apertura: string; cierre: string; orden: number };
export type ControlLocal = { localId: string; nombre: string; previsto: string; estado: 'abierto' | 'cerrado' | 'sin-control'; hora: string; obs: string };
export type RecorridoLocales = Rec & {
  tipo: 'apertura' | 'cierre'; fecha: string; hora: string; guardId: string; turnoId: string;
  controles: ControlLocal[]; observaciones: string; novId: string;
};
export type AvisoEnvio = Rec & {
  recorridoId: string; destino: string; texto: string;
  estado: 'pendiente' | 'enviado' | 'error'; error?: string; enviadoAt?: number;
};
export type Contacto = Rec & { nombre: string; rol: string; tel: string };
/* Informe general de las 24 horas, el que se manda al supervisor. */
export type InformeDia = Rec & {
  fecha: string;          // día de inicio de la ventana
  desde: string;          // hora de corte, por ejemplo 19:00
  hasta: string;
  cierre: string;         // párrafo final, editable
  texto: string;          // el informe redactado, tal como se comparte
  fotos: string[];
  fuente?: string;        // borrador exacto que se revisó; invalida redacciones desactualizadas
  trascendentes?: boolean;
  createdBy: string; createdAt: number;
};

export type Informe = Rec & {
  fecha: string; hora: string; createdBy: string; plantilla: string;
  estado: string; createdAt: number; fotos: string[];
  [k: `f${number}`]: any;
};

export type Site = {
  cliente: string; region: string; nombre: string; prefijo: string;
  alogLibro?: boolean;
  /* Los precintos vienen numerados correlativos: los primeros dígitos se
     repiten todo el rollo y solo cambian los últimos tres. */
  precintoPrefijo?: string;
  /* Ventana del informe de 24 horas: hora de corte, por ejemplo 19. */
  corteInforme?: string;
  inmobiliariaTel?: string;
  supervisorTel?: string;
};

export const LARGO_SUFIJO_PRECINTO = 3;
export const soloDigitos = (v: any) => String(v || '').replace(/\D/g, '');
export const prefijoPrecinto = (n: any) => {
  const d = soloDigitos(n);
  return d.length >= 4 ? d.slice(0, 4) : '';
};
export const sufijoPrecinto = (n: any) => {
  const d = soloDigitos(n);
  return d.length > LARGO_SUFIJO_PRECINTO ? d.slice(-LARGO_SUFIJO_PRECINTO) : d;
};
export const armarPrecinto = (pref: string, sufijo: string) => {
  const s = soloDigitos(sufijo);
  if (!s) return '';
  return s.length === 3 && soloDigitos(pref).length >= 4 ? soloDigitos(pref).slice(0, 4) + s : s;
};

export type Estado = {
  rev: number; updatedAt: number; site: Site;
  posts: Puesto[]; franjas: Franja[]; guards: Vigilador[]; directives: Directiva[]; dlogs: DirectivaLog[];
  accesses: AccesoCat[]; alogs: AccesoLog[]; reports: Informe[]; novedades: Novedad[];
  visits: Visita[]; rounds: Ronda[]; rtemplates: RondaTpl[]; shifts: Turno[];
  punches: Fichaje[]; contacts: Contacto[]; infdias: InformeDia[];
  locales: LocalComercial[]; recorridos: RecorridoLocales[]; envios: AvisoEnvio[];
};

export const COLS = [
  'posts', 'franjas', 'guards', 'directives', 'dlogs', 'accesses', 'alogs', 'reports',
  'novedades', 'visits', 'rounds', 'rtemplates', 'shifts', 'punches', 'contacts', 'infdias',
  'locales', 'recorridos', 'envios',
] as const;
export type Col = (typeof COLS)[number];

export const estadoVacio = (): Estado => {
  const s: any = {
    rev: 0, updatedAt: 0,
    site: {
      cliente: '', region: '', nombre: '', prefijo: 'Gs', alogLibro: false,
      precintoPrefijo: '', corteInforme: '19',
    },
  };
  COLS.forEach(c => (s[c] = []));
  return s as Estado;
};

/* ---------- utilidades ---------- */
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();
export const pad2 = (n: number | string) => String(n).padStart(2, '0');
export const isoDate = (d?: Date) => {
  d = d || new Date();
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
};
export const hhmm = (d?: Date) => { d = d || new Date(); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };
export const toMin = (t?: string) => {
  if (!t) return -1;
  const p = String(t).split(':');
  return (+p[0] || 0) * 60 + (+p[1] || 0);
};
export const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const dmy = (iso?: string) => { if (!iso) return ''; const p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; };
export const dmyShort = (iso: string) => { const p = iso.split('-'); return p[2] + '/' + p[1]; };
export const parseISO = (iso: string) => { const p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
export const addDays = (iso: string, n: number) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d); };
export const titulo = (s: string) => String(s || '').replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
export const numOf = (v: any) => { const n = parseInt(String(v).replace(/\D/g, ''), 10); return isNaN(n) ? null : n; };
export const hs = (m: number) => Math.floor(m / 60) + 'h ' + pad2(m % 60) + 'm';
export const duracionFranja = (entrada: string, salida: string) => {
  let d = toMin(salida) - toMin(entrada);
  if (d <= 0) d += 1440;
  return d;
};
export const enFranja = (entrada: string, salida: string, min: number) => {
  const a = toMin(entrada), b = toMin(salida);
  return a <= b ? min >= a && min < b : min >= a || min < b;
};
export const fmtDNI = (d: any) => {
  const n = String(d || '').replace(/\D/g, '');
  return n.length >= 7 ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : String(d || '');
};

/* ---------- fusión de estados (last-write-wins por registro) ---------- */
export function merge(a: Estado, b: Estado | null): Estado {
  if (!b) return a;
  if (!a) return b;
  const out = estadoVacio() as any;
  out.site = (b.updatedAt || 0) > (a.updatedAt || 0)
    ? Object.assign({}, a.site, b.site)
    : Object.assign({}, b.site, a.site);
  out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
  out.rev = Math.max(a.rev || 0, b.rev || 0);
  COLS.forEach(c => {
    const m = new Map<string, any>();
    ((a as any)[c] || []).forEach((r: Rec) => r && r.id && m.set(r.id, r));
    ((b as any)[c] || []).forEach((r: Rec) => {
      if (!r || !r.id) return;
      const p = m.get(r.id);
      if (!p || (r.updatedAt || 0) >= (p.updatedAt || 0)) m.set(r.id, r);
    });
    out[c] = Array.from(m.values());
  });
  return out as Estado;
}

/* ---------- accesos de personal ---------- */
export const accVacio = (): Acceso => ({
  empresa: '', tarea: '', lugar: '',
  personas: [{ nombre: '', dni: '' }],
  autoriz: 'cctv', confirmo: '', patente: '', credencial: '', obs: '',
  vehiculo: vehiculoVacio(),
});

export function accNormal(a?: any, v?: any): Acceso {
  a = a || {};
  const out: Acceso = Object.assign(accVacio(), a);
  if (!Array.isArray(a.personas) || !a.personas.length) {
    const nom = a.nombre || (v && v.nombre) || '';
    const dni = a.dni || (v && v.dni) || '';
    out.personas = nom || dni ? [{ nombre: nom, dni }] : [{ nombre: '', dni: '' }];
  }
  if (!out.empresa && a.razon) out.empresa = a.razon;
  if (!out.empresa && v && v.empresa) out.empresa = v.empresa;
  if (!out.lugar) out.lugar = a.lugar || (v && v.destino) || '';
  if (!a.autoriz) out.autoriz = a.autorizado === false ? 'retiro' : 'cctv';
  if (v) {
    out.patente = out.patente || v.patente || '';
    out.credencial = out.credencial || v.credencial || '';
    out.obs = out.obs || v.obs || '';
  }
  const veh: Vehiculo = { ...vehiculoVacio(), ...(a.vehiculo || {}) };
  if (!Array.isArray(veh.adjuntos)) veh.adjuntos = [];
  /* registros viejos: el dominio suelto pasa a ser el del vehículo */
  if (!veh.activo && out.patente) { veh.activo = true; veh.dominio = veh.dominio || out.patente; }
  out.vehiculo = veh;
  return out;
}
export const personasReales = (a: Acceso) =>
  (a.personas || []).filter(p => (p.nombre || '').trim() || (p.dni || '').trim());

/* 'admin' ya no se ofrece al cargar un ingreso, pero sigue reconociéndose para
   no romper los registros viejos. */
export const AUTZ: [AutorizEstado, string, 'ok' | 'info' | 'warn' | 'crit'][] = [
  ['cctv', 'Confirmada por CCTV', 'ok'],
  ['espera', 'Sin confirmar · aguarda', 'warn'],
  ['retiro', 'Sin confirmar · se retira', 'crit'],
];
export const AUTZ_TODAS: [AutorizEstado, string, 'ok' | 'info' | 'warn' | 'crit'][] = [
  ...AUTZ, ['admin', 'Confirmada por Administración', 'info'],
];
export const autLabel = (k: string) => (AUTZ_TODAS.find(a => a[0] === k) || AUTZ[0])[1];
export const autTag = (k: string) => (AUTZ_TODAS.find(a => a[0] === k) || AUTZ[0])[2];
