const {chromium}=require('playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1512,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state','  window.labTest={state,ensureRoutes,boardSnapshot,findComponentAt,leadPoint,updateAll,physicalHole};\n  // Initial state')}));
 const output=path.resolve('../../output/playwright/simulator-redesign');fs.mkdirSync(output,{recursive:true});
 await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/'));
 assert.equal(await page.title(),'Op-Amp Lab Simulator');
 assert(await page.locator('.lab-brand img').evaluate(img=>img.complete&&img.naturalWidth>0));
 assert.equal(await page.locator('.preset-manager').evaluate(el=>el.open),false);
 // True three-column layout, not just three elements that have wrapped.
 const layout=await page.evaluate(()=>['.toolbar','.breadboard-area','.circuit-controls'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width};}));
 assert.equal(layout[0].width,160);assert.equal(layout[2].width,280);assert(layout[0].x<layout[1].x&&layout[1].x<layout[2].x);assert.equal(layout[0].y,layout[2].y);
 await page.locator('#pinGuide summary').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#pinGuide').evaluate(el=>el.open),false);await page.keyboard.press('Enter');
 await page.click('[data-tool=wire]');assert.equal(await page.locator('[data-tool=wire]').getAttribute('aria-pressed'),'true');await page.click('[data-tool=select]');
 const presets=['inverting','follower','noninverting','lowpass','integrator'];
 for(const width of [1512,1024,390]){
   await page.setViewportSize({width,height:1100});
   for(const preset of presets){
     await page.selectOption('#presetSelect',preset);await page.click('#loadPresetBtn');
     const result=await page.evaluate(()=>{
       const before=labTest.boardSnapshot(),routes=labTest.ensureRoutes(),second=labTest.ensureRoutes();
       return {unchanged:before===labTest.boardSnapshot(),cached:routes===second,fallbacks:[...routes].filter(([id,r])=>r.fallback).map(([id])=>id),finite:[...routes.values()].every(r=>r.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))};
     });
     assert(result.unchanged&&result.cached&&result.finite);assert.deepEqual(result.fallbacks,[],`${preset}: normal presets must route without fallback`);
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${preset} overflow at ${width}`);
     await page.locator('.breadboard-wrap').screenshot({path:path.join(output,`${width}-${preset}-board.png`)});
   }
   await page.locator('.board-section').screenshot({path:path.join(output,`${width}-workspace.png`)});
 }
 // Collapsed phone guide is set on initial load, not forcibly reset during resizing.
 await page.reload();assert.equal(await page.locator('#pinGuide').evaluate(el=>el.open),false);
 await page.setViewportSize({width:1512,height:1100});
 await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');
 const point=async(x,y)=>{await page.locator('#breadboardCanvas').scrollIntoViewIfNeeded();const r=await page.locator('#breadboardCanvas').boundingBox();return {x:r.x+x*r.width/1180,y:r.y+y*r.height/620};};
 const click=async(x,y)=>{const p=await point(x,y);await page.mouse.click(p.x,p.y);};
 const holeClick=async(x,y)=>click(155+(x-120)*30/32,y);
 // A user-created crossing should stay short, avoid a resistor, and remain selectable.
 await page.click('[data-tool=resistor]');await click(365,240);await click(545,240);
 await page.click('[data-tool=wire]');await click(185,210);await click(845,210);
 await click(455,180);await click(455,470);
 const crossingCheck=await page.evaluate(()=>{
   const routes=labTest.ensureRoutes(),wires=labTest.state.components.filter(c=>c.type==='wire');
   return wires.map(w=>{const r=routes.get(w.id);return {id:w.id,...r,selectable:r.points.slice(1).map((b,i)=>{const a=r.points[i];return labTest.findComponentAt((a.x+b.x)/2,(a.y+b.y)/2)?.id===w.id;})};});
 });
 assert(crossingCheck.some(r=>r.bridges.length>0));
 assert(crossingCheck.every(r=>!r.fallback&&r.selectable.every(Boolean)));
 assert.equal(crossingCheck[0].points.length,2,'horizontal wire should remain straight');
 await page.locator('.breadboard-wrap').screenshot({path:path.join(output,'wire-crossing-around-component.png')});
 await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');
 await page.click('[data-tool=wire]');await holeClick(184,180);await holeClick(440,380);
 await page.click('[data-tool=select]');
 const before=await page.evaluate(()=>labTest.boardSnapshot());
 const target=await page.evaluate(()=>{const w=labTest.state.components[0],r=labTest.ensureRoutes().get(w.id);let segment=1;for(let i=2;i<r.points.length;i++)if(Math.hypot(r.points[i].x-r.points[i-1].x,r.points[i].y-r.points[i-1].y)>Math.hypot(r.points[segment].x-r.points[segment-1].x,r.points[segment].y-r.points[segment-1].y))segment=i;return {id:w.id,x:(r.points[segment].x+r.points[segment-1].x)/2,y:(r.points[segment].y+r.points[segment-1].y)/2};});
 await click(target.x,target.y);assert.equal(await page.locator('#componentList').inputValue(),target.id);
 assert.equal(await page.locator('.editor-advanced').evaluate(el=>el.open),false);
 const start=await point(target.x,target.y),end=await point(target.x+30,target.y);
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:6});await page.mouse.up();
 assert.equal(await page.evaluate(()=>labTest.state.components[0].aHole.col),4);
 await page.click('#undoBtn');assert.equal(await page.evaluate(()=>labTest.boardSnapshot()),before);
 await page.click('#redoBtn');assert.equal(await page.evaluate(()=>labTest.state.components[0].aHole.col),4);
 await page.click('#saveLabBtn');await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');await page.click('#recallLabBtn');
 assert.equal(await page.evaluate(()=>labTest.state.components[0].aHole.col),4);
 // Reconnect using the same endpoint handles, then erase via the newly routed body.
 await page.selectOption('#componentList',target.id);await page.click('#moveB');await holeClick(472,410);
 const erasePoint=await page.evaluate(()=>{const r=labTest.ensureRoutes().get(labTest.state.components[0].id);const a=r.points[0],b=r.points[1];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};});
 await page.click('[data-tool=erase]');await click(erasePoint.x,erasePoint.y);assert.equal(await page.evaluate(()=>labTest.state.components.length),0);
 await page.click('#undoBtn');assert.equal(await page.evaluate(()=>labTest.state.components.length),1);
 // Hidden exact controls can be expanded by keyboard and remain open after a same-part update.
 await page.selectOption('#componentList',target.id);await page.locator('.editor-advanced > summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#aRow').isVisible());
 await page.selectOption('#aRow','B');await page.click('#applyPosition');assert(await page.locator('#aRow').isVisible());
 // A lead can be selected and erased by its routed cable, not just by its tiny tip.
 await page.selectOption('#presetSelect','blank');await page.click('#loadPresetBtn');await page.click('[data-tool=ch1tip]');await holeClick(248,240);await page.click('[data-tool=select]');
 const leadTarget=await page.evaluate(()=>{const r=labTest.ensureRoutes().get('ch1tip'),a=r.points.at(-2),b=r.points.at(-1);return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};});
 await click(leadTarget.x,leadTarget.y);assert.equal(await page.locator('#componentList').inputValue(),'ch1tip');
 await page.click('[data-tool=erase]');await click(leadTarget.x,leadTarget.y);assert.equal(await page.evaluate(()=>labTest.state.probes.ch1.tip),null);
 // Portable file works directly from disk and has no external runtime assets.
 const portable=await browser.newPage({viewport:{width:1512,height:1100}}),requests=[];portable.on('pageerror',e=>errors.push(e.message));portable.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 await portable.goto('file://'+path.resolve(process.env.SIMULATOR_OFFLINE_PATH || 'gds1202b_opamp_sim_single_file.html'));
 await portable.selectOption('#presetSelect','follower');await portable.click('#loadPresetBtn');
 assert.equal(await portable.title(),'Op-Amp Lab Simulator');assert(await portable.locator('.lab-brand img').evaluate(img=>img.complete&&img.naturalWidth>0));assert.deepEqual(requests,[]);
 assert.equal(await portable.locator('#circuitStatus').textContent(),'Circuit electrically runnable');
 assert.deepEqual(errors,[]);
 console.log('PASS: three columns, branding, keyboard disclosures, tool states, 15 responsive preset views, route caching/topology, routed selection/drag/reconnect/erase/undo/recall, offline portable file');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
