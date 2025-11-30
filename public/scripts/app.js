// Offensive word filter to process youtube comments etc.
const OFFENSIVE_PATTERNS = [
    /\bn+[i1!]+[g69]+[e3a@]+r+s?\b/i,
    /\bn+[i1!]+[g69]+[g69]+[a@]+\b/i,
    /\bnegro\b/i,
    /\bc[o0]+[o0]+n\b/i,
    /\bsp[i1]+c\b/i
];

function containsOffensiveContent(text) {
    return OFFENSIVE_PATTERNS.some(pattern => pattern.test(text));
}

function isTableGarbage(text) {
    // Check for table-like patterns
    
    // 1. Too many numbers in a row
    const numbers = text.match(/\d+/g) || [];
    if (numbers.length > 15) return true;
    
    // 2. Too many short repeated patterns (like "H H L L L L")
    const words = text.split(/\s+/);
    const shortWords = words.filter(w => w.length <= 3);
    if (shortWords.length > words.length * 0.4) return true; // More than 40% short words
    
    // 3. Too many dashes or underscores (table separators)
    const dashes = (text.match(/--/g) || []).length;
    if (dashes > 3) return true;
    
    // 4. Repetitive single letters
    const singleLetterPattern = /\b[A-Z]\s+[A-Z]\s+[A-Z]\s+[A-Z]/;
    if (singleLetterPattern.test(text)) return true;
    
    // 5. Too many parentheses (common in table headers)
    const parens = (text.match(/\(/g) || []).length;
    if (parens > 5) return true;
    
    // 6. Check for repeating word patterns (like "Heads GW Elev" repeated)
    const repeatingPattern = /(\b\w+\s+\w+\s+\w+\b).*\1.*\1/;
    if (repeatingPattern.test(text)) return true;
    
    return false;
}

// Global state
let models = {};
let currentYear = 2025;

// Contamination presets by year
const CONTAMINATION_PRESETS = {
    2020: { epa: 0.8, blogs: 0, youtube: 0, tiktok: 0, reviews: 0.1, twitter: 0.1, cyborg: 0 },
    2027: { epa: 0.35, blogs: 0.13, youtube: 0.12, tiktok: 0.12, reviews: 0.01, twitter: 0.22, cyborg: 0.05 },
    2030: { epa: 0.40, blogs: 0.25, youtube: 0.06, tiktok: 0.06, reviews: 0.07, twitter: 0.06, cyborg: 0.10 },
    2035: { epa: 0.15, blogs: 0.06, youtube: 0.06, tiktok: 0.06, reviews: 0.335, twitter: 0.185, cyborg: 0.15 },
    2040: { epa: 0.06, blogs: 0.06, youtube: 0.06, tiktok: 0.06, reviews: 0.31, twitter: 0.25, cyborg: 0.20 },
    2050: { epa: 0.05, blogs: 0.06, youtube: 0.06, tiktok: 0.06, reviews: 0.26, twitter: 0.26, cyborg: 0.25 },
    2060: { epa: 0.05, blogs: 0, youtube: 0, tiktok: 0, reviews: 0.325, twitter: 0.325, cyborg: 0.30 }
};

// Load corpora and build models
async function initializeMarkov() {
    console.log('Loading corpora...');
    
    const response = await fetch('public\data\corpora.json');
    const corpora = await response.json();
    
    console.log('Building Markov models...');
    
    // Build model for each corpus
    models.epa = new MarkovGenerator(corpora.epa, 2);
    models.blogs = new MarkovGenerator(corpora.blogs, 2);
    models.youtube = new MarkovGenerator(corpora.youtube, 2);
    models.tiktok = new MarkovGenerator(corpora.tiktok, 2);
    models.reviews = new MarkovGenerator(corpora.google_reviews, 2);
    models.twitter = new MarkovGenerator(corpora.twitter, 2);
    models.cyborg = new MarkovGenerator(corpora.cyborg, 2);
    
    console.log('✓ Markov models ready!');
    
    // Generate first sentence
    generateAndDisplay();
}

// Function to be called from knobs.js
function setYearFromKnob(year) {
    currentYear = year;
}

// Export min/max words for markov generation
function getCurrentWordLimits() {
    return {
        min: window.currentMinWords || 20,
        max: window.currentMaxWords || 35
    };
}

function generateAndDisplay() {
    const weights = CONTAMINATION_PRESETS[currentYear] || CONTAMINATION_PRESETS[2020];
    
    // Interpolate weights if year isn't in presets
    const interpolatedWeights = interpolateWeights(currentYear);
    
    console.log(`Generating for year ${currentYear}`);
    
    // Get current word limits from knob
    const limits = getCurrentWordLimits();
    console.log('Word limits:', limits);
    
    // Combine models with current weights
    const combined = MarkovGenerator.combine(
        [models.epa, models.blogs, models.youtube, models.tiktok, models.reviews, models.twitter, models.cyborg],
        [interpolatedWeights.epa, interpolatedWeights.blogs, interpolatedWeights.youtube, interpolatedWeights.tiktok, interpolatedWeights.reviews, interpolatedWeights.twitter, interpolatedWeights.cyborg]
    );
    
    // Try generating with ALL filters
    let successfulSentence = null;
    
    for (let i = 0; i < 100; i++) {
        const sentence = combined.generate(limits.max, limits.min);
        
        if (sentence && sentence.length > 50) {
            const wordCount = sentence.split(' ').length;
            console.log(`Attempt ${i+1}: ${wordCount} words`);
            
            const uniqueChars = new Set(sentence.replace(/\s/g, '').toLowerCase());
            const isGarbage = uniqueChars.size < 10;
            const isTable = isTableGarbage(sentence);
            
            if (!isGarbage && !isTable && !containsOffensiveContent(sentence) && wordCount <= limits.max) {
                successfulSentence = sentence;
                console.log(`✓ Generated (attempt ${i+1}): ${wordCount} words`);
                break;
            }
        }
    }
    
    // Fallback logic
    if (!successfulSentence) {
        console.log('Using fallback generation from dominant model');
        
        let dominantModel = models.epa;
        let maxWeight = interpolatedWeights.epa;
        
        if (interpolatedWeights.reviews > maxWeight) { dominantModel = models.reviews; maxWeight = interpolatedWeights.reviews; }
        if (interpolatedWeights.twitter > maxWeight) { dominantModel = models.twitter; maxWeight = interpolatedWeights.twitter; }
        if (interpolatedWeights.cyborg > maxWeight) { dominantModel = models.cyborg; }
        
        for (let i = 0; i < 20; i++) {
            const sentence = dominantModel.generate(limits.max, limits.min);
            const wordCount = sentence ? sentence.split(' ').length : 0;
            
            if (sentence && wordCount <= limits.max && !isTableGarbage(sentence) && !containsOffensiveContent(sentence)) {
                successfulSentence = sentence;
                console.log(`✓ Fallback generated: ${wordCount} words`);
                break;
            }
        }
    }
    
    const finalSentence = successfulSentence || "The sediment remediation timeline extends into unforeseen futures.";
    const finalWordCount = finalSentence.split(' ').length;
    console.log(`Final sentence: ${finalWordCount} words`);
    
    document.getElementById('generated-text').textContent = finalSentence;
}

function setYear(year) {
    currentYear = year;
    generateAndDisplay();
}

// Add weight interpolation for any year
function interpolateWeights(year) {
    const presetYears = [2020, 2027, 2030, 2035, 2040, 2050, 2060];
    
    // Find surrounding preset years
    let lowerYear = 2020;
    let upperYear = 2060;
    
    for (let i = 0; i < presetYears.length - 1; i++) {
        if (year >= presetYears[i] && year <= presetYears[i + 1]) {
            lowerYear = presetYears[i];
            upperYear = presetYears[i + 1];
            break;
        }
    }
    
    // If outside range, clamp
    if (year < 2020) return CONTAMINATION_PRESETS[2020];
    if (year > 2060) return CONTAMINATION_PRESETS[2060];
    
    // Interpolate
    const lowerWeights = CONTAMINATION_PRESETS[lowerYear];
    const upperWeights = CONTAMINATION_PRESETS[upperYear];
    const t = (year - lowerYear) / (upperYear - lowerYear);
    
    const interpolated = {};
    Object.keys(lowerWeights).forEach(key => {
        interpolated[key] = lowerWeights[key] + t * (upperWeights[key] - lowerWeights[key]);
    });
    
    return interpolated;
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initializeMarkov);

// Test: click to regenerate
document.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') {
        generateAndDisplay();
    }
});