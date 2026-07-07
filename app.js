//app.js

// Global State
const appState = {
    isRunning: false,
    isPaused: false,
    currentPhase: 'focus', // 'focus' or 'break'
    timeRemaining: 0,
    totalTime: 0,
    sessionNumber: 1,
    selectedUnit: null,
    todos: [],
    sessions: [],
    is24HourFormat: true,
    settings: {
        focusDuration: 50,
        breakDuration: 10,
        sessionsBeforeLong: 4,
        longBreakDuration: 30,
        soundVolume: 70,
        soundType: 'bell1',
        customSound: null,
        focusMusic: '',
        breakMusic: '',
        autoPlayBreakMusic: true,
        backgroundVideoEnable: false,
        backgroundVideoUrl: '',
        videoLock: true
    },
    sessionStartTime: null,
    sessionStartedTodos: [],
    currentSessionData: null,
    settingsPanelOpen: false,
    todoPanelOpen: true
};

let timerInterval = null;
let completionChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadTodos();
    loadSessions();
    updateClock();
    setInterval(updateClock, 1000);
    setupEventListeners();
    initializeTimer();
    renderTodoList();

    // ✅ ALWAYS try to load video
    setTimeout(setupBackgroundVideo, 300);
});

// ==================== BACKGROUND VIDEO ====================
function setupBackgroundVideo() {
    const backgroundLayer = document.getElementById('backgroundLayer');
    const container = document.querySelector('.timer-container');

    if (!backgroundLayer) return;

    // reset
    backgroundLayer.innerHTML = '';
    container.classList.remove('video-active');

    if (!appState.settings.backgroundVideoEnable) {
        return;
    }

    const videoId = extractYouTubeId(appState.settings.backgroundVideoUrl);

    if (!videoId) {
        console.log("Invalid YouTube URL");
        return;
    }

    container.classList.add('video-active');

    const iframe = document.createElement('iframe');

    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&playsinline=1`;
    iframe.allow = "autoplay; fullscreen";

    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";
    iframe.style.zIndex = "0";
    iframe.style.pointerEvents = "none";
    iframe.style.filter = "brightness(0.4)";

    backgroundLayer.appendChild(iframe);
}
// ==================== CLOCK ====================
function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    let minutes = String(now.getMinutes()).padStart(2, '0');
    let seconds = String(now.getSeconds()).padStart(2, '0');

    let timeString;
    if (appState.is24HourFormat) {
        timeString = `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
    } else {
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        timeString = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
    }

    document.getElementById('clock').textContent = timeString;
}

document.getElementById('clockToggle').addEventListener('click', () => {
    appState.is24HourFormat = !appState.is24HourFormat;
    document.getElementById('clockToggle').textContent = appState.is24HourFormat ? '24h' : '12h';
    updateClock();
});

// ==================== TIMER ====================
function initializeTimer() {
    const focusDurationMs = appState.settings.focusDuration * 60;
    appState.timeRemaining = focusDurationMs;
    appState.totalTime = focusDurationMs;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const totalSeconds = appState.timeRemaining;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    if (appState.currentPhase === 'focus') {
        document.getElementById('focusTimer').textContent = timeString;
    } else {
        document.getElementById('breakTimer').textContent = timeString;
    }
}

function startTimer() {
    if (appState.isRunning) return;

    appState.isRunning = true;
    document.getElementById('startBtn').disabled = true;
    document.getElementById('pauseBtn').disabled = false;
    document.getElementById('stopBtn').disabled = false;

    if (!appState.sessionStartTime) {
        appState.sessionStartTime = Date.now();
        appState.sessionStartedTodos = JSON.parse(JSON.stringify(appState.todos.map(t => ({ id: t.id, checked: t.checked }))));
    }

    playBellSound();

    timerInterval = setInterval(() => {
        appState.timeRemaining--;
        updateTimerDisplay();

        if (appState.timeRemaining <= 0) {
            if (appState.currentPhase === 'focus') {
                completePhase('break');
            } else {
                completePhase('focus');
            }
        }
    }, 1000);
}

function pauseTimer() {
    if (!appState.isRunning) return;

    appState.isRunning = false;
    appState.isPaused = true;
    clearInterval(timerInterval);

    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
}

function stopTimer() {
    appState.isRunning = false;
    appState.isPaused = false;
    clearInterval(timerInterval);

    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;

    if (appState.currentPhase === 'focus') {
        saveSession();
    }

    resetTimer();
}

