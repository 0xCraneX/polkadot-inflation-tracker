#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import addresses from shared-entities.json
async function importFromEntities() {
  try {
    // Read the shared-entities.json file
    const entitiesPath = '/Users/yanicksavov/Desktop/Claude/shared-entities.json';
    const content = readFileSync(entitiesPath, 'utf8');
    const entities = JSON.parse(content);
    
    // Extract Web3 Foundation addresses
    const addresses = [];
    
    if (entities.web3foundation && entities.web3foundation.addresses) {
      // Clean and process addresses
      const rawAddresses = entities.web3foundation.addresses.join('\n')
        .split('\n')
        .map(addr => addr.trim())
        .filter(addr => addr && addr.length >= 47); // Valid Polkadot addresses
      
      console.log(`Found ${rawAddresses.length} Web3 Foundation addresses`);
      
      // Take first 100 for demo
      const demoAddresses = rawAddresses.slice(0, 100);
      
      for (const address of demoAddresses) {
        addresses.push({
          address: address,
          totalRewards: 0,
          rewardCount: 0,
          lastRewardBlock: 0,
          identity: 'Web3 Foundation',
          source: 'shared-entities.json'
        });
      }
    }
    
    // Save to our format
    const outputPath = join(__dirname, '../data/receivers/top-receivers.json');
    const outputData = {
      timestamp: new Date().toISOString(),
      source: 'shared-entities.json',
      count: addresses.length,
      receivers: addresses
    };
    
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\nImported ${addresses.length} addresses`);
    console.log(`Saved to: ${outputPath}`);
    
    // Show sample
    console.log('\nSample addresses:');
    for (let i = 0; i < Math.min(5, addresses.length); i++) {
      console.log(`  ${i + 1}. ${addresses[i].address}`);
    }
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importFromEntities();