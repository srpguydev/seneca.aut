document.addEventListener('DOMContentLoaded', () => {
    // Theme handling
    const themeToggle = document.getElementById('themeToggle');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Set initial theme
    function setInitialTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            document.documentElement.dataset.theme = savedTheme;
        } else {
            document.documentElement.dataset.theme = prefersDark.matches ? 'dark' : 'light';
        }
        updateThemeIcon();
    }

    // Update theme icon
    function updateThemeIcon() {
        const isDark = document.documentElement.dataset.theme === 'dark';
        themeToggle.innerHTML = isDark 
            ? '<svg class="moon-icon" viewBox="0 0 24 24" fill="none"><path d="M12 3v1m0 16v1m-9-9h1m16 0h1m-3.293-7.293l-.707.707m-11.414 11.414l-.707.707M6.343 6.343l-.707-.707m12.728 12.728l-.707-.707M3 12a9 9 0 1118 0 9 9 0 01-18 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
            : '<svg class="moon-icon" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    // Toggle theme
    function toggleTheme() {
        const currentTheme = document.documentElement.dataset.theme;
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = newTheme;
        localStorage.setItem('theme', newTheme);
        updateThemeIcon();
    }

    // Event listeners for theme
    themeToggle.addEventListener('click', toggleTheme);
    prefersDark.addEventListener('change', (e) => {
        document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
        updateThemeIcon();
    });

    setInitialTheme();

    // DOM Elements
    const courseUrlInput = document.getElementById('courseUrl');
    const getAnswersButton = document.getElementById('getAnswers');
    const resultsDiv = document.getElementById('results');
    const answersListDiv = document.getElementById('answersList');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('errorMessage');

    // Extract course and section IDs from URL
    function extractIds(url) {
        const courseMatch = url.match(/course\/([^/]+)/);
        const sectionMatch = url.match(/section\/([^/]+)/);
        
        if (!courseMatch || !sectionMatch) {
            throw new Error('Invalid Seneca Learning URL. Please make sure you copy the complete course URL.');
        }

        return {
            courseId: courseMatch[1],
            sectionId: sectionMatch[1]
        };
    }

    // Show/hide UI elements
    function showError(message) {
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
    }

    function hideError() {
        errorDiv.classList.add('hidden');
    }

    function showLoading() {
        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        hideError();
    }

    function hideLoading() {
        loadingDiv.classList.add('hidden');
    }

    // Create answer card HTML
    function createAnswerCard(question, answer, type = '') {
        const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : answer;
        return `
            <div class="answer-card">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="question-text">${question}</p>
                        <p class="answer-text">${formattedAnswer}</p>
                        ${type ? `<p class="text-xs text-gray-500 mt-1">Type: ${type}</p>` : ''}
                    </div>
                    <button class="copy-button" onclick="navigator.clipboard.writeText('${formattedAnswer.replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // Extract answer based on question type
    function extractAnswer(question) {
        if (!question) return { answer: 'No answer available', type: 'unknown' };

        if (question.answer) {
            return { answer: question.answer, type: 'direct' };
        }

        if (question.correctAnswer) {
            return { answer: question.correctAnswer, type: 'multiple choice' };
        }

        if (question.answers && question.answers.correct) {
            return { answer: question.answers.correct, type: 'correct answer' };
        }

        if (question.data && question.data.correctAnswer) {
            return { answer: question.data.correctAnswer, type: 'data based' };
        }

        return { answer: 'Answer format not recognized', type: 'unknown' };
    }

    // Display answers in the UI
    function displayAnswers(data) {
        answersListDiv.innerHTML = '';
        
        if (!data || !data.questions || data.questions.length === 0) {
            showError('No answers found for this course section.');
            return;
        }

        // Create a module section for all answers
        const moduleTitle = document.createElement('h3');
        moduleTitle.className = 'text-xl font-semibold mb-4';
        moduleTitle.textContent = data.title || 'Course Answers';
        answersListDiv.appendChild(moduleTitle);

        // Display each answer
        data.questions.forEach(question => {
            const { answer, type } = extractAnswer(question);
            const answerHtml = createAnswerCard(
                question.text || question.question || 'Question not available',
                answer,
                type
            );
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = answerHtml;
            answersListDiv.appendChild(tempDiv.firstElementChild);
        });

        resultsDiv.classList.remove('hidden');
    }

    // Fetch answers from API
    async function fetchAnswers(courseId, sectionId) {
        const API_BASE_URL = 'https://course-content.senecalearning.com/api/v1';
        const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

        try {
            // First try direct access
            const directResponse = await fetch(
                `${API_BASE_URL}/courses/${courseId}/sections/${sectionId}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (directResponse.ok) {
                return await directResponse.json();
            }

            // If direct access fails, try through CORS proxy
            const proxyResponse = await fetch(
                `${CORS_PROXY}${API_BASE_URL}/courses/${courseId}/sections/${sectionId}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Origin': 'https://app.senecalearning.com'
                    }
                }
            );
            
            if (!proxyResponse.ok) {
                throw new Error('Failed to fetch answers. Please try again later.');
            }

            return await proxyResponse.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw new Error('Failed to fetch answers. Please check your internet connection or try again later.');
        }
    }

    // Handle get answers button click
    getAnswersButton.addEventListener('click', async () => {
        const url = courseUrlInput.value.trim();
        
        if (!url) {
            showError('Please enter a Seneca Learning course URL.');
            return;
        }

        try {
            showLoading();
            const { courseId, sectionId } = extractIds(url);
            const data = await fetchAnswers(courseId, sectionId);
            hideLoading();
            displayAnswers(data);
        } catch (error) {
            showError(error.message);
        }
    });

    // Handle Enter key in input
    courseUrlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            getAnswersButton.click();
        }
    });
}); 