function resetTimer() {
    appState.timeRemaining = appState.currentPhase === 'focus' ?
        appState.settings.focusDuration * 60 :
        appState.settings.breakDuration * 60;

    appState.sessionStartTime = null;
    updateTimerDisplay();
}

function completePhase(newPhase) {
    clearInterval(timerInterval);
    appState.isRunning = false;

    playBellSound();
    showNotification(`Time's up! Transitioning to ${newPhase}...`);

    if (appState.currentPhase === 'focus' && newPhase === 'break') {
        saveSession();
        appState.currentPhase = 'break';
        appState.timeRemaining = appState.settings.breakDuration * 60;

        if (appState.settings.autoPlayBreakMusic && appState.settings.breakMusic) {
            playYouTubeVideo(appState.settings.breakMusic);
        }
    } else if (appState.currentPhase === 'break' && newPhase === 'focus') {
        appState.currentPhase = 'focus';
        appState.sessionNumber++;
        appState.timeRemaining = appState.settings.focusDuration * 60;
        appState.sessionStartTime = null;

        document.getElementById('sessionInfo').textContent = `Session ${appState.sessionNumber}`;
    }

    updateTimerDisplay();
    document.getElementById('startBtn').disabled = false;
    document.getElementById('pauseBtn').disabled = true;
    document.getElementById('stopBtn').disabled = true;
}

function saveSession() {
    if (!appState.sessionStartTime) return;

    const endTime = Date.now();
    const focusTimeSeconds = Math.floor((endTime - appState.sessionStartTime) / 1000);

    const completedTodos = appState.todos.filter(t => {
        const wasCheckedBefore = appState.sessionStartedTodos.some(st => st.id === t.id && st.checked);
        return t.checked && !wasCheckedBefore;
    }).map(t => t.text);

    const completedCount = appState.todos.filter(t => t.checked).length;
    const totalCount = appState.todos.length;
    const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const sessionData = {
        id: Date.now(),
        sessionNumber: appState.sessionNumber,
        unit: appState.selectedUnit || 'General Study',
        startTime: new Date(appState.sessionStartTime).toLocaleString(),
        focusTimeSec: focusTimeSeconds,
        completedTodos,
        completionPercent,
        totalTodos: totalCount
    };

    appState.sessions.push(sessionData);
    saveSessions();
}

// ==================== TODO LIST ====================
function parseTodoInput() {
    const input = document.getElementById('todoInput').value.trim();
    if (!input) {
        alert('Please enter some todo items');
        return;
    }

    const lines = input.split('\n').filter(line => line.trim());
    const todos = [];
    const itemStack = []; // Stack to track hierarchy

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        const level = calculateHierarchyLevel(trimmed);
        const id = `todo_${Date.now()}_${index}`;
        
        // Pop stack to find parent at correct level
        while (itemStack.length > 0 && itemStack[itemStack.length - 1].level >= level) {
            itemStack.pop();
        }
        
        const parentId = itemStack.length > 0 ? itemStack[itemStack.length - 1].id : null;

        const todoItem = {
            id,
            text: trimmed,
            level,
            parentId,
            checked: false,
            timestamps: [],
            order: todos.length
        };

        todos.push(todoItem);
        itemStack.push(todoItem);
    });

    appState.todos = todos;
    saveTodos();
    renderTodoList();

    // Populate unit selector
    const units = todos
    .filter(t => /^unit\s*[-–]?\s*[ivx\d]+/i.test(t.text.replace(/[\s-]/g,'')))
    .map(t => t.text.trim());
    populateUnitSelector(units);

    showNotification(`✅ Parsed ${todos.length} items with correct hierarchy!`);
}

function calculateHierarchyLevel(text) {
    // UNIT-I or UNIT - I pattern
    if (/^UNIT\s*-?\s*[IVX]+|^UNIT\s*-?\s*\d+/i.test(text)) {
        return 0;
    }
    
    // Match patterns like 1.2.3, 1.2.3.4, etc. (multiple dots)
    const multiDot = text.match(/^(\d+\.)+\d+/);
    if (multiDot) {
        const dots = multiDot[0].split('.').length - 1;
        return dots + 1;
    }
    
    // Match patterns like 1.2 (single dot)
    if (/^\d+\.\d+/.test(text)) {
        return 2;
    }
    
    // Match patterns like 1. or 1) or 1- (single number)
    if (/^\d+[\.\)\-]\s/.test(text) || /^\d+$/.test(text)) {
        return 1;
    }
    
    return 1; // Default to level 1
}

