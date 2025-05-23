const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const nodeOsUtils = require('node-os-utils');

const execPromise = util.promisify(exec);

/**
 * Detects system architecture and capabilities
 * @returns {Promise<Object>} System capabilities
 */
async function detectSystem() {
  try {
    // Check if running on ARM (M1/M2 Mac)
    const isArm = process.arch === 'arm64';
    
    // Get total system memory in MB
    const totalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
    
    // Get available memory in MB
    const freeMemoryMB = Math.round(os.freemem() / (1024 * 1024));
    
    // Get CPU info
    const cpuInfo = os.cpus();
    const cpuCores = cpuInfo.length;
    const cpuModel = cpuInfo[0]?.model || 'Unknown CPU';
    
    // Check for Intel QuickSync availability (Intel hardware)
    let hasQuickSync = false;
    if (!isArm) {
      try {
        const { stdout } = await execPromise('ffmpeg -hwaccels');
        hasQuickSync = stdout.includes('qsv');
      } catch (e) {
        // Ignore errors, assume no QuickSync
        console.log('QuickSync detection error:', e.message);
      }
    }
    
    // Check for VideoToolbox (macOS)
    let hasVideoToolbox = false;
    try {
      const { stdout } = await execPromise('ffmpeg -hwaccels');
      hasVideoToolbox = stdout.includes('videotoolbox');
    } catch (e) {
      // Ignore errors, assume no VideoToolbox
      console.log('VideoToolbox detection error:', e.message);
    }

    // Check for NVIDIA CUDA/NVENC
    let hasNvenc = false;
    try {
      const { stdout } = await execPromise('ffmpeg -hwaccels');
      hasNvenc = stdout.includes('cuda') || stdout.includes('nvenc');
    } catch (e) {
      // Ignore errors, assume no NVENC
      console.log('NVENC detection error:', e.message);
    }
    
    // Determine if memory constrained (8GB or less)
    const isMemoryConstrained = totalMemoryMB <= 8192;
    
    // Get current CPU load
    const cpuLoad = await nodeOsUtils.cpu.usage();
    
    return {
      isArm,
      totalMemoryMB,
      freeMemoryMB,
      cpuCores,
      cpuModel,
      cpuLoad,
      hasQuickSync,
      hasVideoToolbox,
      hasNvenc,
      isMemoryConstrained,
      platform: os.platform(),
      osType: os.type(),
      osRelease: os.release()
    };
  } catch (error) {
    console.error('Failed to detect system capabilities:', error);
    // Return conservative defaults
    return {
      isArm: false,
      totalMemoryMB: 8192, // Assume 8GB
      freeMemoryMB: 2048,  // Assume 2GB free
      cpuCores: 4,
      cpuModel: 'Unknown',
      cpuLoad: 0,
      hasQuickSync: false,
      hasVideoToolbox: false,
      hasNvenc: false,
      isMemoryConstrained: true,
      platform: os.platform(),
      osType: os.type(),
      osRelease: os.release()
    };
  }
}

/**
 * Monitors memory usage during rendering
 * @returns {Object} Memory monitoring functions
 */
function monitorMemory() {
  const memoryUsage = {
    start: null,
    current: null,
    peak: null
  };
  
  let intervalId = null;
  
  return {
    startMonitoring: (onUpdate) => {
      // Initial measurement
      const initialUsage = process.memoryUsage();
      memoryUsage.start = {
        rss: initialUsage.rss / (1024 * 1024),
        heapTotal: initialUsage.heapTotal / (1024 * 1024),
        heapUsed: initialUsage.heapUsed / (1024 * 1024),
        external: initialUsage.external / (1024 * 1024),
        systemFree: os.freemem() / (1024 * 1024)
      };
      
      memoryUsage.current = { ...memoryUsage.start };
      memoryUsage.peak = { ...memoryUsage.start };
      
      // Start monitoring
      intervalId = setInterval(() => {
        const currentUsage = process.memoryUsage();
        const current = {
          rss: currentUsage.rss / (1024 * 1024),
          heapTotal: currentUsage.heapTotal / (1024 * 1024),
          heapUsed: currentUsage.heapUsed / (1024 * 1024),
          external: currentUsage.external / (1024 * 1024),
          systemFree: os.freemem() / (1024 * 1024)
        };
        
        // Update current
        memoryUsage.current = current;
        
        // Update peak values
        memoryUsage.peak = {
          rss: Math.max(memoryUsage.peak.rss, current.rss),
          heapTotal: Math.max(memoryUsage.peak.heapTotal, current.heapTotal),
          heapUsed: Math.max(memoryUsage.peak.heapUsed, current.heapUsed),
          external: Math.max(memoryUsage.peak.external, current.external),
          systemFree: Math.min(memoryUsage.peak.systemFree, current.systemFree)
        };
        
        // Trigger garbage collection if heap usage is high
        if (current.heapUsed > current.heapTotal * 0.85 && global.gc) {
          console.log('Triggering garbage collection');
          global.gc();
        }
        
        if (onUpdate) {
          onUpdate(memoryUsage);
        }
      }, 1000);
    },
    
    stopMonitoring: () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      return memoryUsage;
    },
    
    getMemoryUsage: () => {
      return memoryUsage;
    }
  };
}

module.exports = {
  detectSystem,
  monitorMemory
};