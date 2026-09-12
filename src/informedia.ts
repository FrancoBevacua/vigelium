import { categoriaAsiento, TITULO_REPORTE } from './reporte';
/* Informe general de las 24 horas: el parte que se le manda al supervisor.
   La ventana no es el día calendario sino el relevo, por ejemplo de 19 a 19 del
   día siguiente, así que todo acá razona sobre esa franja. */
import {
  Estado, Novedad, AccesoLog, Visita, isoDate, addDays, dmy, toMin, pad2, accNormal,
  personasReales, fmtDNI,
} from './model';
import { gsName, resumenAcceso, textoIngresoAcceso } from './text';

export type Ventana = { fecha: string; corte: string };

export type EntradaDia = {
  clave: string;
  categoria?: string;
  firma?: string;
  hora: string;
  fecha: string;
  texto: string;
  items?: string[];          // viñetas, cuando la entrada agrupa varios accesos
  origen: 'novedad' | 'acceso' | 'visita';
  ids: string[];
};

const vivos = <T extends { deleted?: boolean }>(a: T[] = []) => a.filter(x => !x.deleted);

export const horaCorte = (S: Estado) => {
  const h = Number(String(S.site.corteInforme ?? '19').split(':')[0]);
  return pad2(Number.isInteger(h) && h >= 0 && h <= 23 ? h : 19) + ':00';
};

/** La ventana arranca ese día a la hora de corte y termina al día siguiente. */
export function limites(v: Ventana) {
  return {
    desde: { fecha: v.fecha, min: toMin(v.corte) },
    hasta: { fecha: addDays(v.fecha, 1), min: toMin(v.corte) },
  };
}

export function dentro(v: Ventana, fecha: string, hora: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora || '')) return false;
  const l = limites(v);
  const m = toMin(hora);
  if (fecha === l.desde.fecha) return m >= l.desde.min;
  if (fecha === l.hasta.fecha) return m < l.hasta.min;
  return false;
}

/** Minutos transcurridos desde el inicio de la ventana, para ordenar. */
function relativo(v: Ventana, fecha: string, hora: string) {
  const l = limites(v);
  const m = toMin(hora);
  return fecha === l.desde.fecha ? m - l.desde.min : m - l.desde.min + 1440;
}

/* ---------- familias de acceso ---------- */
export type Familia = 'emergencia' | 'porton' | 'otro';

export function familiaDe(nombre: string): Familia {
  const n = String(nombre || '').toLowerCase();
  if (/emergenc|^puerta\s+e\d/i.test(n)) return 'emergencia';
  if (/port[oó]n|porton/.test(n)) return 'porton';
  return 'otro';
}

function encabezadoGrupo(tipo: 'apertura' | 'cierre', f: Familia) {
  if (f === 'porton') {
    return tipo === 'apertura'
      ? 'Se inicia la apertura de todos los portones de playa:'
      : 'Se inicia el cierre de todos los portones de playa:';
  }
  if (f === 'emergencia') {
    return tipo === 'apertura'
      ? 'Apertura de puertas de emergencia:'
      : 'Cierre de puertas de emergencia:';
  }
  return tipo === 'apertura' ? 'Apertura de accesos:' : 'Cierre de accesos:';
}

/* Una sola apertura no lleva viñetas: va como oración, con el artículo que
   corresponde. "de acceso Pecera 1" está mal escrito; es "del acceso". */
function lineaSuelta(r: AccesoLog) {
  const f = familiaDe(r.acceso);
  const sujeto = f === 'emergencia' ? 'de la puerta de emergencia'
    : f === 'porton' ? 'del portón' : 'del acceso';
  /* El nombre del catálogo suele repetir la palabra: "Portón ingreso Oroño". */
  const nombre = String(r.acceso || '')
    .replace(/^(port[oó]n|puerta(\s+de)?\s+emergencia|puerta|acceso)\s+/i, '')
    .trim() || r.acceso;
  const base = r.tipo === 'apertura' ? 'Se procede a la apertura ' : 'Se procede al cierre ';
  return base + sujeto + ' ' + nombre + '.';
}

/* ---------- armado ---------- */
export function entradasDeVentana(S: Estado, v: Ventana): EntradaDia[] {
  const out: EntradaDia[] = [];
  const alogs = vivos(S.alogs).filter(a => dentro(v, a.fecha, a.hora))
    .sort((a, b) => relativo(v, a.fecha, a.hora) - relativo(v, b.fecha, b.hora));
  for (const a of alogs) {
    const clave='acceso:'+a.id;
    if(S.novedades.some(n=>n.autoKey===clave||n.alogId===a.id))continue;
    out.push({clave,hora:a.hora,fecha:a.fecha,texto:lineaSuelta(a)+(a.nota?' '+a.nota:''),
      categoria:a.tipo.toUpperCase(),firma:gsName(S.guards.find(g=>g.id===a.guardId),S.site),origen:'acceso',ids:[a.id]});
  }

  /* 2. El libro. Los asientos que nacieron de una apertura ya están arriba. */
  vivos(S.novedades)
    .filter(n => dentro(v, n.fecha, n.hora))
    .filter(n => !/^servicio-(in|out):/.test(n.id))
    .filter(n => !n.autoKey?.startsWith('playa:') || !alogs.some(a=>a.fecha===n.fecha))
    .forEach(n => {
      const res = resumenAcceso(n);
      out.push({
        clave: 'n:' + n.id, hora: n.hora, fecha: n.fecha,
        texto: n.texto || res, categoria:(n.alogId?S.alogs.find(a=>a.id===n.alogId)?.tipo.toUpperCase():undefined)||categoriaAsiento(n), firma:gsName(S.guards.find(g=>g.id===n.guardId),S.site), origen: 'novedad', ids: [n.id],
      });
    });

  // Respaldos anteriores pueden tener visitas sin asiento vinculado.
  vivos(S.visits).filter(a => dentro(v, a.fecha, a.horaIn)).forEach(a => {
    const asentada = S.novedades.some(n => n.id === a.novIn || (n.visitId === a.id && n.mov === 'in'));
    if (!asentada) out.push({ clave: 'v:' + a.id, hora: a.horaIn, fecha: a.fecha,
      texto: textoIngresoAcceso(accNormal(a.acc, a), a.tipo), categoria:'EXTERNO', firma:gsName(S.guards.find(g=>g.id===a.guardId),S.site), origen: 'visita', ids: [a.id] });
  });

  out.sort((a, b) => relativo(v, a.fecha, a.hora) - relativo(v, b.fecha, b.hora));
  return out;
}

