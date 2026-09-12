/* Datos precargados: puestos con sus directivas, plantillas de informe y catálogo. */
export type TurnoBase = { nombre: string; alias?: string; entrada: string; salida: string; dirs: string[][] };
export type PuestoBase = { n: string; d: string; turnos: TurnoBase[] };

export const PUESTOS_BASE: PuestoBase[] = [
  {
    n: 'Paseo', d: 'Control del paseo comercial: accesos, sectores comunes y perímetro.',
    turnos: [
      {
        nombre: 'Mañana', entrada: '06:00', salida: '14:00',
        dirs: [
          ['06:00', 'Recepción del puesto y relevo', 'Tomar novedades del turno noche y verificar precintos.'],
          ['06:15', 'Recorrida perimetral de apertura', 'Constatar el estado de los accesos antes de abrir.'],
          ['07:00', 'Apertura de accesos del paseo', 'Registrar cada apertura con su número de precinto.'],
          ['09:00', 'Informe de aperturas al CCTV', 'Generar desde Accesos y enviar por el grupo.'],
          ['11:00', 'Recorrida de sectores comunes', ''],
          ['13:45', 'Parte de relevo al turno tarde', 'Traspasar novedades pendientes.'],
        ],
      },
      {
        nombre: 'Tarde', entrada: '14:00', salida: '23:00',
        dirs: [
          ['14:00', 'Recepción del puesto y relevo', 'Tomar novedades del turno mañana.'],
          ['15:00', 'Recorrida de sectores comunes', ''],
          ['18:00', 'Control de iluminación y accesos', 'Reportar luminarias fuera de servicio.'],
          ['21:00', 'Inicio de cierre de accesos', 'Colocar precintos y registrar los números.'],
          ['22:30', 'Informe de cierres al CCTV', ''],
          ['22:45', 'Parte de relevo al turno noche', ''],
        ],
      },
      {
        nombre: 'Noche', alias: 'Rondín nocturno', entrada: '23:00', salida: '07:00',
        dirs: [
          ['23:15', 'Recepción del puesto y verificación de precintos', ''],
          ['23:30', 'Ronda perimetral', 'Marcar todos los puntos de control.'],
          ['01:30', 'Ronda interna', ''],
          ['03:30', 'Ronda perimetral', ''],
          ['05:30', 'Ronda de preapertura', 'Verificar precintos antes del relevo.'],
          ['06:45', 'Parte de relevo al turno mañana', ''],
        ],
      },
    ],
  },
  {
    n: 'Playa 1', d: 'Playa de estacionamiento: barreras, circulación y bicicletero.',
    turnos: [
      {
        nombre: 'Mañana', entrada: '10:00', salida: '22:00',
        dirs: [
          ['10:00', 'Recepción del puesto y relevo', ''],
          ['10:15', 'Apertura de barreras y control de tickets', 'Verificar funcionamiento del sistema.'],
          ['12:00', 'Recorrida de playa', 'Vehículos mal estacionados y objetos a la vista.'],
          ['16:00', 'Control de bicicletero de empleados', 'Registrar dominios.'],
          ['20:00', 'Control de iluminación', ''],
          ['21:45', 'Parte de relevo', ''],
        ],
      },
      {
        nombre: 'Noche', entrada: '23:00', salida: '07:00',
        dirs: [
          ['23:15', 'Recepción del puesto', 'Tomar novedades del turno anterior.'],
          ['00:00', 'Recorrida de playa', ''],
          ['02:30', 'Recorrida de playa', ''],
          ['05:00', 'Recorrida de playa', ''],
          ['06:45', 'Parte de relevo al turno mañana', ''],
        ],
      },
    ],
  },
  {
    n: 'Playa 2', d: 'Segunda playa de estacionamiento.',
    turnos: [
      {
        nombre: 'Tarde', entrada: '14:00', salida: '22:00',
        dirs: [
          ['14:00', 'Recepción del puesto y relevo', ''],
          ['16:00', 'Recorrida de playa', ''],
          ['19:00', 'Control de iluminación', ''],
          ['21:45', 'Cierre de playa y parte de relevo', 'Constatar que no queden vehículos.'],
        ],
      },
    ],
  },
  {
    n: 'Playa 2 Motero', d: 'Sector de motos y bicicletero de la playa 2.',
    turnos: [
      {
        nombre: 'Mañana', entrada: '05:00', salida: '14:00',
        dirs: [
          ['05:00', 'Recepción del puesto y apertura del sector', ''],
          ['05:30', 'Control de bicicletero y sector de motos', 'Registrar dominios de las motos resguardadas.'],
          ['08:30', 'Recorrida del sector', ''],
          ['12:00', 'Control de motos y credenciales', ''],
          ['13:45', 'Parte de relevo', ''],
        ],
      },
    ],
  },
  {
    n: 'Playa 3', d: 'Tercera playa de estacionamiento.',
    turnos: [
      {
        nombre: 'Tarde', entrada: '14:00', salida: '23:00',
        dirs: [
          ['14:00', 'Recepción del puesto y relevo', ''],
          ['17:00', 'Recorrida de playa', ''],
          ['20:00', 'Control de iluminación', ''],
          ['22:45', 'Cierre de playa y parte de relevo', 'Constatar que no queden vehículos.'],
        ],
      },
    ],
  },
];

