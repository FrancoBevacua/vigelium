/* Composición de textos: asientos de acceso, informes y partes. */
import {
  Acceso, AccesoLog, Informe, Novedad, Site, Vigilador, Vehiculo,
  accNormal, personasReales, fmtDNI, hs, toMin, dmy, CLASES_ADJUNTO,
} from './model';

export const gsName = (g: Vigilador | undefined | null, site: Site) =>
  !g ? '' : ('Gs' + ' ' + [g.apellido?.trim(), g.nombre?.trim()].filter(Boolean).join(', ')).replace(/\s+/g, ' ').trim();

/* ---------- accesos de personal ---------- */
export function sujetoAcceso(a: Acceso, tipo?: string) {
  const per = personasReales(a);
  if (a.empresa) return 'personal de la firma ' + a.empresa;
  if (per.length > 1) return per.length + ' personas';
  if (per.length === 1 && per[0].nombre) return per[0].nombre;
  return (tipo || 'visita').toLowerCase();
}
export function porQuien(confirmo: string, base: string) {
  const c = (confirmo || '').trim();
  if (!c) return base;
  const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (norm(c).indexOf(norm(base)) >= 0) return c;
  return base + ' (' + c + ')';
}
export function fraseAutorizacion(a: Acceso) {
  if (a.autoriz === 'admin') return 'Autorización confirmada por ' + porQuien(a.confirmo, 'Administración') + '.';
  if (a.autoriz === 'espera') return 'No se obtiene confirmación de la autorización: el personal aguarda en el acceso hasta que se regularice.';
  if (a.autoriz === 'retiro') return 'No se obtiene confirmación de la autorización: se solicita al personal que se retire del predio.';
  return 'Autorización confirmada por ' + porQuien(a.confirmo, 'CCTV') + '.';
}
export function listaEmpleados(a: Acceso) {
  const per = personasReales(a);
  if (!per.length) return '';
  const cab = per.length > 1 ? 'Datos de los empleados:' : 'Datos del empleado:';
  return '\n' + cab + '\n' + per.map(p => (p.nombre || 's/d') + (p.dni ? '\nDNI ' + fmtDNI(p.dni) : '')).join('\n');
}
export function fraseVehiculo(v?: Vehiculo) {
  if (!v || !v.activo) return '';
  const desc = [v.marca, v.modelo].filter(Boolean).join(' ');
  const p: string[] = ['Ingresa ' + (v.tipo || 'vehículo').toLowerCase() +
    (desc ? ' ' + desc : '') + (v.dominio ? ', dominio ' + v.dominio : '')];
  if (v.chofer) p.push('conducido por ' + v.chofer + (v.dniChofer ? ', DNI ' + fmtDNI(v.dniChofer) : ''));
  let l = p.join(', ') + '.';
  if (v.poliza) l += ' Póliza N° ' + v.poliza + '.';
  const clases = Array.from(new Set((v.adjuntos || []).map(x => x.clase)));
  if (clases.length) {
    const nombres = clases.map(c => (CLASES_ADJUNTO.find(x => x[0] === c) || ['', c])[1].toLowerCase());
    l += ' Se adjunta documentación: ' + nombres.join(', ') + '.';
  }
  if (v.obs) l += ' ' + v.obs.replace(/\.?$/, '.');
  return l;
}

