const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const ffmpegStatic = require('ffmpeg-static');
const { processAudioTracks } = require('./audio');

/**
 * Encodes video using FFmpeg with system-specific optimizations
 * @param {Object} options - Encoding options
 * @param {string} options.jobId - Unique job ID
 * @param {string} options.framePath - Path to input frames
 * @param {string} options.outputPath - Path for output video
 * @param {number} options.fps - Frames per second
 * @param {number} options.width - Output width
 * @param {number} options.height - Output height
 * @param {string} options.quality - Quality preset (e.g., "Full HD (1080p)", "4K (2160p)")
 * @param {Object} options.systemInfo - System capabilities info
 * @param {Function} options.onProgress - Progress callback
 * @param {Object} options.design - Design object containing audio tracks
 * @returns {Promise<Object>} Encoding result
 */
async function encodeVideo(options) {
  const { jobId, framePath, outputPath, fps, width, height, quality, systemInfo, onProgress, design } = options;
  
  console.log(`Starting video encoding for job ${jobId} with quality ${quality}`);
  console.log(`System info: ${JSON.stringify(systemInfo)}`);
  
  // Debug: Check what files exist in the frames directory
  try {
    const frameFiles = fs.readdirSync(framePath);
    console.log(`Found ${frameFiles.length} files in frames directory:`);
    console.log(`First few files: ${frameFiles.slice(0, 5).join(', ')}`);
    console.log(`Last few files: ${frameFiles.slice(-5).join(', ')}`);
    
    if (frameFiles.length === 0) {
      throw new Error('No frame files found in frames directory');
    }
  } catch (error) {
    console.error('Error reading frames directory:', error);
    throw new Error(`Cannot access frames directory: ${error.message}`);
  }
  
  // Process audio tracks from the design
  console.log('Processing audio tracks...');
  const tempDir = path.dirname(framePath);
  
  // Use explicit timeline duration if provided, otherwise try to calculate
  let totalDuration = design?.duration || 10000; // Default 10 seconds if not specified
  
  if (design?.timelineDuration && design.timelineDuration > 0) {
    // Use the explicit timeline duration from the frontend
    totalDuration = design.timelineDuration;
    console.log("Using explicit timeline duration for audio processing:", totalDuration, "ms instead of design.duration:", design?.duration, "ms");
  } else if (design?.trackItemsMap && Object.keys(design.trackItemsMap).length > 0) {
    // Fallback: try to calculate from track items (might not be accurate if items aren't updated)
    const maxEndTime = Math.max(
      ...Object.values(design.trackItemsMap).map(item => item.display?.to || 0)
    );
    
    if (maxEndTime > 0 && maxEndTime !== design.duration) {
      totalDuration = maxEndTime;
      console.log("Using calculated timeline duration for audio processing:", totalDuration, "ms instead of design.duration:", design?.duration, "ms");
    } else {
      console.log("Track items have same duration as design.duration, using design.duration for audio processing:", design?.duration, "ms");
    }
  }
  
  const audioProcessing = await processAudioTracks({
    design,
    jobId,
    tempDir,
    fps,
    totalDuration
  });
  
  // Generate FFmpeg command based on system capabilities with audio
  const ffmpegCommand = generateFFmpegCommand({
    ...options,
    audioProcessing
  });
  
  // Create temporary file for two-pass encoding if needed
  const isTwoPass = ffmpegCommand.twoPass;
  const passLogFile = path.join(path.dirname(outputPath), 'ffmpeg2pass');
  
  try {
    // For two-pass encoding, run first pass
    if (isTwoPass) {
      console.log('Starting first pass encoding...');
      await runFFmpegProcess(ffmpegCommand.firstPass.path, ffmpegCommand.firstPass.args, onProgress, 0, 45);
    }
    
    // Run main encoding process (or second pass)
    console.log(`Starting ${isTwoPass ? 'second pass' : 'main'} encoding...`);
    const progressStart = isTwoPass ? 45 : 0;
    const progressEnd = 100;
    
    await runFFmpegProcess(ffmpegCommand.main.path, ffmpegCommand.main.args, onProgress, progressStart, progressEnd);
    
    // Check if output file exists and has non-zero size
    const stats = await fs.stat(outputPath);
    if (stats.size === 0) {
      throw new Error('Output file has zero size, encoding failed');
    }
    
    console.log(`Video encoding completed for job ${jobId}`);
    return {
      success: true,
      outputPath,
      fileSize: stats.size
    };
    
  } catch (error) {
    console.error(`Encoding error for job ${jobId}:`, error);
    throw error;
  } finally {
    // Clean up temporary files
    try {
      if (isTwoPass) {
        // Clean up pass log files
        const logFiles = [
          `${passLogFile}-0.log`,
          `${passLogFile}.log`,
          `${passLogFile}-0.log.mbtree`
        ];
        
        for (const file of logFiles) {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        }
      }
    } catch (cleanupError) {
      console.warn('Error cleaning up temporary files:', cleanupError);
    }
  }
}

