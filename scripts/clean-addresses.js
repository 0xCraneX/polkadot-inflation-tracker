#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cleanAddress(dirtyAddress) {
  // Extract the actual address from HTML-formatted string
  // Example: "16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD target=_blank>16ZL...zzBD</a>"
  
  if (!dirtyAddress) return null;
  
  // If it contains HTML, extract the address before " target="
  if (dirtyAddress.includes('target=')) {
    const parts = dirtyAddress.split(' target=');
    if (parts[0]) {
      return parts[0].trim();
    }
  }
  
  // Return as-is if no HTML found
  return dirtyAddress.trim();
}

async function main() {
  try {
    const inputPath = join(__dirname, '../data/receivers/top-receivers.json');
    
    // Read current data
    logger.info('Reading receivers data...');
    const data = JSON.parse(readFileSync(inputPath, 'utf8'));
    
    logger.info(`Found ${data.receivers.length} receivers to clean`);
    
    // Clean addresses
    let cleanedCount = 0;
    for (const receiver of data.receivers) {
      const cleaned = cleanAddress(receiver.address);
      if (cleaned !== receiver.address) {
        receiver.address = cleaned;
        cleanedCount++;
      }
    }
    
    // Update timestamp
    data.timestamp = new Date().toISOString();
    data.cleanedAt = new Date().toISOString();
    
    // Save cleaned data
    writeFileSync(inputPath, JSON.stringify(data, null, 2));
    
    logger.success(`Cleaned ${cleanedCount} addresses`);
    logger.info(`Total receivers: ${data.receivers.length}`);
    
    // Show sample
    console.log('\nSample cleaned addresses:');
    for (const receiver of data.receivers.slice(0, 5)) {
      console.log(`  ${receiver.rank}. ${receiver.address}`);
    }
    
  } catch (error) {
    logger.error('Failed to clean addresses:', error);
    process.exit(1);
  }
}

main();