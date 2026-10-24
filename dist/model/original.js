class String {

    constructor(str) {
        this.string = str;
    }

    getString() {
        return this.string;
    }

    setString(str) {
        this.string = str;
    }

    getPrefixes() {
        const prefixes = [""];
        for (const symbol of this.string) {
            prefixes.push(prefixes[prefixes.length - 1] + symbol);
        }
        return prefixes;
    }

    getSuffixes() {
        const suffixes = [""];
        for (const symbol of this.string.split("").reverse()) {
            suffixes.push(symbol + suffixes[suffixes.length - 1]);
        }
        return suffixes;
    }

    getSubstrings() {
        const substrings = new Set();
        for (const prefix of this.getPrefixes()) {
            const prefixObj = new String(prefix);
            for (const suffix of prefixObj.getSuffixes()) {
                substrings.add(suffix);
            }
        }
        return substrings;
    }

}

class DFA {
    // M = (Q, Sigma, Delta, q0, F)
    constructor(definition) {
        if (!Array.isArray(definition) || definition.length !== 5) {
            throw new Error("Input is an incorrect DFA definition.");
        }

        this.states = new Set(definition[0]);
        this.alphabet = new Set(definition[1]);
        this.delta = structuredClone(definition[2]);
        this.startState = definition[3];
        this.acceptStates = new Set(definition[4]);
    }

    getStates() {
        return this.states;
    }

    getAlphabet() {
        return this.alphabet;
    }

    getStartState() {
        return this.startState;
    }

    getAcceptStates() {
        return this.acceptStates;
    }
    
    accepts(string) {
        return this.acceptStates.has(this.simulate(string));
    }

    simulate(string) {
        let currentState = this.startState;
        for (const symbol of string) {
            if (!this.alphabet.has(symbol)) {
                throw new Error(`${symbol} does not belong to the DFA's alphabet.`);
            }
            currentState = this.delta[currentState][symbol];
        }
        return currentState;
    }

    transition(currentState, inputSymbol) {
        return this.delta[currentState][inputSymbol];
    }

    static cartesianProduct(a, b) {
        const set = new Set();
        a.forEach(elementA => {
            b.forEach(elementB => {
                set.add(`${elementA},${elementB}`);
            });
        });
        return set;
    }

    static union(a, b) {
        if (!(a instanceof DFA && b instanceof DFA)) {
            throw new Error(`Invalid Input!`);
        }

        // Building Q
        const states = DFA.cartesianProduct(a.getStates(), b.getStates());
        const alphabet = new Set(a.getAlphabet());
        const startState = `${a.getStartState()},${b.getStartState()}`;
        const acceptStates = DFA.cartesianProduct(a.getStates(), b.getAcceptStates()).union(DFA.cartesianProduct(a.getAcceptStates(), b.getStates()));
        
        const delta = {};
        states.forEach(state => {
            delta[state] = {};
            const [q1, q2] = state.split(',');
            alphabet.forEach(symbol => {
                delta[state][symbol] = `${a.transition(q1, symbol)},${b.transition(q2, symbol)}`;
            });
        });

        return new DFA([states, alphabet, delta, startState, acceptStates]);
    }
}

let states = new Set(['q0', 'q1', 'q2', 'q3', 'q4', 'q5']);
let alphabet = new Set(['0', '1']);
let transitionFunction = {
    'q0': {
        '0': 'q1',
        '1': 'q4'
    },
    'q1': {
        '0': 'q2',
        '1': 'q3'
    },
    'q2': {
        '0': 'q1',
        '1': 'q4'
    },
    'q3': {
        '0': 'q5',
        '1': 'q4'
    },
    'q4': {
        '0': 'q5',
        '1': 'q3'
    },
    'q5': {
        '0': 'q5',
        '1': 'q5'
    }
};
const myDFA = new DFA([states, alphabet, transitionFunction, 'q0', ['q1', 'q4']]);

