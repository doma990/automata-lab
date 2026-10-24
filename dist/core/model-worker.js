/* The original model runs in this worker, isolated from the page's native String. */
const machineAdapters = new Map();
function registerMachineType(adapter) {
  if (machineAdapters.has(adapter.id)) throw new Error('Machine type already registered.');
  machineAdapters.set(adapter.id, adapter);
}
// Compatibility only: the model calls Set.union, which older browsers may lack.
if (!Set.prototype.union) {
  Object.defineProperty(Set.prototype, 'union', {
    configurable: true, writable: true,
    value: function (other) { const result = new Set(this); for (const value of other) result.add(value); return result; }
  });
}
importScripts('../model/original.js', '../adapters/dfa.js');
self.addEventListener('message', event => {
  const {id, action, payload = {}} = event.data;
  try {
    let result;
    if (action === 'catalog') {
      result = {
        types: [...machineAdapters.values()].map(adapter => ({
          id: adapter.id, label: adapter.label, capabilities: adapter.capabilities,
          operations: adapter.operations.map(({run, ...metadata}) => metadata)
        }))
      };
    } else if (action === 'word') {
      const text = payload.text;
      if (typeof text !== 'string' || text.length === 0 || [...text].length > 24) throw new Error('Enter 1–24 characters in String tools.');
      if ([...text].some(character => character.length > 1)) {
        throw new Error('String tools currently support basic Unicode characters only. The original suffix method reverses UTF-16 units, so emoji and other non-BMP characters are not supported here. DFA simulation still accepts single Unicode symbols.');
      }
      const word = new String('');
      word.setString(text);
      result = {text: word.getString(), prefixes: word.getPrefixes(), suffixes: word.getSuffixes(), substrings: [...word.getSubstrings()]};
    } else {
      const adapter = machineAdapters.get(payload.type);
      if (!adapter) throw new Error('This machine type is not available yet.');
      if (action === 'describe') result = adapter.describe(payload.definition);
      else if (action === 'execute') {
        const operation = adapter.operations.find(item => item.id === payload.operation);
        if (!operation) throw new Error('This operation is not supported by this machine type.');
        result = operation.run(payload);
      } else throw new Error('Unknown model request.');
    }
    self.postMessage({id, ok: true, result});
  } catch (error) {
    self.postMessage({id, ok: false, error: error.message || 'The model could not complete this request.'});
  }
});
