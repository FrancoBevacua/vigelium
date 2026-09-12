// @ts-nocheck
/* Asistente de redacción por reglas, sin conexión. */
import { pad2 } from './model';

const ORTO = {
  'vehiculo': 'vehículo', 'vehiculos': 'vehículos', 'camion': 'camión', 'camiones': 'camiones',
  'porton': 'portón', 'portones': 'portones', 'dominio': 'dominio', 'senora': 'señora', 'senor': 'señor',
  'sra': 'Sra.', 'sr': 'Sr.', 'srta': 'Srta.', 'nino': 'niño', 'nina': 'niña', 'anos': 'años',
  'baño': 'baño', 'bano': 'baño', 'estacionamiento': 'estacionamiento', 'transito': 'tránsito',
  'perimetro': 'perímetro', 'perimetral': 'perimetral', 'camara': 'cámara', 'camaras': 'cámaras',
  'monitoreo': 'monitoreo', 'telefono': 'teléfono', 'celular': 'celular', 'medico': 'médico',
  'medica': 'médica', 'emergencia': 'emergencia', 'policia': 'policía', 'bomberos': 'bomberos',
  'seguridad': 'seguridad', 'vigilancia': 'vigilancia', 'ingreso': 'ingreso', 'egreso': 'egreso',
  'aperturas': 'aperturas', 'precinto': 'precinto', 'precintos': 'precintos', 'numero': 'número',
  'documento': 'documento', 'identificacion': 'identificación',
  'autorizacion': 'autorización', 'autorizado': 'autorizado', 'administracion': 'administración',
  'locatario': 'locatario', 'locataria': 'locataria', 'mercaderia': 'mercadería', 'descarga': 'descarga',
  'situacion': 'situación', 'observacion': 'observación', 'observaciones': 'observaciones',
  'verificacion': 'verificación', 'inspeccion': 'inspección', 'reparacion': 'reparación',
  'electrico': 'eléctrico', 'electrica': 'eléctrica', 'energia': 'energía', 'iluminacion': 'iluminación',
  'deposito': 'depósito', 'articulo': 'artículo', 'articulos': 'artículos',
  'reunion': 'reunión', 'intervencion': 'intervención', 'evacuacion': 'evacuación',
  'atencion': 'atención', 'confirmacion': 'confirmación', 'notificacion': 'notificación',
  'informacion': 'información', 'direccion': 'dirección', 'gestion': 'gestión', 'aca': 'acá',
  'ahi': 'ahí', 'alli': 'allí', 'asi': 'así', 'despues': 'después', 'mas': 'más', 'segun': 'según',
  'tambien': 'también', 'quedo': 'quedó', 'procedio': 'procedió', 'realizo': 'realizó',
  'verifico': 'verificó', 'constato': 'constató', 'informo': 'informó', 'solicito': 'solicitó',
  'llego': 'llegó', 'dejo': 'dejó', 'reviso': 'revisó',
  'via': 'vía', 'publico': 'público', 'publica': 'pública', 'peaton': 'peatón', 'peatonal': 'peatonal',
  'bicicletero': 'bicicletero', 'motocicleta': 'motocicleta', 'automovil': 'automóvil',
  'tecnico': 'técnico', 'tecnica': 'técnica', 'electronico': 'electrónico', 'sistema': 'sistema'
};
const ABREV = {
  'sn': 'sin novedad', 's/n': 'sin novedad', 'sn.': 'sin novedad',
  'vig': 'vigilador', 'vig.': 'vigilador', 'sup': 'supervisor', 'sup.': 'supervisor',
  'jde': 'Jefe de Seguridad', 'adm': 'Administración', 'adm.': 'Administración',
  'cctv': 'CCTV', 'ccttv': 'CCTV', 'dni': 'DNI', 'lp': 'Informe general',
  'prec': 'precinto', 'prec.': 'precinto', 'pto': 'puesto', 'pta': 'puerta', 'ptn': 'portón',
  'x': 'por', 'q': 'que', 'xq': 'porque', 'tmb': 'también', 'dsp': 'después', 'pq': 'porque'
};
const SIGLAS = ['CCTV', 'DNI', 'SAME', 'ART', 'GNC', 'ADM', 'KFC', 'ATM'];

const cap = w => w ? w[0].toUpperCase() + w.slice(1) : w;
const STOP = ('de la el los las del y o en con por para un una al se que es son fue ser sin sobre entre desde hasta como mas muy este esta esto ese esa eso todo toda cada otro otra ' +
  'puerta puertas portal porton portón portones acceso accesos ingreso ingresos egreso egresos puesto puestos sector sectores zona area área nivel piso planta principal general interno externo ' +
  'norte sur este oeste pecera peceras peatonal bicicletero estacionamiento monitoreo oficina administracion administración seguridad vigilancia empleados proveedores carga descarga ' +
  'rondin rondín nocturno perimetral barrera barreras camara cámara camaras cámaras precinto precintos playa deposito depósito local locales bar cup').split(' ');
