// public/js/shared/inputBuffer.js

/**
 * Input Buffer for Client-Side Prediction
 * Stores player inputs with sequence numbers for server reconciliation
 */
class InputBuffer {
    constructor(bufferSize = 60) {
        this.inputs = [];
        this.bufferSize = bufferSize; // Keep last 60 inputs (1 second at 60Hz)
        this.sequenceNumber = 0;
        this.lastAcknowledgedSequence = 0;
    }

    /**
     * Add input to buffer with sequence number
     */
    addInput(input) {
        this.sequenceNumber++;
        
        const bufferedInput = {
            sequence: this.sequenceNumber,
            input: { ...input },
            timestamp: Date.now()
        };

        this.inputs.push(bufferedInput);

        // Maintain buffer size
        if (this.inputs.length > this.bufferSize) {
            this.inputs.shift();
        }

        return bufferedInput;
    }

    /**
     * Get input by sequence number
     */
    getInput(sequence) {
        return this.inputs.find(input => input.sequence === sequence);
    }

    /**
     * Get all inputs after a specific sequence number
     */
    getInputsSince(sequence) {
        return this.inputs.filter(input => input.sequence > sequence);
    }

    /**
     * Acknowledge inputs up to a sequence number (server processed)
     */
    acknowledge(sequence) {
        this.lastAcknowledgedSequence = sequence;
        
        // Remove acknowledged inputs from buffer
        this.inputs = this.inputs.filter(input => input.sequence > sequence);
    }

    /**
     * Get unacknowledged inputs (not yet processed by server)
     */
    getUnacknowledgedInputs() {
        return this.inputs.filter(input => input.sequence > this.lastAcknowledgedSequence);
    }

    /**
     * Clear buffer
     */
    clear() {
        this.inputs = [];
        this.sequenceNumber = 0;
        this.lastAcknowledgedSequence = 0;
    }

    /**
     * Get current sequence number
     */
    getCurrentSequence() {
        return this.sequenceNumber;
    }

    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            bufferSize: this.inputs.length,
            currentSequence: this.sequenceNumber,
            lastAcknowledged: this.lastAcknowledgedSequence,
            unacknowledged: this.getUnacknowledgedInputs().length
        };
    }
}

/**
 * Input Validator
 * Validates input values to prevent cheating
 */
class InputValidator {
    constructor() {
        // Define valid input ranges
        this.constraints = {
            steering: { min: -1, max: 1 },
            brake: [true, false],
            timestampDelta: { min: 0, max: 1000 } // Max 1 second between inputs
        };
        
        this.lastTimestamp = Date.now();
    }

    /**
     * Validate input object
     */
    validate(input) {
        const errors = [];

        // Validate steering
        if (typeof input.steering !== 'number') {
            errors.push('Steering must be a number');
        } else if (input.steering < this.constraints.steering.min || 
                   input.steering > this.constraints.steering.max) {
            errors.push(`Steering must be between ${this.constraints.steering.min} and ${this.constraints.steering.max}`);
        }

        // Validate brake
        if (typeof input.brake !== 'boolean') {
            errors.push('Brake must be a boolean');
        }

        // Validate timestamp
        if (typeof input.timestamp !== 'number') {
            errors.push('Timestamp must be a number');
        } else {
            const delta = input.timestamp - this.lastTimestamp;
            
            if (delta < this.constraints.timestampDelta.min) {
                errors.push('Timestamp cannot be in the past');
            }
            
            if (delta > this.constraints.timestampDelta.max) {
                errors.push('Timestamp delta too large (possible timeout)');
            }
        }

        // Update last timestamp if valid
        if (errors.length === 0) {
            this.lastTimestamp = input.timestamp;
        }

        return {
            valid: errors.length === 0,
            errors: errors,
            sanitized: this.sanitize(input)
        };
    }

    /**
     * Sanitize input (clamp values to valid ranges)
     */
    sanitize(input) {
        return {
            steering: this.clamp(
                input.steering || 0,
                this.constraints.steering.min,
                this.constraints.steering.max
            ),
            brake: Boolean(input.brake),
            timestamp: input.timestamp || Date.now()
        };
    }

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputBuffer, InputValidator };
}
