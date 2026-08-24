const phe=require('phe'); const ev=phe.evaluateCardCodes; const C=(r,s)=>r*4+s;
function equityN(hole,board,iters,rand,NP){
  const dead=new Uint8Array(52);for(const c of hole)dead[c]=1;for(const c of board)dead[c]=1;
  const live=[];for(let c=0;c<52;c++)if(!dead[c])live.push(c);
  const nLive=live.length,deck=Int32Array.from(live);
  const need=(NP-1)*2+(5-board.length);
  const hero=[hole[0],hole[1],0,0,0,0,0],opp=[0,0,0,0,0,0,0];
  let win=0,tie=0;
  for(let it=0;it<iters;it++){
    for(let i=0;i<need;i++){const j=i+((rand()*(nLive-i))|0);const t=deck[i];deck[i]=deck[j];deck[j]=t;}
    const full5=[0,0,0,0,0];let bi=0;
    for(let i=0;i<board.length;i++)full5[bi++]=board[i];
    let k=(NP-1)*2;while(bi<5)full5[bi++]=deck[k++];
    for(let i=0;i<5;i++)hero[2+i]=full5[i];
    const hr=ev(hero);let best=hr,tied=0;
    for(let p=0;p<NP-1;p++){opp[0]=deck[p*2];opp[1]=deck[p*2+1];for(let i=0;i<5;i++)opp[2+i]=full5[i];
      const r=ev(opp);if(r<best){best=r;tied=0;}else if(r===best)tied++;}
    if(best===hr){if(tied===0)win++;else tie++;}
  }
  return (win+tie/2)/iters;
}
function rng(s){let x=s>>>0;return()=>((x=(x*1664525+1013904223)>>>0)/4294967296);}
const AA=[C(12,0),C(12,1)], T7o=[C(8,0),C(5,1)], flop=[C(12,2),C(7,3),C(2,0)];
console.log('=== Validation vs published (500k iters) ===');
for(const [l,h,np,pub] of [['AA heads-up',AA,2,'85.2%'],['AA 6-way',AA,6,'~49.2%']])
  console.log(' ',l.padEnd(14),(equityN(h,[],500000,rng(20260824),np)*100).toFixed(2)+'%','| published',pub);
for(let w=0;w<5;w++) equityN(AA,[],50000,rng(1),6);
console.log('\n=== 6-player preflop MC timing (median of 9, warmed) ===');
console.log('ITERS'.padStart(8),'median'.padStart(11),'per-iter'.padStart(11));
for(const iters of [100,500,1000,2000,5000,10000,50000,100000]){
  const ts=[];for(let r=0;r<9;r++){const t0=process.hrtime.bigint();equityN(AA,[],iters,rng(r+1),6);const t1=process.hrtime.bigint();ts.push(Number(t1-t0)/1e6);}
  ts.sort((a,b)=>a-b);const m=ts[4];
  console.log(String(iters).padStart(8),(m.toFixed(2)+' ms').padStart(11),((m*1000/iters).toFixed(2)+' us').padStart(11));
}
console.log('\n=== All 5 bots deciding at one decision point (flop) ===');
for(const iters of [500,1000,2000,10000]){
  const ts=[];for(let r=0;r<5;r++){const t0=process.hrtime.bigint();for(let b=0;b<5;b++)equityN(T7o,flop,iters,rng(b*101+r),6);const t1=process.hrtime.bigint();ts.push(Number(t1-t0)/1e6);}
  ts.sort((a,b)=>a-b);
  console.log(' 5 bots x',String(iters).padStart(6),'iters =',ts[2].toFixed(2).padStart(7),'ms');
}
console.log('\n=== Accuracy: std-dev across 20 runs (AA 6-way, true ~49.2%) ===');
console.log('ITERS'.padStart(8),'mean'.padStart(9),'std-dev'.padStart(9),'max err'.padStart(9));
for(const iters of [100,500,1000,2000,5000,10000,50000]){
  const v=[];for(let t=0;t<20;t++)v.push(equityN(AA,[],iters,rng(1000+t*7919),6)*100);
  const mean=v.reduce((a,b)=>a+b,0)/v.length;
  const sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/(v.length-1));
  console.log(String(iters).padStart(8),mean.toFixed(2).padStart(8)+'%',sd.toFixed(2).padStart(8)+'%',Math.max(...v.map(x=>Math.abs(x-mean))).toFixed(2).padStart(8)+'%');
}
