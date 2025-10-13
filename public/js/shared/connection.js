// public/js/shared/connection.js

// Socket.IO connection helper utilities
const ConnectionHelper = {
    /**
     * Initialize Socket.IO connection with options
     */
    initializeSocket: (options = {}) => {
        const defaultOptions = {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000
        };
        
        return io({ ...defaultOptions, ...options });
    },
    
    /**
     * Setup common connection event handlers
     */
    setupConnectionHandlers: (socket, callbacks = {}) => {
        socket.on('connect', () => {
            console.log('[Socket] Connected:', socket.id);
            if (callbacks.onConnect) callbacks.onConnect();
        });
        
        socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            if (callbacks.onDisconnect) callbacks.onDisconnect(reason);
        });
        
        socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
            if (callbacks.onError) callbacks.onError(error);
        });
        
        socket.on('reconnect', (attemptNumber) => {
            console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
            if (callbacks.onReconnect) callbacks.onReconnect(attemptNumber);
        });
        
        socket.on('reconnect_failed', () => {
            console.error('[Socket] Reconnection failed');
            if (callbacks.onReconnectFailed) callbacks.onReconnectFailed();
        });
    },
    
    /**
     * Emit event with error handling
     */
    emitWithCallback: (socket, event, data, callback) => {
        return new Promise((resolve, reject) => {
            socket.emit(event, data, (response) => {
                if (response && response.success) {
                    resolve(response);
                    if (callback) callback(null, response);
                } else {
                    const error = response?.error || 'Unknown error';
                    reject(error);
                    if (callback) callback(error, null);
                }
            });
        });
    }
};
