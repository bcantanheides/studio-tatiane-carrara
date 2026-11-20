import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
const files={};
function walk(dir,prefix=''){for(const item of readdirSync(dir,{withFileTypes:true})){const route=prefix+'/'+item.name;if(item.isDirectory())walk(path.join(dir,item.name),route);else files[route]=readFileSync(path.join(dir,item.name),'utf8');}}
walk('public');files['/domain.js']=readFileSync('src/domain.js','utf8');
let api=readFileSync('src/api.js','utf8').replace(/^import .*?;\r?\n/,'');
let domain=readFileSync('src/domain.js','utf8').replace(/export /g,'');
const handler=`\nconst FILES=${JSON.stringify(files)};\nexport default {async fetch(request,env){const u=new URL(request.url);if(u.pathname.startsWith('/api/'))return api(request,env);const pathname=['/','/admin'].includes(u.pathname)?'/index.html':u.pathname;const content=FILES[pathname];if(content===undefined)return new Response('Página não encontrada',{status:404});const types={html:'text/html',js:'text/javascript',css:'text/css'};return new Response(content,{headers:{'Content-Type':(types[pathname.split('.').pop()]||'text/plain')+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':\"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'\"}});}};`;
mkdirSync('dist/server',{recursive:true});writeFileSync('dist/server/index.js',domain+'\n'+api+handler);console.log('Build concluído: HTML, CSS, Bootstrap, JavaScript e API em dist/server/index.js.');
