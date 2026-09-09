/* Linear periodic operating point of the actual wired RC network. No gmin or powered rails. */
(function(root){
  'use strict';
  const {UnionFind}=root.CircuitEngine||(typeof require==='function'?require('./engine.js'):{});
  const {stampG,stampI,factorize}=root.TransientEngine||(typeof require==='function'?require('./transient-engine.js'):{});
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const mv=(A,x)=>A.map(r=>dot(r,x));
  const mm=(A,B)=>A.map(row=>B[0].map((_,j)=>row.reduce((s,v,k)=>s+v*B[k][j],0)));
  function power(A,n){let p=A.map((row,i)=>row.map((_,j)=>+(i===j))),b=A;while(n){if(n%2)p=mm(p,b);n=Math.floor(n/2);if(n)b=mm(b,b);}return p;}
  function prepare(state){
    const uf=new UnionFind(),warnings=[],plain=new UnionFind(),ground='RC:EARTH';uf.add(ground);
    for(const c of state.components){uf.add(c.a);uf.add(c.b);plain.add(c.a);plain.add(c.b);if(c.type==='wire'){uf.union(c.a,c.b);plain.union(c.a,c.b);}}
    const grounds=[state.generator.groundNode,...['ch1','ch2'].map(ch=>state.probes[ch].gnd)].filter(Boolean);
    if(grounds.length>1&&grounds.some(g=>plain.find(g)!==plain.find(grounds[0])))warnings.push('Generator and scope ground clips are common. These connections join different breadboard nets and may bypass components.');
    for(const g of grounds)uf.union(g,ground);
    const g=uf.find(ground),r=n=>uf.find(n),parts=state.components.filter(c=>c.type!=='wire').map(c=>({...c,a:r(c.a),b:r(c.b)}));
    for(const c of parts)if(c.a===c.b)warnings.push(`${c.id}: both terminals share one net; the component is bypassed.`);
    const active=state.generator.powered&&state.generator.output&&state.generator.groundNode!=null;
    const sources=[];
    if(active&&state.generatorNode){const internal='RC:MAIN:INTERNAL';parts.push({id:'RC:SOURCE-R',type:'resistor',a:internal,b:r(state.generatorNode),value:50});sources.push({a:internal,b:g,port:'main'});if(r(state.generatorNode)===g)warnings.push('MAIN is shorted to instrument ground. Its 50 Ω source resistance limits current; the terminal voltage is zero.');}
    if(active&&state.generator.ttl&&state.generator.ttlNode){const a=r(state.generator.ttlNode);if(a===g)throw new Error('TTL is an ideal source shorted to instrument ground. Move its lead or ground clip.');sources.push({a,b:g,port:'ttl'});}
    if(state.generator.termination&&state.generatorNode&&state.generator.groundNode)parts.push({id:'RC:TERMINATION',type:'resistor',a:r(state.generatorNode),b:g,value:50});
    if(!state.generatorNode&&!state.generator.ttlNode)warnings.push('Connect the generator output and return to your circuit.');
    if(!state.generator.groundNode)warnings.push('Generator return is disconnected.');
    if(!state.generator.powered||!state.generator.output)warnings.push('Generator output is off; its outputs are disconnected.');
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
  function solve(state,{window=0.002,sourceAt}={}){
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
