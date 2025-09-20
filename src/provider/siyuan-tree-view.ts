import * as vscode from 'vscode';
import { SiyuanClient } from '../api/siyuan-client';
import { ConfigurationManager } from '../config/settings';
import { ErrorHandler } from '../utils/error-handler';
import { SiyuanFileSystemProvider } from './siyuan-fs';

export class SiyuanTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly id: string,
    public readonly instanceId?: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(label, collapsibleState);
    this.id = id;
    this.contextValue = instanceId ? 'instance' : 'root';

    if (instanceId) {
      this.tooltip = `Instance: ${label}`;
      this.iconPath = new vscode.ThemeIcon('server');
    }
  }
}

export class SiyuanTreeViewProvider implements vscode.TreeDataProvider<SiyuanTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SiyuanTreeItem | undefined | null | void> = new vscode.EventEmitter<SiyuanTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SiyuanTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private loadedInstances = new Set<string>();
  private fileSystemProvider?: SiyuanFileSystemProvider;

  constructor() {
    this.updateContext();
  }

  setFileSystemProvider(provider: SiyuanFileSystemProvider) {
    this.fileSystemProvider = provider;
  }

  getTreeItem(element: SiyuanTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SiyuanTreeItem): Promise<SiyuanTreeItem[]> {
    if (!element) {
      // Root level - show all instances
      return this.getRootItems();
    }

    return [];
  }

  private async getRootItems(): Promise<SiyuanTreeItem[]> {
    try {
      const instances = ConfigurationManager.getInstances();
      this.updateContext(instances.length > 0);

      return instances.map(instance => {
        const item = new SiyuanTreeItem(
          instance.name,
          `instance-${instance.id}`,
          instance.id,
          vscode.TreeItemCollapsibleState.None
        );

        // Set context values for conditional UI
        item.contextValue = 'instance';
        item.description = instance.url;

        // Set icons based on status
        if (this.loadedInstances.has(instance.id)) {
          item.iconPath = new vscode.ThemeIcon('file-directory');
        } else if (instance.enabled) {
          item.iconPath = new vscode.ThemeIcon('server-environment');
        } else {
          item.iconPath = new vscode.ThemeIcon('server-off');
        }

        return item;
      });
    } catch (error) {
      ErrorHandler.handle(error, 'SiyuanTreeViewProvider.getChildren');
      return [];
    }
  }

  private updateContext(hasInstances: boolean = false) {
    vscode.commands.executeCommand('setContext', 'siyuan:hasInstances', hasInstances);
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  async loadFileSystem(instanceId: string): Promise<void> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      if (!instance.enabled) {
        throw new Error(`Instance ${instanceId} is disabled`);
      }

      // Test connection first
      const client = new SiyuanClient(instance.url, instance.token);
      const isConnected = await client.testConnection();

      if (!isConnected) {
        throw new Error('Failed to connect to Siyuan instance');
      }

      // Register file system for this instance
      if (this.fileSystemProvider) {
        const scheme = `siyuan-${instanceId}`;

        // Check if already registered
        const existingProvider = vscode.workspace.getFileSystemProvider(scheme as vscode.UriScheme);
        if (existingProvider) {
          vscode.workspace.registerFileSystemProvider(scheme as vscode.UriScheme, this.fileSystemProvider, {
            isCaseSensitive: true,
            isReadonly: false
          });
        } else {
          vscode.workspace.registerFileSystemProvider(scheme as vscode.UriScheme, this.fileSystemProvider, {
            isCaseSensitive: true,
            isReadonly: false
          });
        }

        // Add to workspace
        const uri = vscode.Uri.parse(`${scheme}://`);

        // Check if already in workspace
        const existingFolder = vscode.workspace.workspaceFolders?.find(folder =>
          folder.uri.scheme === scheme
        );

        if (!existingFolder) {
          vscode.workspace.updateWorkspaceFolders(
            vscode.workspace.workspaceFolders?.length || 0,
            0,
            { uri, name: instance.name }
          );
        }

        this.loadedInstances.add(instanceId);
        this.refresh();

        vscode.window.showInformationMessage(`Siyuan instance "${instance.name}" loaded to file tree`);
      }
    } catch (error) {
      ErrorHandler.handle(error, 'loadFileSystem');
      throw error;
    }
  }

  async unloadFileSystem(instanceId: string): Promise<void> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const scheme = `siyuan-${instanceId}`;

      // Remove from workspace
      const workspaceFolders = vscode.workspace.workspaceFolders?.filter(folder =>
        folder.uri.scheme !== scheme
      ) || [];

      if (workspaceFolders.length !== vscode.workspace.workspaceFolders?.length) {
        vscode.workspace.updateWorkspaceFolders(0, vscode.workspace.workspaceFolders?.length || 0, ...workspaceFolders);
      }

      this.loadedInstances.delete(instanceId);
      this.refresh();

      vscode.window.showInformationMessage(`Siyuan instance "${instance.name}" unloaded from file tree`);
    } catch (error) {
      ErrorHandler.handle(error, 'unloadFileSystem');
      throw error;
    }
  }

  async testConnection(instanceId: string): Promise<boolean> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const client = new SiyuanClient(instance.url, instance.token);
      const isConnected = await client.testConnection();

      if (isConnected) {
        vscode.window.showInformationMessage(`Connection to "${instance.name}" successful!`);
      } else {
        vscode.window.showErrorMessage(`Failed to connect to "${instance.name}"`);
      }

      return isConnected;
    } catch (error) {
      ErrorHandler.handle(error, 'testConnection');
      return false;
    }
  }

  async addInstance(): Promise<void> {
    try {
      await ConfigurationManager.showAddInstanceDialog();
      this.refresh();
    } catch (error) {
      ErrorHandler.handle(error, 'addInstance');
    }
  }

  async removeInstance(instanceId: string): Promise<void> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      // Unload file system if loaded
      if (this.loadedInstances.has(instanceId)) {
        await this.unloadFileSystem(instanceId);
      }

      await ConfigurationManager.removeInstance(instanceId);
      this.refresh();

      vscode.window.showInformationMessage(`Instance "${instance.name}" removed`);
    } catch (error) {
      ErrorHandler.handle(error, 'removeInstance');
      throw error;
    }
  }

  async editInstance(instanceId: string): Promise<void> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      const name = await vscode.window.showInputBox({
        title: 'Edit Siyuan Instance',
        prompt: 'Enter display name',
        value: instance.name
      });

      if (!name || name === instance.name) {
        return;
      }

      const url = await vscode.window.showInputBox({
        title: 'Edit Siyuan Instance',
        prompt: 'Enter Siyuan API URL',
        value: instance.url
      });

      if (!url || url === instance.url) {
        return;
      }

      const token = await vscode.window.showInputBox({
        title: 'Edit Siyuan Instance',
        prompt: 'Enter API token',
        password: true,
        value: instance.token
      });

      if (!token) {
        return;
      }

      await ConfigurationManager.updateInstance(instanceId, { name, url, token });
      this.refresh();

      vscode.window.showInformationMessage(`Instance "${name}" updated`);
    } catch (error) {
      ErrorHandler.handle(error, 'editInstance');
      throw error;
    }
  }

  async enableInstance(instanceId: string): Promise<void> {
    try {
      await ConfigurationManager.enableInstance(instanceId);
      this.refresh();
    } catch (error) {
      ErrorHandler.handle(error, 'enableInstance');
      throw error;
    }
  }

  async disableInstance(instanceId: string): Promise<void> {
    try {
      const instance = ConfigurationManager.getInstance(instanceId);
      if (!instance) {
        throw new Error(`Instance ${instanceId} not found`);
      }

      // Unload file system if loaded
      if (this.loadedInstances.has(instanceId)) {
        await this.unloadFileSystem(instanceId);
      }

      await ConfigurationManager.disableInstance(instanceId);
      this.refresh();
    } catch (error) {
      ErrorHandler.handle(error, 'disableInstance');
      throw error;
    }
  }

  getInstanceStatus(instanceId: string): 'loaded' | 'enabled' | 'disabled' {
    if (this.loadedInstances.has(instanceId)) {
      return 'loaded';
    }

    const instance = ConfigurationManager.getInstance(instanceId);
    if (instance?.enabled) {
      return 'enabled';
    }

    return 'disabled';
  }
}