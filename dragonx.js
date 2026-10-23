// DRAGON-X 120 Pattern Analysis Engine
// Historical sequence analysis only. It does not generate future betting picks.
const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));
const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const entropy = counts => {
  const n = counts.reduce((a,b)=>a+b,0);
  if (!n) return null;
  return -counts.filter(x=>x>0).reduce((s,c)=>{const p=c/n; return s+p*Math.log2(p)},0);
};
const countMap = a => { const m = new Map(); for (const x of a) m.set(String(x),(m.get(String(x))||0)+1); return m; };
const transitions = a => {
  const m = new Map();
  for(let i=1;i<a.length;i++){const k=String(a[i-1])+"→"+String(a[i]);m.set(k,(m.get(k)||0)+1);}
  return [...m.entries()].sort((x,y)=>y[1]-x[1]).map(([transition,count])=>({transition,count}));
};
const streaks = a => {
  const out=[]; let start=0;
  for(let i=1;i<=a.length;i++){if(i===a.length || a[i]!==a[start]){out.push({value:a[start],length:i-start,start,end:i-1});start=i;}}
  return out;
};
const repeatRate = (a,k) => {
  if(a.length<k*2) return null;
  let matches=0,total=0;
  for(let i=k;i<a.length;i++){ total++; if(a[i]===a[i-k]) matches++; }
  return total ? matches/total : null;
};
const lagCorrelation = (a,lag) => {
  if(a.length<=lag+2) return null;
  const vals=[...new Set(a)];
  if(vals.length!==2) return null;
  const enc=a.map(x=>x===vals[0]?0:1);
  const x=enc.slice(lag), y=enc.slice(0,-lag);
  const mx=mean(x), my=mean(y);
  let num=0,dx=0,dy=0;
  for(let i=0;i<x.length;i++){num+=(x[i]-mx)*(y[i]-my);dx+=(x[i]-mx)**2;dy+=(y[i]-my)**2;}
  return dx&&dy ? num/Math.sqrt(dx*dy) : null;
};
const longestRun = a => Math.max(0,...streaks(a).map(s=>s.length));
const alternationRate = a => a.length<2 ? null : a.slice(1).reduce((s,x,i)=>s+(x!==a[i]?1:0),0)/(a.length-1);
const uniqueRatio = a => a.length ? new Set(a.map(String)).size/a.length : null;
const blockString = (a,start,len) => a.slice(start,start+len).map(String).join("|");
const blockRepeatStats = (a,len) => {
  if(a.length<len*2) return {matches:0,rate:null,uniqueBlocks:0};
  const seen=new Map(); let matches=0,total=0;
  for(let i=0;i+len<=a.length;i++){
    const b=blockString(a,i,len); total++;
    if(seen.has(b)) matches++;
    seen.set(b,(seen.get(b)||0)+1);
  }
  return {matches,rate:total?matches/total:null,uniqueBlocks:seen.size};
};
const positionalBalance = (a) => {
  const m=countMap(a), n=a.length;
  return [...m.entries()].map(([value,count])=>({value,count,share:n?count/n:null})).sort((x,y)=>y.count-x.count);
};
const windowEntropy = (a,w) => {
  if(a.length<w) return null;
  const vals=[...new Set(a.map(String))];
  const es=[];
  for(let i=0;i+w<=a.length;i++){const m=countMap(a.slice(i,i+w));es.push(entropy(vals.map(v=>m.get(v)||0)));}
  return mean(es);
};
const make = (id,name,category,description,fn) => ({id,name,category,description,analyze:fn});
const P=[];
const add=(name,category,description,fn)=>P.push(make(`DX${String(P.length+1).padStart(3,"0")}`,name,category,description,fn));
const nmin=n=>a=>a.length<n?null:true;

