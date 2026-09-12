/* Credencial del vigilador. Se toca y gira: adelante la identificación, atrás
   los datos personales. Es la vista de identidad del perfil. */
import React, { useRef, useState } from 'react';
import { View, Text, Image, Pressable, Animated, Easing } from 'react-native';
import { useStore } from '../store';
import { nombrePuesto, franjaPorId, etiquetaFranja } from '../logic';
import { Vigilador, edadDe, dmy } from '../model';
import { FONT, R } from '../theme';
import { useTheme } from '../ui';
import { EscudoMarca } from './Presentacion';

const ALTO = 250;

function Dato({ etiqueta, valor, color, muted }: { etiqueta: string; valor: string; color: string; muted: string }) {
  return (
    <View style={{ gap: 1, minWidth: 0, flexShrink: 1 }}>
      <Text style={{ fontFamily: FONT.disp, fontSize: 10, letterSpacing: 1.2, color: muted, textTransform: 'uppercase' }}>
        {etiqueta}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: FONT.monoMed, fontSize: 14, color }}>
        {valor || '—'}
      </Text>
    </View>
  );
}

export default function Credencial({ g }: { g: Vigilador }) {
  const st = useStore();
  const t = useTheme();
  const [atras, setAtras] = useState(false);
  const giro = useRef(new Animated.Value(0)).current;

  const girar = () => {
    const destino = atras ? 0 : 1;
    setAtras(!atras);
    Animated.timing(giro, {
      toValue: destino, duration: 420, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }).start();
  };

  const frente = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const dorso = giro.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const opFrente = giro.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });
  const opDorso = giro.interpolate({ inputRange: [0, 0.4999, 0.5, 1], outputRange: [0, 0, 1, 1] });

  const puesto = nombrePuesto(st.S, g.puestoId) || 'Sin puesto asignado';
  const turno = g.franjaId ? etiquetaFranja(franjaPorId(st.S, g.franjaId)) : 'Sin turno';
  const nombre = (g.apellido || '') + (g.nombre ? ', ' + g.nombre : '');

  const caja = {
    position: 'absolute' as const, left: 0, right: 0, top: 0, height: ALTO,
    borderRadius: R.lg, borderWidth: 1, borderColor: t.lineStrong,
    backgroundColor: t.surface, overflow: 'hidden' as const,
    backfaceVisibility: 'hidden' as const,
  };

  return (
    <Pressable onPress={girar} accessibilityRole="button" accessibilityLabel="Credencial del vigilador. Seleccione para dar vuelta.">
      <View style={{ height: ALTO }}>
        {/* ---------- frente ---------- */}
        <Animated.View style={[caja, { opacity: opFrente, transform: [{ perspective: 900 }, { rotateY: frente }] }]}>
          <View style={{ height: 42, backgroundColor: t.accent, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9 }}>
            <EscudoMarca size={19} />
            <Text style={{ fontFamily: FONT.dispBold, fontSize: 17, color: t.accentInk, letterSpacing: 0.6 }}>
              VIGEL<Text style={{color: '#31C9DF'}}>IUM</Text>
            </Text>
            <View style={{ flex: 1 }} />
            <Text style={{ fontFamily: FONT.bodySemi, fontSize: 10.5, color: t.accentInk, opacity: 0.85, letterSpacing: 1 }}>
              {(g.rol === 'admin' ? 'ADMINISTRADOR' : 'VIGILADOR')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', padding: 14, gap: 14, alignItems: 'center' }}>
            {g.foto ? (
              <Image source={{ uri: g.foto }} style={{
                width: 92, height: 108, borderRadius: 8, borderWidth: 1, borderColor: t.lineStrong,
              }} />
            ) : (
              <View style={{
                width: 92, height: 108, borderRadius: 8, backgroundColor: t.surface3,
                borderWidth: 1, borderColor: t.lineStrong, alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontFamily: FONT.dispBold, fontSize: 30, color: t.muted }}>
                  {((g.apellido || '?')[0] + (g.nombre?.[0] || '')).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 8 }}>
              <Text numberOfLines={2} style={{ fontFamily: FONT.dispBold, fontSize: 21, lineHeight: 23, color: t.text }}>
                {nombre || 'Sin nombre'}
              </Text>
              <Dato etiqueta="Puesto" valor={puesto} color={t.text2} muted={t.muted} />
              <Dato etiqueta="Turno" valor={turno} color={t.text2} muted={t.muted} />
              <Dato etiqueta="Legajo" valor={g.legajo} color={t.text2} muted={t.muted} />
            </View>
          </View>

          <Text style={{
            position: 'absolute', bottom: 8, right: 14,
            fontFamily: FONT.body, fontSize: 10.5, color: t.muted,
          }}>
            seleccione para dar vuelta
          </Text>
        </Animated.View>

        {/* ---------- dorso ---------- */}
        <Animated.View style={[caja, { opacity: opDorso, transform: [{ perspective: 900 }, { rotateY: dorso }] }]}>
          <View style={{ height: 6, backgroundColor: t.accent }} />
          <View style={{ padding: 15, gap: 13 }}>
            <Text style={{ fontFamily: FONT.disp, fontSize: 12.5, letterSpacing: 1.4, color: t.muted, textTransform: 'uppercase' }}>
              Datos del vigilador
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 12 }}>
              <Dato etiqueta="Legajo" valor={g.legajo} color={t.text} muted={t.muted} />
              <Dato etiqueta="Nacimiento" valor={g.fechaNac ? dmy(g.fechaNac) : ''} color={t.text} muted={t.muted} />
              <Dato etiqueta="Edad" valor={edadDe(g.fechaNac) || g.edad} color={t.text} muted={t.muted} />
              <Dato etiqueta="Horario" valor={g.horaIn && g.horaOut ? g.horaIn + ' a ' + g.horaOut : ''} color={t.text} muted={t.muted} />
              <Dato etiqueta="Celular" valor={g.tel} color={t.text} muted={t.muted} />
              <Dato etiqueta="Francos" valor={g.francos} color={t.text} muted={t.muted} />
            </View>
            <Text numberOfLines={1} style={{ fontFamily: FONT.body, fontSize: 11.5, color: t.muted }}>
              {st.S.site.cliente + (st.S.site.region ? ' · Región ' + st.S.site.region : '')}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
}
