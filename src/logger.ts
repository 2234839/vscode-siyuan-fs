// ABOUTME: Logging system for SiYuanFS with VSCode output panel support

import * as vscode from 'vscode';

export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('SiYuanFS');
        this.logLevel = LogLevel.INFO;
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
        this.log(`Log level set to ${LogLevel[level]}`, LogLevel.INFO);
    }

    debug(message: string, ...args: any[]): void {
        this.log(message, LogLevel.DEBUG, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(message, LogLevel.INFO, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(message, LogLevel.WARN, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.log(message, LogLevel.ERROR, ...args);
    }

    private log(message: string, level: LogLevel, ...args: any[]): void {
        if (level < this.logLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const formattedMessage = args.length > 0
            ? `${message} ${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')}`
            : message;

        const logEntry = `[${timestamp}] [${levelName}] ${formattedMessage}`;

        // Always log to console for debugging
        console.log(logEntry);

        // Log to VSCode output panel
        this.outputChannel.appendLine(logEntry);

        // Show error messages in VSCode notifications
        if (level === LogLevel.ERROR) {
            vscode.window.showErrorMessage(`SiYuanFS Error: ${message}`);
        }
    }

    show(): void {
        this.outputChannel.show();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }

    // Utility methods for common logging scenarios
    logApiCall(method: string, endpoint: string, data?: any): void {
        this.debug(`API Call: ${method} ${endpoint}`, data ? { data } : '');
    }

    logApiResponse(method: string, endpoint: string, response?: any): void {
        this.debug(`API Response: ${method} ${endpoint}`, response ? { response } : '');
    }

    logApiError(method: string, endpoint: string, error: any): void {
        this.error(`API Error: ${method} ${endpoint}`, error);
    }

    logFileSystemOperation(operation: string, path: string, details?: any): void {
        this.info(`FileSystem: ${operation} ${path}`, details || '');
    }

    logFileSystemError(operation: string, path: string, error: any): void {
        this.error(`FileSystem Error: ${operation} ${path}`, error);
    }
}

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}