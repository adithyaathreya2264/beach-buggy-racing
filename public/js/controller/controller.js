// public/js/controller/controller.js

let socket = null;
let roomCode = null;
let playerNumber = null;
let isHost = false;
let playerName = '';

// Input state
let inputState = {
    steering: 0,      // -1 (left), 0 (center), 1 (right)
    brake: false,
    timestamp: Date.now()
};

// Screen elements
const screens = {
    welcome: document.getElementById('welcomeScreen'),
    codeEntry: document.getElementById('codeEntryScreen'),
    lobby: document.getElementById('lobbyScreen'),
    controller: document.getElementById('controllerScreen')
};

// Initialize when page loads
window.addEventListener('DOMContentLoaded', () => {
    initializeController();
    setupCodeInput();
    setupEventListeners();
});

// ============================================
// INITIALIZATION
// ============================================

function initializeController() {
    // Check if room code is in URL (QR code scan)
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoomCode = urlParams.get('room');
    
    if (urlRoomCode) {
        // Auto-fill room code and go to code entry screen
        showScreen('codeEntry');
        autoFillCode(urlRoomCode);
        // Optionally auto-join
        setTimeout(() => {
            document.getElementById('joinGameBtn').click();
        }, 500);
    } else {
        showScreen('welcome');
    }
}

// ============================================
// SCREEN MANAGEMENT
// ============================================

function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

// ============================================
// CODE INPUT HANDLING
// ============================================

function setupCodeInput() {
    const digits = document.querySelectorAll('.code-digit');
    
    digits.forEach((digit, index) => {
        // Auto-focus next digit on input
        digit.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow numbers
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            if (value.length === 1) {
                e.target.classList.add('filled');
                
                // Move to next digit
                if (index < digits.length - 1) {
                    digits[index + 1].focus();
                } else {
                    // All digits filled, enable join button
                    validateAndEnableJoin();
                }
            }
        });
        
        // Handle backspace
        digit.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                digits[index - 1].focus();
                digits[index - 1].value = '';
                digits[index - 1].classList.remove('filled');
            }
        });
        
        // Remove filled class when empty
        digit.addEventListener('input', (e) => {
            if (!e.target.value) {
                e.target.classList.remove('filled');
            }
            validateAndEnableJoin();
        });
    });
    
    // Auto-focus first digit
    digits[0].focus();
}

function validateAndEnableJoin() {
    const digits = document.querySelectorAll('.code-digit');
    const code = Array.from(digits).map(d => d.value).join('');
    const joinBtn = document.getElementById('joinGameBtn');
    
    if (code.length === 6 && /^\d{6}$/.test(code)) {
        joinBtn.disabled = false;
    } else {
        joinBtn.disabled = true;
    }
}

function autoFillCode(code) {
    const digits = document.querySelectorAll('.code-digit');
    const codeStr = code.toString();
    
    for (let i = 0; i < Math.min(6, codeStr.length); i++) {
        digits[i].value = codeStr[i];
        digits[i].classList.add('filled');
    }
    
    validateAndEnableJoin();
}

