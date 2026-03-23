document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('captionForm');
    if (!form) return;

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
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const charIndicator = document.getElementById('charIndicator');
    const confettiCanvas = document.getElementById('confetti-canvas');

    // ========================
    // THEME TOGGLE
    // ========================
    const savedTheme = localStorage.getItem('captionAI_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('captionAI_theme', next);
        updateThemeIcon(next);
    });

    function updateThemeIcon(theme) {
        themeIcon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }

    // ========================
    // CHARACTER COUNTER
    // ========================
    topicInput.addEventListener('input', () => {
        const len = topicInput.value.length;
        const max = 200;
        charIndicator.textContent = `${len} / ${max}`;
        charIndicator.classList.remove('warn', 'danger');
        if (len > 180) charIndicator.classList.add('danger');
        else if (len > 150) charIndicator.classList.add('warn');
    });

    // ========================
    // KEYBOARD SHORTCUTS
    // ========================
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            const topic = topicInput.value.trim();
            if (topic && !submitBtn.disabled) {
                generateCaption(topic, toneSelect.value);
            }
        }
        // Escape to clear
        if (e.key === 'Escape') {
            topicInput.value = '';
            charIndicator.textContent = '0 / 200';
            charIndicator.classList.remove('warn', 'danger');
            topicInput.focus();
        }
    });

    // Load history on mount
    loadHistory();

    // ========================
    // FORM SUBMIT
    // ========================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const topic = topicInput.value.trim();
        const tone = toneSelect.value;
        if (!topic) return;
        await generateCaption(topic, tone);
    });

    // ========================
    // COPY BUTTON
    // ========================
    copyBtn.addEventListener('click', () => {
        const textToCopy = outputText.innerText;
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Copied to clipboard!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('Copied to clipboard!');
        });
    });

    // ========================
    // REGENERATE & RETRY
    // ========================
    regenBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (topic) await generateCaption(topic, toneSelect.value);
    });

    retryBtn.addEventListener('click', async () => {
        const topic = topicInput.value.trim();
        if (topic) await generateCaption(topic, toneSelect.value);
    });

    // ========================
    // CLEAR HISTORY
    // ========================
    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Clear all caption history?')) {
            localStorage.removeItem('captionAI_history');
            loadHistory();
            showToast('History cleared');
        }
    });

    // ========================
    // MICROPHONE (Speech-to-Text)
    // ========================
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
            // Update char counter
            const len = transcript.length;
            charIndicator.textContent = `${len} / 200`;
        };

        recognition.onerror = () => micBtn.classList.remove('listening');
        recognition.onend = () => micBtn.classList.remove('listening');
    }

    // ========================
    // LOADING STEP ANIMATION
    // ========================
    let loadingInterval = null;

    function startLoadingSteps() {
        const steps = document.querySelectorAll('.loading-step');
        let currentStep = 0;

        // Reset all
        steps.forEach(s => {
            s.classList.remove('active', 'done');
            s.querySelector('i').className = 'fa-regular fa-circle';
        });

        // Activate first
        steps[0].classList.add('active');
        steps[0].querySelector('i').className = 'fa-solid fa-circle';

        loadingInterval = setInterval(() => {
            if (currentStep < steps.length - 1) {
                // Mark current as done
                steps[currentStep].classList.remove('active');
                steps[currentStep].classList.add('done');
                steps[currentStep].querySelector('i').className = 'fa-solid fa-check';

                // Activate next
                currentStep++;
                steps[currentStep].classList.add('active');
                steps[currentStep].querySelector('i').className = 'fa-solid fa-circle';
            }
        }, 4000);
    }

    function stopLoadingSteps() {
        if (loadingInterval) {
            clearInterval(loadingInterval);
            loadingInterval = null;
        }
        // Mark all done
        document.querySelectorAll('.loading-step').forEach(s => {
            s.classList.remove('active');
            s.classList.add('done');
            s.querySelector('i').className = 'fa-solid fa-check';
        });
    }

    // ========================
    // GENERATOR LOGIC
    // ========================
    async function generateCaption(topic, tone) {
        outputBox.classList.add('hidden');
        errorBox.classList.add('hidden');
        loadingState.classList.remove('hidden');
        submitBtn.disabled = true;
        startLoadingSteps();

        try {
            const response = await fetch('/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, tone })
            });

            const data = await response.json();
            stopLoadingSteps();
            loadingState.classList.add('hidden');
            submitBtn.disabled = false;

            if (response.ok && data.result) {
                const generatedText = data.result;

                // Typewriter effect
                await typewriterEffect(outputText, generatedText);

                // Timestamp
                const now = new Date();
                timestamp.innerText = `Generated on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;

                // Counts
                if (charCount) charCount.innerText = `${generatedText.length} chars`;
                if (wordCount) {
                    const words = generatedText.trim().split(/\s+/).length;
                    wordCount.innerText = `· ${words} words`;
                }

                outputBox.classList.remove('hidden');

                // 🎉 Confetti burst
                launchConfetti();

                // Save to History
                saveToHistory({
                    topic, tone,
                    content: generatedText,
                    time: now.toLocaleString()
                });
            } else {
                showError(data.error || 'Generation failed. Please try again.');
            }
        } catch (error) {
            console.error('Error:', error);
            stopLoadingSteps();
            loadingState.classList.add('hidden');
            submitBtn.disabled = false;
            showError('Network error. Check your connection and try again.');
        }
    }

    // ========================
    // TYPEWRITER EFFECT
    // ========================
    function typewriterEffect(element, text) {
        return new Promise((resolve) => {
            element.innerText = '';
            element.classList.add('typing');
            let i = 0;
            const speed = Math.max(5, Math.min(15, 3000 / text.length)); // Adaptive speed

            function type() {
                if (i < text.length) {
                    // Add 3 chars at a time for speed
                    const chunk = text.slice(i, i + 3);
                    element.innerText += chunk;
                    i += 3;
                    setTimeout(type, speed);
                } else {
                    element.innerText = text; // Ensure full text
                    element.classList.remove('typing');
                    resolve();
                }
            }
            type();
        });
    }

    // ========================
    // CONFETTI 🎉
    // ========================
    function launchConfetti() {
        const ctx = confettiCanvas.getContext('2d');
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#818CF8', '#A78BFA', '#C084FC', '#F472B6', '#34D399', '#FBBF24'];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 300,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 12,
                vy: (Math.random() - 1) * 14 - 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 6 + 3,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                gravity: 0.3,
                opacity: 1,
                decay: 0.015 + Math.random() * 0.01
            });
        }

        let frame = 0;
        function animate() {
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            let alive = false;

            particles.forEach(p => {
                if (p.opacity <= 0) return;
                alive = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += p.gravity;
                p.vx *= 0.99;
                p.rotation += p.rotationSpeed;
                p.opacity -= p.decay;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                ctx.restore();
            });

            frame++;
            if (alive && frame < 120) {
                requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
            }
        }
        animate();
    }

    // ========================
    // ERROR DISPLAY
    // ========================
    function showError(message) {
        errorMessage.innerText = message;
        errorBox.classList.remove('hidden');
        outputBox.classList.add('hidden');
    }

    // ========================
    // TOAST
    // ========================
    function showToast(message) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.innerText = message;
        toast.classList.remove('hidden');
        toast.style.animation = 'none';
        toast.offsetHeight; // trigger reflow
        toast.style.animation = '';
        setTimeout(() => toast.classList.add('hidden'), 2500);
    }

    // ========================
    // HISTORY MANAGEMENT
    // ========================
    function saveToHistory(item) {
        let history = JSON.parse(localStorage.getItem('captionAI_history')) || [];
        history.unshift(item);
        if (history.length > 25) history = history.slice(0, 25);
        localStorage.setItem('captionAI_history', JSON.stringify(history));
        loadHistory();
    }

    function deleteHistoryItem(index) {
        let history = JSON.parse(localStorage.getItem('captionAI_history')) || [];
        history.splice(index, 1);
        localStorage.setItem('captionAI_history', JSON.stringify(history));
        loadHistory();
        showToast('Item removed');
    }

    function loadHistory() {
        const container = document.getElementById('history-container');
        let history = JSON.parse(localStorage.getItem('captionAI_history')) || [];

        container.innerHTML = '';

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

            let preview = item.content.replace(/\n/g, ' ').slice(0, 65);
            if (item.content.length > 65) preview += '...';

            // Tone badge class
            let toneBadge = 'tone-professional';
            const toneMap = {
                'Casual': 'tone-casual',
                'Motivational': 'tone-motivational',
                'Storytelling': 'tone-storytelling',
                'Thought Leadership': 'tone-thought-leadership'
            };
            if (toneMap[item.tone]) toneBadge = toneMap[item.tone];

            div.innerHTML = `
                <button class="history-delete" title="Delete this item" data-delete="${index}">
                    <i class="fa-solid fa-xmark"></i>
                </button>
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

            // Delete button
            div.querySelector('.history-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHistoryItem(index);
            });

            // Click to expand/collapse
            div.addEventListener('click', () => {
                const wasExpanded = div.classList.contains('expanded');

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

                // Update char indicator
                charIndicator.textContent = `${item.topic.length} / 200`;
            });

            container.appendChild(div);
        });
    }

    // ========================
    // UTILITY: Escape HTML
    // ========================
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});