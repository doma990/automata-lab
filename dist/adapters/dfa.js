/* Integration boundary: validates inputs and delegates algorithms to the unchanged DFA. */
(() => {
  const reserved = new Set(['__proto__', 'constructor', 'prototype']);
  const asText = value => ''.constructor(value);
  function list(value, label, maximum) {
    if (!Array.isArray(value) || value.length > maximum) throw new Error(label + ' must be a list of at most ' + maximum + ' entries.');
    if (value.some(item => typeof item !== 'string' || !item.length || item.length > 64 || /[\u0000-\u001f]/.test(item) || reserved.has(item))) {
      throw new Error(label + ' must contain nonempty text labels, without control characters or reserved object names.');
    }
    if (new Set(value).size !== value.length) throw new Error(label + ' contains duplicate entries.');
    return value;
  }
  function validate(definition) {
    if (!definition || typeof definition !== 'object') throw new Error('A machine definition is required.');
    const states = list(definition.states, 'States', 144);
    const alphabet = list(definition.alphabet, 'Alphabet', 12);
    if (!states.length) throw new Error('Add at least one state.');
    if (alphabet.some(symbol => [...symbol].length !== 1)) throw new Error('Each alphabet symbol must be exactly one Unicode character.');
    if (!states.includes(definition.startState)) throw new Error('Choose a start state from the state set.');
    const acceptStates = list(definition.acceptStates, 'Accepting states', 144);
    if (acceptStates.some(state => !states.includes(state))) throw new Error('Accepting states must belong to the state set.');
    const transitions = definition.transitions;
    if (!transitions || typeof transitions !== 'object' || Array.isArray(transitions)) throw new Error('Provide a transition table.');
    for (const state of states) {
      if (!Object.hasOwn(transitions, state) || !transitions[state] || typeof transitions[state] !== 'object') throw new Error('Missing transitions for ' + state + '.');
      for (const symbol of alphabet) {
        if (!Object.hasOwn(transitions[state], symbol) || !states.includes(transitions[state][symbol])) {
          throw new Error('Choose a valid target for δ(' + state + ', ' + symbol + ').');
        }
      }
    }
    return {states, alphabet, transitions, startState: definition.startState, acceptStates};
  }
  function make(definition) {
    const checked = validate(definition);
    return new DFA([checked.states, checked.alphabet, checked.transitions, checked.startState, checked.acceptStates]);
  }
  function serialize(machine) {
    const states = [...machine.getStates()];
    const alphabet = [...machine.getAlphabet()];
    const transitions = Object.fromEntries(states.map(state => [state, Object.fromEntries(alphabet.map(symbol => [symbol, machine.transition(state, symbol)]))]));
    return {states, alphabet, transitions, startState: machine.getStartState(), acceptStates: [...machine.getAcceptStates()]};
  }
  function run(machine, input) {
    if (typeof input !== 'string' || [...input].length > 256) throw new Error('Use a string of up to 256 symbols.');
    if (input.length === 0) throw new Error('Enter at least one symbol.');
    const finalState = machine.simulate(input);
    const accepted = machine.accepts(input);
    let current = machine.getStartState();
    const trace = [{state: current, symbol: null, index: 0}];
    [...input].forEach((symbol, index) => {
      current = machine.transition(current, symbol);
      trace.push({state: current, symbol, index: index + 1});
    });
    return {input, finalState, accepted, trace};
  }
  function canonicalize(definition, prefix) {
    const source = make(definition);
    const names = new Map([...source.getStates()].map((state, index) => [state, prefix + index]));
    const reverse = Object.fromEntries([...names].map(([original, canonical]) => [canonical, original]));
    const states = [...names.values()];
    const transitions = Object.fromEntries([...names].map(([state, key]) => [
      key, Object.fromEntries([...source.getAlphabet()].map(symbol => [symbol, names.get(source.transition(state, symbol))]))
    ]));
    return {machine: new DFA([states, source.getAlphabet(), transitions, names.get(source.getStartState()), [...source.getAcceptStates()].map(state => names.get(state))]), reverse};
  }
  registerMachineType({
    id: 'dfa', label: 'DFA', capabilities: ['simulate', 'batch', 'transition', 'diagram', 'transition-table', 'edit'],
    serialize,
    describe(definition) { return serialize(make(definition)); },
    operations: [
      {id: 'simulate', visible: false, run(payload) { return run(make(payload.definition), payload.input); }},
      {id: 'batch', visible: false, run(payload) {
        if (!Array.isArray(payload.inputs)) throw new Error('Provide a list of strings.');
        const inputs = payload.inputs.filter(input => input !== '');
        if (!inputs.length || inputs.length > 50) throw new Error('Enter 1–50 strings to test.');
        const machine = make(payload.definition);
        return inputs.map(input => { try { const {trace, ...result} = run(machine, input); return result; } catch (error) { return {input, error: error.message}; } });
      }},
      {id: 'transition', visible: false, run(payload) {
        const machine = make(payload.definition);
        if (!machine.getStates().has(payload.state) || !machine.getAlphabet().has(payload.symbol)) throw new Error('Choose a state and a symbol from this machine.');
        return {state: payload.state, symbol: payload.symbol, next: machine.transition(payload.state, payload.symbol)};
      }},
      {
        id: 'union', symbol: '∪', defaultName: 'Union machine', successMessage: 'Union created', title: 'Union of two machines', label: 'Create union',
        description: 'Build a DFA that accepts a string when either input machine accepts it. Both alphabets must match.',
        fields: [{key: 'leftId', type: 'machine', label: 'First machine'}, {key: 'rightId', type: 'machine', selection: 'other', label: 'Second machine'}, {key: 'name', type: 'text', label: 'Result name', placeholder: 'Union machine'}],
        run(payload) {
          const leftDefinition = validate(payload.left);
          const rightDefinition = validate(payload.right);
          if (leftDefinition.alphabet.length !== rightDefinition.alphabet.length || leftDefinition.alphabet.some(symbol => !rightDefinition.alphabet.includes(symbol))) throw new Error('Union requires the same alphabet in both machines.');
          if (leftDefinition.states.length * rightDefinition.states.length > 144) throw new Error('This union would exceed the workspace limit of 144 states. Choose smaller machines.');
          // Temporary canonical labels avoid the original union's comma-based state splitting.
          // This also permits unions of earlier union results without changing the model.
          const left = canonicalize(payload.left, 'a');
          const right = canonicalize(payload.right, 'b');
          const product = DFA.union(left.machine, right.machine);
          const raw = serialize(product);
          const ids = new Map(raw.states.map((state, index) => [state, 'u' + index]));
          const stateLabels = {};
          for (const state of raw.states) {
            const [a, b] = state.split(',');
            const leftState = left.reverse[a];
            const rightState = right.reverse[b];
            stateLabels[ids.get(state)] = '(' + (payload.leftLabels?.[leftState] || leftState) + ', ' + (payload.rightLabels?.[rightState] || rightState) + ')';
          }
          const definition = {
            states: raw.states.map(state => ids.get(state)), alphabet: raw.alphabet,
            transitions: Object.fromEntries(raw.states.map(state => [ids.get(state), Object.fromEntries(raw.alphabet.map(symbol => [symbol, ids.get(raw.transitions[state][symbol])]))])),
            startState: ids.get(raw.startState), acceptStates: raw.acceptStates.map(state => ids.get(state))
          };
          return {kind: 'machine', type: 'dfa', definition, stateLabels};
        }
      },
      {
        id: 'cartesian', visible: false, symbol: '×', title: 'Cartesian product', label: 'Calculate product',
        description: 'Inspect the state-pair construction used by union. This produces a set, not a new machine.',
        fields: [{key: 'left', type: 'set', label: 'First set', placeholder: 'q0, q1'}, {key: 'right', type: 'set', label: 'Second set', placeholder: 'p0, p1'}],
        run(payload) {
          const left = list(payload.left, 'First set', 24);
          const right = list(payload.right, 'Second set', 24);
          if ([...left, ...right].some(value => value.includes(','))) throw new Error('Set elements in this demonstration cannot contain commas.');
          if (left.length * right.length > 144) throw new Error('Use sets whose product contains at most 144 pairs.');
          const values = [...DFA.cartesianProduct(new Set(left), new Set(right))];
          return {kind: 'set', values, count: values.length};
        }
      }
    ]
  });
})();
