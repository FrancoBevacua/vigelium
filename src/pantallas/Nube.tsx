import React,{useState} from 'react';
import {View,ActivityIndicator} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useStore} from '../store';
import {Card,Stack,Input,Btn,Hint,Eyebrow,Banner,Row,useTheme} from '../ui';

export default function ConfigurarNube(){
 const st=useStore();const [ocupado,setOcupado]=useState(false);const [error,setError]=useState('');
 return <Card pad><Stack gap={12}><Eyebrow>Base de datos en la nube</Eyebrow>
  {st.nube.vinculada ? <>
   <Hint>Teléfono vinculado a la nube corporativa. Los registros y las evidencias se guardan cifrados. El acceso requiere DNI y PIN.</Hint>
   <Hint>{st.nube.pendiente?'Hay cambios pendientes de sincronizar.':st.nube.ultima?'Última confirmación: '+new Date(st.nube.ultima).toLocaleString():'La información se consulta al iniciar sesión.'}</Hint>
   <Btn label={ocupado?'Sincronizando…':'Sincronizar ahora'} disabled={ocupado||st.nube.guardando} onPress={async()=>{setOcupado(true);setError('');try{await st.reintentarNube();}catch(e:any){setError(e.message);}finally{setOcupado(false);}}} />
  </> : <>
   <Hint>La conexión corporativa se realiza automáticamente al iniciar sesión. Cree su cuenta con DNI y PIN. El rol de administrador se asigna desde la base de datos, sin impedir el registro ni el ingreso.</Hint>
  </>}
  {error ? <Banner kind="warn">{error}</Banner>:null}
 </Stack></Card>;
}
export function EstadoSincronizacion(){
 const st=useStore();const t=useTheme();const ins=useSafeAreaInsets();const [error,setError]=useState('');const [pin,setPin]=useState('');const [renovando,setRenovando]=useState(false);
 if(!st.me||(!st.errorGuardado&&(!st.nube.vinculada||(!st.nube.guardando&&!st.nube.pendiente&&!st.nube.error&&!error))))return null;
 return <View style={{paddingHorizontal:12,paddingTop:ins.top+6,paddingBottom:7,backgroundColor:t.surface,borderBottomWidth:1,borderBottomColor:t.line}}>
  <Row>{st.nube.guardando?<ActivityIndicator color={t.accent}/>:null}<View style={{flex:1}}><Hint>{st.errorGuardado||(st.nube.guardando?'Sincronizando con la nube…':st.nube.error||error||'Guardado en el teléfono. Pendiente de sincronizar.')}</Hint></View>
  {!st.nube.guardando&&!st.nube.reautenticar?<Btn label="Reintentar" size="xs" onPress={async()=>{setError('');try{await st.reintentarNube();}catch(e:any){setError(e.message);}}}/>:null}</Row>
  {st.nube.reautenticar?<Stack gap={8}><Input label="Su PIN para renovar la sesión" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" maxLength={6}/><Btn label={renovando?'Verificando…':'Renovar sesión'} disabled={renovando} onPress={async()=>{setRenovando(true);setError('');try{await st.ingresarNube(st.me!.dni!,pin);setPin('');}catch(e:any){setError(e.message);}finally{setRenovando(false);}}}/></Stack>:null}
 </View>;
}
