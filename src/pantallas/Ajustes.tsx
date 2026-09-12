import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../store';
import { estadoVacio, merge, isoDate, addDays } from '../model';
import {
  ConfigIA, CONFIG_VACIA, PROVEEDORES, ErrorIA, leerConfigIA, guardarConfigIA, modeloPorDefecto,
  pedirIA, fichaProveedor, esWeb,
} from '../ai';
import { ANTICIPO_MIN, permisoAvisos, reprogramarAvisos } from '../avisos';
import { FONT } from '../theme';
import { SelectorPaleta } from './Paletas';
import ConfigurarNube from './Nube';
import {
  useTheme, Pantalla, SubCabecera, Card, Btn, Input, Selector, Seg, Toggle, Stack, Row,
  Eyebrow, Hint, Banner, Divider, useToast, Tag,
} from '../ui';

export default function Ajustes() {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();

  const [cliente, setCliente] = useState(st.S.site.cliente);
  const [region, setRegion] = useState(st.S.site.region);
  const [nombre, setNombre] = useState(st.S.site.nombre);
  const [prefijo, setPrefijo] = useState(st.S.site.prefijo || 'Gs');
  const [precPref, setPrecPref] = useState((st.S.site.precintoPrefijo || '').slice(0, 4));
  const [corte, setCorte] = useState(st.S.site.corteInforme || '19');
  const [supervisor,setSupervisor]=useState(st.S.site.supervisorTel||'');

  const [ia, setIa] = useState<ConfigIA>(CONFIG_VACIA);
  const [probando, setProbando] = useState(false);
  const [probado, setProbado] = useState<'ok' | 'error' | null>(null);
  const [errorIA, setErrorIA] = useState('');

  useEffect(() => { leerConfigIA().then(setIa); }, []);

  const prov = PROVEEDORES.find(p => p.v === ia.proveedor);
  const registros = st.list('alogs').length + st.list('novedades').length + st.list('visits').length;

  const probar = async () => {
    setProbando(true); setProbado(null); setErrorIA('');
    try {
      await guardarConfigIA(ia);
      const r = await pedirIA('Respondé únicamente: listo.', ia, 'Sos un asistente de prueba. Respondé con una sola palabra.');
      setProbado('ok');
      toast('Conexión correcta: ' + r.slice(0, 40));
    } catch (e: any) {
      setProbado('error');
      setErrorIA(e?.message || 'No se pudo conectar');
    } finally {
      setProbando(false);
    }
  };

  return (
    <Pantalla top>
      <SubCabecera titulo="Ajustes" onBack={() => router.back()} />
      <ConfigurarNube />
      <Card pad><Stack gap={12}><Eyebrow>Supervisor</Eyebrow><Input label="Número de WhatsApp" value={supervisor} onChangeText={setSupervisor} keyboardType="phone-pad" placeholder="Código de país y número" hint="Se utilizará para compartir el PDF del Informe general."/><Btn label="Guardar número" onPress={()=>{const n=supervisor.replace(/[^0-9]/g,'');if(n&&!/^[1-9][0-9]{7,14}$/.test(n)){toast('Ingrese el número completo con código de país.');return;}st.setSite({supervisorTel:n});toast('Número del supervisor guardado');}}/></Stack></Card>

      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Datos del site</Eyebrow>
          <Input label="Cliente / Site" value={cliente} onChangeText={setCliente} />
          <Input label="Región" value={region} onChangeText={setRegion} />
          <Input label="Título de los informes" value={nombre} onChangeText={setNombre}
            hint="Va en el encabezado del informe de seguridad." />
          <Input label="Prefijo de los precintos" value={precPref}
            onChangeText={v => setPrecPref(v.replace(/\D/g, '').slice(0, 4))}
            mono keyboardType="number-pad" maxLength={4} placeholder="7652" />
          <Input label="Hora de corte del informe de 24 hs" value={corte}
            onChangeText={v => setCorte(v.replace(/\D/g, '').slice(0, 2))}
            mono keyboardType="number-pad" placeholder="19"
            hint="El informe general va de esta hora a la misma del día siguiente." />
          <Btn label="Guardar" variant="primary" onPress={() => {
            if (precPref && precPref.length !== 4) { toast('El prefijo debe tener 4 números'); return; }
            if (corte && (!/^\d{1,2}$/.test(corte) || +corte > 23)) { toast('La hora de corte debe estar entre 0 y 23'); return; }
            st.setSite({
              cliente, region, nombre, prefijo: prefijo || 'Gs',
              precintoPrefijo: precPref, corteInforme: corte || '19',
            });
            toast('Datos del site guardados');
          }} />
        </Stack>
      </Card>

      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Asistente de IA</Eyebrow>
          <Hint>
            {esWeb() ? 'La clave se guarda en este navegador. ' : 'La clave queda en el almacén seguro del teléfono. '}
            Sólo se envía al proveedor elegido. El dictado se transcribe con el proveedor de IA configurado.
          </Hint>
          {esWeb() ? (
            <Banner kind="warn" icon="alerta">
              {'En el navegador algunos proveedores pueden bloquear la conexión por CORS. El botón Probar muestra la respuesta del proveedor.'}
            </Banner>
          ) : null}
          <Selector label="Proveedor" valor={ia.proveedor}
            onChange={v => setIa(c => ({ ...c, proveedor: v as any, modelo: '' }))}
            opciones={PROVEEDORES.map(p => ({
              v: p.v,
              t: p.t + (p.gratis ? '  · gratis' : ''),
              sub: p.sub + (p.vision || p.audio
                ? '  ·  ' + [p.vision ? 'imágenes' : '', p.audio ? 'dictado' : ''].filter(Boolean).join(' y ')
                : ''),
            }))} />
          {ia.proveedor === 'compatible' ? (
            <Input label="Dirección del servidor" value={ia.baseUrl}
              onChangeText={v => setIa(c => ({ ...c, baseUrl: v }))}
              placeholder="http://192.168.0.10:11434/v1"
              hint="Ollama o LM Studio en su red. Tiene que ser accesible desde el celular."
              autoCapitalize="none" />
          ) : null}
          <Input label="Clave de API" value={ia.apiKey} onChangeText={v => { setIa(c => ({ ...c, apiKey: v })); setProbado(null); }}
            placeholder="pegá acá su clave" autoCapitalize="none" secureTextEntry mono />
          <Input label="Modelo" value={ia.modelo} onChangeText={v => setIa(c => ({ ...c, modelo: v }))}
            placeholder={modeloPorDefecto(ia.proveedor)} autoCapitalize="none" mono
            hint={'Vacío usa ' + modeloPorDefecto(ia.proveedor) + '.'} />
          <Row>
            <Btn label="Guardar" variant="primary" style={{ flex: 1 }}
              onPress={async () => { try { await guardarConfigIA(ia); setIa(await leerConfigIA()); toast('Configuración guardada'); }
                catch (e: any) { setProbado('error'); setErrorIA(e.message); } }} />
            {probando
              ? <View style={{ width: 46, alignItems: 'center' }}><ActivityIndicator color={t.accent} /></View>
              : <Btn label="Probar" variant="ghost" style={{ flex: 1 }} onPress={probar} />}
          </Row>
          {probado ? (
            <Banner kind={probado === 'ok' ? 'info' : 'warn'} icon={probado === 'ok' ? 'check' : 'alerta'}>
              {probado === 'ok' ? 'El modelo respondió correctamente.' : errorIA || 'No se pudo conectar con el proveedor.'}
            </Banner>
          ) : null}
          <Hint>
            {'Con ' + (fichaProveedor(ia.proveedor)?.t || 'este proveedor') + ' puede: redactar informes' +
              (fichaProveedor(ia.proveedor)?.vision ? ', leer documentos y fotos' : '') +
              '.'}
          </Hint>
        </Stack>
      </Card>

      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Apariencia</Eyebrow>
          <Hint>Tema de color de toda la app.</Hint>
          <SelectorPaleta valor={st.paleta} onChange={st.setPaleta} oscuro={t.dark} />
          <Seg valor={st.tema} onChange={v => st.setTema(v as any)}
            opciones={[{ v: 'auto', t: 'Automático' }, { v: 'light', t: 'Claro' }, { v: 'dark', t: 'Oscuro' }]} />
          <Toggle label="Asistente de redacción"
            sub="Corrige ortografía, horarios y abreviaturas al escribir novedades."
            value={st.asistente} onChange={st.setAsistente} />
          <Toggle label="Recordatorios de directivas"
            sub={'Un aviso ' + ANTICIPO_MIN + ' minutos antes de cada tarea y otro en el horario, aunque la app esté cerrada.'}
            value={st.avisos}
            onChange={async v => {
              st.setAvisos(v);
              if (v) {
                const ok = await permisoAvisos();
                if (!ok) { toast('El teléfono no dio permiso para avisar'); return; }
                const n = await reprogramarAvisos(st.S, st.me, true);
                toast(n ? n + ' recordatorios programados' : 'No hay directivas próximas para avisar');
              } else {
                await reprogramarAvisos(st.S, st.me, false);
                toast('Recordatorios desactivados');
              }
            }} />
          <Toggle label="Asentar aperturas y cierres"
            sub="Cada apertura o cierre que cargues en Accesos genera también su asiento en el libro."
            value={!!st.S.site.alogLibro}
            onChange={v => { st.setSite({ alogLibro: v }); toast(v ? 'Las aperturas pasan al libro' : 'Solo quedan en Accesos'); }} />
        </Stack>
      </Card>

      <Card pad>
        <Stack gap={12}>
          <Eyebrow>Datos y respaldo</Eyebrow>
          <Hint>
            {st.list('guards').length + ' vigiladores · ' + st.list('directives').length + ' directivas · ' +
              registros + ' registros · ' + st.list('reports').length + ' informes'}
          </Hint>
          <Btn label="Copiar respaldo" icon="copy" variant="ghost" onPress={async () => {
            await Clipboard.setStringAsync(JSON.stringify(st.S));
            toast('Respaldo copiado. Péguelo en una nota o mandátelo por mail.');
          }} />
          {st.esAdmin ? <Btn label="Restaurar desde el portapapeles" variant="ghost" onPress={async () => {
            try {
              const crudo = await Clipboard.getStringAsync();
              const datos = JSON.parse(crudo);
              if (!datos || !Array.isArray(datos.guards)) throw new Error('formato');
              st.reemplazar(merge(st.S, datos));
              toast('Respaldo restaurado y fusionado');
            } catch (e: any) { toast(e.message || 'El portapapeles no tiene un respaldo válido'); }
          }} /> : null}
          <Hint>Las novedades de turnos anteriores se conservan al restaurar un respaldo.</Hint>
        </Stack>
      </Card>

      <Hint>VIGELIUM · versión nativa para Android e iOS</Hint>
    </Pantalla>
  );
}