function getEnteredCode() {
    const digits = document.querySelectorAll('.code-digit');
    return Array.from(digits).map(d => d.value).join('');
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Connect button
    document.getElementById('connectBtn').addEventListener('click', () => {
        showScreen('codeEntry');
    });
    
    // Back to welcome
    document.getElementById('backToWelcome').addEventListener('click', () => {
        showScreen('welcome');
    });
    
    // Join game button
    document.getElementById('joinGameBtn').addEventListener('click', () => {
        joinGame();
    });
    
    // Disconnect button
    document.getElementById('disconnectBtn').addEventListener('click', () => {
        if (confirm('Disconnect from game?')) {
            disconnectFromGame();
        }
    });
    
    // Exit game button
    document.getElementById('exitGameBtn').addEventListener('click', () => {
        if (confirm('Exit game?')) {
            disconnectFromGame();
        }
    });
    
    // Host controls (map selection)
    document.querySelectorAll('.map-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!isHost) return;
            
            // Remove selected class from all
            document.querySelectorAll('.map-option').forEach(b => b.classList.remove('selected'));
            // Add to clicked
            e.target.classList.add('selected');
            
            // Emit to server
            const mapId = e.target.dataset.map;
            socket.emit('selectMap', { roomCode, mapId });
        });
    });
    
    // Host controls (game mode selection)
    document.querySelectorAll('.mode-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (!isHost) return;
            
            // Remove selected class from all
            document.querySelectorAll('.mode-option').forEach(b => b.classList.remove('selected'));
            // Add to clicked
            e.target.classList.add('selected');
            
            // Emit to server
            const gameMode = e.target.dataset.mode;
            socket.emit('selectGameMode', { roomCode, gameMode });
        });
    });
    
    // Touch controls (will be set up after game starts)
    setupTouchControls();
}

// ============================================
// SOCKET.IO CONNECTION
// ============================================

function joinGame() {
    const code = getEnteredCode();
    playerName = document.getElementById('playerName').value.trim() || 'Player';
    
    if (code.length !== 6) {
        showError('Please enter a valid 6-digit code');
        return;
    }
    
    showLoading(true);
    
    // Initialize Socket.IO connection
    socket = io({
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });
    
    // Connection handlers
    socket.on('connect', () => {
        console.log('[Controller] Connected to server');
        
        // Join the room
        socket.emit('joinRoom', { 
            roomCode: code, 
            playerName: playerName 
        }, (response) => {
            showLoading(false);
            
            if (response.success) {
                roomCode = code;
                playerNumber = response.playerNumber;
                isHost = response.isHost;
                
                console.log(`[Controller] Joined as Player ${playerNumber}`);
                
                // Update UI
                updatePlayerInfo();
                
                // Show lobby screen
                showScreen('lobby');
                
            } else {
                showError(response.error || 'Failed to join game');
            }
        });
    });
    
    socket.on('connect_error', (error) => {
        console.error('[Controller] Connection error:', error);
        showLoading(false);
        showError('Unable to connect to server');
    });
    
    // Player joined event
    socket.on('playerJoined', (data) => {
        console.log('[Controller] Player joined:', data);
        document.getElementById('connectedPlayersInfo').textContent = 
            `Players connected: ${data.totalPlayers}/4`;
    });
    
    // Player left event
    socket.on('playerLeft', (data) => {
        console.log('[Controller] Player left:', data);
        document.getElementById('connectedPlayersInfo').textContent = 
            `Players connected: ${data.totalPlayers}/4`;
    });
    
    // Game starting event
    socket.on('gameStarting', (data) => {
        console.log('[Controller] Game starting!', data);
        
        // Show countdown
        showCountdown(data.countdown);
        
        // Switch to controller screen after countdown
        setTimeout(() => {
            showScreen('controller');
            startSendingInputs();
        }, data.countdown * 1000);
    });
    
    // Room closed event
    socket.on('roomClosed', (data) => {
        alert('Room closed: ' + data.reason);
        disconnectFromGame();
    });
}

function disconnectFromGame() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    roomCode = null;
    playerNumber = null;
    isHost = false;
    
    // Reset code inputs
    document.querySelectorAll('.code-digit').forEach(d => {
        d.value = '';
        d.classList.remove('filled');
    });
    
    showScreen('welcome');
}

// ============================================
// TOUCH CONTROLS
// ============================================

