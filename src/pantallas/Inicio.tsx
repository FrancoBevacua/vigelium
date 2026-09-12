import React, { useMemo, useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { useStore } from '../store';
import { directivasDeHoy, estadoDirectiva, fichajeAbierto, horasDelMes } from '../logic';
import { DOW, dmy, hhmm, hs, isoDate, toMin, uid } from '../model';
import { visAdentro } from '../logic';
import { FONT } from '../theme';
import {
  useTheme, Pantalla, Cabecera, Card, Btn, Tag, Tile, Metric, Banner,
  Stack, Row, Eyebrow, Hint, useToast,
} from '../ui';
import { Ring } from '../icons';
import ServicioActual from './ServicioActual';
import RegistroDirectiva from './RegistroDirectiva';

export default function Inicio() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [, tick] = useState(0);
  const [registrar, setRegistrar] = useState<any>(null);

  useEffect(() => { const i = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(i); }, []);

  const me = st.me!;
  const hoy = isoDate();
  const ds = useMemo(() => directivasDeHoy(st.S, me, hoy), [st.S, me, hoy]);
  const hechas = ds.filter(d => ['ok', 'na'].includes(estadoDirectiva(st.S, d))).length;
  const venc = ds.filter(d => estadoDirectiva(st.S, d) === 'vencida');
  const prox = ds.find(d => ['ahora', 'pend'].includes(estadoDirectiva(st.S, d)));
  const pct = ds.length ? Math.round((hechas / ds.length) * 100) : 0;
  const p = fichajeAbierto(st.S, me.id);
  const nov = st.list('novedades').filter((n: any) => n.fecha === hoy).length;
  const acc = st.list('alogs').filter((a: any) => a.fecha === hoy).length;
  const dentro = st.list('visits').filter(visAdentro).length;

  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  let dur = 0;
  if (p) { dur = ahoraMin - toMin(p.in); if (dur < 0) dur += 1440; }
  const falta = prox ? toMin(prox.hora) - ahoraMin : 0;

  return (
    <Pantalla>
      <Cabecera titulo={me.sexo === 'femenino' ? 'Bienvenida' : 'Bienvenido'} sub={DOW[new Date().getDay()] + ' ' + dmy(hoy)} />

      <Card pad style={{ borderColor: t.accentLine }}>
        <Stack gap={10}>
          <Eyebrow>Informe general · 24 horas</Eyebrow>
          <Text style={{ fontFamily: FONT.body, fontSize: 13, lineHeight: 19, color: t.text2 }}>
            Novedades compartidas entre todos los turnos, ordenadas por fecha y horario.
          </Text>
          <Btn label="Abrir informe del día" icon="informes" variant="primary" onPress={() => router.push('/informedia')} />
        </Stack>
      </Card>

      <ServicioActual />

      {venc.length ? (
        <Banner kind="warn">
          <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: t.warn }}>
            <Text style={{ fontFamily: FONT.bodyBold }}>
              {venc.length + ' directiva' + (venc.length > 1 ? 's' : '') + ' sin registrar'}
            </Text>
            {'\n' + venc.slice(0, 3).map(d => d.hora + ' ' + d.nombre).join(' · ') + (venc.length > 3 ? ' …' : '')}
          </Text>
        </Banner>
      ) : null}

      {prox ? (
        <Card>
          <Row style={{
            padding: 12, borderBottomWidth: 1, borderBottomColor: t.line, justifyContent: 'space-between',
          }}>
            <Text style={{ fontFamily: FONT.disp, fontSize: 19, color: t.text }}>
              {falta <= 10 ? 'Directiva actual' : 'Próxima directiva'}
            </Text>
            <Tag kind={falta <= 10 ? 'acc' : 'mute'}
              label={falta <= 0 ? 'a horario' : falta >= 60 ? Math.floor(falta / 60) + ' h ' + (falta % 60) + ' min' : 'en ' + falta + ' min'} />
          </Row>
          <Row style={{ padding: 14, alignItems: 'flex-start', gap: 12 }}>
            <Text style={{ fontFamily: FONT.monoMed, fontSize: 26, letterSpacing: -0.8, color: t.text }}>{prox.hora}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.bodySemi, fontSize: 15.5, lineHeight: 20, color: t.text }}>{prox.nombre}</Text>
              {prox.novedades ? <Hint>{prox.novedades}</Hint> : null}
            </View>
          </Row>
          <Row style={{ padding: 11, borderTopWidth: 1, borderTopColor: t.line }}>
            <Btn label="Cumplida" icon="check" variant="primary" size="sm" style={{ flex: 1 }}
              onPress={() => setRegistrar(prox)} />
            <Btn label="Ver todas" variant="ghost" size="sm" style={{ flex: 1 }}
              onPress={() => router.push('/directivas')} />
          </Row>
        </Card>
      ) : null}

      <Card pad>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <View>
            <Text style={{ fontFamily: FONT.disp, fontSize: 19, color: t.text }}>Consigna del día</Text>
            <Hint>{hechas + ' de ' + ds.length + ' registradas'}</Hint>
          </View>
          <Ring pct={pct} color={t.accent} track={t.surface3} bg={t.surface} label={pct + '%'} font={FONT.monoMed} />
        </Row>
        <Btn label="Abrir la consigna" variant="ghost" size="sm" onPress={() => router.push('/directivas')} />
      </Card>

      <Row gap={9}>
        <Metric valor={acc} label="Accesos hoy" />
        <Metric valor={nov} label="Novedades" />
      </Row>

      <Eyebrow>Carga rápida</Eyebrow>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="accesos" titulo="Acceso" sub="Apertura o cierre" onPress={() => router.push('/accesos')} />
      </Row>
      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="ronda" titulo="Ronda" sub="Iniciar recorrida" onPress={() => router.push('/rondas')} />
      </Row>

      <Row gap={10} style={{ alignItems: 'stretch' }}>
        <Tile icon="ronda" titulo="Locales" sub="Control de apertura y cierre" onPress={() => router.push('/locales')} />
      </Row>
      <RegistroDirectiva directiva={registrar} onClose={() => setRegistrar(null)} />
    </Pantalla>
  );
}
