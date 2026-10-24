const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('all local scripts exist and muscle model loads before application code',()=>{const scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m=>m[1].split('?')[0]);assert.ok(scripts.includes('muscle-map.js'));assert.ok(scripts.indexOf('muscle-map.js')<scripts.indexOf('app.js'));for(const file of scripts)assert.ok(fs.existsSync(path.join(root,file)),file);});
test('static HTML IDs are unique; application literal IDs resolve to static or generated markup',()=>{const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);const known=new Set([...ids,...[...app.matchAll(/id="([a-z][a-z0-9-]*)"/g)].map(m=>m[1])]);for(const match of app.matchAll(/\$\('([a-z][a-z0-9-]*)'\)/g))assert.ok(known.has(match[1]),match[1]);});
test('viewport and mobile navigation expose the requested three main routes',()=>{assert.match(html,/width=device-width,initial-scale=1,viewport-fit=cover/);for(const tab of ['today','tree','stats']){assert.match(html,new RegExp(`data-tab="${tab}"`));assert.match(html,new RegExp(`id="view-${tab}"`));}});
test('model has date, front/back, goal/logged controls and a non-physiological energy explanation',()=>{for(const side of ['front','back','both'])assert.match(html,new RegExp(`data-body-side="${side}"`));for(const mode of ['goal','logged'])assert.match(html,new RegExp(`data-body-mode="${mode}"`));assert.match(html,/id="body-date"/);assert.match(html,/不是生理能量、恢复程度或增肌预测/);});
