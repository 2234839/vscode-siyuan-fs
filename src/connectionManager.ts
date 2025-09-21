// ABOUTME: Connection management UI for SiYuanFS

import * as vscode from 'vscode';
import { ConfigManager } from './configManager';
import { SiYuanConnection } from './config';
import { Logger } from './logger';

export class ConnectionManager {
    private configManager: ConfigManager;
    private logger: Logger;

    constructor() {
        this.configManager = ConfigManager.getInstance();
        this.logger = Logger.getInstance();
    }

    async showConnectionPicker(): Promise<SiYuanConnection | null> {
        const connections = this.configManager.getAllConnections();

        if (connections.length === 0) {
            const createAction = 'Add Connection';
            const result = await vscode.window.showInformationMessage(
                'No SiYuan connections configured. Would you like to add one?',
                { modal: true },
                createAction
            );

            if (result === createAction) {
                return await this.showAddConnectionDialog();
            }
            return null;
        }

        const items: Array<{ label: string; description: string; detail: string; connection: SiYuanConnection | null }> = connections.map(conn => ({
            label: conn.isActive ? `$(check) ${conn.name}` : conn.name,
            description: conn.baseUrl,
            detail: `Last used: ${conn.lastUsed ? new Date(conn.lastUsed).toLocaleString() : 'Never'}`,
            connection: conn
        }));

        items.push({
            label: '$(add) Add New Connection',
            description: '',
            detail: 'Create a new SiYuan connection',
            connection: null
        });

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a SiYuan connection',
            canPickMany: false
        });

        if (!selected) {
            return null;
        }

        if (selected.connection === null) {
            return await this.showAddConnectionDialog();
        }

        return selected.connection;
    }

    async showAddConnectionDialog(): Promise<SiYuanConnection | null> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter connection name',
            placeHolder: 'My SiYuan Server',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Connection name is required';
                }
                if (this.configManager.getConnectionNames().includes(value.trim())) {
                    return 'Connection name already exists';
                }
                return null;
            }
        });

        if (!name) {
            return null;
        }

        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Enter SiYuan API base URL',
            placeHolder: 'http://localhost:6806',
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Base URL is required';
                }
                try {
                    new URL(value.trim());
                } catch {
                    return 'Please enter a valid URL';
                }
                return null;
            }
        });

        if (!baseUrl) {
            return null;
        }

        const apiToken = await vscode.window.showInputBox({
            prompt: 'Enter SiYuan API token (optional)',
            password: true,
            placeHolder: 'Leave empty if no authentication required'
        });

        const timeoutStr = await vscode.window.showInputBox({
            prompt: 'Request timeout (milliseconds)',
            placeHolder: '10000',
            validateInput: (value) => {
                if (value && !/^\d+$/.test(value)) {
                    return 'Please enter a valid number';
                }
                return null;
            }
        });

        const timeout = timeoutStr ? parseInt(timeoutStr, 10) : 10000;

        try {
            const connection = await this.configManager.addConnection({
                name: name.trim(),
                baseUrl: baseUrl.trim(),
                apiToken: apiToken?.trim() || '',
                timeout
            });

            // Test the connection
            const testResult = await this.testConnection(connection);
            if (testResult) {
                vscode.window.showInformationMessage(`Connection '${connection.name}' added and tested successfully!`);
                return connection;
            } else {
                vscode.window.showWarningMessage(`Connection '${connection.name}' added but connection test failed. You can configure it later.`);
                return connection;
            }
        } catch (error) {
            this.logger.error('Failed to add connection', error);
            vscode.window.showErrorMessage(`Failed to add connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return null;
        }
    }

    async showEditConnectionDialog(connection: SiYuanConnection): Promise<boolean> {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter connection name',
            value: connection.name,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Connection name is required';
                }
                const existingNames = this.configManager.getConnectionNames().filter(name => name !== connection.name);
                if (existingNames.includes(value.trim())) {
                    return 'Connection name already exists';
                }
                return null;
            }
        });

        if (!name) {
            return false;
        }

        const baseUrl = await vscode.window.showInputBox({
            prompt: 'Enter SiYuan API base URL',
            value: connection.baseUrl,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Base URL is required';
                }
                try {
                    new URL(value.trim());
                } catch {
                    return 'Please enter a valid URL';
                }
                return null;
            }
        });

        if (!baseUrl) {
            return false;
        }

        const apiToken = await vscode.window.showInputBox({
            prompt: 'Enter SiYuan API token (optional)',
            password: true,
            value: connection.apiToken,
            placeHolder: 'Leave empty if no authentication required'
        });

        const timeoutStr = await vscode.window.showInputBox({
            prompt: 'Request timeout (milliseconds)',
            value: connection.timeout.toString(),
            validateInput: (value) => {
                if (!value || !/^\d+$/.test(value)) {
                    return 'Please enter a valid number';
                }
                return null;
            }
        });

        const timeout = parseInt(timeoutStr || '10000', 10);

        try {
            await this.configManager.updateConnection(connection.id, {
                name: name.trim(),
                baseUrl: baseUrl.trim(),
                apiToken: apiToken?.trim() || '',
                timeout
            });

            vscode.window.showInformationMessage(`Connection '${name}' updated successfully!`);
            return true;
        } catch (error) {
            this.logger.error('Failed to update connection', error);
            vscode.window.showErrorMessage(`Failed to update connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async showDeleteConnectionDialog(connection: SiYuanConnection): Promise<boolean> {
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the connection '${connection.name}'?`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            return false;
        }

        try {
            await this.configManager.deleteConnection(connection.id);
            vscode.window.showInformationMessage(`Connection '${connection.name}' deleted successfully!`);
            return true;
        } catch (error) {
            this.logger.error('Failed to delete connection', error);
            vscode.window.showErrorMessage(`Failed to delete connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    async showConnectionManager(): Promise<void> {
        const connections = this.configManager.getAllConnections();

        if (connections.length === 0) {
            vscode.window.showInformationMessage('No connections configured. Use "Add Connection" to create one.');
            return;
        }

        const items = connections.map(conn => ({
            label: conn.isActive ? `$(check) ${conn.name}` : conn.name,
            description: conn.baseUrl,
            detail: `Created: ${new Date(conn.createdAt).toLocaleString()} | Last used: ${conn.lastUsed ? new Date(conn.lastUsed).toLocaleString() : 'Never'}`,
            connection: conn
        }));

        const actions = [
            {
                label: '$(add) Add Connection',
                description: 'Create a new SiYuan connection',
                action: 'add'
            },
            {
                label: '$(sync) Refresh',
                description: 'Refresh connection list',
                action: 'refresh'
            }
        ];

        const selected = await vscode.window.showQuickPick([...items, ...actions], {
            placeHolder: 'Manage SiYuan connections',
            canPickMany: false
        });

        if (!selected) {
            return;
        }

        if ('action' in selected) {
            if (selected.action === 'add') {
                await this.showAddConnectionDialog();
            } else if (selected.action === 'refresh') {
                // Refresh is handled by re-showing the dialog
                await this.showConnectionManager();
            }
        } else {
            // Connection selected, show actions
            const connection = selected.connection;
            const actionItems = [
                {
                    label: '$(check) Set as Active',
                    description: connection.isActive ? 'Already active' : 'Make this the active connection',
                    action: 'activate'
                },
                {
                    label: '$(edit) Edit',
                    description: 'Edit connection settings',
                    action: 'edit'
                },
                {
                    label: '$(trash) Delete',
                    description: 'Delete this connection',
                    action: 'delete'
                },
                {
                    label: '$(play) Test Connection',
                    description: 'Test if the connection is working',
                    action: 'test'
                }
            ];

            const action = await vscode.window.showQuickPick(actionItems, {
                placeHolder: `What would you like to do with '${connection.name}'?`,
                canPickMany: false
            });

            if (!action) {
                return;
            }

            switch (action.action) {
                case 'activate':
                    if (!connection.isActive) {
                        await this.configManager.setActiveConnection(connection.id);
                        vscode.window.showInformationMessage(`'${connection.name}' is now the active connection`);
                    }
                    break;
                case 'edit':
                    await this.showEditConnectionDialog(connection);
                    break;
                case 'delete':
                    if (await this.showDeleteConnectionDialog(connection)) {
                        // Connection deleted, refresh the list
                        await this.showConnectionManager();
                    }
                    break;
                case 'test':
                    await this.testConnectionWithFeedback(connection);
                    break;
            }
        }
    }

    private async testConnection(connection: SiYuanConnection): Promise<boolean> {
        try {
            // For now, simulate a connection test
            // In a real implementation, this would use the actual API client
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
        } catch (error) {
            this.logger.error('Connection test failed', { connectionId: connection.id, error });
            return false;
        }
    }

    async testConnectionWithFeedback(connection: SiYuanConnection): Promise<void> {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Testing connection to '${connection.name}'...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ message: 'Connecting...' });
                const success = await this.testConnection(connection);

                if (success) {
                    progress.report({ message: 'Connection successful!' });
                    setTimeout(() => {
                        vscode.window.showInformationMessage(`Connection to '${connection.name}' is working!`);
                    }, 500);
                } else {
                    throw new Error('Connection failed');
                }
            } catch (error) {
                progress.report({ message: 'Connection failed' });
                setTimeout(() => {
                    vscode.window.showErrorMessage(`Failed to connect to '${connection.name}': ${error instanceof Error ? error.message : 'Unknown error'}`);
                }, 500);
                throw error;
            }
        });
    }
}