import React, { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useStore } from '../store';
import {
  Acceso, Adjunto, AUTZ, CLASES_ADJUNTO, ClaseAdjunto, Persona,
  TIPOS_VEHICULO, Vehiculo, uid, vehiculoVacio,
} from '../model';
import { FONT, R } from '../theme';
import {
  useTheme, Card, Btn, Input, Field, Chip, Chipbar, Row, Stack, Eyebrow, Hint,
  Toggle, Sheet, Item, useToast,
} from '../ui';
import { Icon } from '../icons';

/* Editor compartido por el Informe general y por visitas y proveedores. */
export default function BloqueAcceso({ valor, onChange }: {
  valor: Acceso; onChange: (a: Acceso) => void;
}) {
  const t = useTheme();
  const set = (k: keyof Acceso, v: any) => onChange({ ...valor, [k]: v });
  const personas: Persona[] = valor.personas?.length ? valor.personas : [{ nombre: '', dni: '' }];
  const setPersona = (i: number, k: keyof Persona, v: string) =>
    set('personas', personas.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const veh: Vehiculo = valor.vehiculo || vehiculoVacio();
  const setVeh = (k: keyof Vehiculo, v: any) => set('vehiculo', { ...veh, [k]: v });

  return (
    <Stack gap={14}>
      <Card pad style={{ backgroundColor: t.surface2 }}>
        <Stack gap={11}>
          <Eyebrow>Quién ingresa</Eyebrow>
          <Input label="Razón social" value={valor.empresa} onChangeText={v => set('empresa', v)}
            placeholder="Distribuidora Sur" />
          <Input label="Tarea a realizar" value={valor.tarea} onChangeText={v => set('tarea', v)}
            placeholder="mantenimiento de equipos de frío" />
          <Input label="Lugar" value={valor.lugar} onChangeText={v => set('lugar', v)}
            placeholder="Playa 1" />

          <Field label="Empleados">
            <Stack gap={7}>
              {personas.map((p, i) => (
                <Row key={i} gap={7} style={{ alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Input value={p.nombre} onChangeText={v => setPersona(i, 'nombre', v)} placeholder="Nombre completo" />
                  </View>
                  <View style={{ width: 116 }}>
                    <Input value={p.dni} onChangeText={v => setPersona(i, 'dni', v)}
                      placeholder="DNI" mono keyboardType="number-pad" />
                  </View>
                  {personas.length > 1 ? (
                    <Btn icon="x" variant="ghost" size="sm"
                      onPress={() => set('personas', personas.filter((_, j) => j !== i))} />
                  ) : null}
                </Row>
              ))}
              <Btn label="Agregar empleado" icon="plus" variant="ghost" size="sm"
                onPress={() => set('personas', [...personas, { nombre: '', dni: '' }])} />
            </Stack>
          </Field>

          <Field label="Autorización" hint="Si el CCTV no confirma, dejá asentado si el personal aguardó o se retiró.">
            <Chipbar>
              {AUTZ.map(([v, lab]) => (
                <Chip key={v} label={lab} on={valor.autoriz === v} onPress={() => set('autoriz', v)} />
              ))}
            </Chipbar>
          </Field>
        </Stack>
      </Card>

      <Card pad style={{ backgroundColor: t.surface2 }}>
        <Stack gap={11}>
          <Toggle label="Ingresa con vehículo o maquinaria"
            sub="Camión, utilitario, maquinaria: datos del chofer y documentación."
            value={veh.activo} onChange={v => setVeh('activo', v)} />

          {veh.activo ? (
            <>
              <Field label="Tipo">
                <Chipbar>
                  {TIPOS_VEHICULO.map(x => (
                    <Chip key={x} label={x} on={veh.tipo === x} onPress={() => setVeh('tipo', x)} />
                  ))}
                </Chipbar>
              </Field>
              <Row gap={11} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input label="Chofer" value={veh.chofer} onChangeText={v => setVeh('chofer', v)}
                    placeholder="Nombre completo" />
                </View>
                <View style={{ width: 116 }}>
                  <Input label="DNI" value={veh.dniChofer} onChangeText={v => setVeh('dniChofer', v)}
                    mono keyboardType="number-pad" />
                </View>
              </Row>
              <Row gap={11} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input label="Marca" value={veh.marca} onChangeText={v => setVeh('marca', v)} placeholder="Mercedes-Benz" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Modelo" value={veh.modelo} onChangeText={v => setVeh('modelo', v)} placeholder="Atego 1725" />
                </View>
              </Row>
              <Row gap={11} style={{ alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Input label="Dominio" value={veh.dominio} mono autoCapitalize="characters"
                    onChangeText={v => setVeh('dominio', v.toUpperCase())} placeholder="AB123CD" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Póliza N°" value={veh.poliza} onChangeText={v => setVeh('poliza', v)} mono />
                </View>
              </Row>
              <Adjuntos adjuntos={veh.adjuntos || []} onChange={a => setVeh('adjuntos', a)} />
              <Input label="Observaciones del vehículo" value={veh.obs} onChangeText={v => setVeh('obs', v)}
                multiline rows={2} placeholder="Ingresa con acoplado, se controla carga…" />
            </>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}

/* ================= adjuntos: seguro, DNI, autorización ================= */
function Adjuntos({ adjuntos, onChange }: { adjuntos: Adjunto[]; onChange: (a: Adjunto[]) => void }) {
  const st = useStore();
  const t = useTheme();
  const toast = useToast();
  const [eligiendo, setEligiendo] = useState<ClaseAdjunto | null>(null);

  const agregar = async (clase: ClaseAdjunto, origen: 'camara' | 'galeria' | 'archivo') => {
    setEligiendo(null);
    try {
      if (origen === 'archivo') {
        const res = await DocumentPicker.getDocumentAsync({
          type: ['application/pdf', 'image/*'], copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];
        const uri = await st.guardarArchivo(a.uri, a.name || 'documento.pdf');
        onChange([...adjuntos, {
          id: uid(), uri, nombre: a.name || 'documento',
          tipo: /pdf$/i.test(a.name || '') || a.mimeType === 'application/pdf' ? 'pdf' : 'imagen',
          clase,
        }]);
      } else {
        const perm = origen === 'camara'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { toast('Necesito el permiso para eso'); return; }
        const res = origen === 'camara'
          ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.7 });
        if (res.canceled || !res.assets?.[0]) return;
        const uri = await st.guardarFoto(res.assets[0].uri);
        const lab = (CLASES_ADJUNTO.find(x => x[0] === clase) || ['', 'Documento'])[1];
        onChange([...adjuntos, { id: uid(), uri, nombre: lab, tipo: 'imagen', clase }]);
      }
      toast('Documento adjuntado');
    } catch (e) {
      console.warn(e);
      toast('No se pudo adjuntar el archivo');
    }
  };

  return (
    <Field label="Documentación" hint="Seguro, DNI del chofer y autorización, como foto o PDF.">
      <Stack gap={9}>
        {adjuntos.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {adjuntos.map(a => (
              <View key={a.id} style={{
                width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden',
                borderWidth: 1, borderColor: t.line, backgroundColor: t.surface,
              }}>
                {a.tipo === 'imagen' ? (
                  <Image source={{ uri: a.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    <Icon name="informes" size={22} color={t.muted} />
                    <Text numberOfLines={1} style={{ fontFamily: FONT.body, fontSize: 9.5, color: t.muted, paddingHorizontal: 4 }}>
                      PDF
                    </Text>
                  </View>
                )}
                <View style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0,
                  backgroundColor: 'rgba(12,17,21,0.78)', paddingVertical: 3,
                }}>
                  <Text numberOfLines={1} style={{
                    fontFamily: FONT.dispBold, fontSize: 9.5, color: '#fff', textAlign: 'center',
                    letterSpacing: 0.4, textTransform: 'uppercase',
                  }}>
                    {(CLASES_ADJUNTO.find(x => x[0] === a.clase) || ['', 'Otro'])[1]}
                  </Text>
                </View>
                <Pressable onPress={() => onChange(adjuntos.filter(x => x.id !== a.id))}
                  style={{
                    position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12,
                    backgroundColor: 'rgba(12,17,21,0.78)', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Icon name="x" size={13} color="#fff" width={2.4} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : <Hint>Todavía no adjuntaste documentación.</Hint>}

        <Chipbar>
          {CLASES_ADJUNTO.map(([v, lab]) => (
            <Chip key={v} label={'+ ' + lab} onPress={() => setEligiendo(v)} />
          ))}
        </Chipbar>
      </Stack>

      <Sheet visible={!!eligiendo}
        title={'Adjuntar ' + (CLASES_ADJUNTO.find(x => x[0] === eligiendo) || ['', ''])[1].toLowerCase()}
        onClose={() => setEligiendo(null)}>
        <Card>
          <Item title="Sacar una foto" subs={['Con la cámara del teléfono']}
            onPress={() => eligiendo && agregar(eligiendo, 'camara')} />
          <Item title="Elegir de la galería" subs={['Una foto ya sacada']}
            onPress={() => eligiendo && agregar(eligiendo, 'galeria')} />
          <Item last title="Elegir un archivo" subs={['PDF o imagen guardada en el teléfono']}
            onPress={() => eligiendo && agregar(eligiendo, 'archivo')} />
        </Card>
      </Sheet>
    </Field>
  );
}
