import { config } from 'dotenv';
import cron from 'node-cron';
import { RewardCollector } from './collectors/rewardCollector.js';
import { TransferCollector } from './collectors/transferCollector.js';
import { FlowAnalyzer } from './analyzers/flowAnalyzer.js';
import { ExchangeDetector } from './analyzers/exchangeDetector.js';
import { Reporter } from './reporter.js';
import { logger } from './utils/logger.js';
import { FileStorage } from './utils/storage.js';

config();

class InflationTracker {
  constructor() {
    this.rewardCollector = new RewardCollector();
    this.transferCollector = new TransferCollector();
    this.flowAnalyzer = new FlowAnalyzer();
    this.exchangeDetector = new ExchangeDetector();
    this.reporter = new Reporter();
    this.storage = new FileStorage();
    
    this.trackingInterval = parseInt(process.env.TRACKING_INTERVAL_MINUTES || '60');
    this.reportInterval = parseInt(process.env.REPORT_INTERVAL_HOURS || '24');
  }

  async initialize() {
    logger.info('Initializing Polkadot Inflation Tracker...');
    
    // Load exchange addresses
    await this.exchangeDetector.loadExchangeAddresses();
    
    // Load or fetch top reward receivers
    const topReceivers = await this.storage.loadTopReceivers();
    if (!topReceivers || topReceivers.length === 0) {
      logger.info('Fetching top reward receivers...');
      const receivers = await this.rewardCollector.fetchTopRewardReceivers();
      await this.storage.saveTopReceivers(receivers);
    }
    
    logger.info('Initialization complete');
  }

  async runTrackingCycle() {
    try {
      logger.info('Starting tracking cycle...');
      
      // Step 1: Get top reward receivers
      const topReceivers = await this.storage.loadTopReceivers();
      logger.info(`Tracking ${topReceivers.length} top reward receivers`);
      
      // Step 2: Fetch recent rewards for these addresses
      const recentRewards = await this.rewardCollector.fetchRecentRewards(topReceivers);
      logger.info(`Found ${recentRewards.length} recent reward events`);
      
      // Step 3: Track transfers from reward addresses
      const transfers = await this.transferCollector.trackTransfers(topReceivers);
      logger.info(`Tracked ${transfers.length} transfers`);
      
      // Step 4: Detect exchange transfers
      const exchangeFlows = await this.exchangeDetector.detectExchangeTransfers(transfers);
      logger.info(`Detected ${exchangeFlows.length} exchange transfers`);
      
      // Step 5: Analyze flows
      const analysis = await this.flowAnalyzer.analyzeFlows({
        rewards: recentRewards,
        transfers: transfers,
        exchangeFlows: exchangeFlows,
        topReceivers: topReceivers
      });
      
      // Step 6: Save analysis
      await this.storage.saveAnalysis(analysis);
      
      // Log summary
      logger.info('\n' + this.formatQuickSummary(analysis));
      
    } catch (error) {
      logger.error('Error in tracking cycle:', error);
    }
  }

  formatQuickSummary(analysis) {
    const { summary } = analysis;
    return `
══════════════════════════════════════════════════
         INFLATION TRACKING SUMMARY
══════════════════════════════════════════════════
📈 24H METRICS:
- Total Rewards: ${summary.totalRewards.toLocaleString()} DOT
- Sent to Exchanges: ${summary.exchangeFlow.toLocaleString()} DOT
- Sell Pressure: ${summary.sellPressurePercent.toFixed(1)}%
- Quick Sellers: ${summary.quickSellers} addresses
- Holders: ${summary.holders} addresses
══════════════════════════════════════════════════`;
  }

  async generateReport() {
    try {
      logger.info('Generating comprehensive report...');
      const analysis = await this.storage.loadLatestAnalysis();
      await this.reporter.generateReport(analysis);
      logger.info('Report generated successfully');
    } catch (error) {
      logger.error('Error generating report:', error);
    }
  }

  start() {
    logger.info(`Starting inflation tracker...`);
    logger.info(`Tracking interval: ${this.trackingInterval} minutes`);
    logger.info(`Report interval: ${this.reportInterval} hours`);
    
    // Run initial cycle
    this.runTrackingCycle();
    
    // Schedule tracking cycles
    cron.schedule(`*/${this.trackingInterval} * * * *`, () => {
      this.runTrackingCycle();
    });
    
    // Schedule reports
    cron.schedule(`0 */${this.reportInterval} * * *`, () => {
      this.generateReport();
    });
    
    logger.info('Tracker started successfully');
  }
}

// Main execution
const tracker = new InflationTracker();

(async () => {
  try {
    await tracker.initialize();
    tracker.start();
  } catch (error) {
    logger.error('Failed to start tracker:', error);
    process.exit(1);
  }
})();

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('\nShutting down tracker...');
  process.exit(0);
});