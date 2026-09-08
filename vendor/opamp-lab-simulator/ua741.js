/* UA741CP (PDIP), TI Rev. H top view. Board coordinates are a 90° CCW rotation. */
(function(root){
  'use strict';
  const definitions=[
    [1,'NC','left',0,'#a3b5c4'],[2,'IN−','left',1,'#46cce2'],
    [3,'IN+','left',2,'#46cce2'],[4,'V−','left',3,'#76d7be'],
    [8,'NC','right',0,'#a3b5c4'],[7,'V+','right',1,'#ff9c91'],
    [6,'OUT','right',2,'#f6b657'],[5,'NC','right',3,'#a3b5c4']
  ];
  const pins=Object.freeze(definitions.map(([number,label,side,slot,color])=>Object.freeze({
    number,label,color,package:Object.freeze({side,slot,x:side==='left'?-64:64,y:-60+slot*40}),
    board:Object.freeze({row:side==='left'?'F':'E',half:side==='left'?'B':'T',offset:slot})
  })));
  const nodes=op=>Object.fromEntries(pins.map(pin=>[pin.number,`${pin.board.half}:${op.startCol+pin.board.offset}`]));
  const holes=op=>pins.map(pin=>({pin:pin.number,function:pin.label,hole:{row:pin.board.row,col:op.startCol+pin.board.offset}}));
  // Called only after validation/legacy hole allocation; never mutates its input.
  function reflectLegacyBoard(board){
    const result=JSON.parse(JSON.stringify(board));
    if(!result.components.some(c=>c.type==='opamp'))return result;
    const row={A:'J',B:'I',C:'H',D:'G',E:'F',F:'E',G:'D',H:'C',I:'B',J:'A'};
    const node=n=>typeof n==='string'?n.replace(/^([TB]):/,(_,half)=>(half==='T'?'B':'T')+':'):n;
    const hole=h=>h?{...h,row:row[h.row]||h.row}:h;
    for(const comp of result.components)if(comp.type!=='opamp')for(const end of ['a','b']){
      comp[end]=node(comp[end]);if(comp[end+'Hole'])comp[end+'Hole']=hole(comp[end+'Hole']);
    }
    result.generatorNode=node(result.generatorNode);
    for(const key of ['ttlNode','groundNode'])if(Object.hasOwn(result.generator,key))result.generator[key]=node(result.generator[key]);
    for(const ch of ['ch1','ch2'])for(const end of ['tip','gnd'])result.probes[ch][end]=node(result.probes[ch][end]);
    for(const key of Object.keys(result.leadHoles||{}))result.leadHoles[key]=hole(result.leadHoles[key]);
    return result;
  }
  function guide(rotated){
    const name=rotated?'board':'top',point=(x,y)=>rotated?{x:y,y:-x}:{x,y};
    const title=rotated?'UA741 OpAmp Pin Config':'TOP VIEW';
    const description=rotated?'Top view rotated counterclockwise, notch left. Upper pins left to right: 8 NC, 7 V+, 6 OUT, 5 NC. Lower pins: 1 NC, 2 IN−, 3 IN+, 4 V−.':'Notch at top. Left pins top to bottom: 1 NC, 2 IN−, 3 IN+, 4 V−. Right pins: 8 NC, 7 V+, 6 OUT, 5 NC.';
    const transform=rotated?'rotate(-90)':'';
    const text=(x,y,content,fill='#e4edf3',anchor='middle',extra='')=>`<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}" ${extra}>${content}</text>`;
    let svg=`<svg class="${rotated?'orientation-diagram':'pin-diagram'}" viewBox="-140 -145 280 285" role="img" aria-labelledby="ua741-${name}-title ua741-${name}-description" xmlns="http://www.w3.org/2000/svg"><title id="ua741-${name}-title">${title}</title><desc id="ua741-${name}-description">${description}</desc><g font-family="Inter,system-ui,sans-serif" font-size="11">${text(0,-128,title,'#a3b5c4')}`;
    svg+=`<g transform="${transform}" fill="none" stroke-width="2"><rect x="-64" y="-90" width="128" height="180" rx="8" fill="#0d141c" stroke="#a3b5c4"/><path d="M-14 -90a14 14 0 0 0 28 0" stroke="#a3b5c4"/><circle cx="-50" cy="-77" r="3" fill="#e4edf3" stroke="none"/><path d="M-25 -34v75l61-37Z" stroke="#e4edf3"/>`;
    // Internal schematic connections refer to the canonical pin terminals.
    const paths={2:'M-64 -20H-25',3:'M-64 20H-25',4:'M0 26V60H-64',6:'M36 4H50V20H64',7:'M0 -18V-50H50V-20H64'};
    for(const pin of pins){const {x,y,side}=pin.package;svg+=`<path d="M${x} ${y}h${side==='left'?-22:22}" stroke="${pin.color}"/>`;if(paths[pin.number])svg+=`<path d="${paths[pin.number]}" stroke="${pin.color}"/>`;}
    svg+='</g>';
    for(const [x,y,label] of [[-17,-13,'−'],[-17,27,'+']]){const p=point(x,y);svg+=text(p.x,p.y,label);}
    for(const pin of pins){
      const {side,x,y}=pin.package,inside=point(side==='left'?-53:53,y),outside=point(side==='left'?-97:97,y);
      svg+=text(inside.x,inside.y+4,pin.number,'#e4edf3','middle',`data-pin="${pin.number}" data-row="${pin.board.row}" data-offset="${pin.board.offset}"`);
      if(rotated)svg+=text(outside.x,outside.y+(outside.y<0?-8:12),pin.label,pin.color);
      else svg+=text(outside.x,outside.y+4,pin.label,pin.color,side==='left'?'end':'start');
    }
    svg+=text(0,130,rotated?'Notch left · pin 1 below the gap':'Pin 1 is beside the dot','#a3b5c4')+'</g></svg>';
    return svg;
  }
  root.UA741=Object.freeze({pins,nodes,holes,reflectLegacyBoard,guide,pinoutVersion:2});
  if(typeof document!=='undefined'){
    const host=document.getElementById('ua741Guides');if(host)host.innerHTML=guide(true);
  }
})(globalThis);