export function hayTrascendentes(S: Estado, v: Ventana): boolean {
  return vivos(S.novedades).some(n => dentro(v, n.fecha, n.hora) &&
    (n.trascendente === true || (n.trascendente !== false && n.categoria === 'Incidencia'))) ||
    vivos(S.reports).some(r => dentro(v, r.fecha, r.hora));
}

/* ---------- texto ---------- */
export type OpcionesDia = {
  site: string;
  fecha: string;
  cierre: string;
  fotos: number;
};

const VINETA = '   •   ';

export function textoInformeDia(entradas: EntradaDia[], o: OpcionesDia) {
  const partes: string[] = [];
  partes.push(TITULO_REPORTE);
  partes.push(o.site || 'Libertad Rosario');
  partes.push('');
  partes.push('Fecha: ' + dmy(o.fecha));
  partes.push('');
  partes.push('Novedades:');
  partes.push('');

  if (!entradas.length) {
    partes.push('Sin novedades registradas en el período.');
    partes.push('');
  }

  let fechaSeccion = '';
  entradas.forEach(e => {
    if (e.fecha !== fechaSeccion) {
      fechaSeccion = e.fecha;
      partes.push('Día ' + dmy(e.fecha), '');
    }
    partes.push(e.hora + ' ' + (e.categoria || 'NOVEDAD'));
    partes.push(e.texto);
    if (e.items && e.items.length) {
      partes.push('');
      e.items.forEach(i => partes.push(VINETA + i));
    }
    if(e.firma)partes.push(e.firma);
    partes.push('');
  });

  if (o.cierre.trim()) {
    partes.push(o.cierre.trim());
    partes.push('');
  }
  if (o.fotos) {
    partes.push('Se adjunta' + (o.fotos > 1 ? 'n ' + o.fotos + ' imágenes' : ' 1 imagen') +
      ' como registro fotográfico.');
    partes.push('');
  }
  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Rechaza respuestas truncadas o con entradas/datos numéricos modificados. */
export function validarRedaccionDia(original: string, revisado: string) {
  const horas = (s: string) => s.split('\n').filter(l=>/^\d{2}:\d{2} [A-ZÁÉÍÓÚ/]+$/.test(l));
  const firmas=(s:string)=>s.split('\n').filter(l=>/^Gs /.test(l));
  const items = (s: string) => s.split('\n').filter(l => /^\s*•/.test(l)).map(l => l.trim());
  const fechas = (s: string) => s.split('\n').filter(l => /^Día \d{2}\/\d{2}\/\d{4}$/.test(l));
  const numeros = (s: string) => (s.match(/\d+/g) || []).sort();
  if ([horas, firmas, items, fechas, numeros].some(fn => JSON.stringify(fn(original)) !== JSON.stringify(fn(revisado)))) {
    throw new Error('La IA cambió horarios, datos o ítems del informe. Se conserva el borrador completo; vuelva a intentar la revisión.');
  }
  if (!revisado.startsWith(original.split('Novedades:')[0] + 'Novedades:')) {
    throw new Error('La IA cambió el encabezado. Se conserva el borrador original.');
  }
}

/** Párrafo de cierre por defecto, el que se repite todos los días. */
export function cierrePorDefecto(S: Estado, v: Ventana) {
  const sitio = S.site.cliente || 'el objetivo';
  return 'Durante todo el servicio los guardias realizaron recorridos en forma aleatoria en ' +
    sitio + ' y en los sectores de playa.\n\n' +
    'En la fecha hasta las ' + v.corte + ' no se produjeron novedades de trascendencia.';
}

/* ---------- resumen corto para las tarjetas ---------- */
export function resumenCorto(e: EntradaDia) {
  if (e.items && e.items.length) return e.items.length + ' accesos · ' + e.items.slice(0, 2).join(', ') +
    (e.items.length > 2 ? '…' : '');
  return e.texto.replace(/\s*\n\s*/g, ' · ').slice(0, 120);
}

/** Datos sueltos de una visita, para el resumen de la tarjeta. */
export function resumenVisita(v: Visita) {
  const a = accNormal(v.acc, v);
  const per = personasReales(a);
  const p: string[] = [];
  if (a.empresa) p.push(a.empresa);
  if (per.length === 1) p.push(per[0].nombre + (per[0].dni ? ' · ' + fmtDNI(per[0].dni) : ''));
  else if (per.length > 1) p.push(per.length + ' personas');
  if (a.tarea) p.push(a.tarea);
  return p.join(' · ');
}

export const ventanaHoy = (S: Estado): Ventana => {
  const corte = horaCorte(S);
  const ahora = new Date();
  const min = ahora.getHours() * 60 + ahora.getMinutes();
  /* Antes de la hora de corte seguimos dentro de la ventana que abrió ayer. */
  return { fecha: min >= toMin(corte) ? isoDate() : addDays(isoDate(), -1), corte };
};
