import React,{useEffect,useState,useRef} from 'react';
import {View,Text,Image} from 'react-native';
import {useStore} from '../store';
import {Novedad,Vigilador,Acceso,accNormal,hhmm,isoDate,addDays,toMin,uid,dmy,personasReales} from '../model';
import {CATEGORIAS_REPORTE,DatosAsiento,redactarAsiento,categoriaAsiento,apellidoNombre} from '../reporte';
import {gsName,novTextoCompleto} from '../text';
import {motivoSoloLectura,turnoAbierto,horaValida,fechaValida} from '../servicio';
import {Sheet,Input,Field,Chipbar,Chip,Row,Btn,Selector,Seg,Hint,Banner,Confirmar,useTheme,useToast} from '../ui';
import ServicioActual from './ServicioActual';
import BloqueAcceso from './BloqueAcceso';
import Dictado from './Dictado';
import RedaccionIA from './RedaccionIA';
import SelectorFirma from './SelectorFirma';
import {dentro} from '../informedia';

export function EditorNovedad({abierto,novedad,fecha,corte,duracion=24,onClose}:{abierto:boolean;novedad:Novedad|null;fecha:string;corte?:string;duracion?:12|24;onClose:()=>void}){
 const st=useStore(),t=useTheme(),toast=useToast();
 const [categoria,setCategoria]=useState('Novedad'),[datos,setDatos]=useState<DatosAsiento>({}),[texto,setTexto]=useState<string|null>(null);
 const [dia,setDia]=useState(fecha),[hora,setHora]=useState(hhmm()),[acc,setAcc]=useState<Acceso>(accNormal());
 const [error,setError]=useState(''),[borrar,setBorrar]=useState(false);
 const [firma,setFirma]=useState('');
 const [guardando,setGuardando]=useState(false);const idNuevo=useRef(uid());
 const motivo=novedad?motivoSoloLectura(st.S,novedad,st.me?.id):'';const sinTurno=!turnoAbierto(st.S,st.me?.id);
 useEffect(()=>{if(!abierto)return;const cat=novedad?categoriaAsiento(novedad):'NOVEDAD';
  setCategoria(cat==='INGRESO'||cat==='EGRESO'?'Ingreso/Egreso':cat==='EXTERNO'?'Externos':cat.charAt(0)+cat.slice(1).toLowerCase());
  setDatos(novedad?.datos||{movimiento:cat==='EGRESO'?'egreso':'ingreso',puestoId:st.me?.puestoId,lugar:'el paseo'});
  setFirma(novedad?.guardId||'');setTexto(novedad?.texto??null);setAcc(accNormal(novedad?.acc));const h=novedad?.hora||hhmm();setHora(h);
  const pertenece=!corte||dentro({fecha,corte,duracion},isoDate(),h);
  setDia(novedad?.fecha||(corte&&pertenece?isoDate():fecha));if(!novedad&&!pertenece)setHora('');
  idNuevo.current=novedad?.id||uid();setError('');setBorrar(false);setGuardando(false);
 },[abierto,novedad?.id,fecha,corte,duracion]);
 const cambiar=(v:Partial<DatosAsiento>)=>{setDatos(d=>({...d,...v}));setTexto(null);};
 const puesto=st.S.posts.find(p=>p.id===datos.puestoId)?.nombre||'';
 const cuerpo=texto??redactarAsiento(categoria,datos,acc,puesto);
 const guardar=async()=>{if(guardando)return;setGuardando(true);try{
  if(!fechaValida(dia)||!horaValida(hora))throw Error('Revise la fecha (AAAA-MM-DD) y la hora (HH:MM).');
  if(corte&&!dentro({fecha,corte,duracion},dia,hora))throw Error('La fecha y la hora deben pertenecer al período de '+duracion+' horas del informe.');
  if(!novedad||novedad.datos){
   if(['Ingreso/Egreso','Adicional'].includes(categoria)){
    if(!datos.apellido?.trim()||!datos.nombre?.trim())throw Error('Complete apellido y nombre en sus campos correspondientes.');
    if(datos.movimiento!=='egreso'&&(!datos.turno?.trim()||(categoria==='Ingreso/Egreso'&&!puesto)))throw Error('Complete el puesto y el turno del ingreso.');
   }
   if(categoria==='Externos'&&!acc.empresa&&!personasReales(acc).length)throw Error('Ingrese la firma o los datos de la persona externa.');
   if(['Apertura','Cierre'].includes(categoria)&&!datos.acceso?.trim())throw Error('Seleccione o indique el acceso.');
  }
  if(!cuerpo.trim())throw Error('Ingrese la descripción de la novedad.');
  st.put('novedades',{...novedad,id:idNuevo.current,fecha:dia,hora,guardId:firma,
   categoria:categoria==='Ingreso/Egreso'?(datos.movimiento==='egreso'?'Egreso':'Ingreso'):categoria==='Externos'?'Externo':categoria,
   datos,texto:cuerpo.trim(),acc:categoria==='Externos'?acc:null,
   origenTipo:categoria==='Ingreso/Egreso'?'guardia':categoria==='Adicional'?'policial':categoria==='Recorrido'?'recorrido':novedad?.origenTipo==='libro-foto'?'libro-foto':undefined});
  await st.confirmarGuardado();
  onClose();toast('Registro guardado en el teléfono');
 }catch(e:any){setError(e.message);}finally{setGuardando(false);}};
 if(novedad&&motivo)return <Sheet visible={abierto} title="Registro · Solo lectura" onClose={onClose}>
  <Banner kind="info">{motivo}</Banner><Hint>{dmy(novedad.fecha)+' · '+novedad.hora+' · '+gsName(st.byId<Vigilador>('guards',novedad.guardId),st.S.site)}</Hint>
  <Text selectable style={{color:t.text,fontSize:15,lineHeight:23}}>{novTextoCompleto(novedad)}</Text>
  {novedad.fotos?.map(uri=><Image key={uri} source={{uri}} style={{width:'100%',height:240,resizeMode:'contain'}}/>)}</Sheet>;
 return <Sheet visible={abierto} title={novedad?'Editar registro':'Nueva novedad'} onClose={()=>{if(!guardando)onClose();}} footer={<>
  {novedad?<Btn icon="trash" variant="danger" disabled={sinTurno} onPress={()=>setBorrar(true)}/>:null}
  <Btn label={guardando?'Guardando…':'Guardar'} variant="primary" disabled={sinTurno||guardando} style={{flex:1}} onPress={guardar}/></>}>
  {sinTurno?<ServicioActual/>:null}
  <SelectorFirma valor={firma} onChange={setFirma}/>
  <Field label="Categoría"><Chipbar>{CATEGORIAS_REPORTE.map(c=><Chip key={c} label={c} on={categoria===c} onPress={()=>{setCategoria(c);setTexto(null);setError('');}}/>)}</Chipbar></Field>
  <Row><View style={{flex:1}}><Input label="Fecha" value={dia} onChangeText={setDia} placeholder="AAAA-MM-DD" mono/></View>
   <View style={{flex:1}}><Input label="Horario" value={hora} onChangeText={h=>{setHora(h);if(!novedad&&corte&&horaValida(h))setDia(h<corte?addDays(fecha,1):fecha);}} placeholder="HH:MM" mono/></View></Row>
  {!novedad&&corte?<Hint>Indique la hora real del hecho. La fecha se calcula dentro del período seleccionado; revise ambos datos antes de guardar.</Hint>:null}
  {['Ingreso/Egreso','Adicional','Externos'].includes(categoria)?<Seg valor={datos.movimiento||'ingreso'} onChange={v=>cambiar({movimiento:v as any})} opciones={[{v:'ingreso',t:'Ingreso'},{v:'egreso',t:'Egreso'}]}/>:null}
  {['Ingreso/Egreso','Adicional'].includes(categoria)?<>
   {categoria==='Ingreso/Egreso'?<Selector label="Vigilador del equipo" valor="" onChange={id=>{const g=st.byId<Vigilador>('guards',id);if(g){const f=st.S.franjas.find(x=>x.id===g.franjaId);cambiar({apellido:g.apellido,nombre:g.nombre,puestoId:g.puestoId,turno:f?f.entrada+'-'+f.salida:''});}}} opciones={[{v:'',t:'Seleccionar o completar los datos'},...st.list<Vigilador>('guards').map(g=>({v:g.id,t:apellidoNombre(g.apellido,g.nombre)}))]}/>:null}
   <Input label="Apellido" value={datos.apellido||''} onChangeText={apellido=>cambiar({apellido})}/><Input label="Nombre" value={datos.nombre||''} onChangeText={nombre=>cambiar({nombre})}/>
   {datos.movimiento!=='egreso'?<>{categoria==='Ingreso/Egreso'?<Selector label="Puesto" valor={datos.puestoId||''} onChange={puestoId=>cambiar({puestoId})} opciones={st.S.posts.filter(p=>!p.deleted).map(p=>({v:p.id,t:p.nombre}))}/>:null}<Input label="Turno" value={datos.turno||''} onChangeText={turno=>cambiar({turno})} placeholder="09:00-16:00"/></>:null}
  </>:null}
  {categoria==='Externos'?<><Selector label="Tipo de externo" valor={datos.tipoExterno||'Visita'} onChange={tipoExterno=>cambiar({tipoExterno})} opciones={['Proveedor','Contratista','Visita','Empleado','Locatario'].map(v=>({v,t:v}))}/><BloqueAcceso valor={acc} onChange={a=>{setAcc(a);setTexto(null);}}/></>:null}
  {categoria==='Recorrido'?<><Input label="Sector del recorrido" value={datos.lugar||'el paseo'} onChangeText={lugar=>cambiar({lugar})}/><Input label="Observaciones (si las hubiera)" value={datos.observaciones||''} onChangeText={observaciones=>cambiar({observaciones})} multiline rows={3} fixedHeight/></>:null}
  {['Apertura','Cierre'].includes(categoria)?<><Selector label="Acceso del catálogo" valor={datos.acceso||''} onChange={acceso=>cambiar({acceso})} opciones={[{v:'',t:'Seleccionar acceso'},...st.S.accesses.filter(a=>!a.deleted).map(a=>({v:a.nombre,t:a.nombre}))]}/><Input label="Nombre del acceso" value={datos.acceso||''} onChangeText={acceso=>cambiar({acceso})}/></>:null}
  <Input label="Descripción del registro" value={cuerpo} onChangeText={setTexto} multiline rows={6} fixedHeight placeholder="Describa el hecho, el lugar y las medidas adoptadas."/>
  <Dictado enabled={abierto&&!sinTurno} onTexto={v=>setTexto((cuerpo.trim()?cuerpo.trim()+' ':'')+v)}/>
  <RedaccionIA texto={cuerpo} categoria={categoria} onTexto={setTexto} disabled={sinTurno}/>
  {error?<Banner kind="warn">{error}</Banner>:null}
  <Confirmar visible={borrar} mensaje="¿Eliminar este registro del Informe general?" onCancel={()=>setBorrar(false)} onOk={()=>{try{if(novedad){if(st.byId('novedades',novedad.id))st.drop('novedades',novedad.id);else st.put('novedades',{...novedad,deleted:true});}setBorrar(false);onClose();}catch(e:any){setError(e.message);setBorrar(false);}}}/>
 </Sheet>;
}
