import {money,message,time} from '/domain.js';
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let config,serviceId,month,date,selectedTime,days={},key=sessionStorage.getItem('studio-admin')||'',appointments=[],allClients=[],requestSequence=0,cancelId;
const formatDate=(d,long=false)=>new Date(d+'T12:00:00-03:00').toLocaleDateString('pt-BR',long?{weekday:'long',day:'numeric',month:'long'}:{day:'2-digit',month:'2-digit',year:'numeric'});
const service=()=>config.services.find(s=>s.id===serviceId);
async function api(path,body,admin=false){const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+key}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok){if(response.status===401&&admin)logout();throw new Error(data.error||'Não foi possível concluir.');}return data;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;setTimeout(()=>$('toast').hidden=true,4000);}
function options(){return config.services.map(s=>`<option value="${escape(s.id)}">${escape(s.name)} · ${s.duration} min · ${money(s.price)}</option>`).join('');}
function renderServices(){
 $('service-list').innerHTML=config.services.map(s=>`<div class="col-md-6 col-lg-4"><button class="service-card ${s.id===serviceId?'selected':''}" data-service="${escape(s.id)}" aria-pressed="${s.id===serviceId}"><span class="service-category">${escape(s.category)}</span><h3>${escape(s.name)}</h3><p>${escape(s.description)}</p><span class="service-bottom"><span>${s.duration} min</span><strong>${money(s.price)}</strong></span></button></div>`).join('');
 $('service-select').innerHTML=options();$('service-select').value=serviceId;
 document.querySelectorAll('[data-service]').forEach(b=>b.onclick=()=>{selectService(b.dataset.service);$('agendar').scrollIntoView({behavior:'smooth'});});
}
async function selectService(id){serviceId=id;date=null;selectedTime=null;renderServices();renderTimes();await loadCalendar();}
async function loadCalendar(){
 const sequence=++requestSequence;days={};renderCalendar();$('calendar-error').textContent='';$('calendar').setAttribute('aria-busy','true');
 try{const data=await api(`availability?service=${encodeURIComponent(serviceId)}&month=${month}`);if(sequence!==requestSequence)return;days=data.days;renderCalendar();if(date){if(!days[date]?.length){date=null;selectedTime=null;}else if(!days[date].includes(selectedTime))selectedTime=null;renderTimes();}}
 catch(e){if(sequence===requestSequence)$('calendar-error').textContent=e.message;}
 finally{if(sequence===requestSequence)$('calendar').setAttribute('aria-busy','false');}
}
function renderCalendar(){
 const [y,m]=month.split('-').map(Number),first=new Date(y,m-1,1).getDay(),count=new Date(y,m,0).getDate();
 $('month-title').textContent=new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 $('prev-month').disabled=month<=config.today.slice(0,7);$('next-month').disabled=month>=(Number(config.today.slice(0,4))+2)+'-12';
 let html='<span aria-hidden="true"></span>'.repeat(first);
 for(let d=1;d<=count;d++){const value=month+'-'+String(d).padStart(2,'0'),available=days[value]?.length;html+=`<button type="button" data-date="${value}" class="${value===date?'selected ':''}${value===config.today?'today':''}" ${available?'':'disabled'} aria-pressed="${value===date}" aria-label="${escape(formatDate(value,true))}, ${available?available+' horários disponíveis':'sem horários disponíveis'}">${d}</button>`;}
 $('calendar').innerHTML=html;document.querySelectorAll('[data-date]').forEach(b=>b.onclick=()=>{date=b.dataset.date;selectedTime=null;renderCalendar();renderTimes();});
}
function renderTimes(){
 $('selected-day').textContent=date?formatDate(date,true):'Escolha um dia';$('service-detail').textContent=service()?`${service().name} · ${service().duration} min · ${money(service().price)}`:'';
 $('time-slots').innerHTML=date?(days[date]||[]).map(t=>`<button class="slot ${t===selectedTime?'selected':''}" data-time="${t}" aria-pressed="${t===selectedTime}">${t}</button>`).join(''):'<p class="muted">Selecione um dia destacado no calendário para ver os horários disponíveis.</p>';
 document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{selectedTime=b.dataset.time;renderTimes();});
 $('request-panel').hidden=!selectedTime;$('request-error').textContent='';
 if(selectedTime){$('summary').textContent=formatDate(date)+' · '+selectedTime;$('summary-price').textContent=money(service().price);updateMessage();}
}
function updateMessage(){$('message-preview').textContent=message(service(),date,selectedTime,$('client-name').value.trim());$('whatsapp-button').disabled=!config.phone;if(!config.phone)$('request-error').textContent='O WhatsApp do Studio ainda não foi configurado pela profissional.';}
$('client-name').oninput=updateMessage;
$('service-select').onchange=e=>selectService(e.target.value);
for(const [id,offset] of [['prev-month',-1],['next-month',1]])$(id).onclick=()=>{const [y,m]=month.split('-').map(Number);const d=new Date(y,m-1+offset,1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');date=null;selectedTime=null;renderTimes();loadCalendar();};
$('whatsapp-button').onclick=async()=>{
 // Open synchronously to preserve mobile browser's user-initiated navigation permission.
 const target=window.open('about:blank','_blank');if(target)target.opener=null;
 $('whatsapp-button').disabled=true;$('request-error').textContent='';
 try{const r=await api('request',{service:serviceId,date,time:selectedTime,name:$('client-name').value});if(target)target.location.href=r.url;else location.href=r.url;toast('Envie a mensagem no WhatsApp e aguarde a confirmação.');}
 catch(e){if(target)target.close();$('request-error').textContent=e.message;await loadCalendar();}
 finally{$('whatsapp-button').disabled=!config.phone;}
};
$('contact-button').onclick=()=>{if(!config.phone){$('contact-error').textContent='Contato do WhatsApp ainda não configurado pela profissional.';return;}window.open('https://wa.me/'+config.phone+'?text='+encodeURIComponent('Olá, Tatiane! Gostaria de conversar sobre meu atendimento.'),'_blank','noopener,noreferrer');};

function logout(){sessionStorage.removeItem('studio-admin');key='';$('admin-key').value='';$('admin-content').hidden=true;$('logout').hidden=true;$('login-form').hidden=false;appointments=[];allClients=[];$('appointments').replaceChildren();$('clients-list').replaceChildren();}
$('logout').onclick=logout;
$('login-form').onsubmit=async e=>{e.preventDefault();key=$('admin-key').value.trim();$('login-error').textContent='';try{await api('admin/session',null,true);sessionStorage.setItem('studio-admin',key);$('admin-key').value='';await openAdmin();}catch(e){$('login-error').textContent=e.message;}};
async function openAdmin(){$('login-form').hidden=true;$('admin-content').hidden=false;$('logout').hidden=false;$('admin-date').value=config.today;renderEditor();await loadAppointments();}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));for(const tab of ['agenda','settings','clients'])$('tab-'+tab).hidden=tab!==b.dataset.tab;if(b.dataset.tab==='clients')loadClients();});
function endDate(start,offset){const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
async function loadAppointments(){
 const from=$('admin-date').value;if(!from)return;const to=endDate(from,Number($('admin-period').value)-1);$('agenda-error').textContent='';
 try{appointments=await api(`admin/appointments?from=${from}&to=${to}`,null,true);renderAppointments();}catch(e){$('agenda-error').textContent=e.message;}
}
function renderAppointments(){
 const active=appointments.filter(a=>a.status==='confirmed'),attended=active.filter(a=>a.kind==='appointment');
 $('agenda-stats').innerHTML=`<div class="stat"><strong>${attended.length}</strong>Atendimentos</div><div class="stat"><strong>${active.filter(a=>a.kind==='block').length}</strong>Bloqueios</div><div class="stat"><strong>${money(attended.reduce((sum,a)=>sum+a.price,0))}</strong>Valor previsto no período</div>`;
 $('appointments').innerHTML=appointments.length?appointments.map(a=>`<article class="appointment-row ${a.status==='cancelled'?'cancelled':''}"><div><p class="date-label">${formatDate(a.date)} · ${time(a.start)} a ${time(a.end)}</p><h3>${escape(a.service_name)}</h3><p>${escape(a.client_name)}${a.client_phone?' · '+escape(a.client_phone):''}${a.kind==='appointment'?' · '+money(a.price):''}</p></div><div class="appointment-actions">${a.status==='confirmed'?`<span class="status-label">${a.kind==='block'?'Bloqueado':'Confirmado'}</span><button class="btn btn-outline-plum" data-edit="${a.id}">Alterar</button><button class="btn btn-outline-plum" data-cancel="${a.id}">${a.kind==='block'?'Liberar':'Cancelar'}</button>`:'<span class="status-label">Cancelado</span>'}</div></article>`).join(''):'<div class="empty-state">Nenhum atendimento ou bloqueio neste período.<br>Registre os horários confirmados pelo WhatsApp.</div>';
 document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editAppointment(appointments.find(a=>a.id===b.dataset.edit)));
 document.querySelectorAll('[data-cancel]').forEach(b=>b.onclick=()=>{cancelId=b.dataset.cancel;$('cancel-error').textContent='';$('cancel-dialog').showModal();});
}
$('refresh-agenda').onclick=loadAppointments;$('admin-date').onchange=loadAppointments;$('admin-period').onchange=loadAppointments;
$('new-appointment').onclick=()=>editAppointment();$('new-block').onclick=()=>editAppointment(null,'block');
function editAppointment(a=null,kind='appointment'){
 kind=a?.kind||kind;$('appointment-form').reset();$('appointment-error').textContent='';$('edit-id').value=a?.id||'';$('edit-kind').value=kind;
 $('dialog-title').textContent=kind==='block'?'Bloquear horário':a?'Alterar atendimento':'Registrar atendimento';$('dialog-help').textContent=kind==='block'?'Use para pausas, compromissos e períodos sem atendimento.':'Registre somente após confirmar com a cliente pelo WhatsApp.';
 $('appointment-fields').hidden=kind==='block';$('block-fields').hidden=kind!=='block';$('edit-name').required=kind==='appointment';$('edit-service').innerHTML=options();
 if(a){$('edit-service').value=a.service_id;$('edit-name').value=a.client_name;$('edit-phone').value=a.client_phone;}
 $('edit-date').min=config.today;$('edit-date').value=a?.date||$('admin-date').value||config.today;$('edit-time').value=a?time(a.start):'09:00';$('edit-duration').value=a?a.end-a.start:60;$('appointment-dialog').showModal();
}
$('close-dialog').onclick=()=>$('appointment-dialog').close();
$('appointment-form').onsubmit=async e=>{e.preventDefault();const [h,m]=$('edit-time').value.split(':').map(Number);$('save-appointment').disabled=true;$('appointment-error').textContent='';try{await api('admin/appointment',{id:$('edit-id').value,kind:$('edit-kind').value,service:$('edit-service').value,name:$('edit-name').value,phone:$('edit-phone').value,date:$('edit-date').value,start:h*60+m,duration:Number($('edit-duration').value)},true);$('appointment-dialog').close();toast('Agenda atualizada.');await loadAppointments();}catch(e){$('appointment-error').textContent=e.message;}finally{$('save-appointment').disabled=false;}};
$('cancel-back').onclick=()=>$('cancel-dialog').close();
$('cancel-confirm').onclick=async()=>{$('cancel-confirm').disabled=true;try{await api('admin/appointment',{action:'cancel',id:cancelId},true);$('cancel-dialog').close();toast('Horário liberado.');await loadAppointments();}catch(e){$('cancel-error').textContent=e.message;}finally{$('cancel-confirm').disabled=false;}};

