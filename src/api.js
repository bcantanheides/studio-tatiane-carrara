import {DEFAULT_SERVICES,today,validDate,workingDay,future,slots,totals} from './domain.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(x,max=150)=>typeof x==='string'?x.trim().slice(0,max):'';
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function safeEqual(a,b){const [x,y]=await Promise.all([hash(a),hash(b)]);return [...x].reduce((n,c,i)=>n|(c.charCodeAt(0)^y.charCodeAt(i)),0)===0;}
async function settings(db){const r=await db.prepare('SELECT key,value FROM settings').all();const map=Object.fromEntries(r.results.map(x=>[x.key,JSON.parse(x.value)]));return {services:map.services||DEFAULT_SERVICES};}
function selectServices(ids,catalog){
 if(!Array.isArray(ids)||!ids.length||ids.length>30||new Set(ids).size!==ids.length)fail('Selecione pelo menos um serviço, sem repetições.');
 const selected=ids.map(id=>catalog.find(s=>s.id===id));if(selected.some(s=>!s))fail('Um dos serviços não está disponível. Atualize a seleção.');return selected;
}
function validateInterval(date,start,duration){if(!validDate(date)||!workingDay(date)||!Number.isInteger(start)||start%15||!Number.isInteger(duration)||duration<15||duration%15||start<540||start+duration>1080||!future(date,start))fail('Selecione um horário futuro de terça a sábado, entre 9h e 18h, com tempo para todos os serviços.');}
function contact(body){const name=text(body.name,80),phone=text(body.phone,25).replace(/\D/g,'');if(!name)fail('Informe seu nome.');if(!/^(?:55)?\d{10,11}$/.test(phone))fail('Informe um telefone com DDD.');return {name,phone};}
function appointment(a){return {...a,services:a.services_json?JSON.parse(a.services_json):a.kind==='appointment'?[{id:a.service_id,name:a.service_name,duration:a.end-a.start,price:a.price}]:[]};}
function quote(q){const {token_hash,...safe}=q;return {...safe,services:JSON.parse(q.services_json)};}
async function findQuote(db,id){return (await db.prepare('SELECT * FROM quotes WHERE id=?').bind(id).all()).results[0];}
export async function api(request,env){
 try{
 const u=new URL(request.url),p=u.pathname,db=env.DB;
 if(!db)return json({error:'Banco de dados indisponível. Tente novamente mais tarde.'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Método não permitido.'},405);
 if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==u.origin)return json({error:'Origem não permitida.'},403);
 const admin=p.startsWith('/api/admin');
 if(admin){if(!env.ADMIN_KEY)return json({error:'A chave administrativa não foi configurada no servidor.'},503);if(!(await safeEqual(request.headers.get('authorization')||'','Bearer '+env.ADMIN_KEY)))return json({error:'Chave de acesso inválida.'},401);}
 let body={};if(request.method==='POST'){if(Number(request.headers.get('content-length')||0)>16000)fail('Dados muito extensos.',413);const raw=await request.text();if(raw.length>16000)fail('Dados muito extensos.',413);try{body=JSON.parse(raw);}catch{fail('Dados inválidos.');}if(!body||typeof body!=='object'||Array.isArray(body))fail('Dados inválidos.');}
 const config=await settings(db);
 if(p==='/api/catalog'&&request.method==='GET')return json({...config,today:today(),timezone:'America/Sao_Paulo'});
 if(p==='/api/availability'&&request.method==='GET'){
  const selected=selectServices((u.searchParams.get('services')||'').split(',').filter(Boolean),config.services),{duration}=totals(selected);
  const month=u.searchParams.get('month');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))fail('Mês inválido.');
  const [year,m]=month.split('-').map(Number);if(year<2020||year>2100)fail('Mês inválido.');
  const busy=(await db.prepare("SELECT date,start,end FROM appointments WHERE date LIKE ? AND status='confirmed'").bind(month+'-%').all()).results;
  const days={};for(let d=1;d<=new Date(year,m,0).getDate();d++){const date=month+'-'+String(d).padStart(2,'0');days[date]=slots(date,duration,busy.filter(x=>x.date===date));}
  return json({days,duration});
 }
 if(p==='/api/request'&&request.method==='POST'){
  if(!uuid(body.id)||!uuid(body.token))fail('Identificação do pedido inválida. Atualize a página.');
  const tokenHash=await hash(body.token),existing=await findQuote(db,body.id);
  if(existing){if(existing.token_hash!==tokenHash)fail('Identificação do pedido inválida.',409);return json({id:existing.id,token:body.token,status:existing.status});}
  const selected=selectServices(body.services,config.services),{duration,price}=totals(selected),{name,phone}=contact(body);
  const date=text(body.date,10);if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time||''))fail('Horário inválido.');const [h,m]=body.time.split(':').map(Number),start=h*60+m;
  validateInterval(date,start,duration);
  const busy=(await db.prepare("SELECT start,end FROM appointments WHERE date=? AND status='confirmed'").bind(date).all()).results;
  if(!slots(date,duration,busy).includes(body.time))fail('Esse horário não está mais disponível para todos os serviços. Escolha outro.',409);
  try{await db.prepare('INSERT INTO quotes(id,token_hash,date,start,client_name,client_phone,services_json,duration,price,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(body.id,tokenHash,date,start,name,phone,JSON.stringify(selected),duration,price,new Date().toISOString()).run();}
  catch(e){const retry=await findQuote(db,body.id);if(retry&&retry.token_hash===tokenHash)return json({id:retry.id,token:body.token,status:retry.status});throw e;}
  return json({id:body.id,token:body.token,status:'pending'},201);
 }
 if(p==='/api/quote-status'&&request.method==='POST'){
  if(!uuid(body.id)||!uuid(body.token))fail('Protocolo ou chave inválidos.',404);
  const q=await findQuote(db,body.id);if(!q||q.token_hash!==await hash(body.token))fail('Pedido não encontrado. Confira o protocolo e a chave.',404);
  const a=(await db.prepare('SELECT * FROM appointments WHERE quote_id=?').bind(q.id).all()).results[0];return json({...quote(q),appointment:a?appointment(a):null});
 }
 if(p==='/api/admin/session'&&request.method==='GET')return json({ok:true});
 if(p==='/api/admin/quotes'&&request.method==='GET')return json((await db.prepare("SELECT * FROM quotes ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,date,start,created_at").all()).results.map(quote));
 if(p==='/api/admin/decision'&&request.method==='POST'){
  const q=await findQuote(db,text(body.id,60));if(!q)fail('Orçamento não encontrado.',404);if(q.status!=='pending')fail('Este orçamento já foi analisado. Atualize o painel.',409);
  const note=text(body.note,500),decidedAt=new Date().toISOString();
  if(body.action==='reject'){const r=await db.prepare("UPDATE quotes SET status='rejected',decision_note=?,decided_at=? WHERE id=? AND status='pending'").bind(note,decidedAt,q.id).run();if(!r.meta.changes)fail('Este orçamento já foi analisado.',409);return json({ok:true});}
  if(body.action!=='approve')fail('Decisão inválida.');
  // Preserve the original quoted price and duration when the catalog changes.
  const original=JSON.parse(q.services_json),selected=selectServices(body.services,original),{duration,price}=totals(selected);validateInterval(q.date,q.start,duration);
  const status=selected.length===original.length?'approved':'partial',id=crypto.randomUUID();
  const insert=db.prepare("INSERT INTO appointments(id,date,start,end,kind,service_id,service_name,price,client_name,client_phone,created_at,services_json,quote_id) SELECT ?,date,start,?,'appointment',?,?,?,?,?,?,?,id FROM quotes WHERE id=? AND status='pending'").bind(id,q.start+duration,selected[0].id,selected.map(s=>s.name).join(' + '),price,q.client_name,q.client_phone,decidedAt,JSON.stringify(selected),q.id);
  // Calendar insertion and decision are atomic; SQL triggers reject overlaps.
  const results=await db.batch([insert,db.prepare("UPDATE quotes SET status=?,decision_note=?,decided_at=? WHERE id=? AND status='pending' AND EXISTS (SELECT 1 FROM appointments WHERE id=?)").bind(status,note,decidedAt,q.id,id)]);
  if(!results[0].meta.changes||!results[1].meta.changes)fail('Este orçamento já foi analisado. Atualize o painel.',409);return json({ok:true,id,status});
 }
 if(p==='/api/admin/appointments'&&request.method==='GET'){
  const from=u.searchParams.get('from'),to=u.searchParams.get('to');if(!validDate(from||'')||!validDate(to||'')||from>to)fail('Período inválido.');return json((await db.prepare('SELECT * FROM appointments WHERE date BETWEEN ? AND ? ORDER BY date,start').bind(from,to).all()).results.map(appointment));
 }
 if(p==='/api/admin/settings'&&request.method==='POST'){
  if(!Array.isArray(body.services)||body.services.length<1||body.services.length>30)fail('Informe de 1 a 30 serviços.');
  const services=body.services.map(s=>({id:text(s.id,60),name:text(s.name,80),duration:Number(s.duration),price:Number(s.price),category:text(s.category,30),description:text(s.description,200)}));
  if(new Set(services.map(s=>s.id)).size!==services.length||services.some(s=>!s.id||s.id.includes(',')||!s.name||!Number.isInteger(s.duration)||s.duration<15||s.duration>540||s.duration%15||!Number.isInteger(s.price)||s.price<0||s.price>10000000))fail('Revise nomes, preços e durações (múltiplos de 15 minutos).');
  await db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('services',JSON.stringify(services)).run();return json({ok:true});
 }
 if(p==='/api/admin/appointment'&&request.method==='POST'){
  if(body.action==='cancel'){const r=await db.prepare("UPDATE appointments SET status='cancelled' WHERE id=? AND status='confirmed'").bind(text(body.id,60)).run();if(!r.meta.changes)fail('Registro não encontrado.',404);return json({ok:true});}
  const date=text(body.date,10),start=Number(body.start),kind=body.kind==='block'?'block':'appointment';
  const selected=kind==='block'?[]:selectServices(body.services,config.services),total=totals(selected),duration=kind==='block'?Number(body.duration):total.duration;
  validateInterval(date,start,duration);const {name,phone}=kind==='block'?{name:'',phone:''}:contact(body);
  const id=text(body.id,60)||crypto.randomUUID(),values=[date,start,start+duration,kind,selected[0]?.id||null,kind==='block'?'Horário bloqueado':selected.map(s=>s.name).join(' + '),total.price,name,phone,JSON.stringify(selected)];
  if(body.id){const r=await db.prepare("UPDATE appointments SET date=?,start=?,end=?,kind=?,service_id=?,service_name=?,price=?,client_name=?,client_phone=?,services_json=? WHERE id=? AND status='confirmed'").bind(...values,id).run();if(!r.meta.changes)fail('Registro não encontrado.',404);}
  else await db.prepare('INSERT INTO appointments(date,start,end,kind,service_id,service_name,price,client_name,client_phone,services_json,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values,id,new Date().toISOString()).run();return json({ok:true,id});
 }
 return json({error:'Recurso não encontrado.'},404);
 }catch(e){if(String(e.message).includes('SLOT_CONFLICT'))return json({error:'O intervalo já está ocupado por outro atendimento ou bloqueio. Escolha outro pedido ou altere a agenda.'},409);if(e.status)return json({error:e.message},e.status);console.error('API_ERROR',e.message);return json({error:'Não foi possível concluir a operação. Tente novamente.'},500);}
}
