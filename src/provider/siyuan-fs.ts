import * as vscode from 'vscode';
import { SiyuanClient } from '../api/siyuan-client';
import { ConfigurationManager } from '../config/settings';
import { PathUtils } from '../utils/path-utils';
import { ErrorHandler } from '../utils/error-handler';
import { FileCache } from './file-cache';
import * as Types from '../api/types';

export class SiyuanFileSystemProvider implements vscode.FileSystemProvider {
  private readonly _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  private readonly _onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  private readonly clients = new Map<string, SiyuanClient>();
  private readonly cache = new FileCache();

  // Track watched directories
  private readonly watchedUris = new Set<string>();

  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile;

  constructor() {
    // Initialize clients for all configured instances
    this.initializeClients();

    // Clean up cache periodically
    setInterval(() => {
      this.cache.cleanup();
    }, 60000); // Every minute
  }

  private initializeClients(): void {
    const instances = ConfigurationManager.getInstances();

    for (const instance of instances) {
      if (instance.enabled) {
        const client = new SiyuanClient(instance.url, instance.token);
        this.clients.set(instance.id, client);
      }
    }
  }

  private getClient(uri: vscode.Uri): SiyuanClient {
    const parsed = PathUtils.parseUri(uri);
    const client = this.clients.get(parsed.instanceId);

    if (!client) {
      throw vscode.FileSystemError.FileNotFound(`Instance '${parsed.instanceId}' not found or disabled`);
    }

    return client;
  }

  // Root directory listing
  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    const parsed = PathUtils.parseUri(uri);

