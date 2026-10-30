import test from 'node:test';
import assert from 'node:assert/strict';
import {remainingViewingWindows,viewingAdvice} from '../js/viewing-advice.js';
const date=s=>new Date(`2026-10-30T${s}:00Z`);
const windows=[{start:date('12:00'),end:date('14:00'),peak:date('13:00')},{start:date('15:00'),end:date('17:00'),peak:date('16:00')}];
test('elapsed windows and elapsed peaks cannot be recommended',()=>{
 const from=date('13:30'),remaining=remainingViewingWindows(windows,from);
 assert.equal(+remaining[0].start,+from);assert.equal(+remaining[0].peak,+from);
 assert.equal(+windows[0].start,+date('12:00'));
 const advice=viewingAdvice(from,windows,25.033,121.565);
 assert.equal(advice.kind,'window');assert.ok(+advice.result.date>=+from);
 assert.ok(+advice.result.date>=+advice.window.start&&+advice.result.date<=+advice.window.end);
});
test('no eligible interval and ended intervals are distinct states',()=>{
 assert.equal(viewingAdvice(date('12:00'),[],25,121).kind,'none');
 assert.equal(viewingAdvice(date('17:00'),windows,25,121).kind,'ended');
});
test('weather is used only with complete candidate coverage',()=>{
 const forecast=[];for(let hour=12;hour<=17;hour++)forecast.push({time:+date(`${hour}:00`),cloud:10,rain:0});
 assert.ok(viewingAdvice(date('12:00'),windows,25,121,forecast).result.forecast);
 assert.equal(viewingAdvice(date('12:00'),windows,25,121,forecast.slice(0,1)).result.forecast,null);
});
