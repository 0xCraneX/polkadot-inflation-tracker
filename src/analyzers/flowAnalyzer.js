import { logger } from '../utils/logger.js';

export class FlowAnalyzer {
  constructor() {
    this.rapidSellThreshold = parseInt(process.env.RAPID_SELL_TIME_HOURS || '1') * 3600;
    this.largeFlowThreshold = parseFloat(process.env.LARGE_FLOW_THRESHOLD_DOT || '10000');
  }

  analyzeFlows({ rewards, transfers, exchangeFlows, topReceivers }) {
    const now = Math.floor(Date.now() / 1000);
    const analysis = {
      timestamp: now,
      period: {
        start: now - 86400, // 24 hours ago
        end: now
      },
      summary: {
        totalRewards: 0,
        totalTransfers: 0,
        exchangeFlow: 0,
        sellPressurePercent: 0,
        quickSellers: 0,
        holders: 0,
        averageTimeToExchange: 0
      },
      details: {
        rewardsByAddress: new Map(),
        transfersByAddress: new Map(),
        exchangeFlowsByAddress: new Map(),
        sellPressureByHour: {},
        topSellers: [],
        topHolders: [],
        suspiciousPatterns: []
      },
      trends: {
        hourlyRewards: {},
        hourlyExchangeFlows: {},
        cumulativeSellPressure: []
      }
    };

    // Analyze rewards
    this.analyzeRewards(rewards, analysis);
    
    // Analyze transfers
    this.analyzeTransfers(transfers, analysis);
    
    // Analyze exchange flows
    this.analyzeExchangeFlows(exchangeFlows, analysis);
    
    // Calculate sell pressure
    this.calculateSellPressure(analysis);
    
    // Identify patterns
    this.identifyPatterns(analysis, topReceivers);
    
    // Generate trends
    this.generateTrends(analysis);
    
    return analysis;
  }

  analyzeRewards(rewards, analysis) {
    for (const reward of rewards) {
      analysis.summary.totalRewards += reward.amount;
      
      // Track by address
      const addrRewards = analysis.details.rewardsByAddress.get(reward.address) || {
        total: 0,
        count: 0,
        rewards: []
      };
      addrRewards.total += reward.amount;
      addrRewards.count++;
      addrRewards.rewards.push(reward);
      analysis.details.rewardsByAddress.set(reward.address, addrRewards);
      
      // Track hourly
      const hour = new Date(reward.timestamp * 1000).getHours();
      analysis.trends.hourlyRewards[hour] = (analysis.trends.hourlyRewards[hour] || 0) + reward.amount;
    }
  }

  analyzeTransfers(transfers, analysis) {
    for (const transfer of transfers) {
      analysis.summary.totalTransfers += transfer.amount;
      
      // Track by address
      const addrTransfers = analysis.details.transfersByAddress.get(transfer.from) || {
        total: 0,
        count: 0,
        transfers: []
      };
      addrTransfers.total += transfer.amount;
      addrTransfers.count++;
      addrTransfers.transfers.push(transfer);
      analysis.details.transfersByAddress.set(transfer.from, addrTransfers);
    }
  }

  analyzeExchangeFlows(exchangeFlows, analysis) {
    const timeToExchange = [];
    
    for (const flow of exchangeFlows) {
      if (flow.type === 'deposit') {
        analysis.summary.exchangeFlow += flow.amount;
        
        // Track by address
        const addrFlows = analysis.details.exchangeFlowsByAddress.get(flow.from) || {
          total: 0,
          count: 0,
          flows: [],
          quickSell: false
        };
        addrFlows.total += flow.amount;
        addrFlows.count++;
        addrFlows.flows.push(flow);
        
        // Check if this is a quick sell
        const rewardInfo = analysis.details.rewardsByAddress.get(flow.from);
        if (rewardInfo && rewardInfo.rewards.length > 0) {
          const lastReward = rewardInfo.rewards[rewardInfo.rewards.length - 1];
          const timeDiff = flow.timestamp - lastReward.timestamp;
          
          if (timeDiff < this.rapidSellThreshold) {
            addrFlows.quickSell = true;
            analysis.summary.quickSellers++;
          }
          
          timeToExchange.push(timeDiff);
        }
        
        analysis.details.exchangeFlowsByAddress.set(flow.from, addrFlows);
        
        // Track hourly exchange flows
        const hour = new Date(flow.timestamp * 1000).getHours();
        analysis.trends.hourlyExchangeFlows[hour] = 
          (analysis.trends.hourlyExchangeFlows[hour] || 0) + flow.amount;
      }
    }
    
    // Calculate average time to exchange
    if (timeToExchange.length > 0) {
      const avgTime = timeToExchange.reduce((a, b) => a + b, 0) / timeToExchange.length;
      analysis.summary.averageTimeToExchange = avgTime / 3600; // Convert to hours
    }
  }

