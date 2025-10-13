// server/roomManager.js
const GameState = require('./gameState');

class RoomManager {
    constructor() {
        this.rooms = new Map(); // Map of roomCode -> Room object
    }

    /**
     * Generate a unique 6-digit room code
     */
    generateRoomCode() {
        let code;
        let attempts = 0;
        const maxAttempts = 100;

        do {
            // Generate 6-digit number (100000 to 999999)
            code = Math.floor(100000 + Math.random() * 900000).toString();
            attempts++;
            
            if (attempts > maxAttempts) {
                throw new Error('Failed to generate unique room code');
            }
        } while (this.rooms.has(code));

        return code;
    }

    /**
     * Create a new game room
     */
    createRoom(hostSocketId) {
        const roomCode = this.generateRoomCode();
        const room = new Room(roomCode, hostSocketId);
        
        this.rooms.set(roomCode, room);
        
        console.log(`[ROOM MANAGER] Created room ${roomCode}, total rooms: ${this.rooms.size}`);
        
        return room;
    }

    /**
     * Get a room by its code
     */
    getRoom(roomCode) {
        return this.rooms.get(roomCode);
    }

    /**
     * Delete a room
     */
    deleteRoom(roomCode) {
        const deleted = this.rooms.delete(roomCode);
        
        if (deleted) {
            console.log(`[ROOM MANAGER] Deleted room ${roomCode}, remaining rooms: ${this.rooms.size}`);
        }
        
        return deleted;
    }

    /**
     * Find room by socket ID (useful for disconnect handling)
     */
    findRoomBySocketId(socketId) {
        for (let [roomCode, room] of this.rooms) {
            if (room.hostSocketId === socketId || room.hasPlayer(socketId)) {
                return room;
            }
        }
        return null;
    }

    /**
     * Get all active rooms (for admin/debugging)
     */
    getAllRooms() {
        return Array.from(this.rooms.values());
    }

    /**
     * Clean up inactive rooms (optional, for production)
     */
    cleanupInactiveRooms(maxAgeMinutes = 60) {
        const now = Date.now();
        const maxAge = maxAgeMinutes * 60 * 1000;
        
        let cleanedCount = 0;
        
        for (let [roomCode, room] of this.rooms) {
            if (now - room.createdAt > maxAge && room.players.length === 0) {
                this.deleteRoom(roomCode);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[ROOM MANAGER] Cleaned up ${cleanedCount} inactive rooms`);
        }
        
        return cleanedCount;
    }
}

/**
 * Room class - represents a single game room
 */
class Room {
    constructor(roomCode, hostSocketId) {
        this.id = this.generateId();
        this.roomCode = roomCode;
        this.hostSocketId = hostSocketId;
        this.players = []; // Array of Player objects
        this.selectedMap = null;
        this.gameMode = 'race'; // Default game mode
        this.gameStarted = false;
        this.gameState = new GameState();
        this.createdAt = Date.now();
    }

    generateId() {
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Add a player to the room
     */
    addPlayer(socketId, playerName) {
        // Check if player already exists
        const existingPlayer = this.players.find(p => p.socketId === socketId);
        if (existingPlayer) {
            return existingPlayer;
        }

        const playerNumber = this.players.length + 1;
        const isHost = playerNumber === 1; // First player is the host

        const player = new Player(socketId, playerName, playerNumber, isHost);
        this.players.push(player);

        return player;
    }

    /**
     * Remove a player from the room
     */
    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.socketId === socketId);
        
        if (index !== -1) {
            const [removedPlayer] = this.players.splice(index, 1);
            
            // Reassign player numbers
            this.players.forEach((player, idx) => {
                player.playerNumber = idx + 1;
                // First player becomes new host if old host left
                player.isHost = (idx === 0);
            });
            
            return removedPlayer;
        }
        
        return null;
    }

    /**
     * Get player by socket ID
     */
    getPlayerBySocketId(socketId) {
        return this.players.find(p => p.socketId === socketId);
    }

    /**
     * Check if room has a specific player
     */
    hasPlayer(socketId) {
        return this.players.some(p => p.socketId === socketId);
    }

    /**
     * Get current room state (for syncing)
     */
    getState() {
        return {
            roomCode: this.roomCode,
            hostSocketId: this.hostSocketId,
            players: this.players.map(p => p.getState()),
            selectedMap: this.selectedMap,
            gameMode: this.gameMode,
            gameStarted: this.gameStarted,
            createdAt: this.createdAt
        };
    }

    /**
     * Check if all players have selected their cars
     */
    allCarsSelected() {
        return this.players.length > 0 && this.players.every(p => p.carSelected);
    }
}

/**
 * Player class - represents a single player
 */
class Player {
    constructor(socketId, playerName, playerNumber, isHost = false) {
        this.socketId = socketId;
        this.playerName = playerName;
        this.playerNumber = playerNumber;
        this.isHost = isHost;
        this.selectedCar = null;
        this.carSelected = false;
        this.input = {
            steering: 0,    // -1 (left) to 1 (right)
            brake: false,   // true when brake/drift button pressed
            timestamp: Date.now()
        };
        this.position = { x: 0, y: 0, z: 0 };
        this.rotation = { x: 0, y: 0, z: 0 };
        this.velocity = { x: 0, y: 0, z: 0 };
        this.ready = false;
        this.connectedAt = Date.now();
    }

    /**
     * Get player state (for syncing)
     */
    getState() {
        return {
            socketId: this.socketId,
            playerName: this.playerName,
            playerNumber: this.playerNumber,
            isHost: this.isHost,
            selectedCar: this.selectedCar,
            carSelected: this.carSelected,
            ready: this.ready,
            position: this.position,
            rotation: this.rotation,
            velocity: this.velocity
        };
    }
}

module.exports = RoomManager;