// 1-15 frequency and distribution
add("Symbol frequency","distribution","Counts of each observed symbol.",a=>({counts:positionalBalance(a)}));
add("Unique-symbol ratio","distribution","Share of distinct symbols in the sequence.",a=>({value:uniqueRatio(a)}));
add("Shannon entropy","distribution","Overall sequence diversity in bits.",a=>({bits:entropy([...countMap(a).values()])}));
add("Normalized entropy","distribution","Entropy scaled against the number of observed symbols.",a=>{const e=entropy([...countMap(a).values()]),k=new Set(a.map(String)).size;return {value:e===null||k<=1?null:e/Math.log2(k)}});
add("Dominant-symbol share","distribution","Share occupied by the most common symbol.",a=>({value:a.length?Math.max(...countMap(a).values())/a.length:null}));
add("Rare-symbol count","distribution","Number of symbols appearing once.",a=>({value:[...countMap(a).values()].filter(x=>x===1).length}));
add("Frequency imbalance","distribution","Difference between highest and lowest symbol shares.",a=>{const c=[...countMap(a).values()];return {value:a.length&&c.length?(Math.max(...c)-Math.min(...c))/a.length:null}});
add("First-half vs second-half distribution","distribution","Compares symbol shares in two equal sequence halves.",a=>{const h=Math.floor(a.length/2),m1=countMap(a.slice(0,h)),m2=countMap(a.slice(h));return {first:Object.fromEntries(m1),second:Object.fromEntries(m2)}});
add("Rolling entropy (window 5)","distribution","Mean entropy over five-item windows.",a=>({value:windowEntropy(a,5)}));
add("Rolling entropy (window 10)","distribution","Mean entropy over ten-item windows.",a=>({value:windowEntropy(a,10)}));
add("Rolling entropy (window 20)","distribution","Mean entropy over twenty-item windows.",a=>({value:windowEntropy(a,20)}));
add("Distribution drift","distribution","Total-variation distance between sequence halves.",a=>{const h=Math.floor(a.length/2);if(h<1)return {value:null};const x=countMap(a.slice(0,h)),y=countMap(a.slice(h)),keys=new Set([...x.keys(),...y.keys()]);let d=0;for(const k of keys)d+=Math.abs((x.get(k)||0)/h-(y.get(k)||0)/(a.length-h));return {value:d/2}});
add("Window unique ratio (5)","distribution","Mean distinct-symbol ratio in five-item windows.",a=>{if(a.length<5)return {value:null};let z=[];for(let i=0;i<=a.length-5;i++)z.push(uniqueRatio(a.slice(i,i+5)));return {value:mean(z)}});
add("Window unique ratio (10)","distribution","Mean distinct-symbol ratio in ten-item windows.",a=>{if(a.length<10)return {value:null};let z=[];for(let i=0;i<=a.length-10;i++)z.push(uniqueRatio(a.slice(i,i+10)));return {value:mean(z)}});
add("Empirical symbol distribution","distribution","Empirical probability of each observed symbol.",a=>({probabilities:Object.fromEntries([...countMap(a)].map(([k,v])=>[k,a.length?v/a.length:0]))}));

