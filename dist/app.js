import {ModelBridge} from './core/bridge.js';
import {STORAGE_KEY,makeMachine,exampleMachines,upgradeExampleMachines,normalizeImport,newId} from './core/workspace.js';
import {$,element,option,chips,download,notify,busy} from './ui/dom.js';
import {openEditor} from './ui/editor.js';
import {MachineGraph} from './ui/graph.js';
import {SimulationPanel} from './ui/simulation.js';
import {renderOperations,machineViews} from './ui/registry.js';
import {createDfaView} from './ui/dfa-view.js';

const bridge=new ModelBridge();
const typeRegistry=new Map();

let machines=[],activeId=null,activationVersion=0,pendingDeleteId=null;
const quantity=(count,noun)=>count+' '+noun+(count===1?'':'s');
const active=()=>machines.find(machine=>machine.id===activeId);
const adapter=()=>typeRegistry.get(active()?.type);
const slug=text=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'machine';
let graph=new MachineGraph($('#graph-container'),{onSelect:state=>inspect(state),onZoom:value=>{$('#zoom-value').textContent=value+'%';}});
machineViews.set('dfa',createDfaView({graph,onInspect:inspect,editor:openEditor}));
const simulator=new SimulationPanel({bridge,graph,onState:state=>{const view=machineViews.get(active()?.type);if(view?.onTrace)view.onTrace(state);else if(typeof state==='string')$('#query-state').value=state;},onShowTest:()=>selectTool('test')});

