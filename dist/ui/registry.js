import {element,option} from './dom.js';
import {parseSet} from '../core/workspace.js';
// Register field and result renderers here as model capabilities grow.
export const fieldRenderers=new Map([
 ['text',field=>element('input',{type:'text',name:field.key,placeholder:field.placeholder||'',maxlength:64})],
 ['set',field=>element('input',{type:'text',name:field.key,placeholder:field.placeholder||'',value:field.key==='left'?'q0, q1':'p0, p1'})],
 ['machine',(field,context)=>{const select=element('select',{name:field.key}),available=context.machines.filter(m=>m.type===context.type),preferred=field.selection==='other'?(available.find(m=>m.id!==context.activeId)?.id||context.activeId):context.activeId;select.append(...available.map(m=>option(m.id,m.name,m.id===preferred)));return select;}]
]);
export const resultRenderers=new Map([
 ['set',result=>element('div',{class:'operation-set'},[element('p',{class:'result-caption',text:result.count+' ordered '+(result.count===1?'pair':'pairs')}),element('div',{class:'chips'},result.values.map(value=>element('span',{class:'chip',text:'('+value.replace(',',', ')+')'})))])]
]);
export function renderOperations(container,adapter,context,onExecute){
 container.replaceChildren();
 for(const operation of adapter.operations.filter(item=>item.visible!==false)){
  const form=element('form',{class:'operation-card','data-operation':operation.id});
  form.append(element('div',{class:'operation-heading'},[element('span',{class:'operation-glyph','aria-hidden':'true',text:operation.symbol||'ƒ'}),element('div',{},[element('h3',{text:operation.title}),element('p',{text:operation.description})])]));
  const fields=element('div',{class:'operation-fields'});
  for(const field of operation.fields||[]){const renderer=fieldRenderers.get(field.type);if(!renderer)throw new Error('No field renderer for '+field.type);const control=renderer(field,{...context,type:adapter.id});control.setAttribute('aria-label',field.label);control.id=operation.id+'-'+field.key;fields.append(element('label',{for:control.id},[element('span',{text:field.label}),control]));}
  const output=element('div',{class:'operation-output','aria-live':'polite'}),error=element('p',{class:'inline-error',role:'alert',hidden:true}),submit=element('button',{type:'submit',class:'button primary',text:operation.label});
  form.append(fields,error,submit,output);
  form.addEventListener('submit',async event=>{event.preventDefault();error.hidden=true;submit.disabled=true;try{const data=Object.fromEntries(new FormData(form));for(const field of operation.fields||[])if(field.type==='set')data[field.key]=parseSet(data[field.key]);const result=await onExecute(operation,data);if(result)output.replaceChildren(resultRenderers.get(result.kind)?.(result)||element('pre',{class:'operation-json',text:JSON.stringify(result,null,2)}));}catch(failure){error.textContent=failure.message;error.hidden=false;}finally{submit.disabled=false;}});
  container.append(form);
 }
}

// Register a graph, definition renderer, table renderer and editor for each model type.
export const machineViews=new Map();
