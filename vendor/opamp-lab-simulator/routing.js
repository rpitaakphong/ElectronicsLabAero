/* Visual-only orthogonal routing. Electrical topology never enters this module. */
(function (root) {
  'use strict';
  const simplify = points => points.filter((p, i) => !i || i === points.length - 1 ||
    !((points[i - 1].x === p.x && p.x === points[i + 1].x) ||
      (points[i - 1].y === p.y && p.y === points[i + 1].y)));
  class Heap {
    constructor() { this.items = []; this.order = 0; }
    push(id, cost, score) {
      const item = { id, cost, score, order: this.order++ }, a = this.items;
      let i = a.length; a.push(item);
      while (i) { const p = (i - 1) >> 1; if (!this.less(item, a[p])) break; a[i] = a[p]; i = p; } a[i] = item;
    }
    less(a, b) { return a.score < b.score || (a.score === b.score && a.order < b.order); }
    pop() {
      const a = this.items, first = a[0], last = a.pop();
      if (a.length) { let i = 0; while (i * 2 + 1 < a.length) { let c = i * 2 + 1; if (c + 1 < a.length && this.less(a[c + 1], a[c])) c++; if (!this.less(a[c], last)) break; a[i] = a[c]; i = c; } a[i] = last; }
      return first;
    }
  }
  function crossing(a, b, c, d) {
    if ((a.x === b.x) === (c.x === d.x)) return null;
    const v = a.x === b.x ? [a,b] : [c,d], h = a.x === b.x ? [c,d] : [a,b];
    const p = {x:v[0].x,y:h[0].y};
    return p.x > Math.min(h[0].x,h[1].x)+5 && p.x < Math.max(h[0].x,h[1].x)-5 &&
      p.y > Math.min(v[0].y,v[1].y)+5 && p.y < Math.max(v[0].y,v[1].y)-5 ? p : null;
  }
  function hit(points, p, tolerance = 10) {
    return points.some((b, i) => {
      if (!i) return false;
      const a = points[i-1], dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<=tolerance;
    });
  }
  function routePass(connections, obstacles = [], bounds = {left:65,right:1130,top:45,bottom:575}) {
    // Common grid contains exact terminals and obstacle boundaries, plus 16px lanes.
    const xx = new Set([bounds.left,bounds.right]), yy = new Set([bounds.top,bounds.bottom]);
    for(let x=bounds.left;x<=bounds.right;x+=16)xx.add(x);
    for(let y=bounds.top;y<=bounds.bottom;y+=16)yy.add(y);
    for(const r of connections) { for(const p of [r.a,r.b]) { xx.add(p.x);yy.add(p.y); } }
    for(const o of obstacles) { for(const x of [o.left-2,o.left,o.right,o.right+2])if(x>=bounds.left&&x<=bounds.right)xx.add(x); for(const y of [o.top-2,o.top,o.bottom,o.bottom+2])if(y>=bounds.top&&y<=bounds.bottom)yy.add(y); }
    const xs=[...xx].sort((a,b)=>a-b),ys=[...yy].sort((a,b)=>a-b),nx=xs.length,ny=ys.length,n=nx*ny;
    const xIndex=new Map(xs.map((x,i)=>[x,i])),yIndex=new Map(ys.map((y,i)=>[y,i]));
    const horizontal=new Uint16Array(n),vertical=new Uint16Array(n),edgeUse=new Map(),routes=new Map();
    const edgeKey=(a,b)=>Math.min(a,b)*n+Math.max(a,b);
    const index=p=>yIndex.get(p.y)*nx+xIndex.get(p.x);
    for(const connection of connections) {
      const {a,b,id}=connection, start=index(a),goal=index(b), blocked=new Uint8Array(n);
      for(const o of obstacles) {
        if(o.owner===id || (o.terminal && [a,b].some(p=>p.x>=o.left&&p.x<=o.right&&p.y>=o.top&&p.y<=o.bottom)))continue;
        for(let y=0;y<ny;y++)if(ys[y]>=o.top&&ys[y]<=o.bottom)
          for(let x=0;x<nx;x++)if(xs[x]>=o.left&&xs[x]<=o.right)blocked[y*nx+x]=1;
      }
      // A bend or an unrelated endpoint is not an electrical junction.
      for(const route of routes.values())for(const p of route.points){
        if([a,b].some(q=>q.x===p.x&&q.y===p.y))continue;
        for(let y=0;y<ny;y++)if(Math.abs(ys[y]-p.y)<=8)
          for(let x=0;x<nx;x++)if(Math.abs(xs[x]-p.x)<=8)blocked[y*nx+x]=1;
      }
      blocked[start]=0;blocked[goal]=0;
      const distance=new Float64Array(n*2);distance.fill(Infinity);
      const parent=new Int32Array(n*2);parent.fill(-1);
      const heap=new Heap();
      const estimate=v=>Math.abs(xs[v%nx]-b.x)+Math.abs(ys[Math.floor(v/nx)]-b.y);
      for(let dir=0;dir<2;dir++){distance[start*2+dir]=0;heap.push(start*2+dir,0,estimate(start));}
      let final=-1;
      while(heap.items.length) {
        const current=heap.pop(),state=current.id;
        if(current.cost!==distance[state])continue;
        const v=state>>1,oldDir=state%2;
        if(v===goal){final=state;break;}
        const x=v%nx,y=Math.floor(v/nx);
        for(const [dx,dy,dir] of [[1,0,0],[0,1,1],[-1,0,0],[0,-1,1]]) {
          const tx=x+dx,ty=y+dy;if(tx<0||tx>=nx||ty<0||ty>=ny)continue;
          const to=ty*nx+tx;if(blocked[to])continue;
          // Cross a straight segment without turning on it (which looks like a junction).
          if(v!==start&&oldDir!==dir&&(horizontal[v]||vertical[v]))continue;
          const length=Math.abs(xs[tx]-xs[x])+Math.abs(ys[ty]-ys[y]);
          const cost=current.cost+length+(oldDir!==dir?24:0)+(edgeUse.get(edgeKey(v,to))||0)*(length*5+30)+
            // A crossing is allowed; a small cost favors equally short, clearer paths.
            (dir===0?vertical[to]:horizontal[to])*8;
          const next=to*2+dir;if(cost>=distance[next])continue;
          distance[next]=cost;parent[next]=state;heap.push(next,cost,cost+estimate(to));
        }
      }
      let raw=[],fallback=final<0;
      if(fallback)raw=[a,{x:b.x,y:a.y},b].filter((p,i,arr)=>!i||p.x!==arr[i-1].x||p.y!==arr[i-1].y);
      else {
        for(let state=final;state>=0;state=parent[state]){const v=state>>1;raw.push({x:xs[v%nx],y:ys[Math.floor(v/nx)]});}
        raw.reverse();
        for(let i=1;i<raw.length;i++) {
          const from=index(raw[i-1]),to=index(raw[i]),key=edgeKey(from,to);
          edgeUse.set(key,(edgeUse.get(key)||0)+1);
          const axis=raw[i].y===raw[i-1].y?horizontal:vertical;axis[from]++;axis[to]++;
        }
      }
      const points=simplify(raw), bridges=[];
      for(let i=1;i<points.length;i++)for(const previous of routes.values())for(let j=1;j<previous.points.length;j++){
        const p=crossing(points[i-1],points[i],previous.points[j-1],previous.points[j]);
        if(p&&!bridges.some(q=>q.segment===i&&Math.hypot(q.x-p.x,q.y-p.y)<10))bridges.push({...p,segment:i});
      }
      routes.set(id,{points,bridges,fallback});
    }
    return routes;
  }
  function routeAll(connections,obstacles=[],bounds={left:65,right:1130,top:45,bottom:575}) {
    // Wires are soft routing costs, not obstacles. Components and their leads
    // remain hard obstacles even when crossing another wire gives a shorter path.
    return routePass(connections,obstacles,bounds);
  }
  root.WireRouting={routeAll,hit,crossing};
  if(typeof module!=='undefined')module.exports=root.WireRouting;
})(globalThis);
