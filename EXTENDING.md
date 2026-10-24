# Extending Automata Lab

The original model, integration adapter, and interface are separate.

## Add a model operation

1. Obtain approval before modifying the user’s source. Otherwise use an exact copy of an approved model version.
2. Add a descriptor to the operations array in dist/adapters/dfa.js.
3. Validate and delegate to the model inside its run function.
4. Add tests for the new behavior.

The worker sends operation metadata to the page. Operation forms are rendered automatically; the HTML does not contain a fixed union/Cartesian operation list.

Illustrative descriptor shape (not an implemented feature):

~~~js
{
  id: 'your-operation',
  title: 'Your operation',
  symbol: 'ƒ',
  label: 'Run operation',
  description: 'Explain the input and result.',
  fields: [
    {key: 'sourceId', modelKey: 'source', type: 'machine', label: 'Source machine'},
    {key: 'name', type: 'text', label: 'Result name'}
  ],
  run(payload) {
    // payload.source contains the selected machine's definition.
    // Validate and call the model method here.
  }
}
~~~

Current field types: machine, text, set. Add a renderer to **fieldRenderers** for a new field type. A machine field binds its definition to modelKey, or to its key with the Id suffix removed. Display labels are passed alongside it.

Result contracts:

- A result with kind “machine”, type, definition, and optional stateLabels creates a new machine through the workspace coordinator.
- A result with kind “set”, values, and count uses the set renderer.
- Add another **resultRenderers** entry for a new non-machine result shape.

Names, descriptions, field bindings, glyphs, and messages come from descriptor metadata. The controller does not calculate language operations.

## Add NFA or GNFA support

These require their own semantics, not a new label on a DFA.

1. Add the approved model code to the isolated worker.
2. Create an adapter calling **registerMachineType** with an ID, label, capabilities, describe validator/serializer, and operation descriptors.
3. Load it with importScripts in core/model-worker.js.
4. Register a view in **machineViews** before app initialization:
   - graph: implements draw, highlight, zoom, fit, exportSvg;
   - renderDefinition(machine);
   - renderTable(machine);
   - editor(machine, onSave);
   - optional onTrace(state) for another trace-state representation.
5. Update the roadmap labels when the feature works. A type selector appears automatically when several registered types have editors.
6. Add model, adapter, serialization, and browser checks.

NFA editors/renderers need multiple destinations and ε-transitions. GNFA labels may be expressions rather than single input symbols. Keep those differences in their adapters and views.

## Portable data boundary

Current DFA definition:

~~~json
{
  "states": ["q0", "q1"],
  "alphabet": ["0", "1"],
  "transitions": {
    "q0": {"0": "q1", "1": "q0"},
    "q1": {"0": "q0", "1": "q1"}
  },
  "startState": "q0",
  "acceptStates": ["q0"]
}
~~~

A machine also has type, name, description, and optional stateLabels. The original five-item constructor tuple is assembled inside the adapter.

Exports use version 1:

~~~js
{version: 1, kind: 'automata-machine', machine}
{version: 1, kind: 'automata-workspace', machines}
~~~

Imports are revalidated by the model type’s adapter. Errors cross the worker boundary as ordinary messages.

## UI boundaries

- ui/dfa-view.js: definition and transition-table rendering.
- ui/graph.js: deterministic-state diagram.
- ui/editor.js: single-destination transition editing.
- ui/simulation.js: normalized run results and playback.
- ui/registry.js: metadata-driven forms and view/field/result registries.

These modules can be replaced independently. The shared shell handles navigation, persistence, imports, exports, and selection.
