import { ConfigIA, DirectivaIA, ImagenIA, pedirIA, promptDirectivas, parsearDirectivasIA } from './ai';

/** Se divide internamente, con solapamiento para conservar tareas que cruzan el límite. */
export function dividirDocumento(texto: string, max = 24000): string[] {
  if (max < 2000) throw new Error('Tamaño de lectura inválido.');
  const partes: string[] = [];
  let inicio = 0;
  while (inicio < texto.length) {
    let fin = Math.min(inicio + max, texto.length);
    if (fin < texto.length) {
      const corte = texto.lastIndexOf('\n', fin);
      if (corte > inicio + max / 2) fin = corte + 1;
    }
    partes.push(texto.slice(inicio, fin));
    if (fin === texto.length) break;
    inicio = fin - Math.min(1200, Math.floor(max / 10));
  }
  return partes;
}
export async function interpretarDocumento(texto: string, puestos: string[], turnos: string[], cfg: ConfigIA, imagen?: ImagenIA,
  progreso: (hechas: number, total: number) => void = () => {}, vigente: () => boolean = () => true): Promise<DirectivaIA[]> {
  const partes = imagen ? [''] : dividirDocumento(texto);
  const filas: DirectivaIA[] = [], claves = new Set<string>();
  for (let i = 0; i < partes.length; i++) {
    if (!vigente()) throw new Error('Lectura cancelada.');
    progreso(i, partes.length);
    const anterior = filas[filas.length - 1];
    const contexto = i && anterior ? '\nContexto de continuidad: el último puesto leído fue ' + anterior.puesto + ', turno ' + anterior.turno + '. Mantenelo sólo mientras el documento no indique otro encabezado. El comienzo puede repetir filas del fragmento anterior.\n' : '';
    const salida = await pedirIA(promptDirectivas(partes[i], puestos, turnos) + contexto, cfg, undefined, imagen ? [imagen] : undefined, { maxTokens: 24000, timeoutMs: 180000 });
    if (!vigente()) throw new Error('Lectura cancelada.');
    const leidas = parsearDirectivasIA(salida);
    if (!leidas.length && partes.length === 1) throw new Error('No se encontraron directivas. Revise que el documento sea legible.');
    if (!leidas.length && salida.trim() && !/^sin directivas\.?$/i.test(salida.trim())) throw new Error('No se pudo interpretar una parte del documento. Reintentá la lectura; no se importaron datos parciales.');
    for (const d of leidas) {
      const clave = [d.puesto, d.turno, d.hora, d.nombre, d.novedades].map(x => x.trim().toLocaleLowerCase()).join('|');
      if (!claves.has(clave)) { claves.add(clave); filas.push(d); }
    }
    progreso(i + 1, partes.length);
  }
  if (!filas.length) throw new Error('No se encontraron directivas en el documento.');
  return filas;
}
