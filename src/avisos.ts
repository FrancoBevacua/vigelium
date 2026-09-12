/* Recordatorios de directivas: un aviso 10 minutos antes y otro en el horario.
   Se programan localmente en el teléfono, así suenan aunque la app esté cerrada. */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Estado, Vigilador, addDays, isoDate, parseISO, toMin } from './model';
import { directivasDeHoy, dlogDe, franjaPorId } from './logic';

export const ANTICIPO_MIN = 10;
const CANAL = 'directivas';
const DIAS_PROGRAMADOS = 2;   // hoy y mañana: alcanza y no satura el límite de iOS

let handlerListo = false;
export function prepararAvisos() {
  if (handlerListo || Platform.OS === 'web') return;
  handlerListo = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function permisoAvisos(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const actual = await Notifications.getPermissionsAsync();
    let concedido = actual.granted;
    if (!concedido && actual.canAskAgain !== false) {
      const pedido = await Notifications.requestPermissionsAsync();
      concedido = pedido.granted;
    }
    if (concedido && Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: 'Directivas del turno',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
      });
    }
    return concedido;
  } catch (e) {
    console.warn('No se pudieron pedir los permisos de aviso', e);
    return false;
  }
}

/** Reprograma todos los recordatorios. Devuelve cuántos quedaron activos. */
export async function reprogramarAvisos(S: Estado, me: Vigilador | null, activo: boolean): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch { return 0; }
  if (!activo || !me) return 0;

  const ahora = Date.now();
  const fr = franjaPorId(S, me.franjaId);
  let programados = 0;

  for (let dia = 0; dia < DIAS_PROGRAMADOS; dia++) {
    const fecha = addDays(isoDate(), dia);
    const base = parseISO(fecha);
    const directivas = directivasDeHoy(S, me, fecha);

    for (const d of directivas) {
      const min = toMin(d.hora);
      if (min < 0) continue;
      if (dia === 0 && dlogDe(S, fecha, d.id)) continue;   // ya registrada hoy

      const cuando = new Date(base);
      cuando.setHours(Math.floor(min / 60), min % 60, 0, 0);

      const avisos: { date: Date; titulo: string }[] = [
        { date: new Date(cuando.getTime() - ANTICIPO_MIN * 60000), titulo: 'En ' + ANTICIPO_MIN + ' minutos · ' + d.hora },
        { date: cuando, titulo: 'Ahora · ' + d.hora },
      ];

      for (const a of avisos) {
        if (a.date.getTime() <= ahora + 5000) continue;
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: a.titulo,
              body: d.nombre + (d.novedades ? '\n' + d.novedades : ''),
              subtitle: fr ? (fr.alias || fr.nombre) : undefined,
              data: { directivaId: d.id, fecha },
              sound: 'default',
              ...(Platform.OS === 'android' ? { channelId: CANAL } : null),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.date },
          });
          programados++;
        } catch (e) {
          console.warn('No se pudo programar un aviso', e);
        }
      }
    }
  }
  return programados;
}

export async function avisosPendientes(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  try { return (await Notifications.getAllScheduledNotificationsAsync()).length; }
  catch { return 0; }
}
