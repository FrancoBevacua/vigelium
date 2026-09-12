import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { SairaCondensed_600SemiBold, SairaCondensed_700Bold } from '@expo-google-fonts/saira-condensed';

import { AppState } from 'react-native';
import { StoreProvider, useStore } from '../src/store';
import { prepararAvisos, permisoAvisos, reprogramarAvisos } from '../src/avisos';
import { ThemeProvider, ToastHost, useTheme, Banner, Btn } from '../src/ui';
import Gate from '../src/pantallas/Gate';
import Presentacion, { AZUL_PRESENTACION } from '../src/pantallas/Presentacion';
import Barrera from '../src/Barrera';
import { EstadoSincronizacion } from '../src/pantallas/Nube';

SplashScreen.preventAutoHideAsync().catch(() => {});

/* La presentación se mantiene un mínimo de tiempo para que no sea un destello. */
const MINIMO_PRESENTACION = 2400;

function Raiz() {
  const { listo, me, S, avisos, errorInicio, reintentarInicio } = useStore();
  const t = useTheme();
  const [tiempoCumplido, setTiempoCumplido] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTiempoCumplido(true), MINIMO_PRESENTACION);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => { if (listo) SplashScreen.hideAsync().catch(() => {}); }, [listo]);

  /* Recordatorios: se reprograman al abrir, al volver del fondo y ante cualquier
     cambio de directivas, puesto o turno. Todo va envuelto: un fallo acá no
     puede tumbar la app. */
  useEffect(() => { prepararAvisos(); }, []);
  useEffect(() => {
    if (!listo || !me) return;
    let vivo = true;
    const correr = async () => {
      try {
        const ok = avisos ? await permisoAvisos() : true;
        if (!vivo) return;
        await reprogramarAvisos(S, me, avisos && ok);
      } catch (e) {
        console.warn('No se pudieron reprogramar los avisos', e);
      }
    };
    correr();
    const sub = AppState.addEventListener('change', e => { if (e === 'active') correr(); });
    return () => { vivo = false; sub.remove(); };
  }, [listo, me?.id, me?.puestoId, me?.franjaId, avisos, S.directives, S.dlogs]);

  if (!listo || !tiempoCumplido) return <Presentacion />;
  if(errorInicio)return <View style={{flex:1,justifyContent:'center',padding:24,gap:16,backgroundColor:t.bg}}><Banner kind="warn">{errorInicio}</Banner><Btn label="Reintentar inicio" onPress={reintentarInicio}/></View>;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <EstadoSincronizacion />
      {me && me.dni ? <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: t.bg } }} /> : <Gate />}
    </View>
  );
}

function ConTema() {
  const { tema, paleta } = useStore();
  return (
    <ThemeProvider modo={tema} paleta={paleta}>
      <ToastHost>
        <Raiz />
      </ToastHost>
    </ThemeProvider>
  );
}

export default function Layout() {
  const [fuentesListas, errorFuentes] = useFonts({
    IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold, IBMPlexSans_700Bold,
    IBMPlexMono_400Regular, IBMPlexMono_500Medium,
    SairaCondensed_600SemiBold, SairaCondensed_700Bold,
  });

  /* Si las tipografías fallan seguimos con las del sistema: quedarse esperando
     para siempre en una pantalla vacía es peor que perder la tipografía. */
  if (!fuentesListas && !errorFuentes) {
    return (
      <View style={{ flex: 1, backgroundColor: AZUL_PRESENTACION }}>
        <Presentacion />
      </View>
    );
  }

  return (
    <Barrera>
      <SafeAreaProvider>
        <StoreProvider>
          <ConTema />
        </StoreProvider>
      </SafeAreaProvider>
    </Barrera>
  );
}
