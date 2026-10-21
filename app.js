'use strict';
const $=id=>document.getElementById(id);let db,photos=[],stream=null,signId=null,draw=false,editId=null;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
function request(r){return new Promise((ok,fail)=>{r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
function openDb(){return new Promise((ok,fail)=>{const r=indexedDB.open('nastec-coletas-piloto-04',1);r.onupgradeneeded=()=>r.result.createObjectStore('registros',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>fail(r.error)})}
const store=(mode='readonly')=>db.transaction('registros',mode).objectStore('registros');
const all=()=>request(store().getAll());const get=id=>request(store().get(id));const put=r=>request(store('readwrite').put(r));const del=id=>request(store('readwrite').delete(id));
const readFile=f=>new Promise((ok,fail)=>{const r=new FileReader();r.onload=()=>ok({name:f.name,type:f.type,data:r.result});r.onerror=()=>fail(r.error);r.readAsDataURL(f)});
function history(r,action,detail=''){r.historico??=[];r.historico.push({acao:action,detalhe:detail,em:new Date().toISOString(),usuario:r.coletor})}
const fields=['coletor','os','amostra','frasco','ponto','datahora','ph','cloro','temperatura','clima','observacoes'];
function showEdit(r){
 editId=r.id;
 for(const key of fields){const el=document.querySelector(`[name="${key}"]`);if(el)el.value=r[key]||''}
 photos=[...(r.fotos||[])];
 $('photosCount').textContent=`${photos.length} foto(s) já armazenada(s). Novas fotos serão acrescentadas.`;
 $('editNotice').textContent=`Editando ${r.amostra} • ${r.os}. Alterações serão registradas no histórico.`;
 $('editNotice').classList.remove('hide');
 $('saveBtn').textContent='Salvar alterações do registro';
 $('cancelEdit').classList.remove('hide');
 $('form').scrollIntoView({behavior:'smooth'});
}
function clearEdit(){editId=null;photos=[];$('form').reset();$('editNotice').classList.add('hide');$('saveBtn').textContent='Salvar rascunho no celular';$('cancelEdit').classList.add('hide');$('photosCount').textContent='Nenhuma fotografia selecionada'}

function updateStatus(rows){$('status').textContent=`${rows.length} registro(s) neste aparelho • ${navigator.onLine?'rede disponível':'sem rede'} • ${rows.filter(r=>r.situacao==='Finalizada — aguardando sincronização').length} aguardando sincronização`}
async function render(){const rows=(await all()).sort((a,b)=>(b.criadoEm||'').localeCompare(a.criadoEm||''));updateStatus(rows);$('list').innerHTML=rows.length?rows.map(r=>`<div class="entry"><b>${esc(r.os)} • ${esc(r.amostra)}</b><p>${esc(r.frasco)} • ${esc(r.ponto)}<br><strong>${esc(r.situacao)}</strong> • ${esc(r.coletor)}<br>${esc(r.datahora)} • ${(r.fotos||[]).length} foto(s)</p><div>${(r.fotos||[]).map(p=>`<img class="photo" src="${p.data}" alt="Foto de teste">`).join('')}</div>${r.situacao==='Em andamento'?`<button data-action="editar" class="secondary" data-id="${r.id}">Editar coleta</button><button data-action="finalizar" data-id="${r.id}">Finalizar e assinar</button>`:`<button data-action="reabrir" class="secondary" data-id="${r.id}">Reabrir com justificativa</button>`}<button data-action="ficha" class="secondary" data-id="${r.id}">Ficha / PDF</button><button data-action="excluir" class="danger" data-id="${r.id}">Excluir teste</button><div id="sign-${r.id}" class="hide"><p>Assinatura de ${esc(r.coletor)} (desenhe com o dedo ou mouse):</p><canvas width="680" height="155" data-canvas="${r.id}"></canvas><button data-action="limpar" data-id="${r.id}" class="secondary">Limpar assinatura</button><button data-action="confirmar" data-id="${r.id}">Confirmar finalização</button></div></div>`).join(''):'Nenhum registro.'}
$('fotos').addEventListener('change',async e=>{try{const novas=await Promise.all([...e.target.files].map(readFile));photos.push(...novas);$('photosCount').textContent=`${photos.length} foto(s) no registro`}catch(err){alert('Erro ao carregar foto: '+err.message)}});
$('cancelEdit').addEventListener('click',clearEdit);
$('form').addEventListener('submit',async e=>{
 e.preventDefault();
 const f=Object.fromEntries(new FormData(e.target));
 const rows=await all();
 if(rows.some(r=>r.id!==editId&&r.os===f.os&&r.coletor!==f.coletor)){alert('Esta OS já foi atribuída a outro coletor neste aparelho.');return}
 try{
  if(editId){
   const r=await get(editId);
   if(!r||r.situacao!=='Em andamento'){alert('Só é possível editar uma coleta em andamento.');return}
   const alteracoes=[];
   for(const key of fields){const anterior=String(r[key]??''),novo=String(f[key]??'');if(anterior!==novo)alteracoes.push({campo:key,anterior,novo})}
   if(photos.length!==r.fotos.length)alteracoes.push({campo:'fotografias',anterior:r.fotos.length,novo:photos.length});
   if(!alteracoes.length){alert('Nenhuma alteração identificada.');return}
   const motivo=prompt('Justificativa obrigatória para alterar este registro:');
   if(motivo===null)return;
   if(!motivo.trim()){alert('Informe a justificativa.');return}
   Object.assign(r,f);r.fotos=photos;r.alteradoEm=new Date().toISOString();
   history(r,'EDITADA',JSON.stringify({justificativa:motivo.trim(),alteracoes}));
   await put(r);clearEdit();await render();alert('Alterações salvas no aparelho. Histórico preservado.');
  }else{
   const r={...f,id:uid(),fotos:photos,criadoEm:new Date().toISOString(),situacao:'Em andamento',assinatura:null,historico:[]};
   history(r,'CRIADA','Registro simulado');await put(r);clearEdit();await render();alert('Rascunho salvo no celular. Não foi enviado ao LIMS.');
  }
 }catch(err){alert('Falha ao salvar (possível limite de armazenamento): '+err.message)}
});
function setupCanvas(canvas){const ctx=canvas.getContext('2d');ctx.lineWidth=2.5;ctx.strokeStyle='#122c43';ctx.lineCap='round';let active=false;const pos=e=>{const box=canvas.getBoundingClientRect();return {x:(e.clientX-box.left)*canvas.width/box.width,y:(e.clientY-box.top)*canvas.height/box.height}};canvas.onpointerdown=e=>{active=true;draw=true;canvas.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.01,p.y+.01);ctx.stroke()};canvas.onpointermove=e=>{if(!active)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke()};canvas.onpointerup=canvas.onpointercancel=()=>active=false}
$('list').addEventListener('click',async e=>{const b=e.target.closest('button[data-action]');if(!b)return;const {action,id}=b.dataset;const r=await get(id);if(!r)return;
if(action==='editar'){showEdit(r);return}
if(action==='excluir'){if(confirm('Excluir este registro simulado e todas as fotografias deste aparelho?')){await del(id);await render()}return}
if(action==='finalizar'){signId=id;draw=false;const div=$('sign-'+id);div.classList.remove('hide');setupCanvas(div.querySelector('canvas'));return}
if(action==='limpar'){const c=$('sign-'+id).querySelector('canvas');c.getContext('2d').clearRect(0,0,c.width,c.height);draw=false;return}
if(action==='confirmar'){if(signId!==id||!draw){alert('Assine antes de finalizar.');return}if(!confirm('Confirmar a finalização desta coleta simulada?'))return;const c=$('sign-'+id).querySelector('canvas');r.assinatura=c.toDataURL('image/png');r.situacao='Finalizada — aguardando sincronização';r.finalizadoEm=new Date().toISOString();history(r,'FINALIZADA','Assinatura do coletor registrada');await put(r);signId=null;await render();return}
if(action==='reabrir'){const motivo=prompt('Informe a justificativa obrigatória para reabrir a coleta:');if(motivo===null)return;if(!motivo.trim()){alert('A justificativa é obrigatória.');return}history(r,'REABERTA',motivo.trim());r.situacao='Em andamento';r.assinaturasAnteriores??=[];if(r.assinatura)r.assinaturasAnteriores.push({imagem:r.assinatura,finalizadoEm:r.finalizadoEm});r.assinatura=null;r.finalizadoEm=null;await put(r);await render();showEdit(r);alert('Coleta reaberta. Edite os campos e informe a justificativa ao salvar.');return}
if(action==='ficha'){makePrint(r);return}
});
function makePrint(r){
 const fieldsPrint=[['OS',r.os],['Amostra',r.amostra],['Frasco',r.frasco],['Ponto',r.ponto],['Coletor',r.coletor],['Data/hora',r.datahora],['pH',r.ph],['Cloro residual (mg/L)',r.cloro],['Temperatura (°C)',r.temperatura],['Clima',r.clima],['Observações',r.observacoes],['Situação',r.situacao]];
 const fotos=(r.fotos||[]).map(p=>`<img src="${p.data}" alt="Foto da coleta">`).join('');
 const historico=(r.historico||[]).map(h=>{
  let detalhe=h.detalhe||'';
  try{const obj=JSON.parse(detalhe);if(obj&&obj.alteracoes)detalhe=`Justificativa: ${obj.justificativa||'-'}. `+obj.alteracoes.map(a=>`${a.campo}: ${a.anterior} → ${a.novo}`).join('; ')}catch(_){}
  return `<div><strong>${esc(h.acao)}</strong> — ${esc(h.em)} — ${esc(detalhe)}</div>`;
 }).join('');
 $('printArea').innerHTML=`<div class="sheet"><h2>NASTEC — FICHA DE COLETA (SIMULAÇÃO)</h2><p><strong>DOCUMENTO DE TESTE — NÃO UTILIZAR EM ATENDIMENTO REAL</strong></p><table>${fieldsPrint.map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v||'-')}</td></tr>`).join('')}</table><div class="print-block"><h3>Fotografias</h3><div class="print-photos">${fotos||'<p>Sem fotografias</p>'}</div></div><div class="print-block"><h3>Assinatura do coletor</h3>${r.assinatura?`<img class="signature" src="${r.assinatura}" alt="Assinatura">`:'<p>Coleta não finalizada / sem assinatura atual</p>'}<div>${esc(r.coletor)} • ${esc(r.finalizadoEm||'')}</div></div><div class="print-history"><h3>Histórico de alterações</h3>${historico}</div></div>`;
 window.print();
}
$('export').addEventListener('click',async()=>{const rows=await all();if(!rows.length){alert('Não há registros');return}const blob=new Blob([JSON.stringify({formato:'NASTEC-COLETAS-PILOTO-04',exportadoEm:new Date().toISOString(),registros:rows},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='nastec-coletas-04-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)});
function stopCamera(){
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
 const v=$('video');v.pause();v.srcObject=null;v.classList.add('hide');$('stopScan').classList.add('hide');
}
$('stopScan').addEventListener('click',()=>{stopCamera();$('scanStatus').textContent='Câmera fechada.'});
$('scan').addEventListener('click',async()=>{
 if(!window.isSecureContext){$('scanStatus').textContent='Câmera requer HTTPS seguro no Android. Neste teste, digite o código.';return}
 if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){$('scanStatus').textContent='Leitura automática indisponível neste navegador. Tente fotografar o QR Code ou digite o código.';return}
 try{
  stopCamera();
  const detector=new BarcodeDetector({formats:['qr_code']});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}}});
  const v=$('video');v.srcObject=stream;v.classList.remove('hide');$('stopScan').classList.remove('hide');await v.play();
  $('scanStatus').textContent='Aponte a câmera para o QR Code.';
  const loop=async()=>{
   if(!stream)return;
   const codes=await detector.detect(v).catch(()=>[]);
   if(codes.length){$('frasco').value=codes[0].rawValue;stopCamera();$('scanStatus').textContent='Código lido: '+codes[0].rawValue}
   else setTimeout(loop,450)
  };loop()
 }catch(err){stopCamera();$('scanStatus').textContent='Câmera indisponível: '+err.message}
});
$('qrImage').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!('BarcodeDetector'in window)){$('scanStatus').textContent='Este Chrome não oferece leitura automática da imagem. Digite o código do frasco.';return}
 try{
  const detector=new BarcodeDetector({formats:['qr_code']});
  const bitmap=await createImageBitmap(file);
  const found=await detector.detect(bitmap);bitmap.close?.();
  if(found.length){$('frasco').value=found[0].rawValue;$('scanStatus').textContent='Código lido da imagem.'}
  else $('scanStatus').textContent='Nenhum QR Code reconhecido nesta imagem. Digite o código.'
 }catch(err){$('scanStatus').textContent='Não foi possível analisar a imagem: '+err.message}
});
let deferredInstall=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;$('installBtn').classList.remove('hide');$('installStatus').textContent='Instalação disponível neste navegador.'});
$('installBtn').addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;$('installBtn').classList.add('hide')});
window.addEventListener('appinstalled',()=>{$('installStatus').textContent='Aplicativo adicionado à tela inicial.'});
function installationStatus(){
 const secure=window.isSecureContext;
 const sw='serviceWorker'in navigator;
 const installed=window.matchMedia('(display-mode: standalone)').matches;
 $('installStatus').textContent=installed?'Aberto como aplicativo instalado.':!secure?'Aberto sem HTTPS seguro: instalação e câmera podem ficar indisponíveis.':sw?'HTTPS seguro detectado. Abra o menu do Chrome → Adicionar à tela inicial / Instalar aplicativo.':'Este navegador não oferece Service Worker.';
}
installationStatus();
window.addEventListener('online',()=>db&&render());window.addEventListener('offline',()=>db&&render());
(async()=>{try{db=await openDb();await render()}catch(e){$('status').textContent='Erro de armazenamento: '+e.message;$('form').querySelector('[type=submit]').disabled=true}if('serviceWorker'in navigator&&window.isSecureContext)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>{$('installStatus').textContent='Falha ao preparar modo offline: '+e.message})})();
