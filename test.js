const assert=require("assert");
const {analyzeSequence,patternCount}=require("./lib/dragonx");
const r=analyzeSequence(["BIG","SMALL","BIG","SMALL","BIG","BIG","SMALL","RED"]);
assert(r.pattern_count>=120, "expected at least 120 patterns");
assert.equal(r.observations,8);
assert(r.patterns.some(p=>p.name==="Transition matrix"));
assert(r.patterns.some(p=>p.name==="Dragon motif frequency (4)"));
assert(patternCount>=120);
console.log("PASS: "+patternCount+" patterns analyzed.");
