const {unlockPresets}=require('./preset-helpers.cjs');
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const expected={
 follower:{pins:{2:'output',3:'input'},parts:{}},
 inverting:{pins:{2:'summing',3:'ground'},parts:{rin:['resistor',10000,'input','summing'],rf:['resistor',47000,'output','summing']}},
 noninverting:{pins:{2:'divider',3:'input'},parts:{rf:['resistor',47000,'output','divider'],rg:['resistor',10000,'divider','ground']}},
 lowpass:{pins:{2:'output',3:'filtered'},parts:{r:['resistor',10000,'input','filtered'],c:['capacitor',1e-7,'filtered','ground']}},
 integrator:{pins:{2:'summing',3:'ground'},parts:{rin:['resistor',10000,'input','summing'],rf:['resistor',100000,'output','summing'],cf:['capacitor',1e-7,'output','summing']}}
};
const on=(p,a,b)=>Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-7&&p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y);
function checkScene(s,layout){
 const e=expected[s.reference.id],ref=s.reference;
 const pinPosition=number=>s.ports.find(p=>p.id===`ua741.${number}`).point;
 assert.deepEqual(pinPosition(3),{x:440,y:ref.id==='noninverting'?230:290});
 assert.deepEqual(pinPosition(2),{x:440,y:ref.id==='noninverting'?290:230});
 if(ref.id==='noninverting'){assert(s.components.find(c=>c.role==='rf').y>290);assert(s.components.find(c=>c.role==='rg').vertical);}
 assert.deepEqual(ref.pins,{...e.pins,4:'negative',6:'output',7:'positive'});
 assert.deepEqual(Object.fromEntries(ref.components.map(c=>[c.role,[c.type,c.value,...c.nets]])),e.parts);
 const segments=s.wires.flatMap(w=>w.points.slice(1).map((b,i)=>({net:w.net,a:w.points[i],b})));
 for(const comp of s.components)for(const [i,p] of [comp.a,comp.b].entries())assert(segments.some(w=>w.net===comp.nets[i]&&on(p,w.a,w.b)),`${ref.id}: floating symbol terminal ${comp.role}/${i}`);
 for(const p of s.ports)assert(segments.some(w=>w.net===p.net&&on(p.point,w.a,w.b)),`${ref.id}: floating port ${p.id}`);
 for(let i=0;i<segments.length;i++)for(let j=0;j<i;j++){
  const a=segments[i],b=segments[j];if(a.net===b.net)continue;
  let intersect=[a.a,a.b].some(p=>on(p,b.a,b.b))||[b.a,b.b].some(p=>on(p,a.a,a.b));
  if((a.a.x===a.b.x)!==(b.a.x===b.b.x)){const v=a.a.x===a.b.x?a:b,h=a.a.x===a.b.x?b:a,p={x:v.a.x,y:h.a.y};intersect ||= on(p,v.a,v.b)&&on(p,h.a,h.b);}
  assert(!intersect,`${ref.id}: ambiguous crossing between ${a.net} and ${b.net}`);
 }
 // Collapse actual breadboard strips/jumpers independently of the SVG metadata.
 const node=address=>{const [r,c]=address.split(':');return r.startsWith('GND')?'GND':r==='VPLUS'||r==='VMINUS'?r:'ABCDE'.includes(r)?'T:'+c:'B:'+c;};
 const parent=new Map(),find=n=>{if(!parent.has(n))parent.set(n,n);if(parent.get(n)!==n)parent.set(n,find(parent.get(n)));return parent.get(n);};
 for(const [type,a,b] of layout.parts)if(type==='wire')parent.set(find(node(a)),find(node(b)));
 const c=layout.startCol,actualPins={2:`B:${c+1}`,3:`B:${c+2}`,4:`B:${c+3}`,6:`T:${c+2}`,7:`T:${c+1}`};
 const canonical={};
 const assign=(key,n)=>{const root=find(n);if(canonical[key])assert.equal(canonical[key],root,`${ref.id}: different physical nodes for ${key}`);canonical[key]=root;};
 assign('ground','GND');assign('positive','VPLUS');assign('negative','VMINUS');assign('input',node(layout.leads.generator));assign('output',node(layout.leads.ch2tip));
 for(const [pin,n] of Object.entries(actualPins))assign(ref.pins[pin],n);
 assign('input',node(layout.leads.ch1tip));for(const lead of ['gengnd','ch1gnd','ch2gnd'])assign('ground',node(layout.leads[lead]));
 assert.equal(new Set(Object.values(canonical)).size,Object.keys(canonical).length,`${ref.id}: unintended short`);
 for(const component of ref.components){const part=layout.parts.find(p=>p[4]===component.role);assert(part);assert.deepEqual([find(node(part[1])),find(node(part[2]))].sort(),component.nets.map(n=>canonical[n]).sort(),`${ref.id}: physical topology differs for ${component.role}`);}
}
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const expose="  window.schematicTest={loadPreset,snapshot:()=>JSON.stringify({board:boardSnapshot(),scope,history,tool:state.selectedTool,selection:state.selectedId,storage:{...localStorage}})};\n  // Initial state";
 await page.route('**/app.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state',expose)}));
 await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/')+'index.html');await unlockPresets(page);await page.waitForTimeout(100);
 assert.equal(await page.locator('#schematicSelect').inputValue(),'inverting');assert.equal(await page.locator('#schematicSelect option').count(),5);
 assert.equal(await page.locator('#ua741Guides svg').count(),1);assert.equal(await page.locator('#ua741Guides .pin-diagram').count(),0);
 await page.fill('#amplitudeInput','1.75');await page.locator('#amplitudeInput').press('Tab');await page.waitForTimeout(100);await page.click('#saveLabBtn');
 const before=await page.evaluate(()=>schematicTest.snapshot());
 for(const name of Object.keys(expected)){
  await page.selectOption('#schematicSelect',name);
  const s=await page.evaluate(name=>({scene:CircuitSchematics.scene(name),layout:PresetLayouts.layout(name)}),name);checkScene(s.scene,s.layout);
  assert.equal(await page.locator('[data-component]').count(),s.scene.components.length);
  assert.equal(await page.locator('#schematicDiagram [data-wire]').count(),s.scene.wires.length);
  assert(await page.locator('#schematic-desc').textContent());
  assert.equal(await page.locator('[data-input-sign=top]').textContent(),name==='noninverting'?'+':'−');
  assert.equal(await page.locator('[data-input-sign=bottom]').textContent(),name==='noninverting'?'−':'+');
  for(const [net,pin] of [['input',3],['output',6],['positive',7],['negative',4]])assert.equal(await page.locator(`[data-wire][data-net=${net}]`).first().getAttribute('stroke'),await page.evaluate(pin=>UA741.pins.find(p=>p.number===pin).color,pin));
  assert((await page.locator('#schematicViewport').boundingBox()).width<=640);
  assert.equal(await page.evaluate(()=>schematicTest.snapshot()),before,'Reference selection modified lab/instruments/history/storage');
 }
 await page.locator('#schematicSelect').focus();await page.keyboard.press('v');await page.keyboard.press('Enter');assert.equal(await page.locator('#schematicSelect').inputValue(),'follower');assert.equal(await page.evaluate(()=>schematicTest.snapshot()),before);
 await page.selectOption('#schematicSelect','integrator');await page.evaluate(()=>schematicTest.loadPreset('follower',true));assert.equal(await page.locator('#schematicSelect').inputValue(),'integrator');
 await page.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));
 const output=path.resolve('../../output/playwright/simulator-redesign');
 for(const width of [1512,1024,390]){
  await page.setViewportSize({width,height:1100});
  for(const name of Object.keys(expected)){
   await page.selectOption('#schematicSelect',name);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)assert(await page.locator('.schematic-reference').evaluate(el=>el.getBoundingClientRect().width>=300),'Phone schematic must use the available panel width');
   if(width===1512){const ratio=await page.evaluate(()=>{const a=document.querySelector('.pin-reference').getBoundingClientRect(),b=document.querySelector('.schematic-reference').getBoundingClientRect();return b.width/(a.width+b.width);});assert(Math.abs(ratio-.65)<.01);}
   // Text must stay inside the SVG and not overlap other text labels.
   const boxes=await page.locator('.circuit-schematic text').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBBox();return {text:n.textContent,x:b.x,y:b.y,w:b.width,h:b.height};}));
   for(let i=0;i<boxes.length;i++){const a=boxes[i];assert(a.x>=0&&a.y>=0&&a.x+a.w<=800&&a.y+a.h<=500,`${name}: clipped label ${a.text}`);for(let j=0;j<i;j++){const b=boxes[j];assert(a.x>=b.x+b.w||b.x>=a.x+a.w||a.y>=b.y+b.h||b.y>=a.y+a.h,`${name}: labels overlap: ${a.text}/${b.text}`);}}
   await page.locator('.schematic-reference').screenshot({path:path.join(output,`reference-${width}-${name}.png`)});
   if(width===390){await page.locator('#schematicViewport').evaluate(el=>el.scrollLeft=el.scrollWidth);await page.locator('.schematic-reference').screenshot({path:path.join(output,`reference-${width}-${name}-right.png`)});}
  }
 }
 await page.reload();assert.equal(await page.locator('#pinGuide').evaluate(el=>el.open),false);await page.locator('#pinGuide summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#schematicSelect').isVisible());
 await page.locator('#schematicViewport').focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);assert(await page.locator('#schematicViewport').evaluate(el=>el.scrollLeft>0));
 // Every reference is available without network access in the portable HTML.
 const portable=await browser.newPage({viewport:{width:1512,height:1100}}),requests=[];portable.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});portable.on('pageerror',e=>errors.push(e.message));
 await portable.goto('file://'+path.resolve(process.env.SIMULATOR_OFFLINE_PATH || 'gds1202b_opamp_sim_single_file.html'));
 for(const name of Object.keys(expected)){await portable.selectOption('#schematicSelect',name);assert(await portable.locator('#schematic-title').textContent());}
 assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);await browser.close();
 console.log('PASS: five standard schematic graphs, physical topology, values/pins, connected SVG symbols, no ambiguous wire crossings, independent selection, 65% layout, label bounds, keyboard, 15 responsive views, offline portable');
})().catch(e=>{console.error(e);process.exit(1);});
