// @ts-nocheck
/* Reconocimiento de directivas en texto plano o extraído de un PDF. */
import { pad2 } from './model';

function parseDirectivas(texto) {
  const lineas = String(texto || '').split('\n').map(l => l.replace(/\s+/g, ' ').trim());
  const out = [];
  let puesto = '', pend = null;
  const reHora = /^(?:[-•*]\s*)?(\d{1,2})\s*[:.,hH]\s*(\d{2})\s*(?:hs?\.?|hrs\.?|horas)?\b/;
  const rePuesto = /^(?:puesto|sector|posici[oó]n|objetivo|consigna)\s*(?:n[°º]?\s*\d+)?\s*[:\-–]\s*(.+)$/i;
  const rePuesto2 = /^(?:puesto|sector)\s+(.{3,60})$/i;
  const cerrar = () => { if (pend && pend.nombre) out.push(pend); pend = null; };
  lineas.forEach(l => {
    if (!l) { return; }
    let m = rePuesto.exec(l) || rePuesto2.exec(l);
    if (m && !reHora.test(l)) { cerrar(); puesto = m[1].replace(/[.:]+$/, '').trim(); return; }
    if (/^(directivas?|generales?|indice|índice|p[aá]gina\s*\d+)\b/i.test(l) && l.length < 60) return;
    m = reHora.exec(l);
    if (m) {
      cerrar();
      const h = +m[1], mi = +m[2];
      if (h > 23 || mi > 59) return;
      let resto = l.slice(m[0].length).replace(/^[\s\-–:.•*]+/, '').trim();
      resto = resto.replace(/^(?:a|hasta|y)\s+\d{1,2}[:.]\d{2}\s*(?:hs?\.?)?\s*[-–:]?\s*/i, '');
      const corte = resto.search(/(?<=\S)[.;] +[A-ZÁÉÍÓÚÑ]/);
      let nombre = resto, nov = '';
      if (resto.length > 62 && corte > 8) { nombre = resto.slice(0, corte + 1).trim(); nov = resto.slice(corte + 2).trim(); }
      pend = { puesto: puesto, hora: pad2(h) + ':' + pad2(mi), nombre: nombre.replace(/[.]$/, ''), novedades: nov };
      return;
    }
    if (pend) {
      if (!pend.nombre) pend.nombre = l.replace(/[.]$/, '');
      else pend.novedades = (pend.novedades ? pend.novedades + ' ' : '') + l;
    }
  });
  cerrar();
  return out.filter(d => d.nombre && d.nombre.length > 2);
}


export { parseDirectivas };
