import { config } from 'dotenv';
import { RewardCollector } from './src/collectors/rewardCollector.js';
import { TransferCollector } from './src/collectors/transferCollector.js';
import { FlowAnalyzer } from './src/analyzers/flowAnalyzer.js';
import { ExchangeDetector } from './src/analyzers/exchangeDetector.js';
import { Reporter } from './src/reporter.js';
import { logger } from './src/utils/logger.js';
import { FileStorage } from './src/utils/storage.js';
import axios from 'axios';

config();

// Get top validators from Subscan
async function getTopValidators() {
  try {
    const response = await axios.post(
      'https://polkadot.api.subscan.io/api/scan/staking/validators',
      {
        row: 20,
        page: 0,
        order: 'desc',
        order_field: 'bonded_total'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.SUBSCAN_API_KEY
        }
      }
    );
    
    if (response.data.code === 0 && response.data.data?.list) {
      return response.data.data.list.map(v => ({
        address: v.controller_account_display?.address || v.controller_account,
        identity: v.controller_account_display?.display || 'Validator',
        bonded: parseFloat(v.bonded_total || 0)
      }));
    }
  } catch (error) {
    console.error('Failed to get validators:', error.message);
  }
  return [];
}

async function runLiveDemo() {
  console.log('\n🚀 POLKADOT INFLATION TRACKER - LIVE DEMO\n');
  console.log('This demo will analyze live data from the Polkadot network.\n');
  
  const rewardCollector = new RewardCollector();
  const transferCollector = new TransferCollector();
  const flowAnalyzer = new FlowAnalyzer();
  const exchangeDetector = new ExchangeDetector();
  const reporter = new Reporter();
  const storage = new FileStorage();
  
  try {
    // Step 1: Load exchange addresses
    console.log('📍 Step 1: Loading exchange addresses...');
    await exchangeDetector.loadExchangeAddresses();
    
    // Step 2: Get top validators
    console.log('\n📍 Step 2: Fetching top validators from Polkadot...');
    const validators = await getTopValidators();
    console.log(`✅ Found ${validators.length} top validators\n`);
    
    if (validators.length === 0) {
      console.log('❌ No validators found. Check API connection.');
      return;
    }
    
    // Show validators
    console.log('Top Validators:');
    validators.slice(0, 5).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.address.slice(0, 8)}...${v.address.slice(-6)} - ${v.identity}`);
    });
    
    // Save validators
    await storage.saveTopReceivers(validators);
    
    // Step 3: Fetch recent rewards (last 24 hours)
    console.log('\n📍 Step 3: Fetching recent staking rewards...');
    const recentRewards = await rewardCollector.fetchRecentRewards(validators, 24);
    console.log(`✅ Found ${recentRewards.length} reward events\n`);
    
    // Show reward summary
    if (recentRewards.length > 0) {
      const totalRewards = recentRewards.reduce((sum, r) => sum + r.amount, 0);
      console.log(`Total Rewards (24h): ${totalRewards.toLocaleString()} DOT`);
      
      // Group by address
      const rewardsByAddress = {};
      recentRewards.forEach(r => {
        if (!rewardsByAddress[r.address]) {
          rewardsByAddress[r.address] = 0;
        }
        rewardsByAddress[r.address] += r.amount;
      });
      
      console.log('\nTop Reward Recipients:');
      Object.entries(rewardsByAddress)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([addr, amount], i) => {
          console.log(`  ${i + 1}. ${addr.slice(0, 8)}...${addr.slice(-6)}: ${amount.toLocaleString()} DOT`);
        });
    }
    
    // Step 4: Track transfers (simplified for demo)
    console.log('\n📍 Step 4: Tracking outgoing transfers...');
    const transfers = await transferCollector.trackTransfers(validators.slice(0, 10), 24); // Only check top 10 for demo
    console.log(`✅ Tracked ${transfers.length} transfers\n`);
    
    // Step 5: Detect exchange transfers
    console.log('📍 Step 5: Detecting transfers to exchanges...');
    const exchangeFlows = await exchangeDetector.detectExchangeTransfers(transfers);
    console.log(`✅ Detected ${exchangeFlows.length} exchange transfers\n`);
    
    // Show exchange flows
    if (exchangeFlows.length > 0) {
      console.log('Exchange Transfers Detected:');
      exchangeFlows.slice(0, 5).forEach((flow, i) => {
        console.log(`  ${i + 1}. ${flow.from.slice(0, 8)}...${flow.from.slice(-6)} → ${flow.exchange.name}: ${flow.amount.toLocaleString()} DOT`);
      });
    }
    
    // Step 6: Analyze
    console.log('\n📍 Step 6: Analyzing inflation impact...');
    const analysis = await flowAnalyzer.analyzeFlows({
      rewards: recentRewards,
      transfers: transfers,
      exchangeFlows: exchangeFlows,
      topReceivers: validators
    });
    
    // Save analysis
    await storage.saveAnalysis(analysis);
    
    // Generate report
    await reporter.generateReport(analysis);
    
    // Display summary
    console.log('\n' + '='.repeat(70));
    console.log('                    LIVE ANALYSIS COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📊 24-HOUR INFLATION SUMMARY:');
    console.log(`   Total Rewards: ${analysis.summary.totalRewards.toLocaleString()} DOT`);
    console.log(`   Sent to Exchanges: ${analysis.summary.exchangeFlow.toLocaleString()} DOT`);
    console.log(`   Sell Pressure: ${analysis.summary.sellPressurePercent.toFixed(1)}%`);
    console.log(`   Quick Sellers (<1hr): ${analysis.summary.quickSellers}`);
    console.log(`   Holders: ${analysis.summary.holders}`);
    
    if (analysis.summary.sellPressurePercent > 0) {
      console.log('\n💡 INSIGHT:');
      console.log(`   ${analysis.summary.sellPressurePercent.toFixed(1)}% of newly minted DOT is being sent to exchanges`);
      console.log(`   This represents ${analysis.summary.exchangeFlow.toLocaleString()} DOT of potential sell pressure`);
    }
    
    console.log('\n📁 Full report saved to:');
    console.log('   - data/reports/daily-*.html (view in browser)');
    console.log('   - data/analysis/latest.json');
    console.log('\n');
    
  } catch (error) {
    logger.error('Demo failed:', error);
    console.error('\n❌ Demo failed:', error.message);
  }
}

// Run the live demo
runLiveDemo().then(() => {
  console.log('Demo completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('Demo error:', error);
  process.exit(1);
});