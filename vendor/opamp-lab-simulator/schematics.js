/* Reference-only SVG schematics. No access to mutable lab or instrument state. */
(function(root){
  'use strict';
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const displayValue=component=>component.type==='resistor'?`${component.value/1000} kΩ`:`${Number((component.value*1e9).toPrecision(4))} nF`;
  const roleNames={rin:'Rin',rf:'Rf',rg:'Rg',cf:'Cf',r:'R',c:'C'};
  const pinColor=label=>UA741.pins.find(pin=>pin.label===label).color;
  const netColor=net=>({input:pinColor('IN+'),filtered:pinColor('IN+'),summing:pinColor('IN−'),divider:pinColor('IN−'),output:pinColor('OUT'),positive:pinColor('V+'),negative:pinColor('V−'),ground:'#a3b5c4'}[net]||'#e4edf3');
  const netNames={input:'Vin',output:'Vout',ground:'common ground',positive:'+12 V',negative:'−12 V',summing:'inverting input node',divider:'feedback divider node',filtered:'filtered input'};
  function scene(name){
    const reference=PresetLayouts.reference(name),wires=[],components=[],ports=[],grounds=[],labels=[],junctions=[];
    const wire=(net,points)=>wires.push({id:`${net}-${wires.filter(w=>w.net===net).length+1}`,net,points:points.map(([x,y])=>({x,y}))});
    const text=(x,y,value,anchor='middle',size=18)=>labels.push({x,y,value,anchor,size});
    const port=(id,net,x,y)=>ports.push({id,net,point:{x,y}});
    const ground=(id,x,y)=>{grounds.push({id,net:'ground',x,y});port(id,'ground',x,y);};
    const dot=(net,x,y)=>junctions.push({net,x,y});
    function component(role,x,y,vertical=false){
      const ref=reference.components.find(c=>c.role===role);if(!ref)throw new Error(`Missing schematic role ${role}`);
      // All horizontal components read left-to-right; electrical orientation is not polarity.
      const nets=!vertical&&(role==='rf'||role==='cf'||role==='rg')?[...ref.nets].reverse():ref.nets;
      const a={x:x-(vertical?0:50),y:y-(vertical?35:0)},b={x:x+(vertical?0:50),y:y+(vertical?35:0)};
      components.push({...ref,nets,a,b,x,y,vertical});
      if(vertical)text(x-20,y-4,`${roleNames[role]}`, 'end');
      else text(x,name==='noninverting'&&role==='rf'?y+25:y-25,`${roleNames[role]}  ${displayValue(ref)}`);
      if(vertical)text(x-20,y+20,displayValue(ref),'end');
      return {a,b};
    }
    const inverting=['inverting','integrator'].includes(name),positiveOnTop=name==='noninverting',inputY=inverting||positiveOnTop?230:290;
    const pinByFunction=label=>UA741.pins.find(pin=>pin.label===label).number;
    const pinPositions={ [pinByFunction('IN−')]:[440,positiveOnTop?290:230], [pinByFunction('IN+')]:[440,positiveOnTop?230:290], [pinByFunction('OUT')]:[560,260], [pinByFunction('V+')]:[500,230], [pinByFunction('V−')]:[500,290] };
    for(const [number,[x,y]] of Object.entries(pinPositions))port(`ua741.${number}`,reference.pins[number],x,y);
    // Source and test points are explicit, but do not add instrument impedances to the reference circuit.
    const sourceY=inputY+80;
    wire('input',[[120,sourceY-24],[120,inputY],[180,inputY]]);
    wire('ground',[[120,sourceY+24],[120,sourceY+43]]);ground('generator.return',120,sourceY+43);
    port('generator.main','input',120,sourceY-24);port('ch1.tip','input',180,inputY);dot('input',180,inputY);
    text(175,inputY-48,'Vin');text(175,inputY-23,'CH1', 'middle',16);
    text(120,sourceY+77,'SFG MAIN / return','middle',16);
    wire('output',[[560,260],[730,260]]);dot('output',680,260);port('ch2.tip','output',730,260);
    text(730,235,'CH2','middle',16);text(730,290,'Vout');
    wire('positive',[[500,230],[500,185]]);port('supply.positive','positive',500,185);text(500,165,'+12 V');
    const negativeEnd=positiveOnTop?315:365;
    wire('negative',[[500,290],[500,negativeEnd]]);port('supply.negative','negative',500,negativeEnd);text(500,negativeEnd+30,'−12 V');
    text(515,206,'7','start',16);text(515,positiveOnTop?312:331,'4','start',16);
    text(425,220,positiveOnTop?'3':'2','end',16);text(425,312,positiveOnTop?'2':'3','end',16);text(578,247,'6','start',16);
    // Scope grounds connect to the same common ground, never to the negative supply.
    const scopeY=positiveOnTop?420:350;
    wire('ground',[[640,scopeY],[730,scopeY]]);wire('ground',[[685,scopeY],[685,scopeY+30]]);dot('ground',685,scopeY);
    port('ch1.gnd','ground',640,scopeY);port('ch2.gnd','ground',730,scopeY);ground('scope.return',685,scopeY+30);
    text(635,scopeY-18,'CH1 GND','middle',15);text(730,scopeY-18,'CH2 GND','middle',15);
    if(inverting){
      const r=component('rin',270,230);
      wire('input',[[180,230],[r.a.x,230]]);wire('summing',[[r.b.x,230],[440,230]]);dot('summing',360,230);
      wire('ground',[[440,290],[390,290],[390,350]]);ground('ua741.input-ground',390,350);
      const feedbackY=name==='integrator'?70:100,rf=component('rf',520,feedbackY);
      wire('summing',[[360,230],[360,feedbackY],[rf.a.x,feedbackY]]);
      wire('output',[[rf.b.x,feedbackY],[680,feedbackY],[680,260]]);
      if(name==='integrator'){
        const cf=component('cf',520,130);
        wire('summing',[[360,130],[cf.a.x,130]]);wire('output',[[cf.b.x,130],[680,130]]);
        dot('summing',360,130);dot('output',680,130);
      }
    } else {
      if(name==='lowpass'){
        const r=component('r',260,290),c=component('c',340,365,true);
        wire('input',[[180,290],[r.a.x,290]]);wire('filtered',[[r.b.x,290],[440,290]]);dot('filtered',340,290);
        wire('filtered',[[340,290],[c.a.x,c.a.y]]);wire('ground',[[c.b.x,c.b.y],[340,420]]);ground('filter.return',340,420);
      } else wire('input',[[180,inputY],[440,inputY]]);
      if(name==='noninverting'){
        const rf=component('rf',540,365),rg=component('rg',300,405,true);
        wire('divider',[[440,290],[300,290],[300,365],[rf.a.x,365]]);dot('divider',300,365);
        wire('divider',[[300,365],[rg.a.x,rg.a.y]]);wire('output',[[rf.b.x,365],[680,365],[680,260]]);
        wire('ground',[[rg.b.x,rg.b.y],[300,450]]);ground('divider.return',300,450);
      } else wire('output',[[440,230],[360,230],[360,100],[680,100],[680,260]]);
    }
    return {reference,positiveOnTop,wires,components,ports,grounds,labels,junctions,source:{x:120,y:sourceY,waveform:name==='integrator'?'square':'sine'}};
  }
  function render(name){
    const s=scene(name),r=s.reference;
    const description=`${r.title}. ${r.description} ${s.positiveOnTop?'The positive input, pin 3, is drawn at the top; the negative input, pin 2, is below it. ':''}UA741 pin 2: ${netNames[r.pins[2]]}; pin 3: ${netNames[r.pins[3]]}; pin 6: Vout; pin 7: +12 volts; pin 4: minus 12 volts. ${r.components.map(c=>`${roleNames[c.role]}, ${displayValue(c)}, connects ${c.nets.map(n=>netNames[n]).join(' to ')}.`).join(' ')} Function-generator MAIN and CH1 tip connect to Vin. CH2 tip connects to Vout. Generator return and both oscilloscope grounds share common ground. Pins 1, 5 and 8 are not connected.`;
    const path=points=>points.map(({x,y},i)=>`${i?'L':'M'}${x} ${y}`).join(' ');
    let svg=`<svg class="circuit-schematic" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="schematic-title schematic-desc"><title id="schematic-title">${escape(r.title)} — reference schematic</title><desc id="schematic-desc">${escape(description)}</desc><g fill="none" stroke="#e4edf3" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">`;
    for(const w of s.wires)svg+=`<path data-wire="${w.id}" data-net="${w.net}" stroke="${netColor(w.net)}" d="${path(w.points)}"/>`;
    // Component terminal geometry is shared with the semantic scene, so symbols cannot silently change nets.
    for(const c of s.components){
      let d;
      if(c.type==='resistor')d='M-50 0H-32L-26 -9L-16 9L-6 -9L4 9L14 -9L24 9L32 0H50';
      else d='M-50 0H-8M-8 -16V16M8 -16V16M8 0H50';
      svg+=`<g data-component="${c.role}" data-type="${c.type}" data-value="${c.value}" data-net-a="${c.nets[0]}" data-net-b="${c.nets[1]}" transform="translate(${c.x} ${c.y})${c.vertical?' rotate(90) scale(.7 1)':''}"><path d="${d}"/></g>`;
    }
    svg+='<path d="M440 200L440 320L560 260Z" fill="#0d141c"/>';
    for(const ground of s.grounds)svg+=`<path data-ground="${ground.id}" data-net="ground" stroke="${netColor('ground')}" d="M${ground.x-13} ${ground.y}h26m-22 6h18m-14 6h10"/>`;
    svg+=`<circle cx="${s.source.x}" cy="${s.source.y}" r="24" fill="#0d141c"/>`;
    svg+=s.source.waveform==='square'?`<path d="M105 ${s.source.y+7}v-14h15v14h15v-14"/>`:`<path d="M105 ${s.source.y}q7-20 15 0t15 0"/>`;
    svg+='</g><g fill="#e4edf3">';
    for(const dot of s.junctions)svg+=`<circle data-junction="${dot.net}" fill="${netColor(dot.net)}" cx="${dot.x}" cy="${dot.y}" r="3.5"/>`;
    svg+='</g><g fill="#0d141c" stroke="#e4edf3" stroke-width="2">';
    for(const port of s.ports.filter(p=>['ch1.tip','ch2.tip','ch1.gnd','ch2.gnd'].includes(p.id)))svg+=`<circle data-port="${port.id}" stroke="${netColor(port.net)}" cx="${port.point.x}" cy="${port.point.y}" r="4"/>`;
    svg+='</g><g font-family="Inter,system-ui,sans-serif" fill="#e4edf3">';
    svg+=`<text data-input-sign="top" x="451" y="237" font-size="22" fill="${pinColor('IN+')}">${s.positiveOnTop?'+':'−'}</text><text data-input-sign="bottom" x="451" y="297" font-size="22" fill="${pinColor('IN−')}">${s.positiveOnTop?'−':'+'}</text><text x="487" y="267" text-anchor="middle" font-size="16">UA741</text>`;
    const labelNet={Vin:'input',CH1:'input',Vout:'output',CH2:'output','+12 V':'positive','−12 V':'negative','2':'summing','3':'input','4':'negative','6':'output','7':'positive','CH1 GND':'ground','CH2 GND':'ground','SFG MAIN / return':'ground'};
    for(const label of s.labels)svg+=`<text x="${label.x}" y="${label.y}" font-size="${label.size}" fill="${netColor(labelNet[label.value])}" text-anchor="${label.anchor}">${escape(label.value)}</text>`;
    svg+='<text x="400" y="482" text-anchor="middle" font-size="15" fill="#a3b5c4">All ground symbols share the generator and oscilloscope return.</text></g></svg>';
    return svg;
  }
  root.CircuitSchematics=Object.freeze({scene,render});
  if(typeof document!=='undefined'){
    const select=document.getElementById('schematicSelect'),host=document.getElementById('schematicDiagram');
    if(select&&host){
      for(const name of PresetLayouts.names)select.add(new Option(PresetLayouts.reference(name).title,name));
      select.value='inverting';
      const update=()=>{host.innerHTML=render(select.value);document.getElementById('schematicDescription').textContent=PresetLayouts.reference(select.value).description;document.getElementById('schematicViewport').scrollLeft=0;};
      select.addEventListener('change',update);update();
    }
  }
})(globalThis);
