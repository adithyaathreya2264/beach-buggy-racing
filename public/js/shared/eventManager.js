// public/js/shared/eventManager.js

/**
 * Centralized Event Manager for Socket.IO
 * Manages all game events, logging, and callbacks
 */
class EventManager {
    constructor() {
        this.events = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
        this.debugMode = true; // Set to false in production
    }

    /**
     * Register an event handler
     */
    on(socket, eventName, handler, context = null) {
        if (!socket || !eventName || !handler) {
            console.error('[EventManager] Invalid parameters for event registration');
            return;
        }

        const wrappedHandler = (...args) => {
            this.logEvent('receive', eventName, args);
            
            try {
                if (context) {
                    handler.apply(context, args);
                } else {
                    handler(...args);
                }
            } catch (error) {
                console.error(`[EventManager] Error in handler for ${eventName}:`, error);
            }
        };

        socket.on(eventName, wrappedHandler);

        // Store reference for cleanup
        if (!this.events.has(socket.id)) {
            this.events.set(socket.id, new Map());
        }
        this.events.get(socket.id).set(eventName, wrappedHandler);

        if (this.debugMode) {
            console.log(`[EventManager] Registered handler for: ${eventName}`);
        }
    }

    /**
     * Emit an event with logging
     */
    emit(socket, eventName, data, callback = null) {
        if (!socket || !eventName) {
            console.error('[EventManager] Invalid parameters for event emission');
            return;
        }

        this.logEvent('send', eventName, data);

        if (callback) {
            socket.emit(eventName, data, (...args) => {
                this.logEvent('callback', eventName, args);
                callback(...args);
            });
        } else {
            socket.emit(eventName, data);
        }
    }

    /**
     * Log event for debugging
     */
    logEvent(type, eventName, data) {
        const logEntry = {
            type: type,           // 'send', 'receive', 'callback'
            event: eventName,
            data: data,
            timestamp: Date.now(),
            time: new Date().toISOString()
        };

        this.eventHistory.push(logEntry);

        // Keep history size manageable
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory.shift();
        }

        if (this.debugMode) {
            const icon = type === 'send' ? '📤' : type === 'receive' ? '📥' : '🔄';
            console.log(`${icon} [${type.toUpperCase()}] ${eventName}`, data);
        }
    }

    /**
     * Get event history (useful for debugging)
     */
    getHistory(eventName = null, limit = 20) {
        let history = [...this.eventHistory];
        
        if (eventName) {
            history = history.filter(entry => entry.event === eventName);
        }
        
        return history.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
    }

    /**
     * Remove all event listeners for a socket
     */
    cleanup(socket) {
        if (this.events.has(socket.id)) {
            const socketEvents = this.events.get(socket.id);
            
            socketEvents.forEach((handler, eventName) => {
                socket.off(eventName, handler);
            });
            
            this.events.delete(socket.id);
            
            if (this.debugMode) {
                console.log(`[EventManager] Cleaned up events for socket: ${socket.id}`);
            }
        }
    }

    /**
     * Toggle debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
}

// Create singleton instance
const eventManager = new EventManager();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventManager;
}
