/* Selectores derivados del estado. Funciones puras, fáciles de testear. */
import {
  Estado, Directiva, DirectivaLog, AccesoLog, Vigilador, Visita, Puesto, Franja,
  isoDate, parseISO, toMin, numOf, accNormal, personasReales, duracionFranja,
} from './model';

const vivos = <T extends { deleted?: boolean }>(a: T[] = []) => a.filter(x => !x.deleted);

export const puestos = (S: Estado): Puesto[] =>
  vivos(S.posts).sort((a, b) => (a.orden || 0) - (b.orden || 0));
export const nombrePuesto = (S: Estado, id?: string) => {
  const p = S.posts.find(x => x.id === id);
  return p ? p.nombre : '';
};

export const franjasDe = (S: Estado, puestoId?: string): Franja[] =>
  vivos(S.franjas).filter(f => !puestoId || f.puestoId === puestoId).sort((a, b) => (a.orden || 0) - (b.orden || 0));
export const franjaPorId = (S: Estado, id?: string): Franja | undefined =>
  S.franjas.find(f => f.id === id && !f.deleted);
export const etiquetaFranja = (f?: Franja) =>
  !f ? '' : (f.alias || f.nombre) + ' ' + f.entrada + '–' + f.salida;
export const nombreFranja = (S: Estado, id?: string) => {
  const f = franjaPorId(S, id);
  return f ? (f.alias || f.nombre) : '';
};

/* ---------- directivas ---------- */
export function directivasDeHoy(S: Estado, me: Vigilador | null, fecha?: string): Directiva[] {
  const f = fecha || isoDate();
  const dow = parseISO(f).getDay();
  const mio = me?.puestoId || null;
  const miFranja = me?.franjaId || null;
  const fr = franjaPorId(S, me?.franjaId);
  const lista = vivos(S.directives)
    .filter(d => d.activa !== false)
    .filter(d => !d.dias || !d.dias.length || d.dias.indexOf(dow) >= 0)
    .filter(d => !d.puestoId || !mio || d.puestoId === mio)
    .filter(d => !d.franjaId || !miFranja || d.franjaId === miFranja);
  // Un turno que cruza la medianoche se ordena desde su hora de entrada.
  if (fr && toMin(fr.salida) <= toMin(fr.entrada)) {
    const base = toMin(fr.entrada);
    const rel = (h: string) => { let m = toMin(h) - base; if (m < 0) m += 1440; return m; };
    return lista.sort((a, b) => rel(a.hora) - rel(b.hora));
  }
  return lista.sort((a, b) => toMin(a.hora) - toMin(b.hora));
}
export const dlogDe = (S: Estado, fecha: string, directiveId: string): DirectivaLog | undefined =>
  vivos(S.dlogs).find(l => l.fecha === fecha && l.directiveId === directiveId);

export type EstadoDir = 'ok' | 'na' | 'vencida' | 'ahora' | 'pend';
export function estadoDirectiva(S: Estado, d: Directiva, fecha?: string, ahoraMin?: number): EstadoDir {
  const f = fecha || isoDate();
  const l = dlogDe(S, f, d.id);
  if (l) return l.estado;
  if (f !== isoDate()) return 'pend';
  const n = new Date();
  const m = ahoraMin != null ? ahoraMin : n.getHours() * 60 + n.getMinutes();
  const dm = toMin(d.hora);
  if (dm < 0) return 'pend';
  if (m > dm + 20) return 'vencida';
  if (m >= dm - 10) return 'ahora';
  return 'pend';
}
export const tagDirectiva: Record<EstadoDir, 'ok' | 'mute' | 'crit' | 'acc'> = {
  ok: 'ok', na: 'mute', vencida: 'crit', ahora: 'acc', pend: 'mute',
};

/* ---------- fichaje y turnos ---------- */
export const fichajeAbierto = (S: Estado, guardId: string) =>
  vivos(S.punches).find(p => p.guardId === guardId && !p.out);

export function horasDelMes(S: Estado, guardId: string, ym?: string) {
  const mes = ym || isoDate().slice(0, 7);
  let min = 0;
  vivos(S.punches)
    .filter(p => p.guardId === guardId && p.out && p.fecha.slice(0, 7) === mes)
    .forEach(p => { let d = toMin(p.out) - toMin(p.in); if (d < 0) d += 1440; min += d; });
  return min;
}
export function turnoDeHoy(S: Estado, guardId: string) {
  const s = vivos(S.shifts).find(x => x.guardId === guardId && x.fecha === isoDate());
  if (!s) return '';
  if (s.tipo === 'franco') return 'Franco';
  if (s.tipo === 'licencia') return 'Licencia';
  return (s.entrada || '') + (s.salida ? '–' + s.salida : '');
}

/* ---------- accesos ---------- */
export const catalogoAccesos = (S: Estado) =>
  vivos(S.accesses).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.nombre.localeCompare(b.nombre));

export function ultimoPrecinto(S: Estado): string {
  const registros = vivos(S.alogs).slice().sort((a, b) =>
    (b.orden || b.updatedAt) - (a.orden || a.updatedAt));
  for (const a of registros) {
    for (const p of [a.p2, a.p1]) if (/^\d{4,}$/.test(p || '')) return p;
  }
  return '';
}

export function proximoPrecinto(S: Estado): string {
  let max: number | null = null;
  vivos(S.alogs).forEach(a => {
    [a.p1, a.p2].forEach(p => {
      const n = numOf(p);
      if (n != null && (max == null || n > max)) max = n;
    });
  });
  return max == null ? '' : String(max + 1);
}
export const alogsDe = (S: Estado, fecha: string): AccesoLog[] =>
  vivos(S.alogs).filter(a => a.fecha === fecha).sort((a, b) => (a.orden || 0) - (b.orden || 0));

/* ---------- visitas ---------- */
export const visAdentro = (v: Visita) => !v.horaOut && (!v.acc || v.acc.autoriz !== 'retiro');
export const visEspera = (v: Visita) => visAdentro(v) && !!v.acc && v.acc.autoriz === 'espera';
export function visNombre(v: Visita) {
  const a = accNormal(v.acc, v);
  const per = personasReales(a);
  return a.empresa || (per[0] && per[0].nombre) || v.nombre || 'Sin identificar';
}

/* ---------- rondas ---------- */
export const rondaActiva = (S: Estado, guardId: string) =>
  vivos(S.rounds).find(r => !r.fin && r.guardId === guardId);

/* ---------- generador de diagrama ---------- */
export const CICLOS: Record<string, number[] | null> = {
  '12x36': [1, 0], '6x1': [1, 1, 1, 1, 1, 1, 0], '5x2': null,
  '4x2': [1, 1, 1, 1, 0, 0], '2x2': [1, 1, 0, 0], todos: [1],
};
