const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../charts');

test('empty series stays text and chart captions escape markup',()=>{assert.match(C.empty('还没有'),/class="empty"/);const svg=C.barChart(['10-20'],[{name:'<场次>',values:[2],color:'#c7e6ad'}],'<每周>');assert.match(svg,/&lt;每周&gt;/);assert.match(svg,/&lt;场次&gt;/);assert.match(svg,/viewBox="0 0 620 230"/);assert.match(svg,/查看图表数据/);});
test('line chart draws points and refuses an empty series',()=>{assert.match(C.lineChart([],'体重'),/还没有可绘制的记录/);const svg=C.lineChart([{date:'2026-10-20',value:70.5},{date:'2026-10-24',value:71}],'体重7天记录均值');assert.match(svg,/polyline/);assert.match(svg,/70\.5/);assert.match(svg,/10-24/);});
