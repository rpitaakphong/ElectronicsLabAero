const {unlockPresets}=require('./preset-helpers.cjs');
const {chromium}=require('playwright');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/app.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state','  window.labTest={state,loadPreset,holeOccupants,boardSnapshot,history};\n  // Initial state')}));
 await p.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/')+'index.html');await unlockPresets(p);await p.waitForTimeout(200);
 const get=()=>p.evaluate(()=>JSON.parse(labTest.boardSnapshot()));
 const noOverlap=()=>p.evaluate(()=>{const holes=labTest.holeOccupants().map(x=>`${x.hole.row}:${x.hole.col}`);return holes.length===new Set(holes).size;});
 for(const name of ['inverting','follower','noninverting','lowpass','integrator']){await p.selectOption('#presetSelect',name);await p.click('#loadPresetBtn');assert(await noOverlap(),name);}
 await p.selectOption('#presetSelect','blank');await p.click('#loadPresetBtn');
 const point=async(row,col)=>{await p.locator('#breadboardCanvas').scrollIntoViewIfNeeded();const r=await p.locator('#breadboardCanvas').boundingBox(),ys={A:180,B:210,C:240,D:270,E:300,F:350,G:380,H:410,I:440,J:470};return {x:r.x+(155+(col-1)*30)*r.width/1180,y:r.y+ys[row]*r.height/620};};
 const click=async(row,col)=>{const h=await point(row,col);await p.mouse.click(h.x,h.y);};
 await p.click('[data-tool=wire]');await click('A',1);await click('A',2);assert.equal((await get()).components.length,1);
 const historyCount=await p.evaluate(()=>labTest.history.past.length);await click('A',1);assert.equal(await p.evaluate(()=>labTest.state.pendingHole),null);assert.equal(await p.evaluate(()=>labTest.history.past.length),historyCount);
 await click('B',1);await click('A',2);assert.deepEqual(await p.evaluate(()=>labTest.state.pendingHole),{row:'B',col:1});await click('B',2);assert.equal((await get()).components.length,2);assert(await noOverlap());
 await p.click('[data-tool=resistor]');await click('A',1);assert.equal((await get()).components.length,2);await click('C',3);await click('C',4);assert.equal((await get()).components.length,3);
 await p.click('[data-tool=ch1tip]');await click('A',1);assert.equal((await get()).probes.ch1.tip,null);await click('C',1);await p.click('[data-tool=ch2tip]');await click('C',1);assert.equal((await get()).probes.ch2.tip,null);
 await p.selectOption('#componentList','ch1tip');await p.locator('.editor-advanced > summary').filter({hasText:'Exact position'}).click();await p.selectOption('#leadRow','A');await p.fill('#leadCol','1');await p.click('#applyPosition');assert.deepEqual((await get()).leadHoles.ch1tip,{row:'C',col:1});
 const second=(await get()).components[1];await p.selectOption('#componentList',second.id);await p.locator('.editor-advanced > summary').filter({hasText:'Exact position'}).click();await p.selectOption('#aRow','A');await p.fill('#aCol','1');await p.selectOption('#bRow','D');await p.fill('#bCol','8');await p.click('#applyPosition');assert.deepEqual((await get()).components[1],second);
 // Keyboard whole-part move up would collide with the first wire.
 await p.locator('#breadboardCanvas').focus();await p.keyboard.press('ArrowUp');assert.deepEqual((await get()).components[1],second);
 // Drag terminal into a used hole; the entire attempted move rolls back.
 const start=await point('B',1),end=await point('A',2);await p.mouse.move(start.x,start.y);await p.mouse.down();await p.mouse.move(end.x,end.y,{steps:5});await p.mouse.up();assert.deepEqual((await get()).components[1],second);assert(await noOverlap());
 // Reconnect-by-click also rejects the target and remains pending.
 await p.click('#moveA');await click('A',1);assert.deepEqual((await get()).components[1],second);await p.keyboard.press('Escape');
 // Pins reserve all eight physical holes.
 await p.click('[data-tool=wire]');await click('E',3);await click('A',8);await p.click('[data-tool=opamp]');await click('E',2);assert(!(await get()).components.some(c=>c.type==='opamp'));
 await click('E',10);const op=(await get()).components.find(c=>c.type==='opamp');assert(op);await p.click('[data-tool=capacitor]');await click('F',10);assert.equal(await p.evaluate(()=>labTest.state.pendingHole),null);
 // IC numeric placement cannot move onto the wire at E3.
 await p.selectOption('#componentList',op.id);await p.locator('.editor-advanced > summary').filter({hasText:'Exact position'}).click();await p.fill('#editColumn','1');await p.locator('#editColumn').press('Tab');assert.equal((await get()).components.find(c=>c.id===op.id).startCol,op.startCol);
 // Old duplicate saves are repaired on their original electrical nets.
 await p.click('#saveLabBtn');await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('gds1202b-lab'));d.state.components[1].aHole={...d.state.components[0].aHole};localStorage.setItem('gds1202b-lab',JSON.stringify(d));});await p.click('#recallLabBtn');assert(await noOverlap());assert.equal((await get()).components[1].a,'T:1');
 // An impossible saved layout is rejected atomically.
 const before=await get();await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('gds1202b-lab'));d.state.components=Array.from({length:6},(_,i)=>({id:'R'+(i+1),type:'resistor',value:1000,a:'T:1',b:'T:2',aHole:{row:'A',col:1},bHole:{row:'A',col:2}}));d.state.probes={ch1:{tip:null,gnd:null},ch2:{tip:null,gnd:null}};localStorage.setItem('gds1202b-lab',JSON.stringify(d));});await p.click('#recallLabBtn');assert.deepEqual(await get(),before);assert((await p.locator('#toast').textContent()).includes('No free hole'));
 assert.deepEqual(errors,[]);console.log('PASS: preset occupancy, wires/components/probes, fields, nudges, drag rollback, reconnection, all IC pins, same-net migration, atomic rejection.');await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
