import {$,element,option,chips} from './dom.js';
export function createDfaView({graph,onInspect,editor}){
function tableView(machine){
 const d=machine.definition,table=element('table',{class:'data-table'});
 table.append(element('caption',{class:'sr-only',text:'Transition function for '+machine.name}));
 table.append(element('thead',{},element('tr',{},[element('th',{scope:'col',text:'State'}),...d.alphabet.map(symbol=>element('th',{scope:'col',text:symbol===' '?'␠':symbol}))])));
 table.append(element('tbody',{},d.states.map(state=>element('tr',{},[
  element('th',{scope:'row'},element('button',{class:'state-table-button',type:'button',text:(state===d.startState?'→ ':'')+(d.acceptStates.includes(state)?'◎ ':'')+state,onclick:()=>onInspect(state)})),
  ...d.alphabet.map(symbol=>element('td',{class:'mono',text:d.transitions[state][symbol]}))
 ]))));
 $('#transition-table').replaceChildren(table);
}
function definitionPanel(machine){
 const d=machine.definition;
 $('#definition-states').replaceChildren(element('div',{class:'chips'},d.states.map(state=>element('button',{type:'button',class:'chip chip-button',text:state,title:machine.stateLabels?.[state]||'Inspect '+state,onclick:()=>onInspect(state)}))));
 $('#definition-alphabet').replaceChildren(chips(d.alphabet.map(symbol=>symbol===' '?'␠':symbol)));
 $('#definition-start').replaceChildren(chips([d.startState]));
 $('#definition-accept').replaceChildren(chips(d.acceptStates));
 $('#query-state').replaceChildren(...d.states.map(state=>option(state,state,state===d.startState)));
 $('#query-symbol').replaceChildren(...d.alphabet.map(symbol=>option(symbol,symbol===' '?'␠ (space)':symbol)));
 $('#transition-button').disabled=!d.alphabet.length;
 $('#transition-result').replaceChildren(element('span',{class:'muted',text:d.alphabet.length?'Choose a state and symbol.':'Empty alphabet · no transitions.'}));
}

return {graph,editor,renderDefinition:definitionPanel,renderTable:tableView};
}
