const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Import our custom modules
const systemDetection = require('./system/resources');
const frameExtraction = require('./renderer/extract');
const ffmpegEncoder = require('./renderer/encode');
const progressTracker = require('./renderer/progress');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Configure middleware
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create temp and uploads directories if they don't exist
fs.ensureDirSync(path.join(__dirname, 'temp'));
fs.ensureDirSync(path.join(__dirname, 'uploads'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use a temp directory first, we'll move files after getting projectId from body
    const tempUploadPath = path.join(__dirname, 'uploads', 'temp');
    fs.ensureDirSync(tempUploadPath);
    cb(null, tempUploadPath);
  },
  filename: (req, file, cb) => {
    // Keep original filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept common media file types
    const allowedTypes = /\.(mp4|mov|avi|webm|mp3|wav|aac|m4a|jpg|jpeg|png|gif|webp)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only media files are allowed.'));
    }
  }
});

// Store active rendering jobs
const activeJobs = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// API Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const projectId = req.body.projectId || 'default';
    
    // Create project directory if it doesn't exist
    const projectUploadPath = path.join(__dirname, 'uploads', projectId);
    fs.ensureDirSync(projectUploadPath);
    
    // Move file from temp to project directory
    const oldPath = req.file.path;
    const newPath = path.join(projectUploadPath, req.file.filename);
    await fs.move(oldPath, newPath);
    
    const fileUrl = `/uploads/${projectId}/${req.file.filename}`;
    
    // Return file info compatible with MediaFile interface
    const mediaFile = {
      id: uuidv4(),
      name: req.file.originalname,
      type: getFileType(req.file.mimetype),
      size: req.file.size,
      url: fileUrl,
      serverPath: newPath
    };

    console.log(`File uploaded: ${req.file.originalname} -> ${fileUrl}`);
    
    res.json(mediaFile);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to determine file type
function getFileType(mimetype) {
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('image/')) return 'image';
  return 'unknown';
}

