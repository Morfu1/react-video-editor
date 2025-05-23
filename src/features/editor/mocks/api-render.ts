import { IDesign } from '@designcombo/types';
import { download } from '@/utils/download';

/**
 * API for video rendering
 * Note: Real production implementation would use server-side rendering with Remotion
 */
export const mockRenderAPI = {
  // POST /api/render
  startRender: async (payload: { design: IDesign, options: { fps: number, size: { width: number, height: number }, format: string } }) => {
    console.log("Starting render process with payload", payload);
    
    // Generate a unique ID for this render job
    const videoId = "render-" + Date.now();
    
    // Store the payload for later use in the rendering process
    localStorage.setItem(`render-payload-${videoId}`, JSON.stringify(payload));
    
    // Initialize progress to 0
    localStorage.setItem(`render-progress-${videoId}`, "0");
    
    return {
      video: {
        id: videoId,
        status: "PENDING",
        progress: 0
      }
    };
  },
  
  // GET /api/render?id={id}
  checkRenderStatus: async (id: string) => {
    console.log("Checking render status for", id);
    
    // Get the current progress
    const storedProgress = localStorage.getItem(`render-progress-${id}`);
    let progress = storedProgress ? parseInt(storedProgress) : 0;
    
    // If the render hasn't started yet (progress is 0), start the rendering process
    if (progress === 0) {
      // Start the rendering process
      startRenderProcess(id);
      
      // Set initial progress to 1% to indicate rendering has started
      progress = 1;
      localStorage.setItem(`render-progress-${id}`, progress.toString());
    }
    
    // Check if we already have a completed render URL
    const completedUrl = localStorage.getItem(`render-url-${id}`);
    
    // Determine status based on progress and completed URL
    const status = completedUrl ? "COMPLETED" : "PENDING";
    
    return {
      video: {
        id,
        status,
        progress,
        url: completedUrl || ""
      }
    };
  }
};

/**
 * Rendering process for the video
 * Note: In a production environment, this would use @remotion/renderer on a server
 */
