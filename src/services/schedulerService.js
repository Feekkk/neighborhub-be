const CleanupService = require('./cleanupService');

/**
 * Scheduler service to handle automatic background tasks
 */
class SchedulerService {
  constructor() {
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * Start the scheduler with automatic cleanup every 24 hours
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Scheduler is already running');
      return;
    }

    console.log('🕐 Starting NeighborHub Scheduler...');
    
    // Run cleanup immediately on startup
    this.runCleanup();
    
    // Set up automatic cleanup every 24 hours (24 * 60 * 60 * 1000 ms)
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, 24 * 60 * 60 * 1000);
    this.cleanupInterval.unref();

    this.isRunning = true;
    console.log('✅ Scheduler started successfully - cleanup will run every 24 hours');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.isRunning = false;
      console.log('🛑 Scheduler stopped');
    }
  }

  /**
   * Run the cleanup process
   */
  async runCleanup() {
    try {
      console.log('🧹 Running scheduled cleanup...');
      const result = await CleanupService.deleteOldAnnouncements();
      
      if (result.success) {
        console.log(`✅ Scheduled cleanup completed: ${result.deletedCount} announcements removed`);
      } else {
        console.error('❌ Scheduled cleanup failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Error during scheduled cleanup:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextCleanup: this.isRunning ? 'Every 24 hours' : 'Not scheduled'
    };
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

module.exports = schedulerService;
