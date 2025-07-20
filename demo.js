import { config } from 'dotenv';
import { RewardCollector } from './src/collectors/rewardCollector.js';
import { TransferCollector } from './src/collectors/transferCollector.js';
import { FlowAnalyzer } from './src/analyzers/flowAnalyzer.js';
import { ExchangeDetector } from './src/analyzers/exchangeDetector.js';
import { Reporter } from './src/reporter.js';
import { logger } from './src/utils/logger.js';
import { FileStorage } from './src/utils/storage.js';

config();

// Demo with known validator addresses that receive rewards
const DEMO_ADDRESSES = [
  // Known validators/nominators that receive rewards
  { address: '14Gn7SEmCgMX8n4AarXpJfbxWaHjwHbpU5sQqYXtUj1y5qr2', identity: 'Validator 1' },
  { address: '15cfSaBcTxNr8rV59cbhdMNCRagFr3GE6B3zZRsCp4QHHKPu', identity: 'Validator 2' },
  { address: '14ShUZUYUR35RBZW6uVVt1zXDxmSQddkeDdXf1JkMA6P721N', identity: 'Validator 3' },
  { address: '16GMp5BTXSxvL1K2y5c8sCHCvJ4hZ8u4MtMHpzJJQBQqNKgJ', identity: 'Validator 4' },
  { address: '13RBN6UF43sxkxUrd2H4QSJccvLNGr6HY4v3mN2WtW59WaNk', identity: 'Validator 5' },
  // Add some from Web3 Foundation list
  { address: '13UVJyLnbVp77Z2t6qZV4fNpRjDHppL6c7weMJobZmSPaZcn', identity: 'W3F Treasury' },
  { address: '15j4dg5GzsL1bw2U2AWgeyAk6QTxq43V7ZPbXdAmbVLjvDCK', identity: 'W3F Account' },
  { address: '14NSRugu2B7XPwcyPTFsDsBodZb72NgrhMih6ith8dSSGmfc', identity: 'W3F Validator' }
];

async function runDemo() {
  console.log('\n🚀 POLKADOT INFLATION TRACKER DEMO\n');
  console.log('This demo will analyze a small set of known addresses to demonstrate the functionality.\n');
  
  const rewardCollector = new RewardCollector();
  const transferCollector = new TransferCollector();
  const flowAnalyzer = new FlowAnalyzer();
  const exchangeDetector = new ExchangeDetector();
  const reporter = new Reporter();
  const storage = new FileStorage();
  
  try {
    // Step 1: Load exchange addresses
    console.log('📍 Step 1: Loading exchange addresses database...');
    await exchangeDetector.loadExchangeAddresses();
    console.log('✅ Loaded exchange addresses\n');
    
    // Step 2: Save demo addresses
    console.log('📍 Step 2: Using demo addresses...');
    await storage.saveTopReceivers(DEMO_ADDRESSES);
    console.log(`✅ Using ${DEMO_ADDRESSES.length} demo addresses\n`);
    
    // Step 3: Fetch recent rewards (last 7 days for demo)
    console.log('📍 Step 3: Fetching recent rewards for demo addresses...');
    const recentRewards = await rewardCollector.fetchRecentRewards(DEMO_ADDRESSES, 168); // 7 days
    console.log(`✅ Found ${recentRewards.length} reward events\n`);
    
    // Step 4: Track transfers
    console.log('📍 Step 4: Tracking transfers from reward addresses...');
    const transfers = await transferCollector.trackTransfers(DEMO_ADDRESSES, 168); // 7 days
    console.log(`✅ Tracked ${transfers.length} transfers\n`);
    
    // Step 5: Detect exchange transfers
    console.log('📍 Step 5: Detecting transfers to exchanges...');
    const exchangeFlows = await exchangeDetector.detectExchangeTransfers(transfers);
    console.log(`✅ Detected ${exchangeFlows.length} exchange transfers\n`);
    
    // Step 6: Analyze flows
    console.log('📍 Step 6: Analyzing inflation flows...');
    const analysis = await flowAnalyzer.analyzeFlows({
      rewards: recentRewards,
      transfers: transfers,
      exchangeFlows: exchangeFlows,
      topReceivers: DEMO_ADDRESSES
    });
    
    // Step 7: Save analysis
    await storage.saveAnalysis(analysis);
    
    // Step 8: Generate report
    console.log('📍 Step 7: Generating report...\n');
    await reporter.generateReport(analysis);
    
    // Display summary
    console.log('\n' + '='.repeat(70));
    console.log('                    DEMO ANALYSIS COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📊 SUMMARY:');
    console.log(`   Total Rewards (7 days): ${analysis.summary.totalRewards.toLocaleString()} DOT`);
    console.log(`   Sent to Exchanges: ${analysis.summary.exchangeFlow.toLocaleString()} DOT`);
    console.log(`   Sell Pressure: ${analysis.summary.sellPressurePercent.toFixed(1)}%`);
    console.log(`   Quick Sellers (<1hr): ${analysis.summary.quickSellers}`);
    console.log(`   Holders: ${analysis.summary.holders}`);
    
    if (analysis.details.topSellers && analysis.details.topSellers.length > 0) {
      console.log('\n💸 TOP SELLERS:');
      for (const seller of analysis.details.topSellers.slice(0, 3)) {
        console.log(`   ${seller.address.slice(0, 8)}...${seller.address.slice(-6)}: ${seller.amount.toLocaleString()} DOT`);
      }
    }
    
    if (analysis.details.suspiciousPatterns && analysis.details.suspiciousPatterns.length > 0) {
      console.log('\n🚨 PATTERNS DETECTED:');
      for (const pattern of analysis.details.suspiciousPatterns) {
        console.log(`   [${pattern.severity.toUpperCase()}] ${pattern.description}`);
      }
    }
    
    console.log('\n📁 Reports saved to:');
    console.log('   - data/reports/daily-*.json');
    console.log('   - data/reports/daily-*.html');
    console.log('   - data/analysis/latest.json');
    console.log('\n');
    
  } catch (error) {
    logger.error('Demo failed:', error);
    console.error('\n❌ Demo failed. Check logs for details.');
  }
}

// Run the demo
runDemo().then(() => {
  console.log('Demo completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Demo error:', error);
  process.exit(1);
});