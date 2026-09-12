import React from 'react';
import {useStore} from '../store';
import {Selector} from '../ui';
import {apellidoNombre} from '../reporte';
export default function SelectorFirma({valor,onChange}:{valor:string;onChange:(id:string)=>void}){
 const st=useStore();
 return <Selector label="Vigilador que realizó la novedad" valor={valor} onChange={onChange}
 opciones={[{v:'',t:'Seleccione el vigilador'},...st.S.guards.filter(g=>!g.deleted).sort((a,b)=>apellidoNombre(a.apellido,a.nombre).localeCompare(apellidoNombre(b.apellido,b.nombre),'es')).map(g=>({v:g.id,t:apellidoNombre(g.apellido,g.nombre)}))]}/>;
}
