import {$, element, option, chips} from './dom.js';
import {parseSet} from '../core/workspace.js';

export function openEditor(machine, onSave) {
  const dialog = $('#editor-dialog');
  const form = $('#editor-form');
  const error = $('#editor-error');
  const title = $('#editor-title');
  title.textContent = machine ? 'Edit machine' : 'Create a machine';
  $('#machine-name').value = machine?.name || 'Untitled DFA';
  $('#editor-description').value = machine?.description || '';
  $('#machine-states').value = (machine?.definition.states || ['q0', 'q1']).join(', ');
  $('#machine-alphabet').value = (machine?.definition.alphabet || ['0', '1']).join(', ');
  error.hidden = true;
  let definition = machine?.definition || {states: ['q0', 'q1'], alphabet: ['0', '1'], startState: 'q0', acceptStates: [], transitions: {}};
  function capture() {
    const transitions = Object.fromEntries(definition.states.map(state => [state, {}]));
    form.querySelectorAll('[data-editor-transition]').forEach(select => {
      transitions[select.dataset.state][select.dataset.symbol] = select.value;
    });
    return {...definition, transitions, startState: $('#machine-start').value, acceptStates: [...form.querySelectorAll('[name="accept-state"]:checked')].map(input => input.value)};
  }
  function rebuild() {
    const old = capture();
    const states = parseSet($('#machine-states').value);
    const alphabet = parseSet($('#machine-alphabet').value);
    if (!states.length || states.length > 144 || new Set(states).size !== states.length) throw new Error('Use 1–144 distinct states.');
    if (alphabet.length > 12 || new Set(alphabet).size !== alphabet.length || alphabet.some(symbol => [...symbol].length !== 1)) throw new Error('Use up to 12 distinct single-character symbols.');
    if (states.some(state => ['__proto__', 'constructor', 'prototype'].includes(state))) throw new Error('That state name is reserved. Choose another name.');
    definition = {states, alphabet, startState: states.includes(old.startState) ? old.startState : states[0], acceptStates: old.acceptStates.filter(state => states.includes(state)), transitions: old.transitions};
    render();
  }
  function render() {
    const start = $('#machine-start');
    start.replaceChildren(...definition.states.map(state => option(state, state, state === definition.startState)));
    $('#accept-state-options').replaceChildren(...definition.states.map(state => {
      const input = element('input', {type: 'checkbox', name: 'accept-state', value: state});
      input.checked = definition.acceptStates.includes(state);
      return element('label', {class: 'check-chip'}, [input, element('span', {text: state})]);
    }));
    const table = element('table', {class: 'data-table editor-table'});
    table.append(element('caption', {class: 'sr-only', text: 'Choose a target state for every state and symbol.'}));
    table.append(element('thead', {}, element('tr', {}, [
      element('th', {scope: 'col', text: 'State'}),
      ...definition.alphabet.map(symbol => element('th', {scope: 'col', text: symbol}))
    ])));
    table.append(element('tbody', {}, definition.states.map(state => element('tr', {}, [
      element('th', {scope: 'row', text: state}),
      ...definition.alphabet.map(symbol => {
        const select = element('select', {'data-editor-transition': '', 'data-state': state, 'data-symbol': symbol, 'aria-label': 'From ' + state + ' on ' + symbol});
        const target = definition.transitions[state]?.[symbol] || '';
        select.append(option('', 'Choose…', !target), ...definition.states.map(value => option(value, value, value === target)));
        return element('td', {}, select);
      })
    ]))));
    $('#editor-table').replaceChildren(table);
    $('#editor-table-note').textContent = definition.alphabet.length ? 'Every state needs one target for each symbol. Accepting states are marked separately.' : 'This alphabet has no symbols. Add a symbol before testing this machine.';
  }
  // Start with a table before capture() is ever needed.
  render();
  $('#update-table').onclick = () => {
    try { rebuild(); error.hidden = true; }
    catch (failure) { error.textContent = failure.message; error.hidden = false; }
  };
  form.onsubmit = async event => {
    event.preventDefault();
    const button = $('#save-machine');
    button.disabled = true;
    try {
      rebuild();
      const result = capture();
      const name = $('#machine-name').value.trim();
      if (!name) throw new Error('Give your machine a name.');
      await onSave({name, description: $('#editor-description').value.trim(), definition: result});
      dialog.close();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally { button.disabled = false; }
  };
  dialog.showModal();
}
