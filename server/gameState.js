// server/gameState.js

class GameState {
    constructor() {
        this.players = [];
        this.powerUps = [];
        this.checkpoints = [];
        this.raceStartTime = null;
        this.raceEndTime = null;
        this.currentLap = 1;
        this.maxLaps = 3;
        this.tick = 0;
        this.lastUpdateTime = Date.now();
    }

    /**
     * Initialize game state for a new race
     */
    initialize(playerCount, mapData) {
        this.players = [];
        
        for (let i = 0; i < playerCount; i++) {
            this.players.push({
                playerNumber: i + 1,
                position: { x: 0, y: 0, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                currentLap: 1,
                checkpointsPassed: [],
                racePosition: i + 1,
                finished: false,
                finishTime: null
            });
        }

        this.raceStartTime = Date.now();
        this.tick = 0;
        
        console.log(`[GAME STATE] Initialized for ${playerCount} players`);
    }

    /**
     * Update game state (called on server tick)
     */
    update(deltaTime) {
        this.tick++;
        this.lastUpdateTime = Date.now();

        // Update race positions based on progress
        this.updateRacePositions();

        // Check for race completion
        this.checkRaceCompletion();
    }

    /**
     * Update player race positions
     */
    updateRacePositions() {
        // Sort players by lap and checkpoints passed
        const sortedPlayers = [...this.players].sort((a, b) => {
            if (a.currentLap !== b.currentLap) {
                return b.currentLap - a.currentLap;
            }
            return b.checkpointsPassed.length - a.checkpointsPassed.length;
        });

        // Assign positions
        sortedPlayers.forEach((player, index) => {
            player.racePosition = index + 1;
        });
    }

    /**
     * Check if race is complete
     */
    checkRaceCompletion() {
        const allFinished = this.players.every(p => p.finished);
        
        if (allFinished && !this.raceEndTime) {
            this.raceEndTime = Date.now();
            console.log('[GAME STATE] Race completed');
        }
    }

    /**
     * Update player position from client
     */
    updatePlayerPosition(playerNumber, position, rotation, velocity) {
        const player = this.players.find(p => p.playerNumber === playerNumber);
        
        if (player) {
            player.position = position;
            player.rotation = rotation;
            player.velocity = velocity;
        }
    }

    /**
     * Player passed a checkpoint
     */
    passCheckpoint(playerNumber, checkpointId) {
        const player = this.players.find(p => p.playerNumber === playerNumber);
        
        if (player && !player.checkpointsPassed.includes(checkpointId)) {
            player.checkpointsPassed.push(checkpointId);
            
            // Check if lap is complete (all checkpoints passed)
            if (this.isLapComplete(player)) {
                player.currentLap++;
                player.checkpointsPassed = [];
                
                console.log(`[GAME STATE] Player ${playerNumber} completed lap ${player.currentLap - 1}`);
                
                // Check if player finished race
                if (player.currentLap > this.maxLaps) {
                    player.finished = true;
                    player.finishTime = Date.now() - this.raceStartTime;
                    
                    console.log(`[GAME STATE] Player ${playerNumber} finished race in ${player.finishTime}ms`);
                }
            }
        }
    }

    /**
     * Check if player has passed all checkpoints for current lap
     */
    isLapComplete(player) {
        // This will be implemented based on your track design
        // For now, assume 5 checkpoints per lap
        return player.checkpointsPassed.length >= 5;
    }

    /**
     * Get current game state snapshot
     */
    getSnapshot() {
        return {
            tick: this.tick,
            players: this.players,
            powerUps: this.powerUps,
            raceStartTime: this.raceStartTime,
            raceEndTime: this.raceEndTime,
            currentLap: this.currentLap,
            maxLaps: this.maxLaps,
            timestamp: this.lastUpdateTime
        };
    }
}

module.exports = GameState;
