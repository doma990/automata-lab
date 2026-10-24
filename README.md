# Automata Lab

A browser workspace around Adam Ibrahim’s JavaScript DFA and String model.

**Status:** ongoing independent project.

[Open the workspace](https://doma990.github.io/projects/automata-lab/demo/) · [Project overview](https://doma990.github.io/projects/automata-lab/)
DFA functionality is available now. NFA and GNFA support are planned.

## Run locally

From this folder:

~~~sh
node serve.cjs
~~~

Open **http://127.0.0.1:4175/** in a modern browser. No package installation or build step is required. The server only serves files; model execution happens in the browser.

## What you can do

- **New machine / Edit machine:** define states, alphabet, start state, accepting states, and every transition. “Update table” applies changes to the state and symbol lists.
- **Diagram / Transition table:** inspect the same definition in two views. Select states, pan, zoom, and fit the diagram.
- **Test a string:** inspect acceptance and final state; play, step forward/backward, or jump through the trace. Blank inputs are not accepted by this interface.
- **Batch test:** one string per line. Blank lines are ignored; invalid inputs are reported individually.
- **Operations:** create a union machine. Union requires identical alphabets.
- **String tools:** prefixes, suffixes, and unique substrings. Non-empty results can be tested in the active machine; zero-length results are display-only.
- **Transition inspector:** query δ(state, symbol).
- **Import / Export:** portable machine and workspace JSON; diagram SVG export.
- **Workspace:** duplicate/delete machines and automatic browser storage. Export JSON for a portable backup.

Examples include binary strings ending in 01, an even number of 0s, and binary numbers divisible by 3.

## The original model is preserved

[dist/model/original.js](dist/model/original.js) is an exact, unmodified copy of the supplied script.js. The source on the computer has not been edited.

SHA-256 of both files:

~~~text
2f3487f0b451263ae2a365abd440e360ee9166e62f3cd564814b1e96199dee9a
~~~

| Interface | Original model methods |
| --- | --- |
| Definition/table | getStates, getAlphabet, getStartState, getAcceptStates, transition |
| Simulation/trace | simulate, accepts, transition |
| Union | DFA.union |
| Union’s internal state-pair construction | DFA.cartesianProduct |
| String tools | getString, setString, getPrefixes, getSuffixes, getSubstrings |

The model runs in a Web Worker, so its String class does not shadow the page’s native String. A small worker-scoped Set.union compatibility shim is used only when needed.

## Integration safeguards

These live outside the original model:

- Validate definitions, complete transition tables, imports, and equal alphabets for union.
- Reject reserved object-property names and malformed inputs.
- Canonicalize temporary state IDs before calling the original union, then assign readable display labels. This avoids comma collisions and supports repeated unions.
- Build the trace through the original transition method.
- Bound inputs and machine sizes to keep the browser responsive.

The original suffix method reverses UTF-16 code units. String tools explicitly reject non-BMP characters such as emoji instead of displaying broken suffixes. **DFA simulation still supports single Unicode symbols, including emoji.** No replacement string algorithm is used.

## Current limits

- 20 saved machines; at least one remains in the workspace.
- 144 states and 12 single-character symbols per machine.
- Union products of at most 144 states.
- 256 symbols per test; 50 strings per batch.
- 24 basic Unicode characters in String tools.
- JSON imports up to 80 KB and 20 machines.

The accepting set may be empty. A machine without alphabet symbols can be defined, but needs a symbol before testing. For large machines, use the transition table for detailed inspection.

## Structure

~~~text
dist/
  model/original.js       Unmodified supplied model
  core/model-worker.js   Isolated model and request routing
  core/bridge.js         Browser ↔ worker requests
  core/workspace.js      Data format and import validation
  adapters/dfa.js        Validation and delegation to DFA methods
  ui/registry.js         Operation forms and type-view registry
  ui/dfa-view.js         DFA definition and transition table
  ui/graph.js            Interactive SVG
  ui/editor.js           DFA editor
  ui/simulation.js       Runs, playback, batches, String tools
  app.js                 Workspace coordination
  index.html
  styles.css
~~~

See [EXTENDING.md](EXTENDING.md) for adding operations and future machine families.

## Checks

~~~sh
node --test tests/model.test.cjs
~~~

Tests cover acceptance, traces, unions, repeated unions, transition lookup, validation, Cartesian products, String methods, Unicode behavior, imports, and source preservation. Browser review also covers creation, import/export, persistence, and responsive layouts.

Tested with Node.js 24 and the Chromium-based preview browser. No external libraries or network services are required.

## Roadmap

DFA functionality is available in the live workspace. NFA and GNFA functionality is planned and is not implemented in this version. See [EXTENDING.md](EXTENDING.md) for how new model families can be integrated.
