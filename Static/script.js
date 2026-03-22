document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on dashboard page by looking for the form
    const form = document.getElementById('captionForm');
    if (!form) return; // Exit if not on dashboard

    // --- DOM References ---
    const topicInput = document.getElementById('topic');
    const toneSelect = document.getElementById('tone');
    const submitBtn = document.getElementById('submitBtn');
    const loadingState = document.getElementById('loading');
    const outputBox = document.getElementById('output-box');
    const outputText = document.getElementById('output');
    const timestamp = document.getElementById('timestamp');
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    const copyBtn = document.getElementById('copy-btn');
    const regenBtn = document.getElementById('regen-btn');
    const errorBox = document.getElementById('error-box');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const clearHistoryBtn = document.getElementById('clear-history-btn');
    const micBtn = document.getElementById('micBtn');

    // Load history on mount
    loadHistory();

    // --- Form Submit ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        const tone = toneSelect.value;

        if (!topic) return;

        await generateCaption(topic, tone);
    });

    // --- Copy Button ---
    copyBtn.addEventListener('click', () => {
        const textToCopy = outputText.innerText;
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Copied to clipboard!');
        });
    });

    // --- Regenerate Button ---
    regenBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (topic) {
            await generateCaption(topic, toneSelect.value);
        }
    });

    // --- Retry Button (Error state) ---
    retryBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (topic) {
            await generateCaption(topic, toneSelect.value);
        }
    });

    // --- Clear History ---
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all caption history?')) {
            localStorage.removeItem('captionAI_history');
            loadHistory();
            showToast('History cleared');
        }
    });

    // --- Microphone (Speech-to-Text) ---
    if (micBtn && 'webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        micBtn.addEventListener('click', () => {
            micBtn.classList.toggle('listening');
            if (micBtn.classList.contains('listening')) {
                recognition.start();
            } else {
                recognition.stop();
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            topicInput.value = transcript;
            micBtn.classList.remove('listening');
        };

        recognition.onerror = () => {
            micBtn.classList.remove('listening');
        };

        recognition.onend = () => {
            micBtn.classList.remove('listening');
        };
    }

    // --- Generator Logic ---
    async function generateCaption(topic, tone) {
        // UI: Show loading, hide others
        outputBox.classList.add('hidden');
        errorBox.classList.add('hidden');
        loadingState.classList.remove('hidden');
        submitBtn.disabled = true;

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic: topic, tone: tone })
            });

            const data = await response.json();

            // Hide Loading
            loadingState.classList.add('hidden');
            submitBtn.disabled = false;

            if (response.ok && data.result) {
                // Show Result
                const generatedText = data.result;
                outputText.innerText = generatedText;
                
                // Timestamp
                const now = new Date();
                timestamp.innerText = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
                
                // Character & word count
                if (charCount) {
                    charCount.innerText = `${generatedText.length} chars`;
                }
                if (wordCount) {
                    const words = generatedText.trim().split(/\s+/).length;
                    wordCount.innerText = `· ${words} words`;
                }

                outputBox.classList.remove('hidden');

                // Save to History
                saveToHistory({
                    topic: topic,
                    tone: tone,
                    content: generatedText,
                    time: now.toLocaleString()
                });
            } else {
                // Show error card
                showError(data.error || 'Generation failed. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            loadingState.classList.add('hidden');
            submitBtn.disabled = false;
            showError('Network error. Check your connection and try again.');
        }
    }

    // --- Error Display ---
    function showError(message) {
        errorMessage.innerText = message;
        errorBox.classList.remove('hidden');
        outputBox.classList.add('hidden');
    }

    // --- Toast ---
    function showToast(message) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.innerText = message;
        toast.classList.remove('hidden');
        // Reset animation
        toast.style.animation = 'none';
        toast.offsetHeight; // trigger reflow
        toast.style.animation = '';
        setTimeout(() => toast.classList.add('hidden'), 2500);
    }

    // --- History Management ---
    function saveToHistory(item) {
        let history = JSON.parse(localStorage.getItem('captionAI_history')) || [];
        history.unshift(item);
        if (history.length > 25) history = history.slice(0, 25);
        localStorage.setItem('captionAI_history', JSON.stringify(history));
        loadHistory();
    }

    function loadHistory() {
        const container = document.getElementById('history-container');
        let history = JSON.parse(localStorage.getItem('captionAI_history')) || [];
        
        container.innerHTML = '';

        // Show/hide clear button
        if (history.length > 0) {
            clearHistoryBtn.classList.remove('hidden');
        } else {
            clearHistoryBtn.classList.add('hidden');
        }

        if (history.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-regular fa-folder-open"></i>
                    <p>No captions yet. Make your first one!</p>
                </div>
            `;
            return;
        }

        history.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.setAttribute('data-index', index);
            
            // Clean content for preview
            let preview = item.content.replace(/\n/g, ' ').slice(0, 65);
            if (item.content.length > 65) preview += '...';

            // Tone badge color
            let toneBadge = 'tone-professional';
            if (item.tone === 'Casual') toneBadge = 'tone-casual';
            if (item.tone === 'Motivational') toneBadge = 'tone-motivational';

            div.innerHTML = `
                <div class="history-item-header">
                    <div style="flex:1;min-width:0;">
                        <div class="history-topic">${escapeHtml(item.topic)}</div>
                        <div class="history-meta">
                            <span class="tone-badge ${toneBadge}">${item.tone}</span>
                            <span class="history-time">${item.time}</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-down history-chevron"></i>
                </div>
                <div class="history-preview">${escapeHtml(preview)}</div>
                <div class="history-full">${escapeHtml(item.content)}</div>
            `;
            
            // Click to expand/collapse
            div.addEventListener('click', () => {
                const wasExpanded = div.classList.contains('expanded');
                
                // Collapse all others
                container.querySelectorAll('.history-item.expanded').forEach(el => {
                    el.classList.remove('expanded');
                });

                if (!wasExpanded) {
                    div.classList.add('expanded');
                }

                // Load into output box
                topicInput.value = item.topic;
                toneSelect.value = item.tone;
                outputText.innerText = item.content;
                timestamp.innerText = `Loaded from history · ${item.time}`;
                if (charCount) charCount.innerText = `${item.content.length} chars`;
                if (wordCount) {
                    const words = item.content.trim().split(/\s+/).length;
                    wordCount.innerText = `· ${words} words`;
                }
                outputBox.classList.remove('hidden');
                errorBox.classList.add('hidden');
            });

            container.appendChild(div);
        });
    }

    // --- Utility: escape HTML to prevent XSS ---
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});