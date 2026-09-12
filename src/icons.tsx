/* Iconografía: mismos trazos que la versión web, renderizados con react-native-svg. */
import React from 'react';
import { SvgXml } from 'react-native-svg';

export const IC: Record<string, string> = {
  inicio:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  directivas:'<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8.5 9h7M8.5 13h7M8.5 17h4"/>',
  accesos:'<rect x="4" y="3" width="12" height="18" rx="1.5"/><path d="M12.5 12h.01"/><path d="M16 21h4V8"/>',
  informes:'<path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z"/><path d="M13 3v6h6"/><path d="M9 13h6M9 17h4"/>',
  mas:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  libro:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
  visita:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5"/><path d="M17 8h5M19.5 5.5v5"/>',
  ronda:'<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5V12l3.5 2"/>',
  turnos:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M9 15h2M14 15h2"/>',
  equipo:'<circle cx="8.5" cy="8" r="3.2"/><path d="M2.5 19.5c.5-3.2 3-5 6-5s5.5 1.8 6 5"/><circle cx="17" cy="9.5" r="2.6"/><path d="M15 15c2.6-.4 5 1.2 5.5 4"/>',
  perfil:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.7-4 3.8-6.2 7.5-6.2s6.8 2.2 7.5 6.2"/>',
  ajustes:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>',
  contactos:'<path d="M6.5 3h11a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z"/><circle cx="12" cy="10" r="2.6"/><path d="M8.5 17c.4-1.9 1.8-3 3.5-3s3.1 1.1 3.5 3"/><path d="M2.5 8h2.5M2.5 12h2.5M2.5 16h2.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  copy:'<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 5.5v-1a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h1"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l4 2.2"/>',
  alerta:'<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4M12 17h.01"/>',
  check:'<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  trash:'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/>',
  share:'<path d="M12 3v13"/><path d="M8 7l4-4 4 4"/><path d="M5 14v5.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V14"/>',
  empty:'<circle cx="12" cy="12" r="9"/><path d="M8.5 12h7"/>',
  down:'<path d="M12 4v13M6.5 11.5 12 17l5.5-5.5"/><path d="M4 20h16"/>',
  up:'<path d="M12 20V7M6.5 12.5 12 7l5.5 5.5"/><path d="M4 3h16"/>',
  bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
};

export function Icon({ name, size = 20, color = '#000', width = 1.8 }:
  { name: string; size?: number; color?: string; width?: number }) {
  const d = IC[name] || '';
  const xml = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' + color +
    '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
  return <SvgXml xml={xml} width={size} height={size} />;
}

/* Anillo de progreso, mismo lenguaje que la barra de la versión web. */
import { Circle, Svg } from 'react-native-svg';
import { View, Text } from 'react-native';

export function Ring({ pct, size = 64, color, track, bg, label, font }:
  { pct: number; size?: number; color: string; track: string; bg: string; label: string; font?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={8} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={8} fill="none"
          strokeDasharray={`${(c * Math.max(0, Math.min(100, pct))) / 100} ${c}`} strokeLinecap="round" />
      </Svg>
      <View style={{
        width: size - 16, height: size - 16, borderRadius: size, backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontFamily: font, fontSize: 14, color }}>{label}</Text>
      </View>
    </View>
  );
}
