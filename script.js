// --- Page Navigation and State Management ---
const appContainer = document.getElementById('appContainer');
const loginPage = document.getElementById('loginPage');
const personalDetailsPage = document.getElementById('personalDetailsPage');
const sessionDashboardPage = document.getElementById('sessionDashboardPage');
const flexibilityPredictorPage = document.getElementById('flexibilityPredictorPage');

let currentUser = null; // Stores the logged-in user's username
let previousPage = null; // To track the page for 'Back' button functionality

/**
 * Hides all pages and shows the selected page.
 * @param {HTMLElement} pageToShow - The page element to display.
 */
const showPage = (pageToShow) => {
    const pages = [loginPage, personalDetailsPage, sessionDashboardPage, flexibilityPredictorPage];
    pages.forEach(page => page.classList.add('page-hidden'));
    pageToShow.classList.remove('page-hidden');
};

// Initialize to show the login page on load
document.addEventListener('DOMContentLoaded', () => {
    showPage(loginPage);
});

// --- Local Storage Functions ---

/**
 * Retrieves a user's data from localStorage.
 * @param {string} username - The username to retrieve.
 * @returns {object|null} The user data object or null if not found.
 */
const getUserData = (username) => {
    try {
        return JSON.parse(localStorage.getItem(`user_${username}`)) || null;
    } catch (e) {
        console.error("Error parsing user data from localStorage:", e);
        return null;
    }
};

/**
 * Saves a user's data to localStorage.
 * @param {string} username - The username associated with the data.
 * @param {object} data - The user data object to save.
 */
const saveUserData = (username, data) => {
    localStorage.setItem(`user_${username}`, JSON.stringify(data));
};

// --- Login Page Logic ---
document.getElementById('loginBtn').addEventListener('click', () => {
    const username = document.getElementById('username-login').value.trim();
    const email = document.getElementById('email-login').value.trim();

    if (!username || !email) {
        alert('Please enter both username and email to login.');
        return;
    }

    const userData = getUserData(username);

    if (userData && userData.email === email) {
        currentUser = username;
        document.getElementById('dashboardUsername').textContent = username;
        populatePersonalDetailsForm(userData); // Load existing details if any
        previousPage = loginPage;
        showPage(sessionDashboardPage);
    } else {
        alert('Invalid username or email. Please create an account if you are a new user.');
    }
});

document.getElementById('createAccountBtn').addEventListener('click', () => {
    const username = document.getElementById('username-login').value.trim();
    const email = document.getElementById('email-login').value.trim();

    if (!username || !email) {
        alert('Please enter a username and email to create an account.');
        return;
    }

    if (getUserData(username)) {
        alert('Username already exists. Please choose a different username or log in.');
        return;
    }

    // Initialize new user with basic info
    saveUserData(username, { username: username, email: email, sessions: [] });
    currentUser = username;
    document.getElementById('dashboardUsername').textContent = username;
    
    // Clear personal details form for new user
    document.getElementById('age').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('medicalIssues').value = 'None';
    
    previousPage = loginPage;
    showPage(personalDetailsPage);
});

// --- Personal Details Page Logic ---
const populatePersonalDetailsForm = (userData) => {
    if (userData) {
        document.getElementById('age').value = userData.age || '';
        document.getElementById('gender').value = userData.gender || '';
        document.getElementById('medicalIssues').value = userData.medicalIssues || 'None';
    }
};

document.getElementById('saveDetailsBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('No user logged in. Please log in or create an account first.');
        showPage(loginPage);
        return;
    }

    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const medicalIssues = document.getElementById('medicalIssues').value;

    if (!age || !gender || !medicalIssues) {
        alert('Please fill in all personal details.');
        return;
    }

    const userData = getUserData(currentUser);
    userData.age = age;
    userData.gender = gender;
    userData.medicalIssues = medicalIssues;
    saveUserData(currentUser, userData);

    alert('Personal details saved successfully!');
    showPage(sessionDashboardPage);
});

