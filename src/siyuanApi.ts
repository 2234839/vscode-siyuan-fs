// ABOUTME: SiYuan API client with semantic method names

import { SiYuanFSConfig, SiYuanFSFile } from './constants';
import { Logger } from './logger';

export class SiYuanApiClient {
  private config: SiYuanFSConfig;
  private logger: Logger;

  constructor(config: SiYuanFSConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
  }

  // File operations
  async listFiles(path: string = '/'): Promise<SiYuanFSFile[]> {
    this.logger.debug('/api/filetree/listFiles', { path });

    // For root path, use real SiYuan API
    if (path === '/') {
      const response = await this.request<{
        data: {
          notebooks: {
            id: '20240705122434-xzm9uhi';
            name: string;
            icon: '';
            sort: 0;
            sortMode: 15;
            closed: false;
            newFlashcardCount: 0;
            dueFlashcardCount: 0;
            flashcardCount: 0;
          }[];
        };
      }>('/api/notebook/lsNotebooks');
      if (response && response.data && Array.isArray(response.data.notebooks)) {
        const result = response.data.notebooks.map((notebook) => ({
          name: notebook.name,
          type: 'directory' as const,
          size: 0,
          ctime: paserIdDate(notebook.id).getTime(),
          mtime: paserIdDate(notebook.id).getTime(),
        }));
        this.logger.debug('call：/api/notebook/lsNotebooks', { response, result });
        return result;
      }

      throw new Error('Invalid API response format');
    } else {
      // For other paths, use simulation
      const result = await this.request<SiYuanFSFile[]>('/api/filetree/listFiles', { path });
      this.logger.debug('/api/filetree/listFiles', `Simulation for path: ${path}`);
      return result;
    }
  }

  async getFileContent(path: string): Promise<string> {
    const response = await this.request<{ content: string }>('/api/file/getFileContent', { path });
    return response.content;
  }

  async setFileContent(
    path: string,
    content: string,
    options?: { create?: boolean; overwrite?: boolean },
  ): Promise<void> {
    await this.request('/api/file/setFileContent', {
      path,
      content,
      create: options?.create ?? true,
      overwrite: options?.overwrite ?? true,
    });
  }

  async removeFile(path: string): Promise<void> {
    await this.request('/api/file/removeFile', { path });
  }

  async createDirectory(path: string): Promise<void> {
    await this.request('/api/file/createDirectory', { path });
  }

  async getFileStats(path: string): Promise<SiYuanFSFile> {
    return this.request<SiYuanFSFile>('/api/file/getFileStats', { path });
  }

  // Note operations (for future implementation)
  async getNotebookList(): Promise<any[]> {
    return this.request('/api/notebook/listNotebooks');
  }

  async getNoteContent(noteId: string): Promise<any> {
    return this.request('/api/note/getNoteContent', { noteId });
  }

  async createNote(notebookId: string, title: string, content: string): Promise<any> {
    return this.request('/api/note/createNote', { notebookId, title, content });
  }

  async updateNote(noteId: string, content: string): Promise<any> {
    return this.request('/api/note/updateNote', { noteId, content });
  }

  async deleteNote(noteId: string): Promise<any> {
    return this.request('/api/note/deleteNote', { noteId });
  }

  // Search operations
  async searchNotes(query: string): Promise<any[]> {
    return this.request('/api/search/searchNotes', { query });
  }

  async searchBlocks(query: string): Promise<any[]> {
    return this.request('/api/search/searchBlocks', { query });
  }