// 16-30 runs and alternation
add("Streak summary","runs","Lengths and values of consecutive runs.",a=>({streaks:streaks(a)}));
add("Longest streak","runs","Length of the longest same-symbol run.",a=>({value:longestRun(a)}));
add("Mean streak length","runs","Average run length.",a=>({value:mean(streaks(a).map(s=>s.length))}));
add("Streak count","runs","Number of runs in the sequence.",a=>({value:streaks(a).length}));
add("Single-item runs","runs","Count of runs with length one.",a=>({value:streaks(a).filter(s=>s.length===1).length}));
add("Long-run share (>=3)","runs","Share of items belonging to runs of length at least three.",a=>({value:a.length?streaks(a).filter(s=>s.length>=3).reduce((s,x)=>s+x.length,0)/a.length:null}));
add("Alternation rate","runs","Share of adjacent pairs whose symbols differ.",a=>({value:alternationRate(a)}));
add("Same-symbol adjacency rate","runs","Share of adjacent pairs with matching symbols.",a=>({value:a.length<2?null:1-alternationRate(a)}));
add("Run-length variance","runs","Variance of observed run lengths.",a=>{const r=streaks(a).map(s=>s.length),m=mean(r);return {value:m===null?null:mean(r.map(x=>(x-m)**2))}});
add("Current trailing streak","runs","Length of the final observed run.",a=>({value:a.length?streaks(a).slice(-1)[0].length:0,symbol:a.length?a[a.length-1]:null}));
add("Run-length histogram","runs","Counts of runs by length.",a=>{const m=countMap(streaks(a).map(s=>s.length));return {histogram:Object.fromEntries(m)}});
add("A-B alternation pattern count","runs","Counts alternating adjacent symbols, for binary sequences only.",a=>({value:new Set(a.map(String)).size===2?a.slice(1).reduce((s,x,i)=>s+(x!==a[i]?1:0),0):null}));
add("Longest alternating segment","runs","Longest segment with every adjacent symbol different.",a=>{if(!a.length)return {value:0};let best=1,cur=1;for(let i=1;i<a.length;i++){cur=a[i]!==a[i-1]?cur+1:1;best=Math.max(best,cur)}return {value:best}});
add("Run boundary density","runs","Run boundaries per adjacent pair.",a=>({value:a.length<2?null:(streaks(a).length-1)/(a.length-1)}));
add("Streak growth/decay","runs","Difference between mean streak length in first and second halves.",a=>{const h=Math.floor(a.length/2);if(!h)return {value:null};return {value:mean(streaks(a.slice(h)).map(s=>s.length))-mean(streaks(a.slice(0,h)).map(s=>s.length))}});

// 31-45 transitions / Markov
add("Adjacent transition counts","markov","Counts observed transitions between consecutive symbols.",a=>({transitions:transitions(a)}));
add("Transition diversity","markov","Number of unique adjacent transition types.",a=>({value:new Set(a.slice(1).map((x,i)=>String(a[i])+"→"+String(x))).size}));
add("Transition entropy","markov","Entropy of observed transition types.",a=>({bits:entropy([...countMap(a.slice(1).map((x,i)=>String(a[i])+"→"+String(x))).values()])}));
add("Self-transition rate","markov","Rate at which a symbol is followed by itself.",a=>({value:a.length<2?null:a.slice(1).reduce((s,x,i)=>s+(x===a[i]?1:0),0)/(a.length-1)}));
add("Transition matrix","markov","Row-normalized empirical transition matrix.",a=>{const syms=[...new Set(a.map(String))],m={};for(const x of syms){const row={};for(const y of syms)row[y]=0;m[x]=row;}for(let i=1;i<a.length;i++)m[String(a[i-1])][String(a[i])]++;for(const x of syms){const n=Object.values(m[x]).reduce((s,v)=>s+v,0);for(const y of syms)m[x][y]=n?m[x][y]/n:null;}return {matrix:m}});
add("Transition count by source","markov","Counts outgoing transitions for each source symbol.",a=>{const m={};for(let i=1;i<a.length;i++){const x=String(a[i-1]);m[x]=(m[x]||0)+1;}return {counts:m}});
add("Transition count by destination","markov","Counts incoming transitions for each destination symbol.",a=>{const m={};for(let i=1;i<a.length;i++){const x=String(a[i]);m[x]=(m[x]||0)+1;}return {counts:m}});
add("Markov order-2 contexts","markov","Counts observed two-symbol contexts and following symbols.",a=>{const m={};for(let i=2;i<a.length;i++){const k=String(a[i-2])+"|"+String(a[i-1]);m[k]??={};m[k][String(a[i])]=(m[k][String(a[i])]||0)+1;}return {contexts:m}});
add("Markov order-3 contexts","markov","Counts observed three-symbol contexts and following symbols.",a=>{const m={};for(let i=3;i<a.length;i++){const k=a.slice(i-3,i).map(String).join("|");m[k]??={};m[k][String(a[i])]=(m[k][String(a[i])]||0)+1;}return {contexts:m}});
add("Lag-1 binary correlation","markov","Lag-one correlation for sequences with exactly two symbols.",a=>({value:lagCorrelation(a,1)}));
add("Lag-2 binary correlation","markov","Lag-two correlation for sequences with exactly two symbols.",a=>({value:lagCorrelation(a,2)}));
add("Lag-3 binary correlation","markov","Lag-three correlation for sequences with exactly two symbols.",a=>({value:lagCorrelation(a,3)}));
add("Lag-4 binary correlation","markov","Lag-four correlation for sequences with exactly two symbols.",a=>({value:lagCorrelation(a,4)}));
add("Lag-5 binary correlation","markov","Lag-five correlation for sequences with exactly two symbols.",a=>({value:lagCorrelation(a,5)}));
add("Markov context coverage","markov","Fraction of possible observed contexts that have at least two samples.",a=>{const m=new Map();for(let i=1;i<a.length;i++){const k=String(a[i-1]);m.set(k,(m.get(k)||0)+1)}return {value:m.size? [...m.values()].filter(v=>v>=2).length/m.size:null}});

