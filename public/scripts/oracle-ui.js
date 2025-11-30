// Initialize Markov models
let models = {};
let modelsLoaded = false;

async function initOracle() {
    console.log('Loading oracle corpora...');
    
    const response = await fetch('../data/corpora.json');
    const corpora = await response.json();
    
    console.log('Building oracle models...');
    
    models.epa = new MarkovGenerator(corpora.epa, 2);
    models.blogs = new MarkovGenerator(corpora.blogs, 2);
    models.youtube = new MarkovGenerator(corpora.youtube, 2);
    models.tiktok = new MarkovGenerator(corpora.tiktok, 2);
    models.reviews = new MarkovGenerator(corpora.google_reviews, 2);
    models.twitter = new MarkovGenerator(corpora.twitter, 2);
    models.cyborg = new MarkovGenerator(corpora.cyborg, 2);
    
    modelsLoaded = true;
    console.log('✓ Oracle ready');
}

function generateWithWeights(weights) {
    const combined = MarkovGenerator.combine(
        [models.epa, models.blogs, models.youtube, models.tiktok, models.reviews, models.twitter, models.cyborg],
        [weights.epa, weights.blogs || 0, weights.youtube || 0, weights.tiktok || 0, weights.reviews, weights.twitter, weights.cyborg]
    );
    
    for (let i = 0; i < 50; i++) {
        const sentence = combined.generate(50, 10);
        if (sentence && sentence.split(' ').length >= 10) {
            return sentence;
        }
    }
    
    return "Analysis inconclusive. Temporal data corruption detected.";
}

function askOracle(question) {
    if (!modelsLoaded) {
        return {
            answer: "ERROR: Oracle systems not initialized.",
            contamination: 0
        };
    }
    
    const responses = [];
    
    // Sentence 1: Bureaucratic opening (70% EPA)
    const bureaucratic = generateWithWeights({
        epa: 0.7,
        cyborg: 0.1,
        reviews: 0.1,
        twitter: 0.1
    });
    responses.push(bureaucratic);
    
    // Sentence 2: Medium contamination (20% EPA, 40% cyborg)
    const prediction = generateWithWeights({
        epa: 0.2,
        cyborg: 0.4,
        reviews: 0.2,
        twitter: 0.2
    });
    responses.push(prediction);
    
    // Sentence 3: High contamination (5% EPA, 50% cyborg)
    const mystical = generateWithWeights({
        epa: 0.05,
        cyborg: 0.5,
        reviews: 0.225,
        twitter: 0.225
    });
    responses.push(mystical);
    
    const answer = responses.join(' ');
    const contamination = calculateContamination(answer);
    
    return {
        answer: answer,
        contamination: contamination
    };
}

function calculateContamination(text) {
    const wordCount = text.split(' ').length;
    const base = Math.min(100, (wordCount / 150) * 100);
    const random = Math.random() * 20;
    return Math.min(100, Math.floor(base + random));
}

function typewriterEffect(text, elementId, speed = 50, onComplete) {
    const element = document.getElementById(elementId);
    element.textContent = '';
    
    const words = text.split(' ');
    let index = 0;
    
    function typeNextWord() {
        if (index < words.length) {
            if (index > 0) element.textContent += ' ';
            element.textContent += words[index];
            index++;
            setTimeout(typeNextWord, speed);
        } else {
            if (onComplete) onComplete();
        }
    }
    
    typeNextWord();
}

function savePastQuery(question, answer) {
    const queryList = document.getElementById('query-list');
    const queryDiv = document.createElement('div');
    queryDiv.className = 'past-query';
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'past-query-q';
    questionDiv.textContent = 'Q: ' + question;
    
    const answerDiv = document.createElement('div');
    answerDiv.className = 'past-query-a';
    answerDiv.textContent = 'A: ' + answer.substring(0, 100) + '...';
    
    queryDiv.appendChild(questionDiv);
    queryDiv.appendChild(answerDiv);
    
    queryList.insertBefore(queryDiv, queryList.firstChild);
    
    while (queryList.children.length > 10) {
        queryList.removeChild(queryList.lastChild);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initOracle();
    
    const submitBtn = document.getElementById('oracle-submit');
    const input = document.getElementById('oracle-input');
    const responseSection = document.getElementById('response-section');
    
    submitBtn.addEventListener('click', () => {
        const question = input.value.trim();
        
        if (!question) {
            alert('Please enter a query.');
            return;
        }
        
        if (!modelsLoaded) {
            alert('Oracle systems still initializing. Please wait.');
            return;
        }
        
        responseSection.classList.remove('hidden');
        submitBtn.textContent = 'ANALYZING...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            const result = askOracle(question);
            
            document.getElementById('contamination-display').textContent = 
                `CONTAMINATION: ${result.contamination}%`;
            
            const confidenceFill = document.getElementById('confidence-fill');
            confidenceFill.style.width = result.contamination + '%';
            
            typewriterEffect(result.answer, 'oracle-response', 50, () => {
                savePastQuery(question, result.answer);
                submitBtn.textContent = 'ANALYZE';
                submitBtn.disabled = false;
                input.value = '';
            });
        }, 500);
    });
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitBtn.click();
        }
    });
});