/**
 * Run FFmpeg process and track progress
 * @param {string} command - FFmpeg command
 * @param {Function} onProgress - Progress callback
 * @param {number} progressStart - Starting progress percentage
 * @param {number} progressEnd - Ending progress percentage
 * @returns {Promise<void>}
 */
function runFFmpegProcess(ffmpegPath, args, onProgress, progressStart, progressEnd) {
  return new Promise((resolve, reject) => {
    console.log('Running FFmpeg with args:', [ffmpegPath, ...args].join(' '));
    console.log('FFmpeg args array:', args);
    
    // Spawn FFmpeg process
    const process = spawn(ffmpegPath, args);
    
    // Variables to track progress
    let duration = 0;
    let currentTime = 0;
    let errorOutput = '';
    
    // Handle stdout (not typically used by FFmpeg)
    process.stdout.on('data', (data) => {
      console.log(`FFmpeg stdout: ${data.toString()}`);
    });
    
    // Handle stderr (where FFmpeg logs progress)
    process.stderr.on('data', (data) => {
      const output = data.toString();
      
      // Collect all stderr output for error reporting
      errorOutput += output;
      
      // Extract duration if not already known
      if (!duration) {
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
        if (durationMatch) {
          const [, hours, minutes, seconds] = durationMatch;
          duration = (parseInt(hours) * 3600) + (parseInt(minutes) * 60) + parseInt(seconds);
        }
      }
      
      // Extract current time
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch && duration > 0) {
        const [, hours, minutes, seconds] = timeMatch;
        currentTime = (parseInt(hours) * 3600) + (parseInt(minutes) * 60) + parseInt(seconds);
        
        // Calculate progress within the specified range
        const encodingProgress = (currentTime / duration);
        const totalProgress = progressStart + (encodingProgress * (progressEnd - progressStart));
        
        // Call progress callback
        if (onProgress) {
          onProgress(Math.min(Math.round(totalProgress), progressEnd));
        }
      }
      
      // Log all FFmpeg output to help debug
      console.log(`FFmpeg stderr: ${output.trim()}`);
    });
    
    // Handle process exit
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error(`FFmpeg failed with exit code ${code}. Full stderr output:`);
        console.error(errorOutput);
        reject(new Error(`FFmpeg process exited with code ${code}. Error: ${errorOutput.slice(-500)}`));
      }
    });
    
    // Handle process error
    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Generate FFmpeg command based on system capabilities and quality settings
 * @param {Object} options - Encoding options
 * @returns {Object} FFmpeg commands
 */