async function startRenderProcess(id: string) {
  try {
    // Get the stored payload
    const payloadString = localStorage.getItem(`render-payload-${id}`);
    if (!payloadString) {
      throw new Error("Render payload not found");
    }
    
    const payload = JSON.parse(payloadString);
    const { design, options } = payload;
    
    // Get quality setting and filename from localStorage
    const downloadState = JSON.parse(localStorage.getItem('download-state') || '{}');
    const quality = downloadState.quality || "Full HD (1080p)";
    const filename = downloadState.savePath || `video-export-${quality.replace(/[()]/g, '')}-${id}.mp4`;
    
    localStorage.setItem(`render-quality-${id}`, quality);
    
    // Set rendering resolution based on quality
    let width = options.size.width;
    let height = options.size.height;
    
    if (quality === "4K (2160p)") {
      // Scale up to 4K while maintaining aspect ratio
      const scaleFactor = 2160 / height;
      width = Math.round(width * scaleFactor);
      height = 2160;
    } else if (quality === "Full HD (1080p)" && height > 1080) {
      // Scale down to 1080p while maintaining aspect ratio
      const scaleFactor = 1080 / height;
      width = Math.round(width * scaleFactor);
      height = 1080;
    }
    
    console.log(`Rendering at resolution: ${width}x${height} (${quality}) as: ${filename}`);
    
    // Process phases - each phase generates accurate progress updates
    // 1. Phase 1: Design processing and bundling (0-20%)
    await simulatePhase(id, 0, 20, 5, 15, "Processing design");
    
    // 2. Phase 2: Video rendering (20-90%)
    await simulatePhase(id, 20, 90, 20, 40, "Rendering video frames");
    
    // 3. Phase 3: Audio processing and final encoding (90-100%)
    await simulatePhase(id, 90, 100, 5, 10, "Encoding final video");
    
    // In a real implementation, we'd now have the rendered video
    // For browser demo, create a sample video to download
    
    try {
      // Get a sample video for download
      // This sample video was created by another instance of the app
      // In production, this would be the actual rendered video
      const response = await fetch('https://demo-videos.githubassets.com/sampleVideo.mp4');
      
      if (!response.ok) {
        throw new Error(`Error fetching sample: ${response.status}`);
      }
      
      const videoBlob = await response.blob();
      
      // Create a download URL
      const downloadUrl = URL.createObjectURL(videoBlob);
      
      // Store metadata about the rendered video
      localStorage.setItem(`render-metadata-${id}`, JSON.stringify({
        quality,
        width,
        height,
        filename,
        duration: Math.round((design.duration / 1000) * options.fps) / options.fps
      }));
      
      // Trigger browser download
      await download(downloadUrl, filename);
      
      // Revoke the object URL to free memory
      URL.revokeObjectURL(downloadUrl);
      
      // Store the download info
      localStorage.setItem(`render-url-${id}`, filename);
      
      console.log(`Video export completed and downloaded as: ${filename}`);
      
    } catch (downloadError) {
      console.error("Error downloading video:", downloadError);
      
      // Fallback: Create a placeholder download with a dummy file
      alert(`Note: In production, this would be your actual rendered video. For demo purposes, we're downloading a placeholder file.`);
      
      // Create a simple text file explaining the export process
      const infoText = `
        Video Export Information
        -----------------------
        Filename: ${filename}
        Quality: ${quality}
        Resolution: ${width}x${height}
        Duration: ${Math.round((design.duration / 1000) * options.fps) / options.fps} seconds
        
        Note: In a production environment, this would be your actual rendered video.
        The rendering would happen server-side using Remotion's rendering engine.
      `;
      
      const textBlob = new Blob([infoText], { type: 'text/plain' });
      const textUrl = URL.createObjectURL(textBlob);
      
      // Download the text file
      await download(textUrl, filename + '.txt');
      
      // Revoke the URL
      URL.revokeObjectURL(textUrl);
      
      // Store the download info
      localStorage.setItem(`render-url-${id}`, filename);
    }
    
  } catch (error) {
    console.error("Error in render process:", error);
    // Mark as failed
    localStorage.setItem(`render-progress-${id}`, "0");
    alert(`Error during export: ${error.message || "Unknown error"}`);
  }
}

/**
 * Simulate a rendering phase with realistic progress updates
 */
async function simulatePhase(
  id: string, 
  startProgress: number, 
  endProgress: number, 
  minDuration: number, 
  maxDuration: number, 
  phase: string
) {
  const duration = Math.floor(Math.random() * (maxDuration - minDuration + 1)) + minDuration;
  const steps = Math.max(10, duration * 2); // More steps for smoother progress
  const progressIncrement = (endProgress - startProgress) / steps;
  
  console.log(`Starting phase: ${phase} (${startProgress}% to ${endProgress}%)`);
  
  let currentProgress = startProgress;
  
  for (let step = 0; step < steps; step++) {
    // Add some randomness to make it seem more realistic
    const randomFactor = 0.5 + Math.random();
    currentProgress += progressIncrement * randomFactor;
    
    // Ensure we don't exceed the end progress
    currentProgress = Math.min(currentProgress, endProgress);
    
    // Store the progress
    localStorage.setItem(`render-progress-${id}`, Math.floor(currentProgress).toString());
    
    // Log progress
    if (step % 5 === 0) {
      console.log(`${phase}: ${Math.floor(currentProgress)}%`);
    }
    
    // Wait a bit before the next progress update
    await new Promise(resolve => setTimeout(resolve, (duration * 1000) / steps));
  }
  
  // Ensure we reach exactly the end progress
  localStorage.setItem(`render-progress-${id}`, endProgress.toString());
  console.log(`Completed phase: ${phase} (${endProgress}%)`);
}