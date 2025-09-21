// ABOUTME: Main extension entry point for SiYuanFS virtual file system

import * as vscode from 'vscode';
import { SiYuanFS } from './siyuanFileSystemProvider';
import { SIYUANFS_SCHEME, SiYuanFSConfig } from './constants';
import { Logger } from './logger';
import { ConfigManager } from './configManager';
import { ConnectionManager } from './connectionManager';

export function activate(context: vscode.ExtensionContext) {
	const logger = Logger.getInstance();
	const configManager = ConfigManager.getInstance();
	const connectionManager = new ConnectionManager();

	logger.info('SiYuanFS extension activating...');

	console.log('SiYuanFS says "Hello"');

	// Initialize with active connection or default
	const activeConnection = configManager.getActiveConnection();
	const config: SiYuanFSConfig = activeConnection ? {
		baseUrl: activeConnection.baseUrl,
		apiToken: activeConnection.apiToken,
		timeout: activeConnection.timeout
	} : {
		baseUrl: 'http://localhost:6806',
		apiToken: '',
		timeout: 10000
	};

	const siyuanFs = new SiYuanFS(config);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider(SIYUANFS_SCHEME, siyuanFs, { isCaseSensitive: true }));

	logger.info('SiYuanFS file system provider registered', { activeConnection: activeConnection?.name || 'none' });

	// Function to update workspace folder name when connection changes
	const updateWorkspaceFolderName = (connectionName?: string) => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		const siyuanFolderIndex = workspaceFolders.findIndex(folder =>
			folder.uri.scheme === SIYUANFS_SCHEME
		);

		if (siyuanFolderIndex !== -1) {
			const newFolderName = connectionName
				? `SiYuanFS - ${connectionName}`
				: "SiYuanFS - Virtual File System";

			// Remove and re-add the folder with new name
			const folderUri = workspaceFolders[siyuanFolderIndex].uri;
			vscode.workspace.updateWorkspaceFolders(siyuanFolderIndex, 1, {
				uri: folderUri,
				name: newFolderName
			});
		}
	};

	// Command: Initialize connection with configuration
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.init', async () => {
		try {
			logger.info('Starting SiYuanFS initialization...');

			// Prompt for configuration
			const baseUrl = await vscode.window.showInputBox({
				prompt: 'Enter SiYuan API base URL',
				value: config.baseUrl,
				placeHolder: 'http://localhost:6806'
			});

			if (baseUrl) {
				const apiToken = await vscode.window.showInputBox({
					prompt: 'Enter SiYuan API token (optional)',
					password: true,
					placeHolder: 'Leave empty if no authentication required'
				});

				config.baseUrl = baseUrl;
				config.apiToken = apiToken || '';
				logger.info('Configuration updated', { baseUrl: config.baseUrl, hasToken: !!config.apiToken });

				siyuanFs.updateConfig(config);

				// Test connection by trying to list root directory
				logger.info('Testing connection by reading root directory...');
				const rootUri = vscode.Uri.parse(`${SIYUANFS_SCHEME}:/`);
				const files = await siyuanFs.readDirectory(rootUri);
				logger.info(`Root directory read successful, found ${files.length} files:`, files);

				// Don't automatically add workspace folder, let user add it manually if needed
				logger.info('SiYuanFS initialization completed successfully');
				vscode.window.showInformationMessage('SiYuanFS connection initialized successfully! Use "SiYuanFS: Setup Workspace" to add the virtual file system to explorer.');
			} else {
				logger.info('Initialization cancelled by user');
			}
		} catch (error: any) {
			logger.error('SiYuanFS initialization failed', error);
			vscode.window.showErrorMessage(`Failed to initialize SiYuanFS: ${error.message}`);
		}
	}));

	// Command: Reset connection
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.reset', () => {
		// Reset to default configuration
		const defaultConfig: SiYuanFSConfig = {
			baseUrl: 'http://localhost:6806',
			apiToken: '',
			timeout: 10000
		};
		siyuanFs.updateConfig(defaultConfig);
		vscode.window.showInformationMessage('SiYuanFS connection reset to defaults');
	}));

	// Command: Configure API settings
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.config', async () => {
		const currentConfig = siyuanFs.getConfig();

		const baseUrl = await vscode.window.showInputBox({
			prompt: 'SiYuan API base URL',
			value: currentConfig.baseUrl,
			placeHolder: 'http://localhost:6806'
		});

		if (baseUrl !== undefined) {
			const timeoutStr = await vscode.window.showInputBox({
				prompt: 'Request timeout (milliseconds)',
				value: currentConfig.timeout?.toString() || '10000',
				placeHolder: '10000'
			});

			if (timeoutStr !== undefined) {
				const timeout = parseInt(timeoutStr) || 10000;

				config.baseUrl = baseUrl;
				config.timeout = timeout;
				siyuanFs.updateConfig(config);

				vscode.window.showInformationMessage('SiYuanFS configuration updated');
			}
		}
	}));

	// Command: Refresh file system (trigger re-read)
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.refresh', async () => {
		try {
			// Trigger a read of root directory to refresh
			await siyuanFs.readDirectory(vscode.Uri.parse(`${SIYUANFS_SCHEME}:/`));
			vscode.window.showInformationMessage('SiYuanFS file system refreshed');
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to refresh: ${error.message}`);
		}
	}));

	// Command: Setup workspace
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.workspaceInit', async () => {
		try {
			logger.info('Manually adding SiYuanFS workspace folder...');

			// First test if the connection works
			const testUri = vscode.Uri.parse(`${SIYUANFS_SCHEME}:/`);
			const files = await siyuanFs.readDirectory(testUri);
			logger.info(`Connection test successful, found ${files.length} files`);

			// Then add the workspace folder with connection name
			const currentActiveConnection = configManager.getActiveConnection();
			const folderName = currentActiveConnection
				? `SiYuanFS - ${currentActiveConnection.name}`
				: "SiYuanFS - Virtual File System";

			vscode.workspace.updateWorkspaceFolders(0, 0, {
				uri: testUri,
				name: folderName
			});

			logger.info('Workspace folder added successfully');
			vscode.window.showInformationMessage('SiYuanFS workspace folder added to explorer.');
		} catch (error: any) {
			logger.error('Failed to add workspace folder:', error);
			vscode.window.showErrorMessage(`Failed to add workspace folder: ${error.message}. Please run "SiYuanFS: Initialize" first.`);
		}
	}));

	logger.info('SiYuanFS extension activation completed');

	// Update workspace folder name if there's already a folder and active connection
	if (activeConnection) {
		setTimeout(() => {
			updateWorkspaceFolderName(activeConnection.name);
		}, 500); // Small delay to ensure workspace is ready
	}

	// New connection management commands
	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.manageConnections', async () => {
		await connectionManager.showConnectionManager();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.addConnection', async () => {
		const connection = await connectionManager.showAddConnectionDialog();
		if (connection) {
			// Ask if user wants to set this as the active connection
			const setActive = await vscode.window.showQuickPick(['Yes', 'No'], {
				placeHolder: 'Set this as the active connection?'
			});

			if (setActive === 'Yes') {
				await configManager.setActiveConnection(connection.id);
				updateWorkspaceFolderName(connection.name);
				vscode.window.showInformationMessage(`'${connection.name}' is now the active connection`);
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.selectConnection', async () => {
		const connection = await connectionManager.showConnectionPicker();
		if (connection) {
			await configManager.setActiveConnection(connection.id);
			updateWorkspaceFolderName(connection.name);
			vscode.window.showInformationMessage(`'${connection.name}' is now the active connection`);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.editConnection', async () => {
		const activeConnection = configManager.getActiveConnection();
		if (!activeConnection) {
			vscode.window.showInformationMessage('No active connection to edit');
			return;
		}

		const success = await connectionManager.showEditConnectionDialog(activeConnection);
		if (success) {
			// Update the file system provider with new config
			const updatedConnection = configManager.getActiveConnection();
			if (updatedConnection) {
				siyuanFs.updateConfig({
					baseUrl: updatedConnection.baseUrl,
					apiToken: updatedConnection.apiToken,
					timeout: updatedConnection.timeout
				});
				// Update folder name if connection name changed
				updateWorkspaceFolderName(updatedConnection.name);
			}
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('siyuanfs.testConnection', async () => {
		const activeConnection = configManager.getActiveConnection();
		if (!activeConnection) {
			vscode.window.showInformationMessage('No active connection to test');
			return;
		}

		await connectionManager.testConnectionWithFeedback(activeConnection);
	}));
}

export function deactivate() {
	const logger = Logger.getInstance();
	logger.info('SiYuanFS extension deactivating...');
	logger.dispose();
}