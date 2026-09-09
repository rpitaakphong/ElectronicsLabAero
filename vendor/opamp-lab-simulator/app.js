(() => {
  'use strict';
  const profile=LabProfiles[document.documentElement.dataset.lab || 'opamp'];
  const isDivider=profile.solver==='dc', isRc=profile.solver==='rc-periodic', independentRails=profile.connectivity==='independent';
  const storagePrefix=profile.storage;
  const {UnionFind,gaussianSolve}=CircuitEngine;
  let dividerRuntime=null;
  const terminalKeys=c=>c.type==='potentiometer'?['a','b','w']:['a','b'];

  // -----------------------------
  // Utility helpers
  // -----------------------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (v, unit = '') => {
    if (!Number.isFinite(v)) return '—';
    const av = Math.abs(v);
    const scales = [
      [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']
    ];
    let chosen = scales[3];
    for (const s of scales) { if (av >= s[0]) { chosen = s; break; } }
    return `${(v / chosen[0]).toPrecision(4).replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')}${chosen[1]}${unit}`;
  };
  const uid = (() => { let n = 1; return p => { let id; do { id=`${p}${n++}`; } while(state.components.some(c=>c.id===id)); return id; }; })();
  const nextFrom = (arr, current, dir) => {
    let i = arr.indexOf(current);
    if (i < 0) i = 0;
    return arr[clamp(i + dir, 0, arr.length - 1)];
  };
  const nearestFrom = (arr, target) => arr.reduce((best, v) => Math.abs(v-target) < Math.abs(best-target) ? v : best, arr[0]);

  function toast(msg, ms = 1800) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), ms);
  }

  function engParse(value) {
    if (typeof value === 'number') return value;
    const s = String(value).trim().replace(/ohms?|Ω/gi, '').replace(/[µμ]/g, 'u');
    const m = s.match(/^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*([pnumkmg]?)(?:f|v|a)?$/i);
    if (!m) return NaN;
    const mult = { p:1e-12, n:1e-9, u:1e-6, m:1e-3, '':1, k:1e3, g:1e9, M:1e6 };
    const prefix = m[2];
    return Number(m[1]) * (mult[prefix] ?? 1);
  }

  // -----------------------------
  // Application state
  // -----------------------------
  const state = {
    components: [],
    selectedId: null,
    selectedTool: 'select',
    pendingNode: null,
    pendingHole: null,
    leadHoles: {},
    generatorNode: null,
    probes: {
      ch1: { tip: null, gnd: null },
      ch2: { tip: null, gnd: null }
    },
    supply: profile.instruments.includes('supply') ? { plus: 12, minus: -12 } : undefined,
    generator: { waveform: 'sine', frequency: 1000, amplitude: 1, offset: 0 },
    challenge: { enabled: false, actions: 0, autosetUsed: false, startTime: Date.now() },
    sim: { last: null, warnings: [], error: null },
    ...(isDivider?{leads:{},meter:{mode:'voltage'},supply:{voltage:5,enabled:false}}:{}),
  };

  const VOLT_DIVS = [0.001,0.002,0.005,0.01,0.02,0.05,0.1,0.2,0.5,1,2,5,10];
  const TIME_DIVS = [1e-9,2e-9,5e-9,1e-8,2e-8,5e-8,1e-7,2e-7,5e-7,1e-6,2e-6,5e-6,1e-5,2e-5,5e-5,1e-4,2e-4,5e-4,1e-3,2e-3,5e-3,1e-2,2e-2,5e-2,0.1,0.2,0.5,1,2,5,10];

  const defaultScope = () => ({
    powered: true,
    running: true,
    singleArmed: false,
    currentMenu: null,
    sideMenu: null,
    menuHidden: false,
    hardcopyCount: 0,
    ch1: { enabled:true, voltsDiv:0.5, position:0, coupling:'DC', invert:false, probe:1, bwLimit:'Full' },
    ch2: { enabled:true, voltsDiv:0.5, position:0, coupling:'DC', invert:false, probe:1, bwLimit:'Full' },
    horizontal: { timeDiv:0.0002, position:0, zoom:false },
    trigger: { type:'Edge', source:'CH1', slope:'Rising', mode:'Auto', coupling:'DC', level:0, holdoff:0 },
    acquire: { mode:'Sample', average:16, memory:'10k' },
    display: { vectors:true, persistence:'Off', intensity:90, grid:'Full' },
    measure: { source:'CH1', source2:'CH2', items:[{name:'Frequency',source:'CH1'},{name:'Pk-Pk',source:'CH1'},{name:'Pk-Pk',source:'CH2'}],gate:'Off',statistics:false,samples:100,highLow:'Auto',highRef:90,midRef:50,lowRef:10,all:false },
    cursor: { mode:'Off', source:'CH1', x1:-0.001, x2:0.001, y1:-1, y2:1 },
    math: { enabled:false, op:'CH1-CH2' },
    ref: { enabled:false, data:null },
    forcedTrigger: false,
    frozenFrame: null, frozenRecord:null,
    actionCount: 0,
  });
  let scope = profile.instruments.includes('scope') ? defaultScope() : null;

  // -----------------------------
  // Breadboard geometry
  // -----------------------------
  const bb = {
    canvas: document.getElementById('breadboardCanvas'),
    ctx: document.getElementById('breadboardCanvas').getContext('2d'),
    x0: 155,
    dx: 30,
    cols: 30,
    rows: {
      A:180, B:210, C:240, D:270, E:300,
      F:350, G:380, H:410, I:440, J:470,
      VPLUS:70, GND_TOP:110, GND_BOTTOM:510, VMINUS:550
    }
  };

  function colX(c) { return bb.x0 + (c - 1) * bb.dx; }
  const railNames={VPLUS:'Top +',GND_TOP:'Top −',GND_BOTTOM:'Bottom +',VMINUS:'Bottom −'};
  function nodeFor(row, col) {
    if(independentRails&&Object.hasOwn(railNames,row))return row;
    if (row === 'VPLUS') return 'VPLUS';
    if (row === 'VMINUS') return 'VMINUS';
    if (row === 'GND_TOP' || row === 'GND_BOTTOM') return 'GND';
    if ('ABCDE'.includes(row)) return `T:${col}`;
    if ('FGHIJ'.includes(row)) return `B:${col}`;
    return null;
  }
  function nodePosition(node, preferredRow = null) {
    if (!node) return null;
    if(independentRails&&Object.hasOwn(railNames,node))return {x:colX(15),y:bb.rows[node]};
    if (node === 'VPLUS') return { x: colX(15), y: bb.rows.VPLUS };
    if (node === 'VMINUS') return { x: colX(15), y: bb.rows.VMINUS };
    if (node === 'GND') return { x: colX(15), y: preferredRow === 'bottom' ? bb.rows.GND_BOTTOM : bb.rows.GND_TOP };
    const [half, cstr] = node.split(':');
    const c = Number(cstr);
    return { x: colX(c), y: half === 'T' ? bb.rows.C : bb.rows.H };
  }
  function nodeLabel(node) {
    if (!node) return '—';
    if(independentRails&&Object.hasOwn(railNames,node))return railNames[node]+' rail';
    if (node === 'VPLUS') return 'V+ rail';
    if (node === 'VMINUS') return 'V− rail';
    if (node === 'GND') return 'GND rail';
    const [half,c] = node.split(':');
    return `${half === 'T' ? 'A–E' : 'F–J'} column ${c}`;
  }

  function holes() {
    const out = [];
    for (let c=1;c<=bb.cols;c++) {
      for (const row of 'ABCDEFGHIJ') out.push({ row, col:c, x:colX(c), y:bb.rows[row], node:nodeFor(row,c) });
      out.push({ row:'VPLUS', col:c, x:colX(c), y:bb.rows.VPLUS, node:nodeFor('VPLUS',c) });
      out.push({ row:'GND_TOP', col:c, x:colX(c), y:bb.rows.GND_TOP, node:nodeFor('GND_TOP',c) });
      out.push({ row:'GND_BOTTOM', col:c, x:colX(c), y:bb.rows.GND_BOTTOM, node:nodeFor('GND_BOTTOM',c) });
      out.push({ row:'VMINUS', col:c, x:colX(c), y:bb.rows.VMINUS, node:nodeFor('VMINUS',c) });
    }
    return out;
  }
  const allHoles = holes();

  function pointerToCanvas(e, canvas) {
    const r = canvas.getBoundingClientRect();
    return { x:(e.clientX-r.left)*canvas.width/r.width, y:(e.clientY-r.top)*canvas.height/r.height };
  }
  function nearestHole(x,y) {
    let best=null, bd=Infinity;
    for (const h of allHoles) {
      const d=(h.x-x)**2+(h.y-y)**2;
      if (d<bd) { bd=d; best=h; }
    }
    return bd <= 18*18 ? best : null;
  }

  function opampPins(op) { return UA741.nodes(op); }

  // -----------------------------
  // Breadboard drawing
  // -----------------------------
  let routeSignature='', visualRoutes=new Map(), visualDocks=new Map();
  const leadStyle=profile.leads;
  function instrumentDocks(leads) {
    const docks=new Map();
    for(const side of ['left','right']){
      const group=leads.filter(l=>(l.a.x<590?'left':'right')===side).sort((a,b)=>a.a.y-b.a.y||a.a.x-b.a.x||a.id.localeCompare(b.id));
      let last=45;
      const positions=group.map(l=>{last=Math.max(l.a.y,last+44);return last;});
      if(positions.length&&positions.at(-1)>570){positions[positions.length-1]=570;for(let i=positions.length-2;i>=0;i--)positions[i]=Math.min(positions[i],positions[i+1]-44);}
      group.forEach((lead,i)=>{
        const y=positions[i],label=leadStyle[lead.id][1];
        bb.ctx.save();bb.ctx.font='bold 14px system-ui';const width=bb.ctx.measureText(label).width+10;bb.ctx.restore();
        const x=side==='left'?90:1090, left=x-width/2;
        docks.set(lead.id,{x,y,label:{left,right:left+width,top:y-32,bottom:y-12},side});
      });
    }
    return docks;
  }
  function routeGeometry() {
    const geometry=state.components.map(comp=>comp.type==='opamp'?{id:comp.id,type:comp.type,startCol:comp.startCol}:{id:comp.id,type:comp.type,value:comp.value,a:representativePoint(comp.a,comp,'a'),b:representativePoint(comp.b,comp,'b'),w:comp.type==='potentiometer'?representativePoint(comp.w,comp,'w'):null});
    const leads=Object.keys(leadStyle).filter(key=>getLead(key)).map(key=>({id:key,a:leadPoint(key)}));
    const docks=instrumentDocks(leads),obstacles=[],connections=[];
    for(const comp of geometry) {
      if(comp.type==='opamp') {
        obstacles.push({left:colX(comp.startCol)-20,right:colX(comp.startCol+3)+20,top:bb.rows.E,bottom:bb.rows.F+8,owner:comp.id,kind:'body'});
        for(let col=comp.startCol;col<=comp.startCol+3;col++)for(const row of ['E','F']){const p={x:colX(col),y:bb.rows[row]};obstacles.push({left:p.x-14,right:p.x+14,top:p.y-14,bottom:p.y+14,terminal:true,owner:comp.id});}
      } else if(comp.a&&comp.b) {
        if(comp.type==='wire')connections.push({id:comp.id,a:comp.a,b:comp.b});
        else {
          const mx=(comp.a.x+comp.b.x)/2,my=(comp.a.y+comp.b.y)/2,angle=Math.atan2(comp.b.y-comp.a.y,comp.b.x-comp.a.x);
          const halfX=Math.abs(Math.cos(angle))*32+Math.abs(Math.sin(angle))*14,halfY=Math.abs(Math.sin(angle))*32+Math.abs(Math.cos(angle))*14;
          obstacles.push({left:mx-halfX-10,right:mx+halfX+10,top:my-halfY-10,bottom:my+halfY+10,owner:comp.id,kind:'body'});
          // Cover the complete physical leads, including diagonal user-placed parts.
          const steps=Math.max(1,Math.ceil(Math.hypot(comp.b.x-comp.a.x,comp.b.y-comp.a.y)/8));
          for(let i=0;i<steps;i++){
            const a={x:lerp(comp.a.x,comp.b.x,i/steps),y:lerp(comp.a.y,comp.b.y,i/steps)},b={x:lerp(comp.a.x,comp.b.x,(i+1)/steps),y:lerp(comp.a.y,comp.b.y,(i+1)/steps)};
            obstacles.push({left:Math.min(a.x,b.x)-10,right:Math.max(a.x,b.x)+10,top:Math.min(a.y,b.y)-10,bottom:Math.max(a.y,b.y)+10,owner:comp.id,kind:'lead'});
          }
          if(comp.type==='capacitor'){
            bb.ctx.save();bb.ctx.font='13px system-ui';const half=bb.ctx.measureText(fmt(comp.value,'F')).width/2;bb.ctx.restore();
            obstacles.push({left:mx-half-8,right:mx+half+8,top:my-39,bottom:my-10,owner:comp.id,kind:'label'});
          }
        }
        if(comp.w){
          const mid={x:(comp.a.x+comp.b.x)/2,y:(comp.a.y+comp.b.y)/2},steps=Math.max(1,Math.ceil(Math.hypot(comp.w.x-mid.x,comp.w.y-mid.y)/8));
          for(let i=0;i<=steps;i++){const x=lerp(comp.w.x,mid.x,i/steps),y=lerp(comp.w.y,mid.y,i/steps);obstacles.push({left:x-10,right:x+10,top:y-10,bottom:y+10,owner:comp.id,kind:'lead'});}
          obstacles.push({left:mid.x-55,right:mid.x+55,top:mid.y-45,bottom:mid.y+15,owner:comp.id,kind:'label'});
        }
        for(const p of [comp.a,comp.b,comp.w].filter(Boolean))obstacles.push({left:p.x-14,right:p.x+14,top:p.y-14,bottom:p.y+14,terminal:true,owner:comp.id});
      }
    }
    for(const lead of leads){
      const dock=docks.get(lead.id);connections.push({...lead,b:{x:dock.x,y:dock.y}});
      const p=lead.a;obstacles.push({left:p.x-14,right:p.x+14,top:p.y-14,bottom:p.y+14,terminal:true,owner:lead.id});
      obstacles.push({left:dock.label.left-10,right:dock.label.right+10,top:dock.label.top-10,bottom:dock.label.bottom+10,owner:'label:'+lead.id,kind:'label'});
    }
    return {geometry,leads,docks,connections,obstacles};
  }
  function ensureRoutes() {
    const signature=JSON.stringify([state.components.map(({id,type,startCol,a,b,aHole,bHole,w,wHole,position,variant,value})=>({id,type,startCol,a,b,aHole,bHole,w,wHole,position,variant,value})),state.leadHoles,Object.keys(leadStyle).map(key=>getLead(key))]);
    if(signature===routeSignature)return visualRoutes;
    const {docks,connections,obstacles}=routeGeometry();
    visualDocks=docks;visualRoutes=WireRouting.routeAll(connections,obstacles,{left:90,right:1090,top:45,bottom:575});routeSignature=signature;return visualRoutes;
  }
  function drawRoute(c,id,color,width) {
    const route=ensureRoutes().get(id);if(!route)return;
    const {points,bridges}=route,selected=state.selectedId===id;
    c.save();c.lineCap='round';c.lineJoin='round';
    const stroke=()=>{
      c.beginPath();c.moveTo(points[0].x,points[0].y);
      for(let i=1;i<points.length;i++) {
        const a=points[i-1],b=points[i],dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
        const marks=bridges.filter(p=>p.segment===i).sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y));
        for(const p of marks){c.lineTo(p.x-dx*6,p.y-dy*6);c.quadraticCurveTo(p.x+dy*11,p.y-dx*11,p.x+dx*6,p.y+dy*6);}
        c.lineTo(b.x,b.y);
      }c.stroke();
    };
    c.strokeStyle=selected?'#ffffff':'#e9e2cf';c.lineWidth=width+(selected?5:2);stroke();
    c.strokeStyle=color;c.lineWidth=width;stroke();
    for(const p of [points[0],points[points.length-1]]){c.fillStyle=color;c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill();}
    c.restore();
  }
  function drawBreadboard() {
    const c = bb.ctx;
    c.clearRect(0,0,bb.canvas.width,bb.canvas.height);
    c.fillStyle='#e9e2cf';
    c.fillRect(25,35,1130,550);
    c.strokeStyle='#bbb3a0'; c.lineWidth=2;
    c.strokeRect(25,35,1130,550);

    // Recessed rail bands belong to the board; jumper wires are drawn above them.
    c.save();c.lineWidth=1;
    for(const [row,fill,edge] of [
      ['VPLUS','#e3bebb','#caa6a1'],['GND_TOP','#c2d0e1','#a4b7cf'],
      ['GND_BOTTOM','#e3bebb','#caa6a1'],['VMINUS','#c2d0e1','#a4b7cf']
    ]){
      c.beginPath();c.roundRect(bb.x0-16,bb.rows[row]-12,(bb.cols-1)*bb.dx+32,24,5);
      c.fillStyle=fill;c.fill();c.strokeStyle=edge;c.stroke();
    }
    c.restore();

    // Reset alignment each frame: row/column labels leave the context centered.
    c.fillStyle='#6f6557'; c.font='15px system-ui'; c.textAlign='left'; c.textBaseline='alphabetic';
    c.fillText(independentRails?'Top +':`+${state.supply.plus} V`,35,bb.rows.VPLUS+5);
    c.fillText(independentRails?'Top −':'GND',35,bb.rows.GND_TOP+5);
    c.fillText(independentRails?'Bottom +':'GND',35,bb.rows.GND_BOTTOM+5);
    c.fillText(independentRails?'Bottom −':`${state.supply.minus} V`,35,bb.rows.VMINUS+5);

    // Gap
    c.fillStyle='#cfc7b3'; c.fillRect(bb.x0-16,316,(bb.cols-1)*bb.dx+32,18);

    // Row labels and holes
    c.font='13px system-ui'; c.textAlign='right';
    for (const row of 'ABCDEFGHIJ') { c.fillStyle='#7c7467'; c.fillText(row,bb.x0-10,bb.rows[row]-10); }
    c.textAlign='center';
    for (let col=1; col<=bb.cols; col++) {
      if (col===1 || col%5===0) { c.fillStyle='#817869'; c.fillText(String(col),colX(col),155); c.fillText(String(col),colX(col),495); }
    }
    for (const h of allHoles) {
      c.beginPath();
      c.fillStyle='#6c675d';
      c.arc(h.x,h.y,4.2,0,Math.PI*2); c.fill();
      c.beginPath(); c.fillStyle='#302f2b'; c.arc(h.x,h.y,2.2,0,Math.PI*2); c.fill();
    }

    if (hoverHole) {
      for (const h of allHoles.filter(h=>h.node===hoverHole.node)) { c.fillStyle='rgba(25,116,200,.25)'; c.beginPath(); c.arc(h.x,h.y,8,0,Math.PI*2); c.fill(); }
      c.strokeStyle=(drag&&!drag.valid)||(!drag&&!['select','pan','erase'].includes(state.selectedTool)&&occupiedAt(hoverHole,leadKeys.includes(state.selectedTool)?leadOwner(state.selectedTool):null))?'#bf3344':'#0874cb'; c.lineWidth=3; c.beginPath(); c.arc(hoverHole.x,hoverHole.y,11,0,Math.PI*2); c.stroke();
    }
    // Draw routes underneath component bodies, with a shared hit-test geometry.
    ensureRoutes();
    for(const comp of state.components)if(comp.type==='wire')drawRoute(c,comp.id,comp.color||'#47a86e',4);
    for(const key of Object.keys(leadStyle))if(getLead(key))drawLead(c,key);
    // Components
    for (const comp of state.components.filter(c=>c.id!==state.selectedId&&c.type!=='wire').sort((a,b)=>(a.type==='opamp')-(b.type==='opamp'))) drawComponent(c, comp, false);
    const selectedPart=state.components.find(c=>c.id===state.selectedId);if(selectedPart&&selectedPart.type!=='wire')drawComponent(c,selectedPart,true);

    const selected=state.components.find(c=>c.id===state.selectedId);
    if(selected && selected.type!=='opamp') for(const end of terminalKeys(selected)) { const p=representativePoint(selected[end],selected,end); c.fillStyle='#fff'; c.strokeStyle='#0874cb'; c.lineWidth=3; c.beginPath(); c.arc(p.x,p.y,8,0,Math.PI*2); c.fill(); c.stroke(); c.fillStyle='#164978'; c.font='bold 13px system-ui'; c.fillText(`${end.toUpperCase()} · ${holeName(physicalHole(selected,end))}`,p.x,p.y-14); }
    if (state.pendingNode) {
      const p=state.pendingHole ? holePoint(state.pendingHole) : nodePosition(state.pendingNode);
      if (p) { c.strokeStyle='#ffffff'; c.lineWidth=2; c.beginPath(); c.arc(p.x,p.y,10,0,Math.PI*2); c.stroke(); }
    }
  }

  function representativePoint(node, comp, which) {
    if (!node) return null;
    if(independentRails&&Object.hasOwn(railNames,node)&&!comp?.[which+'Hole'])return nodePosition(node);
    if (comp?.[which+'Hole']) return holePoint(comp[which+'Hole']);
    if (node === 'GND') {
      const other = which === 'a' ? comp?.b : comp?.a;
      if (other && String(other).startsWith('B:')) return {x:colX(Number(other.split(':')[1])), y:bb.rows.GND_BOTTOM};
      return {x:colX(15), y:bb.rows.GND_TOP};
    }
    if (node === 'VPLUS') return {x:colX(15), y:bb.rows.VPLUS};
    if (node === 'VMINUS') return {x:colX(15), y:bb.rows.VMINUS};
    const [half, c] = node.split(':');
    const rows = half === 'T' ? ['A','B','C','D','E'] : ['F','G','H','I','J'];
    const y = which === 'a' ? bb.rows[rows[1]] : bb.rows[rows[3]];
    return {x:colX(Number(c)), y};
  }

  function drawComponent(c, comp, selected) {
    c.save();
    if (selected) { c.shadowColor='#70b6ff'; c.shadowBlur=10; }
    if (comp.type === 'wire' || comp.type === 'resistor' || comp.type === 'capacitor' || comp.type === 'potentiometer') {
      const a=representativePoint(comp.a,comp,'a'), b=representativePoint(comp.b,comp,'b');
      if (!a||!b) return c.restore();
      if (comp.type === 'wire') {
        drawRoute(c,comp.id,comp.color||'#47a86e',4);
      } else if (comp.type === 'resistor' || comp.type === 'potentiometer') {
        const mx=(a.x+b.x)/2, my=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x),ux=Math.cos(angle),uy=Math.sin(angle);
        c.strokeStyle='#474038'; c.lineWidth=3; c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(mx-32*ux,my-32*uy); c.stroke();
        c.beginPath(); c.moveTo(mx+32*ux,my+32*uy); c.lineTo(b.x,b.y); c.stroke();
        if(comp.type==='potentiometer'){const w=representativePoint(comp.w,comp,'w'),length=Math.hypot(w.x-mx,w.y-my)||1,wx=(w.x-mx)/length,wy=(w.y-my)/length,tx=mx+wx*14,ty=my+wy*14;c.strokeStyle='#15677b';c.beginPath();c.moveTo(w.x,w.y);c.lineTo(tx,ty);c.stroke();c.beginPath();c.moveTo(tx+wx*12-wy*6,ty+wy*12+wx*6);c.lineTo(tx,ty);c.lineTo(tx+wx*12+wy*6,ty+wy*12-wx*6);c.stroke();}
        c.translate(mx,my); c.rotate(Math.atan2(b.y-a.y,b.x-a.x));
        c.fillStyle=comp.variant==='sensor'?'#a4d9c5':comp.type==='potentiometer'?'#a4cad9':'#d8c7a0'; c.strokeStyle='#78684e'; c.lineWidth=2; c.fillRect(-32,-10,64,20); c.strokeRect(-32,-10,64,20);
        c.fillStyle='#3b3328'; c.font='13px system-ui'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(fmt(comp.value,'Ω'),0,0);
        if(comp.type==='potentiometer'||comp.variant==='sensor'){c.font='bold 12px system-ui';c.fillText(comp.variant==='sensor'?'SENSOR':`W ${Math.round(comp.position*100)}%`,0,-21);}
      } else {
        c.strokeStyle='#474038'; c.lineWidth=3;
        const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, ang=Math.atan2(b.y-a.y,b.x-a.x);
        const ux=Math.cos(ang), uy=Math.sin(ang), px=-uy, py=ux;
        c.beginPath(); c.moveTo(a.x,a.y); c.lineTo(mx-ux*7,my-uy*7); c.stroke();
        c.beginPath(); c.moveTo(b.x,b.y); c.lineTo(mx+ux*7,my+uy*7); c.stroke();
        c.beginPath(); c.moveTo(mx-ux*5+px*13,my-uy*5+py*13); c.lineTo(mx-ux*5-px*13,my-uy*5-py*13); c.stroke();
        c.beginPath(); c.moveTo(mx+ux*5+px*13,my+uy*5+py*13); c.lineTo(mx+ux*5-px*13,my+uy*5-py*13); c.stroke();
        c.fillStyle='#3b3328'; c.font='13px system-ui'; c.textAlign='center'; c.fillText(fmt(comp.value,'F'),mx,my-18);
      }
    } else if (comp.type === 'opamp') {
      const x1=colX(comp.startCol)-12, x2=colX(comp.startCol+3)+12;
      const y1=bb.rows.E+8, y2=bb.rows.F-8;
      c.fillStyle='#22272b'; c.strokeStyle= selected ? '#70b6ff' : '#0e1113'; c.lineWidth=3; c.fillRect(x1,y1,x2-x1,y2-y1); c.strokeRect(x1,y1,x2-x1,y2-y1);
      c.fillStyle='#ddd'; c.font='bold 13px system-ui'; c.textAlign='center'; c.fillText('UA741', (x1+x2)/2, (y1+y2)/2+4);
      c.beginPath(); c.strokeStyle='#aeb4b8'; c.arc(x1+7,(y1+y2)/2,7,-Math.PI/2,Math.PI/2); c.stroke();
      c.fillStyle='#e4edf3';c.beginPath();c.arc(x1+12,y2-6,2.5,0,Math.PI*2);c.fill();
      const pins=opampPins(comp);
      for (const [pin,node] of Object.entries(pins)) {
        const top = node.startsWith('T:');
        const col=Number(node.split(':')[1]);
        const px=colX(col), py=top?bb.rows.E:bb.rows.F;
        c.strokeStyle='#9b9b9b'; c.lineWidth=2; c.beginPath(); c.moveTo(px, top?y1: y2); c.lineTo(px,py); c.stroke();
        c.fillStyle='#4a4a4a'; c.font='11px system-ui'; c.fillText(pin,px,top?y1-5:y2+13);
      }
    }
    c.restore();
  }

  function drawLead(c,key) {
    const [color,label]=leadStyle[key],p=leadPoint(key);if(!p)return;
    drawRoute(c,key,color,3);
    c.save();c.fillStyle=color;c.beginPath();c.arc(p.x,p.y,6,0,Math.PI*2);c.fill();
    c.font='bold 14px system-ui';c.textAlign='left';
    const dock=visualDocks.get(key),box=dock.label;
    c.fillStyle='#e9e2cf';c.fillRect(box.left,box.top,box.right-box.left,box.bottom-box.top);c.fillStyle=key.startsWith('ch1')?'#806000':key==='ch2tip'?'#176b9b':key==='generator'?'#8a4e0b':color;c.fillText(label,box.left+5,box.bottom-5);
    if(state.selectedId===key){c.strokeStyle='#ffffff';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,9,0,Math.PI*2);c.stroke();c.fillStyle='#164978';c.textAlign='right';c.fillText(holeName(state.leadHoles[key]),p.x-12,p.y-10);}
    c.restore();
  }

  // -----------------------------
  // Breadboard interaction
  // -----------------------------
  const leadKeys=Object.keys(leadStyle);
  let drag=null, hoverHole=null, moveRequest=null, pan=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function holePoint(h) { return {x:colX(h.col),y:bb.rows[h.row]}; }
  function holeRef(h) { return {row:h.row,col:h.col}; }
  function holeName(h) { return `${h.row} ${h.col}`; }
  function getLead(key) { if(isDivider)return state.leads[key]??null;return key==='genttl'?state.generator.ttlNode:key==='gengnd'?state.generator.groundNode:key==='generator'?state.generatorNode:state.probes[key.slice(0,3)][key.slice(3)]; }
  function setLead(key,h) { if(isDivider){state.leads[key]=h?nodeFor(h.row,h.col):null;if(h)state.leadHoles[key]=holeRef(h);else delete state.leadHoles[key];return;}if(key==='generator')state.generatorNode=h?nodeFor(h.row,h.col):null;else if(key==='genttl'||key==='gengnd')state.generator[key==='genttl'?'ttlNode':'groundNode']=h?nodeFor(h.row,h.col):null;else state.probes[key.slice(0,3)][key.slice(3)]=h?nodeFor(h.row,h.col):null; if(h)state.leadHoles[key]=holeRef(h);else delete state.leadHoles[key]; }
  function leadPoint(key) { return state.leadHoles[key]?holePoint(state.leadHoles[key]):nodePosition(getLead(key),key.startsWith('ch2')?'bottom':null); }
  function physicalHole(comp,end) { return comp[end+'Hole'] || holeRef(nearestHole(...Object.values(representativePoint(comp[end],comp,end)))); }
  function putEnd(comp,end,h) { comp[end+'Hole']=holeRef(h);comp[end]=nodeFor(h.row,h.col); }
  const holeId=h=>`${h.row}:${h.col}`;
  const componentOwner=c=>'component:'+c.id;
  const leadOwner=key=>'lead:'+key;
  function componentHoles(comp){
    if(comp.type==='opamp')return UA741.holes(comp).map(item=>({hole:item.hole,label:`${comp.id} pin ${item.pin} (${item.function})`}));
    return terminalKeys(comp).map(end=>({hole:physicalHole(comp,end),label:`${comp.id} terminal ${end.toUpperCase()}`}));
  }
  function holeOccupants(){
    const entries=[];
    for(const comp of state.components)for(const item of componentHoles(comp))entries.push({...item,owner:componentOwner(comp)});
    for(const key of leadKeys)if(getLead(key))entries.push({hole:state.leadHoles[key]||holeRef(nearestHole(...Object.values(leadPoint(key)))),label:key==='generator'?'MAIN lead':key==='genttl'?'TTL lead':key==='gengnd'?'generator return':key.toUpperCase(),owner:leadOwner(key)});
    return entries;
  }
  function occupiedAt(hole,ignoreOwner=null){return holeOccupants().find(item=>item.owner!==ignoreOwner&&holeId(item.hole)===holeId(hole));}
  function componentConflict(comp){
    const seen=new Set();
    for(const {hole} of componentHoles(comp)){
      if(seen.has(holeId(hole)))return `${holeName(hole)} cannot hold both terminals.`;
      seen.add(holeId(hole));const hit=occupiedAt(hole,componentOwner(comp));
      if(hit)return `${holeName(hole)} is occupied by ${hit.label}. Choose another hole.`;
    }
    return null;
  }
  function leadConflict(key,hole){const hit=occupiedAt(hole,leadOwner(key));return hit?`${holeName(hole)} is occupied by ${hit.label}. Choose another hole.`:null;}
  function reconnectEnd(comp,end,hole){const next=clone(comp);putEnd(next,end,hole);const error=componentConflict(next);if(error){toast(error);return false;}Object.assign(comp,next);return true;}
  // Allocate old net-only positions and repair saved layouts without changing nets.
  // Work on a copy so a full strip or overlapping IC cannot partially load a lab.
  function prepareLayout(board,repairExisting=false){
    const result=clone(board),used=new Set(),pending=[];let relocated=0;
    if(!isDivider)SFG1013.normalize(result.generator);result.leadHoles ||= {};
    const reserve=(hole,label)=>{const id=holeId(hole);if(used.has(id))throw new Error(`${holeName(hole)} is occupied (${label}).`);used.add(id);};
    for(const comp of result.components)if(comp.type==='opamp')for(const item of componentHoles(comp))reserve(item.hole,item.label);
    const terminals=[];
    for(const comp of result.components)if(comp.type!=='opamp')for(const end of terminalKeys(comp))terminals.push({node:comp[end],preferred:physicalHole(comp,end),explicit:!!comp[end+'Hole'],label:`${comp.id} ${end.toUpperCase()}`,set:hole=>putEnd(comp,end,hole)});
    for(const key of leadKeys){const node=isDivider?result.leads[key]:key==='generator'?result.generatorNode:key==='genttl'?result.generator.ttlNode:key==='gengnd'?result.generator.groundNode:result.probes[key.slice(0,3)][key.slice(3)];if(node)terminals.push({node,preferred:result.leadHoles[key]||holeRef(nearestHole(...Object.values(nodePosition(node,key.startsWith('ch2')?'bottom':null)))),explicit:!!result.leadHoles[key],label:key,set:hole=>result.leadHoles[key]=holeRef(hole)});}
    // Preserve existing unique holes before assigning generated positions.
    for(const item of terminals){if(item.explicit&&nodeFor(item.preferred.row,item.preferred.col)!==item.node)throw new Error(`Hole and electrical net disagree for ${item.label}.`);if(item.explicit&&!used.has(holeId(item.preferred))){reserve(item.preferred,item.label);item.set(item.preferred);}else{if(item.explicit&&!repairExisting)throw new Error(`${holeName(item.preferred)} is occupied (${item.label}).`);pending.push(item);}}
    for(const item of pending){
      const preferred=holePoint(item.preferred),candidates=allHoles.filter(h=>h.node===item.node&&!used.has(holeId(h))).sort((a,b)=>Math.hypot(a.x-preferred.x,a.y-preferred.y)-Math.hypot(b.x-preferred.x,b.y-preferred.y));
      if(!candidates.length)throw new Error(`No free hole on ${nodeLabel(item.node)} for ${item.label}.`);
      const hole=candidates[0];reserve(hole,item.label);item.set(hole);if(item.explicit&&holeId(hole)!==holeId(item.preferred))relocated++;
    }
    return {board:result,relocated};
  }
  function leadAt(p) { return leadKeys.slice().reverse().find(key=>{const h=getLead(key)&&leadPoint(key);return h&&Math.hypot(h.x-p.x,h.y-p.y)<13;}); }
  function boardSnapshot() { if(isDivider)return JSON.stringify({components:state.components,leads:state.leads,leadHoles:state.leadHoles,supply:state.supply,meter:state.meter});return JSON.stringify({components:state.components,generatorNode:state.generatorNode,probes:state.probes,leadHoles:state.leadHoles,supply:state.supply,generator:state.generator}); }
  const history={past:[],future:[],current:null};
  function recordBoard() { const next=boardSnapshot();if(history.current!==next){if(history.current)history.past.push(history.current);if(history.past.length>100)history.past.shift();history.current=next;history.future=[];}updateHistoryButtons(); }
  function updateHistoryButtons() { document.getElementById('undoBtn').disabled=!history.past.length;document.getElementById('redoBtn').disabled=!history.future.length; }
  function undoBoard(redo=false) { cancelGesture();if(!isDivider)document.getElementById('pinoutNotice').hidden=true;const from=redo?history.future:history.past,to=redo?history.past:history.future;if(!from.length)return;to.push(history.current);history.current=from.pop();Object.assign(state,JSON.parse(history.current));state.selectedId=null;syncInputs();updateAll();toast(redo?'Circuit edit redone.':'Circuit edit undone.'); }
  function cancelGesture() { pan=null;if(drag){if(drag.comp)Object.assign(drag.comp,drag.original);else setLead(drag.key,drag.original);drag=null;}moveRequest=null;state.pendingNode=null;state.pendingHole=null;state.pendingSecond=null;hoverHole=null;drawBreadboard(); }
  function hint(text) { document.getElementById('placementHint').textContent=text; }
  function setTool(tool) {
    cancelGesture();state.selectedTool=tool;
    document.querySelectorAll('#toolBar button').forEach(b=>{b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool));});
    const hints={pan:'Drag to pan the zoomed board. Use Select to move components.',select:'Drag a part to move it. Select a part, then drag its terminal handles to reconnect a terminal. Arrow keys nudge; Esc cancels.',wire:'Click two holes for a wire. Esc cancels the first hole.',resistor:'Click two holes for a resistor. Esc cancels the first hole.',capacitor:'Click two holes for a capacitor. Esc cancels the first hole.',opamp:'Click the main board to place an UA741 across the center gap.',generator:'Click a hole for the SFG MAIN output.',genttl:'Click a hole for the SFG TTL output.',gengnd:'Click a hole for the common grounded generator return.',ch1tip:'Click a hole for CH1 tip.',ch1gnd:'Click a hole for CH1 ground.',ch2tip:'Click a hole for CH2 tip.',ch2gnd:'Click a hole for CH2 ground.',erase:'Click a part or a lead endpoint to remove it. Undo restores it.'};
    document.querySelectorAll('#toolBar [data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
    Object.assign(hints,{potentiometer:'Choose terminal A, terminal B, then wiper W. Escape cancels the whole part.',sensor:'Choose two holes for an adjustable resistance sensor.',supplyPositive:'Connect the DC positive lead to a free hole.',supplyNegative:'Connect the DC negative lead to a free hole.',meterRed:'Connect the red meter probe to a free hole.',meterBlack:'Connect the black meter probe to a free hole.'});
    hint(hints[tool]);bb.canvas.style.cursor=['select','pan'].includes(tool)?'grab':'crosshair';drawBreadboard();
  }
  function opFits(comp,col) { return col>=1&&col<=27&&!componentConflict({...comp,startCol:col}); }
  function translated(comp,dc,dr) {
    const next=clone(comp);
    if(comp.type==='opamp'){if(dr||!opFits(comp,comp.startCol+dc))return null;next.startCol+=dc;return next;}
    const rows=Object.keys(bb.rows).sort((a,b)=>bb.rows[a]-bb.rows[b]);
    for(const end of terminalKeys(comp)){const h=physicalHole(comp,end),row=rows[rows.indexOf(h.row)+dr],col=h.col+dc;if(!row||col<1||col>30)return null;putEnd(next,end,{row,col});}
    return componentConflict(next)?null:next;
  }
  function commitMove(comp,next) { if(!next){toast('That move uses an occupied hole or goes outside the board.');return;}Object.assign(comp,next);state.challenge.actions++;updateAll(); }
  document.getElementById('toolBar').addEventListener('click',e=>{const b=e.target.closest('button[data-tool]');if(b)setTool(b.dataset.tool);});
  bb.canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||drag)return;e.preventDefault();bb.canvas.focus({preventScroll:true});
    const p=pointerToCanvas(e,bb.canvas),hole=nearestHole(p.x,p.y),tool=state.selectedTool;
    if(tool==='pan'){const wrap=bb.canvas.parentElement;pan={x:e.clientX,y:e.clientY,left:wrap.scrollLeft,top:wrap.scrollTop};bb.canvas.setPointerCapture(e.pointerId);return;}
    if(moveRequest){if(hole){const {comp,end}=moveRequest;const other=physicalHole(comp,end==='a'?'b':'a');if(other.row===hole.row&&other.col===hole.col)return toast('Terminals need distinct physical holes.');if(!reconnectEnd(comp,end,hole))return;moveRequest=null;updateAll();hint('Terminal moved. Drag a part or select another terminal.');}return;}
    if(tool==='select'||tool==='erase'){
      const selected=state.components.find(c=>c.id===state.selectedId);
      const end=selected&&selected.type!=='opamp'&&terminalKeys(selected).find(k=>{const h=representativePoint(selected[k],selected,k);return Math.hypot(h.x-p.x,h.y-p.y)<13;});
      let key=!end&&leadAt(p),hit=end?selected:(!key&&findComponentAt(p.x,p.y));
      if(!end&&!key&&!hit)key=leadKeys.slice().reverse().find(k=>getLead(k)&&WireRouting.hit(ensureRoutes().get(k).points,p,8));
      if(tool==='erase'){if(key){setLead(key,null);updateAll();}else if(hit)removeComponent(hit.id);return;}
      state.selectedId=key||hit?.id||null;updateEditor();drawBreadboard();
      if(hit||key){drag={comp:hit||null,key,end,origin:p,original:hit?clone(hit):holeRef(nearestHole(...Object.values(leadPoint(key)))),valid:true,moved:false};bb.canvas.setPointerCapture(e.pointerId);}
      return;
    }
    if(!hole){toast('Choose a breadboard hole.');return;}
    if(tool==='opamp'&&profile.tools.includes('opamp')){
      if(!/^[TB]:/.test(hole.node))return toast('Place the IC on the main board.');
      const comp={id:uid('U'),type:'opamp',model:'UA741',startCol:clamp(hole.col-1,1,27),openLoopGain:200000,gainBandwidth:1e6,outputHeadroom:2,slewRate:0.5e6};
      if(!opFits(comp,comp.startCol))return toast(componentConflict(comp)||'The IC does not fit here.');
      state.components.push(comp);state.selectedId=comp.id;updateAll();return;
    }
    if(leadKeys.includes(tool)){const error=leadConflict(tool,hole);if(error)return toast(error);setLead(tool,hole);state.selectedId=tool;updateAll();return;}
    if(profile.tools.includes(tool)){
      const hit=occupiedAt(hole);if(hit)return toast(`${holeName(hole)} is occupied by ${hit.label}. Choose another hole.`);
      if(!state.pendingHole){state.pendingHole=holeRef(hole);state.pendingNode=hole.node;hint(`First terminal: ${holeName(hole)}. Choose the second hole; Esc cancels.`);drawBreadboard();return;}
      if(state.pendingHole.row===hole.row&&state.pendingHole.col===hole.col)return toast('Choose a different hole for the second terminal.');
      if(tool==='potentiometer'&&!state.pendingSecond){state.pendingSecond=holeRef(hole);hint('Now choose the wiper terminal W; Escape cancels the whole potentiometer.');drawBreadboard();return;}
      const comp={id:uid(tool[0].toUpperCase()),type:tool==='sensor'?'resistor':tool,value:{wire:null,resistor:10000,sensor:10000,potentiometer:10000,capacitor:profile.defaults.capacitor??100e-9}[tool],color:'#48a26a',...(tool==='sensor'?{variant:'sensor'}:{}),...(tool==='potentiometer'?{position:0.5}:{})};
      putEnd(comp,'a',state.pendingHole);putEnd(comp,'b',state.pendingSecond||hole);if(tool==='potentiometer')putEnd(comp,'w',hole);const error=componentConflict(comp);if(error)return toast(error);state.components.push(comp);state.selectedId=comp.id;state.pendingNode=null;state.pendingHole=null;state.pendingSecond=null;state.challenge.actions++;updateAll();hint('Part placed. Choose two holes for another, or Select to move it.');
    }
  });
  bb.canvas.addEventListener('pointermove',e=>{
    if(pan){const wrap=bb.canvas.parentElement;wrap.scrollLeft=pan.left+pan.x-e.clientX;wrap.scrollTop=pan.top+pan.y-e.clientY;return;}
    const p=pointerToCanvas(e,bb.canvas);hoverHole=nearestHole(p.x,p.y);
    const occupant=hoverHole&&occupiedAt(hoverHole);
    document.getElementById('holeReadout').textContent=hoverHole?`${holeName(hoverHole)} · ${occupant?'Occupied: '+occupant.label:'Free'} · ${nodeLabel(hoverHole.node)}`:'Hover over a hole to see its connection';
    if(drag){
      if(!drag.moved&&Math.hypot(p.x-drag.origin.x,p.y-drag.origin.y)<5)return;drag.moved=true;
      if(drag.key||drag.end){drag.valid=!!hoverHole;drag.error=null;if(hoverHole){if(drag.key){drag.error=leadConflict(drag.key,hoverHole);if(!drag.error)setLead(drag.key,hoverHole);}else{const next=clone(drag.original);putEnd(next,drag.end,hoverHole);drag.error=componentConflict(next);if(!drag.error)Object.assign(drag.comp,next);}drag.valid=!drag.error;}}
      else { const dc=Math.round((p.x-drag.origin.x)/bb.dx),rows=Object.keys(bb.rows).sort((a,b)=>bb.rows[a]-bb.rows[b]);
        const anchor=drag.comp.type==='opamp'?null:physicalHole(drag.original,'a');
        const targetY=anchor?bb.rows[anchor.row]+p.y-drag.origin.y:0;
        const row=anchor?rows.reduce((a,b)=>Math.abs(bb.rows[a]-targetY)<Math.abs(bb.rows[b]-targetY)?a:b):null;
        const dr=anchor?rows.indexOf(row)-rows.indexOf(anchor.row):0;
        const next=translated(drag.original,dc,dr);drag.valid=!!next&&p.x>=25&&p.x<=1155&&p.y>=35&&p.y<=585;if(drag.valid)Object.assign(drag.comp,next);
      }
      bb.canvas.style.cursor=drag.valid?'grabbing':'not-allowed';
    }drawBreadboard();
  });
  bb.canvas.addEventListener('pointerup',e=>{if(pan){pan=null;if(bb.canvas.hasPointerCapture(e.pointerId))bb.canvas.releasePointerCapture(e.pointerId);return;}if(!drag)return;const d=drag;if(d.comp&&d.comp.type!=='opamp'&&d.comp.aHole.row===d.comp.bHole.row&&d.comp.aHole.col===d.comp.bHole.col)d.valid=false;if(!d.valid){cancelGesture();toast(d.error||'Move cancelled: choose unoccupied holes within the board.');}else{drag=null;if(d.moved){state.challenge.actions++;updateAll();}}if(bb.canvas.hasPointerCapture(e.pointerId))bb.canvas.releasePointerCapture(e.pointerId);bb.canvas.style.cursor='grab';});
  bb.canvas.addEventListener('pointercancel',()=>{cancelGesture();updateEditor();});
  bb.canvas.addEventListener('lostpointercapture',()=>{pan=null;if(drag){cancelGesture();updateEditor();}});
  bb.canvas.addEventListener('pointerleave',()=>{if(!drag){hoverHole=null;drawBreadboard();}});
  document.getElementById('undoBtn').onclick=()=>undoBoard();document.getElementById('redoBtn').onclick=()=>undoBoard(true);
  document.getElementById('cancelPlacementBtn').onclick=()=>setTool('select');
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,select,textarea,[contenteditable="true"]'))return;
    if(e.key==='Escape'){setTool('select');updateEditor();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undoBoard(e.shiftKey);return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();undoBoard(true);return;}
    const comp=state.components.find(c=>c.id===state.selectedId);
    if(e.key==='Delete'||e.key==='Backspace'){if(comp||leadKeys.includes(state.selectedId)){e.preventDefault();if(comp)removeComponent(comp.id);else{setLead(state.selectedId,null);state.selectedId=null;updateAll();}}return;}
    if(document.activeElement!==bb.canvas||!comp)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta){e.preventDefault();commitMove(comp,translated(comp,...delta));}
  });
  let zoom=1;
  function setZoom(value){zoom=clamp(value,0.5,2.5);bb.canvas.style.width=`${zoom*100}%`;document.getElementById('zoomReadout').textContent=`${Math.round(zoom*100)}%`;}
  document.getElementById('zoomInBtn').onclick=()=>setZoom(zoom+.25);document.getElementById('zoomOutBtn').onclick=()=>setZoom(zoom-.25);document.getElementById('fitBoardBtn').onclick=()=>setZoom(1);

  function findComponentAt(x,y) {
    const ordered=[...state.components].sort((a,b)=>((a.type==='opamp'?4:a.type==='wire'?0:2)+(a.id===state.selectedId?1:0))-((b.type==='opamp'?4:b.type==='wire'?0:2)+(b.id===state.selectedId?1:0)));
    for (let i=ordered.length-1;i>=0;i--) {
      const comp=ordered[i];
      if (comp.type==='opamp') {
        const x1=colX(comp.startCol)-16,x2=colX(comp.startCol+3)+16,y1=bb.rows.E,y2=bb.rows.F;
        if (x>=x1&&x<=x2&&y>=y1&&y<=y2) return comp;
      } else if(comp.type==='wire') {
        const route=ensureRoutes().get(comp.id);if(route&&WireRouting.hit(route.points,{x,y},10))return comp;
      } else {
        const a=representativePoint(comp.a,comp,'a'),b=representativePoint(comp.b,comp,'b'); if(!a||!b) continue;
        if(comp.type==='potentiometer'){const w=representativePoint(comp.w,comp,'w');if(WireRouting.hit([w,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}],{x,y},12))return comp;}
        const dx=b.x-a.x,dy=b.y-a.y,len2=dx*dx+dy*dy; const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(len2||1),0,1);
        const px=a.x+t*dx,py=a.y+t*dy;
        if ((x-px)**2+(y-py)**2 < (comp.type==='wire'?10:18)**2) return comp;
      }
    }
    return null;
  }
  function removeComponent(id) {
    state.components=state.components.filter(c=>c.id!==id); if(state.selectedId===id)state.selectedId=null; state.challenge.actions++; updateAll();
  }

  function normalizePositions() {
    if(!isDivider)SFG1013.normalize(state.generator);
    state.leadHoles ||= {};
    for(const comp of state.components)if(comp.type==='opamp'){comp.model='UA741';comp.gainBandwidth??=1e6;comp.outputHeadroom??=2;}
    const prepared=prepareLayout(JSON.parse(boardSnapshot()));
    for(let i=0;i<state.components.length;i++)Object.assign(state.components[i],prepared.board.components[i]);
    state.leadHoles=prepared.board.leadHoles;
  }
  function positionFields(h,key,label) {
    const rows=Object.keys(bb.rows).sort((a,b)=>bb.rows[a]-bb.rows[b]);
    return `<fieldset class="position-fields"><legend>${label}</legend><label>Row<select id="${key}Row">${rows.map(row=>`<option ${row===h.row?'selected':''}>${row}</option>`).join('')}</select></label><label>Column<input id="${key}Col" type="number" min="1" max="30" step="1" value="${h.col}"></label></fieldset>`;
  }
  function updateEditor() {
    const el=document.getElementById('selectedComponentEditor'),list=document.getElementById('componentList');
    list.replaceChildren(new Option('Choose a part or connected lead…',''));
    for(const c of state.components)list.add(new Option(`${c.id} · ${c.variant==='sensor'?'resistance sensor':c.type}${c.value?' · '+fmt(c.value,c.type==='resistor'||c.type==='potentiometer'?'Ω':'F'):''}`,c.id));
    for(const key of leadKeys)if(getLead(key))list.add(new Option(key==='generator'?'SFG MAIN lead':key==='genttl'?'SFG TTL lead':key==='gengnd'?'SFG common return':key.toUpperCase(),key));
    list.value=state.selectedId||'';
    const comp=state.components.find(c=>c.id===state.selectedId),key=leadKeys.includes(state.selectedId)&&state.selectedId;
    if(!comp&&!key){el.className='editor-empty';el.textContent='Select a part on the board or in the list above. Drag its body to move it; select it to reveal terminal handles.';return;}
    el.className='editor-grid';
    if(key){
      if(!getLead(key)){state.selectedId=null;return updateEditor();}
      el.innerHTML=positionFields(state.leadHoles[key],'lead','Lead connection')+'<button id="applyPosition">Apply position</button><button id="deleteSelected" class="danger">Disconnect lead</button>';
      el.querySelector('#applyPosition').onclick=()=>{const h=readPosition('lead');if(h){const error=leadConflict(key,h);if(error)return toast(error);setLead(key,h);updateAll();}};
      el.querySelector('#deleteSelected').onclick=()=>{setLead(key,null);state.selectedId=null;updateAll();};return;
    }
    el.innerHTML=`<strong>${comp.id} · ${comp.type==='opamp'?'UA741 DIP-8':comp.type}</strong>`;
    if(comp.type==='resistor'||comp.type==='capacitor'||comp.type==='potentiometer')el.innerHTML+=`<label>${comp.type==='potentiometer'?'Total track resistance (Ω)':comp.type==='resistor'?'Resistance (Ω)':'Capacitance (F)'}<input id="editValue" type="text" value="${comp.value}" spellcheck="false"></label><span class="small">Accepts values such as 10k, 1M, 100n or 0.000001.</span>`;
    if(comp.type==='wire')el.innerHTML+=`<label>Wire color<input id="editColor" type="color" value="${comp.color||'#48a26a'}"></label>`;
    if(comp.type==='opamp'){
      el.innerHTML+=`<label>Start column (pins 1 / 8)<input id="editColumn" type="number" min="1" max="27" step="1" value="${comp.startCol}"></label><label>Open-loop gain<input id="editGain" type="number" min="1" value="${comp.openLoopGain}"></label><label>Slew rate (V/µs)<input id="editSlew" type="number" min="0.01" step="0.1" value="${comp.slewRate/1e6}"></label><p class="small">UA741 behavioral model: 1 MHz gain-bandwidth, 2 V output headroom approximation. Slides along the center gap. Existing wires stay in their holes; reconnect them after moving the IC.</p>`;
    }else{
      el.innerHTML+=positionFields(physicalHole(comp,'a'),'a','Terminal A')+positionFields(physicalHole(comp,'b'),'b','Terminal B')+'<button id="applyPosition">Apply positions</button><div class="edit-actions"><button id="moveA">Reconnect A…</button><button id="moveB">Reconnect B…</button></div>';
      if(comp.type==='potentiometer')el.innerHTML+=positionFields(physicalHole(comp,'w'),'w','Wiper W')+'<button id="moveW">Reconnect W…</button><label>Wiper position (%)<input id="editWiper" type="range" min="0" max="100" step="1" value="'+comp.position*100+'"></label><output id="wiperReadout">'+comp.position*100+'%</output>';
      if(comp.variant==='sensor')el.innerHTML+='<label>Sensor resistance (logarithmic)<input id="editSensor" type="range" min="2" max="6" step="0.01" value="'+Math.log10(comp.value)+'"></label>';
      el.innerHTML+=`<p class="small">A: ${nodeLabel(comp.a)}<br>B: ${nodeLabel(comp.b)}<br>Each A–E column is connected; each F–J column is connected. Moving within a strip preserves the connection.</p>`;
    }
    el.innerHTML+='<div class="edit-actions"><button id="nudgeLeft" aria-label="Move left one column">← Move</button><button id="nudgeRight" aria-label="Move right one column">Move →</button></div><button id="deleteSelected" class="danger">Delete part</button>';
    function numberEdit(id,apply,min){const input=el.querySelector('#'+id);if(input)input.onchange=()=>{const v=id==='editValue'?engParse(input.value):Number(input.value);if(!input.value.trim()||!Number.isFinite(v)||v<min||(isDivider&&id==='editValue'&&(v<100||v>1e6))||(id==='editValue'&&profile.ranges?.[comp.type]&&(v<profile.ranges[comp.type][0]||v>profile.ranges[comp.type][1]))){toast(isRc?'Use 100 Ω–1 MΩ resistors or 100 pF–10 µF capacitors.':isDivider?'Enter a resistance from 100 Ω to 1 MΩ.':'Enter a valid positive value.');updateEditor();return;}apply(v);updateAll();};}
    numberEdit('editValue',v=>comp.value=v,1e-15);numberEdit('editGain',v=>comp.openLoopGain=v,1);numberEdit('editSlew',v=>comp.slewRate=v*1e6,.01);
    for(const [id,apply] of [['editWiper',v=>comp.position=v/100],['editSensor',v=>comp.value=10**v]]){const input=el.querySelector('#'+id);if(input){input.oninput=()=>{apply(Number(input.value));drawBreadboard();simulateAndRender();const readout=el.querySelector('#wiperReadout');if(readout)readout.textContent=input.value+'%';};input.onchange=()=>updateAll();}}
    const col=el.querySelector('#editColumn');if(col)col.onchange=()=>{const n=Number(col.value);if(!Number.isInteger(n)||!opFits(comp,n)){toast('Choose an available start column from 1 to 27.');updateEditor();return;}comp.startCol=n;updateAll();};
    const color=el.querySelector('#editColor');if(color)color.onchange=()=>{comp.color=color.value;updateAll();};
    const apply=el.querySelector('#applyPosition');if(apply)apply.onclick=()=>{const a=readPosition('a'),b=readPosition('b');if(!a||!b)return;if(a.row===b.row&&a.col===b.col)return toast('Terminals need distinct physical holes.');const next=clone(comp);putEnd(next,'a',a);putEnd(next,'b',b);if(comp.type==='potentiometer'){const w=readPosition('w');if(!w)return;putEnd(next,'w',w);}const error=componentConflict(next);if(error)return toast(error);Object.assign(comp,next);updateAll();};
    for(const end of terminalKeys(comp)){const button=el.querySelector('#move'+end.toUpperCase());if(button)button.onclick=()=>{setTool('select');moveRequest={comp,end};bb.canvas.scrollIntoView({block:'center'});hint(`Click the new hole for ${comp.id} terminal ${end.toUpperCase()}. Esc cancels.`);};}
    el.querySelector('#nudgeLeft').onclick=()=>commitMove(comp,translated(comp,-1,0));el.querySelector('#nudgeRight').onclick=()=>commitMove(comp,translated(comp,1,0));
    el.querySelector('#deleteSelected').onclick=()=>removeComponent(comp.id);
  }
  function readPosition(prefix) {const row=document.getElementById(prefix+'Row').value,col=Number(document.getElementById(prefix+'Col').value);if(!Number.isInteger(col)||col<1||col>30){toast('Choose a column from 1 to 30.');return null;}return {row,col};}
  document.getElementById('componentList').onchange=e=>{setTool('select');state.selectedId=e.target.value||null;updateEditor();drawBreadboard();};

  if(isDivider){
    dividerRuntime=DividerRuntime.create({state,profile,fmt,engParse,toast,boardSnapshot,prepareLayout,clone,setTool,setLead,putEnd,nodeFor,terminalKeys,cancelGesture,
      isEditing:()=>!!(drag||state.pendingHole||moveRequest),
      refreshBoard(){normalizePositions();recordBoard();drawBreadboard();updateEditor();},history});
    dividerRuntime.init();return;
  }

  // -----------------------------
  // Union-find and circuit solver
  // -----------------------------
  function buildConnectivity(includeProbeGrounds=true) {
    SFG1013.normalize(state.generator);
    const uf=new UnionFind();
    ['0','GND','VPLUS','VMINUS'].forEach(x=>uf.add(x));
    uf.union('GND','0');
    for(const comp of state.components){
      if(comp.type==='wire') uf.union(comp.a,comp.b);
      else if(comp.type==='opamp'){Object.values(opampPins(comp)).forEach(n=>uf.add(n));}
      else {uf.add(comp.a);uf.add(comp.b);}
    }
    if(state.generatorNode)uf.add(state.generatorNode);
    if(state.generator.ttlNode)uf.add(state.generator.ttlNode);
    if(state.generator.groundNode){uf.add(state.generator.groundNode);if(includeProbeGrounds)uf.union(state.generator.groundNode,'0');}
    for(const ch of ['ch1','ch2']){
      const p=state.probes[ch]; if(p.tip)uf.add(p.tip); if(p.gnd){uf.add(p.gnd); if(includeProbeGrounds)uf.union(p.gnd,'0');}
    }
    return uf;
  }

  function isConnected(uf,a,b){return uf.find(a)===uf.find(b);}

  function validateCircuit() {
    if(isRc){try{return RcEngine.prepare(state);}catch(error){return {warnings:[error.message],uf:new UnionFind()};}}
    const warnings=[]; const uf=buildConnectivity();
    const ops=state.components.filter(c=>c.type==='opamp');
    if(!state.generatorNode&&!state.generator.ttlNode)warnings.push('Function generator lead is not connected.');
    if(!state.generator.powered||!state.generator.output)warnings.push('SFG-1013 output is off. Use POWER and OUTPUT ON.');
    if(!state.generator.groundNode)warnings.push('Generator return is disconnected.');
    if(state.generator.ttlNode&&!state.generator.ttl)warnings.push('TTL lead is connected but TTL is disabled. Use OUTPUT ON, then SHIFT → WAVE.');
    if(state.generator.groundNode&&!isConnected(buildConnectivity(false),state.generator.groundNode,'GND'))warnings.push('Generator return is earth-grounded; connecting it here shorts this net to instrument ground.');
    if(!state.probes.ch1.tip && !state.probes.ch2.tip)warnings.push('No oscilloscope probe tip is connected.');
    for(const ch of ['ch1','ch2'])if(state.probes[ch].tip && !state.probes[ch].gnd)warnings.push(`${ch.toUpperCase()} tip is connected but its ground clip is not.`);
    for(const op of ops){
      if(state.supply.plus<5||state.supply.plus>15||state.supply.minus> -5||state.supply.minus< -15)warnings.push(`${op.id} UA741: use recommended dual supplies between ±5 V and ±15 V.`);
      const p=opampPins(op);
      if(!isConnected(uf,p[7],'VPLUS'))warnings.push(`${op.id} pin 7 (V+) is not wired to the positive rail.`);
      if(!isConnected(uf,p[4],'VMINUS'))warnings.push(`${op.id} pin 4 (V−) is not wired to the negative rail.`);
    }
    if(state.probes.ch1.gnd && state.probes.ch2.gnd && !isConnected(buildConnectivity(false),state.probes.ch1.gnd,state.probes.ch2.gnd)) warnings.push('CH1 and CH2 ground clips are common inside a bench oscilloscope. Connecting them to different nodes shorts those nodes together.');
    if(state.supply.plus<=state.supply.minus)warnings.push('Positive rail must be above the negative rail.');
    for(const comp of state.components) if(comp.type==='resistor'||comp.type==='capacitor') if(isConnected(uf,comp.a,comp.b))warnings.push(`${comp.id}: both terminals are on the same electrical net; the component is bypassed.`);
    return {warnings,uf};
  }

  function generatorVoltage(t){return SFG1013.voltage(state.generator,t);}

  function buildNetlist(uf) {
    const r=x=>uf.find(x==='GND'?'0':x);
    const resistors=[],capacitors=[],ops=[];
    for(const comp of state.components){
      if(comp.type==='resistor')resistors.push({...comp,a:r(comp.a),b:r(comp.b)});
      else if(comp.type==='capacitor')capacitors.push({...comp,a:r(comp.a),b:r(comp.b)});
      else if(comp.type==='opamp'){
        const p=opampPins(comp); ops.push({...comp,pins:Object.fromEntries(Object.entries(p).map(([k,v])=>[k,r(v)]))});
      }
    }
    return {r,resistors,capacitors,ops,gen:state.generatorNode?r(state.generatorNode):null,ttl:state.generator.ttlNode?r(state.generator.ttlNode):null,ground:r('0'),vplus:r('VPLUS'),vminus:r('VMINUS')};
  }

  function solveCircuitWaveforms() {
    if(isRc)return RcEngine.solve(state,{window:Math.max(horizontalDiv()*10,1e-7),sourceAt:(t,port)=>SFG1013.voltage(state.generator,t,port)});
    const {warnings,uf}=validateCircuit(); state.sim.warnings=warnings;
    const net=buildNetlist(uf), ground=net.ground;
    const window=Math.max(horizontalDiv()*10, 1e-7);
    const freq=Math.max(state.generator.frequency,0.1);
    const period=1/freq;
    const total=Math.max(window*2.4, period*6);
    const targetPoints=1600;
    const dt=Math.max(total/(targetPoints*2.4), 1e-9);
    const steps=Math.min(5500, Math.max(targetPoints, Math.ceil(total/dt)));
    const actualDt=total/steps;
    const keep=steps+1; // Keep the complete acquisition for measurements and pre-trigger display.

    // Collect nodes that matter.
    const nodeSet=new Set([ground,net.vplus,net.vminus]);
    for(const x of net.resistors){nodeSet.add(x.a);nodeSet.add(x.b);}
    for(const x of net.capacitors){nodeSet.add(x.a);nodeSet.add(x.b);}
    for(const op of net.ops)Object.values(op.pins).forEach(n=>nodeSet.add(n));
    if(net.gen)nodeSet.add(net.gen);
    const mainActive=net.gen&&SFG1013.active(state.generator),ttlActive=net.ttl&&SFG1013.active(state.generator,'ttl');
    const genInternal='SFG:MAIN:INTERNAL';if(mainActive)nodeSet.add(genInternal);if(net.ttl)nodeSet.add(net.ttl);
    for(const ch of ['ch1','ch2']){const p=state.probes[ch];if(p.tip)nodeSet.add(net.r(p.tip));if(p.gnd)nodeSet.add(net.r(p.gnd));}
    nodeSet.delete(ground);
    const nodes=[...nodeSet]; const ni=new Map(nodes.map((n,i)=>[n,i]));

    const capPrev=new Map(net.capacitors.map(c=>[c.id,0]));
    const opPrev=new Map(net.ops.map(op=>[op.id,0]));
    const traces={t:[],ch1:[],ch2:[],gen:[]};
    const valuesByNode=[];

    const probeNode=(ch,end)=>{const n=state.probes[ch][end]; return n?net.r(n):ground;};
    const probeDiff=(sol,ch)=>nodeV(sol,probeNode(ch,'tip'))-nodeV(sol,probeNode(ch,'gnd'));
    const nodeV=(sol,n)=>n===ground?0:(sol[ni.get(n)]??0);

    function stampG(A,a,b,g){TransientEngine.stampG(A,ni,ground,a,b,g);}
    function stampI(rhs,a,b,i){TransientEngine.stampI(rhs,ni,ground,a,b,i);}

    function solveStep(t, clamps = new Map()) {
      const sources=[];
      sources.push({id:'VPLUS',p:net.vplus,n:ground,type:'fixed',v:state.supply.plus});
      sources.push({id:'VMINUS',p:net.vminus,n:ground,type:'fixed',v:state.supply.minus});
      if(mainActive)sources.push({id:'GEN',p:genInternal,n:ground,type:'fixed',v:generatorVoltage(t)});
      if(ttlActive)sources.push({id:'TTL',p:net.ttl,n:ground,type:'fixed',v:SFG1013.voltage(state.generator,t,'ttl')});
      for(const op of net.ops){
        const powered=isConnected(uf,opampPins(op)[7],'VPLUS')&&isConnected(uf,opampPins(op)[4],'VMINUS');
        const forced=clamps.get(op.id);
        // Backward-Euler dominant pole: A(s)=A0/(1+s*A0/(2*pi*GBW)).
        const alpha=actualDt/(actualDt+op.openLoopGain/(2*Math.PI*op.gainBandwidth));
        sources.push({id:op.id,p:op.pins[6],n:ground,type:(!powered||forced!=null)?'fixed':'vcvs',v:!powered?0:forced,A:op.openLoopGain*alpha,memory:(1-alpha)*opPrev.get(op.id),vp:op.pins[3],vm:op.pins[2]});
      }
      const N=nodes.length+sources.length;
      const A=Array.from({length:N},()=>Array(N).fill(0)); const rhs=Array(N).fill(0);
      // gmin prevents totally floating nodes from making the educational UI explode immediately.
      for(let i=0;i<nodes.length;i++)A[i][i]+=1e-12;
      if(mainActive)stampG(A,genInternal,net.gen,1/50);
      if(net.gen&&state.generator.termination&&state.generator.groundNode)stampG(A,net.gen,ground,1/50);
      for(const r of net.resistors){const g=1/Math.max(r.value,1e-12);stampG(A,r.a,r.b,g);}
      for(const cap of net.capacitors)TransientEngine.stampCapacitor(A,rhs,ni,ground,cap,actualDt,capPrev.get(cap.id));
      sources.forEach((s,si)=>{
        const k=nodes.length+si;
        if(s.p!==ground){A[ni.get(s.p)][k]+=1;A[k][ni.get(s.p)]+=1;}
        if(s.n!==ground){A[ni.get(s.n)][k]-=1;A[k][ni.get(s.n)]-=1;}
        if(s.type==='fixed')rhs[k]=s.v;
        else {
          if(s.vp!==ground)A[k][ni.get(s.vp)]-=s.A;
          if(s.vm!==ground)A[k][ni.get(s.vm)]+=s.A;
          rhs[k]=s.memory||0;
        }
      });
      return gaussianSolve(A,rhs);
    }

    let lastSol=null;
    for(let step=0;step<=steps;step++){
      const t=step*actualDt;
      let clamps=new Map(),sol;
      for(let pass=0;pass<4;pass++){
        sol=solveStep(t,clamps);
        let changed=false;
        for(const op of net.ops){
          const powered=isConnected(uf,opampPins(op)[7],'VPLUS')&&isConnected(uf,opampPins(op)[4],'VMINUS'); if(!powered)continue;
          const vo=nodeV(sol,op.pins[6]);
          const hi=nodeV(sol,op.pins[7])-op.outputHeadroom, lo=nodeV(sol,op.pins[4])+op.outputHeadroom;
          const prev=opPrev.get(op.id)||0, maxDelta=Math.max(op.slewRate*actualDt,1e-6);
          let target=clamp(vo,lo,hi); target=clamp(target,prev-maxDelta,prev+maxDelta);
          if(Math.abs(target-vo)>1e-6){ if(clamps.get(op.id)!==target){clamps.set(op.id,target);changed=true;} }
        }
        if(!changed)break;
      }
      lastSol=sol;
      for(const cap of net.capacitors)capPrev.set(cap.id,nodeV(sol,cap.a)-nodeV(sol,cap.b));
      for(const op of net.ops)opPrev.set(op.id,nodeV(sol,op.pins[6]));
      if(step>steps-keep){
        traces.t.push(t); traces.ch1.push(probeDiff(sol,'ch1')); traces.ch2.push(probeDiff(sol,'ch2')); traces.gen.push(generatorVoltage(t));
      }
    }
    const t0=traces.t[0]||0; traces.t=traces.t.map(t=>t-t0);
    return {traces,dt:actualDt,window,warnings,uf,lastSol,frequency:freq};
  }

  // -----------------------------
  // Scope measurement + display helpers
  // -----------------------------
  function channelProcessed(raw, chState, dt=state.sim.last?.dt||1e-6) {
    if(!raw.length)return [];
    let arr=raw.slice();
    if(chState.coupling==='GND')arr=arr.map(()=>0);
    else if(chState.coupling==='AC'){const mean=arr.reduce((a,b)=>a+b,0)/arr.length;arr=arr.map(v=>v-mean);}
    if(chState.bwLimit==='20MHz' && arr.length>5){const out=[];let y=arr[0];const alpha=1-Math.exp(-2*Math.PI*20e6*dt);for(const x of arr){y+=alpha*(x-y);out.push(y);}arr=out;}
    // Virtual leads deliver 1X input voltage; panel attenuation changes indicated voltage.
    arr=arr.map(v=>v*chState.probe);
    if(chState.invert)arr=arr.map(v=>-v);
    return arr;
  }

  const measureGroups={
    'V/I':['Pk-Pk','Max','Min','Amplitude','High','Low','Mean','Cycle Mean','RMS','Cycle RMS','Area','Cycle Area'],
    Time:['Frequency','Period','RiseTime','FallTime','+Width','-Width','Duty Cycle','+Pulses','-Pulses','+Edges','-Edges'],
    Delay:['FRR','FRF','FFR','FFF','LRR','LRF','LFR','LFF','Phase']
  };
  const measureNames=Object.values(measureGroups).flat();
  function measureUnit(name) { return name==='Frequency'?'Hz':name==='Phase'?'°':name==='Duty Cycle'?'%':name.includes('Area')?'V·s':/Edges|Pulses/.test(name)?'':measureGroups.Time.includes(name)||measureGroups.Delay.includes(name)?'s':'V'; }
  function crossings(arr,t,level,rising=true) {const out=[];for(let i=1;i<arr.length;i++)if(rising?arr[i-1]<level&&arr[i]>=level:arr[i-1]>level&&arr[i]<=level)out.push(lerp(t[i-1],t[i],(level-arr[i-1])/(arr[i]-arr[i-1])));return out;}
  function highLow(arr,mode='Auto') {const min=Math.min(...arr),max=Math.max(...arr);if(mode==='Min-Max'||max===min)return {low:min,high:max};const bins=Array(100).fill(0);arr.forEach(v=>bins[Math.min(99,Math.floor((v-min)/(max-min)*100))]++);const peak=(a,b)=>{let index=a;for(let i=a+1;i<b;i++)if(bins[i]>bins[index])index=i;return index;};const li=peak(0,50),hi=peak(50,100);if(mode==='Auto'&&(bins[li]+bins[hi])/arr.length<.25)return {low:min,high:max};const avgBin=i=>{const vals=arr.filter(v=>Math.min(99,Math.floor((v-min)/(max-min)*100))===i);return vals.reduce((a,b)=>a+b,0)/vals.length;};return {low:avgBin(li),high:avgBin(hi)};}
  function measurement(arr,t,name,other=null,settings=scope.measure) {
    if(!arr||arr.length<3||!arr.every(Number.isFinite))return NaN;
    const min=Math.min(...arr),max=Math.max(...arr),mean=arr.reduce((a,b)=>a+b,0)/arr.length;
    const rms=Math.sqrt(arr.reduce((a,b)=>a+b*b,0)/arr.length),levels=highLow(arr,settings.highLow),span=levels.high-levels.low;
    if(name==='Vpp'||name==='Pk-Pk')return max-min;if(name==='Max')return max;if(name==='Min')return min;if(name==='Mean')return mean;if(name==='RMS')return rms;
    if(name==='High')return levels.high;if(name==='Low')return levels.low;if(name==='Amplitude')return span;
    const area=(a,tt)=>a.slice(1).reduce((v,x,i)=>v+(x+a[i])*.5*(tt[i+1]-tt[i]),0);
    if(name==='Area')return area(arr,t);
    if(span<Math.max(1e-9,Math.max(Math.abs(min),Math.abs(max))*1e-7))return /Edges|Pulses/.test(name)?0:NaN;
    const level=p=>levels.low+span*p/100;
    const rising=crossings(arr,t,level(settings.midRef??50)),falling=crossings(arr,t,level(settings.midRef??50),false);
    const cycle=rising.length>=2?rising:falling.length>=2?falling:[];
    const period=cycle.length>=2?(cycle.at(-1)-cycle[0])/(cycle.length-1):NaN;
    if(name==='Frequency')return 1/period;if(name==='Period')return period;
    if(name.startsWith('Cycle ')){if(cycle.length<2)return NaN;const indices=t.map((v,i)=>v>=cycle[0]&&v<cycle[1]?i:-1).filter(i=>i>=0),a=indices.map(i=>arr[i]),tt=indices.map(i=>t[i]);return name==='Cycle Area'?area(a,tt):measurement(a,tt,name.slice(6),null,settings);}
    if(name==='+Edges')return rising.length;if(name==='-Edges')return falling.length;
    const widths=(start,end)=>start.map(v=>{const next=end.find(e=>e>v);return next==null?NaN:next-v;}).filter(Number.isFinite);
    const positive=widths(rising,falling),negative=widths(falling,rising);
    if(name==='+Pulses')return positive.length;if(name==='-Pulses')return negative.length;
    if(name==='+Width')return positive[0]??NaN;if(name==='-Width')return negative[0]??NaN;
    if(name==='Duty Cycle')return 100*(positive[0]??NaN)/period;
    if(name==='RiseTime'||name==='FallTime'){const up=name==='RiseTime',start=crossings(arr,t,level(up?settings.lowRef:settings.highRef),up),end=crossings(arr,t,level(up?settings.highRef:settings.lowRef),up);return widths(start,end)[0]??NaN;}
    if(measureGroups.Delay.includes(name)&&other?.length===arr.length){const lev=highLow(other,settings.highLow),mid=lev.low+(lev.high-lev.low)*(settings.midRef??50)/100;const first=name==='Phase'||name[1]==='R'?rising:falling,second=crossings(other,t,mid,name==='Phase'||name[2]==='R');if(!first.length||!second.length||lev.high-lev.low<1e-9)return NaN;let delay=(name.startsWith('L')?second.at(-1)-first.at(-1):second[0]-first[0]);if(name==='Phase'){if(!Number.isFinite(period))return NaN;return ((delay/period*360+180)%360+360)%360-180;}return delay;}
    return NaN;
  }
  function currentRecord(){return !scope.running&&scope.frozenRecord?scope.frozenRecord:state.sim.last;}
  function horizontalDiv(){return scope.horizontal.timeDiv/(scope.horizontal.zoom?5:1);}
  function findTriggerIndex(arr,level,slope,t=null,dt=1e-6) {
    const middle=Math.floor(arr.length/2),halfWindow=horizontalDiv()*5;
    const candidates=[];for(let i=1;i<arr.length;i++){
      const rise=arr[i-1]<level&&arr[i]>=level,fall=arr[i-1]>level&&arr[i]<=level;
      if((slope==='Rising'?rise:slope==='Falling'?fall:rise||fall)&&(!t||t[i]>=halfWindow+scope.trigger.holdoff&&t[i]<=t.at(-1)-halfWindow))candidates.push(i);
    }
    return candidates.length?candidates.reduce((a,b)=>Math.abs(a-middle)<Math.abs(b-middle)?a:b):-1;
  }
  function makeDisplayFrame(sim) {
    if(!sim?.traces)return null;
    const t=sim.traces.t,c1=channelProcessed(sim.traces.ch1,scope.ch1,sim.dt),c2=channelProcessed(sim.traces.ch2,scope.ch2,sim.dt);
    let trigArr=scope.trigger.source==='CH2'?c2:c1;
    if(scope.trigger.coupling==='AC'){const mean=trigArr.reduce((a,b)=>a+b,0)/trigArr.length;trigArr=trigArr.map(v=>v-mean);}
    let trig=scope.trigger.source==='EXT'||!scope[scope.trigger.source.toLowerCase()]?.enabled?-1:findTriggerIndex(trigArr,scope.trigger.level,scope.trigger.slope,t,sim.dt);
    if(scope.forcedTrigger){trig=Math.floor(t.length/2);scope.forcedTrigger=false;}
    const held=!scope.running&&sim===scope.frozenRecord;
    const triggered=held?!!sim.triggered:trig>=0;if(trig<0)trig=Math.floor(t.length/2);
    const triggerTime=held&&Number.isFinite(sim.triggerTime)?sim.triggerTime:t[trig]||0,relative=t.map(v=>v-triggerTime),left=scope.horizontal.position-horizontalDiv()*5,right=left+horizontalDiv()*10;
    const idx=relative.map((v,i)=>v>=left&&v<=right?i:-1).filter(i=>i>=0);
    return {t:idx.map(i=>relative[i]),c1:idx.map(i=>c1[i]),c2:idx.map(i=>c2[i]),record:{t:relative,c1,c2},triggerTime,triggered,visible:held||triggered||(!scope.singleArmed&&scope.trigger.mode==='Auto'),dt:sim.dt};
  }
  function normalizeMeasurements(){scope.measure={...defaultScope().measure,...scope.measure};scope.measure.items=scope.measure.items.slice(0,8).map(item=>typeof item==='string'?{name:item==='Vpp'?'Pk-Pk':item,source:scope.measure.source}:item);}
  function measurementResult(item,frame) {
    const missing=source=>(scope.running&&currentRecord()?.channelStatus?.[source.toLowerCase()])|| (source==='Math'?(!scope.math.enabled?'Math is off':(scope.running&&(currentRecord()?.channelStatus?.ch1||currentRecord()?.channelStatus?.ch2))||null):!scope[source.toLowerCase()]?.enabled?`${source} is off`:!state.probes[source.toLowerCase()]?.tip&&scope.running?'Probe tip disconnected':!state.probes[source.toLowerCase()]?.gnd&&scope.running?'Probe ground disconnected':null);
    let reason=missing(item.source);if(measureGroups.Delay.includes(item.name))reason ||=missing(item.source2||'CH2');
    if(!frame?.visible)return {value:NaN,reason:scope.singleArmed?'Waiting for single trigger':'Waiting for trigger or acquisition'};
    if(reason)return {value:NaN,reason};
    const record=scope.measure.gate==='Screen'?frame:frame.record;
    const indexes=record.t.map((v,i)=>scope.measure.gate!=='Between Cursors'||v>=Math.min(scope.cursor.x1,scope.cursor.x2)&&v<=Math.max(scope.cursor.x1,scope.cursor.x2)?i:-1).filter(i=>i>=0);
    const values=source=>indexes.map(i=>source==='CH2'?record.c2[i]:source==='Math'?mathValue(record.c1[i],record.c2[i]):record.c1[i]);
    const t=indexes.map(i=>record.t[i]);
    if(t.length<3)return {value:NaN,reason:'Not enough samples in selected gate'};
    if((currentRecord()?.frequency||0)*frame.dt>.2)return {value:NaN,reason:'Undersampled: use a faster time/div'};
    const value=measurement(values(item.source),t,item.name,values(item.source2||'CH2'));
    return {value,reason:Number.isFinite(value)?'':'No complete transition / cycle, or a flat signal'};
  }
  function mathValue(a,b){return scope.math.op==='CH1+CH2'?a+b:scope.math.op==='CH1×CH2'?a*b:a-b;}
  const measurementStats=new Map();let acquisitionVersion=0;
  function resetStatistics(){measurementStats.clear();drawScope();}
  function addMeasurement(name){normalizeMeasurements();const item={name,source:scope.measure.source,source2:scope.measure.source2};if(scope.measure.items.length>=8)return toast('Eight measurement slots are full. Remove an item first.');if(scope.measure.items.some(x=>x.name===name&&x.source===item.source&&(!measureGroups.Delay.includes(name)||x.source2===item.source2)))return toast('That measurement is already displayed.');scope.measure.items.push(item);scopeAction(false);}

  // -----------------------------
  // Oscilloscope screen rendering
  // -----------------------------
  const scopeCanvas=document.getElementById('scopeCanvas'), sctx=scopeCanvas.getContext('2d');

  function drawScope() {
    const w=scopeCanvas.width,h=scopeCanvas.height; sctx.clearRect(0,0,w,h);sctx.fillStyle='#05090b';sctx.fillRect(0,0,w,h);
    if(!scope.powered){drawMenuOverlay();syncScopeControls();renderMeasurementTable(null);sctx.fillStyle='#182025';sctx.font='24px monospace';sctx.textAlign='center';sctx.fillText('POWER OFF',w/2,h/2);return;}
    drawGrid();
    normalizeMeasurements();
    const sim=currentRecord();
    let frame=makeDisplayFrame(sim);
    if(scope.running&&frame?.visible){scope.frozenFrame=frame;scope.frozenRecord={channelStatus:sim.channelStatus,traces:sim.traces,dt:sim.dt,window:sim.window,frequency:sim.frequency,triggerTime:frame.triggerTime,triggered:frame.triggered};if(scope.singleArmed&&frame.triggered){scope.running=false;scope.singleArmed=false;}}
    syncScopeControls();
    if(frame){
      if(frame.visible){if(scope.acquire.xy){if(!sim.channelStatus?.ch1&&!sim.channelStatus?.ch2)drawXY(frame);}else{if(scope.ch1.enabled&&!sim.channelStatus?.ch1)drawTrace(frame.t,frame.c1,scope.ch1,'#f1d63a');if(scope.ch2.enabled&&!sim.channelStatus?.ch2)drawTrace(frame.t,frame.c2,scope.ch2,'#63b9ff');}if(scope.math.enabled&&!sim.channelStatus?.ch1&&!sim.channelStatus?.ch2)drawMath(frame);if(scope.ref.enabled&&scope.ref.data)drawRef();}
      drawStatus(frame);
      drawMeasurements(frame);
      drawCursors(frame);
    } else {drawStatus(null);renderMeasurementTable(null);}
    drawMenuOverlay();
  }

  function drawGrid(){
    const w=scopeCanvas.width,h=scopeCanvas.height, top=38,bottom=46,left=52,right=18; const gw=w-left-right,gh=h-top-bottom;
    if(scope.display.grid==='Off')return;
    sctx.strokeStyle='#27343a';sctx.lineWidth=1;
    if(scope.display.grid!=='Cross')for(let i=0;i<=10;i++){const x=left+gw*i/10;sctx.beginPath();sctx.moveTo(x,top);sctx.lineTo(x,top+gh);sctx.stroke();}
    if(scope.display.grid!=='Cross')for(let i=0;i<=8;i++){const y=top+gh*i/8;sctx.beginPath();sctx.moveTo(left,y);sctx.lineTo(left+gw,y);sctx.stroke();}
    if(scope.display.grid==='Grid')return;
    sctx.strokeStyle='#52646d';
    sctx.beginPath();sctx.moveTo(left+gw/2,top);sctx.lineTo(left+gw/2,top+gh);sctx.stroke();
    sctx.beginPath();sctx.moveTo(left,top+gh/2);sctx.lineTo(left+gw,top+gh/2);sctx.stroke();
  }

  function drawTrace(t,arr,ch,color){
    if(!arr.length)return; const w=scopeCanvas.width,h=scopeCanvas.height,top=38,bottom=46,left=52,right=18,gw=w-left-right,gh=h-top-bottom;
    sctx.save();sctx.beginPath();sctx.rect(left,top,gw,gh);sctx.clip();
    sctx.strokeStyle=color;sctx.lineWidth=2;sctx.globalAlpha=scope.display.intensity/100;
    if(scope.acquire.mode==='Peak Detect'){
      const bins=new Map();arr.forEach((v,i)=>{const pixel=Math.floor(gw*(t[i]/(horizontalDiv()*10)+.5-scope.horizontal.position/(horizontalDiv()*10)));if(pixel<0||pixel>gw)return;const pair=bins.get(pixel)||[v,v];pair[0]=Math.min(pair[0],v);pair[1]=Math.max(pair[1],v);bins.set(pixel,pair);});sctx.beginPath();for(const [pixel,pair] of bins){const y1=top+gh/2-(pair[0]/ch.voltsDiv-ch.position)*gh/8,y2=top+gh/2-(pair[1]/ch.voltsDiv-ch.position)*gh/8;sctx.moveTo(left+pixel,y1);sctx.lineTo(left+pixel,Math.abs(y2-y1)<.5?y1+.5:y2);}sctx.stroke();sctx.restore();return;
    }
    sctx.beginPath(); let started=false;
    for(let i=0;i<arr.length;i++){
      const x=left+gw*(t[i]/(horizontalDiv()*10)+.5-scope.horizontal.position/(horizontalDiv()*10));
      const y=top+gh/2-(arr[i]/ch.voltsDiv-ch.position)*gh/8;
      if(x<left||x>left+gw)continue;
      if(!started){sctx.moveTo(x,y);started=true;}else if(scope.display.vectors)sctx.lineTo(x,y);else{sctx.moveTo(x,y);sctx.lineTo(x+.5,y+.5);}
    }
    sctx.stroke();sctx.restore();
  }

  function drawXY(frame){if(!scope.ch1.enabled||!scope.ch2.enabled)return;sctx.save();sctx.beginPath();sctx.rect(52,38,730,396);sctx.clip();sctx.strokeStyle='#63b9ff';sctx.beginPath();frame.c1.forEach((v,i)=>{const x=417+(v/scope.ch1.voltsDiv-scope.ch1.position)*73,y=236-(frame.c2[i]/scope.ch2.voltsDiv-scope.ch2.position)*49.5;if(i)sctx.lineTo(x,y);else sctx.moveTo(x,y);});sctx.stroke();sctx.restore();}
  function drawMath(frame){
    const arr=frame.c1.map((v,i)=>mathValue(v,frame.c2[i]||0));
    drawTrace(frame.t,arr,{voltsDiv:scope.ch1.voltsDiv,position:0},'#d987ff');
  }
  function drawRef(){
    const d=scope.ref.data;if(!d)return; drawTrace(d.t,d.y,{voltsDiv:d.voltsDiv||scope.ch1.voltsDiv,position:d.position||0},'#9fd18c');
  }

  function drawStatus(frame){
    const w=scopeCanvas.width;
    sctx.font='14px monospace';sctx.textBaseline='middle';
    sctx.fillStyle='#dce7eb';sctx.textAlign='left';sctx.fillText('GDS-1202B',12,17);
    sctx.fillStyle='#dce7eb';sctx.fillText(`${currentRecord()?.traces.t.length||0} sim pts`,200,17);sctx.fillText(`${fmt(1/(currentRecord()?.dt||NaN),'Sa/s')}`,350,17);
    sctx.textAlign='right';sctx.fillStyle=frame?.triggered?'#75df8b':'#e2c763';sctx.fillText(!scope.running?'Stop':scope.singleArmed?'Armed':frame?.triggered?'Trig’d':scope.trigger.mode==='Normal'?'Wait':'Auto',w-12,17);
    sctx.textAlign='left';sctx.fillStyle='#f1d63a';sctx.fillText(`1 ${fmt(scope.ch1.voltsDiv,'V')}/div ${scope.ch1.coupling}`,10,458);
    sctx.fillStyle='#63b9ff';sctx.fillText(`2 ${fmt(scope.ch2.voltsDiv,'V')}/div ${scope.ch2.coupling}`,240,458);
    sctx.fillStyle='#dce7eb';sctx.fillText(`M ${fmt(horizontalDiv(),'s')}/div`,470,458);
    sctx.textAlign='right';sctx.fillText(`Trig ${scope.trigger.source} ${fmt(scope.trigger.level,'V')} ${scope.trigger.slope}`,w-10,458);
  }

  function syncScopeControls(){
    normalizeMeasurements();
    for(const [id,value] of Object.entries({measureSource:scope.measure.source,measureSource2:scope.measure.source2,measureGate:scope.measure.gate,highLowSelect:scope.measure.highLow,statisticsSamples:scope.measure.samples,lowRefInput:scope.measure.lowRef,midRefInput:scope.measure.midRef,highRefInput:scope.measure.highRef,cursorMode:scope.cursor.mode,cursorSource:scope.cursor.source,cursorX1:scope.cursor.x1,cursorX2:scope.cursor.x2,cursorY1:scope.cursor.y1,cursorY2:scope.cursor.y2})){const el=document.getElementById(id);if(document.activeElement!==el)el.value=value;}
    document.getElementById('measureStatistics').checked=scope.measure.statistics;
    document.getElementById('measurementCount').textContent=`${scope.measure.items.length} / 8 slots`;
    document.getElementById('addMeasureBtn').disabled=scope.measure.items.length>=8;
    const ch2=scope.cursor.source==='CH2';document.getElementById('cursorControls').style.setProperty('--cursor-color',ch2?'#63b9ff':'#f1d63a');
    document.getElementById('cursorSourceLabel').textContent=`${scope.cursor.source} cursors · ${ch2?'blue':'yellow'}`;
    document.getElementById('cursorReadout').textContent=scope.cursor.mode==='Off'?'Cursors off':scope.cursor.mode==='Time'?`Δt ${fmt(Math.abs(scope.cursor.x2-scope.cursor.x1),'s')} · 1/Δt ${fmt(1/Math.abs(scope.cursor.x2-scope.cursor.x1),'Hz')}`:`ΔV ${fmt(Math.abs(scope.cursor.y2-scope.cursor.y1),'V')}`;
    document.querySelector('[data-action="runStop"]').classList.toggle('running',scope.running);document.querySelector('[data-action="runStop"]').classList.toggle('stopped',!scope.running);document.querySelector('[data-action="single"]').classList.toggle('active',scope.singleArmed);
    for(const ch of ['ch1','ch2'])document.querySelector(`[data-action="${ch}"]`).classList.toggle('active',scope[ch].enabled);
    document.getElementById('scopePowerBtn').classList.toggle('on',scope.powered);
  }
  function renderMeasurementTable(frame){
    const body=document.getElementById('measurementRows');body.replaceChildren();
    const items=scope.measure.all?measureNames.map(name=>({name,source:scope.measure.source,source2:scope.measure.source2})):scope.measure.items;
    if(!items.length){const row=body.insertRow(),cell=row.insertCell();cell.colSpan=5;cell.textContent='No measurements selected. Choose a source and measurement, then Add.';return;}
    items.forEach((item,index)=>{
      const result=scope.powered?measurementResult(item,frame):{value:NaN,reason:'Scope power is off'},row=body.insertRow(),unit=measureUnit(item.name);
      row.insertCell().textContent=item.source+(measureGroups.Delay.includes(item.name)?' → '+(item.source2||'CH2'):'');row.cells[0].style.color=item.source==='CH1'?'#f1d63a':item.source==='CH2'?'#63b9ff':'#d987ff';row.insertCell().textContent=item.name;row.insertCell().textContent=fmt(result.value,unit);
      let details=result.reason;
      if(scope.measure.statistics&&Number.isFinite(result.value)){
        const key=JSON.stringify(item)+scope.measure.gate+scope.measure.highLow;let st=measurementStats.get(key)||{values:[],version:-1};if(st.version!==acquisitionVersion&&scope.running){st.values.push(result.value);st.values=st.values.slice(-scope.measure.samples);st.version=acquisitionVersion;measurementStats.set(key,st);}
        const values=st.values;if(values.length){const mean=values.reduce((a,b)=>a+b,0)/values.length,sd=Math.sqrt(values.reduce((a,b)=>a+(b-mean)**2,0)/values.length);details=`n=${values.length} · mean ${fmt(mean,unit)} · min ${fmt(Math.min(...values),unit)} · max ${fmt(Math.max(...values),unit)} · σ ${fmt(sd,unit)}`;}else details='Statistics collect while acquisition is running.';
      }
      row.insertCell().textContent=details;
      const cell=row.insertCell();if(!scope.measure.all){const button=document.createElement('button');button.textContent='Remove';button.setAttribute('aria-label',`Remove ${item.source} ${item.name}`);button.onclick=()=>{scope.measure.items.splice(index,1);drawScope();};cell.append(button);}
    });
  }
  for(const [group,names] of Object.entries(measureGroups)){const optgroup=document.createElement('optgroup');optgroup.label=group;names.forEach(name=>optgroup.append(new Option(name,name)));document.getElementById('measureType').append(optgroup);}
  document.getElementById('measureType').value='Frequency';
  document.getElementById('addMeasureBtn').onclick=()=>addMeasurement(document.getElementById('measureType').value);
  document.getElementById('clearMeasuresBtn').onclick=()=>{scope.measure.items=[];scope.measure.all=false;drawScope();};
  for(const [id,key] of Object.entries({measureSource:'source',measureSource2:'source2',measureGate:'gate',highLowSelect:'highLow'}))document.getElementById(id).onchange=e=>{scope.measure[key]=e.target.value;measurementStats.clear();drawScope();};
  document.getElementById('measureStatistics').onchange=e=>{scope.measure.statistics=e.target.checked;drawScope();};document.getElementById('resetStatisticsBtn').onclick=resetStatistics;
  document.getElementById('statisticsSamples').onchange=e=>{scope.measure.samples=clamp(Math.round(Number(e.target.value)||100),2,1000);resetStatistics();};
  for(const [id,key] of Object.entries({lowRefInput:'lowRef',midRefInput:'midRef',highRefInput:'highRef'}))document.getElementById(id).onchange=e=>{const next={...scope.measure,[key]:Number(e.target.value)};if(!e.target.value||!Number.isFinite(next[key])||next.lowRef<0||next.highRef>100||next.lowRef>=next.midRef||next.midRef>=next.highRef){toast('Reference levels must satisfy 0 ≤ low < mid < high ≤ 100.');e.target.value=scope.measure[key];return;}scope.measure[key]=next[key];resetStatistics();};
  document.getElementById('cursorMode').onchange=e=>{scope.cursor.mode=e.target.value;drawScope();};document.getElementById('cursorSource').onchange=e=>{scope.cursor.source=e.target.value;drawScope();};
  for(const end of ['X1','X2','Y1','Y2'])document.getElementById('cursor'+end).onchange=e=>{const value=Number(e.target.value);if(!e.target.value||!Number.isFinite(value))return toast('Enter a finite cursor position.');scope.cursor[end.toLowerCase()]=value;drawScope();};

  function drawMeasurements(frame){
    renderMeasurementTable(frame);
    sctx.font='12px monospace';sctx.textAlign='left';sctx.textBaseline='middle';
    scope.measure.items.forEach((item,i)=>{const result=measurementResult(item,frame),x=60+(i%2)*350,y=260+Math.floor(i/2)*25;sctx.fillStyle='rgba(11,22,28,.88)';sctx.fillRect(x,y,340,23);sctx.fillStyle=item.source==='CH1'?'#f1d63a':item.source==='CH2'?'#63b9ff':'#d987ff';sctx.fillText(`${item.source} ${item.name}: ${fmt(result.value,measureUnit(item.name))}`,x+6,y+12);});
  }
  function drawCursors(frame){
    if(!frame||scope.cursor.mode==='Off')return;
    const w=scopeCanvas.width,h=scopeCanvas.height,top=38,bottom=46,left=52,right=18,gw=w-left-right,gh=h-top-bottom;
    const cursorColor=scope.cursor.source==='CH2'?'#63b9ff':'#f1d63a';
    sctx.strokeStyle=cursorColor;sctx.lineWidth=1.5;sctx.textAlign='left';
    if(scope.cursor.mode==='Time'){
      for(const xval of [scope.cursor.x1,scope.cursor.x2]){const x=left+gw*((xval-scope.horizontal.position)/(horizontalDiv()*10)+.5);sctx.beginPath();sctx.moveTo(x,top);sctx.lineTo(x,top+gh);sctx.stroke();}
      sctx.fillStyle=cursorColor;sctx.font='12px monospace';sctx.fillText(`${scope.cursor.source} Δt ${fmt(Math.abs(scope.cursor.x2-scope.cursor.x1),'s')}  1/Δt ${fmt(1/Math.abs(scope.cursor.x2-scope.cursor.x1),'Hz')}`,260,44);
    }else{
      const ch=scope.cursor.source==='CH2'?scope.ch2:scope.ch1;
      for(const yval of [scope.cursor.y1,scope.cursor.y2]){const y=top+gh/2-(yval/ch.voltsDiv-ch.position)*gh/8;sctx.beginPath();sctx.moveTo(left,y);sctx.lineTo(left+gw,y);sctx.stroke();}
      sctx.fillStyle=cursorColor;sctx.font='12px monospace';sctx.fillText(`${scope.cursor.source} ΔV ${fmt(Math.abs(scope.cursor.y2-scope.cursor.y1),'V')}`,260,44);
    }
  }

  function sideOptions(){const sm=scope.sideMenu;if(!sm)return [];return sm.options.length>5?[...sm.options.slice(sm.page*4,sm.page*4+4),'Next page →']:sm.options;}
  function drawMenuOverlay(){
    const active=scope.powered&&!scope.menuHidden&&scope.currentMenu;
    document.querySelectorAll('[data-soft-bottom]').forEach((b,i)=>{const item=active?getMenuItems(scope.currentMenu)[i]:null;b.disabled=!item;b.textContent=item?item.label():'';b.setAttribute('aria-label',item?item.label().replace('\n',' '):'Inactive soft key');});
    document.querySelectorAll('[data-soft-side]').forEach((b,i)=>{const opt=active?sideOptions()[i]:null;b.disabled=opt==null;b.textContent=opt??'';b.setAttribute('aria-label',opt==null?'Inactive soft key':String(opt));});
    if(!active)return;
    const items=getMenuItems(scope.currentMenu),w=scopeCanvas.width,h=scopeCanvas.height;
    const boxW=(w-60)/7;
    sctx.font='11px monospace';sctx.textAlign='center';sctx.textBaseline='middle';
    items.forEach((it,i)=>{const x=8+i*boxW,y=h-81;sctx.fillStyle='rgba(13,34,45,.92)';sctx.fillRect(x,y,boxW-4,31);sctx.fillStyle='#dcebf1';const lines=it.label().split('\n');lines.forEach((line,j)=>sctx.fillText(line,x+(boxW-4)/2,y+10+j*12));});
    if(scope.sideMenu){const sm=scope.sideMenu;const bw=146,bh=56,x=w-bw-7;sideOptions().forEach((opt,i)=>{const y=45+i*(bh+4);sctx.fillStyle='rgba(17,43,56,.94)';sctx.fillRect(x,y,bw,bh);sctx.fillStyle='#eef7fa';sctx.textAlign='left';sctx.fillText(String(opt),x+10,y+bh/2);});}
  }

  // -----------------------------
  // Scope menus and controls
  // -----------------------------
  function openSideMenu(title,options,onSelect){scope.sideMenu={title,options,onSelect,page:0};scope.menuHidden=false;drawScope();}
  function cycleVal(obj,key,values){const i=values.indexOf(obj[key]);obj[key]=values[(i+1)%values.length];scopeAction();}
  function menuItem(label,action){return {label:typeof label==='function'?label:()=>label,action};}

  function getMenuItems(menu){
    const ch=menu==='ch2'?scope.ch2:scope.ch1;
    const commonChannel=[
      menuItem(()=>`Coupling\n${ch.coupling}`,()=>openSideMenu('Coupling',['DC','AC','GND'],v=>{ch.coupling=v;scopeAction();})),
      menuItem(()=>`BW Limit\n${ch.bwLimit}`,()=>openSideMenu('BW',['Full','20MHz'],v=>{ch.bwLimit=v;scopeAction();})),
      menuItem(()=>`Invert\n${ch.invert?'On':'Off'}`,()=>{ch.invert=!ch.invert;scopeAction();}),
      menuItem(()=>`Probe\n${ch.probe}X`,()=>openSideMenu('Probe',[1,10,100,1000].map(v=>`${v}X`),v=>{const factor=parseInt(v)/ch.probe;ch.voltsDiv*=factor;ch.probe=parseInt(v);scopeAction();})),
      menuItem(()=>`Channel\n${ch.enabled?'On':'Off'}`,()=>{ch.enabled=!ch.enabled;scopeAction();}),
      menuItem('Position\nknob',()=>toast('Use the channel POSITION knob.')),
      menuItem('Deskew\nUnavailable',()=>toast('Deskew is represented, but probe propagation delay is not modeled in this build.'))
    ];
    if(menu==='ch1'||menu==='ch2')return commonChannel;
    if(menu==='autoset')return [menuItem('Undo\nAutoset',()=>{if(beforeAutoset){scope=beforeAutoset;beforeAutoset=null;scopeAction(true);}}),...Array(6).fill(0).map(()=>menuItem('—',()=>{}))];
    if(menu==='acquire')return [
      menuItem(()=>`Mode\n${scope.acquire.mode}`,()=>openSideMenu('Acquire mode',['Sample','Peak Detect','Average'],v=>{scope.acquire.mode=v;scopeAction();})),
      menuItem(()=>`Average\n${scope.acquire.average}`,()=>openSideMenu('Average',[2,4,8,16,32,64,128,256],v=>{scope.acquire.average=Number(v);scopeAction();})),
      menuItem('Record\nSolver limited',()=>toast('The simulator retains up to 5,501 samples. Hardware memory-depth selection is not emulated.')),
      menuItem('Sample rate\nAuto',()=>toast('The training solver adapts its sample interval to the selected time base.')),
      menuItem(()=>`XY\n${scope.acquire.xy?'On':'Off'}`,()=>{scope.acquire.xy=!scope.acquire.xy;drawScope();}),
      menuItem('Roll\nUnavailable',()=>toast('Roll behavior is simplified in this training build.')),
      menuItem('Reset\nAcquire',()=>{scope.acquire={mode:'Sample',average:16,memory:'10k'};scopeAction();})
    ];
    if(menu==='display')return [
      menuItem(()=>`Waveform\n${scope.display.vectors?'Vector':'Dots'}`,()=>{scope.display.vectors=!scope.display.vectors;scopeAction(false);}),
      menuItem('Persistence\nUnavailable',()=>toast('Timed persistence is not emulated. Use REF to compare stored waveforms.')),
      menuItem(()=>`Intensity\n${scope.display.intensity}%`,()=>openSideMenu('Intensity',[20,40,60,80,90,100],v=>{scope.display.intensity=Number(v);scopeAction(false);})),
      menuItem(()=>`Graticule\n${scope.display.grid}`,()=>openSideMenu('Grid',['Full','Grid','Cross','Off'],v=>{scope.display.grid=v;scopeAction(false);})),
      menuItem('Backlight\nUnavailable',()=>toast('Hardware backlight control is not emulated.')),
      menuItem('Freeze\nDisplay',()=>{scope.running=false;scopeAction(false);}),
      menuItem('Menu\nOff',()=>{scope.menuHidden=true;drawScope();})
    ];
    if(menu==='measure')return [
      menuItem('Add\nMeasurement',()=>openSideMenu('Add measurement',['V/I','Time','Delay','Source 1','Source 2'],v=>{if(measureGroups[v])openSideMenu(v,measureGroups[v],addMeasurement);else openSideMenu(v,['CH1','CH2','Math'],source=>{scope.measure[v==='Source 1'?'source':'source2']=source;drawScope();});})),
      menuItem('Remove\nMeasurement',()=>openSideMenu('Remove',['Remove all',...scope.measure.items.map((x,i)=>`${i+1}. ${x.source} ${x.name}`)],v=>{if(v==='Remove all')scope.measure.items=[];else scope.measure.items.splice(parseInt(v)-1,1);scope.measure.all=false;drawScope();})),
      menuItem(()=>`Gating\n${scope.measure.gate}`,()=>openSideMenu('Gating',['Off','Screen','Between Cursors'],v=>{scope.measure.gate=v;if(v==='Between Cursors')scope.cursor.mode='Time';resetStatistics();})),
      menuItem(()=>`Display All\n${scope.measure.all?'On':'Off'}`,()=>{scope.measure.all=!scope.measure.all;drawScope();document.getElementById('measurementPanel').scrollIntoView({block:'start'});}),
      menuItem(()=>`High-Low\n${scope.measure.highLow}`,()=>openSideMenu('High-Low',['Auto','Min-Max','Histogram'],v=>{scope.measure.highLow=v;resetStatistics();})),
      menuItem(()=>`Statistics\n${scope.measure.statistics?'On':'Off'}`,()=>openSideMenu('Statistics',['On','Off','Reset'],v=>{if(v==='Reset')resetStatistics();else scope.measure.statistics=v==='On';drawScope();})),
      menuItem('Reference\nLevels',()=>{document.getElementById('lowRefInput').focus();toast('Set low, mid and high reference percentages in Automatic measurements.');})
    ];
    if(menu==='cursor')return [
      menuItem(()=>`Mode\n${scope.cursor.mode}`,()=>openSideMenu('Cursor mode',['Off','Time','Voltage'],v=>{scope.cursor.mode=v;scopeAction(false);})),
      menuItem(()=>`Source\n${scope.cursor.source}`,()=>{scope.cursor.source=scope.cursor.source==='CH1'?'CH2':'CH1';scopeAction(false);}),
      menuItem(()=>`X1\n${fmt(scope.cursor.x1,'s')}`,()=>{scope._variableTarget='cursorX1';toast('VARIABLE knob now adjusts X1.');}),
      menuItem(()=>`X2\n${fmt(scope.cursor.x2,'s')}`,()=>{scope._variableTarget='cursorX2';toast('VARIABLE knob now adjusts X2.');}),
      menuItem(()=>`Y1\n${fmt(scope.cursor.y1,'V')}`,()=>{scope._variableTarget='cursorY1';toast('VARIABLE knob now adjusts Y1.');}),
      menuItem(()=>`Y2\n${fmt(scope.cursor.y2,'V')}`,()=>{scope._variableTarget='cursorY2';toast('VARIABLE knob now adjusts Y2.');}),
      menuItem('Clear\nCursor',()=>{scope.cursor.mode='Off';scopeAction(false);})
    ];
    if(menu==='trigger')return [
      menuItem(()=>`Type\n${scope.trigger.type}`,()=>openSideMenu('Type',['Edge'],v=>{scope.trigger.type=v;scopeAction(false);})),
      menuItem(()=>`Source\n${scope.trigger.source}`,()=>openSideMenu('Source',['CH1','CH2','EXT'],v=>{scope.trigger.source=v;scopeAction(false);})),
      menuItem(()=>`Slope\n${scope.trigger.slope}`,()=>openSideMenu('Slope',['Rising','Falling','Either'],v=>{scope.trigger.slope=v;scopeAction(false);})),
      menuItem(()=>`Mode\n${scope.trigger.mode}`,()=>openSideMenu('Mode',['Auto','Normal'],v=>{scope.trigger.mode=v;scopeAction(false);})),
      menuItem(()=>`Coupling\n${scope.trigger.coupling}`,()=>openSideMenu('Trigger coupling',['DC','AC'],v=>{scope.trigger.coupling=v;scopeAction(false);})),
      menuItem(()=>`Level\n${fmt(scope.trigger.level,'V')}`,()=>toast('Use the TRIGGER LEVEL knob.')),
      menuItem(()=>`Holdoff\n${fmt(scope.trigger.holdoff,'s')}`,()=>{scope._variableTarget='holdoff';toast('VARIABLE knob now adjusts trigger holdoff.');})
    ];
    if(menu==='math')return [
      menuItem(()=>`Math\n${scope.math.enabled?'On':'Off'}`,()=>{scope.math.enabled=!scope.math.enabled;scopeAction(false);}),
      menuItem(()=>`Operation\n${scope.math.op}`,()=>openSideMenu('Math',['CH1-CH2','CH1+CH2','CH1×CH2'],v=>{scope.math.op=v;scope.math.enabled=true;scopeAction(false);})),
      menuItem('Source 1\nCH1',()=>{}),menuItem('Source 2\nCH2',()=>{}),
      menuItem('FFT\nUnavailable',()=>toast('FFT menu is represented; frequency-domain rendering is not included in this op-amp teaching MVP.')),
      menuItem('Position\nCH1 scale',()=>toast('Math uses the CH1 scale, centered at zero.')),menuItem('Scale\nCH1',()=>toast('Adjust the CH1 SCALE knob to scale Math.'))
    ];
    if(menu==='ref')return [
      menuItem('Save Ref\nCH1',()=>saveReference('CH1')),menuItem('Save Ref\nCH2',()=>saveReference('CH2')),
      menuItem(()=>`Reference\n${scope.ref.enabled?'On':'Off'}`,()=>{scope.ref.enabled=!scope.ref.enabled;scopeAction(false);}),
      menuItem('Clear Ref',()=>{scope.ref={enabled:false,data:null};scopeAction(false);}),menuItem('Position\nZero',()=>toast('Reference position is fixed at zero in this simulator.')),menuItem('Scale\nSaved',()=>toast('Reference uses its saved channel scale.')),menuItem('Help\nRef',()=>toast('Reference stores a snapshot of the displayed trace.'))
    ];
    if(menu==='saveRecall')return [
      menuItem('Save\nPanel',savePanel),menuItem('Recall\nPanel',recallPanel),menuItem('Save\nLab',saveLab),menuItem('Recall\nLab',recallLab),
      menuItem('Save Image\nPNG',saveHardcopy),menuItem('File Utility\nLocal',()=>toast('Browser localStorage stands in for the scope USB filesystem.')),
      menuItem('Factory\nDefault',()=>{scope=defaultScope();scopeAction(true);})
    ];
    if(menu==='utility')return [
      menuItem('Hardcopy\nPNG',saveHardcopy),menuItem('Probe Comp\n1 kHz',()=>toast('Real GDS-1202B probe compensation is 2 Vpp and adjustable in frequency; this app focuses on DUT signals.')),
      menuItem('Language\nEnglish',()=>toast('Only English is included. Translation has been spared this particular burden.')),
      menuItem('System\nInfo',()=>toast('Training model: GDS-1202B UI / 200 MHz / 2 channel. Electrical solver is educational, not firmware.')),
      menuItem('Calibration\nN/A',()=>toast('Hardware calibration cannot be meaningfully emulated in a browser.')),
      menuItem('Sound\nOn',()=>toast('No beeper. Your classroom has suffered enough noise.')),
      menuItem('Help\nUtility',()=>toast('Save/recall uses browser local storage.'))
    ];
    if(menu==='app')return [menuItem('Go/NoGo\nApp',()=>toast('Go/NoGo menu is represented, but the physical rear-panel output is not emulated.')),menuItem('Options\nNone',()=>{}),...Array(5).fill(0).map(()=>menuItem('—',()=>{}))];
    if(menu==='bus')return [menuItem('Bus\nOff',()=>toast('Serial-bus decode is outside this analog op-amp lab build.')),menuItem('UART',()=>toast('UI scaffold only.')),menuItem('I²C',()=>toast('UI scaffold only.')),menuItem('SPI',()=>toast('UI scaffold only.')),menuItem('CAN',()=>toast('UI scaffold only.')),menuItem('LIN',()=>toast('UI scaffold only.')),menuItem('Help',()=>toast('GDS-1000B supports serial bus decode; this lab does not synthesize digital buses.'))];
    if(menu==='help')return [menuItem('Controls',()=>toast('Swipe knobs vertically. Use the soft keys aligned with the menu labels on screen.')),menuItem('Breadboard',()=>toast('Each A–E column is connected internally; each F–J column is connected internally. Power rails run horizontally.')),menuItem('Trigger',()=>toast('A stable trace needs a valid source, level, slope, and time scale.')),menuItem('Probes',()=>toast('Probe tip measures relative to its ground clip. Bench-scope grounds are common.')),menuItem(isRc?'RC Filters':'Op-Amp',()=>toast(isRc?'Measure gain = CH2 Vpp / CH1 Vpp. Set phase Source 1 to CH2 and Source 2 to CH1 for output relative to input.':'UA741 pins: 2 −IN, 3 +IN, 4 V−, 6 OUT, 7 V+. Pins 1, 5, 8 are unused in this model.')),menuItem('Limits',()=>toast('Not SPICE. Intended for first-pass teaching and scope-operation practice.')),menuItem('Close',()=>{scope.currentMenu=null;scope.sideMenu=null;drawScope();})];
    return Array(7).fill(0).map(()=>menuItem('—',()=>{}));
  }

  function setMenu(menu){scope.currentMenu=menu;scope.sideMenu=null;scope.menuHidden=false;drawScope();}
  document.getElementById('bottomSoftkeys').addEventListener('click',e=>{const b=e.target.closest('button[data-soft-bottom]');if(!b||!scope.currentMenu)return;const it=getMenuItems(scope.currentMenu)[Number(b.dataset.softBottom)];if(it){it.action();drawScope();}});
  document.getElementById('sideSoftkeys').addEventListener('click',e=>{const b=e.target.closest('button[data-soft-side]');if(!b||!scope.sideMenu)return;const idx=Number(b.dataset.softSide),opt=sideOptions()[idx];if(opt==null)return;if(opt==='Next page →'){scope.sideMenu.page=(scope.sideMenu.page+1)%Math.ceil(scope.sideMenu.options.length/4);drawScope();return;}const cb=scope.sideMenu.onSelect;scope.sideMenu=null;cb(opt);drawScope();});

  document.querySelector('.scope-right').addEventListener('click',e=>{
    const b=e.target.closest('button[data-action]');if(!b)return;handleScopeAction(b.dataset.action);
  });
  function handleScopeAction(a){
    const map={measure:'measure',cursor:'cursor',app:'app',acquire:'acquire',display:'display',help:'help',saveRecall:'saveRecall',utility:'utility',triggerMenu:'trigger',ch1:'ch1',ch2:'ch2',math:'math',ref:'ref',bus:'bus'};
    if(!scope.powered)return;
    if(a==='ch1'||a==='ch2'){if(!scope[a].enabled)scope[a].enabled=true;else if(scope.currentMenu===a&&!scope.menuHidden)scope[a].enabled=false;setMenu(a);return;}
    if(map[a]){setMenu(map[a]);return;}
    if(a==='autoset'){autoset();return;} if(a==='runStop'){scope.running=!scope.running;if(scope.running){scope.singleArmed=false;simulateAndRender();}else{scope.singleArmed=false;drawScope();}return;}
    if(a==='single'){scope.running=true;scope.singleArmed=true;simulateAndRender();return;}
    if(a==='default'){scope=defaultScope();scopeAction(true);return;} if(a==='trigger50'){autoTrigger50();return;} if(a==='forceTrig'){if(!scope.running)return toast('Press Run or Single before forcing a trigger.');scope.forcedTrigger=true;drawScope();return;}
    if(a==='zoom'){scope.horizontal.zoom=!scope.horizontal.zoom;scopeAction(false);toast(scope.horizontal.zoom?'5× horizontal zoom enabled':'Horizontal zoom disabled');return;}
    if(a==='search'||a==='setClear')toast('Search/Set-Clear keys are present on the panel but are not needed for the analog lab waveform workflow.');
    if(a==='select'){scope.sideMenu=null;drawScope();}
  }

  function scopeAction(resim=true){scope.actionCount++;state.challenge.actions++;if(resim&&scope.running)simulateAndRender();else drawScope();updateReadouts();}

  function changeKnob(name,dir){
    if(!scope.powered)return;
    if(name==='ch1Scale')scope.ch1.voltsDiv=nextFrom(VOLT_DIVS,scope.ch1.voltsDiv/scope.ch1.probe,dir)*scope.ch1.probe;
    else if(name==='ch2Scale')scope.ch2.voltsDiv=nextFrom(VOLT_DIVS,scope.ch2.voltsDiv/scope.ch2.probe,dir)*scope.ch2.probe;
    else if(name==='timeScale')scope.horizontal.timeDiv=nextFrom(TIME_DIVS,scope.horizontal.timeDiv,dir);
    else if(name==='ch1Position')scope.ch1.position=clamp(scope.ch1.position+dir*.2,-4,4);
    else if(name==='ch2Position')scope.ch2.position=clamp(scope.ch2.position+dir*.2,-4,4);
    else if(name==='horizontalPosition')scope.horizontal.position+=dir*scope.horizontal.timeDiv*.2;
    else if(name==='triggerLevel')scope.trigger.level+=dir*(scope.trigger.source==='CH2'?scope.ch2.voltsDiv:scope.ch1.voltsDiv)*.1;
    else if(name==='variable')adjustVariable(dir);
    scopeAction(['timeScale'].includes(name));
  }
  function pushKnob(name){
    if(name==='ch1Position')scope.ch1.position=0;else if(name==='ch2Position')scope.ch2.position=0;else if(name==='horizontalPosition')scope.horizontal.position=0;else if(name==='triggerLevel')scope.trigger.level=0;else return;
    scopeAction(false);
  }
  function adjustVariable(dir){
    const t=scope._variableTarget;
    if(t==='cursorX1')scope.cursor.x1+=dir*scope.horizontal.timeDiv*.1;else if(t==='cursorX2')scope.cursor.x2+=dir*scope.horizontal.timeDiv*.1;
    else if(t==='cursorY1')scope.cursor.y1+=dir*scope[scope.cursor.source.toLowerCase()].voltsDiv*.1;else if(t==='cursorY2')scope.cursor.y2+=dir*scope[scope.cursor.source.toLowerCase()].voltsDiv*.1;
    else if(t==='holdoff')scope.trigger.holdoff=Math.max(0,scope.trigger.holdoff+dir*scope.horizontal.timeDiv*.1);else toast('Select a variable from a menu first.');
  }

  document.querySelectorAll('.knob').forEach(knob=>{
    let sy=null,acc=0;knob.tabIndex=0;knob.setAttribute('role','button');knob.setAttribute('aria-label',knob.dataset.knob.replace(/([A-Z])/g,' $1')+' knob. Arrow keys adjust; Enter resets position.');knob.addEventListener('keydown',e=>{if(['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();changeKnob(knob.dataset.knob,['ArrowUp','ArrowRight'].includes(e.key)?1:-1);}else if(e.key==='Enter')pushKnob(knob.dataset.knob);});knob.addEventListener('pointercancel',()=>sy=null);
    knob.addEventListener('wheel',e=>{e.preventDefault();changeKnob(knob.dataset.knob,e.deltaY<0?1:-1);},{passive:false});
    knob.addEventListener('pointerdown',e=>{sy=e.clientY;acc=0;knob.setPointerCapture(e.pointerId);});
    knob.addEventListener('pointermove',e=>{if(sy==null)return;const dy=sy-e.clientY;const steps=Math.trunc((dy-acc)/14);if(steps){changeKnob(knob.dataset.knob,steps>0?1:-1);acc+=steps*14;}});
    knob.addEventListener('pointerup',e=>{if(sy!=null&&Math.abs(e.clientY-sy)<4)pushKnob(knob.dataset.knob);sy=null;});
  });

  document.getElementById('menuOffBtn').addEventListener('click',()=>{scope.menuHidden=true;drawScope();});
  document.getElementById('hardcopyBtn').addEventListener('click',saveHardcopy);
  document.getElementById('scopePowerBtn').addEventListener('click',()=>{scope.powered=!scope.powered;document.getElementById('scopePowerBtn').classList.toggle('on',scope.powered);drawScope();});

  let beforeAutoset=null;
  function autoTrigger50(){
    const sim=currentRecord();if(!sim)return;const channel=scope.trigger.source==='CH2'?'ch2':'ch1';const arr=channelProcessed(sim.traces[channel],scope[channel],sim.dt);if(arr.length)scope.trigger.level=(Math.min(...arr)+Math.max(...arr))/2;scopeAction(false);
  }
  function autoset(){
    const sim=currentRecord();if(!sim)return toast('Connect a signal first.');
    const channels=['ch1','ch2'].filter(ch=>scope[ch].enabled&&state.probes[ch].tip);
    if(!channels.length)return toast('Enable a connected channel before Autoset.');
    const reference=channels.find(ch=>{const arr=channelProcessed(sim.traces[ch],scope[ch],sim.dt);return Math.max(...arr)-Math.min(...arr)>=.01&&measurement(arr,sim.traces.t,'Frequency')>=20;});
    if(!reference)return toast('Autoset needs a periodic signal of at least 20 Hz and 10 mV.');
    beforeAutoset=clone({...scope,sideMenu:null});state.challenge.autosetUsed=true;
    for(const name of channels){const ch=scope[name],arr=channelProcessed(sim.traces[name],ch,sim.dt),min=Math.min(...arr),max=Math.max(...arr),target=Math.max((max-min)/6,.001);ch.voltsDiv=(VOLT_DIVS.find(v=>v*ch.probe>=target)||VOLT_DIVS.at(-1))*ch.probe;ch.position=(min+max)/2/ch.voltsDiv;}
    const arr=channelProcessed(sim.traces[reference],scope[reference],sim.dt),f=measurement(arr,sim.traces.t,'Frequency');scope.horizontal.timeDiv=nearestFrom(TIME_DIVS,(1/f)/2.5);scope.horizontal.position=0;scope.horizontal.zoom=false;
    scope.trigger.source=reference.toUpperCase();scope.trigger.slope='Rising';scope.trigger.mode='Auto';scope.trigger.level=(Math.min(...arr)+Math.max(...arr))/2;scope.running=true;scope.singleArmed=false;scope.currentMenu='autoset';scope.sideMenu=null;scope.menuHidden=false;scopeAction(true);toast('Autoset adjusted enabled channels, time base and trigger.');
  }

  function saveReference(ch){
    const frame=makeDisplayFrame(currentRecord());if(!frame)return;scope.ref.data={t:frame.t.slice(),y:(ch==='CH2'?frame.c2:frame.c1).slice(),voltsDiv:scope[ch.toLowerCase()].voltsDiv,position:scope[ch.toLowerCase()].position};scope.ref.enabled=true;scopeAction(false);
  }
  function savedScope(data) { const defaults=defaultScope();const result={...defaults,...data,sideMenu:null,currentMenu:null};for(const key of ['ch1','ch2','horizontal','trigger','acquire','display','measure','cursor','math','ref'])result[key]={...defaults[key],...data?.[key]};return result; }
  function writeSaved(key,data) { try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{toast('Browser storage is unavailable or full. Your current circuit is still open.',3500);return false;} }
  function readSaved(key) { try{const raw=localStorage.getItem(key);if(!raw){toast('No saved settings found in this browser.');return null;}return JSON.parse(raw);}catch{toast('Saved settings could not be read. Your current circuit is unchanged.',3500);return null;} }
  function savePanel(){if(writeSaved(storagePrefix+'-panel',{...scope,sideMenu:null}))toast('Panel settings saved.');}
  function recallPanel(){const data=readSaved(storagePrefix+'-panel');if(!data||typeof data!=='object')return;if(isRc){try{validateSavedScope(data);}catch(error){return toast('Cannot recall panel: '+error.message);}}scope=savedScope(data);simulateAndRender();toast('Panel settings recalled.');}
  function saveLab(){if(isRc){if(drag||state.pendingHole||moveRequest)return toast('Finish or cancel the current edit before saving.');if(writeSaved(storagePrefix+'-lab',presetSnapshot()))toast('RC circuit and instrument settings saved.');return;}if(drag)return toast('Finish moving the part before saving.');if(writeSaved('gds1202b-lab',{pinoutVersion:UA741.pinoutVersion,state:JSON.parse(boardSnapshot()),scope:{...scope,sideMenu:null}}))toast('Lab and exact hole positions saved in this browser.');}
  function recallLab(){const d=readSaved(storagePrefix+'-lab');if(d)restoreLab(d);}
  function validateSavedScope(data){
    if(data==null)return;
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
    const check=(value,model,path)=>{
      if(model===null)return;
      if(Array.isArray(model)){
        if(!Array.isArray(value))throw new Error(`Invalid saved scope field: ${path}.`);
        if(path==='measure.items'&&value.some(item=>typeof item!=='string'&&(!object(item)||typeof item.name!=='string'||!(isRc?['CH1','CH2','Math']:['CH1','CH2']).includes(item.source))))throw new Error('Invalid saved measurements.');
      }else if(typeof model==='object'){
        if(!object(value))throw new Error(`Invalid saved scope field: ${path}.`);
        for(const key of Object.keys(model))if(Object.hasOwn(value,key))check(value[key],model[key],path?`${path}.${key}`:key);
      }else if(typeof value!==typeof model||(typeof value==='number'&&!Number.isFinite(value)))throw new Error(`Invalid saved scope field: ${path}.`);
    };
    check(data,defaultScope(),'');
    for(const [key,fields] of [['ch1',['voltsDiv','probe']],['ch2',['voltsDiv','probe']],['horizontal',['timeDiv']]])for(const field of fields)if(data[key]?.[field]!=null&&data[key][field]<=0)throw new Error('Saved scope scales must be positive.');
    if(data.cursor?.source!=null&&!['CH1','CH2'].includes(data.cursor.source))throw new Error('Invalid saved cursor source.');
    const array=v=>Array.isArray(v)&&v.every(Number.isFinite);
    if(data.ref?.data!=null){const r=data.ref.data;if(!object(r)||!array(r.t)||!array(r.y)||r.t.length!==r.y.length)throw new Error('Invalid saved reference waveform.');}
    if(data.frozenRecord!=null){const r=data.frozenRecord;if(!object(r)||!object(r.traces)||!['t','ch1','ch2'].every(key=>array(r.traces[key]))||r.traces.t.length!==r.traces.ch1.length||r.traces.t.length!==r.traces.ch2.length||!Number.isFinite(r.dt)||r.dt<=0)throw new Error('Invalid saved acquisition.');}
  }
  function normalizeSavedLab(d){
    if(profile.validation==='rc')return RcProfile.validate(d,prepareLayout,validateSavedScope);
    if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('Saved lab is invalid.');
    if(Object.hasOwn(d,'pinoutVersion')&&d.pinoutVersion!==UA741.pinoutVersion)throw new Error('Unsupported saved pinout version.');
    validateSavedScope(d.scope);
    let data=d.state;const validNode=n=>['GND','VPLUS','VMINUS'].includes(n)||/^[TB]:([1-9]|[12][0-9]|30)$/.test(n),validHole=h=>h&&Object.hasOwn(bb.rows,h.row)&&Number.isInteger(h.col)&&h.col>=1&&h.col<=30;
    const finiteObject=(o,keys)=>o&&keys.every(k=>Number.isFinite(o[k]));
    if(!data||!Array.isArray(data.components)||!finiteObject(data.supply,['plus','minus'])||!finiteObject(data.generator,['frequency','amplitude','offset'])||data.generator.frequency<=0||!['sine','square','triangle'].includes(data.generator.waveform)||!data.probes||!['ch1','ch2'].every(k=>data.probes[k]&&['tip','gnd'].every(e=>data.probes[k][e]==null||validNode(data.probes[k][e])))||['ttlNode','groundNode'].some(k=>data.generator[k]!=null&&!validNode(data.generator[k]))||(data.generatorNode!=null&&!validNode(data.generatorNode))||!data.components.every(c=>c&&/^[A-Za-z][A-Za-z0-9]*$/.test(c.id)&&['wire','resistor','capacitor','opamp'].includes(c.type)&&(c.type==='opamp'?Number.isInteger(c.startCol)&&c.startCol>=1&&c.startCol<=27&&Number.isFinite(c.openLoopGain)&&c.openLoopGain>0&&Number.isFinite(c.slewRate)&&c.slewRate>0:validNode(c.a)&&validNode(c.b)&&(!c.aHole||validHole(c.aHole))&&(!c.bHole||validHole(c.bHole))&&(c.type==='wire'?(!c.color||/^#[0-9a-f]{6}$/i.test(c.color)):Number.isFinite(c.value)&&c.value>0)))||Object.values(data.leadHoles||{}).some(h=>!validHole(h)))throw new Error('Saved lab is invalid.');

    if(new Set(data.components.map(c=>c.id)).size!==data.components.length)throw new Error('Duplicate component IDs in saved lab.');
    const prepared=prepareLayout(data,true);
    const converted=!Object.hasOwn(d,'pinoutVersion')&&prepared.board.components.some(c=>c.type==='opamp');
    data=converted?UA741.reflectLegacyBoard(prepared.board):prepared.board;
    data=prepareLayout(data).board;
    return {envelope:{...clone(d),pinoutVersion:UA741.pinoutVersion,state:data},converted,relocated:prepared.relocated};
  }
  function restoreLab(d,message='Lab recalled. Undo restores your previous circuit.'){
    let result;
    try{result=normalizeSavedLab(d);}catch(error){toast(`Cannot load lab: ${error.message} Current circuit is unchanged.`,4500);return false;}
    const {state:data}=result.envelope;
    if(result.relocated)message+=` Moved ${result.relocated} overlapping terminals to free holes on the same electrical strips.`;
    cancelGesture();Object.assign(state,{components:data.components,generatorNode:data.generatorNode,probes:data.probes,supply:data.supply,generator:data.generator,leadHoles:data.leadHoles||{}});state.selectedId=null;scope=savedScope(result.envelope.scope);syncInputs();updateAll();
    document.getElementById('pinoutNotice').hidden=!result.converted;
    toast(message);return true;
  }
  document.getElementById('dismissPinoutNotice').onclick=()=>document.getElementById('pinoutNotice').hidden=true;
  document.getElementById('saveLabBtn').onclick=saveLab;document.getElementById('recallLabBtn').onclick=recallLab;
  function saveHardcopy(){drawScope();const a=document.createElement('a');a.download=`gds1202b-screen-${++scope.hardcopyCount}.png`;a.href=scopeCanvas.toDataURL('image/png');a.click();}

  // -----------------------------
  // Presets
  // -----------------------------
  function addWire(a,b,color='#48a26a'){state.components.push({id:uid('W'),type:'wire',a,b,color});}
  function addR(a,b,value){state.components.push({id:uid('R'),type:'resistor',a,b,value});}
  function addC(a,b,value){state.components.push({id:uid('C'),type:'capacitor',a,b,value});}
  function addOp(startCol=14){const op={id:uid('U'),type:'opamp',model:'UA741',startCol,openLoopGain:200000,gainBandwidth:1e6,outputHeadroom:2,slewRate:0.5e6};state.components.push(op);return op;}
  const presetSelect=document.getElementById('presetSelect');
  const presetNames=new Map([...presetSelect.options].map(option=>[option.value,option.textContent]));
  const presetPrefix=storagePrefix+'-preset-',presetStorageKey=name=>presetPrefix+name;
  const customPresetIndexKey=storagePrefix+'-custom-presets';
  // Classroom access gate only: no server authentication or persisted unlock.
  let presetsUnlocked=false;
  let customPresets=[];
  try{const data=JSON.parse(localStorage.getItem(customPresetIndexKey)||'[]');if(Array.isArray(data))customPresets=data.filter(p=>p&&typeof p.id==='string'&&/^custom-[a-z0-9-]+$/.test(p.id)&&typeof p.name==='string'&&p.name.trim().length>0&&p.name.length<=60);}catch{toast('Custom preset names could not be read from browser storage.');}
  for(const preset of customPresets){presetNames.set(preset.id,preset.name);presetSelect.add(new Option(preset.name,preset.id));}
  function presetSnapshot(){return {...(isRc?{lab:profile.id,version:1}:{pinoutVersion:UA741.pinoutVersion}),state:JSON.parse(boardSnapshot()),scope:{...scope,sideMenu:null,currentMenu:null,frozenFrame:null,frozenRecord:null,forcedTrigger:false,singleArmed:false,running:true}};}
  function createPreset(){
    if(!requirePresetAccess())return;
    if(drag||state.pendingHole||moveRequest)return toast('Finish or cancel the current placement before saving a preset.');
    const input=document.getElementById('newPresetName'),name=input.value.trim();
    if(!name||name.length>60){toast('Enter a preset name from 1 to 60 characters.');input.focus();return;}
    if([...presetNames.values()].some(n=>n.toLowerCase()===name.toLowerCase()))return toast('That preset name already exists. Choose another name or use Save over preset.');
    const id='custom-'+crypto.randomUUID(),entry={id,name};
    if(!writeSaved(presetStorageKey(id),presetSnapshot()))return;
    if(!writeSaved(customPresetIndexKey,[...customPresets,entry])){try{localStorage.removeItem(presetStorageKey(id));}catch{}return;}
    customPresets.push(entry);presetNames.set(id,name);presetSelect.add(new Option(name,id));presetSelect.value=id;input.value='';refreshPresetControls();toast(`Created “${name}”. It is now available in the preset list.`,3000);
  }
  function exportSavedPresets(){
    if(!requirePresetAccess())return;
    try{
      const names=new Map(presetNames),index=JSON.parse(localStorage.getItem(customPresetIndexKey)||'[]');
      if(!Array.isArray(index))throw new Error('The custom preset index is invalid.');
      for(const item of index)if(item&&typeof item.id==='string'&&typeof item.name==='string')names.set(item.id,item.name);
      const presets=[];
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i);if(!key.startsWith(presetPrefix))continue;
        const id=key.slice(presetPrefix.length),preset=JSON.parse(localStorage.getItem(key));
        if(!preset?.state||!Array.isArray(preset.state.components))throw new Error(`Saved preset ${names.get(id)||id} is invalid.`);
        presets.push({id,name:names.get(id)||id,preset:normalizeSavedLab(preset).envelope});
      }
      if(!presets.length)return toast('No locally saved presets were found in this browser tab.');
      presets.sort((a,b)=>a.id.localeCompare(b.id));
      const bundle={format:storagePrefix+'-presets',version:1,exportedAt:new Date().toISOString(),presets};
      const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'})),link=document.createElement('a');
      link.href=url;link.download=storagePrefix+'-saved-presets.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast(`Exported ${presets.length} saved presets. Your local presets are unchanged.`,3500);
    }catch(error){toast(`Presets could not be exported: ${error.message}`,4000);}
  }
  document.getElementById('exportPresetsBtn').onclick=exportSavedPresets;
  document.getElementById('createPresetBtn').onclick=createPreset;
  document.getElementById('newPresetName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();createPreset();}});

  function hasPresetOverride(name){try{return localStorage.getItem(presetStorageKey(name))!==null;}catch{return false;}}
  function refreshPresetControls(){
    for(const option of presetSelect.options){
      option.disabled=!presetsUnlocked&&option.value!=='blank';
      option.textContent=presetNames.get(option.value)+(presetsUnlocked&&hasPresetOverride(option.value)?' · Saved':'');
    }
    document.querySelector('.preset-manager').hidden=!presetsUnlocked;
    document.getElementById('presetAccess').hidden=presetsUnlocked;
    document.getElementById('presetAccessStatus').textContent=presetsUnlocked?'Presets unlocked for this visit. Reloading locks them again.':'Presets are locked. Build your circuit on the blank board.';
    const name=presetSelect.value,saved=hasPresetOverride(name);
    const custom=customPresets.some(p=>p.id===name),restore=document.getElementById('restorePresetBtn');restore.disabled=!saved&&!custom;restore.textContent=custom?'Delete preset':'Restore original';restore.title=custom?'Delete the selected saved preset; keep the current circuit open':'Remove your saved override and load the original built-in preset';
    document.getElementById('savePresetBtn').title=`Save the current circuit and scope settings over ${presetNames.get(name)}`;
    document.getElementById('presetStatus').textContent=presetsUnlocked?`${saved?'Saved version':'Original version'} selected. Save over preset replaces “${presetNames.get(name)}” in this browser.`:'';
  }
  function saveOverPreset(){
    if(!requirePresetAccess())return;
    if(drag||state.pendingHole||moveRequest)return toast('Finish or cancel the current placement before saving a preset.');
    const name=presetSelect.value;
    const preset=presetSnapshot();
    if(writeSaved(presetStorageKey(name),preset)){refreshPresetControls();toast(`Saved over “${presetNames.get(name)}”. Load will use your version.`,3000);}
  }
  function restoreOriginalPreset(){
    if(!requirePresetAccess())return;
    const name=presetSelect.value;
    if(customPresets.some(p=>p.id===name)){
      const remaining=customPresets.filter(p=>p.id!==name);if(!writeSaved(customPresetIndexKey,remaining))return;
      try{localStorage.removeItem(presetStorageKey(name));}catch{}
      const label=presetNames.get(name);customPresets=remaining;presetNames.delete(name);[...presetSelect.options].find(o=>o.value===name)?.remove();presetSelect.value=isRc?'lowpass':'inverting';refreshPresetControls();toast(`Deleted “${label}”. Your current circuit is still open.`);return;
    }

    try{localStorage.removeItem(presetStorageKey(name));}catch{return toast('Could not restore this preset because browser storage is unavailable.');}
    loadPreset(name,true);toast(`Original “${presetNames.get(name)}” restored.`);
  }
  document.getElementById('savePresetBtn').onclick=saveOverPreset;
  document.getElementById('restorePresetBtn').onclick=restoreOriginalPreset;
  function requirePresetAccess(){
    if(presetsUnlocked)return true;
    toast('Unlock presets with the instructor password first.');
    return false;
  }
  document.getElementById('presetUnlockForm').addEventListener('submit',event=>{
    event.preventDefault();
    const input=document.getElementById('presetPassword'),error=document.getElementById('presetUnlockError');
    if(input.value!=='aero1234'){
      error.hidden=false;input.setAttribute('aria-invalid','true');input.setAttribute('aria-describedby','presetUnlockError');input.focus();input.select();return;
    }
    presetsUnlocked=true;input.value='';input.removeAttribute('aria-invalid');input.setAttribute('aria-describedby','presetAccessStatus');error.hidden=true;
    refreshPresetControls();presetSelect.focus();
  });
  presetSelect.addEventListener('change',()=>{
    if(!presetsUnlocked)presetSelect.value='blank';
    refreshPresetControls();
  });
  function loadPreset(name,originalOnly=false){
    if(!presetNames.has(name))return;
    if(name!=='blank'&&!requirePresetAccess())return;
    // A saved override of Blank board must not reveal a circuit while locked.
    if(!presetsUnlocked)originalOnly=true;
    presetSelect.value=name;refreshPresetControls();
    if(!originalOnly&&hasPresetOverride(name)){const data=readSaved(presetStorageKey(name));if(data)restoreLab(data,`Loaded saved “${presetNames.get(name)}”.`);return;}

    if(customPresets.some(p=>p.id===name))return toast('This saved preset is missing. Your current circuit is unchanged.');
    document.getElementById('pinoutNotice').hidden=true;
    cancelGesture();state.leadHoles={};state.components=[];state.selectedId=null;state.pendingNode=null;state.generatorNode=null;state.probes={ch1:{tip:null,gnd:null},ch2:{tip:null,gnd:null}};
    state.supply=profile.instruments.includes('supply')?{plus:12,minus:-12}:undefined;state.generator={waveform:'sine',frequency:1000,amplitude:1,offset:0};
    scope=defaultScope();
    if(name==='blank'){state.generator.groundNode=null;state.generator.output=false;syncInputs();updateAll();return;}
    const placement=isRc?RcProfile.layout(name):PresetLayouts.layout(name);
    if(!isRc)addOp(placement.startCol);
    const hole=address=>{const [row,col]=address.split(':');return {row,col:Number(col)};};
    for(const [type,a,b,value] of placement.parts){
      const comp={id:uid(type==='wire'?'W':type==='resistor'?'R':'C'),type};
      putEnd(comp,'a',hole(a));putEnd(comp,'b',hole(b));
      if(type==='wire')comp.color=value||'#48a26a';else comp.value=value;
      state.components.push(comp);
    }
    for(const [key,address] of Object.entries(placement.leads))setLead(key,hole(address));
    if(name==='inverting'||name==='noninverting')scope.ch2.voltsDiv=1;
    if(!isRc&&name==='lowpass')state.generator.frequency=500;
    if(name==='integrator'){Object.assign(state.generator,{waveform:'square',frequency:200,amplitude:.5});scope.horizontal.timeDiv=.001;scope.ch2.voltsDiv=.5;}
    syncInputs();updateAll();
  }
  document.getElementById('loadPresetBtn').addEventListener('click',()=>loadPreset(document.getElementById('presetSelect').value));

  // -----------------------------
  // Main update cycle and controls
  // -----------------------------
  const averageCapture={signature:null,records:[]};
  function averageAcquisition(sim){
    if(scope.acquire.mode!=='Average'||!scope.running){averageCapture.signature=null;averageCapture.records=[];return sim;}
    const signature=boardSnapshot()+sim.dt+scope.acquire.average;if(signature!==averageCapture.signature){averageCapture.records=[];averageCapture.signature=signature;}
    averageCapture.records.push({ch1:sim.traces.ch1.slice(),ch2:sim.traces.ch2.slice()});if(averageCapture.records.length>scope.acquire.average)averageCapture.records.shift();
    for(const ch of ['ch1','ch2'])sim.traces[ch]=sim.traces[ch].map((_,i)=>averageCapture.records.reduce((sum,r)=>sum+r[ch][i],0)/averageCapture.records.length);return sim;
  }
  function simulateAndRender(){
    if(isDivider)return dividerRuntime.render();
    if(!scope.powered){drawScope();return;}
    try{state.sim.error=null;state.sim.last=averageAcquisition(solveCircuitWaveforms());if(scope.running)acquisitionVersion++;}
    catch(err){state.sim.error=err.message;state.sim.last=null;}
    drawScope();updateReadouts();updateStatus();
  }
  let updateTimer=null;
  function updateAll(){if(isDivider)return dividerRuntime.update();normalizePositions();recordBoard();drawBreadboard();updateEditor();clearTimeout(updateTimer);updateTimer=setTimeout(simulateAndRender,20);updateStatus();updateReadouts();}

  function updateStatus(){
    const {warnings}=validateCircuit();const el=document.getElementById('circuitStatus'),list=document.getElementById('circuitWarnings');
    list.innerHTML='';
    const msgs=[...warnings];if(state.sim.error)msgs.unshift(state.sim.error);
    if(state.sim.error){el.className='status-pill bad';el.textContent='Simulation error';}
    else if(warnings.length){el.className='status-pill warn';el.textContent=`${warnings.length} issue${warnings.length>1?'s':''} to check`;}
    else {el.className='status-pill ok';el.textContent='Circuit electrically runnable';}
    const statusDetails=document.getElementById('statusDetails');if(statusDetails.dataset.messages!==JSON.stringify(msgs)){statusDetails.open=msgs.length>0;statusDetails.dataset.messages=JSON.stringify(msgs);}
    msgs.slice(0,7).forEach(m=>{const li=document.createElement('li');li.textContent=m;list.appendChild(li);});
  }
  function updateReadouts(){
    const pr=(ch)=>{const p=state.probes[ch];return p.tip?`${nodeLabel(p.tip)} relative to ${p.gnd?nodeLabel(p.gnd):'unconnected ground'}`:'not connected';};
    document.getElementById('ch1ProbeReadout').textContent=pr('ch1');document.getElementById('ch2ProbeReadout').textContent=pr('ch2');
    document.getElementById('simReadout').textContent=state.sim.error?state.sim.error:(state.sim.last?`updated · ${state.sim.last.traces.t.length} acquired samples`:'waiting');
    const score=document.getElementById('challengeScore');
    if(!score)return;
    if(!state.challenge.enabled)score.textContent='—';else {let s=100-Math.min(50,state.challenge.actions*2)-(state.challenge.autosetUsed?20:0);score.textContent=`${Math.max(0,s)}/100`;}
  }

  function syncInputs(){
    if(isDivider)return dividerRuntime.syncInputs();
    SFG1013.normalize(state.generator);SFG1013.render();
    if(profile.instruments.includes('supply')){document.getElementById('vplusInput').value=state.supply.plus;document.getElementById('vminusInput').value=state.supply.minus;}
    document.getElementById('waveformSelect').value=state.generator.waveform;document.getElementById('frequencyInput').value=state.generator.frequency;
    document.getElementById('amplitudeInput').value=state.generator.amplitude;document.getElementById('offsetInput').value=state.generator.offset;
  }
  function bindNumber(id,fn){document.getElementById(id)?.addEventListener('change',e=>{if(!e.target.value.trim()||!Number.isFinite(Number(e.target.value))){toast('Enter a finite number.');syncInputs();return;}fn(Number(e.target.value));syncInputs();state.challenge.actions++;updateAll();});}
  bindNumber('vplusInput',v=>state.supply.plus=v);bindNumber('vminusInput',v=>state.supply.minus=v);bindNumber('frequencyInput',v=>SFG1013.setFrequency(v));bindNumber('amplitudeInput',v=>state.generator.amplitude=clamp(v,.2,10));bindNumber('offsetInput',v=>{state.generator.offset=clamp(v,-10,10);state.generator.offsetEnabled=v!==0;});
  document.getElementById('waveformSelect').addEventListener('change',e=>{state.generator.waveform=e.target.value;SFG1013.setFrequency(state.generator.frequency);syncInputs();updateAll();});
  document.getElementById('challengeMode')?.addEventListener('change',e=>{state.challenge={enabled:e.target.checked,actions:0,autosetUsed:false,startTime:Date.now()};if(e.target.checked){scope.ch1.voltsDiv=5;scope.ch2.voltsDiv=5;scope.horizontal.timeDiv=1e-5;scope.trigger.level=4;scope.trigger.mode='Normal';toast('Challenge mode scrambled the scope. Adjust scale and trigger settings to recover the waveform.');simulateAndRender();}updateReadouts();});
  document.getElementById('resetAllBtn').addEventListener('click',()=>{if(!confirm('Reset the entire lab?'))return;loadPreset('blank',true);});

  SFG1013.mount({getGenerator:()=>state.generator,onChange:()=>{syncInputs();state.challenge.actions++;updateAll();},setTool});

  if(profile.references==='rc')RcProfile.references();
  // Initial state
  loadPreset('blank',true);
  setTool('select');
})();
