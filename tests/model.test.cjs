const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
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
test('original model copy retains the supplied checksum',()=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/model/original.js'))).digest('hex');
 assert.equal(hash,'2f3487f0b451263ae2a365abd440e360ee9166e62f3cd564814b1e96199dee9a');
});
test('catalog exposes union as the only user-facing operation',()=>{
 const catalog=request('catalog');assert.equal(catalog.originalExample,undefined);
 assert.deepEqual(catalog.types[0].operations.filter(item=>item.visible!==false).map(item=>item.id),['union']);
 assert.deepEqual(catalog.types[0].operations.map(item=>item.id),['simulate','batch','transition','union','cartesian']);
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
 assert.equal(vm.runInContext('myDFA.simulate("")',context),'q0');
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
 const legacyDefinition=JSON.parse(vm.runInContext('JSON.stringify({states:[...myDFA.getStates()],alphabet:[...myDFA.getAlphabet()],transitions:myDFA.delta,startState:myDFA.getStartState(),acceptStates:[...myDFA.getAcceptStates()]})',context));
 const legacy={id:'keep-id',name:'Original six-state DFA',description:'The example supplied alongside the original JavaScript model.',definition:legacyDefinition};
 const updated=upgradeExampleMachines([legacy]);
 assert.equal(updated[0].id,'keep-id');assert.equal(updated[0].name,'Binary multiples of 3');
 const edited={...legacy,description:'My custom description'};
 assert.equal(upgradeExampleMachines([edited])[0],edited);
 assert.equal(upgradeExampleMachines([legacy],2)[0],legacy);
});
