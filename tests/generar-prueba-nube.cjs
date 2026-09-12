const fs=require('node:fs');
const path=require('node:path');
const raiz=path.resolve(__dirname,'..');
const datos=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures-nube.json'),'utf8'));
const plantilla=fs.readFileSync(path.join(__dirname,'nube-servidor.sql'),'utf8');
const destino=path.join(raiz,'output','nube-prueba.sql');
fs.mkdirSync(path.dirname(destino),{recursive:true});
fs.writeFileSync(destino,plantilla.replace('__FIXTURES__',JSON.stringify(datos)));
console.log(destino);
