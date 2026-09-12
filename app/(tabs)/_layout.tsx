import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui';
import { Icon } from '../../src/icons';
import { FONT } from '../../src/theme';
import Topbar from '../../src/pantallas/Topbar';

const TABS = [
  { name: 'index', icono: 'inicio', label: 'Inicio' },
  { name: 'directivas', icono: 'directivas', label: 'Directivas' },
  { name: 'accesos', icono: 'accesos', label: 'Accesos' },
  { name: 'informes', icono: 'informes', label: 'Informes' },
  { name: 'mas', icono: 'mas', label: 'Más' },
];

function BarraInferior({ state, navigation }: any) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <View style={{
      flexDirection: 'row', backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.line,
      paddingBottom: ins.bottom, height: 62 + ins.bottom,
    }}>
      {state.routes.map((route: any, i: number) => {
        const cfg = TABS.find(x => x.name === route.name);
        if (!cfg) return null;
        const activo = state.index === i;
        return (
          <Pressable key={route.key} onPress={() => navigation.navigate(route.name)} style={{
            flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3,
          }}>
            {activo ? (
              <View style={{
                position: 'absolute', top: 0, width: 26, height: 2.5,
                borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: t.accent,
              }} />
            ) : null}
            <Icon name={cfg.icono} size={21} color={activo ? t.accent : t.muted} width={1.7} />
            <Text style={{
              fontFamily: FONT.bodySemi, fontSize: 10.5, letterSpacing: 0.4,
              color: activo ? t.accent : t.muted,
            }}>{cfg.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <>
      <Topbar />
      <Tabs
        screenOptions={{ headerShown: false, animation: 'none' }}
        tabBar={props => <BarraInferior {...props} />}
      >
        {TABS.map(x => <Tabs.Screen key={x.name} name={x.name} />)}
      </Tabs>
    </>
  );
}
