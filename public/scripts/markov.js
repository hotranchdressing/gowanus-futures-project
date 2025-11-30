class MarkovGenerator {
    constructor(text, stateSize = 2) {
        this.stateSize = stateSize;
        this.chain = {};
        this.beginnings = [];
        
        if (text) {
            this.buildChain(text);
        }
    }
    
    buildChain(text) {
        // Split into words
        const words = text.split(/\s+/).filter(w => w.length > 0);
        
        // Build chain
        for (let i = 0; i < words.length - this.stateSize; i++) {
            const state = words.slice(i, i + this.stateSize).join(' ');
            const next = words[i + this.stateSize];
            
            // Track sentence beginnings (words that start with capital letter)
            if (i === 0 || /^[A-Z]/.test(words[i])) {
                this.beginnings.push(state);
            }
            
            if (!this.chain[state]) {
                this.chain[state] = [];
            }
            this.chain[state].push(next);
        }
    }
    
    generate(maxWords = 50, minWords = 15) {
        if (this.beginnings.length === 0) return null;
        
        let attempts = 0;
        const maxAttempts = 100;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // Start with random beginning
            let current = this.beginnings[Math.floor(Math.random() * this.beginnings.length)];
            let result = current.split(' ');
            let sentenceCount = 0;
            
            // Generate words
            for (let i = 0; i < maxWords; i++) {
                const state = result.slice(-this.stateSize).join(' ');
                const choices = this.chain[state];
                
                if (!choices || choices.length === 0) {
                    // Dead end - try adding a period if long enough
                    if (result.length >= minWords) {
                        const lastWord = result[result.length - 1];
                        if (!/[.!?]$/.test(lastWord)) {
                            result[result.length - 1] = lastWord + '.';
                        }
                        return result.join(' ');
                    }
                    break; // Too short, try again
                }
                
                const next = choices[Math.floor(Math.random() * choices.length)];
                result.push(next);
                
                // Check for sentence ending
                if (/[.!?]$/.test(next)) {
                    sentenceCount++;
                    
                    // Stop after 2 sentences OR if we've hit minWords
                    if (sentenceCount >= 2 || result.length >= minWords) {
                        return result.join(' ');
                    }
                }
                
                // Hard cap at maxWords
                if (result.length >= maxWords) {
                    const lastWord = result[result.length - 1];
                    if (!/[.!?]$/.test(lastWord)) {
                        result[result.length - 1] = lastWord + '.';
                    }
                    return result.join(' ');
                }
            }
            
            // If we got here and have enough words, force an ending
            if (result.length >= minWords && result.length <= maxWords) {
                const lastWord = result[result.length - 1];
                if (!/[.!?]$/.test(lastWord)) {
                    result[result.length - 1] = lastWord + '.';
                }
                return result.join(' ');
            }
        }
        
        return null; // Failed to generate
    }
    
    static combine(models, weights) {
        const combined = new MarkovGenerator(null);
        combined.stateSize = models[0].stateSize;
        
        // Calculate total chain sizes for normalization
        const chainSizes = models.map(model => Object.keys(model.chain).length);
        const totalChainSize = chainSizes.reduce((a, b) => a + b, 0);
        
        models.forEach((model, idx) => {
            const weight = weights[idx];
            
            if (weight === 0) return;
            
            // Normalize weight by corpus size
            const sizeRatio = chainSizes[idx] / totalChainSize;
            const normalizedWeight = weight / sizeRatio;
            
            console.log(`Model ${idx}: weight=${weight}, size=${chainSizes[idx]}, normalized=${normalizedWeight.toFixed(3)}`);
            
            // Add beginnings proportionally with normalized weight
            const numBeginnings = Math.max(1, Math.floor(model.beginnings.length * normalizedWeight * 5));
            for (let i = 0; i < numBeginnings; i++) {
                const beginning = model.beginnings[Math.floor(Math.random() * model.beginnings.length)];
                combined.beginnings.push(beginning);
            }
            
            // Add chain entries with normalized weight
            Object.keys(model.chain).forEach(state => {
                if (!combined.chain[state]) {
                    combined.chain[state] = [];
                }
                
                const choices = model.chain[state];
                const numCopies = Math.max(1, Math.floor(normalizedWeight * 10));
                
                for (let copy = 0; copy < numCopies; copy++) {
                    combined.chain[state].push(...choices);
                }
            });
        });
        
        return combined;
    }
}

function generateSafeSentence(combinedModel, maxAttempts = 1) {
    for (let i = 0; i < maxAttempts; i++) {
        const sentence = combinedModel.generate(50, 10);
        if (sentence && sentence.split(' ').length >= 10 && sentence.split(' ').length <= 50) {
            return sentence;
        }
    }
    return null;
}