// ABOUTME: SiYuan API client with semantic method names

import { SiYuanFSConfig, SiYuanFSFile } from './constants';
import { Logger } from './logger';

function logAndThrow(logger: Logger, message: string): never {
  logger.error(message);
  throw new Error(message);
}

export class SiYuanApiClient {
  private config: SiYuanFSConfig;
  private logger: Logger;
  private notebookCache: Map<string, string>; // notebook name -> id mapping
  private notebooksLoaded: boolean = false;

  constructor(config: SiYuanFSConfig) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.notebookCache = new Map();
  }

  // File operations
  async listFiles(path: string = '/'): Promise<SiYuanFSFile[]> {
    this.logger.debug('/api/filetree/listFiles', path);

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
        // Cache notebook name -> id mapping
        this.notebookCache.clear();
        response.data.notebooks.forEach((notebook) => {
          this.notebookCache.set(notebook.name, notebook.id);
        });
        this.notebooksLoaded = true;

        const result = response.data.notebooks.map((notebook) => ({
          name: notebook.name,
          type: 'directory' as const,
          size: 0,
          ctime: paserIdDate(notebook.id).getTime(),
          mtime: paserIdDate(notebook.id).getTime(),
        }));
        return result;
      }

      logAndThrow(this.logger, 'Invalid API response format');
    } else {
      // For other paths, use the new abstract path conversion method

      const { notebookId, realPath } = await this.convertPathToRealPath(path);
      const isFolderPath = !path.endsWith('.md');
      const response = await this.request<{
        code: number;
        msg: string;
        data: {
          box: string;
          files: Array<{
            id: string;
            name: string;
            path: string;
            size: number;
            mtime: number;
            ctime: number;
            subFileCount?: number;
          }>;
        };
      }>('/api/filetree/listDocsByPath', {
        notebook: notebookId,
        path: realPath,
      });

      if (response?.code === 0 && response?.data?.files) {
        const result: SiYuanFSFile[] = [];

        // For directory queries, we already queried the target document, so just return its subdocuments
        if (isFolderPath) {
          // Return the subdocuments directly
          response.data.files.forEach((file) => {
            const displayName = file.name.replace('.sy', '') + '.md';
            result.push({
              name: displayName,
              type: 'file' as const,
              size: file.size,
              ctime: file.ctime * 1000,
              mtime: file.mtime * 1000,
            });

            // If subdocument has its own subdocuments, add as folder too
            if (file.subFileCount !== undefined && file.subFileCount > 0) {
              result.push({
                name: displayName.replace('.md', ''),
                type: 'directory' as const,
                size: 0,
                ctime: file.ctime * 1000,
                mtime: file.mtime * 1000,
              });
            }
          });
        } else {
          // Normal file query - return both files and folders
          response.data.files.forEach((file) => {
            const displayName = file.name.replace('.sy', '') + '.md';
            result.push({
              name: displayName,
              type: 'file' as const,
              size: file.size,
              ctime: file.ctime * 1000, // Convert to milliseconds
              mtime: file.mtime * 1000, // Convert to milliseconds
            });

            // If it has subFileCount > 0, also add it as a folder
            if (file.subFileCount !== undefined && file.subFileCount > 0) {
              result.push({
                name: displayName.replace('.md', ''), // Remove .md extension for directory
                type: 'directory' as const,
                size: 0,
                ctime: file.ctime * 1000,
                mtime: file.mtime * 1000,
              });
            }
          });
        }
        return result;
      }
    }
    const result = await this.request<SiYuanFSFile[]>('/api/filetree/listFiles', { path });
    return result;
  }

  async getFileContent(path: string): Promise<string> {
    // Convert path to get the block ID
    const { realPath } = await this.convertPathToRealPath(path);

    // Extract block ID from realPath (remove .sy extension if present)
    let blockId = realPath.split('/').pop()!.replace(/\.sy$/, '');

    const response = await this.request<{
      data: {
        id: string;
        kramdown: string;
      };
    }>('/api/block/getBlockKramdown', { id: blockId });

    this.logger.debug('getBlockKramdown', { blockId, md: response.data.kramdown });
    return response.data.kramdown;
  }

  async setFileContent(
    path: string,
    content: string,
    options?: { create?: boolean; overwrite?: boolean },
  ): Promise<void> {
    // Handle .md files by converting to .sy for processing
    let processingPath = path;
    if (path.endsWith('.md')) {
      processingPath = path.slice(0, -3) + '.sy';
    }

    await this.request('/api/file/setFileContent', {
      path: processingPath,
      content,
      create: options?.create ?? true,
      overwrite: options?.overwrite ?? true,
    });
  }

  async removeFile(path: string): Promise<void> {
    // Handle .md files by converting to .sy for processing
    let processingPath = path;
    if (path.endsWith('.md')) {
      processingPath = path.slice(0, -3) + '.sy';
    }

    await this.request('/api/file/removeFile', { path: processingPath });
  }

  async createDirectory(path: string): Promise<void> {
    // Handle .md files by converting to .sy for processing
    let processingPath = path;
    if (path.endsWith('.md')) {
      processingPath = path.slice(0, -3) + '.sy';
    }

    await this.request('/api/file/createDirectory', { path: processingPath });
  }

  async getFileStats(path: string): Promise<SiYuanFSFile> {
    this.logger.debug(`getFileStats:${path}`);
    // Handle root path
    if (path === '/') {
      return {
        name: '',
        type: 'directory',
        size: 0,
        ctime: Date.now(),
        mtime: Date.now(),
      };
    }

    // 处理一级路径（笔记本）
    if (path.split('/').filter(Boolean).length === 1) {
      this.logger.debug(`处理一级路径（笔记本）:${path}`);
      const notebookName = path.replace('/', '');
      if (this.notebookCache.has(notebookName)) {
        const notebookId = this.notebookCache.get(notebookName)!;
        return {
          name: notebookName,
          type: 'directory',
          size: 0,
          ctime: paserIdDate(notebookId as `${string}-${string}`).getTime(),
          mtime: paserIdDate(notebookId as `${string}-${string}`).getTime(),
        };
      } else {
        logAndThrow(this.logger, `getFileStats 此路径不存在于 notebookCache:${path}`);
      }
    }
    const { realPath } = await this.convertPathToRealPath(path);

    // Extract block ID from realPath
    const blockId = realPath.split('/').pop()!.replace(/\.sy$/, '');

    // Query the blocks table directly for document info
    const sqlResponse = await this.request<{
      code: number;
      msg: string;
      data: Array<{
        id: string;
        created: string;
        updated: string;
        length: number;
        type: string;
        subtype?: string;
      }>;
    }>('/api/query/sql', {
      stmt: `SELECT id, created, updated, length, type, subtype FROM blocks WHERE id = '${blockId}' AND type = 'd'`,
    });

    if (sqlResponse?.code === 0 && sqlResponse?.data && sqlResponse.data.length > 0) {
      const docData = sqlResponse.data[0];

      const fileName = path.split('/').pop() || '';
      // Determine file type based on whether path has .md extension
      const fileType = path.endsWith('.md') ? 'file' : 'directory';

      return {
        name: fileName,
        type: fileType,
        size: docData.length || 0,
        ctime: docData.created ? new Date(docData.created).getTime() : Date.now(),
        mtime: docData.updated ? new Date(docData.updated).getTime() : Date.now(),
      };
    }
    logAndThrow(this.logger, `File not found: ${path}`);
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

  protected async request<T>(endpoint: string, data?: any): Promise<T> {
    // All endpoints use real HTTP requests
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
    return result as T;
  }

  updateConfig(config: Partial<SiYuanFSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SiYuanFSConfig {
    return { ...this.config };
  }

  // Utility methods for ID resolution

  /**
   * Convert human-readable path to SiYuan real path with IDs
   * @param path Human-readable path (e.g., '/notebook/doc/subdoc')
   * @returns Object containing notebookId and converted realPath
   */
  async convertPathToRealPath(path: string): Promise<{ notebookId: string; realPath: string }> {
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length === 0) {
      throw new Error('Invalid path format');
    }

    // Get notebook ID
    let notebookId = this.notebookCache.get(pathParts[0]);
    if (!notebookId) {
      const rootResponse = await this.request<{
        data: {
          notebooks: { id: string; name: string }[];
        };
      }>('/api/notebook/lsNotebooks');

      if (rootResponse?.data?.notebooks) {
        const notebook = rootResponse.data.notebooks.find((nb) => nb.name === pathParts[0]);
        notebookId = notebook?.id;
        if (notebook) {
          this.notebookCache.set(notebook.name, notebook.id);
        }
      }
    }

    if (!notebookId) {
      logAndThrow(this.logger, `Notebook not found: ${pathParts[0]}`);
    }

    // For root notebook path, return '/'
    if (pathParts.length === 1) {
      return { notebookId, realPath: '/' };
    }

    // Check if it's a directory path (without .md extension)
    const isFolderPath = !pathParts[pathParts.length - 1].endsWith('.md');
    const cleanPathParts = pathParts.slice(1);

    if (isFolderPath) {
      // Handle directory path - convert to document path and get target document ID
      const parentPathParts = cleanPathParts.slice(0, -1);
      const targetDocName = cleanPathParts[cleanPathParts.length - 1];

      // Build parent real path
      let parentRealPath = '/';
      if (parentPathParts.length > 0) {
        let currentPath = '';
        for (const part of parentPathParts) {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          // Remove .md extension for hPath lookup
          const hPath = `/${currentPath.replace(/\.md$/, '')}`;
          const pathIds = await this.getIDsByHPath(hPath, notebookId);
          if (pathIds.length > 0) {
            if (parentRealPath === '/') {
              parentRealPath = `/${pathIds[0]}`;
            } else {
              parentRealPath = `${parentRealPath}/${pathIds[0]}`;
            }
          } else {
            logAndThrow(this.logger, `Cannot find path: ${hPath}`);
          }
        }
      }

      // Get target document ID
      const targetHPath = `/${cleanPathParts.join('/').replace(/\.md$/, '')}`;
      const targetIds = await this.getIDsByHPath(targetHPath, notebookId);
      if (targetIds.length === 0) {
        logAndThrow(this.logger, `Cannot find target document: ${targetHPath}`);
      }

      // Build final real path with .sy extension
      const finalPath =
        parentRealPath === '/' ? `/${targetIds[0]}.sy` : `${parentRealPath}/${targetIds[0]}.sy`;

      return { notebookId, realPath: finalPath };
    } else {
      // Handle normal path - convert incrementally
      let currentRealPath = '/';
      let currentPath = '';

      for (let i = 0; i < cleanPathParts.length; i++) {
        const part = cleanPathParts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        // Remove .md extension for hPath lookup
        const hPath = `/${currentPath.replace(/\.md$/, '')}`;
        const pathIds = await this.getIDsByHPath(hPath, notebookId);

        if (pathIds.length > 0) {
          const isLastPart = i === cleanPathParts.length - 1;
          const idWithExtension = isLastPart ? `${pathIds[0]}.sy` : pathIds[0];

          if (currentRealPath === '/') {
            currentRealPath = `/${idWithExtension}`;
          } else {
            currentRealPath = `${currentRealPath}/${idWithExtension}`;
          }
        } else {
          logAndThrow(this.logger, `Cannot find path: ${hPath}`);
        }
      }

      return { notebookId, realPath: currentRealPath };
    }
  }

  async getIDsByHPath(path: string, notebookId?: string): Promise<string[]> {
    // If notebookId is not provided, try to extract it from path using cache
    let targetNotebookId = notebookId;
    if (!targetNotebookId && path !== '/') {
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        // First try to get from cache
        if (this.notebooksLoaded) {
          targetNotebookId = this.notebookCache.get(pathParts[0]);
        }

        // If not in cache, fetch from API
        if (!targetNotebookId) {
          const rootResponse = await this.request<{
            data: {
              notebooks: { id: string; name: string }[];
            };
          }>('/api/notebook/lsNotebooks');

          if (rootResponse?.data?.notebooks) {
            const notebook = rootResponse.data.notebooks.find((nb) => nb.name === pathParts[0]);
            targetNotebookId = notebook?.id;

            // Update cache
            if (notebook) {
              this.notebookCache.set(notebook.name, notebook.id);
            }
          }
        }
      }
    }

    if (!targetNotebookId) {
      logAndThrow(this.logger, 'Cannot determine notebook ID for path');
    }

    const response = await this.request<{
      code: number;
      msg: string;
      data: string[];
    }>('/api/filetree/getIDsByHPath', {
      path,
      notebook: targetNotebookId,
    });

    if (response?.code === 0 && Array.isArray(response.data)) {
      return response.data;
    }

    logAndThrow(this.logger, response?.msg || 'Invalid API response format');
  }
}

function paserIdDate(id: `${string}-${string}`) {
  return new Date(id.split('-')[0]);
}