export const PLANTILLAS = [
  {
    t: 'Resguardo de vehículo', crit: 'Baja',
    f: { 4: 'Resguardo de vehículo / Moto en bicicletero de empleados', 7: 'N/A - Resguardo preventivo de vehículo.', 8: 'Se registra el vehículo en el Informe general para su permanencia en el bicicletero de empleados. Se verifica documentación de la propietaria.', 10: 'N/A', 11: 'Guardia / Supervisor / Jefe de seguridad.', 12: 'En curso. Vehículo resguardado en bicicletero de empleados.', 13: 'Mantener en resguardo hasta su retiro. Verificar al momento del egreso.', 15: 'Datos del vehículo:\n- Marca: \n- Modelo: \n- Dominio: \n\nDatos del propietario:\n- Nombre: \n- DNI: \n- Locatario de: ', 16: 'El vehículo quedará estacionado en el sector de bicicletero de empleados hasta nuevo aviso.' }
  },
  {
    t: 'Hurto en local', crit: 'Media',
    f: { 4: 'Hurto en local comercial', 7: 'Faltante de mercadería. Sin lesionados.', 8: 'Se toma conocimiento por parte del personal del local. Se resguarda el sector, se solicita revisión de cámaras al CCTV y se labra acta en el Informe general.', 10: 'Policía (a confirmar según decisión del locatario).', 11: 'Guardia / Supervisor / Jefe de seguridad / Administración.', 12: 'En curso. Revisión de grabaciones en proceso.', 13: 'Obtener registro fílmico, identificar al autor y acompañar al locatario en la denuncia si correspondiere.', 15: 'Registro fílmico CCTV (cámara N° , horario aprox.).\nDeclaración del personal del local.', 16: 'Se recomienda reforzar la observación del sector en el horario del hecho.' }
  },
  {
    t: 'Intento de hurto detectado', crit: 'Media',
    f: { 4: 'Intento de hurto detectado / Prevención', 7: 'Sin faltante. Mercadería recuperada.', 8: 'Se detecta la maniobra por monitoreo CCTV. Se da aviso al personal del local y se aborda a la persona en la línea de cajas. Se recupera la mercadería.', 10: 'N/A', 11: 'Guardia / Supervisor CCTV / Jefe de seguridad.', 12: 'Finalizado. Mercadería reintegrada al local.', 13: 'Registrar el hecho y mantener seguimiento del sector.', 15: 'Registro fílmico CCTV.\nMercadería recuperada.', 16: 'Se retira a la persona del predio sin incidentes.' }
  },
  {
    t: 'Ingreso no autorizado', crit: 'Alta',
    f: { 4: 'Ingreso no autorizado a sector restringido', 7: 'Sector vulnerado. Sin daños ni faltantes constatados al momento.', 8: 'Se detecta el ingreso por CCTV / recorrida. Se procede a la identificación de la persona y a su retiro del sector. Se verifica el estado de puertas y precintos.', 10: 'N/A', 11: 'Guardia / Supervisor / Jefe de seguridad.', 12: 'Controlado. Sector verificado y asegurado.', 13: 'Revisar el control de accesos del sector y reforzar consigna.', 15: 'Registro fílmico CCTV.\nEstado de precintos verificado.', 16: '' }
  },
  {
    t: 'Merodeo / persona en situación de calle', crit: 'Baja',
    f: { 4: 'Merodeo en accesos / Persona en situación de calle', 7: 'N/A - Sin afectación a la operación.', 8: 'Se realiza observación preventiva y se dialoga con la persona solicitando su retiro del predio. Se da aviso al CCTV para seguimiento.', 10: 'N/A', 11: 'Guardia / Supervisor.', 12: 'Finalizado. La persona se retira del predio.', 13: 'Mantener observación del sector durante el turno.', 15: 'Registro fílmico CCTV.', 16: 'Se actúa con criterio preventivo y sin contacto físico.' }
  },
  {
    t: 'Disturbio o agresión', crit: 'Alta',
    f: { 4: 'Disturbio / Agresión entre particulares', 7: 'Alteración del orden en sector público del predio.', 8: 'Se interviene preventivamente separando a las partes y se resguarda la zona. Se solicita apoyo y se da aviso al CCTV para registro fílmico.', 10: 'Policía / SAME (según corresponda).', 11: 'Guardia / Supervisor / Jefe de seguridad / Administración.', 12: 'Controlado.', 13: 'Aguardar arribo de la autoridad si fue convocada y elevar registro fílmico.', 15: 'Registro fílmico CCTV.\nDatos de los involucrados.', 16: '' }
  },
  {
    t: 'Emergencia médica', crit: 'Alta',
    f: { 4: 'Emergencia médica', 7: 'Persona descompensada / lesionada dentro del predio.', 8: 'Se asiste a la persona, se despeja el sector y se solicita servicio de emergencias. Se acompaña hasta el arribo del móvil.', 10: 'Servicio de emergencias médicas.', 11: 'Guardia / Supervisor / Jefe de seguridad / Administración.', 12: 'En curso.', 13: 'Confirmar traslado y estado de la persona. Elevar informe ampliatorio.', 15: 'Datos de la persona asistida:\n- Nombre: \n- DNI: \n- Edad: \n\nHora de aviso al servicio:\nHora de arribo del móvil:', 16: '' }
  },
  {
    t: 'Principio de incendio / alarma', crit: 'Crítica',
    f: { 4: 'Activación de alarma de incendio', 7: 'Posible riesgo para personas y bienes. Evacuación preventiva del sector.', 8: 'Se verifica el punto de activación, se corta el suministro del sector si corresponde y se aplica el protocolo de evacuación. Se da aviso a la jefatura y a Bomberos.', 10: 'Bomberos / Defensa Civil.', 11: 'Guardia / Supervisor / Jefe de seguridad / Administración / Cliente.', 12: 'En curso.', 13: 'Aguardar verificación técnica y habilitación del sector antes del reingreso.', 15: 'Panel de alarma (zona N°).\nRegistro fílmico CCTV.', 16: '' }
  },
  {
    t: 'Corte de energía / falla técnica', crit: 'Media',
    f: { 4: 'Corte de energía eléctrica / Falla técnica', 7: 'Afectación parcial de iluminación y sistemas de seguridad.', 8: 'Se verifica el alcance del corte, se constata el funcionamiento del grupo electrógeno y se refuerza la observación física de los sectores sin cobertura de CCTV.', 10: 'Mantenimiento / Prestadora del servicio.', 11: 'Guardia / Supervisor / Mantenimiento / Jefe de seguridad.', 12: 'En curso.', 13: 'Mantener consigna reforzada hasta la normalización del suministro.', 15: 'Hora de inicio del corte:\nSectores afectados:', 16: '' }
  },
  {
    t: 'Daño o vandalismo', crit: 'Media',
    f: { 4: 'Daño a instalaciones / Vandalismo', 7: 'Daño material en instalaciones del predio.', 8: 'Se constata el daño, se resguarda el sector y se registra fotográficamente. Se da aviso a Mantenimiento y a la Administración.', 10: 'N/A', 11: 'Guardia / Supervisor / Mantenimiento / Administración.', 12: 'Informado a Mantenimiento.', 13: 'Reparación a cargo de Mantenimiento. Seguimiento hasta su normalización.', 15: 'Registro fotográfico del daño.\nRegistro fílmico CCTV.', 16: '' }
  },
  {
    t: 'Objeto extraviado / hallazgo', crit: 'Baja',
    f: { 4: 'Objeto extraviado / Hallazgo', 7: 'N/A', 8: 'Se recepciona el objeto, se registra en el Informe general y se resguarda en la oficina de seguridad a la espera de su titular.', 10: 'N/A', 11: 'Guardia / Supervisor.', 12: 'Objeto en resguardo.', 13: 'Entregar al titular previa acreditación de propiedad y firma de constancia.', 15: 'Descripción del objeto:\nLugar del hallazgo:\nQuien lo entrega:', 16: '' }
  },
  {
    t: 'Siniestro vehicular en playa', crit: 'Media',
    f: { 4: 'Siniestro vehicular en playa de estacionamiento', 7: 'Daños materiales entre vehículos. Sin lesionados.', 8: 'Se asiste a las partes, se resguarda el sector y se labra acta con los datos de ambos vehículos y conductores. Se solicita registro fílmico al CCTV.', 10: 'N/A', 11: 'Guardia / Supervisor / Administración.', 12: 'Finalizado en el lugar.', 13: 'Elevar registro fílmico si alguna de las partes lo solicita formalmente.', 15: 'Vehículo 1: marca / modelo / dominio / conductor / DNI\nVehículo 2: marca / modelo / dominio / conductor / DNI\nRegistro fílmico CCTV.', 16: 'Las partes intercambian datos de seguro en el lugar.' }
  },
  {
    t: 'Falla de CCTV o sistema', crit: 'Alta',
    f: { 4: 'Falla en sistema de CCTV / Control de accesos', 7: 'Pérdida parcial de cobertura de monitoreo.', 8: 'Se constata la falla, se informa al CCTV y a la jefatura, y se refuerza la recorrida física de los sectores sin cobertura.', 10: 'Servicio técnico.', 11: 'Guardia / Supervisor CCTV / Jefe de seguridad.', 12: 'En curso. Consigna reforzada.', 13: 'Seguimiento del servicio técnico hasta la normalización del sistema.', 15: 'Cámaras / sectores afectados:\nHora de detección:', 16: '' }
  },
  {
    t: 'Retiro de mercadería fuera de horario', crit: 'Baja',
    f: { 4: 'Retiro de mercadería fuera de horario', 7: 'N/A - Movimiento autorizado.', 8: 'Se verifica la autorización correspondiente, se controla la mercadería declarada y se registra el egreso en el Informe general.', 10: 'N/A', 11: 'Guardia / Supervisor.', 12: 'Finalizado.', 13: 'Archivar la autorización junto al parte del turno.', 15: 'Autorización N°:\nDetalle de la mercadería:\nVehículo / dominio:\nResponsable del retiro:', 16: '' }
  },
  {
    t: 'Alarma activada sin novedad', crit: 'Baja',
    f: { 4: 'Activación de alarma sin novedad', 7: 'N/A - Sin afectación.', 8: 'Se concurre al punto de activación, se verifica el sector y no se constatan novedades. Se repone el sistema y se informa al CCTV.', 10: 'N/A', 11: 'Guardia / Supervisor CCTV.', 12: 'Finalizado. Sistema repuesto.', 13: 'Informar a Mantenimiento si la activación se repite.', 15: 'Panel / zona de activación:\nHora de activación y de verificación:', 16: 'Probable activación por falsa alarma.' }
  }
];


