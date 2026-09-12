export async function api(accion,datos={}){
 const r=await fetch('/api/admin',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion,...datos})});
 const j=await r.json();if(!r.ok||j.ok===false){const e=Error(j.error||'No se pudo completar la operación.');e.status=r.status;throw e;}return j;
}
