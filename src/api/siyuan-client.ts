import { type } from 'arktype';
import * as Types from './types';

export class SiyuanClient {
  private baseUrl: string;
  private token: string;

  constructor(url: string, token: string) {
    this.baseUrl = url.replace(/\/$/, '');
    this.token = token;
  }

  public async request<T>(
    endpoint: string,
    data?: unknown,
    _schema?: ReturnType<typeof type>
  ): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[SiyuanClient] Request: POST ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${this.token}`
        },
        body: data ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Types.SiyuanApiError(401, 'Authentication failed');
        }
        if (response.status === 403) {
          throw new Types.SiyuanApiError(403, 'Access denied');
        }
        throw new Types.NetworkError(`HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json() as { code: number; msg: string; data: unknown };

      if (responseData.code !== 0) {
        throw new Types.SiyuanApiError(
          responseData.code,
          responseData.msg || 'API request failed',
          responseData.data
        );
      }

      return responseData.data as T;
    } catch (error) {
      if (error instanceof Types.SiyuanApiError || error instanceof Types.NetworkError) {
        throw error;
      }
      if (error instanceof type.errors) {
        throw new Types.ValidationError('Response validation failed', error);
      }
      throw new Types.NetworkError('Unknown error occurred', error as Error);
    }
  }

  // Notebook operations
  async listNotebooks(): Promise<Types.Notebook[]> {
    const response = await this.request('/api/notebook/lsNotebooks', undefined);
    return (response as any).notebooks as Types.Notebook[];
  }

  async openNotebook(notebookId: string): Promise<void> {
    await this.request('/api/notebook/openNotebook', { notebook: notebookId });
  }

  async closeNotebook(notebookId: string): Promise<void> {
    await this.request('/api/notebook/closeNotebook', { notebook: notebookId });
  }

  // Block operations
  async getBlockKramdown(blockId: string): Promise<Types.BlockKramdown> {
    return this.request('/api/block/getBlockKramdown', { id: blockId }, Types.BlockKramdownSchema);
  }

  async updateBlock(data: Types.BlockUpdate): Promise<void> {
    await this.request('/api/block/updateBlock', data);
  }

  async getChildBlocks(parentId: string): Promise<Array<{ id: string; type: string; subType?: string }>> {
    const response = await this.request('/api/block/getChildBlocks', { id: parentId });
    return (response as any).blocks as Array<{ id: string; type: string; subType?: string }>;
  }

  // Document operations
  async createDocument(data: Types.DocumentCreate): Promise<string> {
    return this.request('/api/filetree/createDocWithMd', data, type("string"));
  }

  async renameDocument(documentId: string, title: string): Promise<void> {
    await this.request('/api/filetree/renameDocByID', { id: documentId, title });
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.request('/api/filetree/removeDocByID', { id: documentId });
  }

  // File system operations
  async readFile(path: string): Promise<Buffer> {
    const url = `${this.baseUrl}/api/file/getFile?path=${encodeURIComponent(path)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${this.token}`
      }
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    const errorData = await response.json();
    throw new Types.SiyuanApiError(errorData.code, errorData.msg);
  }

  async writeFile(path: string, content: Buffer): Promise<void> {
    // Note: FormData and Blob are browser APIs, not available in Node.js
    // This method needs to be implemented differently for Node.js environment
    throw new Error('writeFile not implemented in Node.js environment');
  }

  async readDirectory(path: string): Promise<Types.FileInfo[]> {
    const response = await this.request('/api/file/readDir', { path });
    return (response as any).files as Types.FileInfo[];
  }

  async deleteFile(path: string): Promise<void> {
    await this.request('/api/file/removeFile', { path });
  }

  async renameFile(path: string, newPath: string): Promise<void> {
    await this.request('/api/file/renameFile', { path, newPath });
  }

  // Path operations
  async getHPathByID(id: string): Promise<string> {
    const response = await this.request('/api/filetree/getHPathByID', { id: id });
    return (response as any) as string;
  }

  async getPathByID(id: string): Promise<{ notebook: string; path: string }> {
    const response = await this.request('/api/filetree/getPathByID', { id: id });
    return (response as any) as { notebook: string; path: string };
  }

  async getIDsByHPath(path: string, notebook: string): Promise<string[]> {
    const response = await this.request('/api/filetree/getIDsByHPath', { path, notebook });
    return (response as any) as string[];
  }

  // List documents by path (better than SQL query)
  async listDocsByPath(notebook: string, path: string): Promise<{
    box: string;
    files: Array<{
      path: string;
      name: string;
      id: string;
      size: number;
      mtime: number;
      subFileCount: number;
      hMtime: string;
      hCtime: string;
    }>;
    path: string;
  }> {
    const response = await this.request('/api/filetree/listDocsByPath', { notebook, path });
    return (response as any).data as any;
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      await this.listNotebooks();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  // Get instance info
  getBaseUrl(): string {
    return this.baseUrl;
  }

  getToken(): string {
    return this.token;
  }
}