app.post('/api/render/start', async (req, res) => {
  try {
    const { design, options } = req.body;
    
    if (!design || !options) {
      return res.status(400).json({ error: 'Missing design or options' });
    }
    
    // Generate a unique job ID
    const jobId = uuidv4();
    
    // Create job directory
    const jobDir = path.join(__dirname, 'temp', jobId);
    fs.ensureDirSync(jobDir);
    fs.ensureDirSync(path.join(jobDir, 'frames'));
    
    // Store job data
    fs.writeJSONSync(path.join(jobDir, 'job-data.json'), {
      design,
      options,
      createdAt: new Date().toISOString()
    });
    
    // Detect system capabilities
    const systemInfo = await systemDetection.detectSystem();
    
    // Initialize job in active jobs map
    activeJobs.set(jobId, {
      id: jobId,
      status: 'initialized',
      progress: 0,
      systemInfo,
      options,
      startTime: Date.now()
    });
    
    // Start the rendering process asynchronously
    process.nextTick(() => {
      startRenderProcess(jobId, design, options, systemInfo);
    });
    
    // Return job ID to client
    return res.status(200).json({
      jobId,
      status: 'initialized',
      systemInfo: {
        isArm: systemInfo.isArm,
        totalMemoryMB: systemInfo.totalMemoryMB,
        hasQuickSync: systemInfo.hasQuickSync,
        hasVideoToolbox: systemInfo.hasVideoToolbox
      }
    });
  } catch (error) {
    console.error('Error starting render:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/render/status/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const job = activeJobs.get(jobId);
  return res.status(200).json({
    jobId,
    status: job.status,
    progress: job.progress,
    phase: job.phase || 'initializing',
    ...(job.error && { error: job.error }),
    ...(job.outputPath && { outputPath: job.outputPath })
  });
});

app.get('/api/render/download/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const job = activeJobs.get(jobId);
  
  if (job.status !== 'completed' || !job.outputPath) {
    return res.status(400).json({ error: 'Render not completed or output not available' });
  }
  
  res.download(job.outputPath);
});

// Endpoint to cancel a render job
app.post('/api/render/cancel/:jobId', (req, res) => {
  const { jobId } = req.params;
  
  if (!activeJobs.has(jobId)) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  const job = activeJobs.get(jobId);
  
  // Only cancel jobs that are in progress
  if (job.status === 'rendering' || job.status === 'initialized') {
    console.log(`Cancelling render job ${jobId}`);
    
    // Mark job as cancelled
    job.status = 'cancelled';
    job.progress = 0;
    
    // Notify clients
    io.emit(`job-progress-${jobId}`, {
      jobId,
      status: 'cancelled',
      phase: 'cancelled',
      progress: 0
    });
    
    // Clean up resources in the background
    setTimeout(() => {
      try {
        const jobDir = path.join(__dirname, 'temp', jobId);
        fs.removeSync(jobDir);
        console.log(`Cleaned up resources for cancelled job ${jobId}`);
      } catch (error) {
        console.error(`Error cleaning up resources for job ${jobId}:`, error);
      }
    }, 1000);
    
    return res.status(200).json({ status: 'cancelled' });
  }
  
  // Job is already completed or cancelled
  return res.status(400).json({
    error: 'Cannot cancel job',
    status: job.status
  });
});

// Download/save video to user-specified path
app.post('/api/render/save/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    let { outputPath } = req.body;
    
    if (!outputPath) {
      return res.status(400).json({ error: 'Output path is required' });
    }
    
    if (!activeJobs.has(jobId)) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    const job = activeJobs.get(jobId);
    
    if (job.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Job is not completed yet',
        status: job.status 
      });
    }
    
    if (!job.outputPath || !fs.existsSync(job.outputPath)) {
      return res.status(404).json({ error: 'Output video file not found' });
    }
    
    // Handle relative paths - if not absolute, save relative to project root
    if (!path.isAbsolute(outputPath)) {
      outputPath = path.resolve(process.cwd(), outputPath);
    }
    
    // Ensure the output directory exists
    const outputDir = path.dirname(outputPath);
    fs.ensureDirSync(outputDir);
    
    // Copy the video to the user-specified path
    await fs.copy(job.outputPath, outputPath);
    
    console.log(`Video saved to: ${outputPath}`);
    
    // Clean up temp files after successful save (with longer delay)
    const jobDir = path.join(__dirname, 'temp', jobId);
    setTimeout(() => {
      try {
        if (fs.existsSync(jobDir)) {
          fs.removeSync(jobDir);
          console.log(`Cleaned up temp files for job ${jobId}`);
        }
        
        // Remove from active jobs
        activeJobs.delete(jobId);
      } catch (error) {
        console.error(`Error cleaning up temp files for job ${jobId}:`, error);
      }
    }, 5000); // Increased delay to 5 seconds
    
    return res.status(200).json({ 
      success: true,
      outputPath,
      message: 'Video saved successfully'
    });
    
  } catch (error) {
    console.error('Error saving video:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Helper function to start the rendering process
async function startRenderProcess(jobId, design, options, systemInfo) {
  try {
    // Update job status
    activeJobs.get(jobId).status = 'rendering';
    activeJobs.get(jobId).phase = 'extraction';
    
    // Create progress updater
    const updateProgress = (progress, phase) => {
      const job = activeJobs.get(jobId);
      if (job) {
        job.progress = progress;
        job.phase = phase;
        // Emit progress via Socket.IO
        io.emit(`job-progress-${jobId}`, { jobId, progress, phase });
      }
    };
    
    // 1. Extract frames using Remotion
    updateProgress(0, 'extraction');
    const { fps, size = {} } = options;
    const framePath = path.join(__dirname, 'temp', jobId, 'frames');
    
    // Ensure width and height are valid numbers
    const width = typeof size.width === 'number' ? size.width : 1920;
    const height = typeof size.height === 'number' ? size.height : 1080;
    
    console.log(`Rendering with dimensions: ${width}x${height}`);
    
    await frameExtraction.extractFrames({
      design,
      jobId,
      framePath,
      fps,
      width,
      height,
      systemInfo,
      onProgress: (progress) => updateProgress(Math.floor(progress * 0.5), 'extraction')
    });
    
    // 2. Encode video with FFmpeg
    updateProgress(50, 'encoding');
    const outputPath = path.join(__dirname, 'temp', jobId, `output-${options.quality.replace(/\s+/g, '-').toLowerCase()}.mp4`);
    
    await ffmpegEncoder.encodeVideo({
      jobId,
      framePath,
      outputPath,
      fps,
      width: width,
      height: height,
      quality: options.quality,
      systemInfo,
      design,
      onProgress: (progress) => updateProgress(50 + Math.floor(progress * 0.5), 'encoding')
    });
    
    // 3. Update job status to completed
    const job = activeJobs.get(jobId);
    job.status = 'completed';
    job.progress = 100;
    job.outputPath = outputPath;
    job.phase = 'completed';
    
    // Notify client
    io.emit(`job-progress-${jobId}`, { 
      jobId, 
      progress: 100, 
      phase: 'completed',
      outputPath
    });
    
    console.log(`Render job ${jobId} completed`);
    
    // Clean up frames to save space
    setTimeout(() => {
      fs.removeSync(framePath);
    }, 1000 * 60 * 5); // Clean up after 5 minutes
    
  } catch (error) {
    console.error(`Error in render process for job ${jobId}:`, error);
    
    // Update job status to error
    const job = activeJobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
      
      // Notify client
      io.emit(`job-progress-${jobId}`, { 
        jobId, 
        status: 'error',
        error: error.message
      });
    }
  }
}

// Start the server
const PORT = process.env.PORT || 3030;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down');
    process.exit(0);
  });
});

module.exports = { app, server, io };