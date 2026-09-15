/* Kit de componentes: mismo lenguaje visual que la versión web. */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Modal, Animated,
  useColorScheme, ViewStyle, TextStyle, StyleProp, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Theme, LIGHT, DARK, FONT, R, PaletaId, temaDe } from './theme';
import { Icon } from './icons';

/* ---------------- tema ---------------- */
const ThemeCtx = createContext<Theme>(DARK);
export const useTheme = () => useContext(ThemeCtx);

export type ModoTema = 'auto' | 'light' | 'dark';
export function ThemeProvider(
  { modo, paleta, children }: { modo: ModoTema; paleta?: PaletaId; children: React.ReactNode },
) {
  const sys = useColorScheme();
  const dark = modo === 'auto' ? sys !== 'light' : modo === 'dark';
  return <ThemeCtx.Provider value={temaDe(paleta, dark)}>{children}</ThemeCtx.Provider>;
}

/* ---------------- tipografía ---------------- */
export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: FONT.dispBold, fontSize: 27, lineHeight: 30, color: t.text }, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: FONT.disp, fontSize: 19, color: t.text }, style]}>{children}</Text>;
}
export function Sub({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: FONT.body, fontSize: 13, lineHeight: 19, color: t.muted }, style]}>{children}</Text>;
}
export function Hint({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ fontFamily: FONT.body, fontSize: 11.5, lineHeight: 16, color: t.muted }}>{children}</Text>;
}
export function Eyebrow({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={{ fontFamily: FONT.disp, fontSize: 12, letterSpacing: 1.7, color: t.muted, textTransform: 'uppercase' }}>
        {children}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: t.line }} />
    </View>
  );
}
export function Mono({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ fontFamily: FONT.mono, color: t.text }, style]}>{children}</Text>;
}

/* ---------------- contenedores ---------------- */
export function Card({ children, pad, style }: { children: React.ReactNode; pad?: boolean; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[{
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: R.md,
      overflow: 'hidden', ...(pad ? { padding: 14 } : null),
    }, style]}>{children}</View>
  );
}
export function Stack({ children, gap = 14, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}
export function Row({ children, gap = 9, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}
export function Divider() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.line }} />;
}

/* ---------------- botones ---------------- */
type BtnVar = 'primary' | 'ghost' | 'danger' | 'default';
export function Btn({ label, icon, onPress, variant = 'default', size = 'md', style, disabled }: {
  label?: string; icon?: string; onPress?: () => void; variant?: BtnVar;
  size?: 'md' | 'sm' | 'xs'; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  const t = useTheme();
  const toast = useToast();
  const h = size === 'md' ? 46 : size === 'sm' ? 38 : 32;
  const fs = size === 'md' ? 14.5 : size === 'sm' ? 13.5 : 12.5;
  const iz = size === 'md' ? 18 : size === 'sm' ? 16 : 14;
  const bg = variant === 'primary' ? t.accent : variant === 'default' ? t.surface2 : 'transparent';
  const bd = variant === 'primary' ? t.accent : variant === 'danger' ? t.crit : variant === 'ghost' ? t.line : t.lineStrong;
  const fg = variant === 'primary' ? t.accentInk : variant === 'danger' ? t.crit : t.text;
  return (
    <Pressable
      onPress={async () => { try { await onPress?.(); } catch (e: any) { toast(e?.message || 'No se pudo completar la operación.'); } }} disabled={disabled}
      style={({ pressed }) => [{
        minHeight: h, paddingHorizontal: label ? 15 : 0, width: label ? undefined : h,
        borderRadius: 10, borderWidth: 1, borderColor: bd, backgroundColor: bg,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      }, style]}>
      {icon ? <Icon name={icon} size={iz} color={fg} /> : null}
      {label ? <Text style={{ flexShrink: 1, textAlign: 'center', paddingVertical: 6, fontFamily: FONT.bodySemi, fontSize: fs, color: fg }}>{label}</Text> : null}
    </Pressable>
  );
}

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: string }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      minHeight: 31, paddingHorizontal: 11, borderRadius: R.pill, borderWidth: 1,
      borderColor: on ? t.accentLine : t.line, backgroundColor: on ? t.accentSoft : t.surface2,
      flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1,
    })}>
      {icon ? <Icon name={icon} size={13} color={on ? t.accent : t.text2} /> : null}
      <Text style={{ fontFamily: on ? FONT.bodySemi : FONT.bodyMed, fontSize: 12.5, color: on ? t.accent : t.text2 }}>{label}</Text>
    </Pressable>
  );
}
export function Chipbar({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 6 }}>
      {children}
    </ScrollView>
  );
}

