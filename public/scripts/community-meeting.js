async function submitFeedback() {
    const comment = document.getElementById('comment-input').value.trim();
    const status = document.getElementById('status');
    
    if (!comment) {
        status.textContent = 'Please enter a comment.';
        status.style.color = '#ff0000';
        return;
    }
    
    try {
        const response = await fetch('/api/submit-feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            status.textContent = '✓ Comment submitted!';
            status.style.color = '#00ff00';
            document.getElementById('comment-input').value = '';
            loadFeedback();
        } else {
            status.textContent = 'Error: ' + data.error;
            status.style.color = '#ff0000';
        }
    } catch (error) {
        status.textContent = 'Error submitting comment';
        status.style.color = '#ff0000';
        console.error(error);
    }
}

async function loadFeedback() {
    try {
        const response = await fetch('/api/get-feedback');
        const data = await response.json();
        
        const feedbackList = document.getElementById('feedback-list');
        feedbackList.innerHTML = '';
        
        data.feedback.forEach(item => {
            const div = document.createElement('div');
            div.className = 'feedback-item';
            div.textContent = item.comment;
            feedbackList.appendChild(div);
        });
    } catch (error) {
        console.error('Error loading feedback:', error);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadFeedback();
    
    document.getElementById('submit-feedback-btn').addEventListener('click', submitFeedback);
    
    document.getElementById('proceed-oracle-btn').addEventListener('click', () => {
        window.location.href = '/oracle';
    });
    
    // Allow Enter to submit
    document.getElementById('comment-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitFeedback();
        }
    });
});