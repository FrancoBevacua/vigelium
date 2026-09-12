import { Estado, Col, Rec, Vigilador, uid, now, merge } from './model';
import { validarCambioNovedad, turnoAbierto, motivoSoloLectura, horaValida, fechaValida } from './servicio';
import { legajoNormal, dniNormal, dniValido } from './cuentas';

/** Una operación compuesta se publica sólo si todas sus filas son válidas. */
export function aplicarCambios(S: Estado, cambios: { col: Col; obj: any }[], actor: Vigilador | null, servicio = false): Estado {
  const e = { ...S };
  for (const k of Object.keys(S)) if (Array.isArray((S as any)[k])) (e as any)[k] = (S as any)[k].slice();
  for (const { col, obj } of cambios) {
    const arr: any[] = e[col];
    const i = arr.findIndex(r => r.id === obj.id);
    let g = { ...(i >= 0 ? arr[i] : {}), ...obj, id: obj.id || uid(), updatedAt: now() };
    if (col === 'novedades' && !servicio) {
      validarCambioNovedad(e, i >= 0 ? arr[i] : undefined, actor);
      if (!horaValida(g.hora) || !fechaValida(g.fecha) || (!g.deleted && !g.texto?.trim())) throw new Error('La novedad necesita fecha, hora y texto válidos.');
      if (g.autoKey && i < 0) { const motivo = motivoSoloLectura(e, g, actor?.id); if (motivo) throw new Error(motivo); }
      if(!g.deleted && !e.guards.some(v=>v.id===g.guardId&&!v.deleted))throw Error('Seleccione el vigilador que realizó la novedad.');
      g = { ...g, createdBy: i>=0 ? arr[i].createdBy || arr[i].guardId : actor!.id, turnoId: turnoAbierto(e, actor!.id)!.id };
    }
    if (col === 'alogs' && !servicio) {
      const activo = turnoAbierto(e, actor?.id);
      if (!activo) throw new Error('Inicie su turno para registrar accesos.');
      if (i >= 0) {
        const a = arr[i];
        const motivo = motivoSoloLectura(e, { ...a, guardId: a.createdBy || a.guardId }, actor?.id);
        if (motivo) throw new Error(motivo);
      }
      if (!horaValida(g.hora) || !fechaValida(g.fecha)) throw new Error('El acceso necesita una fecha y hora válidas.');
      g = { ...g, createdBy: actor!.id, turnoId: activo.id };
    }
    if (col === 'guards' && g.cuenta && g.dni && (!dniValido(g.dni) || e.guards.some(r => r.id !== g.id && r.cuenta && !r.deleted && dniNormal(r.dni || '') === dniNormal(g.dni)))) throw new Error('El DNI no es válido o ya tiene una cuenta.');
    if (col === 'guards' && g.cuenta && g.legajo && !g.deleted && e.guards.some(r => r.id !== g.id && r.cuenta && !r.deleted && legajoNormal(r.legajo) === legajoNormal(g.legajo))) throw new Error('Ese legajo ya pertenece a otra cuenta.');
    if (col === 'punches' && i >= 0 && (arr[i].closedAt || arr[i].out)) throw new Error('Un turno cerrado no se puede modificar.');
    if (i >= 0) arr[i] = g; else arr.push(g);
  }
  return e;
}

export function restaurarRespaldo(S: Estado, datos: Estado, actor: Vigilador): Estado {
  if (actor.rol !== 'admin') throw new Error('La restauración está reservada a administración.');
  const e = merge(S, datos);
  // Una restauración no permite reescribir el historial de otro turno ni las cuentas existentes.
  const conservar = (col: Col, registros: Rec[]) => {
    const ids = new Set(registros.map(r => r.id));
    (e as any)[col] = [...(e[col] as Rec[]).filter(r => !ids.has(r.id)), ...registros];
  };
  conservar('novedades', S.novedades.filter(n => !!motivoSoloLectura(S, n, actor.id)));
  conservar('alogs', S.alogs.filter(a => !!motivoSoloLectura(S, { ...a, guardId: a.createdBy || a.guardId } as any, actor.id)));
  conservar('punches', S.punches);
  conservar('guards', S.guards.filter(g => g.cuenta));
  return e;
}
