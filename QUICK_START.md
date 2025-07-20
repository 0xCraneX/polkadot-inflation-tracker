# Quick Start Guide - Polkadot Inflation Tracker

## Prerequisites

1. **Subscan API Key**: Get a free API key from [Subscan.io](https://subscan.io)
2. **Node.js 18+**: Make sure you have Node.js installed
3. **Top Reward Receivers**: You mentioned you have the addresses

## Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/yanicksavov/Desktop/Claude/polkadot-inflation-tracker
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your Subscan API key
nano .env
# Add: SUBSCAN_API_KEY=your_actual_api_key_here
```

### 3. Import Your Top Reward Receivers

If you have your top 1k reward receivers in a file, import them:

```bash
# If you have a text file with one address per line:
node scripts/import-receivers.js /path/to/your/addresses.txt

# If you have a JSON file:
node scripts/import-receivers.js /path/to/your/addresses.json json-array

# If you have a CSV file:
node scripts/import-receivers.js /path/to/your/addresses.csv csv
```

### 4. Start Tracking

```bash
# Start the inflation tracker (runs continuously)
node index.js track
```

This will:
- Track the top 1000 reward receivers
- Monitor their transfers to exchanges
- Calculate sell pressure metrics
- Generate reports

## Alternative: One-Time Analysis

If you just want to run a single analysis:

```bash
# Fetch top receivers from Subscan (if you don't have them)
node index.js fetch-receivers --limit 1000

# Run a one-time analysis
node src/tracker.js
# Then Ctrl+C after the first cycle completes

# Generate a report
node index.js report
```

## Understanding the Output

The tracker will show you:

```
══════════════════════════════════════════════════════════════════════
                    INFLATION TRACKING SUMMARY
══════════════════════════════════════════════════════════════════════
📈 24H METRICS:
- Total Rewards: 145,238 DOT
- Sent to Exchanges: 42,156 DOT
- Sell Pressure: 29.0%
- Quick Sellers: 23 addresses
- Holders: 687 addresses
```

### Key Metrics Explained:

- **Total Rewards**: Total DOT distributed as staking rewards
- **Sent to Exchanges**: Amount moved to known exchange addresses
- **Sell Pressure**: Percentage of rewards likely being sold
- **Quick Sellers**: Addresses moving rewards to exchanges within 1 hour
- **Holders**: Addresses keeping their rewards (not sending to exchanges)

## Exchange Address Database

The tool comes with known exchange addresses for:
- Binance
- Kraken
- Coinbase
- OKX
- Huobi
- KuCoin
- Gate.io
- MEXC

To add more exchanges, edit `config/exchanges.json`.

## Reports

Reports are saved in:
- `data/reports/` - JSON and HTML reports
- `data/analysis/` - Raw analysis data
- `logs/` - Application logs

## Customization

Edit `.env` to customize:
- `TRACKING_INTERVAL_MINUTES=60` - How often to check
- `RAPID_SELL_TIME_HOURS=1` - What counts as "quick selling"
- `LARGE_FLOW_THRESHOLD_DOT=10000` - Large transfer threshold

## Troubleshooting

### No Subscan API Key
The tool won't work without a valid Subscan API key. Get one free at subscan.io.

### Rate Limiting
The tool respects Subscan's rate limits (5 req/sec). If you see rate limit errors, the tool will automatically retry.

### Missing Addresses
If you don't have the top reward receivers, use:
```bash
node index.js fetch-receivers --limit 1000
```

## Next Steps

1. Let the tracker run for at least 24 hours to build up data
2. Check `data/reports/` for generated reports
3. Use the HTML reports for presentations
4. Analyze patterns in quick sellers vs holders
5. Correlate sell pressure with DOT price movements