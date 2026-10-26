const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
let handler,response;
const context=vm.createContext({structuredClone,self:{addEventListener(name,callback){if(name==='message')handler=callback;},postMessage(data){response=data;}}});
context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.resolve(root,'dist/core',file),'utf8'),context,{filename:file}));
vm.runInContext(fs.readFileSync(path.join(root,'dist/core/model-worker.js'),'utf8'),context);
function request(action,payload={}){
 response=undefined;handler({data:{id:1,action,payload}});
 assert.ok(response,'Worker must respond');
 if(!response.ok)throw new Error(response.error);
 return JSON.parse(JSON.stringify(response.result));
}
const sample={states:['q0','q1','q2'],alphabet:['0','1'],transitions:{q0:{0:'q1',1:'q0'},q1:{0:'q1',1:'q2'},q2:{0:'q1',1:'q0'}},startState:'q0',acceptStates:['q2']};
const even={states:['e','o'],alphabet:['0','1'],transitions:{e:{0:'o',1:'e'},o:{0:'e',1:'o'}},startState:'e',acceptStates:['e']};
const execute=(operation,data)=>request('execute',{type:'dfa',operation,...data});
function strings(depth){const values=[''];for(let i=0;i<depth;i++){for(const prefix of values.filter(word=>word.length===i)){values.push(prefix+'0',prefix+'1');}}return values.filter(word=>word.length>0);}
test('catalog exposes union, intersection and complement as user-facing operations',()=>{
 const catalog=request('catalog');assert.equal(catalog.originalExample,undefined);
 assert.deepEqual(catalog.types[0].operations.filter(item=>item.visible!==false).map(item=>item.id),['union','intersection','complement']);
 assert.deepEqual(catalog.types[0].operations.map(item=>item.id),['simulate','batch','transition','union','intersection','complement','cartesian']);
});
test('describe reads the model getters and transition function',()=>{
 assert.deepEqual(request('describe',{type:'dfa',definition:sample}),sample);
});
test('acceptance and simulation trace match the recognized language for 126 non-empty strings',()=>{
 for(const input of strings(6)){const result=execute('simulate',{definition:sample,input});assert.equal(result.accepted,input.endsWith('01'),input);assert.equal(result.trace.length,[...input].length+1);assert.equal(result.trace.at(-1).state,result.finalState);}
});
test('blank simulation inputs are rejected at the interface boundary',()=>{
 assert.throws(()=>execute('simulate',{definition:even,input:''}),/at least one symbol/);
 assert.throws(()=>execute('simulate',{definition:sample,input:''}),/at least one symbol/);
 const modelDefinition=JSON.stringify(sample);
 assert.equal(vm.runInContext('(()=>{const d='+modelDefinition+';return new DFA([d.states,d.alphabet,d.transitions,d.startState,d.acceptStates]).simulate("");})()',context),'q0');
});
test('invalid symbols are reported by the original model',()=>{
 assert.throws(()=>execute('simulate',{definition:sample,input:'02'}),/does not belong/);
});
test('transition lookup delegates to the original method',()=>{
 assert.deepEqual(execute('transition',{definition:sample,state:'q1',symbol:'1'}),{state:'q1',symbol:'1',next:'q2'});
});
test('union accepts exactly the OR of the two languages',()=>{
 const result=execute('union',{left:sample,right:even});
 assert.equal(result.definition.states.length,6);
 for(const input of strings(6))assert.equal(execute('simulate',{definition:result.definition,input}).accepted,input.endsWith('01')||[...input].filter(s=>s==='0').length%2===0,input);
});
test('a union result can participate in another union without comma collisions',()=>{
 const first=execute('union',{left:sample,right:even});
 const second=execute('union',{left:first.definition,right:sample,leftLabels:first.stateLabels});
 for(const input of strings(4))assert.equal(execute('simulate',{definition:second.definition,input}).accepted,input.endsWith('01')||[...input].filter(s=>s==='0').length%2===0,input);
});
test('state names containing commas are canonicalized at the adapter boundary',()=>{
 const one={states:['left,one'],alphabet:['0','1'],transitions:{'left,one':{0:'left,one',1:'left,one'}},startState:'left,one',acceptStates:['left,one']};
 const result=execute('union',{left:one,right:sample});
 assert.equal(execute('simulate',{definition:result.definition,input:'110'}).accepted,true);
});
test('union rejects different alphabets and oversized products',()=>{
 const mismatch={states:['a'],alphabet:['x'],transitions:{a:{x:'a'}},startState:'a',acceptStates:[]};
 assert.throws(()=>execute('union',{left:sample,right:mismatch}),/same alphabet/);
 const states=Array.from({length:13},(_,i)=>'q'+i),big={states,alphabet:['0','1'],transitions:Object.fromEntries(states.map(s=>[s,{0:s,1:s}])),startState:'q0',acceptStates:[]};
 assert.throws(()=>execute('union',{left:big,right:big}),/144 states/);
});
test('validation rejects incomplete tables, duplicate states, and unsafe names',()=>{
 assert.throws(()=>request('describe',{type:'dfa',definition:{...sample,transitions:{}}}),/Missing transitions/);
 assert.throws(()=>request('describe',{type:'dfa',definition:{...sample,states:['q0','q0']}}),/duplicate/);
 assert.throws(()=>request('describe',{type:'dfa',definition:{...sample,states:['__proto__']}}),/reserved/);
});
test('empty alphabets and empty accepting sets are supported',()=>{
 const minimal={states:['q'],alphabet:[],transitions:{q:{}},startState:'q',acceptStates:[]};
 assert.deepEqual(request('describe',{type:'dfa',definition:minimal}),minimal);
 assert.throws(()=>execute('simulate',{definition:minimal,input:'0'}),/alphabet/);
});
test('batch results retain invalid inputs alongside accepted and rejected ones',()=>{
 const result=execute('batch',{definition:sample,inputs:['01','11','','2']});
 assert.equal(result[0].accepted,true);assert.equal(result[1].accepted,false);assert.equal(result.length,3);assert.match(result[2].error,/alphabet/);
});
test('Cartesian products include every ordered pair and support empty sets',()=>{
 assert.deepEqual(execute('cartesian',{left:['q0','q1'],right:['p0','p1']}).values,['q0,p0','q0,p1','q1,p0','q1,p1']);
 assert.equal(execute('cartesian',{left:[],right:['p']}).count,0);
});
test('string tools use getString, setString, prefixes, suffixes and unique substrings',()=>{
 const result=request('word',{text:'010'});assert.equal(result.text,'010');
 assert.deepEqual(result.prefixes,['','0','01','010']);
 assert.deepEqual(result.suffixes,['','0','10','010']);
 assert.deepEqual([...result.substrings].sort(),['','0','01','010','1','10'].sort());
});
test('Unicode limitation is explicit in String tools while DFA supports emoji symbols',()=>{
 assert.throws(()=>request('word',{text:'😀a'}),/UTF-16/);
 const unicode={states:['q'],alphabet:['😀'],transitions:{q:{'😀':'q'}},startState:'q',acceptStates:['q']};
 assert.equal(execute('simulate',{definition:unicode,input:'😀😀'}).accepted,true);
});
test('input definitions remain unchanged after constructing unions',()=>{
 const before=JSON.stringify(sample);execute('union',{left:sample,right:even});assert.equal(JSON.stringify(sample),before);
});