function save(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,kind:'automata-workspace',exampleRevision:2,machines,activeIndex:machines.findIndex(machine=>machine.id===activeId)}));$('#storage-status').textContent='Saved in this browser';}
 catch{$('#storage-status').textContent='Session only · export to save';}
}
function sidebar(){
 $('#machine-count').textContent=machines.length;
 $('#machine-list').replaceChildren(...machines.map(machine=>{
  const current=machine.id===activeId;
  const button=element('button',{class:'machine-row'+(current?' active':''),type:'button','aria-current':current?'true':undefined,onclick:()=>activate(machine.id).catch(error=>notify(error.message,true))},[
   element('span',{class:'machine-icon','aria-hidden':'true',text:'◉'}),
   element('span',{class:'machine-row-text'},[element('span',{class:'machine-row-name',text:machine.name}),element('span',{class:'machine-row-detail',text:(typeRegistry.get(machine.type)?.label||machine.type)+' · '+quantity(machine.definition.states.length,'state')})])
  ]);
  return button;
 }));
 $('#delete-machine').disabled=machines.length<2;
}
async function inspect(state){
 if(!active())return;
 $('#query-state').value=state;
 graph.selectedState=state;
 graph.highlight(graph.currentState,graph.lastStep);
 if(!active().definition.alphabet.length)return;
 await queryTransition();
}
async function queryTransition(){
 const machine=active();
 try{
  const result=await bridge.call('execute',{type:machine.type,operation:'transition',definition:machine.definition,state:$('#query-state').value,symbol:$('#query-symbol').value});
  if(active()?.id!==machine.id)return;
  $('#transition-result').replaceChildren(element('span',{class:'transition-expression',text:'δ('+result.state+', '+(result.symbol===' '?'␠':result.symbol)+')'}),element('span',{'aria-hidden':'true',text:'→'}),element('strong',{class:'mono',text:result.next}));
 }catch(error){notify(error.message,true);}
}
async function operate(operation,data){
 const machine=active();
 const payload={type:machine.type,operation:operation.id,...data};
 const inputs=[];
 for(const field of operation.fields||[]){
  if(field.type!=='machine')continue;
  const selected=machines.find(item=>item.id===data[field.key]);
  if(!selected)throw new Error('Choose a machine for '+field.label+'.');
  const key=field.modelKey||field.key.replace(/Id$/,'');payload[key]=selected.definition;payload[key+'Labels']=selected.stateLabels;inputs.push(selected);
 }
 const result=await bridge.call('execute',payload);
 if(result.kind==='machine'){
  if(machines.length>=20)throw new Error('The workspace holds up to 20 machines. Export or remove a machine before creating another.');
  if(!machineViews.has(result.type))throw new Error('Register a view for '+result.type+' before creating that machine type.');
  const created=makeMachine((data.name?.trim()||operation.defaultName||operation.title).slice(0,64),(operation.title+(inputs.length?' · '+inputs.map(item=>item.name).join(' + '):'')).slice(0,240),result.definition,{type:result.type,stateLabels:result.stateLabels});
  machines.push(created);await activate(created.id);selectTool('test');notify((operation.successMessage||'Machine created')+' · '+quantity(created.definition.states.length,'state')+'.');return null;
 }
 return result;
}
function renderCapabilities(type){
 for(const [id,capability]of [['test','simulate'],['batch','batch'],['operations',null]]){
  const enabled=capability?type.capabilities.includes(capability):type.operations.some(operation=>operation.visible!==false);
  $('#tab-'+id).hidden=!enabled;
 }
 $('#view-graph').hidden=!type.capabilities.includes('diagram');
 $('#view-table').hidden=!type.capabilities.includes('transition-table');
 $('#edit-machine').disabled=!machineViews.get(type.id)?.editor;
}
async function activate(id,{run=true}={}){
 const machine=machines.find(item=>item.id===id);
 if(!machine)return;
 const view=machineViews.get(machine.type);if(!view)throw new Error('Register a view adapter for this machine type before using it.');
 const sequence=++activationVersion;
 const definition=await bridge.call('describe',{type:machine.type,definition:machine.definition});
 if(sequence!==activationVersion)return;
 machine.definition=definition;activeId=id;
 $('#machine-title').textContent=machine.name;
 $('#machine-description').textContent=machine.description||'A custom machine. Edit it to add a description.';
 $('#machine-type').textContent=typeRegistry.get(machine.type).label;
 $('#machine-size').textContent=quantity(definition.states.length,'state')+' · '+quantity(definition.alphabet.length,'symbol');
 graph=view.graph;simulator.graph=graph;
 sidebar();view.renderDefinition(machine);graph.draw(machine,definition.startState);view.renderTable(machine);simulator.setMachine(machine);
 renderCapabilities(typeRegistry.get(machine.type));
 renderOperations($('#operation-forms'),typeRegistry.get(machine.type),{machines,activeId},operate);
 save();if(run)await simulator.run();
}
function selectTool(name){
 const tabs=[...document.querySelectorAll('.tool-tabs [role="tab"]')];
 for(const tab of tabs){const selected=tab.id==='tab-'+name;tab.setAttribute('aria-selected',selected);tab.tabIndex=selected?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!selected;}
 if(name==='strings'&&!$('#word-results').children.length)simulator.analyzeWord();
}
function selectView(name){
 for(const tab of document.querySelectorAll('.view-tabs [role="tab"]')){const selected=tab.id==='view-'+name;tab.setAttribute('aria-selected',selected);tab.tabIndex=selected?0:-1;$('#'+tab.getAttribute('aria-controls')).hidden=!selected;}
}
function keyboardTabs(container,select){
 const tabs=[...container.querySelectorAll('[role="tab"]')];
 for(const tab of tabs){
  tab.addEventListener('click',()=>select(tab));
  tab.addEventListener('keydown',event=>{
   const visible=tabs.filter(item=>!item.hidden),index=visible.indexOf(tab);let next;
   if(event.key==='ArrowRight')next=visible[(index+1)%visible.length];
   if(event.key==='ArrowLeft')next=visible[(index-1+visible.length)%visible.length];
   if(event.key==='Home')next=visible[0];if(event.key==='End')next=visible.at(-1);
   if(next){event.preventDefault();select(next);next.focus();}
  });
 }
}
keyboardTabs($('.tool-tabs'),tab=>selectTool(tab.id.slice(4)));
keyboardTabs($('.view-tabs'),tab=>selectView(tab.id.slice(5)));
for(const button of document.querySelectorAll('.close-dialog'))button.addEventListener('click',()=>button.closest('dialog').close());
$('#transition-form').addEventListener('submit',event=>{event.preventDefault();queryTransition();});
$('#zoom-in').onclick=()=>graph.zoom(1.2);$('#zoom-out').onclick=()=>graph.zoom(1/1.2);$('#zoom-fit').onclick=()=>graph.fit();
function edit(machine,requestedType){
 if(!machine&&machines.length>=20){notify('Export or remove a machine first. The workspace holds up to 20 machines.',true);return;}
 const type=machine?.type||requestedType||'dfa',editor=machineViews.get(type)?.editor;
 if(!editor){notify('An editor for this machine type is not available.',true);return;}
 editor(machine,async data=>{
  const definition=await bridge.call('describe',{type,definition:data.definition});
  if(machine){
   const target=machines.find(item=>item.id===machine.id);
   Object.assign(target,{...data,definition});
   // Labels for product states are retained only while their state IDs still exist.
   if(target.stateLabels)target.stateLabels=Object.fromEntries(Object.entries(target.stateLabels).filter(([state])=>definition.states.includes(state)));
   await activate(target.id);
  }else{
   const created=makeMachine(data.name,data.description,definition,{type});machines.push(created);await activate(created.id);
  }
  notify(machine?'Machine updated.':'Machine created.');
 });
}
$('#new-machine').onclick=()=>edit(null,$('#new-machine-type').value||'dfa');$('#edit-machine').onclick=()=>edit(active());
$('#duplicate-machine').onclick=()=>busy($('#duplicate-machine'),async()=>{
 if(machines.length>=20)throw new Error('The workspace holds up to 20 machines.');
 const source=active(),copy={...structuredClone(source),id:newId(),name:(source.name+' copy').slice(0,64)};
 machines.push(copy);await activate(copy.id);notify('Machine duplicated.');
});
$('#delete-machine').onclick=()=>{
 if(machines.length<2)return;pendingDeleteId=activeId;
 $('#delete-description').textContent='“'+active().name+'” will be removed from this browser. Export it first if you want a backup.';
 $('#delete-dialog').showModal();
};
$('#confirm-delete').onclick=()=>busy($('#confirm-delete'),async()=>{
 if(machines.length<2)return;machines=machines.filter(machine=>machine.id!==pendingDeleteId);$('#delete-dialog').close();await activate(machines[0].id);notify('Machine deleted.');
});
$('#help-button').onclick=()=>$('#help-dialog').showModal();
$('#browse-examples').onclick=()=>{
 const examples=exampleMachines();
 $('#example-list').replaceChildren(...examples.map(example=>element('article',{class:'example-card'},[
  element('div',{},[element('span',{class:'type-pill',text:'DFA'}),element('h3',{text:example.name}),element('p',{text:example.description}),element('small',{text:quantity(example.definition.states.length,'state')+' · alphabet {0, 1}'})]),
  element('button',{type:'button',class:'button outline',text:'Add to workspace',onclick:event=>busy(event.currentTarget,async()=>{if(machines.length>=20)throw new Error('The workspace holds up to 20 machines.');machines.push(example);await activate(example.id);$('#examples-dialog').close();notify('Example added.');})})
 ])));
 $('#examples-dialog').showModal();
};
$('#import-button').onclick=()=>{$('#import-error').hidden=true;$('#import-json').value='';$('#import-file').value='';$('#import-dialog').showModal();};
$('#import-file').addEventListener('change',async event=>{
 try{const file=event.target.files[0];if(!file)return;if(file.size>80000)throw new Error('Use a JSON file smaller than 80 KB.');$('#import-json').value=await file.text();$('#import-error').hidden=true;}
 catch(error){$('#import-error').textContent=error.message;$('#import-error').hidden=false;}
});
$('#import-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=$('#confirm-import');button.disabled=true;$('#import-error').hidden=true;
 try{
  const text=$('#import-json').value;if(new TextEncoder().encode(text).length>80000)throw new Error('Use a JSON document smaller than 80 KB.');
  let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('This is not valid JSON. Check the commas, brackets, and quotes.');}
  const imported=normalizeImport(parsed);if(machines.length+imported.length>20)throw new Error('This import would exceed the 20-machine workspace limit.');
  for(const machine of imported){if(!machineViews.has(machine.type))throw new Error('The interface for '+machine.type+' is not available yet.');machine.definition=await bridge.call('describe',{type:machine.type,definition:machine.definition});}
  machines.push(...imported);await activate(imported[0].id);$('#import-dialog').close();notify(imported.length+' '+(imported.length===1?'machine imported.':'machines imported.'));
 }catch(error){$('#import-error').textContent=error.message;$('#import-error').hidden=false;}
 finally{button.disabled=false;}
});
function exportData(scope){
 const machine=active(),data=scope==='machine'?{version:1,kind:'automata-machine',machine}: {version:1,kind:'automata-workspace',exampleRevision:2,machines};
 download(scope==='machine'?slug(machine.name)+'.json':'automata-workspace.json',JSON.stringify(data,null,2));
 $('.export-menu').removeAttribute('open');
}
$('#export-machine').onclick=()=>exportData('machine');$('#export-workspace').onclick=()=>exportData('workspace');
$('#export-diagram').onclick=()=>{download(slug(active().name)+'.svg',graph.exportSvg(),'image/svg+xml');$('.export-menu').removeAttribute('open');};
function syncTheme(){const light=document.documentElement.dataset.theme==='light';$('#theme-button').setAttribute('aria-label',light?'Switch to dark theme':'Switch to light theme');$('#theme-button').title=light?'Switch to dark theme':'Switch to light theme';}
$('#theme-button').onclick=()=>{
 const next=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=next;
 try{localStorage.setItem('automata-theme',next);}catch{}
 syncTheme();if(active()){const current=graph.currentState,step=graph.lastStep;graph.draw(active(),graph.selectedState);graph.highlight(current,step);}
};
syncTheme();
async function initialize(){
 const catalog=await bridge.call('catalog');for(const type of catalog.types)typeRegistry.set(type.id,type);
 const editableTypes=catalog.types.filter(type=>machineViews.get(type.id)?.editor);$('#new-machine-type').replaceChildren(...editableTypes.map(type=>option(type.id,type.label)));$('#new-machine-type').hidden=editableTypes.length<2;
 let restored=null;
 try{const saved=localStorage.getItem(STORAGE_KEY);if(saved){const data=JSON.parse(saved);restored=upgradeExampleMachines(normalizeImport(data),data.exampleRevision||0);for(const machine of restored)machine.definition=await bridge.call('describe',{type:machine.type,definition:machine.definition});machines=restored;activeId=machines[Math.min(Math.max(data.activeIndex||0,0),machines.length-1)].id;}}
 catch{notify('The saved workspace could not be restored. Starting with the examples; use JSON imports for backups.',true);}
 if(!restored?.length){machines=exampleMachines();activeId=machines[0].id;}
 await activate(activeId);
 $('.app-layout').inert=false;
}
initialize().catch(error=>{$('#machine-title').textContent='The model could not start';$('#machine-description').textContent=error.message;$('#storage-status').textContent='Model unavailable';notify(error.message,true);});
