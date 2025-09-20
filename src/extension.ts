import * as vscode from 'vscode';
import { SiyuanFileSystemProvider } from './provider/siyuan-fs';
import { SiyuanTreeViewProvider, SiyuanTreeItem } from './provider/siyuan-tree-view';
import { ConfigurationManager } from './config/settings';
import { ErrorHandler } from './utils/error-handler';
import { PathUtils } from './utils/path-utils';

export function activate(context: vscode.ExtensionContext) {
  console.log('Siyuan File System extension is activating...');

  // Initialize providers
  const fileSystemProvider = new SiyuanFileSystemProvider();
  const treeViewProvider = new SiyuanTreeViewProvider();
  treeViewProvider.setFileSystemProvider(fileSystemProvider);

  // Register the file system provider
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider('siyuan', fileSystemProvider, {
      isCaseSensitive: true,
      isReadonly: false
    })
  );

  // Register tree view
  const treeView = vscode.window.createTreeView('siyuan', {
    treeDataProvider: treeViewProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  // Helper function to get selected instance
  async function getSelectedInstanceId(): Promise<string | undefined> {
    const selection = treeView.selection[0];
    if (selection && selection.id.startsWith('instance-')) {
      return selection.id.replace('instance-', '');
    }
    return undefined;
  }

  // Register commands
  const refreshCommand = vscode.commands.registerCommand('siyuan.refresh', async () => {
    try {
      fileSystemProvider.refreshCache();
      treeViewProvider.refresh();
      vscode.window.showInformationMessage('Siyuan file system cache refreshed');
    } catch (error) {
      ErrorHandler.handle(error, 'refresh command');
    }
  });

  const addInstanceCommand = vscode.commands.registerCommand('siyuan.addInstance', async () => {
    try {
      await treeViewProvider.addInstance();
    } catch (error) {
      ErrorHandler.handle(error, 'add instance command');
    }
  });

  const removeInstanceCommand = vscode.commands.registerCommand('siyuan.removeInstance', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.removeInstance(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'remove instance command');
    }
  });

  const editInstanceCommand = vscode.commands.registerCommand('siyuan.editInstance', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.editInstance(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'edit instance command');
    }
  });

  const enableInstanceCommand = vscode.commands.registerCommand('siyuan.enableInstance', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.enableInstance(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'enable instance command');
    }
  });

  const disableInstanceCommand = vscode.commands.registerCommand('siyuan.disableInstance', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.disableInstance(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'disable instance command');
    }
  });

  const testConnectionCommand = vscode.commands.registerCommand('siyuan.testConnection', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.testConnection(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'test connection command');
    }
  });

  const loadFileSystemCommand = vscode.commands.registerCommand('siyuan.loadFileSystem', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.loadFileSystem(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'load file system command');
    }
  });

  const unloadFileSystemCommand = vscode.commands.registerCommand('siyuan.unloadFileSystem', async () => {
    try {
      const instanceId = await getSelectedInstanceId();
      if (instanceId) {
        await treeViewProvider.unloadFileSystem(instanceId);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'unload file system command');
    }
  });

  const openSiyuanExplorer = vscode.commands.registerCommand('siyuan.openExplorer', async () => {
    try {
      const instance = await ConfigurationManager.showInstanceQuickPick();
      if (instance) {
        const uri = PathUtils.createRootUri(instance.id);
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: false });
      }
    } catch (error) {
      ErrorHandler.handle(error, 'open explorer command');
    }
  });

  context.subscriptions.push(
    refreshCommand,
    addInstanceCommand,
    removeInstanceCommand,
    editInstanceCommand,
    enableInstanceCommand,
    disableInstanceCommand,
    testConnectionCommand,
    loadFileSystemCommand,
    unloadFileSystemCommand,
    openSiyuanExplorer
  );

  // Check if there are any configured instances and update context
  const hasInstances = ConfigurationManager.hasInstances();
  vscode.commands.executeCommand('setContext', 'siyuan:hasInstances', hasInstances);

  if (!hasInstances) {
    vscode.window.showInformationMessage(
      'No Siyuan instances configured. Add an instance to get started.',
      'Add Instance'
    ).then(selection => {
      if (selection === 'Add Instance') {
        vscode.commands.executeCommand('siyuan.addInstance');
      }
    });
  }

  // Add welcome message on first activation
  const welcomeShown = context.globalState.get<boolean>('siyuan.welcomeShown');
  if (!welcomeShown) {
    vscode.window.showInformationMessage(
      'Siyuan File System extension activated! Configure your Siyuan instances to start working with your notes.',
      'Configure Instances',
      'Learn More'
    ).then(selection => {
      if (selection === 'Configure Instances') {
        vscode.commands.executeCommand('siyuan.addInstance');
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/your-repo/vscode-siyuan-fs'));
      }
    });

    context.globalState.update('siyuan.welcomeShown', true);
  }

  console.log('Siyuan File System extension activated successfully');
}

export function deactivate() {
  console.log('Siyuan File System extension is deactivating...');
  // Cleanup if needed
}