export function textoIngresoAcceso(a: Acceso, tipo?: string) {
  const sujeto = sujetoAcceso(a, tipo);
  const plural = !a.empresa && personasReales(a).length > 1;
  const confirmado = a.autoriz === 'cctv' || a.autoriz === 'admin';
  let l = (confirmado ? (plural ? 'Ingresan ' : 'Ingresa ') : (plural ? 'Se presentan ' : 'Se presenta ')) + sujeto;
  const tarea = a.tarea.trim().replace(/[.]+$/, '').replace(/^a\s+realizar\s+/i, '').replace(/^realizar\s+(?=\w+(?:ar|er|ir)\b)/i, '');
  if (tarea) l += /^(?:\w+(?:ar|er|ir)|ir)\b/i.test(tarea) ? ' con el fin de ' + tarea : ' para realizar ' + tarea;
  if (a.lugar.trim()) l += (/^(en|a|al|del|de)\s/i.test(a.lugar.trim()) ? ' ' : ' en ') + a.lugar.trim();
  l += '.';
  const vehiculo = fraseVehiculo(a.vehiculo);
  const partes = [l, fraseAutorizacion(a), confirmado ? vehiculo : vehiculo.replace(/^Ingresa /, 'Se presenta con ')];
  if (a.obs) partes.push(a.obs.replace(/\.?$/, '.'));
  return partes.filter(Boolean).join(' ') + listaEmpleados(a);
}
export function textoEgresoAcceso(a: Acceso, tipo?: string, min?: number | null) {
  const partes = ['Egresa ' + sujetoAcceso(a, tipo) + '.'];
  if (min != null) partes.push('Permanencia: ' + hs(min) + '.');
  if (a.vehiculo?.activo && a.vehiculo.dominio) {
    partes.push('Egresa el ' + (a.vehiculo.tipo || 'vehículo').toLowerCase() + ' dominio ' + a.vehiculo.dominio + '.');
  }
  return partes.join(' ');
}
export function textoConfirmAcceso(a: Acceso, tipo?: string) {
  const base = a.autoriz === 'admin' ? 'Administración' : 'CCTV';
  return 'Se confirma la autorización de ingreso de ' + sujetoAcceso(a, tipo) +
    ' por ' + porQuien(a.confirmo, base) + '. El personal ingresa al predio.';
}
export function resumenAcceso(n: Novedad) {
  const a = n && n.acc ? accNormal(n.acc) : null;
  if (!a) return '';
  const per = personasReales(a);
  const p: string[] = [];
  if (a.empresa) p.push(a.empresa);
  if (per.length === 1) p.push(per[0].nombre + (per[0].dni ? ' · DNI ' + fmtDNI(per[0].dni) : ''));
  else if (per.length > 1) p.push(per.length + ' empleados');
  if (a.tarea) p.push(a.tarea);
  if (a.vehiculo?.activo && a.vehiculo.dominio) p.push(a.vehiculo.dominio);
  return p.join(' · ');
}
export const novTextoCompleto = (n: Novedad) => {
  const acc = resumenAcceso(n);
  return (acc ? acc + '\n' : '') + n.texto;
};

/* ---------- aperturas y cierres ---------- */
export type OpcInforme = { orden: 'carga' | 'hora' | 'guardia' | 'acceso'; tipo: 'ambos' | 'apertura' | 'cierre'; encabezado: boolean };
export function textoInformeAccesos(rows: AccesoLog[], fecha: string, o: OpcInforme, site: Site) {
  let r = rows.slice();
  if (o.tipo !== 'ambos') r = r.filter(x => x.tipo === o.tipo);
  if (o.orden === 'hora') r.sort((a, b) => toMin(a.hora) - toMin(b.hora));
  if (o.orden === 'guardia') r.sort((a, b) => (a.gs || '').localeCompare(b.gs || '') || toMin(a.hora) - toMin(b.hora));
  if (o.orden === 'acceso') r.sort((a, b) => (a.acceso || '').localeCompare(b.acceso || ''));
  const bloques = r.map(x => {
    let t = x.hora + ' ' + x.gs + '\n' + x.acceso;
    const lp = lineaPrecintos(x);
    if (lp) t += '\n' + lp;
    if (x.nota) t += '\nNota: ' + x.nota;
    return t;
  });
  let cab = '';
  if (o.encabezado) {
    const et = o.tipo === 'ambos' ? 'APERTURAS Y CIERRES' : o.tipo === 'apertura' ? 'APERTURAS' : 'CIERRES';
    cab = '*' + et + ' — ' + dmy(fecha) + '*' + (site.cliente ? '\n' + site.cliente : '') + '\n\n';
  }
  return cab + bloques.join('\n\n');
}
/** Línea de precintos del bloque de apertura o cierre. */
export function lineaPrecintos(x: AccesoLog) {
  if (!x.p1) return '';
  if (!x.p2) return 'Precinto N° ' + x.p1;
  return 'Precintos N° ' + x.p1 + ' - ' + x.p2;
}

