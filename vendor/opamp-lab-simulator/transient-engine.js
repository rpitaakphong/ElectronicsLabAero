/* Pure linear RC stepping primitives shared with the op-amp transient solver. */
(function(root){
  'use strict';
  function stampG(A,ni,ground,a,b,g){if(a!==ground)A[ni.get(a)][ni.get(a)]+=g;if(b!==ground)A[ni.get(b)][ni.get(b)]+=g;if(a!==ground&&b!==ground){A[ni.get(a)][ni.get(b)]-=g;A[ni.get(b)][ni.get(a)]-=g;}}
  function stampI(rhs,ni,ground,a,b,i){if(a!==ground)rhs[ni.get(a)]-=i;if(b!==ground)rhs[ni.get(b)]+=i;}
  function stampCapacitor(A,rhs,ni,ground,cap,dt,previous){const g=cap.value/dt;stampG(A,ni,ground,cap.a,cap.b,g);stampI(rhs,ni,ground,cap.a,cap.b,-g*previous);}
  function factorize(matrix){
    const A=matrix.map(r=>r.slice()),n=A.length,pivots=[];
    for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(A[i][k])>Math.abs(A[p][k]))p=i;if(!Number.isFinite(A[p][k])||Math.abs(A[p][k])<1e-15)throw new Error('Circuit has an undefined voltage or conflicting ideal sources. Check return paths and grounded leads.');pivots.push(p);[A[k],A[p]]=[A[p],A[k]];for(let i=k+1;i<n;i++){A[i][k]/=A[k][k];for(let j=k+1;j<n;j++)A[i][j]-=A[i][k]*A[k][j];}}
    return rhs=>{const b=rhs.slice();for(let k=0;k<n;k++){const p=pivots[k];[b[k],b[p]]=[b[p],b[k]];}for(let i=0;i<n;i++)for(let j=0;j<i;j++)b[i]-=A[i][j]*b[j];for(let i=n-1;i>=0;i--){for(let j=i+1;j<n;j++)b[i]-=A[i][j]*b[j];b[i]/=A[i][i];if(!Number.isFinite(b[i]))throw new Error('Circuit calculation did not converge.');}return b;};
  }
  const api={stampG,stampI,stampCapacitor,factorize};root.TransientEngine=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