// 46-60 repetition / periodicity
for (let k=1;k<=10;k++) add(`Lag-${k} repeat rate`,"repeat",`Share of items matching the item ${k} positions earlier.`,a=>({value:repeatRate(a,k)}));
for (let k=2;k<=6;k++) add(`Repeated block scan (${k})`,"repeat",`Counts repeated contiguous blocks of length ${k}.`,a=>blockRepeatStats(a,k));
add("Most common pair","repeat","Most frequent adjacent pair.",a=>{const m=countMap(a.slice(1).map((x,i)=>String(a[i])+"|"+String(x)));const z=[...m].sort((x,y)=>y[1]-x[1])[0];return {pair:z?z[0]:null,count:z?z[1]:0}});
add("Most common triple","repeat","Most frequent adjacent triple.",a=>{const m=countMap(a.slice(2).map((x,i)=>String(a[i])+"|"+String(a[i+1])+"|"+String(x)));const z=[...m].sort((x,y)=>y[1]-x[1])[0];return {triple:z?z[0]:null,count:z?z[1]:0}});
add("Exact half-sequence match","repeat","Checks whether two equal-length halves match exactly.",a=>{const h=Math.floor(a.length/2);return {matches:h>0&&a.length%2===0&&a.slice(0,h).every((x,i)=>x===a[h+i])}});
add("Periodicity scan (period 2-12)","repeat","Measures repeat agreement at candidate periods.",a=>({periods:Array.from({length:11},(_,i)=>i+2).map(k=>({period:k,rate:repeatRate(a,k)}))}));

