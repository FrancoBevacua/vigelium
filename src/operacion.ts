import { ControlLocal, RecorridoLocales, Estado, Novedad } from './model';
import { dmy, toMin } from './model';
import { horaValida } from './servicio';

export function observacionPendiente(c: ControlLocal, tipo: 'apertura' | 'cierre') {
  return horaValida(c.hora) && horaValida(c.previsto) && toMin(c.hora) >= toMin(c.previsto) &&
    c.estado !== 'sin-control' && c.estado !== (tipo === 'apertura' ? 'abierto' : 'cerrado') && !c.obs.trim();
}
export function textoRecorrido(r: Pick<RecorridoLocales, 'tipo' | 'fecha' | 'hora' | 'controles' | 'observaciones'>, site: string) {
  const x = ['Recorrido para el control de locales ' + (r.tipo === 'apertura' ? 'abiertos' : 'cerrados') + (site ? ' — ' + site : '') + '.',
    dmy(r.fecha) + ' · ' + r.hora + ' hs.'];
  r.controles.forEach(c => x.push('• ' + c.nombre + ': ' + (c.estado === 'sin-control' ? 'sin controlar' : c.estado) + ' a las ' + c.hora +
    (c.previsto ? ' (horario previsto de ' + r.tipo + ': ' + c.previsto + ')' : '') + '.' + (c.obs.trim() ? ' Observación: ' + c.obs.trim() : '')));
  if (r.observaciones.trim()) x.push('Observaciones generales: ' + r.observaciones.trim());
  return x.join('\n');
}
export function urlWhatsApp(texto: string, telefono = '') {
  const numero = telefono.replace(/\D/g, '');
  if (numero && (numero.length < 8 || numero.length > 15)) throw new Error('Revise el número de inmobiliaria, con código de país y área.');
  return 'whatsapp://send?' + (numero ? 'phone=' + numero + '&' : '') + 'text=' + encodeURIComponent(texto);
}