export type TagKind = 'ok' | 'warn' | 'crit' | 'info' | 'mute' | 'acc';
export function Tag({ label, kind = 'mute' }: { label: string; kind?: TagKind }) {
  const t = useTheme();
  const map: Record<TagKind, [string, string]> = {
    ok: [t.okSoft, t.ok], warn: [t.warnSoft, t.warn], crit: [t.critSoft, t.crit],
    info: [t.slateSoft, t.slate], mute: [t.surface3, t.muted], acc: [t.accentSoft, t.accent],
  };
  const [bg, fg] = map[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2.5 }}>
      <Text style={{ fontFamily: FONT.dispBold, fontSize: 11, letterSpacing: 0.6, color: fg, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

export function Seg({ opciones, valor, onChange, acento }: {
  opciones: { v: string; t: string }[]; valor: string; onChange: (v: string) => void; acento?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surface2, borderWidth: 1, borderColor: t.line, borderRadius: 10, padding: 3, gap: 3 }}>
      {opciones.map(o => {
        const on = o.v === valor;
        return (
          <Pressable key={o.v} onPress={() => onChange(o.v)} style={{
            flex: 1, minHeight: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center',
            backgroundColor: on ? (acento ? t.accent : t.surface) : 'transparent',
          }}>
            <Text numberOfLines={1} style={{
              fontFamily: FONT.bodySemi, fontSize: 13.5,
              color: on ? (acento ? t.accentInk : t.text) : t.muted,
            }}>{o.t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.body, fontSize: 14.5, color: t.text }}>{label}</Text>
        {sub ? <Hint>{sub}</Hint> : null}
      </View>
      <View style={{
        width: 46, height: 27, borderRadius: R.pill, backgroundColor: value ? t.accent : t.lineStrong,
        justifyContent: 'center', paddingHorizontal: 3,
      }}>
        <View style={{
          width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff',
          transform: [{ translateX: value ? 19 : 0 }],
        }} />
      </View>
    </Pressable>
  );
}

/* ---------------- formularios ---------------- */
export function Field({ label, hint, children }: { label?: string; hint?: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 6, minWidth: 0 }}>
      {label ? (
        <Text style={{ fontFamily: FONT.disp, fontSize: 12.5, letterSpacing: 1.3, color: t.muted, textTransform: 'uppercase' }}>
          {label}
        </Text>
      ) : null}
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
    </View>
  );
}
export function Input(props: {
  label?: string; hint?: string; value: string; onChangeText?: (v: string) => void;
  placeholder?: string; mono?: boolean; multiline?: boolean; rows?: number;
  keyboardType?: any; autoCapitalize?: any; maxLength?: number; style?: StyleProp<ViewStyle>;
  secureTextEntry?: boolean; editable?: boolean; fixedHeight?: boolean;
  prefijo?: string; derecha?: React.ReactNode;
}) {
  const t = useTheme();
  const { label, hint, mono, rows, style, prefijo, derecha, fixedHeight, ...rest } = props;
  const alto = props.multiline ? (rows || 4) * 22 + 20 : 46;
  const [contenidoAlto, setContenidoAlto] = useState(alto);
  const [desplazamiento, setDesplazamiento] = useState(0);
  const pista = alto - 14;
  const pulgar = Math.max(18, pista * alto / Math.max(alto, contenidoAlto));
  const letra = { color: t.text, fontFamily: mono ? FONT.mono : FONT.body, fontSize: 15.5 };

  /* Con prefijo, la parte fija vive dentro del mismo recuadro: el vigilador solo
     escribe lo que cambia. */
  if (prefijo != null || derecha) {
    return (
      <Field label={label} hint={hint}>
        <View style={[{
          minHeight: alto, backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong,
          borderRadius: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
        }, style as any]}>
          {prefijo != null ? (
            <Text style={{ fontFamily: FONT.mono, fontSize: 15.5, color: t.muted, letterSpacing: 0.5 }}>
              {prefijo}
            </Text>
          ) : null}
          <TextInput
            {...rest}
            placeholderTextColor={t.muted}
            style={[letra, { flex: 1, paddingVertical: 11, paddingLeft: prefijo != null ? 3 : 0 }]}
          />
          {derecha}
        </View>
      </Field>
    );
  }

  return (
    <Field label={label} hint={hint}>
      <View style={{ position: 'relative' }}>
      <TextInput
        {...rest}
        scrollEnabled={fixedHeight || undefined}
        onContentSizeChange={fixedHeight ? e => setContenidoAlto(e.nativeEvent.contentSize.height) : undefined}
        onScroll={fixedHeight ? e => setDesplazamiento(e.nativeEvent.contentOffset.y) : undefined}
        placeholderTextColor={t.muted}
        style={[{
          minHeight: alto, ...(fixedHeight ? { height: alto, maxHeight: alto, overflow: 'scroll' as const } : {}),
          paddingHorizontal: 12, paddingVertical: 11,
          backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong, borderRadius: 10,
          textAlignVertical: props.multiline ? 'top' : 'center',
        }, letra, style as any]}
      />
      {fixedHeight && contenidoAlto > alto ? <View pointerEvents="none" style={{ position: 'absolute', right: 4, top: 7, width: 3, height: pista, borderRadius: 2, backgroundColor: t.line }}>
        <View style={{ width: 3, height: pulgar, borderRadius: 2, backgroundColor: t.muted,
          marginTop: Math.min(1, Math.max(0, desplazamiento / (contenidoAlto - alto))) * (pista - pulgar) }} />
      </View> : null}
      </View>
    </Field>
  );
}

/* ---------------- listas ---------------- */
/* Las tarjetas de lista muestran un resumen, no el asiento entero: si el texto
   se desborda rompe el diseño y no se lee igual. El detalle está al abrirlo. */
export function Item({ lead, title, subs, right, onPress, stripe, last, lineas = 2, tituloLineas = 2 }: {
  lead?: React.ReactNode; title?: React.ReactNode; subs?: (string | null | undefined)[];
  right?: React.ReactNode; onPress?: () => void; stripe?: TagKind | null; last?: boolean;
  lineas?: number; tituloLineas?: number;
}) {
  const t = useTheme();
  const map: Record<TagKind, string> = {
    ok: t.ok, warn: t.warn, crit: t.crit, info: t.slate, mute: t.lineStrong, acc: t.accent,
  };
  const estilo = (pressed = false): ViewStyle => ({
    flexDirection: 'row', gap: 10, paddingVertical: 15, paddingHorizontal: 16,
    borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line,
    borderLeftWidth: stripe ? 3 : 0, borderLeftColor: stripe ? map[stripe] : 'transparent',
    alignItems: 'flex-start', backgroundColor: pressed ? t.surface2 : 'transparent',
  });
  const Cmp: any = onPress ? Pressable : View;
  return (
    <Cmp onPress={onPress} style={onPress ? ({ pressed }: any) => estilo(pressed) : estilo()}>
      {lead != null ? (
        <View style={{ minWidth: 44, paddingTop: 1 }}>
          {typeof lead === 'string'
            ? <Text style={{ fontFamily: FONT.monoMed, fontSize: 14, color: t.text2 }}>{lead}</Text>
            : lead}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {typeof title === 'string'
          ? (
            <Text numberOfLines={tituloLineas}
              style={{ fontFamily: FONT.bodySemi, fontSize: 14.5, lineHeight: 19, color: t.text }}>
              {title}
            </Text>
          )
          : title}
        {(subs || []).filter(Boolean).map((s, i) => (
          <Text key={i} numberOfLines={lineas}
            style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 17, color: t.muted }}>
            {String(s).replace(/\s*\n\s*/g, ' · ')}
          </Text>
        ))}
      </View>
      {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{right}</View> : null}
    </Cmp>
  );
}

export function Empty({ children }: { children: string }) {
  const t = useTheme();
  return (
    <View style={{ padding: 34, alignItems: 'center', gap: 10 }}>
      <Icon name="empty" size={34} color={t.muted} width={1.4} />
      <Text style={{ fontFamily: FONT.body, fontSize: 13.5, lineHeight: 20, color: t.muted, textAlign: 'center', maxWidth: 300 }}>
        {children}
      </Text>
    </View>
  );
}

export function Banner({ kind, icon, children }: { kind: 'warn' | 'info'; icon?: string; children: React.ReactNode }) {
  const t = useTheme();
  const fg = kind === 'warn' ? t.warn : t.slate;
  const bg = kind === 'warn' ? t.warnSoft : t.slateSoft;
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: R.md, backgroundColor: bg, borderWidth: 1, borderColor: fg + '44' }}>
      <Icon name={icon || (kind === 'warn' ? 'alerta' : 'clock')} size={17} color={fg} />
      <View style={{ flex: 1 }}>
        {typeof children === 'string'
          ? <Text style={{ fontFamily: FONT.body, fontSize: 12.5, lineHeight: 18, color: fg }}>{children}</Text>
          : children}
      </View>
    </View>
  );
}

