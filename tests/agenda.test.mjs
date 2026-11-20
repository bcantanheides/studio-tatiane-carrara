import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {api} from '../src/api.js';
import {slots,today,validDate,message,DEFAULT_SERVICES} from '../src/domain.js';
const now=new Date('2026-11-20T19:30:00Z');
test('expediente, fim de semana, passado e duração integral',()=>{
 assert.equal(today(new Date('2026-11-21T01:00:00Z')),'2026-11-20');
 assert.deepEqual(slots('2026-11-22',60,[],now),[]);assert.deepEqual(slots('2026-11-23',60,[],now),[]);
 assert.deepEqual(slots('2026-11-19',60,[],now),[]);assert.equal(slots('2026-11-21',120,[],now).at(-1),'16:00');
 assert.equal(slots('2026-11-21',15,[],now).at(-1),'17:45');assert.equal(slots('2026-11-20',60,[],now)[0],'16:45');
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-11-21'),true);
});
test('sobreposição considera todo o intervalo e permite horários adjacentes',()=>{
 const result=slots('2026-11-21',60,[{start:600,end:660}],now);
 assert.ok(result.includes('09:00'));assert.ok(!result.includes('09:15'));assert.ok(!result.includes('10:00'));assert.ok(result.includes('11:00'));
});
test('mensagem contém serviço, nome, data, horário e valor',()=>{const m=message(DEFAULT_SERVICES[0],'2026-11-25','14:00','Ana');for(const v of ['Ana','Design com henna','25/11/2026','14:00','50,00','confirmar'])assert.ok(m.includes(v));});
function environment(){const db=new DatabaseSync(':memory:');db.exec(readFileSync('drizzle/0000_agenda.sql','utf8'));function prepare(sql,values=[]){return {bind(...v){return prepare(sql,v);},async all(){return {results:db.prepare(sql).all(...values)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...values).changes)}};}};}return {DB:{prepare,async batch(stmts){db.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},ADMIN_KEY:'test-only-key',db};}
function request(env,path,body,admin=false,headers={}){return api(new Request('https://test.local/api/'+path,{method:body?'POST':'GET',headers:{...(admin?{Authorization:'Bearer test-only-key'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})}),env);}
test('API protege dados privados e rejeita origem externa',async()=>{const env=environment();assert.equal((await request(env,'admin/appointments?from=2099-11-24&to=2099-11-24')).status,401);assert.equal((await request(env,'admin/session',null,true)).status,200);assert.equal((await request(env,'admin/settings',{},true,{Origin:'https://evil.test'})).status,403);assert.equal((await request(env,'availability?service=henna&month=wrong')).status,400);env.db.close();});
test('persistência, concorrência, bloqueio, remarcação e cancelamento',async()=>{
 const env=environment();const payload={kind:'appointment',service:'cilios',name:'Cliente de teste',phone:'27999999999',date:'2099-11-24',start:540};
 const outcomes=await Promise.all([request(env,'admin/appointment',payload,true),request(env,'admin/appointment',payload,true)]);
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]);const created=await outcomes.find(r=>r.status===200).json();
 const available=await (await request(env,'availability?service=henna&month=2099-11')).json();assert.ok(!available.days[payload.date].includes('10:00'));assert.ok(available.days[payload.date].includes('11:00'));
 assert.equal((await request(env,'admin/appointment',{kind:'block',date:payload.date,start:600,duration:60},true)).status,409);
 assert.equal((await request(env,'admin/appointment',{...payload,id:created.id,start:660},true)).status,200);
 assert.equal((await request(env,'admin/appointment',{kind:'block',date:payload.date,start:540,duration:60},true)).status,200);
 assert.equal((await request(env,'admin/appointment',{action:'cancel',id:created.id},true)).status,200);
 const list=await (await request(env,'admin/appointments?from=2099-11-24&to=2099-11-24',null,true)).json();assert.equal(list.filter(a=>a.status==='confirmed').length,1);
 assert.equal((await request(env,'admin/appointment',{...payload,date:'2099-11-22'},true)).status,400);env.db.close();
});
test('configuração do WhatsApp e solicitação não reservam o horário',async()=>{const env=environment();const payload={service:'henna',date:'2099-11-24',time:'09:00',name:'Ana'};
 assert.equal((await request(env,'request',payload)).status,503);
 assert.equal((await request(env,'admin/settings',{phone:'5527999999999',services:DEFAULT_SERVICES},true)).status,200);
 const response=await request(env,'request',payload);assert.equal(response.status,200);const data=await response.json();assert.ok(data.url.startsWith('https://wa.me/5527999999999?text='));assert.equal(new URL(data.url).searchParams.get('text'),data.message);
 assert.equal(env.db.prepare('SELECT COUNT(*) AS count FROM appointments').get().count,0);env.db.close();
});
