const {unlockPresets}=require('./preset-helpers.cjs');
const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/legacy-pinout.json','utf8')).presets;
const rows={VPLUS:70,GND_TOP:110,A:180,B:210,C:240,D:270,E:300,F:350,G:380,H:410,I:440,J:470,GND_BOTTOM:510,VMINUS:550};
const point=h=>({x:155+(h.col-1)*30,y:rows[h.row]});
function distancePoint(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function segmentDistance(a,b,c,d){
 const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)))return 0;
 return Math.min(distancePoint(a,c,d),distancePoint(b,c,d),distancePoint(c,a,b),distancePoint(d,a,b));
}
function rectDistance(a,b,r){if([a,b].some(p=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom))return 0;const v=[{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}];return Math.min(...v.map((p,i)=>segmentDistance(a,b,p,v[(i+1)%4])));}
// Circuit equivalence independent of solver node numbering and jumper count.
function topology(s){
 const parent=new Map(),find=x=>{if(!parent.has(x))parent.set(x,x);if(parent.get(x)!==x)parent.set(x,find(parent.get(x)));return parent.get(x);},join=(a,b)=>parent.set(find(a),find(b));
 for(const c of s.components)if(c.type==='wire')join(c.a,c.b);
 const op=s.components.find(c=>c.type==='opamp'),c=op.startCol;
 const terminals={plus:'VPLUS',minus:'VMINUS',ground:'GND',inminus:`B:${c+1}`,inplus:`B:${c+2}`,output:`T:${c+2}`,pin7:`T:${c+1}`,pin4:`B:${c+3}`,generator:s.generatorNode,return:s.generator.groundNode,ch1:s.probes.ch1.tip,ch2:s.probes.ch2.tip,ch1ground:s.probes.ch1.gnd,ch2ground:s.probes.ch2.gnd};
 const parts=s.components.filter(c=>['resistor','capacitor'].includes(c.type)).sort((a,b)=>a.type.localeCompare(b.type)||a.value-b.value);
 const net=node=>Object.entries(terminals).filter(([,n])=>find(n)===find(node)).map(([k])=>k).sort().join('|');
 return {anchors:Object.values(terminals).map(net).sort(),parts:parts.map(p=>[p.type,p.value,[net(p.a),net(p.b)].sort()])};
}
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1512,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/app.js',r=>r.fulfill({contentType:'text/javascript',body:fs.readFileSync('app.js','utf8').replace('  // Initial state','  window.labTest={state,loadPreset,normalizeSavedLab,ensureRoutes,routeGeometry,boardSnapshot,solveCircuitWaveforms,validateCircuit,componentHoles};\n  // Initial state')}));
 await page.goto((process.env.SIMULATOR_URL || 'http://127.0.0.1:8765/')+'index.html');await unlockPresets(page);
 for(const [name,fixture] of Object.entries(fixtures)){
  const data=await page.evaluate(({name,legacy})=>{
   labTest.loadPreset(name,true);const before=labTest.boardSnapshot(),routes=labTest.ensureRoutes(),geometry=labTest.routeGeometry(),sim=labTest.solveCircuitWaveforms(),samples=[];
   for(let i=Math.floor(sim.traces.t.length/2);i<sim.traces.t.length;i+=40)samples.push([sim.traces.t[i],sim.traces.ch1[i],sim.traces.ch2[i]]);
   const planned=PresetLayouts.layout(name),explicit=labTest.state.components.filter(c=>c.type!=='opamp').map(c=>[c.type,`${c.aHole.row}:${c.aHole.col}`,`${c.bHole.row}:${c.bHole.col}`,c.type==='wire'?c.color:c.value]);
   const measure=document.createElement('canvas').getContext('2d');measure.font='13px system-ui';
   return {capLabelWidth:measure.measureText('100nF').width,state:JSON.parse(before),legacy:labTest.normalizeSavedLab(legacy).envelope.state,routes:[...routes],docks:[...geometry.docks],samples,warnings:labTest.validateCircuit().warnings,cached:routes===labTest.ensureRoutes(),unchanged:before===labTest.boardSnapshot(),planned:planned.parts.map(p=>p[0]==='wire'?[...p.slice(0,3),p[3]||'#48a26a']:p.slice(0,4)),explicit,holes:labTest.state.components.flatMap(c=>labTest.componentHoles(c).map(i=>i.hole)).concat(Object.values(labTest.state.leadHoles))};
  },{name,legacy:fixture.snapshot});
  assert.deepEqual(data.explicit,data.planned,`${name}: automatic allocation moved explicit holes`);
  assert.deepEqual(topology(data.state),topology(data.legacy),`${name}: changed electrical topology`);
  assert.equal(new Set(data.holes.map(h=>h.row+':'+h.col)).size,data.holes.length,`${name}: occupied hole`);
  assert.deepEqual(data.warnings,[]);assert(data.cached&&data.unchanged);
  assert.equal(data.samples.length,fixture.samples.length);
  for(let i=0;i<data.samples.length;i++)for(let j=0;j<3;j++)assert(Math.abs(data.samples[i][j]-fixture.samples[i][j])<1e-7,`${name}: waveform ${i}/${j} changed`);
  const segments=[],bodies=[];
  const x=155+(data.state.components[0].startCol-1)*30;
  bodies.push({id:data.state.components[0].id,left:x-12,right:x+102,top:308,bottom:342});
  for(const comp of data.state.components)if(['resistor','capacitor'].includes(comp.type)){
   const a=point(comp.aHole),b=point(comp.bHole),mx=(a.x+b.x)/2,my=(a.y+b.y)/2;assert.equal(a.y,b.y,`${name}: horizontal component expected`);
   segments.push({id:comp.id,a,b,radius:1.5});
   bodies.push({id:comp.id,left:mx-(comp.type==='resistor'?32:6),right:mx+(comp.type==='resistor'?32:6),top:my-(comp.type==='resistor'?10:13),bottom:my+(comp.type==='resistor'?10:13)});
   if(comp.type==='capacitor')bodies.push({id:comp.id,left:mx-data.capLabelWidth/2,right:mx+data.capLabelWidth/2,top:my-31,bottom:my-18});
  }
  for(const [id,dock] of data.docks){
   assert(dock.label.left>=25&&dock.label.right<=1155,`${name}: clipped dock label`);
   assert(dock.side==='left'?dock.label.right<135:dock.label.left>1045,`${name}: dock label intrudes into the hole area`);
   bodies.push({id:'label:'+id,...dock.label});
  }
  for(const [id,r] of data.routes){
   assert(!r.fallback,`${name}: fallback ${id}`);
   const comp=data.state.components.find(c=>c.id===id),end=comp?point(comp.bHole):(({x,y})=>({x,y}))(new Map(data.docks).get(id));
   assert.deepEqual(r.points[0],point(comp?comp.aHole:data.state.leadHoles[id]));assert.deepEqual(r.points.at(-1),end);
   for(let i=1;i<r.points.length;i++)segments.push({id,a:r.points[i-1],b:r.points[i],radius:2,wire:true});
  }
  for(let i=0;i<bodies.length;i++)for(let j=0;j<i;j++){
   const a=bodies[i],b=bodies[j];if(a.id===b.id)continue;
   const dx=Math.max(0,a.left-b.right,b.left-a.right),dy=Math.max(0,a.top-b.bottom,b.top-a.bottom);
   assert(Math.hypot(dx,dy)>=8,`${name}: overlapping bodies/labels ${a.id}/${b.id}`);
  }
  for(let i=0;i<segments.length;i++){
   const s=segments[i];
   for(const body of bodies)if(s.id!==body.id)assert(rectDistance(s.a,s.b,body)>=8+s.radius-1e-5,`${name}: ${s.id} too close to body/label ${body.id}: ${rectDistance(s.a,s.b,body)}`);
   for(let j=0;j<i;j++){
    const t=segments[j];if(s.id===t.id)continue;
    const distance=segmentDistance(s.a,s.b,t.a,t.b);
    if(s.wire&&t.wire){
     if(distance===0){
      assert.notEqual(s.a.x===s.b.x,t.a.x===t.b.x,`${name}: wires share a segment`);
      const vertical=s.a.x===s.b.x?s:t,horizontal=vertical===s?t:s;
      const x=vertical.a.x,y=horizontal.a.y;
      assert(data.routes.filter(([id])=>id===s.id||id===t.id).some(([,r])=>r.bridges.some(b=>b.x===x&&b.y===y)),`${name}: unmarked crossing ${s.id}/${t.id}`);
     }
    }else assert(distance>=8+s.radius+t.radius-1e-5,`${name}: ${s.id} crosses/approaches ${t.id}: ${distance}`);
   }
  }
  await page.locator('.breadboard-wrap').screenshot({path:`../../output/playwright/simulator-redesign/organized-${name}.png`});
  console.log('PASS',name,'exact placements, occupancy, topology, unchanged signed waveform samples, clear components and routes, caching');
 }
 assert.deepEqual(errors,[]);await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
