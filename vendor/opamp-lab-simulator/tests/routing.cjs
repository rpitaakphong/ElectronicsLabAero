const assert=require('node:assert/strict');
require('../routing.js');
const {routeAll,hit,crossing}=globalThis.WireRouting;
const bounds={left:0,right:200,top:0,bottom:160};
const wire={id:'W1',a:{x:10,y:80},b:{x:190,y:80}};
const obstacle={left:80,right:120,top:40,bottom:120};
const originals=JSON.stringify([wire,obstacle]);
const routed=routeAll([wire],[obstacle],bounds).get('W1');
assert.equal(routed.fallback,false);
assert.deepEqual(routed.points[0],wire.a);assert.deepEqual(routed.points.at(-1),wire.b);
for(let i=1;i<routed.points.length;i++){
 const a=routed.points[i-1],b=routed.points[i];assert(a.x===b.x||a.y===b.y);
 for(let t=0;t<=1;t+=.01){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;assert(!(x>80&&x<120&&y>40&&y<120));}
 assert(hit(routed.points,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},1));
}
assert(!hit(routed.points,{x:100,y:80},1));
assert.equal(JSON.stringify([wire,obstacle]),originals);
assert.deepEqual(routeAll([wire],[obstacle],bounds).get('W1'),routed);
const dense=routeAll([wire],[{left:20,right:180,top:0,bottom:160}],bounds).get('W1');
assert(dense.fallback);assert.deepEqual(dense.points[0],wire.a);assert.deepEqual(dense.points.at(-1),wire.b);
const a={x:0,y:80},b={x:200,y:80},c={x:100,y:0},d={x:100,y:160};
assert.deepEqual(crossing(a,b,c,d),{x:100,y:80});assert.equal(crossing(a,b,{x:0,y:0},{x:0,y:160}),null);
const crossRoutes=routeAll([{id:'h',a,b},{id:'v',a:c,b:d}],[],bounds);
assert(crossRoutes.get('v').bridges.length>0);
const pair=routeAll([wire,{id:'W2',a:{x:10,y:90},b:{x:190,y:90}}],[],bounds);
assert(!pair.get('W1').fallback&&!pair.get('W2').fallback);
assert.notDeepEqual(pair.get('W1').points,pair.get('W2').points);
// Interior endpoints leave room for a detour, but wires should still cross
// directly instead of treating the first wire as a wall (the reported bug).
const interior=[
 {id:'horizontal',a:{x:20,y:80},b:{x:180,y:80}},
 {id:'vertical',a:{x:100,y:20},b:{x:100,y:140}}
];
const direct=routeAll(interior,[],bounds);
for(const connection of interior)assert.deepEqual(direct.get(connection.id).points,[connection.a,connection.b]);
assert.deepEqual(direct.get('vertical').bridges,[{x:100,y:80,segment:1}]);
// Crossing remains possible when the same route must also avoid a component.
const body={left:80,right:120,top:95,bottom:115};
const mixed=routeAll(interior,[body],bounds);
assert.deepEqual([...mixed], [...routeAll(interior,[body],bounds)]);
assert(mixed.get('vertical').bridges.length>0);
for(const connection of interior){
 const r=mixed.get(connection.id);
 assert(!r.fallback);assert.deepEqual(r.points[0],connection.a);assert.deepEqual(r.points.at(-1),connection.b);
 for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i];
  assert(hit(r.points,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},1));
  for(let t=0;t<=1;t+=.005){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;assert(!(x>=body.left&&x<=body.right&&y>=body.top&&y<=body.bottom));}
 }
}
console.log('PASS: routing endpoints, obstacle avoidance, deterministic geometry, hit testing, crossings, separate lanes, dense fallback, immutable inputs');
