// Configuration management JavaScript
'use strict';

let currentConfig = {};

// Load configuration on page load
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
});

async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        const result = await response.json();
        
        if (result.success) {
            currentConfig = result.data;
            renderConfig();
        } else {
            showAlert('Failed to load configuration: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error loading configuration: ' + error.message, 'danger');
    }
}

function renderConfig() {
    renderUsers();
    renderPersonalTasks();
    renderGeneralTasks();
    renderMessages();
}

function renderUsers() {
    const container = document.getElementById('users-config');
    container.innerHTML = '';
    
    for (const [userId, userConfig] of Object.entries(currentConfig.users)) {
        const userDiv = document.createElement('div');
        userDiv.className = 'mb-3 p-3 border rounded';
        userDiv.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <label class="form-label">User ID</label>
                    <input type="text" class="form-control" value="${userId}" onchange="updateUserId('${userId}', this.value)" readonly>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Display Name</label>
                    <input type="text" class="form-control" value="${userConfig.displayName}" onchange="updateUser('${userId}', 'displayName', this.value)">
                </div>
                <div class="col-md-2">
                    <label class="form-label">Tasks/Week</label>
                    <input type="number" class="form-control" value="${userConfig.tasksPerWeek}" min="1" max="14" onchange="updateUser('${userId}', 'tasksPerWeek', parseInt(this.value))">
                </div>
                <div class="col-md-2">
                    <label class="form-label">Color</label>
                    <input type="color" class="form-control" value="${userConfig.color}" onchange="updateUser('${userId}', 'color', this.value)">
                </div>
            </div>
            <button class="btn btn-outline-danger btn-sm mt-2" onclick="removeUser('${userId}')">Remove User</button>
        `;
        container.appendChild(userDiv);
    }
}

function renderPersonalTasks() {
    const container = document.getElementById('personal-tasks-config');
    container.innerHTML = '';
    
    currentConfig.personalTasks.forEach((task, index) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'mb-2 input-group';
        taskDiv.innerHTML = `
            <input type="text" class="form-control" value="${task}" onchange="updatePersonalTask(${index}, this.value)">
            <button class="btn btn-outline-danger" onclick="removePersonalTask(${index})">Remove</button>
        `;
        container.appendChild(taskDiv);
    });
}

function renderGeneralTasks() {
    const container = document.getElementById('general-tasks-config');
    container.innerHTML = '';
    
    currentConfig.generalTasks.tasks.forEach((task, index) => {
        const taskDiv = document.createElement('div');
        taskDiv.className = 'mb-2 input-group';
        taskDiv.innerHTML = `
            <input type="text" class="form-control" value="${task}" onchange="updateGeneralTask(${index}, this.value)">
            <button class="btn btn-outline-danger" onclick="removeGeneralTask(${index})">Remove</button>
        `;
        container.appendChild(taskDiv);
    });
    
    // Update count automatically
    currentConfig.generalTasks.count = currentConfig.generalTasks.tasks.length;
}

function renderMessages() {
    const container = document.getElementById('messages-config');
    container.innerHTML = '';
    
    currentConfig.messages.forEach((message, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-2 input-group';
        messageDiv.innerHTML = `
            <input type="text" class="form-control" value="${message}" onchange="updateMessage(${index}, this.value)">
            <button class="btn btn-outline-danger" onclick="removeMessage(${index})">Remove</button>
        `;
        container.appendChild(messageDiv);
    });
}

// Update functions
function updateUser(userId, field, value) {
    if (currentConfig.users[userId]) {
        currentConfig.users[userId][field] = value;
    }
}

function updatePersonalTask(index, value) {
    currentConfig.personalTasks[index] = value;
}

function updateGeneralTask(index, value) {
    currentConfig.generalTasks.tasks[index] = value;
    currentConfig.generalTasks.count = currentConfig.generalTasks.tasks.length;
}

function updateMessage(index, value) {
    currentConfig.messages[index] = value;
}

// Add functions
function addUser() {
    const userId = prompt('Enter user ID (lowercase, no spaces):');
    if (userId && !currentConfig.users[userId]) {
        currentConfig.users[userId] = {
            displayName: userId.charAt(0).toUpperCase() + userId.slice(1),
            tasksPerWeek: 7,
            color: '#' + Math.floor(Math.random()*16777215).toString(16)
        };
        renderUsers();
    }
}

function addPersonalTask() {
    const task = prompt('Enter task name:');
    if (task) {
        currentConfig.personalTasks.push(task);
        renderPersonalTasks();
    }
}

function addGeneralTask() {
    const task = prompt('Enter general task name:');
    if (task) {
        currentConfig.generalTasks.tasks.push(task);
        currentConfig.generalTasks.count = currentConfig.generalTasks.tasks.length;
        renderGeneralTasks();
    }
}

function addMessage() {
    const message = prompt('Enter celebration message:');
    if (message) {
        currentConfig.messages.push(message);
        renderMessages();
    }
}

// Remove functions
function removeUser(userId) {
    if (confirm(`Are you sure you want to remove user "${userId}"?`)) {
        delete currentConfig.users[userId];
        renderUsers();
    }
}

function removePersonalTask(index) {
    currentConfig.personalTasks.splice(index, 1);
    renderPersonalTasks();
}

function removeGeneralTask(index) {
    currentConfig.generalTasks.tasks.splice(index, 1);
    currentConfig.generalTasks.count = currentConfig.generalTasks.tasks.length;
    renderGeneralTasks();
}

function removeMessage(index) {
    currentConfig.messages.splice(index, 1);
    renderMessages();
}

// Save configuration
async function saveConfig() {
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(currentConfig)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Configuration saved successfully! Task states have been reset to match the new configuration.', 'success');
        } else {
            showAlert('Failed to save configuration: ' + result.error, 'danger');
        }
    } catch (error) {
        showAlert('Error saving configuration: ' + error.message, 'danger');
    }
}

// Reset configuration
async function resetConfig() {
    if (confirm('Are you sure you want to reset the configuration to defaults? This will also reset all task states.')) {
        try {
            // Load defaults by creating a new config manager instance
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    "users": {
                        "milou": {
                            "tasksPerWeek": 7,
                            "color": "#0ef706dc",
                            "displayName": "Milou"
                        },
                        "luca": {
                            "tasksPerWeek": 7,
                            "color": "#29b100",
                            "displayName": "Luca"
                        }
                    },
                    "generalTasks": {
                        "count": 2,
                        "tasks": [
                            "Huiskamer opruimen",
                            "Takken verzorgen"
                        ]
                    },
                    "personalTasks": [
                        "Vaatwasser",
                        "tafel dekken/afruimen", 
                        "Koken",
                        "Vuilnis/Papier wegbrengen",
                        "Kamer opruimen",
                        "Boodschappen",
                        "Overig",
                        "Joker"
                    ],
                    "weekdays": [
                        "Zondag",
                        "Maandag", 
                        "Dinsdag",
                        "Woensdag",
                        "Donderdag",
                        "Vrijdag",
                        "Zaterdag"
                    ],
                    "messages": [
                        "lekker bezig! 🚀",
                        "ga zo door! 🌟",
                        "held! 💪",
                        "knapperd! 😎",
                        "je hebt jezelf overtroffen! 🎉",
                        "je bent een topper! ⭐",
                        "fantastisch werk! 👏",
                        "je maakt het verschil! 🌈",
                        "je rockt! 🎸",
                        "briljant gedaan! 💡",
                        "superster! 🌟",
                        "gewoon geweldig! 🏆"
                    ]
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showAlert('Configuration reset to defaults successfully!', 'success');
                await loadConfig(); // Reload the configuration
            } else {
                showAlert('Failed to reset configuration: ' + result.error, 'danger');
            }
        } catch (error) {
            showAlert('Error resetting configuration: ' + error.message, 'danger');
        }
    }
}

// Utility function to show alerts
function showAlert(message, type) {
    const alertsContainer = document.getElementById('alerts');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertsContainer.appendChild(alertDiv);
    
    // Auto-remove success alerts after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
}