test('portable imports retain definitions and regenerate IDs',async()=>{
 const {normalizeImport}=await import('../dist/core/workspace.js');
 const result=normalizeImport({version:1,kind:'automata-machine',machine:{id:'old',type:'dfa',name:'Imported example',description:'Example',definition:sample}});
 assert.equal(result.length,1);assert.notEqual(result[0].id,'old');assert.deepEqual(result[0].definition,sample);
});
test('non-object imports, unknown versions and unnamed machines have clear errors',async()=>{
 const {normalizeImport}=await import('../dist/core/workspace.js');
 assert.throws(()=>normalizeImport(null),/JSON object/);
 assert.throws(()=>normalizeImport({version:2}),/version/);
 assert.throws(()=>normalizeImport({kind:'automata-machine',machine:{type:'dfa',name:'',definition:sample}}),/name/);
});


test('new ready machine recognizes binary multiples of three',async()=>{
 const {exampleMachines}=await import('../dist/core/workspace.js');
 const machine=exampleMachines().find(item=>item.name==='Binary multiples of 3');
 assert.ok(machine);assert.match(machine.description,/divisible by 3/);
 for(let number=0;number<64;number++)assert.equal(execute('simulate',{definition:machine.definition,input:number.toString(2)}).accepted,number%3===0);
 assert.equal(execute('simulate',{definition:machine.definition,input:'00011'}).accepted,true);
 assert.ok(exampleMachines().every(item=>!item.name.includes('six-state')));
});
test('blank batches and blank String-tool inputs are rejected',()=>{
 assert.throws(()=>execute('batch',{definition:sample,inputs:['','']}),/1–50 strings/);
 assert.throws(()=>request('word',{text:''}),/1–24 characters/);
});
test('legacy default examples upgrade without replacing edited machines',async()=>{
 const {upgradeExampleMachines}=await import('../dist/core/workspace.js');
 const legacyDefinition={states:['q0','q1','q2','q3','q4','q5'],alphabet:['0','1'],transitions:{q0:{0:'q1',1:'q4'},q1:{0:'q2',1:'q3'},q2:{0:'q1',1:'q4'},q3:{0:'q5',1:'q4'},q4:{0:'q5',1:'q3'},q5:{0:'q5',1:'q5'}},startState:'q0',acceptStates:['q1','q4']};
 const legacy={id:'keep-id',name:'Original six-state DFA',description:'The example supplied alongside the original JavaScript model.',definition:legacyDefinition};
 const updated=upgradeExampleMachines([legacy]);
 assert.equal(updated[0].id,'keep-id');assert.equal(updated[0].name,'Binary multiples of 3');
 const edited={...legacy,description:'My custom description'};
 assert.equal(upgradeExampleMachines([edited])[0],edited);
 assert.equal(upgradeExampleMachines([legacy],2)[0],legacy);
});