  private async request<T>(endpoint: string, data?: any): Promise<T> {
    this.logger.debug(`Making HTTP request: ${endpoint}`, data);

    // For endpoints that should still be simulated (except listFiles which is handled separately)
    const simulatedEndpoints = [
      '/api/file/getFileContent',
      '/api/file/setFileContent',
      '/api/file/removeFile',
      '/api/file/createDirectory',
      '/api/file/getFileStats',
      '/api/notebook/listNotebooks',
      '/api/note/getNoteContent',
      '/api/note/createNote',
      '/api/note/updateNote',
      '/api/note/deleteNote',
      '/api/search/searchNotes',
      '/api/search/searchBlocks',
    ];

    if (simulatedEndpoints.includes(endpoint)) {
      // Use simulation for these endpoints
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));
      const result = this.simulateApiResponse('', endpoint, data);
      this.logger.debug(`Request completed (simulation):${endpoint}`, result);
      return result as T;
    }

    // For real API calls (currently only lsNotebooks)
    try {
      const url = new URL(endpoint, this.config.baseUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiToken) {
        headers['Authorization'] = `Token ${this.config.apiToken}`;
      }

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers,
        // signal: AbortSignal.timeout(this.config.timeout || 10000),
      };

      if (data) {
        fetchOptions.body = JSON.stringify(data);
      }
      this.logger.debug(`Request: ${url.toString()}`, fetchOptions);

      /**
       * 下面这个错误会由于代理触发，所以要注意代理放行局域网请求
       * [2025-09-21T08:43:29.825Z] [ERROR] Request failed: /api/notebook/lsNotebooks TypeError: fetch failed
       *   TypeError: fetch failed
       *       at node:internal/deps/undici/undici:13510:13
       */
      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.logger.debug(`Request completed: ${endpoint}`, result);
      return result as T;
    } catch (error) {
      this.logger.error(`Request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Note: simulateApiResponse is no longer used since we use real HTTP requests
  // but simulation methods are kept for fallback scenarios

  private simulateApiResponse(_method: string, endpoint: string, data?: any): any {
    // Simulate different API responses based on endpoint
    if (endpoint === '/api/file/getFileContent') {
      return { content: this.simulateGetFileContent(data?.path) };
    } else if (endpoint === '/api/file/setFileContent') {
      this.simulateSetFileContent(data?.path, data?.content);
      return { success: true };
    } else if (endpoint === '/api/file/removeFile') {
      this.simulateRemoveFile(data?.path);
      return { success: true };
    } else if (endpoint === '/api/file/createDirectory') {
      this.simulateCreateDirectory(data?.path);
      return { success: true };
    } else if (endpoint === '/api/file/getFileStats') {
      return this.simulateGetFileStats(data?.path);
    } else if (endpoint === '/api/notebook/listNotebooks') {
      return { data: { notebooks: [] } };
    } else if (endpoint === '/api/note/getNoteContent') {
      return { content: '# Simulated Note Content' };
    } else if (endpoint === '/api/note/createNote') {
      return { success: true, noteId: 'simulated_note_id' };
    } else if (endpoint === '/api/note/updateNote') {
      return { success: true };
    } else if (endpoint === '/api/note/deleteNote') {
      return { success: true };
    } else if (endpoint === '/api/search/searchNotes') {
      return { data: { notes: [] } };
    } else if (endpoint === '/api/search/searchBlocks') {
      return { data: { blocks: [] } };
    }

    // Default response for other endpoints
    return { success: true, message: 'Operation completed' };
  }

  private simulateGetFileContent(path: string): string {
    const mockContents: Record<string, string> = {
      '/file.txt': 'Hello from SiYuanFS Virtual File System!',
      '/README.md':
        '# SiYuanFS\n\nThis is a virtual file system that simulates SiYuan API responses.\n\n## Features\n- Lazy loading\n- HTTP API simulation\n- TypeScript support',
      '/documents/note1.md': '# Note 1\n\nThis is the first note in the documents folder.',
      '/documents/note2.md':
        '# Note 2\n\nThis is the second note with some **markdown** formatting.',
      '/documents/projects/project1.md': '# Project 1\n\nInitial project documentation.',
      '/documents/projects/project2.md':
        '# Project 2\n\nAdvanced project features and specifications.',
      '/src/main.ts':
        'console.log("Hello from SiYuanFS!");\n\n// Main entry point\nimport { helper } from "./utils/helper";\n\nhelper();',
      '/src/utils/helper.ts':
        'export function helper(): string {\n    return "Helper function called";\n}\n\n// Utility functions for the application',
    };

    const content = mockContents[path];
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }

    return content;
  }

  private simulateSetFileContent(path: string, content: string): void {
    console.log(`[MOCK] Writing to ${path}: ${content.substring(0, 50)}...`);
  }

  private simulateRemoveFile(path: string): void {
    console.log(`[MOCK] Deleting file: ${path}`);
  }

  private simulateCreateDirectory(path: string): void {
    console.log(`[MOCK] Creating directory: ${path}`);
  }

  private simulateGetFileStats(path: string): SiYuanFSFile {
    const mockStats: Record<string, SiYuanFSFile> = {
      '/': { name: '', type: 'directory', size: 0, ctime: Date.now(), mtime: Date.now() },
      '/file.txt': {
        name: 'file.txt',
        type: 'file',
        size: 42,
        ctime: Date.now() - 86400000,
        mtime: Date.now() - 3600000,
      },
      '/README.md': {
        name: 'README.md',
        type: 'file',
        size: 128,
        ctime: Date.now() - 172800000,
        mtime: Date.now() - 7200000,
      },
      '/documents': {
        name: 'documents',
        type: 'directory',
        size: 0,
        ctime: Date.now() - 259200000,
        mtime: Date.now() - 10800000,
      },
      '/src': {
        name: 'src',
        type: 'directory',
        size: 0,
        ctime: Date.now() - 345600000,
        mtime: Date.now() - 14400000,
      },
    };

    const stats = mockStats[path];
    if (!stats) {
      throw new Error(`File not found: ${path}`);
    }

    return stats;
  }

  updateConfig(config: Partial<SiYuanFSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SiYuanFSConfig {
    return { ...this.config };
  }
}

function paserIdDate(id: `${string}-${string}`) {
  return new Date(id.split('-')[0]);
}
