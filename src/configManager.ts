// ABOUTME: Configuration manager for SiYuanFS connections

import * as vscode from 'vscode';
import { SiYuanConnection, SiYuanFSConfig, DEFAULT_CONFIG } from './config';
import { Logger } from './logger';

export class ConfigManager {
    private static instance: ConfigManager;
    private config: SiYuanFSConfig;
    private logger: Logger;
    private readonly CONFIG_SECTION = 'siyuanfs';

    private constructor() {
        this.logger = Logger.getInstance();
        this.config = this.loadConfig();
        this.logger.info('ConfigManager initialized', { connections: this.config.connections.length });
    }

    static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private loadConfig(): SiYuanFSConfig {
        try {
            const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
            const connections = config.get<SiYuanConnection[]>('connections', DEFAULT_CONFIG.connections);
            const activeConnectionId = config.get<string | null>('activeConnectionId', DEFAULT_CONFIG.activeConnectionId);

            this.logger.info('Loaded existing configuration', { connections: connections.length });
            return { connections, activeConnectionId };
        } catch (error) {
            this.logger.warn('Failed to load configuration, using defaults', error);
            return DEFAULT_CONFIG;
        }
    }

    private async saveConfig(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
            await config.update('connections', this.config.connections, vscode.ConfigurationTarget.Global);
            await config.update('activeConnectionId', this.config.activeConnectionId, vscode.ConfigurationTarget.Global);
            this.logger.info('Configuration saved successfully');
        } catch (error) {
            this.logger.error('Failed to save configuration', error);
            throw error;
        }
    }

    async addConnection(connection: Omit<SiYuanConnection, 'id' | 'createdAt' | 'isActive'>): Promise<SiYuanConnection> {
        const newConnection: SiYuanConnection = {
            ...connection,
            id: this.generateId(),
            createdAt: Date.now(),
            isActive: false
        };

        // If this is the first connection, make it active
        if (this.config.connections.length === 0) {
            newConnection.isActive = true;
            this.config.activeConnectionId = newConnection.id;
        }

        this.config.connections.push(newConnection);
        await this.saveConfig();

        this.logger.info('Connection added successfully', { id: newConnection.id, name: newConnection.name });
        return newConnection;
    }

    async updateConnection(id: string, updates: Partial<SiYuanConnection>): Promise<SiYuanConnection | null> {
        const connectionIndex = this.config.connections.findIndex(conn => conn.id === id);
        if (connectionIndex === -1) {
            this.logger.warn('Connection not found for update', { id });
            return null;
        }

        this.config.connections[connectionIndex] = {
            ...this.config.connections[connectionIndex],
            ...updates,
            id: this.config.connections[connectionIndex].id, // Prevent ID changes
            createdAt: this.config.connections[connectionIndex].createdAt // Prevent creation time changes
        };

        await this.saveConfig();
        this.logger.info('Connection updated successfully', { id, name: this.config.connections[connectionIndex].name });
        return this.config.connections[connectionIndex];
    }

    async deleteConnection(id: string): Promise<boolean> {
        const connectionIndex = this.config.connections.findIndex(conn => conn.id === id);
        if (connectionIndex === -1) {
            this.logger.warn('Connection not found for deletion', { id });
            return false;
        }

        const deletedConnection = this.config.connections[connectionIndex];
        this.config.connections.splice(connectionIndex, 1);

        // If we deleted the active connection, set a new one as active
        if (this.config.activeConnectionId === id) {
            this.config.activeConnectionId = this.config.connections.length > 0 ? this.config.connections[0].id : null;
            if (this.config.activeConnectionId) {
                this.config.connections[0].isActive = true;
            }
        }

        await this.saveConfig();
        this.logger.info('Connection deleted successfully', { id, name: deletedConnection.name });
        return true;
    }

    async setActiveConnection(id: string): Promise<boolean> {
        const connection = this.config.connections.find(conn => conn.id === id);
        if (!connection) {
            this.logger.warn('Connection not found for activation', { id });
            return false;
        }

        // Deactivate all connections
        this.config.connections.forEach(conn => conn.isActive = false);

        // Activate the selected connection
        connection.isActive = true;
        connection.lastUsed = Date.now();
        this.config.activeConnectionId = id;

        await this.saveConfig();
        this.logger.info('Active connection changed', { id, name: connection.name });
        return true;
    }

    getActiveConnection(): SiYuanConnection | null {
        if (!this.config.activeConnectionId) {
            return null;
        }
        return this.config.connections.find(conn => conn.id === this.config.activeConnectionId) || null;
    }

    getAllConnections(): SiYuanConnection[] {
        return [...this.config.connections];
    }

    getConnection(id: string): SiYuanConnection | null {
        return this.config.connections.find(conn => conn.id === id) || null;
    }

    testConnection(connection: SiYuanConnection): Promise<boolean> {
        // This will be implemented when we integrate with the actual API client
        this.logger.info('Testing connection', { id: connection.id, name: connection.name, baseUrl: connection.baseUrl });
        return Promise.resolve(true); // For now, always return true
    }

    private generateId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    // Utility methods
    hasConnections(): boolean {
        return this.config.connections.length > 0;
    }

    getConnectionNames(): string[] {
        return this.config.connections.map(conn => conn.name);
    }

    exportConfig(): string {
        return JSON.stringify(this.config, null, 2);
    }

    async importConfig(configJson: string): Promise<boolean> {
        try {
            const importedConfig = JSON.parse(configJson) as SiYuanFSConfig;

            // Basic validation
            if (!importedConfig.connections || !Array.isArray(importedConfig.connections)) {
                throw new Error('Invalid configuration format');
            }

            this.config = importedConfig;
            await this.saveConfig();
            this.logger.info('Configuration imported successfully', { connections: importedConfig.connections.length });
            return true;
        } catch (error) {
            this.logger.error('Failed to import configuration', error);
            return false;
        }
    }
}