    try {
      if (parsed.isRoot) {
        return {
          type: vscode.FileType.Directory,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 0
        };
      }

      if (parsed.isNotebooks) {
        return {
          type: vscode.FileType.Directory,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 0
        };
      }

      if (parsed.isNotebooks && parsed.notebookId) {
        // Check if notebook exists
        const client = this.getClient(uri);
        const notebooks = await client.listNotebooks();
        const notebook = notebooks.find(nb => nb.id === parsed.notebookId);

        if (!notebook) {
          throw vscode.FileSystemError.FileNotFound(`Notebook '${parsed.notebookId}' not found`);
        }

        return {
          type: vscode.FileType.Directory,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 0
        };
      }

      if (parsed.isDocuments && parsed.documentId) {
        // Check if document exists by trying to get its content
        const client = this.getClient(uri);
        const content = await this.getDocumentContent(client, parsed.documentId);

        return {
          type: vscode.FileType.File,
          ctime: Date.now(),
          mtime: Date.now(),
          size: content.length
        };
      }

      throw vscode.FileSystemError.FileNotFound('File or directory not found');
    } catch (error) {
      ErrorHandler.handle(error, 'stat');
      throw vscode.FileSystemError.FileNotFound();
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    const parsed = PathUtils.parseUri(uri);

    try {
      if (parsed.isRoot) {
        // Return instance-level directories
        return [
          ['notebooks', vscode.FileType.Directory],
          ['documents', vscode.FileType.Directory]
        ];
      }

      if (parsed.isNotebooks) {
        // List all notebooks
        const client = this.getClient(uri);
        const notebooks = await client.listNotebooks();

        return notebooks.map(notebook => [
          notebook.id,
          vscode.FileType.Directory
        ]);
      }

      if (parsed.isNotebooks && parsed.notebookId) {
        // List documents in this notebook
        const client = this.getClient(uri);

        // Get all documents via SQL query
        const documents = await this.getNotebookDocuments(client, parsed.notebookId);

        return documents.map(doc => [
          `${doc.id}.md`,
          vscode.FileType.File
        ]);
      }

      if (parsed.isDocuments) {
        // List all documents across all notebooks
        const client = this.getClient(uri);
        const documents = await this.getAllDocuments(client);

        return documents.map(doc => [
          `${doc.id}.md`,
          vscode.FileType.File
        ]);
      }

      throw vscode.FileSystemError.FileNotFound('Directory not found');
    } catch (error) {
      ErrorHandler.handle(error, 'readDirectory');
      throw vscode.FileSystemError.FileNotFound();
    }
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const parsed = PathUtils.parseUri(uri);

    try {
      if (!parsed.isDocuments || !parsed.documentId) {
        throw vscode.FileSystemError.FileNotFound('File not found');
      }

      // Check cache first
      const cacheKey = `file:${parsed.instanceId}:${parsed.documentId}`;
      const cached = this.cache.get<string>(cacheKey);

      if (cached) {
        return new TextEncoder().encode(cached);
      }

      // Fetch from Siyuan
      const client = this.getClient(uri);
      const content = await this.getDocumentContent(client, parsed.documentId);

      // Cache the result
      this.cache.set(cacheKey, content);

      return new TextEncoder().encode(content);
    } catch (error) {
      ErrorHandler.handle(error, 'readFile');
      throw vscode.FileSystemError.FileNotFound();
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean }): Promise<void> {
    const parsed = PathUtils.parseUri(uri);

    try {
      if (!parsed.isDocuments || !parsed.documentId) {
        throw vscode.FileSystemError.NoPermissions('Invalid file path');
      }

      const client = this.getClient(uri);
      const markdownContent = new TextDecoder().decode(content);

      // Update the block
      await client.updateBlock({
        dataType: 'markdown',
        data: markdownContent,
        id: parsed.documentId
      });

      // Update cache
      const cacheKey = `file:${parsed.instanceId}:${parsed.documentId}`;
      this.cache.set(cacheKey, markdownContent);

      // Emit change event
      this._emitter.fire([{
        type: vscode.FileChangeType.Changed,
        uri
      }]);
    } catch (error) {
      ErrorHandler.handle(error, 'writeFile');
      throw vscode.FileSystemError.NoPermissions('Failed to write file');
    }
  }

  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
    // For now, rename is not supported as it requires complex ID mapping
    throw vscode.FileSystemError.NoPermissions('Rename operation not supported');
  }

  async delete(uri: vscode.Uri): Promise<void> {
    const parsed = PathUtils.parseUri(uri);

    try {
      if (parsed.isDocuments && parsed.documentId) {
        const client = this.getClient(uri);
        await client.deleteDocument(parsed.documentId);

        // Clear cache
        const cacheKey = `file:${parsed.instanceId}:${parsed.documentId}`;
        this.cache.delete(cacheKey);

        // Emit change event
        this._emitter.fire([{
          type: vscode.FileChangeType.Deleted,
          uri
        }]);
      } else {
        throw vscode.FileSystemError.NoPermissions('Delete operation not supported for this resource');
      }
    } catch (error) {
      ErrorHandler.handle(error, 'delete');
      throw vscode.FileSystemError.NoPermissions('Failed to delete');
    }
  }

  createDirectory(uri: vscode.Uri): void {
    // Directory creation is not supported as structure is determined by Siyuan
    throw vscode.FileSystemError.NoPermissions('Directory creation not supported');
  }

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[] }): vscode.Disposable {
    const key = uri.toString();
    this.watchedUris.add(key);

    // Return a disposable that removes the watch
    return new vscode.Disposable(() => {
      this.watchedUris.delete(key);
    });
  }

  // Helper methods
  private async getDocumentContent(client: SiyuanClient, documentId: string): Promise<string> {
    try {
      const blockData = await client.getBlockKramdown(documentId);
      return blockData.kramdown;
    } catch (error) {
      // Fallback: try to export as markdown
      try {
        const exportData = await client.request('/api/export/exportMdContent', { id: documentId });
        return (exportData as any).content as string;
      } catch (fallbackError) {
        console.warn('Fallback export failed:', fallbackError);
        throw error;
      }
    }
  }

  private async getNotebookDocuments(client: SiyuanClient, notebookId: string): Promise<Array<{ id: string; title: string }>> {
    try {
      // Use listDocsByPath API to get documents in this notebook
      const response = await client.listDocsByPath(notebookId, '/');

      return response.files.map(file => ({
        id: file.id,
        title: file.name.replace('.sy', '') || 'Untitled'
      }));
    } catch (error) {
      ErrorHandler.handle(error, 'getNotebookDocuments');
      return [];
    }
  }

  private async getAllDocuments(client: SiyuanClient): Promise<Array<{ id: string; title: string }>> {
    try {
      // Get all notebooks first, then get documents from each
      const notebooks = await client.listNotebooks();
      const allDocuments: Array<{ id: string; title: string }> = [];

      for (const notebook of notebooks) {
        try {
          const response = await client.listDocsByPath(notebook.id, '/');
          const documents = response.files.map(file => ({
            id: file.id,
            title: file.name.replace('.sy', '') || 'Untitled'
          }));
          allDocuments.push(...documents);
        } catch (error) {
          console.warn(`Failed to get documents from notebook ${notebook.id}:`, error);
        }
      }

      return allDocuments.slice(0, 200); // Limit to 200 documents
    } catch (error) {
      ErrorHandler.handle(error, 'getAllDocuments');
      return [];
    }
  }

  // Public utility methods
  refreshCache(): void {
    this.cache.clear();
  }

  async testConnection(instanceId: string): Promise<boolean> {
    const client = this.clients.get(instanceId);
    if (!client) {
      return false;
    }

    return await client.testConnection();
  }

  getClients(): Map<string, SiyuanClient> {
    return new Map(this.clients);
  }
}