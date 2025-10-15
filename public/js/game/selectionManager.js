// public/js/game/selectionManager.js

/**
 * Selection Manager
 * Handles car selection, map selection, and game mode selection
 */
class SelectionManager {
    constructor(socket, roomCode) {
        this.socket = socket;
        this.roomCode = roomCode;
        this.selectedMap = null;
        this.selectedGameMode = 'race';
        this.playerSelections = new Map(); // playerNumber -> selectedCar
        this.currentSelectingPlayer = 1;
        this.selectionPhase = 'waiting'; // 'waiting', 'map', 'cars', 'ready'
        
        this.setupEventListeners();
    }

    /**
     * Setup Socket.IO event listeners for selections
     */
    setupEventListeners() {
        // Map selected by host
        this.socket.on('mapSelected', (data) => {
            this.selectedMap = data.mapId;
            this.updateMapDisplay(data.mapId);
            console.log('[Selection] Map selected:', data.mapId);
        });

        // Game mode selected by host
        this.socket.on('gameModeSelected', (data) => {
            this.selectedGameMode = data.gameMode;
            this.updateGameModeDisplay(data.gameMode);
            console.log('[Selection] Game mode selected:', data.gameMode);
        });

        // Car selected by player
        this.socket.on('carSelected', (data) => {
            this.playerSelections.set(data.playerNumber, data.carId);
            this.updateCarSelectionDisplay(data.playerNumber, data.carId);
            
            // Check if all players have selected
            if (this.allPlayersSelected(data.players)) {
                this.selectionPhase = 'ready';
                this.showReadyToStart();
            } else {
                // Move to next player
                this.currentSelectingPlayer = this.getNextSelectingPlayer(data.players);
                this.highlightCurrentPlayer();
            }
            
            console.log('[Selection] Car selected by Player', data.playerNumber, ':', data.carId);
        });
    }

    /**
     * Start selection phase
     */
    startSelection(playerCount) {
        this.selectionPhase = 'cars';
        this.currentSelectingPlayer = 1;
        
        // Show car selection UI
        this.showCarSelectionUI(playerCount);
    }

    /**
     * Show car selection UI
     */
    showCarSelectionUI(playerCount) {
        // Hide lobby UI elements
        document.getElementById('gameControls').style.display = 'none';
        
        // Show car selection screen
        const selectionScreen = document.getElementById('carSelectionScreen');
        if (selectionScreen) {
            selectionScreen.style.display = 'block';
            this.highlightCurrentPlayer();
        }
    }

    /**
     * Check if all connected players have selected cars
     */
    allPlayersSelected(players) {
        return players.every(player => player.carSelected);
    }

    /**
     * Get next player who needs to select
     */
    getNextSelectingPlayer(players) {
        for (let player of players) {
            if (!player.carSelected) {
                return player.playerNumber;
            }
        }
        return null;
    }

    /**
     * Highlight current selecting player
     */
    highlightCurrentPlayer() {
        // Update instruction text
        const instructionEl = document.getElementById('selectionInstruction');
        if (instructionEl) {
            instructionEl.textContent = `Player ${this.currentSelectingPlayer}, select your car!`;
        }

        // Highlight player slot
        document.querySelectorAll('.player-slot').forEach(slot => {
            slot.classList.remove('selecting');
        });

        const currentSlot = document.querySelector(`.player-slot[data-player="${this.currentSelectingPlayer}"]`);
        if (currentSlot) {
            currentSlot.classList.add('selecting');
        }
    }

    /**
     * Update map display
     */
    updateMapDisplay(mapId) {
        const mapNameEl = document.getElementById('selectedMapName');
        const mapImageEl = document.getElementById('selectedMapImage');
        
        const mapData = this.getMapData(mapId);
        
        if (mapNameEl) {
            mapNameEl.textContent = mapData.name;
        }
        
        if (mapImageEl) {
            mapImageEl.src = mapData.image;
            mapImageEl.alt = mapData.name;
        }
    }

