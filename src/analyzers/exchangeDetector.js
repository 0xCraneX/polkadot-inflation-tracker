import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class ExchangeDetector {
  constructor() {
    this.exchangeAddresses = new Map();
    this.exchangeByAddress = new Map();
  }

  async loadExchangeAddresses() {
    try {
      const configPath = join(__dirname, '../../config/exchanges.json');
      const data = JSON.parse(readFileSync(configPath, 'utf8'));
      
      // Build address lookup maps
      for (const [exchangeId, exchangeData] of Object.entries(data)) {
        this.exchangeAddresses.set(exchangeId, {
          name: exchangeData.name,
          type: exchangeData.type,
          addresses: exchangeData.addresses,
          note: exchangeData.note
        });
        
        // Map each address to its exchange
        for (const address of exchangeData.addresses) {
          this.exchangeByAddress.set(address, {
            id: exchangeId,
            name: exchangeData.name,
            type: exchangeData.type
          });
        }
      }
      
      logger.info(`Loaded ${this.exchangeByAddress.size} exchange addresses from ${this.exchangeAddresses.size} exchanges`);
    } catch (error) {
      logger.error('Failed to load exchange addresses:', error);
      throw error;
    }
  }

  isExchangeAddress(address) {
    return this.exchangeByAddress.has(address);
  }

  getExchangeInfo(address) {
    return this.exchangeByAddress.get(address) || null;
  }

  detectExchangeTransfers(transfers) {
    const exchangeTransfers = [];
    
    for (const transfer of transfers) {
      const toExchange = this.getExchangeInfo(transfer.to);
      const fromExchange = this.getExchangeInfo(transfer.from);
      
      if (toExchange) {
        exchangeTransfers.push({
          ...transfer,
          type: 'deposit',
          exchange: toExchange,
          exchangeAddress: transfer.to
        });
      }
      
      if (fromExchange) {
        exchangeTransfers.push({
          ...transfer,
          type: 'withdrawal',
          exchange: fromExchange,
          exchangeAddress: transfer.from
        });
      }
    }
    
    logger.info(`Detected ${exchangeTransfers.length} exchange transfers`);
    return exchangeTransfers;
  }

  analyzeExchangeFlows(transfers) {
    const analysis = {
      totalDeposits: 0,
      totalWithdrawals: 0,
      depositCount: 0,
      withdrawalCount: 0,
      byExchange: {},
      largestDeposits: [],
      largestWithdrawals: [],
      netFlow: 0
    };
    
    // Process each transfer
    for (const transfer of transfers) {
      const exchangeName = transfer.exchange.name;
      
      // Initialize exchange stats if needed
      if (!analysis.byExchange[exchangeName]) {
        analysis.byExchange[exchangeName] = {
          deposits: 0,
          withdrawals: 0,
          depositCount: 0,
          withdrawalCount: 0,
          netFlow: 0,
          type: transfer.exchange.type
        };
      }
      
      const exchangeStats = analysis.byExchange[exchangeName];
      
      if (transfer.type === 'deposit') {
        analysis.totalDeposits += transfer.amount;
        analysis.depositCount++;
        exchangeStats.deposits += transfer.amount;
        exchangeStats.depositCount++;
        
        // Track largest deposits
        analysis.largestDeposits.push({
          amount: transfer.amount,
          from: transfer.from,
          to: transfer.to,
          exchange: exchangeName,
          timestamp: transfer.timestamp
        });
      } else if (transfer.type === 'withdrawal') {
        analysis.totalWithdrawals += transfer.amount;
        analysis.withdrawalCount++;
        exchangeStats.withdrawals += transfer.amount;
        exchangeStats.withdrawalCount++;
        
        // Track largest withdrawals
        analysis.largestWithdrawals.push({
          amount: transfer.amount,
          from: transfer.from,
          to: transfer.to,
          exchange: exchangeName,
          timestamp: transfer.timestamp
        });
      }
      
      exchangeStats.netFlow = exchangeStats.deposits - exchangeStats.withdrawals;
    }
    
    // Calculate net flow
    analysis.netFlow = analysis.totalDeposits - analysis.totalWithdrawals;
    
    // Sort and limit largest transfers
    analysis.largestDeposits.sort((a, b) => b.amount - a.amount);
    analysis.largestWithdrawals.sort((a, b) => b.amount - a.amount);
    analysis.largestDeposits = analysis.largestDeposits.slice(0, 10);
    analysis.largestWithdrawals = analysis.largestWithdrawals.slice(0, 10);
    
    return analysis;
  }

  categorizeAddresses(addresses, transfers) {
    const categories = {
      quickSellers: [],      // Move to exchange <1hr after reward
      regularSellers: [],    // Move to exchange 1hr-24hr
      delayedSellers: [],    // Move to exchange 1-7 days
      holders: [],           // No exchange activity in 7+ days
      exchangeAccounts: []   // Addresses that are exchanges
    };
    
    const addressMap = new Map();
    
    // Initialize address map
    for (const addr of addresses) {
      addressMap.set(addr.address, {
        ...addr,
        exchangeTransfers: [],
        quickestTransfer: null,
        isExchange: this.isExchangeAddress(addr.address)
      });
    }
    
    // Map transfers to addresses
    for (const transfer of transfers) {
      if (transfer.type === 'deposit') {
        const addrInfo = addressMap.get(transfer.from);
        if (addrInfo) {
          addrInfo.exchangeTransfers.push(transfer);
        }
      }
    }
    
    // Categorize each address
    for (const [address, info] of addressMap) {
      if (info.isExchange) {
        categories.exchangeAccounts.push(info);
        continue;
      }
      
      if (info.exchangeTransfers.length === 0) {
        categories.holders.push(info);
      } else {
        // Find quickest transfer to exchange after reward
        // This is simplified - in production you'd match rewards to transfers
        const quickestTime = Math.min(...info.exchangeTransfers.map(t => t.timestamp));
        const timeDiff = quickestTime - info.lastRewardBlock; // Simplified
        
        if (timeDiff < 3600) { // Less than 1 hour
          categories.quickSellers.push(info);
        } else if (timeDiff < 86400) { // Less than 24 hours
          categories.regularSellers.push(info);
        } else if (timeDiff < 604800) { // Less than 7 days
          categories.delayedSellers.push(info);
        } else {
          categories.holders.push(info);
        }
      }
    }
    
    return categories;
  }

  getAllExchangeAddresses() {
    const addresses = [];
    for (const [address, info] of this.exchangeByAddress) {
      addresses.push({
        address,
        exchange: info.name,
        type: info.type
      });
    }
    return addresses;
  }
}