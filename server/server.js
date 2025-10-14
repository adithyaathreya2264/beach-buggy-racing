// server/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const QRCode = require('qrcode');
const RoomManager = require('./roomManager');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS configuration
const io = socketIO(server, {
    cors: {
        origin: "*", // In production, specify your domain
        methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Room Manager
const roomManager = new RoomManager();

// ============================================
// HTTP ROUTES
// ============================================

// Home route - serves the desktop welcome page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Game route - serves the desktop game page
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/game.html'));
});

// Controller route - serves the mobile controller page
app.get('/controller', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/controller.html'));
});

// API endpoint to generate QR code
app.post('/api/generate-qr', async (req, res) => {
    try {
        const { roomCode, url } = req.body;
        
        if (!roomCode || !url) {
            return res.status(400).json({ error: 'Missing roomCode or url' });
        }

        // Generate QR code as data URL
        const qrCodeDataURL = await QRCode.toDataURL(url, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        res.json({ 
            success: true, 
            qrCode: qrCodeDataURL,
            roomCode: roomCode 
        });
    } catch (error) {
        console.error('QR Code generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// API endpoint to get room info (optional, for debugging)
app.get('/api/room/:roomCode', (req, res) => {
    const room = roomManager.getRoom(req.params.roomCode);
    
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json({ success: true, room: room.getState() });
});

// API endpoint to get all rooms (optional, for debugging)
app.get('/api/rooms', (req, res) => {
    const rooms = roomManager.getAllRooms().map(room => ({
        roomCode: room.roomCode,
        playerCount: room.players.length,
        gameStarted: room.gameStarted,
        createdAt: room.createdAt
    }));
    
    res.json({ success: true, rooms: rooms, count: rooms.size });
});

// ============================================
// SOCKET.IO CONNECTION HANDLING
// ============================================

io.on('connection', (socket) => {
    console.log(`[CONNECTION] New socket connected: ${socket.id}`);

    // ==========================================
    // DESKTOP (GAME HOST) EVENTS
    // ==========================================

    // Desktop creates a new game room
    socket.on('createRoom', (callback) => {
        try {
            const room = roomManager.createRoom(socket.id);
            socket.join(room.roomCode);
            
            console.log(`[CREATE ROOM] Desktop ${socket.id} created room ${room.roomCode}`);
            
            // Send room details back to desktop
            if (callback) {
                callback({
                    success: true,
                    roomCode: room.roomCode,
                    roomId: room.id,
                    controllerUrl: `${getServerURL()}/controller?room=${room.roomCode}`
                });
            }
        } catch (error) {
            console.error('[CREATE ROOM ERROR]', error);
            if (callback) {
                callback({ success: false, error: error.message });
            }
        }
    });

    // Desktop requests current room state
    socket.on('getRoomState', (roomCode, callback) => {
        try {
            const room = roomManager.getRoom(roomCode);
            
            if (!room) {
                if (callback) callback({ success: false, error: 'Room not found' });
                return;
            }

            if (callback) {
                callback({
                    success: true,
                    room: room.getState()
                });
            }
        } catch (error) {
            console.error('[GET ROOM STATE ERROR]', error);
            if (callback) callback({ success: false, error: error.message });
        }
    });

    // Desktop starts the game
    socket.on('startGame', (roomCode) => {
        try {
            const room = roomManager.getRoom(roomCode);
            
            if (!room) {
                console.error('[START GAME] Room not found:', roomCode);
                return;
            }

            room.gameStarted = true;
            
            // Notify all players in the room that game is starting
            io.to(roomCode).emit('gameStarting', {
                countdown: 3,
                timestamp: Date.now()
            });

            console.log(`[START GAME] Room ${roomCode} game started`);
        } catch (error) {
            console.error('[START GAME ERROR]', error);
        }
    });

    // ==========================================
    // MOBILE CONTROLLER EVENTS
    // ==========================================

    // Mobile controller joins a room
    socket.on('joinRoom', (data, callback) => {
        try {
            const { roomCode, playerName } = data;
            
            if (!roomCode) {
                if (callback) callback({ success: false, error: 'Room code required' });
                return;
            }

            const room = roomManager.getRoom(roomCode);
            
            if (!room) {
                if (callback) callback({ success: false, error: 'Room not found' });
                return;
            }

            if (room.players.length >= 4) {
                if (callback) callback({ success: false, error: 'Room is full (max 4 players)' });
                return;
            }

            // Add player to room
            const player = room.addPlayer(socket.id, playerName || `Player ${room.players.length + 1}`);
            socket.join(roomCode);
            
            console.log(`[JOIN ROOM] ${playerName} (${socket.id}) joined room ${roomCode} as Player ${player.playerNumber}`);

            // Notify the joining player
            if (callback) {
                callback({
                    success: true,
                    playerNumber: player.playerNumber,
                    isHost: player.isHost,
                    roomCode: roomCode
                });
            }

            // Notify all clients in the room about the new player
            io.to(roomCode).emit('playerJoined', {
                player: player,
                totalPlayers: room.players.length,
                players: room.players
            });

        } catch (error) {
            console.error('[JOIN ROOM ERROR]', error);
            if (callback) callback({ success: false, error: error.message });
        }
    });

    // Mobile controller sends input (basic version)
    socket.on('controllerInput', (data) => {
        try {
            const { roomCode, input } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player) return;

            // Update player's input state
            player.input = input;

            // Broadcast input to desktop (game host) only
            socket.to(room.hostSocketId).emit('playerInput', {
                playerNumber: player.playerNumber,
                input: input,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[CONTROLLER INPUT ERROR]', error);
        }
    });

    // Enhanced controller input with sequence numbers (Step 5)
    socket.on('controllerInputSequenced', (data) => {
        try {
            const { roomCode, input, sequence } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player) return;

            // Validate input
            const validation = validateInput(input);
            if (!validation.valid) {
                console.warn(`[INPUT VALIDATION] Invalid input from Player ${player.playerNumber}:`, validation.errors);
                return;
            }

            // Update player's input state with validated input
            player.input = validation.sanitized;
            player.lastInputSequence = sequence || 0;
            player.lastInputTime = Date.now();

            // Broadcast to desktop with sequence number for reconciliation
            socket.to(room.hostSocketId).emit('playerInputSequenced', {
                playerNumber: player.playerNumber,
                input: validation.sanitized,
                sequence: sequence || 0,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[CONTROLLER INPUT SEQUENCED ERROR]', error);
        }
    });

    // Player selects a car
    socket.on('selectCar', (data) => {
        try {
            const { roomCode, carId } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player) return;

            player.selectedCar = carId;
            player.carSelected = true;

            console.log(`[CAR SELECTION] Player ${player.playerNumber} selected car ${carId}`);

            // Notify all clients in the room
            io.to(roomCode).emit('carSelected', {
                playerNumber: player.playerNumber,
                carId: carId,
                players: room.players
            });

        } catch (error) {
            console.error('[SELECT CAR ERROR]', error);
        }
    });

    // Player selects map (only host/Player 1)
    socket.on('selectMap', (data) => {
        try {
            const { roomCode, mapId } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player || !player.isHost) {
                console.log('[SELECT MAP] Only host can select map');
                return;
            }

            room.selectedMap = mapId;

            console.log(`[MAP SELECTION] Host selected map ${mapId}`);

            // Notify all clients in the room
            io.to(roomCode).emit('mapSelected', {
                mapId: mapId
            });

        } catch (error) {
            console.error('[SELECT MAP ERROR]', error);
        }
    });

    // Player selects game mode (only host/Player 1)
    socket.on('selectGameMode', (data) => {
        try {
            const { roomCode, gameMode } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player || !player.isHost) {
                console.log('[SELECT GAME MODE] Only host can select game mode');
                return;
            }

            room.gameMode = gameMode;

            console.log(`[GAME MODE SELECTION] Host selected mode ${gameMode}`);

            // Notify all clients in the room
            io.to(roomCode).emit('gameModeSelected', {
                gameMode: gameMode
            });

        } catch (error) {
            console.error('[SELECT GAME MODE ERROR]', error);
        }
    });

    // ==========================================
    // LATENCY MONITORING (Step 5)
    // ==========================================

    // Ping/pong for latency measurement
    socket.on('ping', (data, callback) => {
        // Simply echo back immediately
        if (callback) {
            callback({
                clientTime: data.clientTime,
                serverTime: Date.now()
            });
        }
    });

    // ==========================================
    // GAME STATE SYNCHRONIZATION (Step 5)
    // ==========================================

    // Desktop sends game state updates to all players
    socket.on('gameStateUpdate', (data) => {
        try {
            const { roomCode, state } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            // Only host can send game state updates
            if (socket.id !== room.hostSocketId) {
                console.warn('[GAME STATE] Non-host attempted to send game state');
                return;
            }

            // Broadcast to all players in room
            io.to(roomCode).emit('gameState', {
                state: state,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[GAME STATE UPDATE ERROR]', error);
        }
    });

    // Player acknowledges receiving game state
    socket.on('stateAcknowledged', (data) => {
        try {
            const { roomCode, lastSequence } = data;
            
            const room = roomManager.getRoom(roomCode);
            if (!room) return;

            const player = room.getPlayerBySocketId(socket.id);
            if (!player) return;

            player.lastAcknowledgedState = lastSequence;

        } catch (error) {
            console.error('[STATE ACKNOWLEDGED ERROR]', error);
        }
    });

    // ==========================================
    // DISCONNECTION HANDLING
    // ==========================================

    socket.on('disconnect', () => {
        console.log(`[DISCONNECT] Socket disconnected: ${socket.id}`);
        
        try {
            // Find which room this socket was in
            const room = roomManager.findRoomBySocketId(socket.id);
            
            if (room) {
                // Check if disconnected socket was the host
                if (room.hostSocketId === socket.id) {
                    console.log(`[DISCONNECT] Host left room ${room.roomCode}, closing room`);
                    
                    // Notify all players that room is closing
                    io.to(room.roomCode).emit('roomClosed', {
                        reason: 'Host disconnected'
                    });
                    
                    // Delete the room
                    roomManager.deleteRoom(room.roomCode);
                } else {
                    // Regular player disconnected
                    const player = room.removePlayer(socket.id);
                    
                    if (player) {
                        console.log(`[DISCONNECT] Player ${player.playerNumber} left room ${room.roomCode}`);
                        
                        // Notify remaining players
                        io.to(room.roomCode).emit('playerLeft', {
                            playerNumber: player.playerNumber,
                            totalPlayers: room.players.length,
                            players: room.players
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[DISCONNECT ERROR]', error);
        }
    });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getServerURL() {
    const port = process.env.PORT || 3000;
    // In production, replace with your actual domain
    // For local network testing, use your local IP (e.g., 'http://192.168.1.100:3000')
    return process.env.SERVER_URL || `http://localhost:${port}`;
}

/**
 * Validate controller input
 * Prevents cheating and ensures data integrity
 */
function validateInput(input) {
    const errors = [];
    
    // Validate steering
    if (typeof input.steering !== 'number') {
        errors.push('Steering must be a number');
    } else if (input.steering < -1 || input.steering > 1) {
        errors.push('Steering out of range');
    } else if (isNaN(input.steering)) {
        errors.push('Steering is NaN');
    }
    
    // Validate brake
    if (typeof input.brake !== 'boolean') {
        errors.push('Brake must be a boolean');
    }
    
    // Validate timestamp
    if (typeof input.timestamp !== 'number') {
        errors.push('Timestamp must be a number');
    } else if (input.timestamp < 0) {
        errors.push('Timestamp cannot be negative');
    }
    
    // Sanitize input (clamp values to valid ranges)
    const sanitized = {
        steering: Math.max(-1, Math.min(1, Number(input.steering) || 0)),
        brake: Boolean(input.brake),
        timestamp: Number(input.timestamp) || Date.now()
    };
    
    return {
        valid: errors.length === 0,
        errors: errors,
        sanitized: sanitized
    };
}

// ============================================
// PERIODIC CLEANUP
// ============================================

// Clean up inactive rooms every 30 minutes
setInterval(() => {
    roomManager.cleanupInactiveRooms(60); // Remove rooms older than 60 minutes with no players
}, 30 * 60 * 1000);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('=====================================');
    console.log(`🎮 Beach Buggy Racing Server Running`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🌐 Desktop: http://localhost:${PORT}`);
    console.log(`📱 Controller: http://localhost:${PORT}/controller`);
    console.log('=====================================');
    console.log('');
    console.log('For mobile testing on local network:');
    console.log('1. Find your local IP address');
    console.log('2. Use http://YOUR_IP:' + PORT + '/controller');
    console.log('=====================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
