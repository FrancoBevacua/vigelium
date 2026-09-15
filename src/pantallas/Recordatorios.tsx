import React,{useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Linking,Platform} from 'react-native';
import {router,useFocusEffect} from 'expo-router';
import * as Calendar from 'expo-calendar/legacy';
import {useStore} from '../store';
import {almacenLocal} from '../almacenLocal';
import {isoDate,hhmm,dmy,addDays} from '../model';
import {calendariosDisponibles,DatosRecordatorio,eliminarRecordatorio,esRecordatorio,guardarRecordatorio,marcaRecordatorio} from '../recordatorios';
import {Pantalla,SubCabecera,Card,Hint,Banner,Btn,Selector,Sheet,Input,Chipbar,Chip,Field,Item,Empty,Confirmar,useToast} from '../ui';

export default function Recordatorios(){
  const st=useStore(),toast=useToast(),guardia=st.me?.id||'';
  const [calendarios,setCalendarios]=useState<Calendar.Calendar[]>([]),[elegido,setElegido]=useState('');
  const [eventos,setEventos]=useState<Calendar.Event[]>([]),[conectado,setConectado]=useState(false);
  const [cargando,setCargando]=useState(false),[ocupado,setOcupado]=useState(false),[error,setError]=useState('');
  const [abierto,setAbierto]=useState(false),[editar,setEditar]=useState<Calendar.Event|null>(null),[borrar,setBorrar]=useState(false);
  const [datos,setDatos]=useState<DatosRecordatorio>({titulo:'',notas:'',fecha:isoDate(),hora:hhmm(),minutosAviso:15});
  const eleccion=useRef(''),version=useRef(0),operando=useRef(false);
  const cambiar=(v:Partial<DatosRecordatorio>)=>setDatos(d=>({...d,...v}));
  const clave='vigelium.calendario.'+guardia;
  const cargar=useCallback(async(pedir=false)=>{
    if(Platform.OS==='web')return;
    const n=++version.current;setCargando(true);setError('');
    try{
      const permiso=pedir?await Calendar.requestCalendarPermissionsAsync():await Calendar.getCalendarPermissionsAsync();
      if(n!==version.current)return;
      setConectado(permiso.granted);
      if(!permiso.granted){setEventos([]);if(pedir)setError('Habilite el permiso de calendario para ver y guardar sus recordatorios.');return;}
      const cs=await calendariosDisponibles(),anterior=eleccion.current||await almacenLocal.getItem(clave);
      if(n!==version.current)return;
      setCalendarios(cs);const id=cs.find(c=>c.id===anterior)?.id||cs[0]?.id||'';
      setElegido(id);eleccion.current=id;
      const todos=cs.length?await Calendar.getEventsAsync(cs.map(c=>c.id),new Date(addDays(isoDate(),-30)+'T00:00:00'),new Date(addDays(isoDate(),366)+'T00:00:00')):[];
      if(n===version.current)setEventos(todos.filter(e=>esRecordatorio(e.notes,guardia)).sort((a,b)=>new Date(a.startDate).getTime()-new Date(b.startDate).getTime()));
    }catch(e:any){if(n===version.current)setError(e.message||'No se pudo leer el calendario.');}
    finally{if(n===version.current)setCargando(false);}
  },[guardia,clave]);
  useFocusEffect(useCallback(()=>{void cargar();return()=>{version.current++;};},[cargar]));
  useEffect(()=>{const sub=AppState.addEventListener('change',s=>{if(s==='active')void cargar();});return()=>sub.remove();},[cargar]);
  const abrir=(e:Calendar.Event|null)=>{
    setEditar(e);setError('');setBorrar(false);
    const inicio=e?new Date(e.startDate):new Date(Date.now()+30*60000);
    setDatos({titulo:e?.title||'',notas:(e?.notes||'').split('\n').filter(l=>l!==marcaRecordatorio(guardia)).join('\n').trim(),fecha:isoDate(inicio),hora:hhmm(inicio),minutosAviso:e?Math.max(0,-(e.alarms?.[0]?.relativeOffset??0)):15});setAbierto(true);
  };
  const guardar=async()=>{
    if(operando.current)return;operando.current=true;setOcupado(true);setError('');
    try{await guardarRecordatorio(editar?.calendarId||elegido,datos,guardia,editar?.id);setAbierto(false);toast('Recordatorio guardado en el calendario');await cargar();}
    catch(e:any){setError(e.message||'No se pudo guardar el recordatorio.');}
    finally{operando.current=false;setOcupado(false);}
  };
  const quitar=async()=>{
    if(!editar||operando.current)return;operando.current=true;setOcupado(true);
    try{await eliminarRecordatorio(editar.id,guardia);setBorrar(false);setAbierto(false);toast('Recordatorio eliminado del calendario');await cargar();}
    catch(e:any){setBorrar(false);setError(e.message||'No se pudo eliminar.');}
    finally{operando.current=false;setOcupado(false);}
  };
  return <Pantalla top>
    <SubCabecera titulo="Recordatorios" sub="Avisos del servicio en el calendario de su teléfono." onBack={()=>router.back()}/>
    {Platform.OS==='web'?<Banner kind="info">Abra esta sección en la app del celular para conectar su calendario.</Banner>:<>
    {!conectado?<Card pad><Hint>Permita el acceso para elegir un calendario de Google o del teléfono y guardar avisos.</Hint><Btn label={cargando?'Conectando…':'Conectar calendario'} disabled={cargando} onPress={()=>cargar(true)}/><Btn label="Abrir permisos del teléfono" variant="ghost" onPress={()=>Linking.openSettings()}/></Card>:<>
      <Card pad>
        {calendarios.length?<Selector label="Calendario para nuevos recordatorios" valor={elegido} onChange={id=>{setElegido(id);eleccion.current=id;void almacenLocal.setItem(clave,id).catch(()=>setError('No se pudo recordar el calendario elegido.'));}} opciones={calendarios.map(c=>({v:c.id,t:c.title+' · '+(c.ownerAccount||c.source?.name||'En este teléfono')}))}/>:<Hint>No hay calendarios que permitan guardar eventos. Agregue una cuenta en la app Calendario del teléfono y vuelva a actualizar.</Hint>}
        <Hint>Google sincroniza los eventos si el calendario elegido pertenece a esa cuenta y su sincronización está activada. Un calendario local guarda los avisos sólo en el teléfono.</Hint>
        <Btn label="Nuevo recordatorio" icon="plus" disabled={!elegido||cargando} onPress={()=>abrir(null)}/>
        <Btn label={cargando?'Actualizando…':'Actualizar desde el calendario'} variant="ghost" disabled={cargando} onPress={()=>cargar()}/>
      </Card>
      <Hint>Sus recordatorios de los últimos 30 días y los próximos 12 meses. Los cambios hechos en Calendario se actualizan al volver a esta pantalla.</Hint>
      <Card>{eventos.length?eventos.map((e,i)=><Item key={e.id} title={e.title} subs={[dmy(isoDate(new Date(e.startDate)))+' · '+hhmm(new Date(e.startDate)),calendarios.find(c=>c.id===e.calendarId)?.title]} last={i===eventos.length-1} onPress={()=>abrir(e)}/>):<Empty>{cargando?'Consultando recordatorios…':'Todavía no tiene recordatorios en este período.'}</Empty>}</Card>
    </>}
    {error&&!abierto?<Banner kind="warn">{error}</Banner>:null}
    <Sheet visible={abierto} title={editar?'Editar recordatorio':'Nuevo recordatorio'} onClose={()=>{if(!ocupado)setAbierto(false);}} footer={<><Btn label={ocupado?'Guardando…':'Guardar en calendario'} disabled={ocupado} onPress={guardar}/>{editar?<Btn label="Eliminar" variant="danger" disabled={ocupado} onPress={()=>setBorrar(true)}/>:null}</>}>
      <Input label="Título" value={datos.titulo} onChangeText={titulo=>cambiar({titulo})} maxLength={160}/>
      <Input label="Fecha" value={datos.fecha} onChangeText={fecha=>cambiar({fecha})} placeholder="AAAA-MM-DD" mono/>
      <Input label="Hora" value={datos.hora} onChangeText={hora=>cambiar({hora})} placeholder="HH:MM" mono/>
      <Field label="Avisarme"><Chipbar>{[0,5,15,30,60].map(m=><Chip key={m} label={m?m+' min antes':'A la hora'} on={datos.minutosAviso===m} onPress={()=>cambiar({minutosAviso:m})}/>)}</Chipbar></Field>
      <Input label="Notas" value={datos.notas} onChangeText={notas=>cambiar({notas})} multiline rows={4}/>
      <Hint>El calendario del teléfono emitirá el aviso. El evento dura 15 minutos.</Hint>
      {error?<Banner kind="warn">{error}</Banner>:null}
      <Confirmar visible={borrar} mensaje="¿Eliminar este recordatorio del calendario? Se eliminará también en la cuenta sincronizada." onCancel={()=>setBorrar(false)} onOk={quitar}/>
    </Sheet>
    </>}
  </Pantalla>;
}