export const ACCESOS_BASE = ['Portón ingreso Oroño', 'Portón egreso Oroño', 'Portón ingreso Battle Ordóñez', 'Portón egreso Battle Ordóñez',
    'Portón peatonal', 'Portón Ombú', 'Puerta acceso Bar Cup', 'Pecera 1', 'Pecera 2',
    'Puerta E1 - ADM E1', 'Puerta E2 y E2 Bis', 'Puerta E8'];

export const CONTACTOS_BASE = [
  ['CCTV', 'Central de monitoreo', ''], ['Supervisor', 'Supervisión de turno', ''],
  ['Jefe de seguridad', 'Jefatura', ''], ['Policía', 'Emergencias', '911'],
  ['Bomberos', 'Emergencias', '100'], ['Emergencia médica', 'Salud', '107'],
];
export const RONDA_BASE = {
  nombre: 'Ronda perimetral',
  puntos: ['Portón ingreso Oroño', 'Portón egreso Oroño', 'Portón Ombú', 'Portón peatonal',
    'Bicicletero de empleados', 'Sector de carga y descarga', 'Pecera 1', 'Pecera 2'],
};
export const CATEGORIAS = ['Novedad', 'Ingreso/Egreso', 'Adicional', 'Externos', 'Recorrido', 'Apertura', 'Cierre'];

/* Dotación del objetivo. Se precarga para poder elegir quién hizo cada
   apertura o cierre sin tener que darlos de alta uno por uno. */
export const VIGILADORES_BASE: [string, string][] = [
  ['Bevacua', 'Franco'],
  ['Cantero', 'Néstor'],
  ['Mansilla', 'Diego'],
  ['Esteban', 'Brian'],
  ['Cuevas', 'Gustavo'],
  ['Arredondo', 'Elías'],
  ['Homeluk', 'Pablo'],
  ['Pelaz', 'Adrián'],
  ['Villarroel', 'Sebastián'],
  ['Fernández', 'Magalí'],
  ['Robledo', 'Uriel'],
];
