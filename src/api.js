import {DEFAULT_SERVICES,today,validDate,workingDay,future,slots,message} from './domain.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const fail=(text,status=400)=>{throw Object.assign(new Error(text),{status});};
const text=(x,max=150)=>typeof x==='string'?x.trim().slice(0,max):'';
async function settings(db){const r=await db.prepare('SELECT key,value FROM settings').all();const map=Object.fromEntries(r.results.map(x=>[x.key,JSON.parse(x.value)]));return {phone:map.phone||'',services:map.services||DEFAULT_SERVICES};}
async function safeEqual(a,b) { const digest=async x=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))); const [x,y]=await Promise.all([digest(a),digest(b)]);return x.reduce((diff,n,i)=>diff|(n^y[i]),0)===0; }
export async function api(request,env){
 try{
 const u=new URL(request.url),p=u.pathname,db=env.DB;
 if(!db)return json({error:'Banco de dados indisponível. Tente novamente mais tarde.'},503);
 if(!['GET','POST'].includes(request.method))return json({error:'Método não permitido.'},405);
 if(request.method==='POST' && request.headers.get('origin') && request.headers.get('origin')!==u.origin)return json({error:'Origem não permitida.'},403);
 const admin=p.startsWith('/api/admin');
 if(admin){if(!env.ADMIN_KEY)return json({error:'A chave administrativa ainda não foi configurada no servidor.'},503);if(!(await safeEqual(request.headers.get('authorization')||'','Bearer '+env.ADMIN_KEY)))return json({error:'Chave de acesso inválida.'},401);}
 let body={};if(request.method==='POST'){if(Number(request.headers.get('content-length')||0)>16000)fail('Dados muito extensos.',413);const raw=await request.text();if(raw.length>16000)fail('Dados muito extensos.',413);try{body=JSON.parse(raw);}catch{fail('Dados inválidos.');}}
 const config=await settings(db);
 if(p==='/api/catalog' && request.method==='GET')return json({...config,today:today(),timezone:'America/Sao_Paulo'});
 if(p==='/api/availability' && request.method==='GET'){
  const service=config.services.find(s=>s.id===u.searchParams.get('service'));if(!service)fail('Escolha um serviço válido.');
  const month=u.searchParams.get('month');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))fail('Mês inválido.');
  const [year,m]=month.split('-').map(Number);if(year<2020||year>2100)fail('Mês inválido.');
  const busy=(await db.prepare("SELECT date,start,end FROM appointments WHERE date LIKE ? AND status='confirmed'").bind(month+'-%').all()).results;
  const days={};for(let d=1;d<=new Date(year,m,0).getDate();d++){const date=month+'-'+String(d).padStart(2,'0');days[date]=slots(date,service.duration,busy.filter(x=>x.date===date));}
  return json({days});
 }
 if(p==='/api/request' && request.method==='POST'){
  const service=config.services.find(s=>s.id===body.service);if(!service)fail('Serviço inválido.');
  if(!validDate(body.date||''))fail('Data inválida.');
  const busy=(await db.prepare("SELECT start,end FROM appointments WHERE date=? AND status='confirmed'").bind(body.date).all()).results;
  if(!slots(body.date,service.duration,busy).includes(body.time))fail('Esse horário não está mais disponível. Escolha outro.',409);
  if(!/^55\d{10,11}$/.test(config.phone))fail('O WhatsApp do Studio ainda não foi configurado. Entre em contato com a profissional.',503);
  const msg=message(service,body.date,body.time,text(body.name,80));return json({message:msg,url:'https://wa.me/'+config.phone+'?text='+encodeURIComponent(msg)});
 }
 if(p==='/api/admin/session' && request.method==='GET')return json({ok:true});
 if(p==='/api/admin/appointments' && request.method==='GET'){
  const from=u.searchParams.get('from'),to=u.searchParams.get('to');if(!validDate(from||'')||!validDate(to||'')||from>to)fail('Período inválido.');
  return json((await db.prepare('SELECT * FROM appointments WHERE date BETWEEN ? AND ? ORDER BY date,start').bind(from,to).all()).results);
 }
 if(p==='/api/admin/settings' && request.method==='POST'){
  const phone=text(body.phone,20).replace(/\D/g,'');if(phone && !/^55\d{10,11}$/.test(phone))fail('Informe 55, DDD e número do WhatsApp.');
  if(!Array.isArray(body.services)||body.services.length<1||body.services.length>30)fail('Informe de 1 a 30 serviços.');
  const services=body.services.map(s=>({id:text(s.id,60),name:text(s.name,80),duration:Number(s.duration),price:Number(s.price),category:text(s.category,30),description:text(s.description,200)}));
  if(new Set(services.map(s=>s.id)).size!==services.length||services.some(s=>!s.id||!s.name||!Number.isInteger(s.duration)||s.duration<15||s.duration>540||s.duration%15||!Number.isInteger(s.price)||s.price<0||s.price>10000000))fail('Revise nomes, preços e durações (múltiplos de 15 minutos).');
  await db.batch([db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('phone',JSON.stringify(phone)),db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind('services',JSON.stringify(services))]);return json({ok:true});
 }
 if(p==='/api/admin/appointment' && request.method==='POST'){
  if(body.action==='cancel') {const r=await db.prepare("UPDATE appointments SET status='cancelled' WHERE id=? AND status='confirmed'").bind(text(body.id,60)).run();if(!r.meta.changes)fail('Registro não encontrado.',404);return json({ok:true});}
  const date=text(body.date,10),start=Number(body.start),kind=body.kind==='block'?'block':'appointment';
  const service=config.services.find(s=>s.id===body.service);
  const duration=kind==='block'?Number(body.duration):service?.duration;
  if(kind==='appointment'&&!service)fail('Serviço inválido.');
  if(!validDate(date)||!workingDay(date)||!Number.isInteger(start)||start%15||!Number.isInteger(duration)||duration<15||duration%15||start<540||start+duration>1080||!future(date,start))fail('Selecione um horário futuro, de terça a sábado, entre 9h e 18h.');
  const name=text(body.name,80),phone=text(body.phone,20).replace(/\D/g,'');if(kind==='appointment'&&!name)fail('Informe o nome da cliente.');
  if(phone&&!/^\d{10,13}$/.test(phone))fail('Telefone inválido.');
  const id=text(body.id,60)||crypto.randomUUID();
  const values=[date,start,start+duration,kind,service?.id||null,kind==='block'?'Horário bloqueado':service.name,kind==='block'?0:service.price,name,phone];
  if(body.id){const r=await db.prepare("UPDATE appointments SET date=?,start=?,end=?,kind=?,service_id=?,service_name=?,price=?,client_name=?,client_phone=? WHERE id=? AND status='confirmed'").bind(...values,id).run();if(!r.meta.changes)fail('Registro não encontrado.',404);}
  else await db.prepare('INSERT INTO appointments(date,start,end,kind,service_id,service_name,price,client_name,client_phone,id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(...values,id,new Date().toISOString()).run();
  return json({ok:true,id});
 }
 return json({error:'Recurso não encontrado.'},404);
 }catch(e){if(String(e.message).includes('SLOT_CONFLICT'))return json({error:'Há outro atendimento ou bloqueio nesse intervalo. Escolha outro horário.'},409);if(e.status)return json({error:e.message},e.status);console.error('API_ERROR',e.message);return json({error:'Não foi possível concluir a operação. Tente novamente.'},500);}
}
