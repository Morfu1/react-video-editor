/**
 * Download utility for video editor
 * Handles both client-side and server-rendered videos
 */
export const download = async (url: string, filename: string) => {
  try {
    console.log("Starting download from URL:", url);
    
    let blobUrl: string;
    
    // Check if this is a server-rendered file path
    if (url.startsWith('/Volumes/') || url.startsWith('./temp/')) {
      console.log("Detected server-rendered file path, downloading from server");
      
      // Extract job ID from the path if present
      const jobIdMatch = url.match(/\/temp\/([a-f0-9-]+)\/output/);
      const jobId = jobIdMatch ? jobIdMatch[1] : null;
      
      if (jobId) {
        // Download directly from server endpoint
        window.location.href = `http://localhost:3031/api/render/download/${jobId}`;
        return;
      } else {
        // Fallback for other server paths
        alert("The video was rendered on the server. Please check your downloads folder.");
        return;
      }
    }
    
    // Handle data URLs directly, no need to fetch
    if (url.startsWith('data:')) {
      console.log("Detected data URL, converting directly");
      blobUrl = url;
    } else {
      // For regular URLs, fetch the content first
      console.log("Fetching from regular URL");
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();
      blobUrl = window.URL.createObjectURL(blob);
      
      // Get quality from store or localStorage if available
      const downloadState = JSON.parse(localStorage.getItem('download-state') || '{}');
      const quality = downloadState.quality || "Full HD";
      
      // Include quality in the filename for regular URLs
      if (quality && !filename.includes(quality)) {
        filename = `${filename}-${quality.replace(/[()]/g, '')}`;
      }
    }
    
    // Create and trigger download link
    const link = document.createElement("a");
    link.href = blobUrl;
    
    // Add .mp4 extension only if it's not already there
    let fullFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
    
    // Get render metadata if available
    const videoId = url.includes('mock-video-') || url.includes('render-') ?
      url.match(/mock-video-(\d+)|render-(\d+)/)?.[0] : null;
    
    if (videoId) {
      const metadata = JSON.parse(localStorage.getItem(`render-metadata-${videoId}`) || '{}');
      
      // Use the savePath from metadata if available
      if (metadata.savePath) {
        fullFilename = metadata.savePath;
        console.log(`Using saved path from metadata: ${fullFilename}`);
      } else {
        // Otherwise use quality info from metadata
        const quality = metadata.quality ||
                        localStorage.getItem(`render-quality-${videoId}`) ||
                        JSON.parse(localStorage.getItem('download-state') || '{}').quality ||
                        "Full HD";
        
        if (quality && !fullFilename.includes(quality)) {
          fullFilename = fullFilename.replace('.mp4', `-${quality.replace(/[()]/g, '')}.mp4`);
        }
      }
    } else if (url.startsWith('data:')) {
      const downloadState = JSON.parse(localStorage.getItem('download-state') || '{}');
      const quality = downloadState.quality || "Full HD";
      
      if (quality && !fullFilename.includes(quality)) {
        fullFilename = fullFilename.replace('.mp4', `-${quality.replace(/[()]/g, '')}.mp4`);
      }
    }
    
    link.setAttribute("download", fullFilename);
    
    // For debugging: log download details
    console.log("Downloading as:", fullFilename);
    
    // Append to body, click, and clean up
    document.body.appendChild(link);
    link.click();
    
    // Small timeout to ensure download starts before cleanup
    setTimeout(() => {
      link.parentNode?.removeChild(link);
      if (!url.startsWith('data:')) {
        window.URL.revokeObjectURL(blobUrl);
      }
      console.log("Download initiated successfully");
    }, 100);
    
  } catch (error) {
    console.error("Download error:", error);
    alert("Failed to download the video. Please try again.");
  }
};