test('intersection accepts exactly the AND of the two languages',()=>{
 const result=execute('intersection',{left:sample,right:even});
 assert.equal(result.definition.states.length,6);
 for(const input of strings(6)){
  const expected=input.endsWith('01')&&[...input].filter(symbol=>symbol==='0').length%2===0;
  assert.equal(execute('simulate',{definition:result.definition,input}).accepted,expected,input);
 }
});

test('complement reverses acceptance over the same alphabet',()=>{
 const result=execute('complement',{source:sample});
 assert.deepEqual(result.definition.states,sample.states);
 assert.deepEqual(result.definition.alphabet,sample.alphabet);
 assert.deepEqual(result.definition.transitions,sample.transitions);
 for(const input of strings(6)){
  assert.equal(execute('simulate',{definition:result.definition,input}).accepted,!input.endsWith('01'),input);
 }
 const twice=execute('complement',{source:result.definition});
 assert.deepEqual(twice.definition,sample);
 assert.throws(()=>execute('complement',{source:{...sample,transitions:{}}}),/Missing transitions/);
 assert.throws(()=>execute('simulate',{definition:result.definition,input:'2'}),/does not belong/);
});

test('complement preserves readable labels from an earlier binary operation',()=>{
 const combined=execute('intersection',{left:sample,right:even});
 const result=execute('complement',{source:combined.definition,sourceLabels:combined.stateLabels});
 assert.deepEqual(result.stateLabels,combined.stateLabels);
 const all={states:['q'],alphabet:['0','1'],transitions:{q:{0:'q',1:'q'}},startState:'q',acceptStates:['q']};
 assert.deepEqual(execute('complement',{source:all}).definition.acceptStates,[]);
 assert.deepEqual(execute('complement',{source:{...all,acceptStates:[]}}).definition.acceptStates,['q']);
});

test('binary operations can consume earlier union, intersection and complement results',()=>{
 const union=execute('union',{left:sample,right:even});
 const intersection=execute('intersection',{left:union.definition,right:sample,leftLabels:union.stateLabels});
 const complement=execute('complement',{source:intersection.definition,sourceLabels:intersection.stateLabels});
 const combined=execute('union',{left:complement.definition,right:even,leftLabels:complement.stateLabels});
 for(const input of strings(5)){
  const ends=input.endsWith('01'),evenZeros=[...input].filter(symbol=>symbol==='0').length%2===0;
  assert.equal(execute('simulate',{definition:intersection.definition,input}).accepted,ends,input);
  assert.equal(execute('simulate',{definition:combined.definition,input}).accepted,!ends||evenZeros,input);
 }
 assert.ok(Object.values(intersection.stateLabels).some(label=>label.includes('(q0, e)')));
});

test('intersection canonicalizes comma-containing labels and validates product size',()=>{
 const named={states:['a,b'],alphabet:['0','1'],transitions:{'a,b':{0:'a,b',1:'a,b'}},startState:'a,b',acceptStates:['a,b']};
 const result=execute('intersection',{left:named,right:sample});
 assert.ok(Object.values(result.stateLabels).some(label=>label.includes('a,b')));
 assert.equal(execute('simulate',{definition:result.definition,input:'01'}).accepted,true);
 assert.equal(execute('simulate',{definition:result.definition,input:'11'}).accepted,false);
 const states=Array.from({length:13},(_,index)=>'s'+index);
 const big={states,alphabet:['0'],transitions:Object.fromEntries(states.map(state=>[state,{0:state}])),startState:'s0',acceptStates:[]};
 assert.throws(()=>execute('intersection',{left:big,right:big}),/144 states/);
});

