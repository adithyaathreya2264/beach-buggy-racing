// public/js/shared/constants.js

// Game constants shared between client and server
const GAME_CONSTANTS = {
    MAX_PLAYERS: 4,
    MIN_PLAYERS: 1,
    
    // Game modes
    GAME_MODES: {
        RACE: 'race',
        TIME_TRIAL: 'timeTrial',
        ELIMINATION: 'elimination',
        BATTLE: 'battle'
    },
    
    // Maps
    MAPS: {
        BEACH: 'beach',
        DESERT: 'desert',
        JUNGLE: 'jungle',
        ARCTIC: 'arctic',
        CITY: 'city'
    },
    
    // Network settings
    NETWORK: {
        UPDATE_RATE: 60, // Server updates per second
        TICK_RATE: 1000 / 60 // Milliseconds per tick
    },
    
    // Physics settings
    PHYSICS: {
        GRAVITY: -9.8,
        MAX_SPEED: 100,
        ACCELERATION: 20,
        BRAKE_FORCE: 30,
        STEERING_SPEED: 2
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GAME_CONSTANTS;
}
