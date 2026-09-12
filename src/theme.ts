/* Sistema visual de Securia — paletas, tipografía y medidas. */

export type Theme = {
  dark: boolean;
  bg: string; surface: string; surface2: string; surface3: string;
  line: string; lineStrong: string;
  text: string; text2: string; muted: string;
  accent: string; accentInk: string; accentSoft: string; accentLine: string;
  slate: string; slateSoft: string;
  ok: string; okSoft: string;
  warn: string; warnSoft: string;
  crit: string; critSoft: string;
};

/* ---------- bases neutras ---------- */
type Neutro = Pick<Theme,
  'bg' | 'surface' | 'surface2' | 'surface3' | 'line' | 'lineStrong' | 'text' | 'text2' | 'muted'>;
type Semantico = Pick<Theme,
  'slate' | 'slateSoft' | 'ok' | 'okSoft' | 'warn' | 'warnSoft' | 'crit' | 'critSoft'>;
type Acento = Pick<Theme, 'accent' | 'accentInk' | 'accentSoft' | 'accentLine'>;

/* Grafito: el gris de la app. Texto blanco puro sobre superficies de grafito. */
const GRAFITO_OSC: Neutro = {
  bg: '#1E2226', surface: '#262B30', surface2: '#2E343A', surface3: '#39424A',
  line: '#3A444B', lineStrong: '#505C65',
  text: '#FFFFFF', text2: '#D8DEE3', muted: '#9AA5AD',
};
const GRAFITO_CLA: Neutro = {
  bg: '#ECEEF0', surface: '#FFFFFF', surface2: '#F4F6F8', surface3: '#E5E9EC',
  line: '#D6DBDF', lineStrong: '#BAC2C8',
  text: '#12171B', text2: '#3B444B', muted: '#68737C',
};

/* Carbón: el azulado original, más oscuro. */
const CARBON_OSC: Neutro = {
  bg: '#0C1115', surface: '#141B21', surface2: '#1A232B', surface3: '#212D36',
  line: '#26333D', lineStrong: '#374854',
  text: '#E3EAF0', text2: '#BCC9D4', muted: '#8496A3',
};
const CARBON_CLA: Neutro = {
  bg: '#EAEDEF', surface: '#FFFFFF', surface2: '#F4F6F8', surface3: '#E8ECEF',
  line: '#D5DBE0', lineStrong: '#BCC5CC',
  text: '#111820', text2: '#3A4854', muted: '#64737F',
};

const SEM_OSC: Semantico = {
  slate: '#8CB4D6', slateSoft: '#1E2A33',
  ok: '#4FBA8A', okSoft: '#15271F',
  warn: '#DFB84C', warnSoft: '#282213',
  crit: '#F07A70', critSoft: '#301C1A',
};
const SEM_CLA: Semantico = {
  slate: '#33648C', slateSoft: '#E4EDF4',
  ok: '#1F7A55', okSoft: '#E0F1E9',
  warn: '#8A6710', warnSoft: '#F8EFD5',
  crit: '#A93232', critSoft: '#F8E4E4',
};

function armar(dark: boolean, n: Neutro, a: Acento): Theme {
  return { dark, ...n, ...(dark ? SEM_OSC : SEM_CLA), ...a };
}

/* ---------- paletas ---------- */
export type PaletaId = 'grafito' | 'ambar' | 'acero' | 'oliva' | 'bordo';

export type Paleta = {
  id: PaletaId;
  nombre: string;
  desc: string;
  muestra: [string, string, string];   // fondo, acento, texto — para el selector
  oscuro: Theme;
  claro: Theme;
};

export const PALETAS: Paleta[] = [
  {
    id: 'grafito',
    nombre: 'Grafito',
    desc: 'Fondo gris grafito, botones rojos y texto blanco.',
    muestra: ['#1E2226', '#D93A3A', '#FFFFFF'],
    oscuro: armar(true, GRAFITO_OSC, {
      accent: '#D93A3A', accentInk: '#FFFFFF', accentSoft: '#33201F', accentLine: '#5E2B29',
    }),
    claro: armar(false, GRAFITO_CLA, {
      accent: '#C22B2B', accentInk: '#FFFFFF', accentSoft: '#FAE7E7', accentLine: '#E8B8B8',
    }),
  },
  {
    id: 'ambar',
    nombre: 'Ámbar',
    desc: 'Fondo carbón azulado y acentos ámbar.',
    muestra: ['#0C1115', '#E89A42', '#E3EAF0'],
    oscuro: armar(true, CARBON_OSC, {
      accent: '#E89A42', accentInk: '#1A1206', accentSoft: '#2A2114', accentLine: '#4A3818',
    }),
    claro: armar(false, CARBON_CLA, {
      accent: '#A85E13', accentInk: '#FFFFFF', accentSoft: '#F7EBDA', accentLine: '#E0C39A',
    }),
  },
  {
    id: 'acero',
    nombre: 'Acero',
    desc: 'Gris grafito con acentos azules.',
    muestra: ['#1E2226', '#4C93DB', '#FFFFFF'],
    oscuro: armar(true, GRAFITO_OSC, {
      accent: '#4C93DB', accentInk: '#08131E', accentSoft: '#182734', accentLine: '#2B4159',
    }),
    claro: armar(false, GRAFITO_CLA, {
      accent: '#1F5FA0', accentInk: '#FFFFFF', accentSoft: '#E3EDF7', accentLine: '#B3CDE6',
    }),
  },
  {
    id: 'oliva',
    nombre: 'Oliva',
    desc: 'Gris grafito con acentos verdes.',
    muestra: ['#1E2226', '#77B255', '#FFFFFF'],
    oscuro: armar(true, GRAFITO_OSC, {
      accent: '#77B255', accentInk: '#0C1608', accentSoft: '#1C2A17', accentLine: '#334B27',
    }),
    claro: armar(false, GRAFITO_CLA, {
      accent: '#3D7A2C', accentInk: '#FFFFFF', accentSoft: '#E6F1E1', accentLine: '#BEDAB2',
    }),
  },
  {
    id: 'bordo',
    nombre: 'Bordó',
    desc: 'Carbón profundo con acentos vino.',
    muestra: ['#0C1115', '#B4485C', '#E3EAF0'],
    oscuro: armar(true, CARBON_OSC, {
      accent: '#C25368', accentInk: '#1A0A0E', accentSoft: '#2A171C', accentLine: '#4A2830',
    }),
    claro: armar(false, CARBON_CLA, {
      accent: '#8E2E42', accentInk: '#FFFFFF', accentSoft: '#F7E5E9', accentLine: '#E0B4BF',
    }),
  },
];

export const PALETA_DEFECTO: PaletaId = 'grafito';

export function paletaPorId(id?: string): Paleta {
  return PALETAS.find(p => p.id === id) || PALETAS[0];
}

export function temaDe(id: PaletaId | string | undefined, dark: boolean): Theme {
  const p = paletaPorId(id);
  return dark ? p.oscuro : p.claro;
}

/* Compatibilidad: el tema por defecto de la app. */
export const DARK: Theme = PALETAS[0].oscuro;
export const LIGHT: Theme = PALETAS[0].claro;

/* Familias tipográficas cargadas en el arranque */
export const FONT = {
  disp: 'SairaCondensed_600SemiBold',
  dispBold: 'SairaCondensed_700Bold',
  body: 'IBMPlexSans_400Regular',
  bodyMed: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  bodyBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMed: 'IBMPlexMono_500Medium',
};

export const R = { sm: 8, md: 12, lg: 18, pill: 99 };
export const SP = { xs: 4, sm: 7, md: 9, lg: 14, xl: 20 };
