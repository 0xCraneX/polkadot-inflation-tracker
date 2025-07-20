import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class FileStorage {
  constructor() {
    this.dataDir = join(__dirname, '../../data');
    this.ensureDirectories();
  }

  ensureDirectories() {
    const dirs = [
      this.dataDir,
      join(this.dataDir, 'rewards'),
      join(this.dataDir, 'flows'),
      join(this.dataDir, 'reports'),
      join(this.dataDir, 'analysis'),
      join(this.dataDir, 'receivers')
    ];
    
    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
    }
  }

  getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  // Top receivers management
  async saveTopReceivers(receivers) {
    try {
      const filePath = join(this.dataDir, 'receivers', 'top-receivers.json');
      const data = {
        timestamp: this.getTimestamp(),
        count: receivers.length,
        receivers: receivers
      };
      
      writeFileSync(filePath, JSON.stringify(data, null, 2));
      logger.info(`Saved ${receivers.length} top receivers`);
      
      // Also save a dated backup
      const backupPath = join(this.dataDir, 'receivers', `top-receivers-${this.getDateString()}.json`);
      writeFileSync(backupPath, JSON.stringify(data, null, 2));
      
      return true;
    } catch (error) {
      logger.error('Failed to save top receivers:', error);
      return false;
    }
  }

  async loadTopReceivers() {
    try {
      const filePath = join(this.dataDir, 'receivers', 'top-receivers.json');
      
      if (!existsSync(filePath)) {
        logger.warn('No top receivers file found');
        return [];
      }
      
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      logger.info(`Loaded ${data.receivers.length} top receivers from ${data.timestamp}`);
      
      return data.receivers;
    } catch (error) {
      logger.error('Failed to load top receivers:', error);
      return [];
    }
  }

  // Analysis storage
  async saveAnalysis(analysis) {
    try {
      const date = this.getDateString();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      
      // Save latest analysis
      const latestPath = join(this.dataDir, 'analysis', 'latest.json');
      writeFileSync(latestPath, JSON.stringify(analysis, null, 2));
      
      // Save timestamped analysis
      const filePath = join(this.dataDir, 'analysis', `${date}`, `analysis-${timestamp}.json`);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, JSON.stringify(analysis, null, 2));
      
      logger.info(`Saved analysis for ${analysis.summary.totalRewards.toLocaleString()} DOT rewards`);
      
      return true;
    } catch (error) {
      logger.error('Failed to save analysis:', error);
      return false;
    }
  }

  async loadLatestAnalysis() {
    try {
      const filePath = join(this.dataDir, 'analysis', 'latest.json');
      
      if (!existsSync(filePath)) {
        logger.warn('No latest analysis found');
        return null;
      }
      
      const analysis = JSON.parse(readFileSync(filePath, 'utf8'));
      return analysis;
    } catch (error) {
      logger.error('Failed to load latest analysis:', error);
      return null;
    }
  }

  // Report storage
  async saveReport(report, type = 'daily') {
    try {
      const date = this.getDateString();
      const filePath = join(this.dataDir, 'reports', `${type}-${date}.json`);
      
      writeFileSync(filePath, JSON.stringify(report, null, 2));
      logger.info(`Saved ${type} report for ${date}`);
      
      // Also save as HTML if content is provided
      if (report.html) {
        const htmlPath = join(this.dataDir, 'reports', `${type}-${date}.html`);
        writeFileSync(htmlPath, report.html);
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to save ${type} report:`, error);
      return false;
    }
  }

  // Historical data management
  async loadHistoricalAnalyses(days = 7) {
    const analyses = [];
    const date = new Date();
    
    for (let i = 0; i < days; i++) {
      const dateStr = date.toISOString().split('T')[0];
      const dayDir = join(this.dataDir, 'analysis', dateStr);
      
      if (existsSync(dayDir)) {
        try {
          const files = require('fs').readdirSync(dayDir)
            .filter(f => f.endsWith('.json'))
            .sort();
          
          for (const file of files) {
            const analysis = JSON.parse(readFileSync(join(dayDir, file), 'utf8'));
            analyses.push(analysis);
          }
        } catch (error) {
          logger.error(`Error loading analyses for ${dateStr}:`, error);
        }
      }
      
      date.setDate(date.getDate() - 1);
    }
    
    return analyses;
  }

  // Quick data access
  async getExchangeAddresses() {
    try {
      const configPath = join(__dirname, '../../config/exchanges.json');
      return JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (error) {
      logger.error('Failed to load exchange addresses:', error);
      return {};
    }
  }
}