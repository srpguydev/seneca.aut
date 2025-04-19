// ==UserScript==
// @name         Seneca Learning Auto Answer
// @namespace    https://app.senecalearning.com/
// @version      1.0
// @description  Automated answer assistant for Seneca Learning
// @author       Your Name
// @match        https://app.senecalearning.com/classroom/course/*/section/*/session*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      seneca.ellsies.tech
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const DEBUG = true;
    const API_BASE_URL = 'https://seneca.ellsies.tech/api';
    const HIGHLIGHT_COLOR = 'rgba(144, 238, 144, 0.2)'; // Light green

    // Add custom styles
    GM_addStyle(`
        .seneca-auto-highlight {
            background-color: ${HIGHLIGHT_COLOR} !important;
            transition: background-color 0.3s ease;
        }
    `);

    // Utility functions
    const log = (...args) => {
        if (DEBUG) {
            console.log('[Seneca Auto]', ...args);
        }
    };

    // Promise wrapper for GM_xmlhttpRequest
    function gmFetch(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json'
                },
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const data = JSON.parse(response.responseText);
                            resolve(data);
                        } catch (e) {
                            reject(new Error('Invalid JSON response'));
                        }
                    } else {
                        reject(new Error(`HTTP ${response.status}`));
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Extract course and section IDs from URL
    function extractIds() {
        const url = window.location.href;
        const courseMatch = url.match(/course\/([^/]+)/);
        const sectionMatch = url.match(/section\/([^/]+)/);
        
        if (!courseMatch || !sectionMatch) {
            throw new Error('Could not extract course or section ID from URL');
        }

        return {
            courseId: courseMatch[1],
            sectionId: sectionMatch[1]
        };
    }

    // Fetch answers from API
    async function fetchAnswers(courseId, sectionId) {
        try {
            // First get the signed URL
            const signedUrlData = await gmFetch(
                `${API_BASE_URL}/courses/${courseId}/signed-url?sectionId=${sectionId}`
            );
            
            if (!signedUrlData || !signedUrlData.url) {
                throw new Error('Invalid signed URL response');
            }

            // Fetch the actual content
            const contentData = await gmFetch(signedUrlData.url);
            if (!contentData) {
                throw new Error('Invalid content response');
            }

            return contentData;
        } catch (error) {
            log('Error fetching answers:', error);
            return null;
        }
    }

    // Question type handlers
    const questionHandlers = {
        multipleChoice(question, answer, container) {
            const options = container.querySelectorAll('button[role="radio"]');
            for (const option of options) {
                if (option.textContent.trim() === answer.trim()) {
                    option.click();
                    option.classList.add('seneca-auto-highlight');
                    return true;
                }
            }
            return false;
        },

        wordFill(question, answer, container) {
            const input = container.querySelector('input[type="text"]');
            if (input) {
                input.value = answer;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.classList.add('seneca-auto-highlight');
                return true;
            }
            return false;
        },

        exactList(question, answers, container) {
            const inputs = container.querySelectorAll('input[type="text"]');
            if (inputs.length === answers.length) {
                inputs.forEach((input, index) => {
                    input.value = answers[index];
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.classList.add('seneca-auto-highlight');
                });
                return true;
            }
            return false;
        }
    };

    // Match current question with answers
    function matchQuestion(questionText, answersData) {
        // Normalize the question text
        const normalizedQuestion = questionText.toLowerCase().trim();
        
        // Search through the answers data to find a matching question
        for (const module of answersData.contentModules || []) {
            for (const question of module.questions || []) {
                if (question.text.toLowerCase().trim() === normalizedQuestion) {
                    return question;
                }
            }
        }
        return null;
    }

    // Handle DOM mutations to detect new questions
    function setupQuestionObserver(answersData) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Look for question container updates
                const questionContainer = document.querySelector('.question-container');
                if (questionContainer) {
                    const questionText = questionContainer.querySelector('.question-text')?.textContent;
                    if (questionText) {
                        const matchedQuestion = matchQuestion(questionText, answersData);
                        if (matchedQuestion) {
                            // Determine question type and apply appropriate handler
                            const type = determineQuestionType(questionContainer);
                            if (type && questionHandlers[type]) {
                                const success = questionHandlers[type](matchedQuestion.text, matchedQuestion.answer, questionContainer);
                                if (success) {
                                    log('Answered question:', questionText);
                                }
                            }
                        }
                    }
                }
            }
        });

        // Start observing the entire document for changes
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return observer;
    }

    // Determine the type of question based on DOM structure
    function determineQuestionType(container) {
        if (container.querySelector('button[role="radio"]')) {
            return 'multipleChoice';
        }
        if (container.querySelector('input[type="text"]')) {
            // Check if it's a list or single input
            const inputs = container.querySelectorAll('input[type="text"]');
            return inputs.length > 1 ? 'exactList' : 'wordFill';
        }
        return null;
    }

    // Main initialization function
    async function initialize() {
        try {
            const { courseId, sectionId } = extractIds();
            log('Course ID:', courseId, 'Section ID:', sectionId);

            const answersData = await fetchAnswers(courseId, sectionId);
            if (!answersData) {
                throw new Error('Failed to fetch answers data');
            }

            log('Successfully loaded answers data');
            setupQuestionObserver(answersData);
        } catch (error) {
            log('Initialization error:', error);
        }
    }

    // Start the script when the document is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})(); 