document.getElementById('backToLoginOrDashboardBtn').addEventListener('click', () => {
    if (previousPage === personalDetailsPage) {
        // This case is for when a user creates an account, but hasn't saved details.
        // It should go back to the login page.
        showPage(loginPage);
    } else {
        // If coming from the dashboard, go back to the dashboard.
        showPage(sessionDashboardPage);
    }
});


// --- Session Dashboard Page Logic ---
document.getElementById('sidebarPersonalDetailsBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('Please log in first.');
        showPage(loginPage);
        return;
    }
    const userData = getUserData(currentUser);
    populatePersonalDetailsForm(userData);
    previousPage = sessionDashboardPage;
    showPage(personalDetailsPage);
});

// Placeholder for Progress Tracker (no current functionality)
document.getElementById('sidebarProgressTrackerBtn').addEventListener('click', () => {
    alert('Progress Tracker functionality coming soon!');
});

document.getElementById('sidebarFlexibilityPredictorBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('Please log in first.');
        showPage(loginPage);
        return;
    }
    
    previousPage = sessionDashboardPage;
    showPage(flexibilityPredictorPage);
    
    // Trigger an update of the prediction when page loads
    setTimeout(() => {
        const changeEvent = new Event('change');
        document.getElementById('currentFlexibilityScore').dispatchEvent(changeEvent);
    }, 100);
});

document.getElementById('backToLoginFromDashboardBtn').addEventListener('click', () => {
    currentUser = null; // Log out the user
    document.getElementById('username-login').value = '';
    document.getElementById('email-login').value = '';
    previousPage = null;
    showPage(loginPage);
});

let sessionInterval;
let sessionMeasurements = {
    minKneeAngle: 180,
    maxLegSeparation: 0,
    maxAnkleDorsiflexionPlantarflexionAngle: 0,
    maxAnkleInversionEversionAngle: 0,
};

document.getElementById('startSessionBtn').addEventListener('click', () => {
    fetch('http://127.0.0.1:5000/start-session')
        .then(response => response.json())
        .then(data => {
            console.log('Session started:', data);
            if (data.error) {
                alert('Error starting session: ' + data.error);
            } else {
                alert('Session Started! Both MediaPipe camera and Hardware receiver are running.');
            }
        })
        .catch(err => {
            console.error('Error starting session:', err);
            alert('Error starting session. Please check if the server is running.');
        });
});