// 61-75 zigzag / local shapes
add("Zigzag score","zigzag","Adjacent-change rate; a descriptive measure, not a forecast.",a=>({value:alternationRate(a)}));
add("Zigzag segment lengths","zigzag","Lengths of uninterrupted change-alternating segments.",a=>{if(a.length<3)return {segments:[]};const out=[];let start=0,lastDir=a[1]===a[0]?0:1;for(let i=2;i<a.length;i++){const dir=a[i]===a[i-1]?0:1;if(dir===lastDir){out.push({start,end:i-1,length:i-start});start=i-1;}lastDir=dir;}out.push({start,end:a.length-1,length:a.length-start});return {segments:out}});
add("Up/down-like direction changes","zigzag","Counts changes between equality and inequality states.",a=>{const d=a.slice(1).map((x,i)=>x===a[i]?"same":"change");return {changes:d.slice(1).reduce((s,x,i)=>s+(x!==d[i]?1:0),0)}});
add("Pair alternation counts","zigzag","Counts symbol pairs that alternate in the observed order.",a=>({value:a.length<2?0:a.slice(1).reduce((s,x,i)=>s+(x!==a[i]?1:0),0)}));
add("Alternation by window 5","zigzag","Mean alternation rate across five-item windows.",a=>{if(a.length<5)return {value:null};let z=[];for(let i=0;i<=a.length-5;i++)z.push(alternationRate(a.slice(i,i+5)));return {value:mean(z)}});
add("Alternation by window 10","zigzag","Mean alternation rate across ten-item windows.",a=>{if(a.length<10)return {value:null};let z=[];for(let i=0;i<=a.length-10;i++)z.push(alternationRate(a.slice(i,i+10)));return {value:mean(z)}});
add("Alternation drift","zigzag","Difference between recent and earlier alternation rates.",a=>{const h=Math.floor(a.length/2);return {value:h<2?null:alternationRate(a.slice(h))-alternationRate(a.slice(0,h))}});
add("Repeated alternation motifs","zigzag","Counts occurrences of alternating binary motifs of lengths 3-8.",a=>{if(new Set(a.map(String)).size!==2)return {counts:{}};const out={};for(let k=3;k<=8;k++){let c=0;for(let i=0;i+k<=a.length;i++){let ok=true;for(let j=1;j<k;j++)if(a[i+j]===a[i+j-1])ok=false;if(ok)c++;}out[k]=c;}return {counts:out}});
add("Same-symbol pair count","zigzag","Counts adjacent equal pairs.",a=>({value:a.length<2?0:a.slice(1).reduce((s,x,i)=>s+(x===a[i]?1:0),0)}));
add("Change burst count","zigzag","Counts runs of at least two consecutive changes.",a=>{const d=a.slice(1).map((x,i)=>x!==a[i]);let c=0;for(let i=0;i<d.length;){if(d[i]){let j=i;while(j<d.length&&d[j])j++;if(j-i>=2)c++;i=j;}else i++;}return {value:c}});
add("Repeat burst count","zigzag","Counts runs of at least two consecutive same-symbol transitions.",a=>{const d=a.slice(1).map((x,i)=>x===a[i]);let c=0;for(let i=0;i<d.length;){if(d[i]){let j=i;while(j<d.length&&d[j])j++;if(j-i>=2)c++;i=j;}else i++;}return {value:c}});
add("Triple shape distribution","zigzag","Counts triples as all-same, first-two-same, last-two-same or all-distinct.",a=>{const m={allSame:0,firstTwoSame:0,lastTwoSame:0,allDistinct:0};for(let i=2;i<a.length;i++){const x=a[i-2],y=a[i-1],z=a[i];if(x===y&&y===z)m.allSame++;else if(x===y)m.firstTwoSame++;else if(y===z)m.lastTwoSame++;else if(x!==y&&y!==z&&x!==z)m.allDistinct++;}return {counts:m}});
add("Local novelty rate","zigzag","Share of items that differ from the previous two-item context.",a=>({value:a.length<3?null:a.slice(2).reduce((s,x,i)=>s+(x!==a[i]&&x!==a[i+1]?1:0),0)/(a.length-2)}));
add("Mirror-pair frequency","zigzag","Frequency of two-symbol mirror pairs AB followed by BA.",a=>{let c=0;for(let i=3;i<a.length;i++)if(a[i-3]===a[i]&&a[i-2]===a[i-1])c++;return {count:c}});
add("Two-step return rate","zigzag","Share of items matching the item two positions earlier.",a=>({value:repeatRate(a,2)}));

