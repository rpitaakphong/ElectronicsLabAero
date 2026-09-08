const {unlockPresets}=require('./preset-helpers.cjs');
// Run with NODE_PATH pointing to a Playwright installation: node tests/simulator.cjs
const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app.js',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state','  window.labTest={state,loadPreset,solveCircuitWaveforms,validateCircuit,engParse,fmt};\n  // Initial state')}));
 await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/')+'index.html');await unlockPresets(page);await page.waitForTimeout(400);
 assert.deepEqual(errors,[]);
 const get=()=>page.evaluate(()=>JSON.parse(JSON.stringify(labTest.state)));
 const point=async(x,y)=>{await page.locator('#breadboardCanvas').scrollIntoViewIfNeeded();const r=await page.locator('#breadboardCanvas').boundingBox();return {x:r.x+(155+(x-120)*30/32)*r.width/1180,y:r.y+y*r.height/620};};
 const click=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);};
 const drag=async(x,y,tx,ty)=>{let p=await point(x,y),t=await point(tx,ty);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:8});await page.mouse.up();};
 let state=await get();assert.equal(state.components[0].model,'UA741');
 assert.equal(await page.locator('#presetSelect').inputValue(),'inverting');
 for(const name of ['follower','inverting','noninverting','lowpass','integrator']){
  const result=await page.evaluate(name=>{labTest.loadPreset(name);const sim=labTest.solveCircuitWaveforms();const pp=a=>Math.max(...a)-Math.min(...a);return {ratio:pp(sim.traces.ch2)/pp(sim.traces.ch1),finite:sim.traces.ch2.every(Number.isFinite),warnings:labTest.validateCircuit().warnings};},name);
  assert(result.finite);assert.deepEqual(result.warnings,[]);if(name==='follower')assert(Math.abs(result.ratio-1)<.01);if(name==='inverting')assert(Math.abs(result.ratio-4.7)<.05);if(name==='noninverting')assert(Math.abs(result.ratio-5.7)<.05);console.log('preset',name,result.ratio);
 }
 await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');
 await page.click('[data-tool=resistor]');await click(184,180);await click(312,240);
 state=await get();let part=state.components[0];assert.deepEqual(part.aHole,{row:'A',col:3});assert.deepEqual(part.bHole,{row:'C',col:7});
 await page.click('[data-tool=select]');await drag(248,210,280,240);
 part=(await get()).components[0];assert.deepEqual(part.aHole,{row:'B',col:4});assert.deepEqual(part.bHole,{row:'D',col:8});
 await page.click('#undoBtn');assert.deepEqual((await get()).components[0].aHole,{row:'A',col:3});await page.click('#redoBtn');
 // Reselect: undo / redo clears selection. Move only A to another row in its net.
 await page.selectOption('#componentList',part.id);await drag(216,210,216,180);part=(await get()).components[0];assert.deepEqual(part.aHole,{row:'A',col:4});assert.equal(part.a,'T:4');
 await page.click('#moveB');await click(408,410);part=(await get()).components[0];assert.equal(part.b,'B:10');assert.deepEqual(part.bHole,{row:'H',col:10});
 // Escape restores the original during a drag, without adding history.
 const before=JSON.stringify((await get()).components);const p=await point(312,295),t=await point(344,325);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(t.x,t.y,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(JSON.stringify((await get()).components),before);
 await page.selectOption('#componentList',part.id);await page.fill('#editValue','1M');await page.locator('#editValue').press('Tab');assert.equal((await get()).components[0].value,1e6);
 await page.click('[data-tool=generator]');await click(152,70);state=await get();assert.deepEqual(state.leadHoles.generator,{row:'VPLUS',col:2});
 await page.click('[data-tool=select]');await drag(152,70,248,110);assert.deepEqual((await get()).leadHoles.generator,{row:'GND_TOP',col:5});
 // Ground warning must compare connectivity before instrument ground merging.
 await page.evaluate(()=>{labTest.state.probes.ch1.gnd='T:1';labTest.state.probes.ch2.gnd='T:2';});assert((await page.evaluate(()=>labTest.validateCircuit().warnings)).some(x=>x.includes('shorts those nodes')));
 await page.selectOption('#presetSelect','inverting');await page.click('#loadPresetBtn');
 await page.selectOption('#componentList',{label:(await page.locator('#componentList option').allTextContents()).find(x=>x.includes('opamp'))});
 const op=(await get()).components[0];await drag(584,325,648,325);assert.equal((await get()).components[0].startCol,op.startCol+2);await page.click('#undoBtn');
 await page.click('#zoomInBtn');assert.equal(await page.locator('#zoomReadout').textContent(),'125%');await page.click('#fitBoardBtn');
 // Save/recall includes exact geometry and survives a page reload.
 await page.click('#saveLabBtn');const saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('gds1202b-lab'))).state;
 await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');await page.click('#recallLabBtn');assert.deepEqual((await get()).components,saved.components);
 await page.reload();await unlockPresets(page);await page.click('#recallLabBtn');assert.deepEqual((await get()).leadHoles,saved.leadHoles);
 const intact=JSON.stringify((await get()).components);await page.evaluate(()=>localStorage.setItem('gds1202b-lab','{broken'));await page.click('#recallLabBtn');assert.equal(JSON.stringify((await get()).components),intact);
 // A high-amplitude follower obeys output headroom and slew bounds.
 const limits=await page.evaluate(()=>{labTest.loadPreset('follower');labTest.state.generator.amplitude=20;labTest.state.generator.frequency=10000;const sim=labTest.solveCircuitWaveforms(),a=sim.traces.ch2;return {max:Math.max(...a),min:Math.min(...a),slew:Math.max(...a.slice(1).map((v,i)=>Math.abs(v-a[i])/sim.dt))};});
 assert(limits.max<=10.00001&&limits.min>=-10.00001);assert(limits.slew<=500001);
 await page.evaluate(()=>labTest.loadPreset('inverting'));await page.waitForTimeout(200);
 // Pan the board at 150% without moving circuit components.
 await page.click('#zoomInBtn');await page.click('#zoomInBtn');await page.click('[data-tool=pan]');const panBefore=JSON.stringify((await get()).components);await drag(600,200,400,200);assert(await page.locator('.breadboard-wrap').evaluate(el=>el.scrollLeft)>0);assert.equal(JSON.stringify((await get()).components),panBefore);await page.click('#fitBoardBtn');await page.click('[data-tool=select]');
 await page.screenshot({path:'/tmp/simulator-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/simulator-mobile.png',fullPage:true});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS: presets, hole positions, drag, terminals, leads, undo/redo, Escape, values, IC movement, zoom, mobile overflow');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
