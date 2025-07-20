#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Import reward receiver addresses from various formats
 * 
 * Supported formats:
 * 1. Plain text file with one address per line
 * 2. JSON array of addresses
 * 3. JSON object with address as key
 * 4. CSV file with address in first column
 */

function parseAddresses(content, format) {
  const addresses = [];
  
  try {
    switch (format) {
      case 'json-array':
        // ["address1", "address2", ...]
        const arr = JSON.parse(content);
        addresses.push(...arr);
        break;
        
      case 'json-object':
        // { "address1": {...}, "address2": {...} }
        const obj = JSON.parse(content);
        addresses.push(...Object.keys(obj));
        break;
        
      case 'json-detailed':
        // [{ "address": "...", "rewards": ... }, ...]
        const detailed = JSON.parse(content);
        for (const item of detailed) {
          if (item.address) {
            addresses.push(item.address);
          }
        }
        break;
        
      case 'csv':
        // address,amount,other_field
        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.split(',');
          if (parts[0] && parts[0].trim()) {
            addresses.push(parts[0].trim());
          }
        }
        break;
        
      case 'text':
      default:
        // One address per line
        const textLines = content.split('\n');
        for (const line of textLines) {
          const trimmed = line.trim();
          if (trimmed && trimmed.length > 40) { // Polkadot addresses are ~48 chars
            addresses.push(trimmed);
          }
        }
        break;
    }
  } catch (error) {
    logger.error(`Failed to parse as ${format}:`, error.message);
    return [];
  }
  
  // Filter valid Polkadot addresses
  return addresses.filter(addr => {
    // Basic validation - Polkadot addresses start with 1 and are 47-48 chars
    return addr && addr.startsWith('1') && addr.length >= 47 && addr.length <= 48;
  });
}

function detectFormat(content) {
  // Try to detect format
  const trimmed = content.trim();
  
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    // Could be JSON array
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        // Check if it's array of strings or objects
        if (parsed.length > 0 && typeof parsed[0] === 'string') {
          return 'json-array';
        } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
          return 'json-detailed';
        }
      }
    } catch {}
  }
  
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    // JSON object
    return 'json-object';
  }
  
  if (trimmed.includes(',')) {
    // Likely CSV
    return 'csv';
  }
  
  // Default to text
  return 'text';
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node scripts/import-receivers.js <input-file> [format]');
    console.log('\nFormats: text, json-array, json-object, json-detailed, csv');
    console.log('\nExamples:');
    console.log('  node scripts/import-receivers.js addresses.txt');
    console.log('  node scripts/import-receivers.js rewards.json json-detailed');
    console.log('  node scripts/import-receivers.js addresses.csv csv');
    process.exit(1);
  }
  
  const inputFile = args[0];
  const format = args[1] || 'auto';
  
  try {
    // Read input file
    const content = readFileSync(inputFile, 'utf8');
    logger.info(`Reading addresses from ${inputFile}`);
    
    // Detect or use specified format
    const actualFormat = format === 'auto' ? detectFormat(content) : format;
    logger.info(`Using format: ${actualFormat}`);
    
    // Parse addresses
    const addresses = parseAddresses(content, actualFormat);
    logger.info(`Parsed ${addresses.length} valid addresses`);
    
    if (addresses.length === 0) {
      logger.error('No valid addresses found');
      process.exit(1);
    }
    
    // Convert to our format
    const receivers = addresses.map((address, index) => ({
      address: address,
      totalRewards: 0, // Will be populated by reward collector
      rewardCount: 0,
      lastRewardBlock: 0,
      identity: null,
      rank: index + 1
    }));
    
    // Save to our format
    const outputPath = join(__dirname, '../data/receivers/top-receivers.json');
    const outputData = {
      timestamp: new Date().toISOString(),
      source: inputFile,
      format: actualFormat,
      count: receivers.length,
      receivers: receivers
    };
    
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    logger.success(`Saved ${receivers.length} addresses to ${outputPath}`);
    
    // Show sample
    console.log('\nSample addresses:');
    for (const receiver of receivers.slice(0, 5)) {
      console.log(`  ${receiver.rank}. ${receiver.address}`);
    }
    if (receivers.length > 5) {
      console.log(`  ... and ${receivers.length - 5} more`);
    }
    
  } catch (error) {
    logger.error('Failed to import addresses:', error);
    process.exit(1);
  }
}

main();