// 76-90 dragon repeats / subsequences
for (let k=2;k<=8;k++) add(`Dragon motif frequency (${k})`,"dragon-repeat",`Most common contiguous motif length ${k}.`,a=>{if(a.length<k)return {motif:null,count:0};const m=countMap(Array.from({length:a.length-k+1},(_,i)=>blockString(a,i,k)));const z=[...m].sort((x,y)=>y[1]-x[1])[0];return {motif:z?z[0]:null,count:z?z[1]:0,uniqueMotifs:m.size}});
add("Repeated suffix-prefix overlap","dragon-repeat","Longest match between sequence suffix and prefix.",a=>{let best=0;for(let k=1;k<a.length;k++){if(a.slice(-k).every((x,i)=>x===a[i]))best=k;}return {length:best}});
add("Palindrome subsequence windows","dragon-repeat","Counts contiguous windows that read the same forwards and backwards.",a=>{let c=0;for(let k=3;k<=7;k++)for(let i=0;i+k<=a.length;i++){const w=a.slice(i,i+k);if(w.every((x,j)=>x===w[k-1-j]))c++;}return {count:c}});
add("Recurring block positions","dragon-repeat","Lists repeated block positions for motif length three.",a=>{const m={};for(let i=0;i+3<=a.length;i++){const b=blockString(a,i,3);(m[b]??=[]).push(i);}return {blocks:Object.fromEntries(Object.entries(m).filter(([,p])=>p.length>1))}});
add("Longest repeated motif","dragon-repeat","Longest contiguous motif repeated at least twice.",a=>{let best={length:0,motif:null,positions:[]};for(let k=2;k<=Math.min(12,Math.floor(a.length/2));k++){const m={};for(let i=0;i+k<=a.length;i++){const b=blockString(a,i,k);(m[b]??=[]).push(i);}for(const [motif,positions] of Object.entries(m))if(positions.length>1&&k>best.length)best={length:k,motif,positions};}return best});
add("Duplicate window ratio","dragon-repeat","Share of windows whose motif appeared earlier.",a=>({value:blockRepeatStats(a,3).rate}));
add("Motif variety (length 3)","dragon-repeat","Number of distinct contiguous motifs of length three.",a=>({value:blockRepeatStats(a,3).uniqueBlocks}));
add("Motif variety (length 4)","dragon-repeat","Number of distinct contiguous motifs of length four.",a=>({value:blockRepeatStats(a,4).uniqueBlocks}));
add("Motif variety (length 5)","dragon-repeat","Number of distinct contiguous motifs of length five.",a=>({value:blockRepeatStats(a,5).uniqueBlocks}));
add("Most recent motif recurrences","dragon-repeat","For the final three-item motif, count earlier occurrences.",a=>{if(a.length<3)return {motif:null,earlierOccurrences:0};const b=blockString(a,a.length-3,3);let c=0;for(let i=0;i<a.length-3;i++)if(blockString(a,i,3)===b)c++;return {motif:b,earlierOccurrences:c}});
add("Repeat-distance summary","dragon-repeat","Distances between occurrences of the most common three-item motif.",a=>{const m={};for(let i=0;i+3<=a.length;i++){const b=blockString(a,i,3);(m[b]??=[]).push(i);}const z=Object.values(m).sort((x,y)=>y.length-x.length)[0]||[];return {distances:z.slice(1).map((x,i)=>x-z[i])}});
add("Near-repeat count (one mismatch)","dragon-repeat","Counts pairs of equal-length five-item windows differing at one position.",a=>{let c=0;for(let i=0;i+5<=a.length;i++)for(let j=i+1;j+5<=a.length;j++){let d=0;for(let k=0;k<5;k++)if(a[i+k]!==a[j+k])d++;if(d===1)c++;}return {count:c}});
add("Motif compression ratio","dragon-repeat","Approximate compression ratio from repeated three-item motifs.",a=>{if(a.length<3)return {value:null};const m=blockRepeatStats(a,3);return {value:m.uniqueBlocks/(a.length-2)}});
add("Suffix novelty","dragon-repeat","Whether the latest three-item motif is new to the observed history.",a=>{if(a.length<3)return {isNew:null};const b=blockString(a,a.length-3,3);let c=0;for(let i=0;i<a.length-3;i++)if(blockString(a,i,3)===b)c++;return {isNew:c===0,earlierOccurrences:c}});
add("Dragon-cycle scan","dragon-repeat","Checks repeated periods from 2 through 10 in the recent sequence.",a=>({periods:Array.from({length:9},(_,i)=>i+2).map(k=>({period:k,repeatRate:repeatRate(a,k)}))}));

