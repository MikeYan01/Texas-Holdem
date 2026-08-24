const {evaluate7}=require('./myeval'); const phe=require('phe'); const ev=phe.evaluateCardCodes;
// Published 7-card frequencies from decs/texas README (Two Plus Two lookup table)
const EXPECT={'High Card':23294460,'One Pair':58627800,'Two Pairs':31433400,'Three of a Kind':6461620,
 'Straight':6180020,'Flush':4047644,'Full House':3473184,'Four of a Kind':224848,'Straight Flush':41584};
const NAMES=['High Card','One Pair','Two Pairs','Three of a Kind','Straight','Flush','Full House','Four of a Kind','Straight Flush'];
const fMine=new Float64Array(9), fPhe=new Float64Array(9);
const pheToIdx=[8,7,6,5,4,3,2,1,0];
const hand=new Int32Array(7); let n=0; const t0=Date.now();
for(let a=0;a<52;a++)for(let b=a+1;b<52;b++)for(let c=b+1;c<52;c++)for(let d=c+1;d<52;d++)
for(let e=d+1;e<52;e++)for(let f=e+1;f<52;f++)for(let g=f+1;g<52;g++){
  hand[0]=a;hand[1]=b;hand[2]=c;hand[3]=d;hand[4]=e;hand[5]=f;hand[6]=g;
  fMine[evaluate7(hand)>>20]++; fPhe[pheToIdx[phe.handRank(ev(hand))]]++; n++;
}
console.log('Enumerated all C(52,7) =',n.toLocaleString(),'hands in',((Date.now()-t0)/1000).toFixed(1),'s\n');
console.log('CATEGORY'.padEnd(18),'MINE'.padStart(12),'PHE'.padStart(12),'PUBLISHED'.padStart(12),'  MATCH');
let ok=true;
for(let i=8;i>=0;i--){const nm=NAMES[i],m=fMine[i],p=fPhe[i],x=EXPECT[nm];const g=(m===x&&p===x);if(!g)ok=false;
  console.log(nm.padEnd(18),String(m).padStart(12),String(p).padStart(12),String(x).padStart(12),'  '+(g?'OK':'MISMATCH'));}
console.log('\nTOTAL'.padEnd(18),String(n).padStart(12));
console.log(ok?'>>> ALL CATEGORY FREQUENCIES MATCH PUBLISHED VALUES EXACTLY':'>>> MISMATCH');