let VOCCACHE = null;
let VOCFUENTE = [];
export function setVocabulario(palabras) { VOCFUENTE = palabras || []; VOCCACHE = null; }
function vocabularioPuesto() {
  if (VOCCACHE) return VOCCACHE;
  const v = {};
  const add = txt => String(txt || '').split(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/).forEach(w => {
    if (w.length < 4) return;
    const b = w.toLowerCase();
    if (STOP.indexOf(b) >= 0) return;
    if (!v[b]) v[b] = w;
  });
  (VOCFUENTE || []).forEach(add);
  ['Oroño', 'Ombú', 'Battle', 'Ordóñez', 'Pecera', 'Peceras', 'Rosario', 'Libertad'].forEach(add);
  VOCCACHE = v;
  return v;
}
function asistir(txt, ctx) {
  ctx = ctx || {};
  const orig = String(txt || '');
  let t = orig.replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
  if (!t) return { texto: t, avisos: ['La novedad está vacía.'], cambio: false };

  // horas: 0745hs / 7.45 hs / 7:5 -> 07:45
  t = t.replace(/\b(\d{1,2})[:.](\d{2})(\s*)(hs?\.?|hrs\.?|horas)?\b/gi,
    (m, h, mi, ws, u) => (+h < 24 && +mi < 60 ? pad2(+h) + ':' + mi + (u ? ' ' : ws) : m));
  t = t.replace(/\b(\d{2})(\d{2})\s*(?:hs?\.?|hrs\.?|horas)\b/gi,
    (m, h, mi) => (+h < 24 && +mi < 60 ? pad2(+h) + ':' + mi + ' ' : m));
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;])/g, '$1');

  // palabras
  t = t.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[.\/][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*\.?/g, w => {
    let cola = '';
    let core = w;
    if (/\.$/.test(core) && core.length > 1 && !ABREV[core.toLowerCase()]) { cola = '.'; core = core.slice(0, -1); }
    const bajo = core.toLowerCase(), bajoFull = w.toLowerCase();
    const mayus = core[0] === core[0].toUpperCase();
    const rearmar = c => (mayus ? c[0].toUpperCase() + c.slice(1) : c) + cola;
    if (SIGLAS.indexOf(core.toUpperCase()) >= 0 && core.length > 2) return core.toUpperCase() + cola;
    if (ABREV[bajoFull]) return (mayus ? ABREV[bajoFull][0].toUpperCase() + ABREV[bajoFull].slice(1) : ABREV[bajoFull]);
    if (ABREV[bajo] && bajo.length <= 5) return rearmar(ABREV[bajo]);
    if (ORTO[bajo] && !/[áéíóúñü]/i.test(core)) return rearmar(ORTO[bajo]);
    return w;
  });

  // N° y DNI
  t = t.replace(/\b(?:nro|nro\.|n°|nº|no\.)\s*/gi, 'N° ');
  t = t.replace(/\bDNI\s*:?\s*(\d{7,8})\b/gi, (m, n) => 'DNI ' + n.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
  t = t.replace(/\b(dominio|patente)\s*:?\s*([a-z0-9]\s?[a-z0-9]{4,8})\b/gi,
    (m, k, p) => k.toLowerCase() + ' ' + p.toUpperCase().replace(/\s/g, ''));
  // nombres propios conocidos del puesto y tratamiento personal
  const VOC = vocabularioPuesto();
  t = t.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,}/g, w => VOC[w.toLowerCase()] || w);
  const FUNC = ' por para con que del las los una unas unos por sin sobre desde hasta como y o en el la de al se su sus '.split(' ');
  const esNombre = w => w && w.length > 2 && FUNC.indexOf(w.toLowerCase()) < 0;
  t = t.replace(/\b(Sr\.|Sra\.|Srta\.|señor|señora|señorita)\s+([a-záéíóúñ]{3,})(\s+([a-záéíóúñ]{3,}))?/gi,
    (m, tr, a, _g, b) => {
      if (!esNombre(a)) return m;
      return tr + ' ' + cap(a) + (esNombre(b) ? ' ' + cap(b) : (b ? ' ' + b : ''));
    });

  // mayúscula tras punto y al inicio
  t = t.replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());
  if (!/[.!?]$/.test(t)) t += '.';
  t = t.replace(/\s+([,.;])/g, '$1').replace(/([,;])(?=\S)/g, '$1 ');

  // avisos
  const avisos = [];
  if (!/\b\d{1,2}:\d{2}\b/.test(t)) avisos.push('No figura la hora del hecho.');
  if (t.length < 25) avisos.push('La redacción es muy breve: sumá qué, quién, dónde y cómo terminó.');
  if (/precinto/i.test(t) && !/\d{4,}/.test(t)) avisos.push('Mencionás un precinto pero no está el número.');
  if (ctx.cat === 'Acceso' && !/\bDNI\b/i.test(t)) avisos.push('Es un acceso: conviene dejar asentado el DNI.');
  if (ctx.cat === 'Incidencia' && !/(se procede|se da aviso|se informa|se constata|se verifica)/i.test(t))
    avisos.push('En una incidencia conviene indicar qué acción se tomó y a quién se dio aviso.');
  if (/\b(yo|me|mi)\b/i.test(t)) avisos.push('Evitá la primera persona: usá "se procede", "se constata".');
  return { texto: t, avisos: avisos, cambio: t !== orig.trim() };
}
function promptClaude(tipo, texto) {
  const cab = tipo === 'informe'
    ? 'Corregí y mejorá la redacción de este informe de seguridad privada en español rioplatense. Mantené el formato de los 16 puntos, usá voz impersonal ("se procede", "se constata"), no inventes datos y devolvé solo el texto corregido.'
    : 'Corregí ortografía, puntuación y redacción de esta novedad de un libro de seguridad privada. Español rioplatense, voz impersonal, sin inventar datos. Devolveme solo el texto corregido y, abajo, qué datos faltan.';
  return cab + '\n\n---\n' + texto + '\n---';
}

export { asistir, promptClaude };
