import axios from 'axios';
import Bottleneck from 'bottleneck';
import { logger } from '../utils/logger.js';

export class TransferCollector {
  constructor() {
    this.subscanAPI = 'https://polkadot.api.subscan.io';
    this.apiKey = process.env.SUBSCAN_API_KEY;
    
    // Rate limiter
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

  async trackTransfers(addresses, hours = 24) {
    logger.info(`Tracking transfers for ${addresses.length} addresses over ${hours} hours`);
    
    const allTransfers = [];
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (hours * 3600);
    
    // Process in batches
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (receiver) => {
        try {
          // Fetch outgoing transfers
          const transfers = await this.fetchTransfersForAddress(
            receiver.address, 
            startTime, 
            endTime
          );
          
          allTransfers.push(...transfers);
        } catch (error) {
          logger.error(`Error tracking transfers for ${receiver.address}:`, error.message);
        }
      }));
      
      logger.info(`Processed ${Math.min(i + batchSize, addresses.length)}/${addresses.length} addresses`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.info(`Collected ${allTransfers.length} transfers`);
    return allTransfers;
  }

  async fetchTransfersForAddress(address, startTime, endTime) {
    const transfers = [];
    let page = 0;
    const rowsPerPage = 100;
    
    while (true) {
      try {
        const data = await this.makeRequest('/api/scan/transfers', {
          address: address,
          row: rowsPerPage,
          page: page,
          from_block_timestamp: startTime,
          to_block_timestamp: endTime,
          direction: 'from'  // Outgoing transfers
        });
        
        if (!data.transfers || data.transfers.length === 0) {
          break;
        }
        
        // Process transfers
        for (const transfer of data.transfers) {
          transfers.push({
            from: transfer.from,
            to: transfer.to,
            amount: parseFloat(transfer.amount || 0),
            timestamp: parseInt(transfer.block_timestamp || 0),
            blockNumber: parseInt(transfer.block_num || 0),
            extrinsicHash: transfer.extrinsic_hash,
            success: transfer.success,
            fee: parseFloat(transfer.fee || 0),
            // Add metadata
            fromIdentity: transfer.from_account_display?.display || null,
            toIdentity: transfer.to_account_display?.display || null
          });
        }
        
        // Check if we have all transfers
        if (data.transfers.length < rowsPerPage) {
          break;
        }
        
        page++;
      } catch (error) {
        logger.error(`Error fetching transfers for ${address} page ${page}:`, error.message);
        break;
      }
    }
    
    return transfers;
  }

  async fetchTransfersBetweenAddresses(fromAddresses, toAddresses, hours = 24) {
    logger.info(`Fetching transfers between ${fromAddresses.length} sources and ${toAddresses.length} destinations`);
    
    const transfers = [];
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (hours * 3600);
    
    // Create a Set for faster lookup
    const toAddressSet = new Set(toAddresses);
    
    // Fetch all transfers from source addresses
    const allTransfers = await this.trackTransfers(fromAddresses, hours);
    
    // Filter for transfers to our target addresses
    for (const transfer of allTransfers) {
      if (toAddressSet.has(transfer.to)) {
        transfers.push(transfer);
      }
    }
    
    logger.info(`Found ${transfers.length} transfers to target addresses`);
    return transfers;
  }

  async getTransferHistory(address, days = 30) {
    logger.info(`Fetching ${days} days of transfer history for ${address}`);
    
    const transfers = [];
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (days * 24 * 3600);
    
    // Fetch both incoming and outgoing transfers
    const [incoming, outgoing] = await Promise.all([
      this.fetchTransfersForAddress(address, startTime, endTime),
      this.fetchIncomingTransfers(address, startTime, endTime)
    ]);
    
    // Combine and sort by timestamp
    transfers.push(...incoming.map(t => ({ ...t, direction: 'out' })));
    transfers.push(...outgoing.map(t => ({ ...t, direction: 'in' })));
    
    transfers.sort((a, b) => b.timestamp - a.timestamp);
    
    return transfers;
  }

  async fetchIncomingTransfers(address, startTime, endTime) {
    const transfers = [];
    let page = 0;
    const rowsPerPage = 100;
    
    while (true) {
      try {
        const data = await this.makeRequest('/api/scan/transfers', {
          address: address,
          row: rowsPerPage,
          page: page,
          from_block_timestamp: startTime,
          to_block_timestamp: endTime,
          direction: 'to'  // Incoming transfers
        });
        
        if (!data.transfers || data.transfers.length === 0) {
          break;
        }
        
        // Process transfers
        for (const transfer of data.transfers) {
          transfers.push({
            from: transfer.from,
            to: transfer.to,
            amount: parseFloat(transfer.amount || 0),
            timestamp: parseInt(transfer.block_timestamp || 0),
            blockNumber: parseInt(transfer.block_num || 0),
            extrinsicHash: transfer.extrinsic_hash,
            success: transfer.success,
            fee: parseFloat(transfer.fee || 0),
            fromIdentity: transfer.from_account_display?.display || null,
            toIdentity: transfer.to_account_display?.display || null
          });
        }
        
        if (data.transfers.length < rowsPerPage) {
          break;
        }
        
        page++;
      } catch (error) {
        logger.error(`Error fetching incoming transfers for ${address}:`, error.message);
        break;
      }
    }
    
    return transfers;
  }
}