export function textoAlogLibro(r: AccesoLog) {
  const verbo = r.tipo === 'apertura' ? 'la apertura' : 'el cierre';
  let t = 'Se procede a ' + verbo + ' de ' + r.acceso + '.';
  if (r.p1) {
    t += r.p2
      ? ' Se colocan precintos N° ' + r.p1 + ' y N° ' + r.p2 + '.'
      : ' Se coloca precinto N° ' + r.p1 + '.';
  }
  if (r.nota) t += ' ' + r.nota.replace(/\.?$/, '.');
  return t;
}

/* ---------- informe de seguridad de 16 puntos ---------- */
export const LBL = ['Cliente / Site', 'Región', 'Fecha del evento', 'Tipo de incidente', 'Nivel de criticidad',
  'Resumen del hecho', 'Impacto inicial', 'Acciones realizadas', 'Recursos involucrados',
  'Autoridades o servicios convocados', 'Escalamiento realizado', 'Estado actual', 'Próximos pasos',
  'Responsable de seguimiento', 'Evidencia disponible', 'Observaciones'];

export const PASOS: { t: string; campos: number[] }[] = [
  { t: 'Encabezado', campos: [1, 2, 3, 4, 5] },
  { t: 'El hecho', campos: [6, 7, 8] },
  { t: 'Recursos', campos: [9, 10, 11] },
  { t: 'Seguimiento', campos: [12, 13, 14] },
  { t: 'Cierre', campos: [15, 16] },
];
export const CRIT = ['Baja', 'Media', 'Alta', 'Crítica'];
export const critTag = (c: string): 'info' | 'warn' | 'acc' | 'crit' | 'mute' =>
  (({ Baja: 'info', Media: 'warn', Alta: 'acc', 'Crítica': 'crit' } as any)[c] || 'mute');

export const PH: Record<number, string> = {
  1: 'Libertad Rosario', 2: 'Sur', 4: 'Resguardo de vehículo / Moto en bicicletero',
  6: 'Se informa que…', 7: 'N/A - Resguardo preventivo.', 8: 'Se registra el vehículo en el Informe general…',
  9: 'Guardia de seguridad: Mansilla Diego', 10: 'N/A', 11: 'Guardia / Supervisor / Jefe de seguridad.',
  12: 'En curso. Vehículo resguardado…', 13: 'Mantener en resguardo hasta su retiro.',
  14: 'Guardia de turno - Mansilla Diego', 15: 'Datos del vehículo:\n- Marca:\n- Modelo:\n- Dominio:', 16: '',
};

export function textoReporte(r: Informe, site: Site) {
  let t = '*INFORME DE SEGURIDAD - ' + (site.nombre || site.cliente || 'PUESTO').toUpperCase() + '*\n\n';
  const fotos = (r.fotos || []).length;
  for (let i = 1; i <= 16; i++) {
    let v = ((r as any)['f' + i] || '').trim();
    if (i === 3 && r.hora && v) v = v + ' - ' + r.hora + ' hs';
    if (i === 15 && fotos) {
      v = (v ? v + '\n\n' : '') + 'Registro fotográfico: ' + fotos + ' imagen' + (fotos > 1 ? 'es' : '') +
        ' adjunta' + (fotos > 1 ? 's' : '') + ' al informe.';
    }
    t += '_' + i + '. *' + LBL[i - 1] + ':*_  \n' + (v || 'N/A') + '\n\n';
  }
  return t.trim();
}
