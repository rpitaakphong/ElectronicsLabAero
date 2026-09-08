const {chromium}=require('playwright');const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const legacy=JSON.parse(fs.readFileSync('tests/fixtures/legacy-pinout.json','utf8')).presets;
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1512,height:1100},acceptDownloads:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const expose='  window.labTest={state,opampPins,componentHoles,normalizeSavedLab,restoreLab,boardSnapshot,presetSnapshot,loadPreset,solveCircuitWaveforms,validateCircuit,buildConnectivity,buildNetlist};\n  // Initial state';
 await page.route('**/app.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state',expose)}));
 await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/'));
 const empty=await page.evaluate(()=>{labTest.loadPreset('blank',true);return labTest.boardSnapshot();});
 for(const [name,fixture] of Object.entries(legacy)){
   const raw=JSON.stringify(fixture.snapshot);
   await page.evaluate(raw=>localStorage.setItem('gds1202b-lab',raw),raw);await page.click('#recallLabBtn');
   assert(await page.locator('#pinoutNotice').isVisible());assert.equal(await page.evaluate(()=>localStorage.getItem('gds1202b-lab')),raw);
   const result=await page.evaluate(()=>{const sim=labTest.solveCircuitWaveforms(),samples=[];for(let i=Math.floor(sim.traces.t.length/2);i<sim.traces.t.length;i+=40)samples.push([sim.traces.t[i],sim.traces.ch1[i],sim.traces.ch2[i]]);return {samples,board:JSON.parse(labTest.boardSnapshot()),warnings:labTest.validateCircuit().warnings};});
   assert.deepEqual(result.warnings,[]);assert.equal(result.samples.length,fixture.samples.length);
   for(let i=0;i<result.samples.length;i++)for(let j=0;j<3;j++)assert(Math.abs(result.samples[i][j]-fixture.samples[i][j])<1e-7,`${name} migration changed waveform at ${i}/${j}`);
   assert.equal(result.board.generatorNode,fixture.snapshot.state.generatorNode.replace(/^([TB]):/,(_,h)=>(h==='T'?'B':'T')+':'));
   const board=await page.evaluate(()=>labTest.boardSnapshot());await page.click('#undoBtn');await page.click('#redoBtn');assert.equal(await page.evaluate(()=>labTest.boardSnapshot()),board);
   await page.click('#saveLabBtn');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gds1202b-lab')).pinoutVersion),2);await page.click('#recallLabBtn');assert.equal(await page.evaluate(()=>labTest.boardSnapshot()),board);assert(!await page.locator('#pinoutNotice').isVisible());
   console.log('PASS legacy waveform and one-time conversion:',name);
 }
 // An explicit physical follower: IN+ at F16/B16, OUT at E16/T16, IN− at F15/B15.
 const explicit=JSON.parse(JSON.stringify(legacy.follower.snapshot));explicit.pinoutVersion=2;
 const state=explicit.state,op=state.components.find(c=>c.type==='opamp');
 state.components=[op,
  {id:'W90',type:'wire',a:'VPLUS',b:'T:15',aHole:{row:'VPLUS',col:15},bHole:{row:'D',col:15}},
  {id:'W91',type:'wire',a:'VMINUS',b:'B:17',aHole:{row:'VMINUS',col:17},bHole:{row:'G',col:17}},
  {id:'W92',type:'wire',a:'T:16',b:'B:15',aHole:{row:'D',col:16},bHole:{row:'G',col:15}}];
 state.generatorNode='B:16';state.generator.groundNode='GND';state.generator.ttlNode=null;
 state.probes={ch1:{tip:'B:16',gnd:'GND'},ch2:{tip:'T:16',gnd:'GND'}};
 state.leadHoles={generator:{row:'G',col:16},gengnd:{row:'GND_TOP',col:22},ch1tip:{row:'H',col:16},ch2tip:{row:'C',col:16},ch1gnd:{row:'GND_TOP',col:20},ch2gnd:{row:'GND_BOTTOM',col:21}};
 assert(await page.evaluate(d=>labTest.restoreLab(d),explicit));
 const physical=await page.evaluate(()=>{const sim=labTest.solveCircuitWaveforms();const x=sim.traces.ch1.slice(1000),y=sim.traces.ch2.slice(1000);return {pins:labTest.opampPins(labTest.state.components[0]),gain:x.reduce((s,v,i)=>s+v*y[i],0)/x.reduce((s,v)=>s+v*v,0),warnings:labTest.validateCircuit().warnings};});
 assert.deepEqual(physical.pins,{1:'B:14',2:'B:15',3:'B:16',4:'B:17',5:'T:17',6:'T:16',7:'T:15',8:'T:14'});assert(Math.abs(physical.gain-1)<.01);assert.deepEqual(physical.warnings,[]);
 const wrong=JSON.parse(JSON.stringify(explicit));wrong.state.components[1].b='B:15';wrong.state.components[1].bHole={row:'H',col:15};
 assert(await page.evaluate(d=>labTest.restoreLab(d),wrong));assert((await page.evaluate(()=>labTest.validateCircuit().warnings)).some(m=>m.includes('pin 7 (V+)')));
 // Signed complex gains use actual traces and analytic circuit relationships.
 for(const name of ['follower','inverting','noninverting','lowpass','integrator']){
  const r=await page.evaluate(name=>{labTest.loadPreset(name,true);const s=labTest.solveCircuitWaveforms(),t=s.traces.t,start=Math.floor(t.length/2),w=2*Math.PI*labTest.state.generator.frequency;const coef=a=>{let sin=0,cos=0;for(let i=start;i<t.length;i++){sin+=a[i]*Math.sin(w*t[i]);cos+=a[i]*Math.cos(w*t[i]);}return {sin,cos};};const x=coef(s.traces.ch1),y=coef(s.traces.ch2),d=x.sin*x.sin+x.cos*x.cos;return {real:(x.sin*y.sin+x.cos*y.cos)/d,imag:(x.sin*y.cos-x.cos*y.sin)/d,warnings:labTest.validateCircuit().warnings};},name);
  const f=name==='lowpass'?500:200,tau=name==='lowpass'?.001:.01,k=2*Math.PI*f*tau;
  const expected=name==='follower'?[1,0]:name==='inverting'?[-4.7,0]:name==='noninverting'?[5.7,0]:name==='lowpass'?[1/(1+k*k),-k/(1+k*k)]:[-10/(1+k*k),10*k/(1+k*k)];
  assert(Math.abs(r.real-expected[0])<.07&&Math.abs(r.imag-expected[1])<.07,`${name} signed gain ${JSON.stringify(r)} != ${expected}`);assert.deepEqual(r.warnings,[]);console.log('PASS signed gain:',name,r.real,r.imag);
 }
 // Allocate net-only legacy saves before reflecting, and validate malformed data atomically.
 const netOnly=JSON.parse(JSON.stringify(legacy.inverting.snapshot));delete netOnly.state.leadHoles;for(const c of netOnly.state.components){delete c.aHole;delete c.bHole;}
 assert(await page.evaluate(d=>labTest.restoreLab(d),netOnly));assert.deepEqual(await page.evaluate(()=>labTest.validateCircuit().warnings),[]);
 const current=await page.evaluate(()=>labTest.boardSnapshot());
 for(const invalid of [null,{...explicit,pinoutVersion:3},{...explicit,pinoutVersion:null},{state:{}},{...explicit,scope:{measure:{items:null}}},{...explicit,scope:{ch1:{voltsDiv:0}}},{...explicit,scope:{cursor:{source:'INVALID'}}},{...explicit,state:{...explicit.state,generator:{...explicit.state.generator,ttlNode:'T:99'}}}]){
  assert.equal(await page.evaluate(d=>labTest.restoreLab(d),invalid),false);assert.equal(await page.evaluate(()=>labTest.boardSnapshot()),current);
 }
 // Two cascaded followers exercise shared connections across different IC column ranges.
 const cascade=JSON.parse(JSON.stringify(explicit));cascade.state.components.push({...op,id:'U99',startCol:23},
  {id:'W93',type:'wire',a:'VPLUS',b:'T:24',aHole:{row:'VPLUS',col:24},bHole:{row:'D',col:24}},
  {id:'W94',type:'wire',a:'VMINUS',b:'B:26',aHole:{row:'VMINUS',col:26},bHole:{row:'G',col:26}},
  {id:'W95',type:'wire',a:'T:25',b:'B:24',aHole:{row:'D',col:25},bHole:{row:'G',col:24}},
  {id:'W96',type:'wire',a:'T:16',b:'B:25',aHole:{row:'B',col:16},bHole:{row:'G',col:25}});
 cascade.state.probes.ch2.tip='T:25';cascade.state.leadHoles.ch2tip={row:'C',col:25};
 assert(await page.evaluate(d=>labTest.restoreLab(d),cascade));
 const cascadeTrace=await page.evaluate(()=>labTest.solveCircuitWaveforms().traces);
 const multi=JSON.parse(JSON.stringify(cascade));delete multi.pinoutVersion;
 // Independent inverse of the legacy physical mapping; do not use production migration here.
 const swapNode=n=>n?.replace(/^([TB]):/,(_,h)=>(h==='T'?'B':'T')+':');
 const reflectedRows={A:'J',B:'I',C:'H',D:'G',E:'F',F:'E',G:'D',H:'C',I:'B',J:'A'};
 const swapHole=h=>({...h,row:reflectedRows[h.row]||h.row});
 for(const c of multi.state.components)if(c.type!=='opamp')for(const end of ['a','b']){c[end]=swapNode(c[end]);c[end+'Hole']=swapHole(c[end+'Hole']);}
 multi.state.generatorNode=swapNode(multi.state.generatorNode);for(const k of ['ttlNode','groundNode'])multi.state.generator[k]=swapNode(multi.state.generator[k]);
 for(const ch of ['ch1','ch2'])for(const end of ['tip','gnd'])multi.state.probes[ch][end]=swapNode(multi.state.probes[ch][end]);for(const key of Object.keys(multi.state.leadHoles))multi.state.leadHoles[key]=swapHole(multi.state.leadHoles[key]);
 assert(await page.evaluate(d=>labTest.restoreLab(d),multi));assert.deepEqual(await page.evaluate(()=>labTest.validateCircuit().warnings),[]);
 const restoredTrace=await page.evaluate(()=>labTest.solveCircuitWaveforms().traces);assert.deepEqual(restoredTrace,cascadeTrace);
 const cascadeGain=cascadeTrace.ch1.reduce((sum,v,i)=>sum+v*cascadeTrace.ch2[i],0)/cascadeTrace.ch1.reduce((sum,v)=>sum+v*v,0);assert(Math.abs(cascadeGain-1)<.01);
 const passive=JSON.parse(JSON.stringify(explicit));delete passive.pinoutVersion;passive.state.components=passive.state.components.filter(c=>c.type!=='opamp');
 const passiveResult=await page.evaluate(d=>labTest.normalizeSavedLab(d),passive);assert.equal(passiveResult.converted,false);assert.deepEqual(passiveResult.envelope.state,passive.state);
 // Startup overwritten presets, custom presets, and exports use the same conversion.
 const rawPreset=JSON.stringify(legacy.inverting.snapshot),rawCustom=JSON.stringify(legacy.follower.snapshot);
 await page.evaluate(({rawPreset,rawCustom})=>{localStorage.setItem('gds1202b-preset-inverting',rawPreset);localStorage.setItem('gds1202b-preset-custom-legacy',rawCustom);localStorage.setItem('gds1202b-custom-presets',JSON.stringify([{id:'custom-legacy',name:'Legacy follower'}]));},{rawPreset,rawCustom});
 await page.reload();assert(await page.locator('#pinoutNotice').isVisible());await page.selectOption('#presetSelect','custom-legacy');await page.click('#loadPresetBtn');assert(await page.locator('#pinoutNotice').isVisible());
 await page.click('#dismissPinoutNotice');assert(!await page.locator('#pinoutNotice').isVisible());await page.click('#loadPresetBtn');assert(await page.locator('#pinoutNotice').isVisible());
 const allStorage=()=>page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))));
 const beforeExport=await allStorage();await page.locator('.preset-manager > summary').click();const downloadEvent=page.waitForEvent('download');await page.click('#exportPresetsBtn');const download=await downloadEvent;const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(exported.presets.length,2);assert(exported.presets.every(p=>p.preset.pinoutVersion===2));assert.equal(await allStorage(),beforeExport);
 assert.equal(exported.presets.find(p=>p.id==='inverting').preset.state.generatorNode,'B:8');
 const exportBoard=await page.evaluate(()=>labTest.boardSnapshot());await page.evaluate(()=>localStorage.setItem('gds1202b-preset-invalid',JSON.stringify({pinoutVersion:99,state:{components:[]}})));let badDownload=false;const badListener=()=>badDownload=true;page.on('download',badListener);await page.click('#exportPresetsBtn');await page.waitForTimeout(150);assert(!badDownload);page.off('download',badListener);assert.equal(await page.evaluate(()=>labTest.boardSnapshot()),exportBoard);await page.evaluate(()=>localStorage.removeItem('gds1202b-preset-invalid'));
 await page.click('#savePresetBtn');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('gds1202b-preset-custom-legacy')).pinoutVersion),2);await page.click('#loadPresetBtn');assert(!await page.locator('#pinoutNotice').isVisible());assert.equal(await page.evaluate(()=>localStorage.getItem('gds1202b-preset-inverting')),rawPreset);
 // Both diagrams use a rotation: the upper board labels are 8,7,6,5.
 const upper=await page.locator('.orientation-diagram [data-pin]').evaluateAll(nodes=>nodes.filter(n=>Number(n.getAttribute('y'))<0).sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x'))).map(n=>n.textContent));assert.deepEqual(upper,['8','7','6','5']);
 const lower=await page.locator('.orientation-diagram [data-pin]').evaluateAll(nodes=>nodes.filter(n=>Number(n.getAttribute('y'))>0).sort((a,b)=>Number(a.getAttribute('x'))-Number(b.getAttribute('x'))).map(n=>n.textContent));assert.deepEqual(lower,['1','2','3','4']);
 const output=path.resolve('../../output/playwright/simulator-redesign');fs.mkdirSync(output,{recursive:true});
 for(const width of [1512,390]){await page.setViewportSize({width,height:1100});await page.locator('#pinGuide').evaluate(el=>el.open=true);await page.locator('#pinGuide').screenshot({path:path.join(output,`corrected-pinout-${width}.png`)});await page.locator('.breadboard-wrap').screenshot({path:path.join(output,`corrected-chip-${width}.png`)});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 // Portable version loads the same old data correctly, with no network assets.
 const portable=await browser.newPage();portable.on('pageerror',e=>errors.push(e.message));await portable.addInitScript(raw=>localStorage.setItem('gds1202b-preset-inverting',raw),rawPreset);const requests=[];portable.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});await portable.goto('file://'+path.resolve(process.env.SIMULATOR_OFFLINE_PATH || 'gds1202b_opamp_sim_single_file.html'));assert(await portable.locator('#pinoutNotice').isVisible());assert.equal(await portable.locator('#circuitStatus').textContent(),'Circuit electrically runnable');assert.deepEqual(requests,[]);
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS: physical follower, signed preset gains, legacy references, versioning, unchanged storage, atomic rejection, migration disclosures, export, diagrams, portable file');
})().catch(e=>{console.error(e);process.exit(1)});
