# Automata Lab

**Status:** ongoing independent project.

[Open the workspace](https://doma990.github.io/projects/automata-lab/demo/) · [Project overview](https://doma990.github.io/projects/automata-lab/)
DFA functionality is available now. NFA and GNFA support are planned.

## Local development

Run `node serve.cjs` from this folder and open http://127.0.0.1:4175/. No package installation or build step is required.

This checkout supports **union**, **intersection**, and **complement** in the Operations tab. Union and intersection need equal alphabets; complement uses one complete DFA and keeps its alphabet. Results become saved, editable machines and can be exported as JSON or SVG.

The model classes live in `dist/model/dfa.js` and `dist/model/formalstring.js`. The worker loads them; `dist/adapters/dfa.js` connects their operations to the interface. NFA and GNFA remain planned.

Run the checks with `node --test tests/model.test.cjs`.

The public portfolio workspace is deployed separately; local edits and GitHub commits do not automatically update it.
