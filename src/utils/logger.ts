import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: chalk.gray('⚙'),
  info: chalk.blue('ℹ'),
  warn: chalk.yellow('⚠'),
  error: chalk.red('✖'),
  success: chalk.green('✔'),
};

class Logger {
  private verbose = false;

  setVerbose(value: boolean): void {
    this.verbose = value;
  }

  debug(message: string): void {
    if (this.verbose) {
      console.error(`${LOG_PREFIXES.debug} ${chalk.gray(message)}`);
    }
  }

  info(message: string): void {
    console.error(`${LOG_PREFIXES.info} ${message}`);
  }

  warn(message: string): void {
    console.error(`${LOG_PREFIXES.warn} ${chalk.yellow(message)}`);
  }

  error(message: string): void {
    console.error(`${LOG_PREFIXES.error} ${chalk.red(message)}`);
  }

  success(message: string): void {
    console.error(`${LOG_PREFIXES.success} ${chalk.green(message)}`);
  }

  /** Plain output to stdout (for piping / JSON output) */
  out(message: string): void {
    console.log(message);
  }
}

export const logger = new Logger();
