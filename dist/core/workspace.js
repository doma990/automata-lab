export const STORAGE_KEY = 'adam-automata-lab-workspace-v1';
export const newId = () => crypto.randomUUID();
export function makeMachine(name, description, definition, extra = {}) {
  return {id: newId(), type: 'dfa', name, description, definition, ...extra};
}
export function exampleMachines() {
  return [
    makeMachine('Ends with 01', 'Binary strings whose final two symbols are 01.', {
      states: ['q0', 'q1', 'q2'], alphabet: ['0', '1'],
      transitions: {q0: {'0': 'q1', '1': 'q0'}, q1: {'0': 'q1', '1': 'q2'}, q2: {'0': 'q1', '1': 'q0'}},
      startState: 'q0', acceptStates: ['q2']
    }),
    makeMachine('Even number of 0s', 'Binary strings containing an even number of 0s. Examples: 1, 00, 010.', {
      states: ['even', 'odd'], alphabet: ['0', '1'],
      transitions: {even: {'0': 'odd', '1': 'even'}, odd: {'0': 'even', '1': 'odd'}},
      startState: 'even', acceptStates: ['even']
    }),
    makeMachine('Binary multiples of 3', 'Binary strings representing a number divisible by 3, such as 0, 11, and 110. Leading zeros are allowed.', {
      states: ['r0', 'r1', 'r2'], alphabet: ['0', '1'],
      transitions: {r0: {'0': 'r0', '1': 'r1'}, r1: {'0': 'r2', '1': 'r0'}, r2: {'0': 'r1', '1': 'r2'}},
      startState: 'r0', acceptStates: ['r0']
    })
  ];
}
export function parseSet(text) {
  return text.split(/[,\n]/).map(value => value.trim()).filter(Boolean);
}
export function normalizeImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Import a machine or workspace JSON object.');
  const items = data.kind === 'automata-workspace' ? data.machines : data.kind === 'automata-machine' ? [data.machine] : data.definition ? [data] : null;
  if (data.version !== undefined && data.version !== 1) throw new Error('This JSON version is not supported.');
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new Error('Import a machine or workspace JSON exported by Automata Lab (up to 20 machines).');
  return items.map(item => {
    if (!item || typeof item.type !== 'string' || !item.definition) throw new Error('Each imported machine needs a type and a definition.');
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 64) throw new Error('Give each imported machine a name of up to 64 characters.');
    if (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > 240)) throw new Error('Descriptions must be text of up to 240 characters.');
    const stateLabels = {};
    if (item.stateLabels && typeof item.stateLabels === 'object') {
      for (const state of item.definition.states || []) {
        const label = item.stateLabels[state];
        if (typeof label === 'string' && label.length <= 240) stateLabels[state] = label;
      }
    }
    return {...makeMachine(item.name.trim(), item.description || '', item.definition), type: item.type, stateLabels};
  });
}


// Upgrade only untouched starter examples in workspaces saved before this revision.
// User-edited definitions/descriptions and later explicit imports are preserved.
export function upgradeExampleMachines(machines, revision = 0) {
  if (revision >= 2) return machines;
  const defaults = exampleMachines();
  const fingerprint = definition => JSON.stringify([
    definition.states, definition.alphabet, definition.startState, definition.acceptStates,
    definition.states.map(state => definition.alphabet.map(symbol => definition.transitions[state]?.[symbol]))
  ]);
  const legacy = {
    states: ['q0','q1','q2','q3','q4','q5'], alphabet: ['0','1'],
    transitions: {q0: {'0':'q1','1':'q4'}, q1: {'0':'q2','1':'q3'}, q2: {'0':'q1','1':'q4'}, q3: {'0':'q5','1':'q4'}, q4: {'0':'q5','1':'q3'}, q5: {'0':'q5','1':'q5'}},
    startState: 'q0', acceptStates: ['q1','q4']
  };
  return machines.map(machine => {
    if (machine.name === 'Original six-state DFA' &&
        machine.description === 'The example supplied alongside the original JavaScript model.' &&
        fingerprint(machine.definition) === fingerprint(legacy)) {
      return {...defaults[2], id: machine.id};
    }
    if (machine.name === 'Even number of 0s' &&
        machine.description === 'Accepts the empty string and binary strings containing an even number of 0s.' &&
        fingerprint(machine.definition) === fingerprint(defaults[1].definition)) {
      return {...machine, description: defaults[1].description};
    }
    return machine;
  });
}
