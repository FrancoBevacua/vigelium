/* Selector visual de paleta: se usa en el alta del vigilador y en Ajustes. */
import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { PALETAS, PaletaId, FONT, R } from '../theme';
import { useTheme } from '../ui';
import { Icon } from '../icons';

export function SelectorPaleta(
  { valor, onChange, oscuro = true }:
  { valor: PaletaId; onChange: (p: PaletaId) => void; oscuro?: boolean },
) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}>
        {PALETAS.map(p => {
          const sel = p.id === valor;
          const muestra = oscuro ? p.oscuro : p.claro;
          return (
            <Pressable key={p.id} onPress={() => onChange(p.id)}
              style={{
                width: 108, borderRadius: R.md, overflow: 'hidden',
                borderWidth: sel ? 2 : 1,
                borderColor: sel ? t.accent : t.line,
                backgroundColor: t.surface2,
              }}>
              <View style={{ height: 54, backgroundColor: muestra.bg, padding: 8, justifyContent: 'space-between' }}>
                <View style={{ height: 6, width: 44, borderRadius: 3, backgroundColor: muestra.text2 }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <View style={{ height: 14, width: 34, borderRadius: 4, backgroundColor: muestra.accent }} />
                  <View style={{ height: 14, width: 14, borderRadius: 4, backgroundColor: muestra.surface3 }} />
                </View>
              </View>
              <View style={{ paddingVertical: 7, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text numberOfLines={1} style={{
                  flex: 1, fontFamily: sel ? FONT.bodySemi : FONT.body, fontSize: 12.5,
                  color: sel ? t.text : t.text2,
                }}>{p.nombre}</Text>
                {sel ? <Icon name="check" size={13} color={t.accent} /> : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={{ fontFamily: FONT.body, fontSize: 12.5, color: t.muted, lineHeight: 17 }}>
        {(PALETAS.find(p => p.id === valor) || PALETAS[0]).desc}
      </Text>
    </View>
  );
}

export default SelectorPaleta;
