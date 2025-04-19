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

    // Fetch answers from API
    async function fetchAnswers(courseId, sectionId) {
        try {
            // Step 1: Get the signed URL
            const signedUrlResponse = await fetch(
                `https://seneca.ellsies.tech/api/courses/${courseId}/signed-url?sectionId=${sectionId}`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!signedUrlResponse.ok) {
                throw new Error('Failed to get course data. Please try again later.');
            }

            const signedUrlData = await signedUrlResponse.json();
            
            if (!signedUrlData || !signedUrlData.url) {
                throw new Error('Invalid course data received.');
            }

            // Step 2: Fetch content using the signed URL
            const contentResponse = await fetch(signedUrlData.url);
            
            if (!contentResponse.ok) {
                throw new Error('Failed to fetch course content.');
            }

            const contentData = await contentResponse.json();

            if (!contentData || !contentData.contentModules) {
                throw new Error('No content found for this course section.');
            }

            // Step 3: Extract answers from content modules
            const answers = contentData.contentModules
                .filter(module => module.content && (module.content.answer || module.content.correctAnswer || (module.content.answers && module.content.answers.correct)))
                .map(module => ({
                    question: module.content.question || module.content.text || 'Question not available',
                    answer: module.content.answer || module.content.correctAnswer || (module.content.answers ? module.content.answers.correct : null),
                    type: getQuestionType(module.content)
                }));

            if (answers.length === 0) {
                throw new Error('No answers found in this section.');
            }

            return {
                title: contentData.title || 'Course Answers',
                questions: answers
            };
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    // Helper function to determine question type
    function getQuestionType(content) {
        if (content.type) return content.type;
        if (content.answers && Array.isArray(content.answers.options)) return 'multiple-choice';
        if (content.answer && typeof content.answer === 'string') return 'text';
        if (content.answers && content.answers.correct && Array.isArray(content.answers.correct)) return 'list';
        return 'unknown';
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
        moduleTitle.textContent = data.title;
        answersListDiv.appendChild(moduleTitle);

        // Display each answer
        data.questions.forEach(item => {
            const answerHtml = createAnswerCard(
                item.question,
                item.answer,
                item.type
            );
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = answerHtml;
            answersListDiv.appendChild(tempDiv.firstElementChild);
        });

        resultsDiv.classList.remove('hidden');
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
