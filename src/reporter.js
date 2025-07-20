import { logger } from './utils/logger.js';
import { FileStorage } from './utils/storage.js';

export class Reporter {
  constructor() {
    this.storage = new FileStorage();
  }

  async generateReport(analysis, type = 'daily') {
    if (!analysis) {
      logger.error('No analysis data provided for report');
      return null;
    }

    const report = {
      type: type,
      generatedAt: new Date().toISOString(),
      period: analysis.period,
      summary: this.generateSummary(analysis),
      details: this.generateDetails(analysis),
      trends: this.generateTrends(analysis),
      recommendations: this.generateRecommendations(analysis),
      html: this.generateHTML(analysis)
    };

    // Save report
    await this.storage.saveReport(report, type);
    
    // Also print to console
    this.printToConsole(report);
    
    return report;
  }

  generateSummary(analysis) {
    const { summary } = analysis;
    
    return {
      headline: this.generateHeadline(summary),
      keyMetrics: {
        totalRewards: summary.totalRewards,
        exchangeFlow: summary.exchangeFlow,
        sellPressure: summary.sellPressurePercent,
        quickSellers: summary.quickSellers,
        holders: summary.holders,
        averageTimeToExchange: summary.averageTimeToExchange
      },
      trend: this.determineTrend(analysis),
      alerts: analysis.details.suspiciousPatterns || []
    };
  }

  generateHeadline(summary) {
    if (summary.sellPressurePercent > 40) {
      return `⚠️ HIGH SELL PRESSURE: ${summary.sellPressurePercent.toFixed(1)}% of rewards sent to exchanges`;
    } else if (summary.sellPressurePercent < 20) {
      return `✅ LOW SELL PRESSURE: Only ${summary.sellPressurePercent.toFixed(1)}% of rewards sent to exchanges`;
    } else {
      return `📊 NORMAL ACTIVITY: ${summary.sellPressurePercent.toFixed(1)}% sell pressure detected`;
    }
  }

  determineTrend(analysis) {
    // In production, this would compare with historical data
    const pressure = analysis.summary.sellPressurePercent;
    
    if (pressure > 35) {
      return { direction: 'increasing', sentiment: 'negative', icon: '📈' };
    } else if (pressure < 25) {
      return { direction: 'decreasing', sentiment: 'positive', icon: '📉' };
    } else {
      return { direction: 'stable', sentiment: 'neutral', icon: '➡️' };
    }
  }

  generateDetails(analysis) {
    return {
      topSellers: analysis.details.topSellers.map(seller => ({
        ...seller,
        percentOfTotal: ((seller.amount / analysis.summary.exchangeFlow) * 100).toFixed(1)
      })),
      topHolders: analysis.details.topHolders,
      exchangeBreakdown: this.generateExchangeBreakdown(analysis),
      hourlyActivity: this.generateHourlyActivity(analysis)
    };
  }

  generateExchangeBreakdown(analysis) {
    const breakdown = {};
    const exchangeTotals = {};
    
    // Aggregate by exchange
    for (const [address, flows] of analysis.details.exchangeFlowsByAddress) {
      for (const flow of flows.flows) {
        const exchange = flow.exchange.name;
        if (!exchangeTotals[exchange]) {
          exchangeTotals[exchange] = { deposits: 0, count: 0 };
        }
        exchangeTotals[exchange].deposits += flow.amount;
        exchangeTotals[exchange].count++;
      }
    }
    
    // Calculate percentages
    for (const [exchange, data] of Object.entries(exchangeTotals)) {
      breakdown[exchange] = {
        ...data,
        percentage: ((data.deposits / analysis.summary.exchangeFlow) * 100).toFixed(1)
      };
    }
    
    return breakdown;
  }

  generateHourlyActivity(analysis) {
    const hours = [];
    
    for (let h = 0; h < 24; h++) {
      hours.push({
        hour: h,
        rewards: analysis.trends.hourlyRewards[h] || 0,
        exchangeFlow: analysis.trends.hourlyExchangeFlows[h] || 0,
        sellPressure: analysis.trends.cumulativeSellPressure[h]?.pressure || 0
      });
    }
    
    return hours;
  }

  generateTrends(analysis) {
    // Find peak activity hours
    const peakRewardHour = Object.entries(analysis.trends.hourlyRewards)
      .sort(([,a], [,b]) => b - a)[0];
    
    const peakExchangeHour = Object.entries(analysis.trends.hourlyExchangeFlows)
      .sort(([,a], [,b]) => b - a)[0];
    
    return {
      peakRewardHour: peakRewardHour ? parseInt(peakRewardHour[0]) : null,
      peakExchangeHour: peakExchangeHour ? parseInt(peakExchangeHour[0]) : null,
      sellPressureProgression: analysis.trends.cumulativeSellPressure
    };
  }