export function Metric({ valor, label }: { valor: string | number; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, padding: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line, borderRadius: R.md }}>
      <Text style={{ fontFamily: FONT.monoMed, fontSize: 23, letterSpacing: -0.7, color: t.text }}>{valor}</Text>
      <Text style={{ fontFamily: FONT.bodySemi, fontSize: 10.5, letterSpacing: 0.9, color: t.muted, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

export function Tile({ icon, titulo, sub, onPress }: { icon: string; titulo: string; sub?: string; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flex: 1, padding: 14, gap: 8, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line,
      borderRadius: R.md, opacity: pressed ? 0.75 : 1,
    })}>
      <Icon name={icon} size={22} color={t.accent} />
      <Text style={{ fontFamily: FONT.disp, fontSize: 17, color: t.text }}>{titulo}</Text>
      {sub ? <Text style={{ fontFamily: FONT.body, fontSize: 11.5, lineHeight: 15, color: t.muted }}>{sub}</Text> : null}
    </Pressable>
  );
}

/* ---------------- hoja modal ---------------- */
export function Sheet({ visible, title, onClose, onBack, children, footer }: {
  visible: boolean; title: string; onClose: () => void; onBack?: () => void;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,12,16,0.55)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{
          backgroundColor: t.surface, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg,
          maxHeight: '92%', width: '100%', maxWidth: 600, alignSelf: 'center',
        }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: t.lineStrong }} />
          </View>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
            borderBottomWidth: 1, borderBottomColor: t.line,
          }}>
            {onBack ? <Btn icon="back" variant="ghost" size="sm" onPress={onBack} /> : null}
            <Text style={{ flex: 1, fontFamily: FONT.dispBold, fontSize: 21, color: t.text }}>{title}</Text>
            <Btn icon="x" variant="ghost" size="sm" onPress={onClose} />
          </View>
          <KeyboardAwareScrollView bottomOffset={24} style={{flexShrink:1}} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            {children}
          {footer ? (
            <View style={{
              flexDirection: 'row', gap: 9, padding: 12, paddingBottom: 12 + ins.bottom,
              borderTopWidth: 1, borderTopColor: t.line,
            }}>{footer}</View>
          ) : null}
          </KeyboardAwareScrollView>
        </View>
        <AvisoToast modal />
      </View>
    </Modal>
  );
}

