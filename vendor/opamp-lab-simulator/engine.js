/* Pure connectivity and MNA primitives shared by both labs. */
(function(root){
  "use strict";
  class UnionFind {
    constructor(){this.p=new Map();}
    add(x){if(!this.p.has(x))this.p.set(x,x);}
    find(x){this.add(x);let p=this.p.get(x);if(p!==x){p=this.find(p);this.p.set(x,p);}return p;}
    union(a,b){a=this.find(a);b=this.find(b);if(a!==b)this.p.set(b,a);}
  }

  function gaussianSolve(A,b){
    const n=b.length; const M=A.map((r,i)=>r.slice().concat([b[i]]));
    for(let k=0;k<n;k++){
      let p=k,max=Math.abs(M[k][k]);
      for(let i=k+1;i<n;i++){const v=Math.abs(M[i][k]);if(v>max){max=v;p=i;}}
      if(max<1e-13) throw new Error('Circuit matrix is singular. Check for floating nodes, shorted voltage sources, or missing return paths.');
      if(p!==k){const tmp=M[k];M[k]=M[p];M[p]=tmp;}
      const pivot=M[k][k]; for(let j=k;j<=n;j++)M[k][j]/=pivot;
      for(let i=0;i<n;i++)if(i!==k){const f=M[i][k]; if(Math.abs(f)<1e-18)continue; for(let j=k;j<=n;j++)M[i][j]-=f*M[k][j];}
    }
    return M.map(r=>r[n]);
  }


  root.CircuitEngine={UnionFind,gaussianSolve};
  if(typeof module!=="undefined")module.exports=root.CircuitEngine;
})(globalThis);
