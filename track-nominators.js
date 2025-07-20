import { config } from 'dotenv';
import { RewardCollector } from './src/collectors/rewardCollector.js';
import { TransferCollector } from './src/collectors/transferCollector.js';
import { FlowAnalyzer } from './src/analyzers/flowAnalyzer.js';
import { ExchangeDetector } from './src/analyzers/exchangeDetector.js';
import { Reporter } from './src/reporter.js';
import { logger } from './src/utils/logger.js';
import { FileStorage } from './src/utils/storage.js';

config();

async function trackNominators() {
  console.log('\n🚀 TRACKING TOP 300 POLKADOT NOMINATORS\n');
  
  const rewardCollector = new RewardCollector();
  const transferCollector = new TransferCollector();
  const flowAnalyzer = new FlowAnalyzer();
  const exchangeDetector = new ExchangeDetector();
  const reporter = new Reporter();
  const storage = new FileStorage();
  
  try {
    // Step 1: Load exchange addresses
    console.log('📍 Step 1: Loading exchange address database...');
    await exchangeDetector.loadExchangeAddresses();
    
    // Step 2: Load nominators
    console.log('\n📍 Step 2: Loading top 300 nominators...');
    const nominators = await storage.loadTopReceivers();
    console.log(`✅ Loaded ${nominators.length} nominators`);
    console.log(`   Total rewards in dataset: ${nominators.reduce((sum, n) => sum + n.totalRewards, 0).toLocaleString()} DOT`);
    
    // Step 3: Fetch recent rewards (last 7 days for better data)
    console.log('\n📍 Step 3: Fetching recent rewards from blockchain...');
    console.log('   (This will take a few minutes due to rate limits...)');
    
    // Sample first 50 nominators to respect rate limits
    const sampleNominators = nominators.slice(0, 50);
    const recentRewards = await rewardCollector.fetchRecentRewards(sampleNominators, 168); // 7 days
    
    console.log(`\n✅ Found ${recentRewards.length} recent reward events`);
    
    if (recentRewards.length > 0) {
      const totalRecentRewards = recentRewards.reduce((sum, r) => sum + r.amount, 0);
      console.log(`   Total rewards (7 days): ${totalRecentRewards.toLocaleString()} DOT`);
    }
    
    // Step 4: Track transfers
    console.log('\n📍 Step 4: Tracking transfers from reward addresses...');
    console.log('   (Checking for movements to exchanges...)');
    
    const transfers = await transferCollector.trackTransfers(sampleNominators, 168);
    console.log(`\n✅ Tracked ${transfers.length} transfers`);
    
    // Step 5: Detect exchange transfers
    console.log('\n📍 Step 5: Analyzing exchange flows...');
    const exchangeFlows = await exchangeDetector.detectExchangeTransfers(transfers);
    console.log(`✅ Detected ${exchangeFlows.length} transfers to exchanges`);
    
    // Show exchange breakdown if any found
    if (exchangeFlows.length > 0) {
      const exchangeSummary = {};
      exchangeFlows.forEach(flow => {
        if (flow.type === 'deposit') {
          const exchange = flow.exchange.name;
          if (!exchangeSummary[exchange]) {
            exchangeSummary[exchange] = { count: 0, amount: 0 };
          }
          exchangeSummary[exchange].count++;
          exchangeSummary[exchange].amount += flow.amount;
        }
      });
      
      console.log('\n🎯 Exchange Deposits Detected:');
      Object.entries(exchangeSummary).forEach(([exchange, data]) => {
        console.log(`   ${exchange}: ${data.count} transfers, ${data.amount.toLocaleString()} DOT`);
      });
    }
    
    // Step 6: Analyze
    console.log('\n📍 Step 6: Calculating inflation sell pressure...');
    const analysis = await flowAnalyzer.analyzeFlows({
      rewards: recentRewards,
      transfers: transfers,
      exchangeFlows: exchangeFlows,
      topReceivers: sampleNominators
    });
    
    // Save analysis
    await storage.saveAnalysis(analysis);
    
    // Generate report
    await reporter.generateReport(analysis);
    
    // Display insights
    console.log('\n' + '='.repeat(70));
    console.log('              POLKADOT INFLATION ANALYSIS RESULTS');
    console.log('='.repeat(70));
    
    console.log('\n📈 7-DAY SUMMARY:');
    console.log(`   Nominators Analyzed: ${sampleNominators.length}`);
    console.log(`   Total Rewards: ${analysis.summary.totalRewards.toLocaleString()} DOT`);
    console.log(`   Sent to Exchanges: ${analysis.summary.exchangeFlow.toLocaleString()} DOT`);
    console.log(`   Sell Pressure: ${analysis.summary.sellPressurePercent.toFixed(1)}%`);
    
    if (analysis.summary.sellPressurePercent > 0) {
      console.log('\n💡 KEY INSIGHTS:');
      console.log(`   • ${analysis.summary.sellPressurePercent.toFixed(1)}% of staking rewards are being sent to exchanges`);
      console.log(`   • ${analysis.summary.quickSellers} addresses sell within 1 hour of receiving rewards`);
      console.log(`   • ${analysis.summary.holders} addresses are holding their rewards`);
      
      if (analysis.summary.averageTimeToExchange > 0) {
        console.log(`   • Average time to exchange: ${analysis.summary.averageTimeToExchange.toFixed(1)} hours`);
      }
    } else {
      console.log('\n💡 INSIGHT: No exchange deposits detected from these nominators');
      console.log('   This suggests they are holding or reinvesting their rewards.');
    }
    
    // Check for patterns
    if (analysis.details.suspiciousPatterns && analysis.details.suspiciousPatterns.length > 0) {
      console.log('\n🚨 PATTERNS DETECTED:');
      analysis.details.suspiciousPatterns.forEach(pattern => {
        console.log(`   [${pattern.severity.toUpperCase()}] ${pattern.description}`);
      });
    }
    
    console.log('\n📁 Full reports saved to:');
    console.log('   • data/reports/daily-*.html (open in browser for visual report)');
    console.log('   • data/analysis/latest.json (raw data)');
    console.log('\n');
    
    // Note about full analysis
    console.log('📝 Note: This was a sample of 50 nominators out of 300.');
    console.log('   For full analysis, run: node index.js track');
    console.log('   This will analyze all 300 nominators over time.');
    
  } catch (error) {
    logger.error('Tracking failed:', error);
    console.error('\n❌ Error:', error.message);
  }
}

// Run the analysis
trackNominators().then(() => {
  console.log('\nAnalysis completed!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});