/* ---------------- avisos ---------------- */
type ToastCtx = { toast: (m: string) => void; msg?: string | null; op?: Animated.Value };
const TCtx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(TCtx).toast;

export function ToastHost({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  const [msg, setMsg] = useState<string | null>(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(op, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMsg(null));
    }, 5000);
  }, [op]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <TCtx.Provider value={{ toast, msg, op }}>
      {children}
      <AvisoToast />
    </TCtx.Provider>
  );
}

function AvisoToast({ modal = false }: { modal?: boolean }) {
  const { msg, op } = useContext(TCtx);
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return msg ? (
        <Animated.View pointerEvents="none" style={{
          position: 'absolute', left: 0, right: 0, ...(modal ? { top: ins.top + 12 } : { bottom: 78 + ins.bottom }), alignItems: 'center', opacity: op, zIndex: 999,
        }}>
          <View style={{ backgroundColor: t.text, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, maxWidth: '88%' }}>
            <Text style={{ fontFamily: FONT.bodyMed, fontSize: 13.5, color: t.bg, textAlign: 'center' }}>{msg}</Text>
          </View>
        </Animated.View>
      ) : null;
}

export const styles = StyleSheet.create({});

/* ---------------- contenedor de pantalla ---------------- */
export function Pantalla({ children, gap = 14, top }:
  { children: React.ReactNode; gap?: number; top?: boolean }) {
  const t = useTheme();
  const ins = useSafeAreaInsets();
  return (
    <KeyboardAwareScrollView bottomOffset={24} keyboardDismissMode="on-drag"
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={{
        padding: 14, paddingTop: 14 + (top ? ins.top : 0),
        paddingBottom: 40 + ins.bottom, gap,
      }}
      keyboardShouldPersistTaps="handled">
      {children}
    </KeyboardAwareScrollView>
  );
}

