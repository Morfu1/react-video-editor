const path = require('path');
const fs = require('fs-extra');
const { renderFrames, openBrowser, selectComposition } = require('@remotion/renderer');
const { bundle } = require('@remotion/bundler');

/**
 * Extracts frames from a Remotion composition with memory-efficient processing
 * @param {Object} options - Extraction options
 * @param {Object} options.design - The design composition data
 * @param {string} options.jobId - Unique job ID
 * @param {string} options.framePath - Path to save frames
 * @param {number} options.fps - Frames per second
 * @param {number} options.width - Output width
 * @param {number} options.height - Output height
 * @param {Object} options.systemInfo - System capabilities info
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} Extraction result
 */
async function extractFrames(options) {
  const { design, jobId, framePath, fps, width, height, systemInfo, onProgress } = options;
  
  // Ensure output directory exists
  fs.ensureDirSync(framePath);
  
  // Log the design object to debug duration issue
  console.log("Design object received:", {
    designDuration: design.duration,
    designKeys: Object.keys(design),
    designType: typeof design.duration
  });
  
  // Debug track items to see their display.to values
  if (design.trackItemsMap) {
    console.log("Track items debug:");
    Object.entries(design.trackItemsMap).forEach(([id, item]) => {
      console.log(`  ${id}: from=${item.display?.from}ms, to=${item.display?.to}ms, type=${item.type}`);
    });
  }
  
  // Use explicit timeline duration if provided, otherwise try to calculate
  let timelineDuration = design.duration; // fallback to original
  
  if (design.timelineDuration && design.timelineDuration > 0) {
    // Use the explicit timeline duration from the frontend
    timelineDuration = design.timelineDuration;
    console.log("Using explicit timeline duration:", timelineDuration, "ms instead of design.duration:", design.duration, "ms");
  } else if (design.trackItemsMap && Object.keys(design.trackItemsMap).length > 0) {
    // Fallback: try to calculate from track items (might not be accurate if items aren't updated)
    const maxEndTime = Math.max(
      ...Object.values(design.trackItemsMap).map(item => item.display?.to || 0)
    );
    
    if (maxEndTime > 0 && maxEndTime !== design.duration) {
      timelineDuration = maxEndTime;
      console.log("Using calculated timeline duration from track items:", timelineDuration, "ms instead of design.duration:", design.duration, "ms");
    } else {
      console.log("Track items have same duration as design.duration, using design.duration:", design.duration, "ms");
    }
  }
  
  // Calculate total frames using the correct timeline duration
  const durationInFrames = Math.ceil((timelineDuration / 1000) * fps);
  
  // Log the parameters to debug
  console.log("Extract frames parameters:", {
    width,
    height,
    fps,
    designDuration: design.duration,
    durationInFrames,
    isMemoryConstrained: systemInfo.isMemoryConstrained
  });
  
  // Ensure width and height are valid numbers
  const validWidth = (width && Number.isFinite(Number(width))) ? Number(width) : 1920;
  const validHeight = (height && Number.isFinite(Number(height))) ? Number(height) : 1080;
  
  // Create a fixed, validated config object
  const renderConfig = {
    width: validWidth,
    height: validHeight,
    fps: Number(fps) || 30,
    durationInFrames: Number(durationInFrames) || 1
  };
  
  console.log(`Using dimensions: ${renderConfig.width}x${renderConfig.height}`);
  
  // Validate that all config values are valid numbers
  if (!Number.isFinite(renderConfig.width) || renderConfig.width <= 0) {
    throw new Error(`Invalid width: ${renderConfig.width}`);
  }
  if (!Number.isFinite(renderConfig.height) || renderConfig.height <= 0) {
    throw new Error(`Invalid height: ${renderConfig.height}`);
  }
  if (!Number.isFinite(renderConfig.fps) || renderConfig.fps <= 0) {
    throw new Error(`Invalid fps: ${renderConfig.fps}`);
  }
  if (!Number.isFinite(renderConfig.durationInFrames) || renderConfig.durationInFrames <= 0) {
    throw new Error(`Invalid durationInFrames: ${renderConfig.durationInFrames}`);
  }
  
  // Determine batch size based on system memory
  let batchSize = 30; // Default
  
  if (systemInfo.isMemoryConstrained) {
    // Use smaller batches for memory-constrained systems
    if (renderConfig.width >= 3840 || renderConfig.height >= 2160) { // 4K
      batchSize = 10;
    } else if (renderConfig.width >= 1920 || renderConfig.height >= 1080) { // 1080p
      batchSize = 15;
    } else {
      batchSize = 20;
    }
  } else {
    // For systems with more memory
    if (renderConfig.width >= 3840 || renderConfig.height >= 2160) { // 4K
      batchSize = 20;
    } else if (renderConfig.width >= 1920 || renderConfig.height >= 1080) { // 1080p
      batchSize = 30;
    } else {
      batchSize = 60;
    }
  }
  
  // Calculate number of chunks
  const chunks = Math.ceil(durationInFrames / batchSize);
  console.log(`Rendering ${durationInFrames} frames in ${chunks} chunks of ${batchSize} frames`);
  
  // Save design data for browser rendering
  const inputProps = {
    design: design || {},
    jobId: jobId || '',
    width: renderConfig.width,
    height: renderConfig.height,
    fps: renderConfig.fps,
    durationInFrames: renderConfig.durationInFrames,
    timelineDuration: timelineDuration // Pass the corrected timeline duration
  };
  
  // Save input props to a temporary file that browser can access
  const inputPropsPath = path.join(framePath, '..', 'input-props.json');
  fs.writeJSONSync(inputPropsPath, inputProps);
  
  // Bundle the React app first
  console.log('Bundling React application...');
  const bundleLocation = await bundle({
    entryPoint: path.join(__dirname, '..', '..', 'src', 'remotion.tsx'),
    outDir: path.join(__dirname, '..', 'temp', 'bundle'),
    enableCaching: false,
    webpackOverride: (config) => config
  });
  
  console.log('Bundle created at:', bundleLocation);
  
  // Set up browser for headless rendering
  const browserInstance = await openBrowser();
  
  try {
    // Select composition with inputProps to ensure calculateMetadata receives the props
    console.log('Selecting composition with inputProps...');
    const compositionInputProps = {
      design: design,
      width: renderConfig.width,
      height: renderConfig.height,
      fps: renderConfig.fps,
      durationInFrames: renderConfig.durationInFrames,
      timelineDuration: timelineDuration
    };
    
    const mainComposition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'Main',
      inputProps: compositionInputProps,
      browser: browserInstance
    });
    
    console.log('Main composition selected with calculated metadata:', { 
      id: mainComposition.id, 
      width: mainComposition.width, 
      height: mainComposition.height,
      fps: mainComposition.fps,
      durationInFrames: mainComposition.durationInFrames
    });
    
    // Render all frames at once - no chunking to avoid frame numbering conflicts
    console.log(`Rendering all ${durationInFrames} frames at once`);
    
    await renderFrames({
      browser: browserInstance,
      composition: mainComposition,
      serveUrl: bundleLocation,
      outputDir: framePath,
      inputProps: compositionInputProps,
      imageFormat: 'jpeg',
      jpegQuality: 90,
      dumpBrowserLogs: true,
      concurrency: 1,
      onFrameUpdate: (frame) => {
        const progress = frame / durationInFrames;
        if (onProgress) {
          onProgress(progress * 100);
        }
      }
    });
    
    return {
      success: true,
      totalFrames: durationInFrames,
      framesPath: framePath
    };
    
  } catch (error) {
    console.error('Error extracting frames:', error);
    throw error;
  } finally {
    // Always close browser
    try {
      if (browserInstance) {
        // Close the browser without using closeBrowser
        await browserInstance.close();
      }
    } catch (error) {
      console.warn('Error closing browser:', error);
    }
  }
}

module.exports = {
  extractFrames
};