test('union and intersection accept reordered equal alphabets and reject unequal alphabets',()=>{
 const reversed={...even,alphabet:['1','0']};
 const unequal={states:['s'],alphabet:['0'],transitions:{s:{0:'s'}},startState:'s',acceptStates:['s']};
 for(const operation of ['union','intersection']){
  const result=execute(operation,{left:sample,right:reversed});
  assert.equal(execute('simulate',{definition:result.definition,input:'1001'}).accepted,true);
  assert.throws(()=>execute(operation,{left:sample,right:unequal}),/same alphabet/);
  const larger={...sample,alphabet:['0','1','2'],transitions:Object.fromEntries(sample.states.map(state=>[state,{...sample.transitions[state],2:state}]))};
  assert.throws(()=>execute(operation,{left:sample,right:larger}),/same alphabet/);
  // Exercise the model's own check without the interface adapter.
  const modelCheck='(()=>{const build=d=>new DFA([d.states,d.alphabet,d.transitions,d.startState,d.acceptStates]);return DFA.'+operation+'(build('+JSON.stringify(sample)+'),build('+JSON.stringify(unequal)+'));})()';
  assert.throws(()=>vm.runInContext(modelCheck,context),/Alphabets should be the same/);
 }
});

test('all language operations preserve both input definitions',()=>{
 const before=JSON.stringify({sample,even});
 for(const operation of ['union','intersection'])execute(operation,{left:sample,right:even});
 execute('complement',{source:sample});
 assert.equal(JSON.stringify({sample,even}),before);
});

test('worker Set fallbacks support model operations when native methods are missing',()=>{
 let fallbackHandler,fallbackResponse;
 const fallbackContext=vm.createContext({structuredClone,self:{
  addEventListener(name,callback){if(name==='message')fallbackHandler=callback;},
  postMessage(data){fallbackResponse=data;}
 }});
 vm.runInContext("for(const name of ['union','isSubsetOf','difference'])Object.defineProperty(Set.prototype,name,{value:undefined,writable:true,configurable:true});",fallbackContext);
 fallbackContext.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.resolve(root,'dist/core',file),'utf8'),fallbackContext,{filename:file}));
 vm.runInContext(fs.readFileSync(path.join(root,'dist/core/model-worker.js'),'utf8'),fallbackContext);
 function fallback(operation,payload){
  fallbackResponse=undefined;fallbackHandler({data:{id:1,action:'execute',payload:{type:'dfa',operation,...payload}}});
  assert.ok(fallbackResponse?.ok,fallbackResponse?.error);
  return JSON.parse(JSON.stringify(fallbackResponse.result));
 }
 for(const operation of ['union','intersection','complement']){
  const result=fallback(operation,operation==='complement'?{source:sample}:{left:sample,right:even});
  for(const input of strings(4)){
   const ends=input.endsWith('01'),evenZeros=[...input].filter(symbol=>symbol==='0').length%2===0;
   const expected=operation==='union'?ends||evenZeros:operation==='intersection'?ends&&evenZeros:!ends;
   assert.equal(fallback('simulate',{definition:result.definition,input}).accepted,expected,operation+': '+input);
  }
 }
 assert.equal(vm.runInContext("new Set(['x']).isSubsetOf(new Set(['y']))",fallbackContext),false);
 assert.equal(vm.runInContext("new Set(['x','y']).isSubsetOf(new Set(['x']))",fallbackContext),false);
 const unequal={states:['s'],alphabet:['0'],transitions:{s:{0:'s'}},startState:'s',acceptStates:['s']};
 const modelCheck='(()=>{const build=d=>new DFA([d.states,d.alphabet,d.transitions,d.startState,d.acceptStates]);return DFA.intersection(build('+JSON.stringify(sample)+'),build('+JSON.stringify(unequal)+'));})()';
 assert.throws(()=>vm.runInContext(modelCheck,fallbackContext),/Alphabets should be the same/);
});

test('operation metadata describes the exact inputs needed by each form',()=>{
 const operations=request('catalog').types[0].operations;
 for(const id of ['union','intersection']){
  const operation=operations.find(item=>item.id===id);
  assert.deepEqual(operation.fields.filter(field=>field.type==='machine').map(field=>field.key),['leftId','rightId']);
 }
 assert.deepEqual(operations.find(item=>item.id==='complement').fields.filter(field=>field.type==='machine').map(field=>field.key),['sourceId']);
});
