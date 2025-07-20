# Polkadot Inflation Tracker 📊

A specialized tool for tracking Polkadot network inflation distribution and identifying how much newly minted DOT is being sold on exchanges.

## 🎯 Purpose

This tool analyzes:
1. **Top 1000 staking reward receivers** on Polkadot
2. **Token flows** from these addresses to known exchanges
3. **Sell pressure metrics** to understand inflation impact on DOT price

## 📈 Key Metrics Tracked

- **Daily Inflation**: Total DOT minted through staking rewards
- **Exchange Flows**: DOT moved from reward addresses to exchanges
- **Sell Pressure %**: Percentage of new DOT likely being sold
- **Holder vs Seller Ratio**: Classification of reward receivers
- **Time-to-Exchange**: How quickly rewards are moved to exchanges

## 🏗️ Architecture

```
polkadot-inflation-tracker/
├── src/
│   ├── tracker.js          # Main tracking engine
│   ├── collectors/
│   │   ├── rewardCollector.js    # Fetch staking rewards data
│   │   └── transferCollector.js  # Track token movements
│   ├── analyzers/
│   │   ├── flowAnalyzer.js       # Analyze token flows
│   │   └── exchangeDetector.js   # Identify exchange transfers
│   ├── data/
│   │   ├── exchanges.json        # Known exchange addresses
│   │   └── topReceivers.json     # Top 1k reward receivers
│   └── reporter.js         # Generate reports
├── data/
│   ├── rewards/           # Historical reward data
│   ├── flows/             # Token flow records
│   └── reports/           # Generated analysis reports
└── config/
    └── exchanges.json     # Exchange address database
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Add your Subscan API key to .env

# Start tracking
npm start
```

## 📊 Data Sources

1. **Subscan API**: Historical reward and transfer data
2. **Polkadot RPC**: Real-time blockchain data
3. **Exchange Database**: Curated list of exchange addresses

## 🎯 Tracking Methodology

### Phase 1: Identify Reward Recipients
- Query top 1000 addresses by staking rewards received
- Track reward frequency and amounts
- Build recipient profiles

### Phase 2: Monitor Token Flows
- Track all outgoing transfers from reward addresses
- Identify transfers to known exchange addresses
- Calculate time between reward and exchange deposit

### Phase 3: Analyze Sell Pressure
- Calculate daily/weekly/monthly sell pressure
- Identify patterns in selling behavior
- Generate actionable insights

## 📈 Reports Generated

### Daily Report
- Total rewards distributed
- Amount moved to exchanges
- Top sellers and holders
- 24h sell pressure percentage

### Weekly Report
- Trend analysis
- Behavioral patterns
- Exchange flow heatmap
- Inflation impact assessment

### Monthly Report
- Comprehensive inflation analysis
- Long-term holder vs seller ratios
- Market impact correlation
- Recommendations

## 🔧 Configuration

### Environment Variables
```env
SUBSCAN_API_KEY=your_key_here
RPC_ENDPOINT=wss://rpc.polkadot.io
TRACKING_INTERVAL_MINUTES=60
REPORT_INTERVAL_HOURS=24
```

### Exchange Address Management
Exchange addresses are maintained in `config/exchanges.json`:
```json
{
  "binance": [
    "1FxH7iDSJNGaGE3TVcUmTcqrMQFbZZGqDp9FZeNvZXZDGWW",
    "14rYejgjVgR8wnRvvXXbVsPrKCLTiXvBTcc86M3jWFh2Uo8c"
  ],
  "kraken": [
    "16GMp5BTXSxvL1K2y5c8sCHCvJ4hZ8u4MtMHpzJJQBQqNKgJ"
  ]
}
```

## 📊 Example Output

```
════════════════════════════════════════════════════════════════════════
                    POLKADOT INFLATION ANALYSIS
                         2025-01-20
════════════════════════════════════════════════════════════════════════

📈 24H INFLATION METRICS:
- Total Rewards Distributed: 145,238 DOT
- Moved to Exchanges: 42,156 DOT (29.0%)
- Held/Reinvested: 103,082 DOT (71.0%)

🔄 FLOW ANALYSIS:
- Average Time to Exchange: 4.2 hours
- Quick Sellers (<1hr): 23 addresses
- Holders (>7 days): 687 addresses

🏆 TOP SELLERS (24h):
1. 13Gj3...vFh2Q: 8,421 DOT → Binance
2. 1XmT4...8u4Mt: 5,122 DOT → Kraken
3. 16Zxk...QbZZG: 3,897 DOT → Binance

💎 TOP HOLDERS (24h):
1. 14rYe...h2Uo8: 12,543 DOT (retained)
2. 1HCGN...1jrHF: 9,231 DOT (retained)
3. 15cfS...GE6B3: 7,122 DOT (retained)

📊 TREND:
- 7-Day Average Sell Pressure: 31.2%
- 30-Day Average: 28.7%
- Trend: ↗️ INCREASING
```

## 🛠️ Development

### Adding New Exchange Addresses
1. Update `config/exchanges.json`
2. Run validation: `npm run validate-exchanges`
3. Restart tracker

### Custom Analysis
Create custom analyzers in `src/analyzers/` to track specific patterns.

## 📝 License

MIT License - See LICENSE file for details