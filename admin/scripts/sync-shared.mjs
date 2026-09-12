import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
fs.mkdirSync(path.join(root,'shared'),{recursive:true});
for(const name of ['model','text','reporte','informedia','pdfplantilla','pdfw','pdfmetrics']){
 const source=path.resolve(root,'../src',name+'.ts');
 if(fs.existsSync(source))fs.copyFileSync(source,path.join(root,'shared',name+'.ts'));
 if(!fs.existsSync(path.join(root,'shared',name+'.ts')))throw Error('Falta el módulo compartido '+name);
}
