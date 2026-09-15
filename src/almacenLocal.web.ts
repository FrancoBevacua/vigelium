import AsyncStorage from '@react-native-async-storage/async-storage';
// La web mantiene su adaptador; SQLite nativo no entra en el bundle del navegador.
export const almacenLocal = AsyncStorage;
