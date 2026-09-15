require('./register.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),Module=require('node:module'),React=require('react');
const {create,act}=require('react-test-renderer');global.IS_REACT_ACT_ENVIRONMENT=true;
const {estadoVacio}=require('../src/model.ts'),servicio=require('../src/servicio.ts');
const guardia={id:'a',nombre:'Ana',apellido:'Prueba'},S=estadoVacio();S.guards=[guardia];
let confirmar=async()=>{},cerrados=0;const guardados=[],avisos=[];
const store={S,me:guardia,put:(c,r)=>guardados.push(r),confirmarGuardado:()=>confirmar(),byId:()=>undefined,list:()=>[]};
const load=Module._load;
Module._load=function(n,...a){
 if(n==='react-native')return{View:'View',Text:'Text',Image:'Image',Platform:{OS:'android'}};
 if(n==='../store')return{useStore:()=>store};
 if(n==='../servicio')return{...servicio,turnoAbierto:()=>({id:'turno'}),motivoSoloLectura:()=>''};
 if(n==='../ui')return{useTheme:()=>({}),useToast:()=>s=>avisos.push(s),...Object.fromEntries(['Sheet','Input','Field','Chipbar','Chip','Row','Btn','Selector','Seg','Hint','Banner','Confirmar'].map(x=>[x,p=>React.createElement(x,p,p.children,p.footer)]))};
 if(['./ServicioActual','./BloqueAcceso','./Dictado','./RedaccionIA','./SelectorFirma'].includes(n))return()=>null;
 return load.call(this,n,...a);
};
const {EditorNovedad}=require('../src/pantallas/EditorAsiento.tsx');
const boton=r=>r.root.findAllByType('Btn').find(b=>['Guardar','Guardando…'].includes(b.props.label));
test('espera el disco, conserva el formulario si falla y reintenta con el mismo ID',async()=>{
 let r,resolve,reject;confirmar=()=>new Promise((ok,no)=>{resolve=ok;reject=no;});
 await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2026-09-14',onClose:()=>cerrados++}));});
 await act(async()=>{r.root.findAllByType('Input').find(i=>i.props.label==='Descripción del registro').props.onChangeText('Novedad importante');});
 let p;await act(async()=>{p=boton(r).props.onPress();});assert.equal(cerrados,0);assert.equal(avisos.length,0);assert.equal(boton(r).props.disabled,true);
 await act(async()=>{reject(Error('SQLITE_FULL'));await p;});assert.equal(cerrados,0);assert.equal(avisos.length,0);assert.match(String(r.root.findByType('Banner').props.children),/SQLITE_FULL/);
 await act(async()=>{p=boton(r).props.onPress();});await act(async()=>{resolve();await p;});
 assert.equal(guardados.length,2);assert.equal(guardados[0].id,guardados[1].id);assert.equal(cerrados,1);assert.equal(avisos.length,1);await act(async()=>r.unmount());
});
test('al cargar un informe anterior no asigna la hora actual a una fecha equivocada',async()=>{
 let r;await act(async()=>{r=create(React.createElement(EditorNovedad,{abierto:true,novedad:null,fecha:'2000-01-01',corte:'19:00',duracion:12,onClose:()=>{}}));});
 const campo=label=>r.root.findAllByType('Input').find(i=>i.props.label===label);
 assert.equal(campo('Horario').props.value,'');
 await act(async()=>campo('Horario').props.onChangeText('06:30'));assert.equal(campo('Fecha').props.value,'2000-01-02');
 await act(async()=>r.unmount());
});
