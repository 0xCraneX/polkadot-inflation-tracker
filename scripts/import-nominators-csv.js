#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../src/utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Extract address from HTML link
function extractAddress(htmlLink) {
  // Extract from nominator_dune_url column which contains the address
  const match = htmlLink.match(/>([^<]+)<\/a>$/);
  if (match) {
    const shortAddr = match[1];
    // Check if it's a shortened address like "16ZL...zzBD"
    if (shortAddr.includes('...')) {
      // Try to extract from the URL parameter
      const urlMatch = htmlLink.match(/nominator_ss58_td9066=([^'"]+)/);
      if (urlMatch) {
        return urlMatch[1];
      }
    }
    return shortAddr;
  }
  return null;
}

// Parse CSV and extract nominator data
function parseNominatorsCSV(csvContent, limit = 300) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  
  const nominators = [];
  
  // Process data rows
  for (let i = 1; i < lines.length && nominators.length < limit; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (handle commas in HTML)
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === "'" || char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        parts.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    parts.push(current);
    
    // Extract data
    const rank = parseInt(parts[0]);
    const nominatorUrl = parts[2]; // nominator_dune_url column
    const address = extractAddress(nominatorUrl);
    const delegatedAmount = parseFloat(parts[5] || 0);
    const stakingRewards = parseFloat(parts[6] || 0);
    const apr = parseFloat(parts[7] || 0);
    
    if (address && address.length >= 47) {
      nominators.push({
        rank,
        address,
        delegatedAmount,
        stakingRewards,
        apr,
        identity: parts[2].includes('pos.dog') ? 'pos.dog' : `Nominator #${rank}`
      });
    }
  }
  
  return nominators;
}

async function importNominators() {
  try {
    // Read CSV file
    const csvPath = join(__dirname, '../Polkadot_Nominators_-_Top_2000.csv');
    const csvContent = readFileSync(csvPath, 'utf8');
    
    console.log('Parsing nominator data...');
    const nominators = parseNominatorsCSV(csvContent, 300);
    
    console.log(`\nSuccessfully parsed ${nominators.length} nominators`);
    
    // Convert to our receiver format
    const receivers = nominators.map(nom => ({
      address: nom.address,
      totalRewards: nom.stakingRewards,
      rewardCount: 0, // Will be updated when fetching from API
      lastRewardBlock: 0,
      identity: nom.identity,
      balance: nom.delegatedAmount,
      apr: nom.apr,
      rank: nom.rank
    }));
    
    // Save to our format
    const outputPath = join(__dirname, '../data/receivers/top-receivers.json');
    const outputData = {
      timestamp: new Date().toISOString(),
      source: 'Polkadot_Nominators_-_Top_2000.csv',
      count: receivers.length,
      totalStakingRewards: nominators.reduce((sum, n) => sum + n.stakingRewards, 0),
      totalDelegated: nominators.reduce((sum, n) => sum + n.delegatedAmount, 0),
      receivers: receivers
    };
    
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    // Display summary
    console.log('\n=== IMPORT SUMMARY ==="');
    console.log(`Total Nominators: ${receivers.length}`);
    console.log(`Total Staking Rewards: ${outputData.totalStakingRewards.toLocaleString()} DOT`);
    console.log(`Total Delegated: ${outputData.totalDelegated.toLocaleString()} DOT`);
    console.log(`Average APR: ${(nominators.reduce((sum, n) => sum + n.apr, 0) / nominators.length * 100).toFixed(2)}%`);
    
    console.log('\nTop 10 Reward Recipients:');
    nominators.slice(0, 10).forEach(nom => {
      console.log(`  ${nom.rank}. ${nom.address.slice(0, 8)}...${nom.address.slice(-6)}: ${nom.stakingRewards.toLocaleString()} DOT (${(nom.apr * 100).toFixed(2)}% APR)`);
    });
    
    console.log(`\nData saved to: ${outputPath}`);
    logger.success('Import completed successfully!');
    
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

importNominators();