  generateRecommendations(analysis) {
    const recommendations = [];
    const { summary } = analysis;
    
    if (summary.sellPressurePercent > 40) {
      recommendations.push({
        type: 'warning',
        message: 'High sell pressure detected. Consider monitoring for potential price impact.',
        action: 'Track exchange order books for large sell walls'
      });
    }
    
    if (summary.quickSellers > 20) {
      recommendations.push({
        type: 'info',
        message: `${summary.quickSellers} addresses are immediately selling rewards`,
        action: 'Investigate if these are automated selling bots'
      });
    }
    
    if (analysis.details.suspiciousPatterns.length > 0) {
      recommendations.push({
        type: 'alert',
        message: `${analysis.details.suspiciousPatterns.length} suspicious patterns detected`,
        action: 'Review pattern details for potential market manipulation'
      });
    }
    
    return recommendations;
  }

  generateHTML(analysis) {
    // Generate a simple HTML report
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Polkadot Inflation Analysis - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #E6007A; }
    h2 { color: #333; margin-top: 30px; }
    .metric { display: inline-block; margin: 10px 20px; padding: 15px; background: #f9f9f9; border-radius: 5px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #E6007A; }
    .metric-label { color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; }
    .alert { padding: 15px; margin: 10px 0; border-radius: 5px; }
    .alert-warning { background: #fff3cd; border: 1px solid #ffeaa7; }
    .alert-info { background: #d1ecf1; border: 1px solid #bee5eb; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Polkadot Inflation Analysis Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    
    <h2>Summary</h2>
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">${analysis.summary.totalRewards.toLocaleString()} DOT</div>
        <div class="metric-label">Total Rewards (24h)</div>
      </div>
      <div class="metric">
        <div class="metric-value">${analysis.summary.exchangeFlow.toLocaleString()} DOT</div>
        <div class="metric-label">Sent to Exchanges</div>
      </div>
      <div class="metric">
        <div class="metric-value">${analysis.summary.sellPressurePercent.toFixed(1)}%</div>
        <div class="metric-label">Sell Pressure</div>
      </div>
      <div class="metric">
        <div class="metric-value">${analysis.summary.quickSellers}</div>
        <div class="metric-label">Quick Sellers</div>
      </div>
    </div>
    
    ${this.generateAlertsHTML(analysis.details.suspiciousPatterns)}
    
    <h2>Top Sellers</h2>
    ${this.generateTableHTML(analysis.details.topSellers, ['address', 'amount', 'quickSell'])}
    
    <h2>Top Holders</h2>
    ${this.generateTableHTML(analysis.details.topHolders, ['address', 'rewards'])}
  </div>
</body>
</html>
    `;
  }

  generateAlertsHTML(patterns) {
    if (!patterns || patterns.length === 0) return '';
    
    return `
    <h2>Alerts</h2>
    ${patterns.map(pattern => `
      <div class="alert alert-${pattern.severity === 'high' ? 'warning' : 'info'}">
        <strong>${pattern.type}:</strong> ${pattern.description}
      </div>
    `).join('')}
    `;
  }

  generateTableHTML(data, columns) {
    if (!data || data.length === 0) return '<p>No data available</p>';
    
    const headers = columns.map(col => `<th>${col.charAt(0).toUpperCase() + col.slice(1)}</th>`).join('');
    const rows = data.slice(0, 10).map(item => 
      `<tr>${columns.map(col => `<td>${
        col === 'amount' || col === 'rewards' ? item[col].toLocaleString() + ' DOT' :
        col === 'quickSell' ? (item[col] ? '✓' : '') :
        col === 'address' ? item[col].slice(0, 8) + '...' + item[col].slice(-6) :
        item[col]
      }</td>`).join('')}</tr>`
    ).join('');
    
    return `
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    `;
  }

  printToConsole(report) {
    console.log('\n' + '═'.repeat(70));
    console.log(`                    POLKADOT INFLATION ANALYSIS`);
    console.log(`                         ${new Date().toLocaleDateString()}`);
    console.log('═'.repeat(70));
    
    console.log('\n📊 KEY METRICS:');
    console.log(`- Total Rewards: ${report.summary.keyMetrics.totalRewards.toLocaleString()} DOT`);
    console.log(`- Sent to Exchanges: ${report.summary.keyMetrics.exchangeFlow.toLocaleString()} DOT`);
    console.log(`- Sell Pressure: ${report.summary.keyMetrics.sellPressure.toFixed(1)}%`);
    console.log(`- Quick Sellers: ${report.summary.keyMetrics.quickSellers}`);
    console.log(`- Holders: ${report.summary.keyMetrics.holders}`);
    
    if (report.summary.alerts.length > 0) {
      console.log('\n🚨 ALERTS:');
      for (const alert of report.summary.alerts) {
        console.log(`- [${alert.severity.toUpperCase()}] ${alert.description}`);
      }
    }
    
    console.log('\n🏆 TOP SELLERS:');
    for (const seller of report.details.topSellers.slice(0, 5)) {
      console.log(`- ${seller.address.slice(0, 8)}...${seller.address.slice(-6)}: ${seller.amount.toLocaleString()} DOT${seller.quickSell ? ' (Quick Sell)' : ''}`);
    }
    
    console.log('\n💎 TOP HOLDERS:');
    for (const holder of report.details.topHolders.slice(0, 5)) {
      console.log(`- ${holder.address.slice(0, 8)}...${holder.address.slice(-6)}: ${holder.rewards.toLocaleString()} DOT`);
    }
    
    console.log('\n' + '═'.repeat(70));
  }
}