function renderTodoList() {
    // Tree View
    const treeView = document.getElementById('todoTree');
    treeView.innerHTML = '';

    const rootItems = appState.todos.filter(t => !t.parentId);
    rootItems.forEach(item => {
        treeView.appendChild(createTodoElement(item, false));
    });

    // Flat View
    const flatView = document.getElementById('todoList');
    flatView.innerHTML = '';
    appState.todos.forEach(item => {
        const element = createTodoElement(item, true);
        flatView.appendChild(element);
    });

    updateTodoStats();
}

function createTodoElement(todo, isFlat = false) {
    const container = document.createElement('div');
    container.className = `todo-item ${todo.checked ? 'completed' : ''}`;
    container.style.marginLeft = isFlat ? `${(todo.level) * 1.5}rem` : '0';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `todo_${todo.id}`;
    checkbox.checked = todo.checked;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    const labelContainer = document.createElement('div');
    labelContainer.style.flex = '1';

    const label = document.createElement('label');
    label.htmlFor = `todo_${todo.id}`;
    label.textContent = todo.text;
    label.style.fontWeight = todo.level === 0 ? 'bold' : 'normal';
    label.style.fontSize = todo.level === 0 ? '1.1rem' : 'inherit';

    labelContainer.appendChild(label);

    if (todo.timestamps.length > 0) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'todo-time';
        const lastTime = new Date(todo.timestamps[todo.timestamps.length - 1]).toLocaleTimeString();
        timeSpan.textContent = `Last: ${lastTime}`;
        labelContainer.appendChild(timeSpan);
    }

    container.appendChild(checkbox);
    container.appendChild(labelContainer);

    // Add children for tree view
    if (!isFlat) {
        const children = appState.todos.filter(t => t.parentId === todo.id);
        if (children.length > 0) {
            const childContainer = document.createElement('div');
            childContainer.className = 'todo-tree';
            childContainer.style.marginLeft = '2rem';
            childContainer.style.borderLeft = '2px solid #ddd';
            childContainer.style.paddingLeft = '0.5rem';
            children.forEach(child => {
                childContainer.appendChild(createTodoElement(child, false));
            });
            container.appendChild(childContainer);
        }
    }

    return container;
}

function toggleTodo(todoId) {
    const todo = appState.todos.find(t => t.id === todoId);
    if (todo) {
        todo.checked = !todo.checked;
        todo.timestamps.push(new Date().toISOString());
        saveTodos();
        renderTodoList();
    }
}

function updateTodoStats() {
    const total = appState.todos.length;
    const completed = appState.todos.filter(t => t.checked).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalTodos').textContent = total;
    document.getElementById('completedTodos').textContent = completed;
    document.getElementById('todoProgress').textContent = `${percent}%`;
}

function populateUnitSelector(units) {
    const select = document.getElementById('unitSelect');
    const currentValue = select.value;

    select.innerHTML = '<option value="">None - General Study</option>';
    units.forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        select.appendChild(option);
    });

    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
        select.value = currentValue;
    }
}

// ==================== SETTINGS ====================
function loadSettings() {
    const saved = localStorage.getItem('pomodoroSettings');
    if (saved) {
        appState.settings = { ...appState.settings, ...JSON.parse(saved) };
    }
    applySettings();
}

function applySettings() {
    document.getElementById('focusDuration').value = appState.settings.focusDuration;
    document.getElementById('breakDuration').value = appState.settings.breakDuration;
    document.getElementById('sessionsBeforeLong').value = appState.settings.sessionsBeforeLong;
    document.getElementById('longBreakDuration').value = appState.settings.longBreakDuration;
    document.getElementById('soundVolume').value = appState.settings.soundVolume;
    document.getElementById('soundType').value = appState.settings.soundType;
    document.getElementById('focusMusic').value = appState.settings.focusMusic;
    document.getElementById('breakMusic').value = appState.settings.breakMusic;
    document.getElementById('autoPlayBreakMusic').checked = appState.settings.autoPlayBreakMusic;
    document.getElementById('backgroundVideoEnable').checked = appState.settings.backgroundVideoEnable;
    document.getElementById('backgroundVideoUrl').value = appState.settings.backgroundVideoUrl;
    document.getElementById('videoLock').checked = appState.settings.videoLock;
}

