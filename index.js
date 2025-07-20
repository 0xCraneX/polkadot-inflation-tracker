#!/usr/bin/env node

import { config } from 'dotenv';
import { logger } from './src/utils/logger.js';

config();

// ASCII Art Banner
const banner = `
██████╗  ██████╗ ████████╗    ██╗███╗   ██╗███████╗██╗      █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
██╔══██╗██╔═══██╗╚══██╔══╝    ██║████╗  ██║██╔════╝██║     ██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
██║  ██║██║   ██║   ██║       ██║██╔██╗ ██║█████╗  ██║     ███████║   ██║   ██║██║   ██║██╔██╗ ██║
██║  ██║██║   ██║   ██║       ██║██║╚██╗██║██╔══╝  ██║     ██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
██████╔╝╚██████╔╝   ██║       ██║██║ ╚████║██║     ███████╗██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
╚═════╝  ╚═════╝    ╚═╝       ╚═╝╚═╝  ╚═══╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
                                    Tracking Polkadot Network Inflation
`;

function printHelp() {
  console.log(banner);
  console.log('Usage: node index.js [command] [options]\n');
  console.log('Commands:');
  console.log('  track              Start tracking inflation and token flows');
  console.log('  analyze            Run analysis on collected data');
  console.log('  report             Generate a report from latest data');
  console.log('  fetch-receivers    Fetch and save top reward receivers');
  console.log('  help               Show this help message\n');
  console.log('Options:');
  console.log('  --hours <n>        Number of hours to analyze (default: 24)');
  console.log('  --limit <n>        Number of top receivers to track (default: 1000)');
  console.log('\nExamples:');
  console.log('  node index.js track');
  console.log('  node index.js analyze --hours 48');
  console.log('  node index.js fetch-receivers --limit 500');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  // Parse options
  const options = {};
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      options[key] = args[i + 1] || true;
    }
  }
  
  switch (command) {
    case 'track':
      console.log(banner);
      logger.info('Starting inflation tracker...');
      await import('./src/tracker.js');
      break;
      
    case 'analyze':
      logger.info('Running analysis...');
      const { FlowAnalyzer } = await import('./src/analyzers/flowAnalyzer.js');
      const { FileStorage } = await import('./src/utils/storage.js');
      
      const analyzer = new FlowAnalyzer();
      const storage = new FileStorage();
      
      // Load latest data
      const analysis = await storage.loadLatestAnalysis();
      if (analysis) {
        logger.info('Analysis loaded successfully');
        console.log(JSON.stringify(analysis.summary, null, 2));
      } else {
        logger.error('No analysis data found. Run tracker first.');
      }
      break;
      
    case 'report':
      logger.info('Generating report...');
      const { Reporter } = await import('./src/reporter.js');
      const { FileStorage: Storage } = await import('./src/utils/storage.js');
      
      const reporter = new Reporter();
      const store = new Storage();
      
      const latestAnalysis = await store.loadLatestAnalysis();
      if (latestAnalysis) {
        await reporter.generateReport(latestAnalysis);
      } else {
        logger.error('No analysis data found. Run tracker first.');
      }
      break;
      
    case 'fetch-receivers':
      logger.info('Fetching top reward receivers...');
      const { RewardCollector } = await import('./src/collectors/rewardCollector.js');
      const { FileStorage: FileStore } = await import('./src/utils/storage.js');
      
      const collector = new RewardCollector();
      const fileStore = new FileStore();
      
      const limit = parseInt(options.limit || '1000');
      const receivers = await collector.fetchTopRewardReceivers(limit);
      await fileStore.saveTopReceivers(receivers);
      
      logger.success(`Saved ${receivers.length} top reward receivers`);
      break;
      
    case 'help':
    default:
      printHelp();
      break;
  }
}

// Run main function
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  logger.info('\nShutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection:', error);
  process.exit(1);
});