// 91-105 temporal / windows
for (const w of [5,8,10,12,15,20,25,30]) add(`Window summary (${w})`,"window",`Distribution, entropy and alternation in the latest ${w} items.`,a=>{if(a.length<w)return {available:false};const x=a.slice(-w);return {available:true,counts:Object.fromEntries(countMap(x)),entropy:entropy([...countMap(x).values()]),alternationRate:alternationRate(x),longestStreak:longestRun(x)}});
add("Recent vs overall distribution","window","Compares recent 10-item shares with full-history shares.",a=>{if(a.length<10)return {recent:null,overall:null};const r=countMap(a.slice(-10)),o=countMap(a),keys=new Set([...r.keys(),...o.keys()]);const diff={};for(const k of keys)diff[k]=(r.get(k)||0)/10-(o.get(k)||0)/a.length;return {difference:diff}});
add("Recent transition drift","window","Compares transition distributions in first and second halves.",a=>{const h=Math.floor(a.length/2);return {first:transitions(a.slice(0,h)),second:transitions(a.slice(h))}});
add("Prefix-suffix equality score","window","Share of matching symbols in equal-sized prefix and suffix windows.",a=>{const w=Math.floor(a.length/3);if(w<1)return {value:null};const x=a.slice(0,w),y=a.slice(-w);return {value:x.reduce((s,v,i)=>s+(v===y[i]?1:0),0)/w,window:w}});
add("Window volatility","window","Mean symbol-change rate over rolling windows of size five.",a=>{if(a.length<5)return {value:null};let z=[];for(let i=0;i+5<=a.length;i++)z.push(alternationRate(a.slice(i,i+5)));return {value:mean(z)}});
add("Window stability","window","Mean same-symbol adjacency rate over rolling windows of size five.",a=>{if(a.length<5)return {value:null};let z=[];for(let i=0;i+5<=a.length;i++)z.push(1-alternationRate(a.slice(i,i+5)));return {value:mean(z)}});
add("Window maximum streak","window","Longest streak observed in each rolling five-item window.",a=>{if(a.length<5)return {value:null};let z=[];for(let i=0;i+5<=a.length;i++)z.push(longestRun(a.slice(i,i+5)));return {mean:mean(z),max:Math.max(...z)}});
add("Window change-point candidate","window","Finds the split with largest difference in symbol distribution.",a=>{if(a.length<8)return {split:null,score:null};let best={split:null,score:-1};for(let s=3;s<=a.length-3;s++){const x=countMap(a.slice(0,s)),y=countMap(a.slice(s)),keys=new Set([...x.keys(),...y.keys()]);let d=0;for(const k of keys)d+=Math.abs((x.get(k)||0)/s-(y.get(k)||0)/(a.length-s));d/=2;if(d>best.score)best={split:s,score:d};}return best});

