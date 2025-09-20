import * as vscode from 'vscode';
import { type } from 'arktype';
import * as Types from '../api/types';

export class ConfigurationManager {
  private static readonly CONFIG_KEY = 'siyuan.instances';

  static getInstances(): Types.InstanceConfig[] {
    const config = vscode.workspace.getConfiguration('siyuan');
    const instances = config.get<any[]>(this.CONFIG_KEY, []);

    try {
      return instances.map(instance => {
        const validated = Types.InstanceConfigSchema(instance);
        if (validated instanceof type.errors) {
          throw new Error(`Invalid instance config: ${validated.summary}`);
        }
        return validated;
      });
    } catch (error) {
      console.error('Invalid instance configuration:', error);
      vscode.window.showErrorMessage('Invalid Siyuan instance configuration. Please check your settings.');
      return [];
    }
  }

  static getInstance(id: string): Types.InstanceConfig | undefined {
    const instances = this.getInstances();
    return instances.find(instance => instance.id === id && instance.enabled);
  }

  static async addInstance(instance: Omit<Types.InstanceConfig, 'enabled'>): Promise<void> {
    const instances = this.getInstances();
    const newInstance = { ...instance, enabled: true };

    // Check for duplicate ID
    if (instances.find(inst => inst.id === instance.id)) {
      throw new Error(`Instance with ID '${instance.id}' already exists`);
    }

    instances.push(newInstance);
    await this.updateInstances(instances);
  }

  static async updateInstance(id: string, updates: Partial<Types.InstanceConfig>): Promise<void> {
    const instances = this.getInstances();
    const index = instances.findIndex(instance => instance.id === id);

    if (index === -1) {
      throw new Error(`Instance with ID '${id}' not found`);
    }

    instances[index] = { ...instances[index], ...updates };
    await this.updateInstances(instances);
  }

  static async removeInstance(id: string): Promise<void> {
    const instances = this.getInstances();
    const filteredInstances = instances.filter(instance => instance.id !== id);

    if (filteredInstances.length === instances.length) {
      throw new Error(`Instance with ID '${id}' not found`);
    }

    await this.updateInstances(filteredInstances);
  }

  static async enableInstance(id: string): Promise<void> {
    await this.updateInstance(id, { enabled: true });
  }

  static async disableInstance(id: string): Promise<void> {
    await this.updateInstance(id, { enabled: false });
  }

  static async testInstance(id: string): Promise<boolean> {
    const instance = this.getInstance(id);
    if (!instance) {
      throw new Error(`Instance with ID '${id}' not found or disabled`);
    }

    try {
      const { SiyuanClient } = await import('../api/siyuan-client');
      const client = new SiyuanClient(instance.url, instance.token);
      return await client.testConnection();
    } catch (error) {
      console.error(`Connection test failed for instance ${id}:`, error);
      return false;
    }
  }

  private static async updateInstances(instances: Types.InstanceConfig[]): Promise<void> {
    const config = vscode.workspace.getConfiguration('siyuan');
    await config.update(this.CONFIG_KEY, instances, vscode.ConfigurationTarget.Global);
  }

  static async showAddInstanceDialog(): Promise<void> {
    const id = await vscode.window.showInputBox({
      title: 'Add Siyuan Instance',
      prompt: 'Enter unique instance ID',
      placeHolder: 'e.g., work, personal'
    });

    if (!id) {
      return;
    }

    const name = await vscode.window.showInputBox({
      title: 'Add Siyuan Instance',
      prompt: 'Enter display name',
      placeHolder: 'e.g., Work Notes, Personal Notes',
      value: id
    });

    if (!name) {
      return;
    }

    const url = await vscode.window.showInputBox({
      title: 'Add Siyuan Instance',
      prompt: 'Enter Siyuan API URL',
      placeHolder: 'e.g., http://localhost:6806'
    });

    if (!url) {
      return;
    }

    const token = await vscode.window.showInputBox({
      title: 'Add Siyuan Instance',
      prompt: 'Enter API token',
      placeHolder: 'Enter your API token from Siyuan settings',
      password: true
    });

    if (!token) {
      return;
    }

    try {
      await this.addInstance({ id, name, url, token });
      vscode.window.showInformationMessage(`Siyuan instance '${name}' added successfully`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to add instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  static async showInstanceQuickPick(): Promise<Types.InstanceConfig | undefined> {
    const instances = this.getInstances().filter(inst => inst.enabled);

    if (instances.length === 0) {
      vscode.window.showInformationMessage('No enabled Siyuan instances found. Please add an instance first.');
      return undefined;
    }

    const items = instances.map(instance => ({
      label: instance.name,
      description: instance.url,
      detail: `ID: ${instance.id}`,
      instance
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: 'Select Siyuan Instance',
      placeHolder: 'Choose an instance to connect to'
    });

    return selected?.instance;
  }

  static getEnabledInstances(): Types.InstanceConfig[] {
    return this.getInstances().filter(instance => instance.enabled);
  }

  static hasInstances(): boolean {
    return this.getEnabledInstances().length > 0;
  }
}