function serviceEditor(s){return `<div class="service-edit" data-editor="${escape(s.id)}"><div class="row g-3"><div class="col-md-5"><label class="form-label" for="name-${escape(s.id)}">Nome</label><input id="name-${escape(s.id)}" data-field="name" value="${escape(s.name)}" class="form-control" maxlength="80" required></div><div class="col-md-3"><label class="form-label" for="category-${escape(s.id)}">Categoria</label><input id="category-${escape(s.id)}" data-field="category" value="${escape(s.category)}" class="form-control" maxlength="30"></div><div class="col-md-2 col-6"><label class="form-label" for="duration-${escape(s.id)}">Minutos</label><input id="duration-${escape(s.id)}" data-field="duration" type="number" value="${s.duration}" min="15" max="540" step="15" class="form-control" required></div><div class="col-md-2 col-6"><label class="form-label" for="price-${escape(s.id)}">Preço (R$)</label><input id="price-${escape(s.id)}" data-field="price" type="number" value="${(s.price/100).toFixed(2)}" min="0" max="100000" step=".01" class="form-control" required></div><div class="col-md-10"><label class="form-label" for="description-${escape(s.id)}">Descrição</label><input id="description-${escape(s.id)}" data-field="description" value="${escape(s.description)}" class="form-control" maxlength="200"></div><div class="col-md-2 d-flex align-items-end"><button type="button" class="btn btn-outline-plum w-100" data-remove="${escape(s.id)}">Remover</button></div></div></div>`;}
function bindRemove(){document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{if(document.querySelectorAll('[data-editor]').length===1){toast('Mantenha pelo menos um serviço.');return;}b.closest('[data-editor]').remove();});}
function renderEditor(){$('studio-phone').value=config.phone;$('service-editor').innerHTML=config.services.map(serviceEditor).join('');bindRemove();}
$('add-service').onclick=()=>{$('service-editor').insertAdjacentHTML('beforeend',serviceEditor({id:crypto.randomUUID(),name:'',category:'Cuidados',duration:60,price:0,description:''}));bindRemove();};
$('settings-form').onsubmit=async e=>{e.preventDefault();$('settings-result').textContent='';const services=[...document.querySelectorAll('[data-editor]')].map(row=>{const s={id:row.dataset.editor};row.querySelectorAll('[data-field]').forEach(input=>{s[input.dataset.field]=input.dataset.field==='price'?Math.round(Number(input.value)*100):input.dataset.field==='duration'?Number(input.value):input.value;});return s;});const button=e.submitter;button.disabled=true;try{await api('admin/settings',{phone:$('studio-phone').value,services},true);config=await api('catalog');$('settings-result').textContent='Configurações salvas. O catálogo e o WhatsApp já estão atualizados.';toast('Configurações salvas.');}catch(e){$('settings-result').textContent=e.message;}finally{button.disabled=false;}};
async function loadClients(){try{const records=await api('admin/appointments?from=2020-01-01&to=2100-12-31',null,true);const grouped=new Map();for(const a of records.filter(x=>x.kind==='appointment'&&x.status==='confirmed')){const id=a.client_name.toLocaleLowerCase()+'|'+a.client_phone;const c=grouped.get(id)||{name:a.client_name,phone:a.client_phone,count:0,last:a.date};c.count++;if(a.date>c.last)c.last=a.date;grouped.set(id,c);}allClients=[...grouped.values()].sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));renderClients();}catch(e){$('clients-list').textContent=e.message;}}
function renderClients(){const q=$('client-search').value.toLocaleLowerCase();const clients=allClients.filter(c=>(c.name+' '+c.phone).toLocaleLowerCase().includes(q));$('clients-list').innerHTML=clients.length?clients.map(c=>`<article class="appointment-row"><div><h3>${escape(c.name)}</h3><p>${escape(c.phone||'Telefone não informado')}</p></div><p>${c.count} atendimento(s) registrado(s)<br>Último registro: ${formatDate(c.last)}</p></article>`).join(''):'<div class="empty-state">Nenhuma cliente encontrada.</div>';}
$('client-search').oninput=renderClients;
async function init(){
 const isAdmin=location.pathname==='/admin';$('client-view').hidden=isAdmin;$('admin-view').hidden=!isAdmin;
 try{config=await api('catalog');serviceId=config.services[0].id;month=config.today.slice(0,7);
  if(isAdmin){if(key){try{await api('admin/session',null,true);await openAdmin();}catch(e){$('login-error').textContent=e.message;logout();}}}
  else{renderServices();renderTimes();await loadCalendar();}
 }catch(e){if(isAdmin)$('login-error').textContent=e.message;else $('service-list').innerHTML=`<p class="text-danger" role="alert">${escape(e.message)} Recarregue a página para tentar novamente.</p>`;}
}
// Refresh availability after returning from WhatsApp or another tab.
document.addEventListener('visibilitychange',async()=>{if(!document.hidden&&config&&location.pathname!=='/admin'){try{config=await api('catalog');if(!config.services.some(s=>s.id===serviceId))serviceId=config.services[0].id;renderServices();await loadCalendar();}catch{}}});
init();
