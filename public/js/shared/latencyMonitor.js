// public/js/shared/latencyMonitor.js

/**
 * Latency Monitor
 * Tracks network latency and provides statistics
 */
class LatencyMonitor {
    constructor() {
        this.pings = [];
        this.maxSamples = 30; // Keep last 30 ping samples
        this.currentLatency = 0;
        this.averageLatency = 0;
        this.jitter = 0; // Variance in latency
        this.lastPingTime = 0;
        this.pingInterval = null;
        this.updateCallbacks = [];
    }

    /**
     * Start monitoring latency
     */
    start(socket, intervalMs = 2000) {
        if (!socket) {
            console.error('[LatencyMonitor] Socket not provided');
            return;
        }

        // Stop existing interval if any
        this.stop();

        // Send ping every intervalMs
        this.pingInterval = setInterval(() => {
            this.ping(socket);
        }, intervalMs);

        // Initial ping
        this.ping(socket);

        console.log('[LatencyMonitor] Started monitoring');
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
            console.log('[LatencyMonitor] Stopped monitoring');
        }
    }

    /**
     * Send ping to server
     */
    ping(socket) {
        const startTime = Date.now();
        this.lastPingTime = startTime;

        socket.emit('ping', { clientTime: startTime }, (response) => {
            const endTime = Date.now();
            const roundTripTime = endTime - startTime;

            this.recordPing(roundTripTime);
        });
    }

    /**
     * Record ping result
     */
    recordPing(latency) {
        this.currentLatency = latency;
        this.pings.push(latency);

        // Maintain sample size
        if (this.pings.length > this.maxSamples) {
            this.pings.shift();
        }

        // Calculate statistics
        this.calculateStats();

        // Notify callbacks
        this.notifyUpdate();

        console.log(`[LatencyMonitor] Ping: ${latency}ms, Avg: ${this.averageLatency}ms, Jitter: ${this.jitter}ms`);
    }

    /**
     * Calculate latency statistics
     */
    calculateStats() {
        if (this.pings.length === 0) return;

        // Average latency
        const sum = this.pings.reduce((a, b) => a + b, 0);
        this.averageLatency = Math.round(sum / this.pings.length);

        // Jitter (standard deviation)
        const variance = this.pings.reduce((sum, ping) => {
            return sum + Math.pow(ping - this.averageLatency, 2);
        }, 0) / this.pings.length;
        
        this.jitter = Math.round(Math.sqrt(variance));
    }

    /**
     * Get current latency
     */
    getLatency() {
        return this.currentLatency;
    }

    /**
     * Get average latency
     */
    getAverageLatency() {
        return this.averageLatency;
    }

    /**
     * Get jitter
     */
    getJitter() {
        return this.jitter;
    }

    /**
     * Get connection quality rating
     */
    getQuality() {
        if (this.averageLatency < 50) {
            return { rating: 'excellent', color: '#4caf50', label: 'Excellent' };
        } else if (this.averageLatency < 100) {
            return { rating: 'good', color: '#8bc34a', label: 'Good' };
        } else if (this.averageLatency < 150) {
            return { rating: 'fair', color: '#ff9800', label: 'Fair' };
        } else if (this.averageLatency < 250) {
            return { rating: 'poor', color: '#ff5722', label: 'Poor' };
        } else {
            return { rating: 'bad', color: '#f44336', label: 'Bad' };
        }
    }

    /**
     * Get all statistics
     */
    getStats() {
        const quality = this.getQuality();
        
        return {
            current: this.currentLatency,
            average: this.averageLatency,
            jitter: this.jitter,
            samples: this.pings.length,
            quality: quality
        };
    }

    /**
     * Register callback for latency updates
     */
    onUpdate(callback) {
        if (typeof callback === 'function') {
            this.updateCallbacks.push(callback);
        }
    }

    /**
     * Notify all registered callbacks
     */
    notifyUpdate() {
        const stats = this.getStats();
        this.updateCallbacks.forEach(callback => {
            try {
                callback(stats);
            } catch (error) {
                console.error('[LatencyMonitor] Error in callback:', error);
            }
        });
    }

    /**
     * Reset statistics
     */
    reset() {
        this.pings = [];
        this.currentLatency = 0;
        this.averageLatency = 0;
        this.jitter = 0;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LatencyMonitor;
}

// Add to server/server.js after existing socket.on handlers

    // ==========================================
    // LATENCY MONITORING
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
    // ENHANCED INPUT HANDLING WITH VALIDATION
    // ==========================================

    // Enhanced controller input with sequence numbers
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
                console.warn('[INPUT VALIDATION] Invalid input from', socket.id, validation.errors);
                return;
            }

            // Update player's input state with validated input
            player.input = validation.sanitized;
            player.lastInputSequence = sequence;
            player.lastInputTime = Date.now();

            // Broadcast to desktop with sequence number for reconciliation
            socket.to(room.hostSocketId).emit('playerInputSequenced', {
                playerNumber: player.playerNumber,
                input: validation.sanitized,
                sequence: sequence,
                timestamp: Date.now()
            });

        } catch (error) {
            console.error('[CONTROLLER INPUT SEQUENCED ERROR]', error);
        }
    });

    // ==========================================
    // GAME STATE SYNCHRONIZATION
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

// ============================================
// INPUT VALIDATION HELPER
// ============================================

function validateInput(input) {
    const errors = [];
    
    // Validate steering
    if (typeof input.steering !== 'number') {
        errors.push('Steering must be a number');
    } else if (input.steering < -1 || input.steering > 1) {
        errors.push('Steering out of range');
    }
    
    // Validate brake
    if (typeof input.brake !== 'boolean') {
        errors.push('Brake must be a boolean');
    }
    
    // Validate timestamp
    if (typeof input.timestamp !== 'number') {
        errors.push('Timestamp must be a number');
    }
    
    // Sanitize input
    const sanitized = {
        steering: Math.max(-1, Math.min(1, input.steering || 0)),
        brake: Boolean(input.brake),
        timestamp: input.timestamp || Date.now()
    };
    
    return {
        valid: errors.length === 0,
        errors: errors,
        sanitized: sanitized
    };
}