document.getElementById('saveSettings').addEventListener('click', () => {
    appState.settings.focusDuration = parseInt(document.getElementById('focusDuration').value);
    appState.settings.breakDuration = parseInt(document.getElementById('breakDuration').value);
    appState.settings.sessionsBeforeLong = parseInt(document.getElementById('sessionsBeforeLong').value);
    appState.settings.longBreakDuration = parseInt(document.getElementById('longBreakDuration').value);
    appState.settings.soundVolume = parseInt(document.getElementById('soundVolume').value);
    appState.settings.soundType = document.getElementById('soundType').value;
    appState.settings.focusMusic = document.getElementById('focusMusic').value;
    appState.settings.breakMusic = document.getElementById('breakMusic').value;
    appState.settings.autoPlayBreakMusic = document.getElementById('autoPlayBreakMusic').checked;
    appState.settings.backgroundVideoEnable = document.getElementById('backgroundVideoEnable').checked;
    appState.settings.backgroundVideoUrl = document.getElementById('backgroundVideoUrl').value;
    appState.settings.videoLock = document.getElementById('videoLock').checked;

    localStorage.setItem('pomodoroSettings', JSON.stringify(appState.settings));
    initializeTimer();
    setupBackgroundVideo();
    showNotification('✅ Settings saved!');
    document.getElementById('settingsPanel').classList.remove('active');
    appState.settingsPanelOpen = false;
});

document.getElementById('resetSettings').addEventListener('click', () => {
    appState.settings = {
        focusDuration: 50,
        breakDuration: 10,
        sessionsBeforeLong: 4,
        longBreakDuration: 30,
        soundVolume: 70,
        soundType: 'bell1',
        customSound: null,
        focusMusic: '',
        breakMusic: '',
        autoPlayBreakMusic: true,
        backgroundVideoEnable: false,
        backgroundVideoUrl: '',
        videoLock: true
    };
    localStorage.removeItem('pomodoroSettings');
    applySettings();
    initializeTimer();
    showNotification('🔄 Settings reset to defaults');
});

// ==================== SOUND ====================
function playBellSound() {
    const volume = appState.settings.soundVolume / 100;
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const now = audioContext.currentTime;
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc1.frequency.value = 800;
    osc2.frequency.value = 1200;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
}

// ==================== YOUTUBE ====================
function playYouTubeVideo(url) {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        showNotification('❌ Invalid YouTube URL');
        return;
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    window.open(youtubeUrl, 'youtube_player', 'width=900,height=650,menubar=no,toolbar=no');
}

function extractYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

document.getElementById('playFocusMusic').addEventListener('click', () => {
    const url = document.getElementById('focusMusic').value;
    if (url) {
        playYouTubeVideo(url);
    } else {
        showNotification('❌ Please enter a YouTube URL first');
    }
});