function generateFFmpegCommand(options) {
  const { framePath, outputPath, fps, width, height, quality, systemInfo, audioProcessing } = options;
  
  // Detect the actual frame naming pattern
  let inputPattern;
  try {
    const frameFiles = fs.readdirSync(framePath).filter(f => f.endsWith('.jpeg')).sort();
    console.log(`Frame files found: ${frameFiles.slice(0, 3).join(', ')}`);
    
    if (frameFiles.length === 0) {
      throw new Error('No JPEG frames found in frames directory');
    }
    
    // Dynamically detect the padding length from actual files
    const firstFile = frameFiles[0];
    const digitMatch = firstFile.match(/element-(\d+)\.jpeg/);
    
    if (!digitMatch) {
      throw new Error(`Unexpected frame filename pattern: ${firstFile}`);
    }
    
    // Get the number of digits used for padding
    const paddingLength = digitMatch[1].length;
    inputPattern = path.join(framePath, `element-%0${paddingLength}d.jpeg`);
    
    console.log(`Detected ${paddingLength}-digit frame pattern: element-%0${paddingLength}d.jpeg`);
    console.log(`Sample files: ${frameFiles.slice(0, 3).join(', ')}`);
    
    // Verify the pattern works by checking if we can find the first frame
    const testPattern = path.join(framePath, firstFile);
    if (!fs.existsSync(testPattern)) {
      console.warn(`Warning: Could not verify frame pattern with file: ${testPattern}`);
    }
  } catch (error) {
    console.error('Error detecting frame pattern:', error);
    
    // Intelligent fallback: try to detect from directory listing
    try {
      const frameFiles = fs.readdirSync(framePath).filter(f => f.endsWith('.jpeg')).sort();
      if (frameFiles.length > 0) {
        const firstFile = frameFiles[0];
        const fallbackMatch = firstFile.match(/element-(\d+)\.jpeg/);
        if (fallbackMatch) {
          const paddingLength = fallbackMatch[1].length;
          inputPattern = path.join(framePath, `element-%0${paddingLength}d.jpeg`);
          console.log(`Fallback detected ${paddingLength}-digit frame pattern from: ${firstFile}`);
        } else {
          // Last resort fallback
          inputPattern = path.join(framePath, 'element-%04d.jpeg');
          console.log('Using last resort 4-digit frame pattern fallback');
        }
      } else {
        throw new Error('No frame files found for fallback detection');
      }
    } catch (fallbackError) {
      // Final fallback
      inputPattern = path.join(framePath, 'element-%04d.jpeg');
      console.log('Using final 4-digit frame pattern fallback due to:', fallbackError.message);
    }
  }
  
  // Determine if this is a high-resolution render
  const isHighRes = width >= 3840 || height >= 2160 || quality.includes('4K');
  
  // Set quality parameters based on resolution and quality setting
  let crf, preset, bitrate;
  
  if (isHighRes) {
    // 4K quality settings
    crf = 22;
    preset = systemInfo.isMemoryConstrained ? 'medium' : 'slow';
    bitrate = '35M';
  } else {
    // 1080p or lower quality settings
    crf = 20;
    preset = systemInfo.isMemoryConstrained ? 'medium' : 'slow';
    bitrate = '15M';
  }
  
  // Determine if we should use two-pass encoding (recommended for 4K)
  const useTwoPass = isHighRes || systemInfo.isMemoryConstrained;
  
  // Build base input arguments
  const baseInputArgs = [
    '-framerate', fps.toString(),
    '-start_number', '0',
    '-i', inputPattern
  ];
  
  // Determine video codec and additional args based on system capabilities
  let videoCodecArgs = [];
  let hwAccelArgs = [];
  
  if (systemInfo.isArm && systemInfo.hasVideoToolbox) {
    // M1/M2 Mac with VideoToolbox
    console.log('Using VideoToolbox hardware acceleration');
    hwAccelArgs = ['-hwaccel', 'videotoolbox'];
    videoCodecArgs = [
      '-c:v', 'h264_videotoolbox',
      '-b:v', bitrate,
      '-maxrate', `${parseInt(bitrate) * 1.5}M`,
      '-bufsize', `${parseInt(bitrate) * 2}M`
    ];
  } else if (systemInfo.hasNvenc) {
    // NVIDIA GPU
    console.log('Using NVIDIA hardware acceleration');
    videoCodecArgs = [
      '-c:v', 'h264_nvenc',
      '-preset', 'p7',
      '-rc', 'vbr_hq',
      '-cq', '20',
      '-b:v', bitrate,
      '-maxrate', `${parseInt(bitrate) * 1.5}M`
    ];
  } else if (systemInfo.hasQuickSync) {
    // Intel with QuickSync
    console.log('Using Intel QuickSync hardware acceleration');
    videoCodecArgs = [
      '-c:v', 'h264_qsv',
      '-preset', preset === 'slow' ? 'veryslow' : 'medium',
      '-b:v', bitrate
    ];
  } else {
    // CPU encoding with x264
    console.log('Using CPU encoding with x264');
    videoCodecArgs = [
      '-c:v', 'libx264',
      '-preset', preset,
      '-crf', crf.toString(),
      '-tune', 'film'
    ];
  }
  
  // Process audio inputs and filters
  let audioInputArgs = [];
  let audioOutputArgs = ['-c:a', 'aac', '-b:a', '128k'];
  let filterComplexArgs = [];
  
  if (audioProcessing && audioProcessing.inputArgs && audioProcessing.inputArgs.length > 0) {
    // We have audio tracks to process
    audioInputArgs = audioProcessing.inputArgs;
    if (audioProcessing.filterComplex) {
      filterComplexArgs = ['-filter_complex', audioProcessing.filterComplex, '-map', '0:v', '-map', '[audio]'];
    } else {
      // Single audio track without complex filtering
      filterComplexArgs = ['-map', '0:v', '-map', '1:a'];
    }
  } else {
    // No audio tracks, add silent audio
    audioInputArgs = ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'];
    filterComplexArgs = ['-map', '0:v', '-map', '1:a', '-shortest'];
  }
  
  // Output options
  const outputArgs = [
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y',
    outputPath
  ];
  
  // Combine args for main encoding
  const mainArgs = [
    ...hwAccelArgs,
    ...baseInputArgs,
    ...audioInputArgs,
    ...filterComplexArgs,
    ...videoCodecArgs,
    ...audioOutputArgs,
    ...outputArgs
  ];
  
  // For two-pass encoding, create first pass command
  if (useTwoPass) {
    const passLogFile = path.join(path.dirname(outputPath), 'ffmpeg2pass');
    
    // Two-pass encoding uses bitrate mode, not CRF
    const targetBitrate = bitrate;
    
    // First pass uses software encoding with bitrate
    const firstPassArgs = [
      ...baseInputArgs,
      '-c:v', 'libx264',
      '-preset', preset,
      '-b:v', targetBitrate,
      '-pass', '1',
      '-passlogfile', passLogFile,
      '-an',
      '-f', 'null',
      process.platform === 'win32' ? 'NUL' : '/dev/null'
    ];
    
    // Second pass uses software encoding with bitrate
    const secondPassArgs = [
      ...baseInputArgs,
      ...audioInputArgs,
      ...filterComplexArgs,
      '-c:v', 'libx264',
      '-preset', preset,
      '-b:v', targetBitrate,
      '-pass', '2',
      '-passlogfile', passLogFile,
      ...audioOutputArgs,
      ...outputArgs
    ];
    
    return {
      firstPass: { path: ffmpegStatic, args: firstPassArgs },
      main: { path: ffmpegStatic, args: secondPassArgs },
      twoPass: true
    };
  }
  
  return {
    main: { path: ffmpegStatic, args: mainArgs },
    twoPass: false
  };
}

module.exports = {
  encodeVideo
};