// 106-120 integrity / calibration diagnostics
add("Input length","quality","Number of historical observations.",a=>({value:a.length}));
add("Null-like entries","quality","Counts blank or null-like values.",a=>({value:a.filter(x=>x===null||x===undefined||String(x).trim()==="").length}));
add("Unique period check","quality","When period IDs are supplied, checks duplicate IDs.",(a,ctx)=>{const ids=ctx.periods||[];const c=countMap(ids);return {provided:ids.length,duplicates:[...c].filter(([,n])=>n>1).map(([id,count])=>({id,count}))}});
add("Period gap check","quality","Reports missing/irregular periods only when numeric periods are provided.",(a,ctx)=>{const ids=(ctx.periods||[]).map(Number);if(ids.length<2||ids.some(x=>!Number.isFinite(x)))return {available:false};const gaps=[];for(let i=1;i<ids.length;i++)if(Math.abs(ids[i]-ids[i-1])!==1)gaps.push({from:ids[i-1],to:ids[i],delta:ids[i]-ids[i-1]});return {available:true,gaps}});
add("Unknown symbol count","quality","Counts symbols outside an optional allowed-symbol list.",(a,ctx)=>{const allowed=ctx.allowedSymbols||[];return {value:allowed.length?a.filter(x=>!allowed.map(String).includes(String(x))).length:null}});
add("Binary-sequence suitability","quality","Checks whether input has exactly two distinct symbols.",a=>({binary:new Set(a.map(String)).size===2,distinctSymbols:new Set(a.map(String)).size}));
add("Minimum sample check","quality","Reports whether the history meets common sample thresholds.",a=>({thresholds:{20:a.length>=20,50:a.length>=50,100:a.length>=100,500:a.length>=500}}));
add("First/last symbol","quality","Reports first and most recent observed symbols.",a=>({first:a.length?a[0]:null,last:a.length?a[a.length-1]:null}));
add("Missing-value ratio","quality","Ratio of blank/null-like entries.",a=>({value:a.length?a.filter(x=>x===null||x===undefined||String(x).trim()==="").length/a.length:null}));
add("Order sensitivity note","quality","States that changing sequence order changes transition and motif analyses.",()=>({note:"Keep history in chronological order for meaningful transitions; reverse only for a separately labeled comparison."}));
add("Historical-only reliability warning","quality","Clarifies that pattern frequencies are descriptive, not guaranteed forecasts.",()=>({note:"Observed patterns do not establish reliable future outcomes, especially for independent or random draws."}));
add("Rare transition report","quality","Lists transitions seen exactly once.",a=>({transitions:transitions(a).filter(t=>t.count===1)}));
add("Transition sample adequacy","quality","Counts transitions and reports sample size.",a=>({transitionSamples:Math.max(0,a.length-1),atLeast50:a.length>=51,atLeast200:a.length>=201}));
add("Data order monotonicity","quality","Checks whether supplied period IDs are increasing or decreasing.",(a,ctx)=>{const ids=(ctx.periods||[]).map(Number);if(ids.length<2||ids.some(x=>!Number.isFinite(x)))return {available:false};let inc=true,dec=true;for(let i=1;i<ids.length;i++){if(ids[i]<=ids[i-1])inc=false;if(ids[i]>=ids[i-1])dec=false;}return {available:true,ascending:inc,descending:dec}});
add("Pattern inventory summary","quality","Summarizes detector categories available in this engine.",()=>({categories:["distribution","runs","markov","repeat","zigzag","dragon-repeat","window","quality"],patternCount:P.length}));

function analyzeSequence(sequence, options={}) {
  if(!Array.isArray(sequence)) throw new Error("sequence must be an array");
  if(sequence.length>2000) throw new Error("sequence must contain at most 2000 observations");
  const normalized=sequence.map(v => (typeof v==="number" || typeof v==="string") ? v : String(v ?? ""));
  const ctx={periods:Array.isArray(options.periods)?options.periods:[],allowedSymbols:Array.isArray(options.allowedSymbols)?options.allowedSymbols:[]};
  const patterns=P.map(p=>{
    try { return {id:p.id,name:p.name,category:p.category,description:p.description,result:p.analyze(normalized,ctx)}; }
    catch(e) { return {id:p.id,name:p.name,category:p.category,description:p.description,error:"analysis_unavailable"}; }
  });
  return {
    engine:"DRAGON-X-120",
    version:"1.0.0",
    mode:"historical_analysis",
    observations:normalized.length,
    pattern_count:patterns.length,
    patterns,
    note:"Descriptive historical analysis only. No future outcome or betting recommendation is generated."
  };
}
module.exports={analyzeSequence, patternCount:P.length, patternCatalog:P.map(({id,name,category,description})=>({id,name,category,description}))};
