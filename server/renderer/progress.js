/**
 * Progress tracking module for rendering process
 */

/**
 * Creates a new progress tracker instance
 * @param {Object} options - Progress tracker options
 * @param {string} options.jobId - Unique job ID
 * @param {Function} options.onUpdate - Callback for progress updates
 * @returns {Object} Progress tracker methods
 */
function createProgressTracker(options) {
  const { jobId, onUpdate } = options;
  
  // Progress state
  const state = {
    jobId,
    overallProgress: 0,
    phaseProgress: 0,
    currentPhase: 'initializing',
    phases: [
      { name: 'extraction', weight: 0.5, progress: 0, status: 'pending' },
      { name: 'encoding', weight: 0.5, progress: 0, status: 'pending' }
    ],
    startTime: Date.now(),
    estimatedEndTime: null,
    timeRemaining: null,
    memoryUsage: null
  };
  
  /**
   * Update progress for a specific phase
   * @param {string} phase - Phase name
   * @param {number} progress - Progress percentage (0-100)
   * @param {Object} details - Additional details
   */
  function updatePhaseProgress(phase, progress, details = {}) {
    // Find the phase
    const phaseIndex = state.phases.findIndex(p => p.name === phase);
    if (phaseIndex === -1) {
      console.warn(`Unknown phase: ${phase}`);
      return;
    }
    
    // Update phase progress
    state.phases[phaseIndex].progress = Math.min(100, Math.max(0, progress));
    state.phases[phaseIndex].status = progress >= 100 ? 'completed' : 'in-progress';
    
    // Update details
    if (details.memoryUsage) {
      state.memoryUsage = details.memoryUsage;
    }
    
    // Calculate overall progress
    let weightedProgress = 0;
    let totalWeight = 0;
    
    for (const phase of state.phases) {
      weightedProgress += phase.progress * phase.weight;
      totalWeight += phase.weight;
    }
    
    state.overallProgress = Math.round(weightedProgress / totalWeight);
    state.phaseProgress = progress;
    state.currentPhase = phase;
    
    // Calculate estimated time remaining
    const elapsedMs = Date.now() - state.startTime;
    if (state.overallProgress > 0) {
      const totalEstimatedMs = (elapsedMs / state.overallProgress) * 100;
      const remainingMs = totalEstimatedMs - elapsedMs;
      
      state.timeRemaining = remainingMs;
      state.estimatedEndTime = new Date(Date.now() + remainingMs);
    }
    
    // Call update callback
    if (onUpdate) {
      onUpdate({
        jobId,
        progress: state.overallProgress,
        phase: state.currentPhase,
        phaseProgress: state.phaseProgress,
        timeRemaining: state.timeRemaining,
        estimatedEndTime: state.estimatedEndTime,
        elapsedTime: elapsedMs,
        memoryUsage: state.memoryUsage,
        ...details
      });
    }
  }
  
  /**
   * Mark a phase as completed
   * @param {string} phase - Phase name
   */
  function completePhase(phase) {
    updatePhaseProgress(phase, 100);
  }
  
  /**
   * Start a new phase
   * @param {string} phase - Phase name
   */
  function startPhase(phase) {
    // Find the phase
    const phaseIndex = state.phases.findIndex(p => p.name === phase);
    if (phaseIndex === -1) {
      console.warn(`Unknown phase: ${phase}`);
      return;
    }
    
    // Update phase status
    state.phases[phaseIndex].status = 'in-progress';
    state.phases[phaseIndex].progress = 0;
    state.currentPhase = phase;
    
    // Call update callback
    if (onUpdate) {
      onUpdate({
        jobId,
        progress: state.overallProgress,
        phase: state.currentPhase,
        phaseProgress: 0,
        timeRemaining: state.timeRemaining,
        estimatedEndTime: state.estimatedEndTime,
        elapsedTime: Date.now() - state.startTime,
        memoryUsage: state.memoryUsage
      });
    }
  }
  
  /**
   * Complete the entire job
   * @param {Object} details - Completion details
   */
  function complete(details = {}) {
    // Mark all phases as completed
    for (const phase of state.phases) {
      phase.progress = 100;
      phase.status = 'completed';
    }
    
    state.overallProgress = 100;
    state.currentPhase = 'completed';
    
    // Call update callback
    if (onUpdate) {
      onUpdate({
        jobId,
        progress: 100,
        phase: 'completed',
        phaseProgress: 100,
        timeRemaining: 0,
        estimatedEndTime: new Date(),
        elapsedTime: Date.now() - state.startTime,
        memoryUsage: state.memoryUsage,
        ...details
      });
    }
  }
  
  /**
   * Mark the job as failed
   * @param {Error} error - Error that caused the failure
   * @param {Object} details - Additional details
   */
  function fail(error, details = {}) {
    state.currentPhase = 'failed';
    
    // Call update callback
    if (onUpdate) {
      onUpdate({
        jobId,
        progress: state.overallProgress,
        phase: 'failed',
        phaseProgress: state.phaseProgress,
        timeRemaining: 0,
        elapsedTime: Date.now() - state.startTime,
        memoryUsage: state.memoryUsage,
        error: error.message,
        ...details
      });
    }
  }
  
  /**
   * Get current progress state
   * @returns {Object} Current progress state
   */
  function getState() {
    return { ...state };
  }
  
  return {
    updatePhaseProgress,
    completePhase,
    startPhase,
    complete,
    fail,
    getState
  };
}

module.exports = {
  createProgressTracker
};