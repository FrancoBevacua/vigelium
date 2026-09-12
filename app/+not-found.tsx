import React from 'react';
import { Redirect } from 'expo-router';

/* Cualquier ruta desconocida (por ejemplo al servir la app en un subdirectorio)
   entra igual a la pantalla principal. */
export default function NoEncontrada() {
  return <Redirect href="/" />;
}
