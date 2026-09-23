/* RC-specific presets, recall validation, and non-mutating references. Instruments remain shared. */
(function(root){
  'use strict';
  const signals=root.RcSignals;
  const names={lowpass:'Low-pass filter',highpass:'High-pass filter',bandpass:'Band-pass filter','uav-highpass':'UAV vibration high-pass'};
  const layout=name=>({parts:name==='bandpass'?[['capacitor','A:6','A:13',100e-9],['resistor','B:13','GND_TOP:13',10000],['resistor','C:13','A:22',10000],['capacitor','B:22','GND_TOP:22',10e-9]]:name==='uav-highpass'?[['capacitor','A:6','A:14',100e-9],['resistor','B:14','GND_TOP:14',33000]]:[[name==='lowpass'?'resistor':'capacitor','A:6','A:14',name==='lowpass'?10000:10e-9],[name==='lowpass'?'capacitor':'resistor','B:14','GND_TOP:14',name==='lowpass'?10e-9:10000]],leads:{generator:'C:6',gengnd:'GND_TOP:5',ch1tip:'B:6',ch1gnd:'GND_TOP:6',ch2tip:name==='bandpass'?'C:22':'C:14',ch2gnd:'GND_TOP:7'}});
  function validate(d,prepareLayout,validateScope){
    const object=v=>v&&typeof v==='object'&&!Array.isArray(v),node=n=>typeof n==='string'&&(/^[TB]:([1-9]|[12][0-9]|30)$/.test(n)||['VPLUS','VMINUS','GND_TOP','GND_BOTTOM'].includes(n)),hole=h=>object(h)&&['VPLUS','VMINUS','GND_TOP','GND_BOTTOM',...'ABCDEFGHIJ'].includes(h.row)&&Number.isInteger(h.col)&&h.col>=1&&h.col<=30;
    if(!object(d)||d.lab!=='rc-filter'||![1,2].includes(d.version)||!object(d.state)||!object(d.scope))throw new Error('Unsupported RC filter save.');
    const s=structuredClone(d.state),g=s.generator;
    s.rcInput=d.version===1?signals.defaults():signals.validate(s.rcInput);
    if(!Array.isArray(s.components)||!object(g)||!object(s.probes)||!object(s.leadHoles)||!['sine','square','triangle'].includes(g.waveform))throw new Error('Invalid RC circuit or instruments.');
    const range=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(!range(g.frequency,.1,g.waveform==='triangle'?1e6:3e6)||!range(g.amplitude,.2,10)||!range(g.offset,-10,10)||!range(g.duty,25,75))throw new Error('Invalid generator setting.');
    for(const k of ['powered','output','ttl','attenuated','dutyEnabled','offsetEnabled','termination'])if(typeof g[k]!=='boolean')throw new Error('Invalid generator switch.');
    const ids=new Set();for(const c of s.components){if(!object(c)||typeof c.id!=='string'||!/^[A-Za-z][A-Za-z0-9]*$/.test(c.id)||ids.has(c.id)||!['wire','resistor','capacitor'].includes(c.type)||!node(c.a)||!node(c.b)||!hole(c.aHole)||!hole(c.bHole))throw new Error('Invalid component or terminal position.');ids.add(c.id);if(c.type==='resistor'&&!range(c.value,100,1e6)||c.type==='capacitor'&&!range(c.value,1e-10,1e-5)||c.type==='wire'&&!/^#[0-9a-f]{6}$/i.test(c.color))throw new Error('Component value is outside the RC lab range.');}
    const leads={generator:s.generatorNode,gengnd:g.groundNode,genttl:g.ttlNode};
    for(const ch of ['ch1','ch2']){if(!object(s.probes[ch]))throw new Error('Invalid probes.');for(const end of ['tip','gnd'])leads[ch+end]=s.probes[ch][end];}
    for(const [key,n] of Object.entries(leads))if(n!==null&&(!node(n)||!hole(s.leadHoles[key])))throw new Error('Invalid instrument lead position.');
    for(const [key,h] of Object.entries(s.leadHoles))if(!(key in leads)||!hole(h))throw new Error('Invalid lead position.');
    validateScope(d.scope);
    const board=prepareLayout(s,false).board;
    return {envelope:{lab:'rc-filter',version:2,state:board,scope:{...d.scope,frozenRecord:null,frozenFrame:null,running:true,singleArmed:false}},converted:false,relocated:0};
  }
  function schematic(kind){
    const band=kind==='bandpass',high=kind!=='lowpass',uav=kind==='uav-highpass';
    const part=(x,y,cap,label,rotate=false)=>`<g transform="translate(${x} ${y})"><g${rotate?' transform="rotate(-90)"':''}>${cap?'<path d="M0 -30V-6M-17 -6H17M-17 6H17M0 6V30"/>':'<path d="M0 -30V-22H-10V22H10V-22H0M0 22V30"/>'}</g><text x="${rotate?0:22}" y="${rotate?-24:5}" text-anchor="${rotate?'middle':'start'}">${label}</text></g>`;
    return `<svg class="rc-reference" viewBox="0 0 720 270" role="img" aria-label="${names[kind]} reference schematic"><g stroke="currentColor" stroke-width="2" fill="none"><path d="M65 90V60H170M230 60H310V100M310 160V220H65V160"/><circle cx="65" cy="125" r="35"/>${part(200,60,high,high?(band?'C1 · 100 nF':uav?'C · 100 nF':'C · 10 nF'):'R · 10 kΩ',true)}${part(310,130,!high,high?(uav?'R · 33 kΩ':'R1 · 10 kΩ'):'C · 10 nF')}${band?`<path d="M310 60H420M480 60H550V100M550 160V220H310M550 60H655"/>${part(450,60,false,'R2 · 10 kΩ',true)}${part(550,130,true,'C2 · 10 nF')}`:'<path d="M310 60H655"/>'}<path d="M65 220H655"/></g><g fill="currentColor" font-size="15"><text x="20" y="190">MAIN</text><text x="80" y="45">CH1 · input</text><text x="575" y="45">CH2 · output</text><text x="190" y="248">GEN return, CH1 ground, and CH2 ground: one common net</text></g></svg>`;
  }
  function references(){const select=document.getElementById('schematicSelect');for(const [id,name] of Object.entries(names))select.add(new Option(name,id));const render=()=>{document.getElementById('schematicDiagram').innerHTML=schematic(select.value);document.getElementById('schematicDescription').textContent=select.value==='bandpass'?'Unbuffered cascade: the low-pass stage loads the high-pass stage. Measure the actual peak and half-power points; isolated corner frequencies are only a starting point.':select.value==='uav-highpass'?'Conditioned accelerometer teaching example: preserve at least 95% of the 200 Hz motor vibration, reduce the 2 Hz movement below 5%, and reduce the 5 Hz movement below 15%. With 33 kΩ and 100 nF, cutoff is about 48.2 Hz. After loading the preset, press Autoset. Increasing cutoff reduces more movement but eventually weakens useful vibration.':'Change generator frequency above and below cutoff. Add a resistor from output to return to explore loading.';};select.onchange=render;render();}
  root.RcProfile={layout,validate,references};
})(globalThis);