  calculateSellPressure(analysis) {
    if (analysis.summary.totalRewards > 0) {
      analysis.summary.sellPressurePercent = 
        (analysis.summary.exchangeFlow / analysis.summary.totalRewards) * 100;
    }
    
    // Calculate holders (addresses with rewards but no exchange activity)
    const rewardAddresses = new Set(analysis.details.rewardsByAddress.keys());
    const exchangeAddresses = new Set(analysis.details.exchangeFlowsByAddress.keys());
    
    for (const addr of rewardAddresses) {
      if (!exchangeAddresses.has(addr)) {
        analysis.summary.holders++;
      }
    }
    
    // Identify top sellers
    const sellers = Array.from(analysis.details.exchangeFlowsByAddress.entries())
      .map(([address, data]) => ({
        address,
        amount: data.total,
        count: data.count,
        quickSell: data.quickSell
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
    
    analysis.details.topSellers = sellers;
    
    // Identify top holders
    const holders = Array.from(analysis.details.rewardsByAddress.entries())
      .filter(([addr]) => !exchangeAddresses.has(addr))
      .map(([address, data]) => ({
        address,
        rewards: data.total,
        count: data.count
      }))
      .sort((a, b) => b.rewards - a.rewards)
      .slice(0, 10);
    
    analysis.details.topHolders = holders;
  }

  identifyPatterns(analysis, topReceivers) {
    const patterns = [];
    
    // Pattern 1: Coordinated selling (multiple large sellers in same time window)
    const largeSellersByHour = {};
    for (const [address, flows] of analysis.details.exchangeFlowsByAddress) {
      for (const flow of flows.flows) {
        if (flow.amount > this.largeFlowThreshold) {
          const hour = new Date(flow.timestamp * 1000).getHours();
          if (!largeSellersByHour[hour]) {
            largeSellersByHour[hour] = [];
          }
          largeSellersByHour[hour].push({
            address,
            amount: flow.amount,
            exchange: flow.exchange.name
          });
        }
      }
    }
    
    for (const [hour, sellers] of Object.entries(largeSellersByHour)) {
      if (sellers.length >= 3) {
        patterns.push({
          type: 'coordinated_selling',
          severity: 'high',
          description: `${sellers.length} large sellers moved ${sellers.reduce((sum, s) => sum + s.amount, 0).toLocaleString()} DOT to exchanges in hour ${hour}`,
          details: sellers
        });
      }
    }
    
    // Pattern 2: Unusual sell pressure spike
    if (analysis.summary.sellPressurePercent > 50) {
      patterns.push({
        type: 'high_sell_pressure',
        severity: 'medium',
        description: `Sell pressure at ${analysis.summary.sellPressurePercent.toFixed(1)}% - significantly above normal`,
        details: {
          totalRewards: analysis.summary.totalRewards,
          exchangeFlow: analysis.summary.exchangeFlow
        }
      });
    }
    
    // Pattern 3: Rapid selling by multiple addresses
    if (analysis.summary.quickSellers > 10) {
      patterns.push({
        type: 'rapid_selling',
        severity: 'medium',
        description: `${analysis.summary.quickSellers} addresses moved rewards to exchanges within 1 hour`,
        details: {
          quickSellers: analysis.summary.quickSellers,
          averageTimeToExchange: analysis.summary.averageTimeToExchange
        }
      });
    }
    
    analysis.details.suspiciousPatterns = patterns;
  }

  generateTrends(analysis) {
    // Calculate cumulative sell pressure over 24 hours
    const hours = Array.from({ length: 24 }, (_, i) => i);
    let cumulativeRewards = 0;
    let cumulativeExchange = 0;
    
    for (const hour of hours) {
      cumulativeRewards += analysis.trends.hourlyRewards[hour] || 0;
      cumulativeExchange += analysis.trends.hourlyExchangeFlows[hour] || 0;
      
      analysis.trends.cumulativeSellPressure.push({
        hour,
        rewards: cumulativeRewards,
        exchange: cumulativeExchange,
        pressure: cumulativeRewards > 0 ? (cumulativeExchange / cumulativeRewards) * 100 : 0
      });
    }
  }
}