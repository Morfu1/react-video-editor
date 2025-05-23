const path = require('path');
const fs = require('fs-extra');
const https = require('https');
const http = require('http');

/**
 * Downloads audio files and prepares audio mixing for FFmpeg
 * @param {Object} options - Audio processing options
 * @param {Object} options.design - The design composition data containing audio tracks
 * @param {string} options.jobId - Unique job ID
 * @param {string} options.tempDir - Temporary directory for job
 * @param {number} options.fps - Frames per second
 * @param {number} options.totalDuration - Total video duration in milliseconds
 * @returns {Promise<Array>} Array of FFmpeg audio input arguments
 */
async function processAudioTracks(options) {
  const { design, jobId, tempDir, fps, totalDuration } = options;
  
  console.log(`Processing audio tracks for job ${jobId}`);
  
  // Extract audio tracks from design
  const audioTracks = extractAudioTracks(design);
  console.log(`Found ${audioTracks.length} audio tracks`);
  
  if (audioTracks.length === 0) {
    console.log('No audio tracks found, creating silent audio');
    // Return silent audio for compatibility
    return ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
  }
  
  // Download audio files
  const audioDir = path.join(tempDir, 'audio');
  fs.ensureDirSync(audioDir);
  
  const downloadedAudioFiles = [];
  
  for (let i = 0; i < audioTracks.length; i++) {
    const track = audioTracks[i];
    const filename = `audio_${i}_${track.id}.mp3`;
    const localPath = path.join(audioDir, filename);
    
    console.log(`Downloading audio: ${track.src}`);
    await downloadFile(track.src, localPath);
    
    downloadedAudioFiles.push({
      path: localPath,
      track: track
    });
  }
  
  // Generate FFmpeg filter complex for audio mixing
  const { inputArgs, filterComplex } = generateAudioMixing(downloadedAudioFiles, totalDuration, fps);
  
  return { inputArgs, filterComplex };
}

/**
 * Extracts audio track information from design object
 * @param {Object} design - Design composition data
 * @returns {Array} Array of audio track objects
 */
function extractAudioTracks(design) {
  const audioTracks = [];
  
  if (!design.trackItemsMap || !design.trackItemIds) {
    return audioTracks;
  }
  
  // Iterate through all track items to find audio tracks
  for (const itemId of design.trackItemIds) {
    const item = design.trackItemsMap[itemId];
    
    if (item && item.type === 'audio' && item.details && item.details.src) {
      // Calculate timing information
      const startTime = (item.display?.from || 0) / 1000; // Convert to seconds
      const endTime = (item.display?.to || item.duration || 0) / 1000;
      const duration = endTime - startTime;
      
      // Calculate trim information
      const trimStart = (item.trim?.from || 0) / 1000;
      const trimEnd = (item.trim?.to || item.duration || 0) / 1000;
      
      audioTracks.push({
        id: item.id,
        src: item.details.src,
        name: item.name || `Audio ${audioTracks.length + 1}`,
        startTime,
        duration,
        trimStart,
        trimEnd,
        volume: (item.details.volume || 100) / 100, // Convert percentage to decimal
        playbackRate: item.playbackRate || 1
      });
    }
  }
  
  return audioTracks;
}

/**
 * Downloads a file from URL to local path
 * @param {string} url - URL to download
 * @param {string} localPath - Local path to save file
 * @returns {Promise<void>}
 */
function downloadFile(url, localPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const file = fs.createWriteStream(localPath);
    
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (error) => {
        fs.unlinkSync(localPath);
        reject(error);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generates FFmpeg filter complex for mixing multiple audio tracks
 * @param {Array} audioFiles - Array of downloaded audio file objects
 * @param {number} totalDuration - Total video duration in milliseconds
 * @param {number} fps - Frames per second
 * @returns {Object} Object with inputArgs and filterComplex
 */
function generateAudioMixing(audioFiles, totalDuration, fps) {
  const inputArgs = [];
  const filterParts = [];
  
  // Add input arguments for each audio file
  audioFiles.forEach((audioFile, index) => {
    inputArgs.push('-i', audioFile.path);
  });
  
  if (audioFiles.length === 1) {
    // Single audio track - just process it with timing and volume
    const track = audioFiles[0].track;
    
    // Calculate the actual duration this track should play for
    const trackEndTime = track.display?.to || totalDuration;
    const trackStartTime = track.display?.from || (track.startTime * 1000);
    const trackDuration = (trackEndTime - trackStartTime) / 1000;
    
    filterParts.push(
      `[1:a]adelay=${Math.round(trackStartTime)}|${Math.round(trackStartTime)},` +
      `atempo=${track.playbackRate},` +
      `volume=${track.volume},` +
      `atrim=end=${trackDuration},` +
      `apad=whole_dur=${totalDuration / 1000}[audio]`
    );
    
    return {
      inputArgs,
      filterComplex: filterParts.join(';')
    };
  } else {
    // Multiple audio tracks - mix them
    const audioLabels = [];
    
    audioFiles.forEach((audioFile, index) => {
      const track = audioFile.track;
      const inputIndex = index + 1; // +1 because input 0 is the video frames
      
      // Calculate the actual duration this track should play for
      const trackEndTime = track.display?.to || totalDuration;
      const trackStartTime = track.display?.from || (track.startTime * 1000);
      const trackDuration = (trackEndTime - trackStartTime) / 1000;
      
      // Process each audio track individually
      filterParts.push(
        `[${inputIndex}:a]adelay=${Math.round(trackStartTime)}|${Math.round(trackStartTime)},` +
        `atempo=${track.playbackRate},` +
        `volume=${track.volume},` +
        `atrim=end=${trackDuration}[a${index}]`
      );
      
      audioLabels.push(`[a${index}]`);
    });
    
    // Mix all processed audio tracks together
    filterParts.push(
      `${audioLabels.join('')}amix=inputs=${audioFiles.length}:duration=longest:dropout_transition=0,` +
      `apad=whole_dur=${totalDuration / 1000}[audio]`
    );
    
    return {
      inputArgs,
      filterComplex: filterParts.join(';')
    };
  }
}

module.exports = {
  processAudioTracks,
  extractAudioTracks
};