// Updated Stop Session - now stops both and displays all results
document.getElementById('stopSessionBtn').addEventListener('click', () => {
    fetch('http://127.0.0.1:5000/stop-session')
        .then(response => response.json())
        .then(resultData => {
            console.log('Full Results from Flask:', resultData);
            
            // Debug: Log each specific field
            console.log('minimum_knee_flexion_angle:', resultData.minimum_knee_flexion_angle);
            console.log('maximum_ankle_dorsiflexion_plantarflexion_range:', resultData.maximum_ankle_dorsiflexion_plantarflexion_range);
            console.log('maximum_ankle_inversion_eversion_range:', resultData.maximum_ankle_inversion_eversion_range);

            // Update MediaPipe results (existing functionality)
            if (resultData.max_leg_separation_angle !== undefined) {
                document.getElementById('maxLegSeparation').textContent = 
                    `${resultData.max_leg_separation_angle}°`;
            }

            // Update Hardware results (new functionality)
            if (resultData.minimum_knee_flexion_angle !== undefined) {
                document.getElementById('minKneeAngle').textContent = 
                    `${resultData.minimum_knee_flexion_angle}°`;
                console.log('Updated minKneeAngle element');
            } else {
                console.log('minimum_knee_flexion_angle is undefined');
            }

            if (resultData.maximum_ankle_dorsiflexion_plantarflexion_range !== undefined) {
                document.getElementById('maxAnkleDorsiflexionPlantarflexionAngle').textContent = 
                    `${resultData.maximum_ankle_dorsiflexion_plantarflexion_range}°`;
                console.log('Updated maxAnkleDorsiflexionPlantarflexionAngle element');
            } else {
                console.log('maximum_ankle_dorsiflexion_plantarflexion_range is undefined');
            }

            if (resultData.maximum_ankle_inversion_eversion_range !== undefined) {
                document.getElementById('maxAnkleInversionEversionAngle').textContent = 
                    `${resultData.maximum_ankle_inversion_eversion_range}°`;
                console.log('Updated maxAnkleInversionEversionAngle element');
            } else {
                console.log('maximum_ankle_inversion_eversion_range is undefined');
            }

            // Calculate Flexibility Score
            let minKneeAngle = 0;
            let legSeparationAngle = 0;
            let ankleDorsiPlantarFlexion = 0;
            let ankleInversionEversion = 0;

            // Extract numeric values from the displayed results
            if (resultData.minimum_knee_flexion_angle !== undefined) {
                minKneeAngle = resultData.minimum_knee_flexion_angle;
            }
            if (resultData.max_leg_separation_angle !== undefined) {
                legSeparationAngle = resultData.max_leg_separation_angle;
            }
            if (resultData.maximum_ankle_dorsiflexion_plantarflexion_range !== undefined) {
                ankleDorsiPlantarFlexion = resultData.maximum_ankle_dorsiflexion_plantarflexion_range;
            }
            if (resultData.maximum_ankle_inversion_eversion_range !== undefined) {
                ankleInversionEversion = resultData.maximum_ankle_inversion_eversion_range;
            }

            // Calculate Flexibility Score using the given formula
            const flexibilityScore = Math.round(
                0.0417 * (180 - minKneeAngle) + 
                0.0313 * legSeparationAngle + 
                0.1000 * ankleDorsiPlantarFlexion + 
                0.1250 * ankleInversionEversion
            );

            // Update the flexibility score display
            document.getElementById('flexibilityScore').textContent = flexibilityScore;
            console.log(`Calculated Flexibility Score: ${flexibilityScore}`);

            // Load and display hardware plot
            loadHardwarePlot();

            // Show any errors
            if (resultData.mediapipe_error) {
                console.error('MediaPipe error:', resultData.mediapipe_error);
                alert('MediaPipe Error: ' + resultData.mediapipe_error);
            }
            if (resultData.hardware_error) {
                console.error('Hardware error:', resultData.hardware_error);
                alert('Hardware Error: ' + resultData.hardware_error);
            }
            // Right after calculating flexibility score, add this:
            const exerciseContent = document.querySelector('.suggested-exercises-content');
            exerciseContent.innerHTML = '<p>Loading exercise recommendations...</p>';
        
            // ADD THIS NEW CODE - Get Exercise Recommendations (with 10s delay)
            setTimeout(async () => {
                try {
                    // Get user data for exercise recommendations
                    const userData = getUserData(currentUser);
                    const rawAge = parseInt(userData?.age || 30);
                    const rawMedicalCondition = userData?.medicalIssues || 'None';
                    const rawPainLevel = document.getElementById('painLevel')?.value || 'None';

                    // Map values to what the ML model expects
                    let medicalCondition;
                    if (rawMedicalCondition === 'None') {
                        medicalCondition = 'Healthy';
                    } else {
                        medicalCondition = rawMedicalCondition; // JointCare and Rehab stay the same
                    }

                    console.log('Exercise recommendation inputs:', {
                        rawAge,
                        rawMedicalCondition, medicalCondition,
                        flexibilityScore,
                        rawPainLevel
                    });

                    console.log('Requesting exercise recommendations...');

                    // Call exercise recommendation API (pass raw age, let backend do the mapping)
                    const exerciseResponse = await fetch(`http://127.0.0.1:5000/recommend-exercises?` + 
                        `age=${rawAge}&` +
                        `medical_condition=${medicalCondition}&` +
                        `flexibility_score=${flexibilityScore}&` +
                        `pain_level=${rawPainLevel}`
                    );

                    const exerciseResult = await exerciseResponse.json();
                    
                    if (exerciseResult.status === 'success') {
                        // Update the suggested exercises section
                        const exerciseContent = document.querySelector('.suggested-exercises-content');
                        exerciseContent.innerHTML = `
                            <h4>Recommended Category: ${exerciseResult.category}</h4>
                            <p><strong>Suggested Exercises:</strong></p>
                            <p>${exerciseResult.exercises}</p>
                        `;
                        console.log('Exercise recommendations updated:', exerciseResult.category);
                    } else {
                        throw new Error(exerciseResult.error || 'Exercise recommendation failed');
                    }

                } catch (error) {
                    console.error('Exercise Recommendation Error:', error);
                    
                    // Fallback exercise recommendations
                    const exerciseContent = document.querySelector('.suggested-exercises-content');
                    exerciseContent.innerHTML = `
                        <h4>General Recommendations</h4>
                        <p><strong>Suggested Exercises:</strong></p>
                        <p>Gentle stretching, basic flexibility exercises, and light movement activities.</p>
                    `;
                }
            }, 10000); // 10 second delay
        })
        .catch(err => {
            console.error('Error stopping session or fetching results:', err);
            alert('Error stopping session. Please check if the server is running.');
        });
});

