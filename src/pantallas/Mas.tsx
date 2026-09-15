import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { visAdentro } from '../logic';
import { FONT, R } from '../theme';
import { useTheme, Pantalla, Cabecera, Btn, Tile, Row, Eyebrow, Card, useToast } from '../ui';
import { Icon } from '../icons';

export default function Mas() {
  const st = useStore();
  const t = useTheme();
  const toast=useToast();
  const dentro = st.list('visits').filter(visAdentro).length;
  const gs = st.list('guards').length;
  const ir = (r: string) => () => router.push(r as any);

  return (
    <Pantalla>
      <Cabecera titulo="Más" sub={(st.S.site.cliente || 'Puesto') + (st.S.site.region ? ' · Región ' + st.S.site.region : '')} />

      <Eyebrow>Prioridad del servicio</Eyebrow>
      <Tile icon="informes" titulo="Informe general · 12 / 24 hs" sub="Revisar, adjuntar evidencia y compartir con el supervisor" onPress={ir('/informedia')} />

      {st.esAdmin ? (
        <Pressable onPress={ir('/admin')} style={({ pressed }) => ({
          padding: 14, borderRadius: R.md, borderWidth: 1,
          backgroundColor: t.accentSoft, borderColor: t.accentLine, opacity: pressed ? 0.75 : 1,
        })}>
          <Row gap={12}>
            <Icon name="ajustes" size={22} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>Administración</Text>
              <Text style={{ fontFamily: FONT.body, fontSize: 11.5, color: t.muted }}>
                Puestos, directivas, roles y turnos del equipo
              </Text>
            </View>
            <Icon name="back" size={17} color={t.accent} />
          </Row>
        </Pressable>
      ) : null}

      <Eyebrow>Operación</Eyebrow>
      <Tile icon="bell" titulo="Recordatorios" sub="Avisos en Google Calendar o el calendario del teléfono" onPress={ir('/recordatorios')} />
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="informes" titulo="Informes de seguridad" sub="Registrar un incidente" onPress={ir('/informes')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="ronda" titulo="Rondas" sub="Recorridas con puntos de control" onPress={ir('/rondas')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="turnos" titulo="Turnos y francos" sub="Diagrama del supervisor y horas" onPress={ir('/turnos')} />
        <Tile icon="directivas" titulo="Directivas" sub="Cargar el documento del puesto" onPress={ir('/importar')} />
      </Row>

      
      <Tile icon="ronda" titulo="Recorrido de locales" sub="Abiertos, cerrados y avisos a inmobiliaria" onPress={ir('/locales')} />
      <Eyebrow>Puesto</Eyebrow>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="equipo" titulo="Equipo" sub={gs + (gs === 1 ? ' vigilador' : ' vigiladores')} onPress={ir('/equipo')} />
        <Tile icon="contactos" titulo="Contactos" sub="Teléfonos de emergencia" onPress={ir('/contactos')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="perfil" titulo="Mi perfil" sub="Datos, foto y PIN" onPress={ir('/perfil')} />
        <Tile icon="ajustes" titulo="Ajustes" sub="Site, tema y respaldo" onPress={ir('/ajustes')} />
      </Row>

      <Btn label="Cerrar sesión" variant="ghost" onPress={async () => {try{await st.salir();}catch(e:any){toast(e.message);}}} />
    </Pantalla>
  );
}