// ==================== NOTIFICATIONS ====================
function showNotification(message) {
    const notification = document.getElementById('notification');
    document.getElementById('notificationText').textContent = message;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// ==================== ANALYTICS ====================
function loadSessions() {
    const saved = localStorage.getItem('pomodoroSessions');
    if (saved) {
        appState.sessions = JSON.parse(saved);
    }
}

function saveSessions() {
    localStorage.setItem('pomodoroSessions', JSON.stringify(appState.sessions));
}

document.getElementById('analyticsBtn').addEventListener('click', () => {
    document.getElementById('analyticsModal').classList.remove('hidden');
    populateAnalytics();
});

document.getElementById('closeAnalytics').addEventListener('click', () => {
    document.getElementById('analyticsModal').classList.add('hidden');
});

function populateAnalytics() {
    const totalSessions = appState.sessions.length;
    const totalFocusTimeSec = appState.sessions.reduce((sum, s) => sum + (s.focusTimeSec || 0), 0);
    const totalFocusHours = (totalFocusTimeSec / 3600).toFixed(1);
    const overallCompletion = appState.sessions.length > 0 ?
        Math.round(appState.sessions.reduce((sum, s) => sum + s.completionPercent, 0) / totalSessions) :
        0;

    const today = new Date().toDateString();
    const todaySessions = appState.sessions.filter(s => new Date(s.startTime).toDateString() === today).length;

    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalFocusTime').textContent = `${totalFocusHours}h`;
    document.getElementById('overallCompletion').textContent = `${overallCompletion}%`;
    document.getElementById('todaySessions').textContent = todaySessions;

    // Pie Chart
    const completedSessions = appState.sessions.filter(s => s.completionPercent >= 80).length;
    const partialSessions = appState.sessions.filter(s => s.completionPercent >= 50 && s.completionPercent < 80).length;
    const minimalSessions = totalSessions - completedSessions - partialSessions;

    const ctx = document.getElementById('completionChart').getContext('2d');
    if (completionChart) {
        completionChart.destroy();
    }

    completionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['✅ High (80%+)', '⚠️ Medium (50-80%)', '❌ Low (<50%)'],
            datasets: [{
                data: [completedSessions, partialSessions, minimalSessions],
                backgroundColor: ['#4CAF50', '#FFC107', '#f44336'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Populate table
    const tbody = document.getElementById('sessionsTableBody');
    tbody.innerHTML = '';

    appState.sessions.forEach((session, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${session.startTime}</td>
            <td>${session.unit}</td>
            <td>${Math.round(session.focusTimeSec / 60)} min</td>
            <td>${session.completionPercent}%</td>
            <td>${session.completedTodos.length}</td>
            <td>
                <button class="btn-secondary" onclick="viewSessionDetails(${session.id})" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; margin-right: 0.3rem;">View</button>
                <button class="btn-delete" onclick="deleteSession(${session.id})" style="padding: 0.4rem 0.8rem; font-size: 0.85rem; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function viewSessionDetails(sessionId) {
    const session = appState.sessions.find(s => s.id === sessionId);
    if (session) {
        alert(`Session ${session.sessionNumber}\nDate: ${session.startTime}\nUnit: ${session.unit}\nDuration: ${Math.round(session.focusTimeSec / 60)} min\nCompletion: ${session.completionPercent}%\nTopics Covered: ${session.completedTodos.length > 0 ? session.completedTodos.join(', ') : 'None'}`);
    }
}

function deleteSession(sessionId) {
    if (confirm('Are you sure you want to delete this session?')) {
        appState.sessions = appState.sessions.filter(s => s.id !== sessionId);
        saveSessions();
        populateAnalytics();
        showNotification('🗑️ Session deleted');
    }
}

// ==================== EXPORT ====================
document.getElementById('exportJSON').addEventListener('click', () => {
    const dataToExport = {
        sessions: appState.sessions,
        todos: appState.todos,
        settings: appState.settings,
        exportDate: new Date().toLocaleString()
    };

    const dataStr = JSON.stringify(dataToExport, null, 2);
    downloadFile(dataStr, 'pomodoro_data.json', 'application/json');
});

document.getElementById('exportCSV').addEventListener('click', () => {
    let csv = 'Session #,Date,Unit,Duration (min),Completion %,Topics Completed\n';

    appState.sessions.forEach((session, index) => {
        const duration = Math.round(session.focusTimeSec / 60);
        const topics = session.completedTodos.join(';');
        csv += `${index + 1},"${session.startTime}","${session.unit}",${duration},${session.completionPercent}%,"${topics}"\n`;
    });

    downloadFile(csv, 'pomodoro_sessions.csv', 'text/csv');
});

document.getElementById('exportPDF').addEventListener('click', () => {
    const element = document.createElement('div');
    element.innerHTML = `
        <h1>Pomodoro Study Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <h2>Summary</h2>
        <p>Total Sessions: ${appState.sessions.length}</p>
        <p>Overall Completion: ${Math.round(appState.sessions.reduce((s, x) => s + x.completionPercent, 0) / appState.sessions.length)}%</p>
        <h2>Session Details</h2>
        <table border="1" cellpadding="10">
            <tr>
                <th>#</th>
                <th>Date</th>
                <th>Unit</th>
                <th>Completion %</th>
            </tr>
            ${appState.sessions.map((s, i) => `<tr>
                <td>${i + 1}</td>
                <td>${s.startTime}</td>
                <td>${s.unit}</td>
                <td>${s.completionPercent}%</td>
            </tr>`).join('')}
        </table>
    `;

    const opt = {
        margin: 10,
        filename: 'pomodoro_report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
    };

    html2pdf().set(opt).from(element).save();
});

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

// ==================== STORAGE ====================
function saveTodos() {
    localStorage.setItem('pomodoroTodos', JSON.stringify(appState.todos));
}
document.getElementById('deleteUnitBtn').addEventListener('click', () => {
    const selected = document.getElementById('unitSelect').value;

    if (!selected) {
        showNotification("⚠️ Select a unit first");
        return;
    }

    // remove from todos
    appState.todos = appState.todos.filter(t => t.text !== selected);

    saveTodos();
    renderTodoList();

    // refresh dropdown
    const units = appState.todos
        .filter(t => /^unit/i.test(t.text))
        .map(t => t.text);

    populateUnitSelector(units);

    showNotification("🗑️ Unit deleted");
});
function loadTodos() {
    const saved = localStorage.getItem('pomodoroTodos');
    if (saved) {
        appState.todos = JSON.parse(saved);
    }
}

// ==================== AI POPUP ====================
document.getElementById('aiBtn').addEventListener('click', () => {
    const popup = document.getElementById('aiPopup');
    popup.classList.toggle('hidden');
});

document.getElementById('closeAI').addEventListener('click', () => {
    document.getElementById('aiPopup').classList.add('hidden');
});

document.getElementById('openGemini').addEventListener('click', () => {
    window.open('https://gemini.google.com', 'gemini_ai', 'width=1200,height=800');
});

document.getElementById('openChatGPT').addEventListener('click', () => {
    window.open('https://chat.openai.com', 'chatgpt_ai', 'width=1200,height=800');
});

// ==================== SETTINGS SIDEBAR ====================
document.getElementById('settingsBtn').addEventListener('click', () => {
    appState.settingsPanelOpen = !appState.settingsPanelOpen;
    const panel = document.getElementById('settingsPanel');
    
    if (appState.settingsPanelOpen) {
        panel.classList.add('active');
        // Don't close todo panel
    } else {
        panel.classList.remove('active');
    }
});

document.getElementById('closeSettings').addEventListener('click', () => {
    document.getElementById('settingsPanel').classList.remove('active');
    appState.settingsPanelOpen = false;
});

// ==================== TODO SIDEBAR ====================
document.getElementById('todoPanel').classList.add('active');

// View Toggle
document.getElementById('treeViewBtn').addEventListener('click', () => {
    document.getElementById('treeView').classList.remove('hidden');
    document.getElementById('flatView').classList.add('hidden');
    document.getElementById('treeViewBtn').classList.add('active');
    document.getElementById('flatViewBtn').classList.remove('active');
});

document.getElementById('flatViewBtn').addEventListener('click', () => {
    document.getElementById('flatView').classList.remove('hidden');
    document.getElementById('treeView').classList.add('hidden');
    document.getElementById('flatViewBtn').classList.add('active');
    document.getElementById('treeViewBtn').classList.remove('active');
});

// Todo Actions
document.getElementById('parseTodoBtn').addEventListener('click', parseTodoInput);

document.getElementById('selectUnitBtn').addEventListener('click', () => {
    const el = document.getElementById('unitSelector');
    el.classList.remove('hidden');
});
document.getElementById('confirmUnitBtn').addEventListener('click', () => {
    const value = document.getElementById('unitSelect').value;

    if (!value) {
        showNotification("⚠️ Please select a unit first");
        return;
    }

    appState.selectedUnit = value;

    document.getElementById('unitSelector').classList.add('hidden');

    // 🔥 show in UI
    document.getElementById('sessionInfo').textContent = value;

    showNotification(`📘 Selected: ${value}`);
});

document.getElementById('clearTodoBtn').addEventListener('click', () => {
    if (confirm('Clear all todos?')) {
        appState.todos = [];
        saveTodos();
        renderTodoList();
        showNotification('All todos cleared');
    }
});

// ==================== TIMER CONTROLS ====================
document.getElementById('startBtn').addEventListener('click', startTimer);
document.getElementById('pauseBtn').addEventListener('click', pauseTimer);
document.getElementById('stopBtn').addEventListener('click', stopTimer);
document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset timer?')) {
        resetTimer();
        appState.isRunning = false;
        appState.isPaused = false;
        clearInterval(timerInterval);
        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
    }
});


// ==================== TODO RESIZER ====================
const resizer = document.getElementById('resizer');
const sidebar = document.getElementById('todoPanel');

let isResizing = false;

resizer.addEventListener('mousedown', () => {
    isResizing = true;
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;

    if (newWidth > 200 && newWidth < 800) {
        sidebar.style.width = newWidth + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = 'default';
});

// ==================== HELPER FUNCTION ====================
function setupEventListeners() {
    // All event listeners are set up above
}