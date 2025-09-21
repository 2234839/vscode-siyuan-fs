// ABOUTME: Main extension entry point for SiYuanFS virtual file system

import * as vscode from 'vscode';
import { SiYuanFS } from './siyuanFileSystemProvider';
import { SIYUANFS_SCHEME, SiYuanFSConfig } from './constants';
import { Logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	const logger = Logger.getInstance();
	logger.info('SiYuanFS extension activating...');

	console.log('SiYuanFS says "Hello"');

	// Default configuration - users should configure this via settings
	let config: SiYuanFSConfig = {
		baseUrl: 'http://localhost:6806',
		apiToken: '',
		timeout: 10000
	};

	const siyuanFs = new SiYuanFS(config);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider(SIYUANFS_SCHEME, siyuanFs, { isCaseSensitive: true }));

	logger.info('SiYuanFS file system provider registered');

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
				vscode.window.showInformationMessage('SiYuanFS connection initialized successfully! Use "SiYuanFS: Add Workspace Folder" to add the virtual file system to explorer.');
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
		config = {
			baseUrl: 'http://localhost:6806',
			apiToken: '',
			timeout: 10000
		};
		siyuanFs.updateConfig(config);
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

			// Then add the workspace folder
			vscode.workspace.updateWorkspaceFolders(0, 0, {
				uri: testUri,
				name: "SiYuanFS - Virtual File System"
			});

			logger.info('Workspace folder added successfully');
			vscode.window.showInformationMessage('SiYuanFS workspace folder added to explorer.');
		} catch (error: any) {
			logger.error('Failed to add workspace folder:', error);
			vscode.window.showErrorMessage(`Failed to add workspace folder: ${error.message}. Please run "SiYuanFS: Initialize" first.`);
		}
	}));

	logger.info('SiYuanFS extension activation completed');

	// Test direct URI access
	setTimeout(async () => {
		try {
			logger.info('Testing direct URI access...');
			const testUri = vscode.Uri.parse('siyuanfs:/');
			const stats = await vscode.workspace.fs.stat(testUri);
			logger.info('Direct URI stat successful:', stats);

			const entries = await vscode.workspace.fs.readDirectory(testUri);
			logger.info('Direct URI readDirectory successful:', entries);
		} catch (error: any) {
			logger.error('Direct URI access failed:', error);
		}
	}, 1000);
}

export function deactivate() {
	const logger = Logger.getInstance();
	logger.info('SiYuanFS extension deactivating...');
	logger.dispose();
}