function setupTouchControls() {
    const steerLeft = document.getElementById('steerLeft');
    const steerRight = document.getElementById('steerRight');
    const brakeBtn = document.getElementById('brakeBtn');
    
    // Left steering
    steerLeft.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputState.steering = -1;
        steerLeft.classList.add('active');
    });
    
    steerLeft.addEventListener('touchend', (e) => {
        e.preventDefault();
        inputState.steering = 0;
        steerLeft.classList.remove('active');
    });
    
    // Right steering
    steerRight.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputState.steering = 1;
        steerRight.classList.add('active');
    });
    
    steerRight.addEventListener('touchend', (e) => {
        e.preventDefault();
        inputState.steering = 0;
        steerRight.classList.remove('active');
    });
    
    // Brake/Drift button
    brakeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputState.brake = true;
        brakeBtn.classList.add('active');
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    });
    
    brakeBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        inputState.brake = false;
        brakeBtn.classList.remove('active');
    });
    
    // Also support mouse for testing on desktop
    setupMouseControls(steerLeft, steerRight, brakeBtn);
}

function setupMouseControls(steerLeft, steerRight, brakeBtn) {
    // Left steering
    steerLeft.addEventListener('mousedown', () => {
        inputState.steering = -1;
        steerLeft.classList.add('active');
    });
    
    steerLeft.addEventListener('mouseup', () => {
        inputState.steering = 0;
        steerLeft.classList.remove('active');
    });
    
    steerLeft.addEventListener('mouseleave', () => {
        inputState.steering = 0;
        steerLeft.classList.remove('active');
    });
    
    // Right steering
    steerRight.addEventListener('mousedown', () => {
        inputState.steering = 1;
        steerRight.classList.add('active');
    });
    
    steerRight.addEventListener('mouseup', () => {
        inputState.steering = 0;
        steerRight.classList.remove('active');
    });
    
    steerRight.addEventListener('mouseleave', () => {
        inputState.steering = 0;
        steerRight.classList.remove('active');
    });
    
    // Brake
    brakeBtn.addEventListener('mousedown', () => {
        inputState.brake = true;
        brakeBtn.classList.add('active');
    });
    
    brakeBtn.addEventListener('mouseup', () => {
        inputState.brake = false;
        brakeBtn.classList.remove('active');
    });
    
    brakeBtn.addEventListener('mouseleave', () => {
        inputState.brake = false;
        brakeBtn.classList.remove('active');
    });
}

// ============================================
// INPUT SENDING
// ============================================

let inputInterval = null;

function startSendingInputs() {
    // Send inputs at 60Hz (every ~16ms)
    inputInterval = setInterval(() => {
        if (socket && roomCode) {
            inputState.timestamp = Date.now();
            
            socket.emit('controllerInput', {
                roomCode: roomCode,
                input: inputState
            });
        }
    }, 16);
}

function stopSendingInputs() {
    if (inputInterval) {
        clearInterval(inputInterval);
        inputInterval = null;
    }
}

// ============================================
// UI UPDATES
// ============================================

function updatePlayerInfo() {
    document.getElementById('playerNumberDisplay').textContent = playerNumber;
    document.getElementById('playerNameDisplay').textContent = playerName;
    document.getElementById('gamePlayerNumber').textContent = playerNumber;
    
    if (isHost) {
        document.getElementById('playerRoleDisplay').textContent = '👑 Host';
        document.getElementById('hostControls').style.display = 'block';
        
        // Select first map and mode by default
        document.querySelector('.map-option').classList.add('selected');
        document.querySelector('.mode-option').classList.add('selected');
    } else {
        document.getElementById('playerRoleDisplay').textContent = '🎮 Player';
        document.getElementById('hostControls').style.display = 'none';
    }
}

function showError(message) {
    const errorEl = document.getElementById('codeError');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 3000);
}

function showLoading(show) {
    document.getElementById('mobileLoading').style.display = show ? 'flex' : 'none';
}

function showCountdown(seconds) {
    // This will be enhanced later with visual countdown
    console.log(`Game starting in ${seconds} seconds...`);
}

// ============================================
// CLEANUP
// ============================================

window.addEventListener('beforeunload', () => {
    stopSendingInputs();
    if (socket) {
        socket.disconnect();
    }
});
