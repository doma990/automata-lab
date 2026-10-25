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

        // Different alphabets
        if (!(a.getAlphabet().isSubsetOf(b.getAlphabet()) && a.getAlphabet().size === b.getAlphabet().size)) {
            throw new Error(`Alphabets should be the same!`);
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
    
    static intersection(a, b) {
        if (!(a instanceof DFA && b instanceof DFA)) {
            throw new Error(`Invalid Input!`);
        }

        // Different alphabets
        if (!(a.getAlphabet().isSubsetOf(b.getAlphabet()) && a.getAlphabet().size === b.getAlphabet().size)) {
            throw new Error(`Alphabets should be the same!`);
        }

        // Building Q
        const states = DFA.cartesianProduct(a.getStates(), b.getStates());
        const alphabet = new Set(a.getAlphabet());
        const startState = `${a.getStartState()},${b.getStartState()}`;
        const acceptStates = DFA.cartesianProduct(a.getAcceptStates(), b.getAcceptStates());
        
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

    static complement(a) {
        if (!(a instanceof DFA)) {
            throw new Error(`Invalid Input!`);
        }

        // Building Q
        return new DFA([a.getStates(), a.getAlphabet(), a.delta, a.getStartState(), a.getStates().difference(a.getAcceptStates())]);
    }
}