    /**
     * Update game mode display
     */
    updateGameModeDisplay(gameMode) {
        const modeNameEl = document.getElementById('selectedGameMode');
        
        const modeData = this.getGameModeData(gameMode);
        
        if (modeNameEl) {
            modeNameEl.textContent = modeData.name;
        }
    }

    /**
     * Update car selection display
     */
    updateCarSelectionDisplay(playerNumber, carId) {
        // Update player slot with car preview
        const playerSlot = document.querySelector(`.player-slot[data-player="${playerNumber}"]`);
        if (playerSlot) {
            const carPreview = playerSlot.querySelector('.car-preview');
            if (carPreview) {
                const carData = this.getCarData(carId);
                carPreview.innerHTML = `
                    <img src="${carData.image}" alt="${carData.name}">
                    <span>${carData.name}</span>
                `;
            }
        }
    }

    /**
     * Show ready to start message
     */
    showReadyToStart() {
        const instructionEl = document.getElementById('selectionInstruction');
        if (instructionEl) {
            instructionEl.textContent = '✅ All players ready! Starting game...';
            instructionEl.style.color = '#4caf50';
        }

        // Enable start button
        const startBtn = document.getElementById('finalStartBtn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = 'Start Race!';
        }
    }

    /**
     * Get map data by ID
     */
    getMapData(mapId) {
        const maps = {
            beach: {
                name: '🏖️ Beach Paradise',
                image: 'assets/maps/beach-preview.jpg',
                description: 'Race along sandy beaches with ocean views'
            },
            desert: {
                name: '🏜️ Desert Storm',
                image: 'assets/maps/desert-preview.jpg',
                description: 'Navigate through scorching sand dunes'
            },
            jungle: {
                name: '🌴 Jungle Rush',
                image: 'assets/maps/jungle-preview.jpg',
                description: 'Speed through dense tropical forests'
            },
            arctic: {
                name: '❄️ Arctic Blast',
                image: 'assets/maps/arctic-preview.jpg',
                description: 'Race on icy tracks and frozen landscapes'
            },
            city: {
                name: '🏙️ City Circuit',
                image: 'assets/maps/city-preview.jpg',
                description: 'Urban racing through busy streets'
            }
        };
        
        return maps[mapId] || maps.beach;
    }

    /**
     * Get game mode data by ID
     */
    getGameModeData(gameMode) {
        const modes = {
            race: {
                name: '🏁 Race',
                description: 'Classic 3-lap race to the finish'
            },
            timeTrial: {
                name: '⏱️ Time Trial',
                description: 'Beat the clock on solo runs'
            },
            elimination: {
                name: '💥 Elimination',
                description: 'Last place eliminated each lap'
            },
            battle: {
                name: '⚔️ Battle Arena',
                description: 'Combat-focused mayhem'
            }
        };
        
        return modes[gameMode] || modes.race;
    }

    /**
     * Get car data by ID
     */
    getCarData(carId) {
        const cars = {
            speedster: {
                name: 'Speedster',
                image: 'assets/cars/speedster.png',
                stats: { speed: 95, handling: 70, acceleration: 80 }
            },
            crusher: {
                name: 'Crusher',
                image: 'assets/cars/crusher.png',
                stats: { speed: 70, handling: 60, acceleration: 85 }
            },
            drifter: {
                name: 'Drifter',
                image: 'assets/cars/drifter.png',
                stats: { speed: 80, handling: 95, acceleration: 75 }
            },
            balanced: {
                name: 'All-Rounder',
                image: 'assets/cars/balanced.png',
                stats: { speed: 80, handling: 80, acceleration: 80 }
            },
            rocket: {
                name: 'Rocket',
                image: 'assets/cars/rocket.png',
                stats: { speed: 100, handling: 65, acceleration: 90 }
            },
            tank: {
                name: 'Tank',
                image: 'assets/cars/tank.png',
                stats: { speed: 65, handling: 70, acceleration: 70 }
            }
        };
        
        return cars[carId] || cars.balanced;
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionManager;
}
