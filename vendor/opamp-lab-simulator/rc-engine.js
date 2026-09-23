/* Linear steady-state response of the actual wired RC network. No gmin or powered rails. */
(function(root){
  'use strict';
  const {UnionFind}=root.CircuitEngine||(typeof require==='function'?require('./engine.js'):{});
  const {stampG,stampI,factorize}=root.TransientEngine||(typeof require==='function'?require('./transient-engine.js'):{});
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const mv=(A,x)=>A.map(r=>dot(r,x));
  const mm=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
  function power(A,n){let p=A.map((row,i)=>row.map((_,j)=>+(i===j))),b=A;while(n){if(n%2)p=mm(p,b);n=Math.floor(n/2);if(n)b=mm(b,b);}return p;}
  function prepare(state,signal=null){
    const uf=new UnionFind(),warnings=[],plain=new UnionFind(),ground='RC:EARTH';uf.add(ground);
    for(const c of state.components){uf.add(c.a);uf.add(c.b);plain.add(c.a);plain.add(c.b);if(c.type==='wire'){uf.union(c.a,c.b);plain.union(c.a,c.b);}}
    const grounds=[state.generator.groundNode,...['ch1','ch2'].map(ch=>state.probes[ch].gnd)].filter(Boolean);
    if(grounds.length>1&&grounds.some(g=>plain.find(g)!==plain.find(grounds[0])))warnings.push('Generator and scope ground clips are common. These connections join different breadboard nets and may bypass components.');
    for(const g of grounds)uf.union(g,ground);
    const g=uf.find(ground),r=n=>uf.find(n),parts=state.components.filter(c=>c.type!=='wire').map(c=>({...c,a:r(c.a),b:r(c.b)}));
    for(const c of parts)if(c.a===c.b)warnings.push(`${c.id}: both terminals share one net; the component is bypassed.`);
    const enabled=signal?signal.enabled:state.generator.powered&&state.generator.output;
    const active=enabled&&state.generator.groundNode!=null;
    const sources=[];
    if(active&&state.generatorNode){const internal='RC:MAIN:INTERNAL';parts.push({id:'RC:SOURCE-R',type:'resistor',a:internal,b:r(state.generatorNode),value:50});sources.push({a:internal,b:g,port:'main'});if(r(state.generatorNode)===g)warnings.push('MAIN is shorted to instrument ground. Its 50 Ω source resistance limits current; the terminal voltage is zero.');}
    if(!signal&&active&&state.generator.ttl&&state.generator.ttlNode){const a=r(state.generator.ttlNode);if(a===g)throw new Error('TTL is an ideal source shorted to instrument ground. Move its lead or ground clip.');sources.push({a,b:g,port:'ttl'});}
    if(state.generator.termination&&state.generatorNode&&state.generator.groundNode)parts.push({id:'RC:TERMINATION',type:'resistor',a:r(state.generatorNode),b:g,value:50});
    if(!state.generatorNode&&(signal||!state.generator.ttlNode))warnings.push(signal?'Connect the selected input MAIN lead and return to your circuit.':'Connect the generator output and return to your circuit.');
    if(!state.generator.groundNode)warnings.push('Generator return is disconnected.');
    if(!enabled)warnings.push(signal?'Selected input is off; its output is disconnected.':'Generator output is off; its outputs are disconnected.');
    const groups=new UnionFind();groups.add(g);for(const p of parts)groups.union(p.a,p.b);for(const s of sources)groups.union(s.a,s.b);
    const connected=n=>groups.find(n)===groups.find(g),validParts=parts.filter(p=>p.a!==p.b&&connected(p.a));
    const status={};for(const ch of ['ch1','ch2']){const p=state.probes[ch];status[ch]=!p.tip?'Probe tip disconnected':!p.gnd?'Probe ground disconnected':!connected(r(p.tip))?'Probe is on a floating, disconnected network':null;if(status[ch])warnings.push(`${ch.toUpperCase()}: ${status[ch]}.`);}
    const nodes=[...new Set([...validParts.flatMap(p=>[p.a,p.b]),...sources.flatMap(s=>[s.a,s.b])])].filter(n=>n!==g);
    if(nodes.length>60||validParts.filter(p=>p.type==='capacitor').length>24)throw new Error('This circuit exceeds the interactive calculation budget. Reduce the number of connected parts.');
    return {uf,ground:g,r,parts:validParts,sources,nodes,status,warnings};
  }
  function acquisition(net,state,count,sourceAt){
    const {ground,nodes,sources,parts}=net,ni=new Map(nodes.map((n,i)=>[n,i])),caps=parts.filter(c=>c.type==='capacitor'),dt=1/state.generator.frequency/count,n=nodes.length+sources.length,m=caps.length;
    if(!n)return {channels:{ch1:Array(count).fill(0),ch2:Array(count).fill(0)},dt};
    const A=Array.from({length:n},()=>Array(n).fill(0));
    for(const p of parts)stampG(A,ni,ground,p.a,p.b,p.type==='resistor'?1/p.value:p.value/dt);
    sources.forEach((s,j)=>{const k=nodes.length+j;for(const [node,sign] of [[s.a,1],[s.b,-1]])if(node!==ground){A[ni.get(node)][k]+=sign;A[k][ni.get(node)]+=sign;}});
    const solve=factorize(A),nodeV=(sol,node)=>node===ground?0:sol[ni.get(node)],capVolt=sol=>caps.map(c=>nodeV(sol,c.a)-nodeV(sol,c.b));
    const stateColumns=caps.map(c=>{const rhs=Array(n).fill(0);stampI(rhs,ni,ground,c.a,c.b,-c.value/dt);return solve(rhs);});
    const sourceColumns=sources.map((s,j)=>{const rhs=Array(n).fill(0);rhs[nodes.length+j]=1;return solve(rhs);});
    const F=caps.map((_,i)=>stateColumns.map(col=>capVolt(col)[i])),B=caps.map((_,i)=>sourceColumns.map(col=>capVolt(col)[i]));
    const inputs=Array.from({length:count},(_,i)=>sources.map(s=>sourceAt((((i+1)%count)+1e-6)/count/state.generator.frequency,s.port)));
    let initial=Array(m).fill(0);
    if(m){let forcing=Array(m).fill(0);for(const input of inputs)forcing=mv(F,forcing).map((v,i)=>v+dot(B[i],input));const P=power(F,count);initial=factorize(P.map((row,i)=>row.map((v,j)=>+(i===j)-v)))(forcing);}
    let x=initial;const channels={ch1:[],ch2:[]};
    const channelMap={};for(const ch of ['ch1','ch2']){const p=state.probes[ch],node=p.tip?net.r(p.tip):ground;channelMap[ch]=net.status[ch]?null:{state:stateColumns.map(col=>nodeV(col,node)),source:sourceColumns.map(col=>nodeV(col,node))};}
    for(const input of inputs){for(const ch of ['ch1','ch2']){const map=channelMap[ch];channels[ch].push(map?dot(map.state,x)+dot(map.source,input):0);}if(m)x=mv(F,x).map((v,i)=>v+dot(B[i],input));}
    for(const ch of ['ch1','ch2'])channels[ch].unshift(channels[ch].pop());
    if(x.some((v,i)=>Math.abs(v-initial[i])>1e-5+1e-5*Math.abs(v)))throw new Error('Periodic state did not settle. Check the circuit or choose less extreme parameters.');
    return {channels,dt};
  }
  function toneResponse(net,state,frequency){
    const {ground,nodes,sources,parts}=net,n=nodes.length+sources.length;
    const zero=()=>({re:0,im:0});
    if(!n||!sources.length)return {ch1:zero(),ch2:zero()};
    const ni=new Map(nodes.map((node,i)=>[node,i]));
    const real=Array.from({length:n},()=>Array(n).fill(0)),imag=Array.from({length:n},()=>Array(n).fill(0));
    for(const part of parts){
      if(part.type==='resistor')stampG(real,ni,ground,part.a,part.b,1/part.value);
      else if(part.type==='capacitor')stampG(imag,ni,ground,part.a,part.b,2*Math.PI*frequency*part.value);
    }
    sources.forEach((source,j)=>{const k=nodes.length+j;for(const [node,sign] of [[source.a,1],[source.b,-1]])if(node!==ground){real[ni.get(node)][k]+=sign;real[k][ni.get(node)]+=sign;}});
    // Solve (G + jB)v = source with the shared real-valued factorization.
    const matrix=real.map((row,i)=>[...row,...imag[i].map(value=>-value)]).concat(imag.map((row,i)=>[...row,...real[i]]));
    const rhs=Array(2*n).fill(0);sources.forEach((source,j)=>{if(source.port==='main')rhs[nodes.length+j]=1;});
    const solution=factorize(matrix)(rhs),channels={};
    for(const ch of ['ch1','ch2']){
      const probe=state.probes[ch],node=probe.tip?net.r(probe.tip):ground,index=ni.get(node);
      channels[ch]=net.status[ch]||node===ground?zero():{re:solution[index],im:solution[index+n]};
    }
    return channels;
  }
  function solveSignal(state,window,signal){
    if(!Number.isFinite(window)||window<=0)throw new Error('Choose a positive scope time base.');
    if(!signal||typeof signal.enabled!=='boolean'||!Array.isArray(signal.tones)||signal.tones.length>32||signal.tones.some(tone=>!tone||!Number.isFinite(tone.frequency)||tone.frequency<=0||!Number.isFinite(tone.amplitude)||tone.amplitude<0||!Number.isFinite(tone.phase)))throw new Error('The selected RC input has invalid frequency components.');
    const net=prepare(state,signal),active=net.sources.some(source=>source.port==='main');
    const tones=active?signal.tones.filter(tone=>tone.amplitude>0):[];
    const maxFrequency=Math.max(0,...tones.map(tone=>tone.frequency)),total=window*1.8;
    // Keep one absolute epoch at the record midpoint; never repeat a generator
    // period or regenerate the source when the user changes the scope window.
    let intervals=Math.max(2400,Math.ceil(total*maxFrequency*32));
    if(intervals%2)intervals++;
    if(intervals>24000)throw new Error('This time base cannot resolve the selected input within 24,000 samples. Reduce TIME/DIV or turn off high-frequency noise.');
    const dt=total/intervals,traces={t:[],ch1:[],ch2:[],gen:[]},responses=new Map();
    const toneResponses=tones.map(tone=>{
      let channels=responses.get(tone.frequency);
      if(!channels){channels=toneResponse(net,state,tone.frequency);responses.set(tone.frequency,channels);}
      const input={re:tone.amplitude*Math.cos(tone.phase),im:tone.amplitude*Math.sin(tone.phase)};
      const multiply=h=>({re:input.re*h.re-input.im*h.im,im:input.re*h.im+input.im*h.re});
      return {...tone,input,channels,phasors:{ch1:multiply(channels.ch1),ch2:multiply(channels.ch2)}};
    });
    for(let i=0;i<=intervals;i++){
      const time=(i-intervals/2)*dt;let source=0,ch1=0,ch2=0;
      for(const tone of toneResponses){
        const angle=2*Math.PI*tone.frequency*time,sine=Math.sin(angle),cosine=Math.cos(angle);
        // Phasors use the sine convention: Im(P exp(jwt)).
        source+=tone.input.re*sine+tone.input.im*cosine;
        ch1+=tone.phasors.ch1.re*sine+tone.phasors.ch1.im*cosine;
        ch2+=tone.phasors.ch2.re*sine+tone.phasors.ch2.im*cosine;
      }
      traces.t.push(time);traces.gen.push(source);traces.ch1.push(ch1);traces.ch2.push(ch2);
    }
    return {traces,dt,window,frequency:signal.frequency,maxFrequency,mixed:tones.length>1,signalMode:signal.mode,toneResponses,warnings:net.warnings,uf:net.uf,channelStatus:net.status,accuracy:{method:'phasor',intervals,samplesPerFastestPeriod:maxFrequency?1/(dt*maxFrequency):null},lastSol:null};
  }
  function solve(state,{window=0.002,sourceAt,signal=null}={}){
    if(signal)return solveSignal(state,window,signal);
    const net=prepare(state);let prev=null,current=null,error=Infinity,count=256;
    for(;count<=16384;count*=2){current=acquisition(net,state,count,sourceAt);if(prev){error=0;let scale=0;for(const ch of ['ch1','ch2']){for(let i=0;i<prev.channels[ch].length;i++){error=Math.max(error,Math.abs(prev.channels[ch][i]-current.channels[ch][i*2]));scale=Math.max(scale,Math.abs(current.channels[ch][i*2]));}}if(error<=1e-5+.002*Math.max(.01,scale))break;}prev=current;}
    if(count>16384)throw new Error('Time resolution did not converge within the calculation budget. Adjust frequency or component values.');
    const period=1/state.generator.frequency,total=Math.max(window*2.4,period*6),samples=Math.min(24000,Math.max(2400,Math.ceil(total/current.dt))),dt=total/samples;
    if(total/period>1500)throw new Error('Too many cycles for this scope time base. Reduce TIME/DIV to resolve the signal.');
    const traces={t:[],ch1:[],ch2:[],gen:[]};
    for(let i=0;i<=samples;i++){const t=i*dt,q=(t/period%1)*count,j=Math.floor(q)%count,f=q-Math.floor(q);traces.t.push(t);traces.gen.push(sourceAt(t,'main'));for(const ch of ['ch1','ch2']){const a=current.channels[ch];traces[ch].push(a[j]*(1-f)+a[(j+1)%count]*f);}}
    return {traces,dt,window,frequency:state.generator.frequency,warnings:net.warnings,uf:net.uf,channelStatus:net.status,accuracy:{periodSteps:count,error},lastSol:null};
  }
  const api={prepare,solve};root.RcEngine=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
