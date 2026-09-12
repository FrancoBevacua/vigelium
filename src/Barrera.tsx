/* Barrera de errores.
   Sin esto, cualquier excepción durante el render desmonta el árbol entero y la
   app se cierra sola en release. Acá el error queda contenido: se muestra, se
   puede copiar y se puede volver a intentar sin perder los datos guardados. */
import React from 'react';
import { View, Text, ScrollView, Pressable, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const AZUL = '#0B1F3A';

type Props = { children: React.ReactNode; onReset?: () => void };
type State = { error: Error | null; info: string };

export class Barrera extends React.Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // en release no hay consola a la vista, pero sirve con el cable conectado
    console.error('VIGELIUM — error atrapado por la barrera', error, info?.componentStack);
    this.setState({ info: String(info?.componentStack || '').slice(0, 1500) });
  }

  reintentar = () => {
    this.setState({ error: null, info: '' });
    this.props.onReset?.();
  };

  copiar = async () => {
    const e = this.state.error;
    const t = [
      'VIGELIUM — error',
      Platform.OS + ' ' + String(Platform.Version),
      e?.message || '',
      e?.stack || '',
      this.state.info,
    ].join('\n\n');
    try { await Clipboard.setStringAsync(t); } catch { }
  };

  render() {
    const e = this.state.error;
    if (!e) return this.props.children as any;

    return (
      <View style={{ flex: 1, backgroundColor: AZUL, padding: 24, paddingTop: 64 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '700', marginBottom: 6 }}>
          Se cortó la pantalla
        </Text>
        <Text style={{ color: '#9DB2CC', fontSize: 13.5, lineHeight: 20, marginBottom: 16 }}>
          Sus datos están guardados; no se perdió nada. Puede volver a entrar. Si vuelve a
          pasar, copie el detalle y mandámelo.
        </Text>

        <ScrollView style={{
          maxHeight: 260, backgroundColor: '#0A1729', borderRadius: 10, padding: 12,
          borderWidth: 1, borderColor: '#1B3050',
        }}>
          <Text selectable style={{ color: '#C7D6E8', fontSize: 11.5, lineHeight: 17 }}>
            {(e.message || 'Error sin mensaje') + '\n\n' + (e.stack || '')}
          </Text>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <Pressable onPress={this.reintentar} style={{
            flex: 1, backgroundColor: '#D9453F', paddingVertical: 14, borderRadius: 10,
            alignItems: 'center',
          }}>
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Volver a entrar</Text>
          </Pressable>
          <Pressable onPress={this.copiar} style={{
            flex: 1, borderWidth: 1, borderColor: '#2A4166', paddingVertical: 14,
            borderRadius: 10, alignItems: 'center',
          }}>
            <Text style={{ color: '#C7D6E8', fontWeight: '600', fontSize: 14 }}>Copiar detalle</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

export default Barrera;
