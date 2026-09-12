import React, { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useStore } from '../store';
import { nombrePuesto, turnoDeHoy, franjaPorId, etiquetaFranja } from '../logic';
import { DOW, MES, pad2 } from '../model';
import { FONT } from '../theme';
import { useTheme } from '../ui';
import { Avatar } from './Gate';

export default function Topbar() {
  const st = useStore();
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const i = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(i);
  }, []);

  if (!st.me) return null;
  const diagrama = turnoDeHoy(st.S, st.me.id);
  const franja = franjaPorId(st.S, st.me.franjaId);
  const puesto = nombrePuesto(st.S, st.me.puestoId) || 'Sin puesto';
  const turno = diagrama || (franja ? etiquetaFranja(franja) : '');

  return (
    <View style={{
      paddingTop: ins.top, height: 56 + ins.top, flexDirection: 'row', alignItems: 'center',
      gap: 10, paddingHorizontal: 14, backgroundColor: t.surface,
      borderBottomWidth: 1, borderBottomColor: t.line,
    }}>
      <Pressable onPress={() => router.push('/perfil')}>
        <Avatar g={st.me} size={34} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>
          {st.me.apellido + ', ' + st.me.nombre}
        </Text>
        <Text numberOfLines={1} style={{
          fontFamily: FONT.body, fontSize: 11, letterSpacing: 0.7, color: t.muted, textTransform: 'uppercase',
        }}>
          {puesto + (turno ? ' · ' + turno : '')}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FONT.monoMed, fontSize: 19, color: t.text }}>
          {pad2(ahora.getHours()) + ':' + pad2(ahora.getMinutes()) + ':' + pad2(ahora.getSeconds())}
        </Text>
        <Text style={{ fontFamily: FONT.body, fontSize: 9.5, letterSpacing: 0.8, color: t.muted, textTransform: 'uppercase' }}>
          {DOW[ahora.getDay()] + ' ' + ahora.getDate() + ' ' + MES[ahora.getMonth()].slice(0, 3)}
        </Text>
      </View>
    </View>
  );
}