// Function to load and display hardware plot
const loadHardwarePlot = () => {
    const plotContainer = document.querySelector('.angle-plot-placeholder');
    
    // Clear existing content
    plotContainer.innerHTML = '';
    
    // Create image element
    const img = document.createElement('img');
    img.src = 'http://127.0.0.1:5000/hardware-plot?' + new Date().getTime(); // Add timestamp to prevent caching
    img.alt = 'Hardware Angle Plot';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.border = '1px solid #ddd';
    img.style.borderRadius = '4px';
    
    // Handle image load success
    img.onload = () => {
        plotContainer.appendChild(img);
    };
    
    // Handle image load error
    img.onerror = () => {
        plotContainer.innerHTML = '<p>Hardware plot not available or still being generated.</p>';
    };
};




document.getElementById('saveSessionBtn').addEventListener('click', () => {
    if (!currentUser) {
        alert('No user logged in. Please log in or create an account first.');
        showPage(loginPage);
        return;
    }

    const userData = getUserData(currentUser);

    const sessionNumber = document.getElementById('sessionNumber').value;
    const sessionDate = document.getElementById('sessionDate').value;
    const painLevel = document.getElementById('painLevel').value;
    const minKneeAngle = document.getElementById('minKneeAngle').textContent;
    const maxLegSeparation = document.getElementById('maxLegSeparation').textContent;
    const maxAnkleDorsiflexionPlantarflexionAngle = document.getElementById('maxAnkleDorsiflexionPlantarflexionAngle').textContent;
    const maxAnkleInversionEversionAngle = document.getElementById('maxAnkleInversionEversionAngle').textContent;
    const flexibilityScore = document.getElementById('flexibilityScore').textContent;

    if (!sessionNumber || !sessionDate) {
        alert('Please fill in session number and date.');
        return;
    }

    const sessionData = {
        timestamp: new Date().toLocaleString(),
        username: currentUser,
        age: userData.age || 'N/A',
        gender: userData.gender || 'N/A',
        medicalIssues: userData.medicalIssues || 'None',
        sessionNumber: sessionNumber,
        sessionDate: sessionDate,
        painLevel: painLevel,
        minKneeAngle: minKneeAngle,
        maxLegSeparation: maxLegSeparation,
        maxAnkleDorsiflexionPlantarflexionAngle: maxAnkleDorsiflexionPlantarflexionAngle,
        maxAnkleInversionEversionAngle: maxAnkleInversionEversionAngle,
        flexibilityScore: flexibilityScore
    };
    
    // Save session data to the user's object in localStorage
    if (!userData.sessions) {
        userData.sessions = [];
    }
    userData.sessions.push(sessionData);
    saveUserData(currentUser, userData);
    
    // Convert to CSV and trigger download
    const headers = Object.keys(sessionData).join(',');
    const values = Object.values(sessionData).map(val => {
        if (typeof val === 'string' && (val.includes(',') || val.includes('\n') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
    }).join(',');

    let csvContent = "";
    // Check if user has previous sessions in localStorage for this user
    const previousCsvContent = localStorage.getItem(`user_sessions_csv_${currentUser}`);

    if (previousCsvContent) {
        csvContent = previousCsvContent + `\n${values}`;
    } else {
        csvContent = `${headers}\n${values}`;
    }

    localStorage.setItem(`user_sessions_csv_${currentUser}`, csvContent);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${currentUser}_flexi_track_sessions.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    } else {
        alert("Your browser does not support downloading files directly. Please copy the content manually.");
    }

    alert('Session details saved and downloaded as CSV!');
    clearInterval(sessionInterval);

    // Reset input fields and displays
    document.getElementById('sessionNumber').value = '';
    document.getElementById('sessionDate').value = '';
    document.getElementById('painLevel').value = 'None';
    document.getElementById('minKneeAngle').textContent = '0°';
    document.getElementById('maxLegSeparation').textContent = '0°';
    document.getElementById('maxAnkleDorsiflexionPlantarflexionAngle').textContent = '0°';
    document.getElementById('maxAnkleInversionEversionAngle').textContent = '0°';
    document.getElementById('flexibilityScore').textContent = '0';
});

// --- Flexibility Predictor Page Logic ---
// Dynamically generate options for 1-20 for Flexibility Score dropdown

document.addEventListener('DOMContentLoaded', () => {
    // Get pages
    const loginPage = document.getElementById('loginPage');
    const personalDetailsPage = document.getElementById('personalDetailsPage');
    const sessionDashboardPage = document.getElementById('sessionDashboardPage');
    const flexibilityPredictorPage = document.getElementById('flexibilityPredictorPage');

    // Helper to show a page
    const showPage = (pageToShow) => {
        [loginPage, personalDetailsPage, sessionDashboardPage, flexibilityPredictorPage].forEach(page => {
            page.classList.add('page-hidden');
        });
        pageToShow.classList.remove('page-hidden');
    };

    // --- Flexibility Predictor Logic ---
    const currentFlexibilityScoreSelect = document.getElementById('currentFlexibilityScore');
    for (let i = 1; i <= 20; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        currentFlexibilityScoreSelect.appendChild(option);
    }

    const updatePredictedFlexibility = async () => {
        const currentScore = parseInt(document.getElementById('currentFlexibilityScore').value);
        const numSessions = parseInt(document.getElementById('numberOfSessions').value);
        const predictedFlexibilityDisplay = document.getElementById('predictedFlexibility');

        if (isNaN(currentScore) || isNaN(numSessions) || numSessions <= 0) {
            predictedFlexibilityDisplay.textContent = '0';
            return;
        }

        try {
            // Get user data for prediction
            const userData = getUserData(currentUser);
            const age = userData?.age || 30;
            const medicalCondition = userData?.medicalIssues || 'None';
            
            // Get current pain level from session dashboard
            const painLevel = document.getElementById('painLevel')?.value || 'None';

            // Call ML prediction API
            const response = await fetch(`http://127.0.0.1:5000/predict-flexibility?` + 
                `age=${age}&` +
                `medical_condition=${medicalCondition}&` +
                `pain_level=${painLevel}&` +
                `initial_score=${currentScore}&` +
                `sessions=${numSessions}`
            );

            const result = await response.json();
            
            if (result.status === 'success') {
                predictedFlexibilityDisplay.textContent = result.predicted_score;
                console.log('ML Prediction:', result.predicted_score);
            } else {
                throw new Error(result.error || 'Prediction failed');
            }

        } catch (error) {
            console.error('ML Prediction Error:', error);
            
            // Fallback calculation
            let predictedScore = currentScore + (numSessions * 0.5) + (Math.random() * 2 - 1);
            predictedScore = Math.min(20, Math.max(currentScore, predictedScore));
            predictedScore = predictedScore.toFixed(1);
            
            predictedFlexibilityDisplay.textContent = predictedScore;
        }
    };
    document.getElementById('currentFlexibilityScore').addEventListener('change', updatePredictedFlexibility);
    document.getElementById('numberOfSessions').addEventListener('input', updatePredictedFlexibility);
    // Also update when pain level changes in session dashboard
    document.getElementById('painLevel').addEventListener('change', updatePredictedFlexibility);
    // ✅ Back button inside same scope
    document.getElementById('backToDashboardFromPredictorBtn').addEventListener('click', () => {
        showPage(sessionDashboardPage);
    });
});
