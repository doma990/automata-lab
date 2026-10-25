class FormalString {

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
            const prefixObj = new FormalString(prefix);
            for (const suffix of prefixObj.getSuffixes()) {
                substrings.add(suffix);
            }
        }
        return substrings;
    }

}