export function Cabecera({ titulo, sub, derecha }: { titulo: string; sub?: string; derecha?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <H1>{titulo}</H1>
        {sub ? <Sub style={{ marginTop: 3 }}>{sub}</Sub> : null}
      </View>
      {derecha}
    </View>
  );
}

export function SubCabecera({ titulo, sub, onBack }: { titulo: string; sub?: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Btn icon="back" variant="ghost" size="sm" onPress={onBack} />
      <View style={{ flex: 1 }}>
        <H1 style={{ fontSize: 23, lineHeight: 26 }}>{titulo}</H1>
        {sub ? <Sub>{sub}</Sub> : null}
      </View>
    </View>
  );
}

/* ---------------- selector con hoja ---------------- */
export function Selector({ label, hint, valor, opciones, onChange, placeholder }: {
  label?: string; hint?: string; valor: string;
  opciones: { v: string; t: string; sub?: string }[];
  onChange: (v: string) => void; placeholder?: string;
}) {
  const t = useTheme();
  const [abierto, setAbierto] = useState(false);
  const sel = opciones.find(o => o.v === valor);
  return (
    <>
      <Field label={label} hint={hint}>
        <Pressable onPress={() => setAbierto(true)} style={{
          minHeight: 46, paddingHorizontal: 12, justifyContent: 'center', flexDirection: 'row',
          alignItems: 'center', gap: 8,
          backgroundColor: t.surface, borderWidth: 1, borderColor: t.lineStrong, borderRadius: 10,
        }}>
          <Text numberOfLines={1} style={{
            flex: 1, fontFamily: FONT.body, fontSize: 15.5, color: sel && sel.v ? t.text : t.muted,
          }}>{sel ? sel.t : (placeholder || 'Elegir')}</Text>
          <Icon name="down" size={15} color={t.muted} />
        </Pressable>
      </Field>
      <Sheet visible={abierto} title={label || 'Elegir'} onClose={() => setAbierto(false)}>
        <Card>
          {opciones.map((o, i) => (
            <Item key={o.v + i} last={i === opciones.length - 1}
              title={o.t} subs={[o.sub]} stripe={o.v === valor ? 'acc' : null}
              right={o.v === valor ? <Icon name="check" size={17} color={t.accent} /> : undefined}
              onPress={() => { onChange(o.v); setAbierto(false); }} />
          ))}
        </Card>
      </Sheet>
    </>
  );
}

/* ---------------- confirmación ---------------- */
export function Confirmar({ visible, titulo, mensaje, etiqueta, onCancel, onOk }: {
  visible: boolean; titulo?: string; mensaje: string; etiqueta?: string;
  onCancel: () => void; onOk: () => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible={visible} title={titulo || 'Confirmar'} onClose={onCancel}
      footer={
        <>
          <Btn label="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={onCancel} />
          <Btn label={etiqueta || 'Eliminar'} variant="danger" style={{ flex: 1 }} onPress={onOk} />
        </>
      }>
      <Text style={{ fontFamily: FONT.body, fontSize: 14.5, lineHeight: 21, color: t.text }}>{mensaje}</Text>
    </Sheet>
  );
}
