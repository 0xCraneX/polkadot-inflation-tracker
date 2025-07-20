import axios from 'axios';
import Bottleneck from 'bottleneck';
import { logger } from '../utils/logger.js';

export class RewardCollector {
  constructor() {
    this.subscanAPI = 'https://polkadot.api.subscan.io';
    this.apiKey = process.env.SUBSCAN_API_KEY;
    
    // Rate limiter: 5 requests per second
    this.limiter = new Bottleneck({
      minTime: 200,
      maxConcurrent: 5
    });
  }

  async makeRequest(endpoint, data = {}) {
    return this.limiter.schedule(async () => {
      try {
        const response = await axios.post(
          `${this.subscanAPI}${endpoint}`,
          data,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey
            },
            timeout: 30000
          }
        );
        
        if (response.data.code !== 0) {
          throw new Error(`Subscan API error: ${response.data.message}`);
        }
        
        return response.data.data;
      } catch (error) {
        logger.error(`API request failed: ${endpoint}`, error.message);
        throw error;
      }
    });
  }

  async fetchTopRewardReceivers(limit = 1000) {
    logger.info(`Fetching top ${limit} reward receivers...`);
    
    const receivers = [];
    let page = 0;
    const rowsPerPage = 100;
    
    while (receivers.length < limit) {
      try {
        // Fetch accounts sorted by balance (as proxy for top reward receivers)
        const data = await this.makeRequest('/api/scan/accounts', {
          row: rowsPerPage,
          page: page,
          order: 'desc',
          order_field: 'balance',
          filter: 'validator' // Get validators who receive rewards
        });
        
        if (!data.list || data.list.length === 0) {
          break;
        }
        
        // Process accounts
        for (const account of data.list) {
          if (receivers.length >= limit) break;
          
          receivers.push({
            address: account.address,
            totalRewards: 0, // Will fetch actual rewards later
            rewardCount: 0,
            lastRewardBlock: 0,
            identity: account.account_display?.display || account.display?.display || null,
            balance: parseFloat(account.balance || 0)
          });
        }
        
        page++;
        logger.info(`Fetched ${receivers.length} receivers...`);
        
        // Respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(`Error fetching reward receivers page ${page}:`, error);
        break;
      }
    }
    
    logger.info(`Collected ${receivers.length} top reward receivers`);
    return receivers;
  }

  async fetchRecentRewards(addresses, hours = 24) {
    logger.info(`Fetching rewards from last ${hours} hours for ${addresses.length} addresses`);
    
    const rewards = [];
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (hours * 3600);
    
    // Process in smaller batches due to rate limits
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      for (const receiver of batch) {
        try {
          // Use the correct API endpoint for rewards
          const data = await this.makeRequest('/api/scan/account/reward_slash', {
            address: receiver.address,
            row: 20,
            page: 0
          });
          
          if (data && data.list) {
            for (const reward of data.list) {
              // Only include rewards from our time window
              const rewardTimestamp = parseInt(reward.block_timestamp || 0);
              if (rewardTimestamp >= startTime && rewardTimestamp <= endTime) {
                rewards.push({
                  address: receiver.address,
                  amount: parseFloat(reward.amount || 0) / 1e10, // Convert to DOT
                  blockNumber: parseInt(reward.block_num || 0),
                  timestamp: rewardTimestamp,
                  extrinsicHash: reward.extrinsic_hash,
                  eventId: reward.event_id,
                  type: 'staking_reward'
                });
              }
            }
          }
        } catch (error) {
          // Silently continue for addresses without rewards
          logger.debug(`No rewards for ${receiver.address}: ${error.message}`);
        }
        
        // Respect rate limit between requests
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      
      // Progress update
      logger.info(`Processed ${Math.min(i + batchSize, addresses.length)}/${addresses.length} addresses`);
    }
    
    logger.info(`Collected ${rewards.length} reward events`);
    return rewards;
  }

  async fetchAccountDetails(addresses) {
    logger.info(`Fetching account details for ${addresses.length} addresses`);
    
    const details = [];
    const batchSize = 20;
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (address) => {
        try {
          const data = await this.makeRequest('/api/v2/scan/search', {
            key: address,
            row: 1,
            page: 0
          });
          
          if (data.account) {
            details.push({
              address: address,
              balance: parseFloat(data.account.balance || 0),
              locked: parseFloat(data.account.balance_lock || 0),
              reserved: parseFloat(data.account.reserved || 0),
              identity: data.account.display?.display || null,
              isValidator: data.account.is_validator || false,
              isNominator: data.account.is_nominator || false
            });
          }
        } catch (error) {
          logger.error(`Error fetching details for ${address}:`, error.message);
        }
      }));
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return details;
  }
}