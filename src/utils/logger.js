import { createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

class Logger {
  constructor() {
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m'
    };
    
    // Create logs directory
    const logsDir = join(__dirname, '../../logs');
    mkdirSync(logsDir, { recursive: true });
    
    // Create log file stream
    const date = new Date().toISOString().split('T')[0];
    this.logFile = createWriteStream(join(logsDir, `tracker-${date}.log`), { flags: 'a' });
  }

  timestamp() {
    return new Date().toISOString();
  }

  format(level, message, ...args) {
    const timestamp = this.timestamp();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (args.length > 0) {
      return `${formattedMessage} ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg
      ).join(' ')}`;
    }
    
    return formattedMessage;
  }

  writeToFile(message) {
    this.logFile.write(`${message}\n`);
  }

  info(message, ...args) {
    const formatted = this.format('INFO', message, ...args);
    console.log(`${this.colors.blue}${formatted}${this.colors.reset}`);
    this.writeToFile(formatted);
  }

  success(message, ...args) {
    const formatted = this.format('SUCCESS', message, ...args);
    console.log(`${this.colors.green}${formatted}${this.colors.reset}`);
    this.writeToFile(formatted);
  }

  warn(message, ...args) {
    const formatted = this.format('WARN', message, ...args);
    console.log(`${this.colors.yellow}${formatted}${this.colors.reset}`);
    this.writeToFile(formatted);
  }

  error(message, ...args) {
    const formatted = this.format('ERROR', message, ...args);
    console.error(`${this.colors.red}${formatted}${this.colors.reset}`);
    this.writeToFile(formatted);
  }

  debug(message, ...args) {
    if (process.env.DEBUG === 'true') {
      const formatted = this.format('DEBUG', message, ...args);
      console.log(`${this.colors.magenta}${formatted}${this.colors.reset}`);
      this.writeToFile(formatted);
    }
  }

  table(data) {
    console.table(data);
    this.writeToFile(`Table: ${JSON.stringify(data, null, 2)}`);
  }
}

export const logger = new Logger();