document.addEventListener('DOMContentLoaded', () => {
    const API_BASE_URL = 'https://senai.uk/seneca';  // Updated API endpoint
    
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

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorDiv.classList.remove('hidden');
        loadingDiv.classList.add('hidden');
    }

    // Hide error message
    function hideError() {
        errorDiv.classList.add('hidden');
    }

    // Show loading spinner
    function showLoading() {
        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        hideError();
    }

    // Hide loading spinner
    function hideLoading() {
        loadingDiv.classList.add('hidden');
    }

    // Create answer card HTML
    function createAnswerCard(question, answer) {
        return `
            <div class="answer-card bg-gray-50 p-4 rounded-lg">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <p class="question-text mb-2">${question}</p>
                        <p class="answer-text">${answer}</p>
                    </div>
                    <button class="copy-button ml-4 text-gray-400 hover:text-indigo-600" 
                            onclick="navigator.clipboard.writeText('${answer.replace(/'/g, "\\'")}')">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }

    // Display answers in the UI
    function displayAnswers(data) {
        answersListDiv.innerHTML = '';
        
        if (!data || !data.answers || data.answers.length === 0) {
            showError('No answers found for this course section.');
            return;
        }

        // Create a module section for all answers
        const moduleTitle = document.createElement('h3');
        moduleTitle.className = 'module-title';
        moduleTitle.textContent = 'Course Answers';
        answersListDiv.appendChild(moduleTitle);

        // Display each answer
        data.answers.forEach(item => {
            const answerHtml = createAnswerCard(
                item.question,
                Array.isArray(item.answer) ? item.answer.join(', ') : item.answer
            );
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = answerHtml;
            answersListDiv.appendChild(tempDiv.firstElementChild);
        });

        resultsDiv.classList.remove('hidden');
    }

    // Fetch answers from API
    async function fetchAnswers(courseId, sectionId) {
        try {
            const response = await fetch(
                `${API_BASE_URL}?courseId=${courseId}&sectionId=${sectionId}`
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch answers. Please try again later.');
            }

            return await response.json();
        } catch (error) {
            throw new Error(error.message || 'Failed to fetch answers. Please check your internet connection.');
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
