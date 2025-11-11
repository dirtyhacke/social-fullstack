// utils/audioCompressor.js
import { encode } from 'node-wav';

/**
 * Simple audio compression by converting to WAV format
 * @param {Buffer} audioBuffer - Original audio buffer
 * @param {object} options - Compression options
 * @returns {Promise<Buffer>} - Compressed audio buffer
 */
export const compressAudio = async (audioBuffer, options = {}) => {
    try {
        const {
            sampleRate = 16000,
            channels = 1,
            bitDepth = 16
        } = options;

        console.log('🎵 Starting audio compression...');
        
        // For now, we'll use the original buffer
        // In a real implementation, you'd use a proper audio processing library
        console.log(`📊 Original audio size: ${audioBuffer.length} bytes`);
        
        // Return the original buffer (placeholder for actual compression)
        // You can replace this with proper audio compression logic
        return audioBuffer;
        
    } catch (error) {
        console.error('❌ Audio processing failed:', error);
        throw new Error(`Audio processing failed: ${error.message}`);
    }
};

/**
 * Convert audio buffer to base64 for storage
 * @param {Buffer} audioBuffer - Audio buffer
 * @returns {string} - Base64 encoded string
 */
export const bufferToBase64 = (audioBuffer) => {
    return audioBuffer.toString('base64');
};

/**
 * Convert base64 back to buffer
 * @param {string} base64String - Base64 encoded audio
 * @returns {Buffer} - Audio buffer
 */
export const base64ToBuffer = (base64String) => {
    return Buffer.from(base64String, 'base64');
};

/**
 * Estimate audio duration
 * @param {Buffer} audioBuffer - Audio buffer
 * @param {string} mimeType - Audio MIME type
 * @returns {number} - Duration in seconds
 */
export const estimateDuration = (audioBuffer, mimeType = 'audio/webm') => {
    // Simple estimation based on file size
    // This is a rough estimate - you might want to use a proper audio library
    const bytesPerSecond = mimeType.includes('webm') ? 16000 : 32000;
    const duration = Math.min(audioBuffer.length / bytesPerSecond, 300); // Max 5 minutes
    return Math.round(duration);
};