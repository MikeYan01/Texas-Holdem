const {evaluate7}=require('./myeval'); const phe=require('phe'); const ev=phe.evaluateCardCodes;
function rng(s){let x=s>>>0;return()=>((x=(x*1664525+1013904223)>>>0)/4294967296);}
const r=rng(5),H=[];
for(let i=0;i<300000;i++){const h=[],u=new Set();while(h.length<7){const c=(r()*52)|0;if(!u.has(c)){u.add(c);h.push(c);}}H.push(h);}
function t(fn){for(let i=0;i<20000;i++)fn(H[i]);const a=process.hrtime.bigint();
 for(let i=0;i<H.length;i++)fn(H[i]);const b=process.hrtime.bigint();return Number(b-a)/1e6;}
const m=t(evaluate7), p=t(ev);
console.log('hand-written evaluate7:',(H.length/(m/1000)/1e6).toFixed(2),'M evals/s (',(m*1e6/H.length).toFixed(0),'ns )');
console.log('phe evaluateCardCodes :',(H.length/(p/1000)/1e6).toFixed(2),'M evals/s (',(p*1e6/H.length).toFixed(0),'ns )');
console.log('phe is',(m/p).toFixed(1)+'x faster');
