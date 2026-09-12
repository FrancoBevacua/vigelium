import { Estado, Fichaje, Novedad, Vigilador, Col, hhmm, isoDate, uid, dmy } from './model';
import { gsName } from './text';
import { entradasDeVentana } from './informedia';

export const horaValida = (hora: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
export function fechaValida(fecha: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(fecha + 'T12:00:00');
  return !Number.isNaN(d.getTime()) && isoDate(d) === fecha;
}
export const turnoAbierto = (S: Estado, guardId?: string) => S.punches.find(p => !p.deleted && p.guardId === guardId && !p.out && !p.closedAt);

export function motivoSoloLectura(S: Estado, n: Novedad, guardId?: string): string {
  if ((n.createdBy || n.guardId) !== guardId) return 'Novedad de otro guardia. Sólo lectura.';
  if (n.lockedAt || (n.turnoId && S.punches.some(p => p.id === n.turnoId && (p.closedAt || p.out)))) return 'El turno está cerrado. Esta novedad es de sólo lectura.';
  const activo = turnoAbierto(S, guardId);
  if (!activo) return 'Inicie un turno para registrar novedades.';
  if (n.turnoId && n.turnoId !== activo.id) return 'La novedad corresponde a otro turno. Sólo lectura.';
  if (!n.turnoId && (n.fecha + 'T' + n.hora < activo.fecha + 'T' + activo.in)) return 'Novedad de un turno anterior. Sólo lectura.';
  return '';
}

/** Se valida también en el almacén, no sólo escondiendo botones. */
export function validarCambioNovedad(S: Estado, previa: Novedad | undefined, actor?: Vigilador | null) {
  if (!actor) throw new Error('Inicie sesión para registrar novedades.');
  const motivo = previa ? motivoSoloLectura(S, previa, actor.id) : (!turnoAbierto(S, actor.id) ? 'Inicie un turno para registrar novedades.' : '');
  if (motivo) throw new Error(motivo);
}

type Cambio = { col: Col; obj: any };
export function iniciarServicio(S: Estado, g: Vigilador, momento = new Date()): Cambio[] {
  if (turnoAbierto(S, g.id)) throw new Error('Ya tiene un turno abierto.');
  if (S.punches.some(p => !p.deleted && p.startedAt && !p.out && !p.closedAt && p.guardId !== g.id)) throw new Error('El guardia anterior debe cerrar su turno antes del relevo.');
  const puesto = S.posts.find(p => p.id === g.puestoId && !p.deleted)?.nombre || g.puesto || '';
  const fr = S.franjas.find(f => f.id === g.franjaId && !f.deleted);
  if (!puesto || !fr) throw new Error('Complete su puesto y turno en el perfil.');
  const id = uid(), fecha = isoDate(momento), hora = hhmm(momento);
  const turno = fr.nombre + (fr.alias ? ' · ' + fr.alias : '') + ' (' + fr.entrada + ' a ' + fr.salida + ')';
  return [
    { col: 'punches', obj: { id, guardId: g.id, fecha, in: hora, out: '', startedAt: momento.getTime(), puestoId: g.puestoId, puesto, franjaId: g.franjaId, turno } },
  ];
}

export function cerrarServicio(S: Estado, g: Vigilador, cierre: string, momento = new Date()): Cambio[] {
  const p = turnoAbierto(S, g.id);
  if (!p) throw new Error('No hay un turno abierto.');
  const fecha = isoDate(momento), hora = hhmm(momento), lockedAt = momento.getTime();
  const cambios: Cambio[] = S.novedades.filter(n => !n.deleted && (n.createdBy || n.guardId) === g.id &&
    (n.turnoId === p.id || (!n.turnoId && n.fecha + 'T' + n.hora >= p.fecha + 'T' + p.in)))
    .map(n => ({ col: 'novedades', obj: { ...n, turnoId: p.id, lockedAt } }));
  S.alogs.filter(a => !a.deleted && (a.createdBy || a.guardId) === g.id &&
    (a.turnoId === p.id || (!a.turnoId && a.fecha + 'T' + a.hora >= p.fecha + 'T' + p.in)))
    .forEach(a => cambios.push({ col: 'alogs', obj: { ...a, turnoId: p.id, lockedAt } }));
  cambios.push({ col: 'punches', obj: { ...p, out: hora, fechaOut: fecha, closedAt: lockedAt, cierre: cierre.trim() } });
  return cambios;
}
