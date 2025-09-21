// ABOUTME: SiYuan API client with semantic method names

import { SiYuanFSConfig, SiYuanFSFile } from './constants';
import { Logger } from './logger';

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
        this.logger.debug('call：/api/notebook/lsNotebooks', { response, result });
        return result;
      }

      throw new Error('Invalid API response format');
    } else {
      // For other paths, get IDs first then use real API
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        try {
          // Get notebook ID from cache or API
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

          if (notebookId) {
            // Handle nested .folder paths - represents a document hierarchy with subdocuments
            // The key insight: each level of path must be converted to an ID to build the final queryPath
            let isFolderPath = false;
            let queryPath = '/';
            let targetDocName = '';

            // Check if the last part ends with .folder
            const isLastPartFolder =
              pathParts.length > 0 && pathParts[pathParts.length - 1].endsWith('.folder');
            isFolderPath = isLastPartFolder;

            if (isFolderPath && pathParts.length > 1) {
              // Extract notebook name and path parts
              const notebookName = pathParts[0];
              const documentPathParts = pathParts.slice(1, -1); // Remove notebook and .folder suffix
              targetDocName = pathParts[pathParts.length - 1].replace('.folder', '');

              this.logger.debug('Processing nested .folder path', {
                notebookName,
                documentPathParts,
                targetDocName,
                originalPath: path,
              });

              // For .folder paths, we need to get the parent path (all parts except the last .folder)
              // and the target document ID separately
              let parentPath = '/';
              let targetDocId = '';

              if (documentPathParts.length > 0) {
                // Build parent path incrementally - parent paths should NOT have .sy extension
                let currentPath = '';
                let currentRealPath = '/';

                for (let i = 0; i < documentPathParts.length; i++) {
                  const part = documentPathParts[i].replace('.folder', '');
                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                  const hPath = `/${currentPath}`;

                  try {
                    this.logger.debug('Converting parent path part to real path', { hPath, part });
                    const pathIds = await this.getIDsByHPath(hPath, notebookId);
                    if (pathIds.length > 0) {
                      // Parent paths should NOT have .sy extension
                      if (currentRealPath === '/') {
                        currentRealPath = `/${pathIds[0]}`;
                      } else {
                        currentRealPath = `${currentRealPath}/${pathIds[0]}`;
                      }
                      this.logger.debug('Converted parent path part', {
                        part,
                        realPath: currentRealPath,
                      });
                    } else {
                      this.logger.warn('Could not convert parent path part', { hPath });
                      break;
                    }
                  } catch (error) {
                    this.logger.warn('Error converting parent path part', { hPath, error });
                    break;
                  }
                }

                parentPath = currentRealPath;
              }

              // Now get the target document ID
              const targetHPath =
                '/' +
                pathParts
                  .slice(1)
                  .map((part) => part.replace('.folder', ''))
                  .join('/');
              try {
                this.logger.debug('Getting target document ID', {
                  targetHPath,
                  pathParts,
                  cleanParts: pathParts.slice(1).map((part) => part.replace('.folder', '')),
                });
                const targetIds = await this.getIDsByHPath(targetHPath, notebookId);
                this.logger.debug('getIDsByHPath result', { targetIds, targetHPath });
                if (targetIds.length > 0) {
                  targetDocId = targetIds[0];
                  this.logger.debug('Found target document ID', { targetDocId });
                } else {
                  this.logger.warn('No target IDs found for HPath', { targetHPath });
                }
              } catch (error) {
                this.logger.warn('Failed to get target document ID', { error, targetHPath });
              }

              // Build the final queryPath: parentPath + targetDocId + .sy
              if (targetDocId) {
                if (parentPath === '/') {
                  queryPath = `/${targetDocId}.sy`;
                } else {
                  queryPath = `${parentPath}/${targetDocId}.sy`;
                }
                this.logger.debug('Built final queryPath for .folder', {
                  parentPath,
                  targetDocId,
                  queryPath,
                });
              } else {
                queryPath = parentPath;
                this.logger.debug('No target document ID found, using parent path', { queryPath });
              }
            } else {
              // Normal path - convert directly by building path incrementally
              const cleanPathParts = pathParts.slice(1).map((part) => part.replace('.folder', ''));

              if (cleanPathParts.length > 0) {
                let currentPath = '';
                let currentRealPath = '/';

                for (let i = 0; i < cleanPathParts.length; i++) {
                  const part = cleanPathParts[i];
                  currentPath = currentPath ? `${currentPath}/${part}` : part;
                  const hPath = `/${currentPath}`;

                  try {
                    this.logger.debug('Converting normal path part to real path', { hPath, part });
                    const pathIds = await this.getIDsByHPath(hPath, notebookId);
                    if (pathIds.length > 0) {
                      // For normal paths, all parent parts should NOT have .sy extension
                      // Only the final part (if it's the last one) should have .sy
                      if (i === cleanPathParts.length - 1) {
                        // Last part gets .sy extension
                        if (currentRealPath === '/') {
                          currentRealPath = `/${pathIds[0]}.sy`;
                        } else {
                          currentRealPath = `${currentRealPath}/${pathIds[0]}.sy`;
                        }
                      } else {
                        // Parent parts don't get .sy extension
                        if (currentRealPath === '/') {
                          currentRealPath = `/${pathIds[0]}`;
                        } else {
                          currentRealPath = `${currentRealPath}/${pathIds[0]}`;
                        }
                      }
                      this.logger.debug('Converted normal path part', {
                        part,
                        realPath: currentRealPath,
                        isLast: i === cleanPathParts.length - 1,
                      });
                    } else {
                      this.logger.warn('Could not convert normal path part', { hPath });
                      break;
                    }
                  } catch (error) {
                    this.logger.warn('Error converting normal path part', { hPath, error });
                    break;
                  }
                }

                queryPath = currentRealPath;
              }
            }

            this.logger.debug('Final path conversion', {
              isFolderPath,
              queryPath,
              targetDocName,
              originalPath: path,
            });

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
              path: queryPath,
            });

            if (response?.code === 0 && response?.data?.files) {
              const result: SiYuanFSFile[] = [];

              // For .folder queries, we already queried the target document, so just return its subdocuments
              if (isFolderPath) {
                this.logger.debug('Processing .folder query results', {
                  queryPath,
                  fileCount: response.data.files.length,
                  targetDocName,
                });

                // Return the subdocuments directly
                response.data.files.forEach((file) => {
                  const displayName = file.name.replace('.sy', '');
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
                      name: displayName + '.folder',
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
                  const displayName = file.name.replace('.sy', '');
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
                      name: displayName + '.folder', // Add suffix to avoid naming conflict
                      type: 'directory' as const,
                      size: 0,
                      ctime: file.ctime * 1000,
                      mtime: file.mtime * 1000,
                    });
                  }
                });
              }

              this.logger.debug('/api/filetree/listDocsByPath', {
                path,
                notebookId,
                queryPath,
                result,
              });
              return result;
            }
          }
        } catch (error) {
          this.logger.error('Failed to list real files for path', { path, error });
        }
      }

      // Fallback to simulation
      const result = await this.request<SiYuanFSFile[]>('/api/filetree/listFiles', { path });
      this.logger.debug('/api/filetree/listFiles', `Fallback simulation for path: ${path}`);
      return result;
    }
  }

  async getFileContent(path: string): Promise<string> {
    const response = await this.request<{
      data: {
        id: '20201225220955-l154bn4';
        kramdown: '* {: id="20201225220955-2nn1mns"}新建笔记本，在笔记本下新建文档\n  {: id="20210131155408-3t627wc"}\n* {: id="20201225220955-uwhqnug"}在编辑器中输入 <kbd>/</kbd> 触发功能菜单\n  {: id="20210131155408-btnfw88"}\n* {: id="20201225220955-04ymi2j"}((20200813131152-0wk5akh "在内容块中遨游"))、((20200822191536-rm6hwid "窗口和页签"))\n  {: id="20210131155408-hh1z442"}';
      };
    }>('/api/block/getBlockKramdown', { path });
    return response.data.kramdown;
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

    // Handle notebook paths
    if (!path.includes('/') || path.split('/').filter(Boolean).length === 1) {
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
      }
    }

    // Handle .sy files - use block attributes through real SiYuan API
    if (path.endsWith('.sy')) {
      try {
        const pathParts = path.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
          const notebookName = pathParts[0];
          const notebookId = this.notebookCache.get(notebookName);

          if (notebookId) {
            // Get the file name without extension for block lookup
            const fileName = pathParts[pathParts.length - 1].replace('.sy', '');

            // Use getIDsByHPath to find the block ID for this file
            const relativePath =
              pathParts.length > 2 ? '/' + pathParts.slice(1, -1).join('/') : '/';
            const parentIds = await this.getIDsByHPath(relativePath, notebookId);

            if (parentIds.length > 0) {
              // Get child blocks to find the specific document
              const childBlocks = await this.request<{
                code: number;
                msg: string;
                data: Array<{
                  id: string;
                  type: string;
                  [key: string]: any;
                }>;
              }>('/api/block/getChildBlocks', { id: parentIds[0] });

              if (childBlocks?.code === 0 && childBlocks?.data) {
                // Find the matching block by name/title
                const targetBlock = childBlocks.data.find((block) => {
                  // Try to get block attributes to check title
                  return true; // For now, use the first block as fallback
                });

                if (targetBlock) {
                  // Get the block attributes for detailed info
                  const blockAttrs = await this.request<{
                    code: number;
                    msg: string;
                    data: {
                      id: string;
                      title?: string;
                      type: string;
                      updated?: string;
                      created?: string;
                      [key: string]: any;
                    };
                  }>('/api/attr/getBlockAttrs', { id: targetBlock.id });

                  if (blockAttrs?.code === 0 && blockAttrs?.data) {
                    const blockData = blockAttrs.data;

                    // Get file size by exporting content to estimate size
                    let size = 0;
                    try {
                      const exportResponse = await this.request<{
                        code: number;
                        msg: string;
                        data: {
                          content: string;
                          hPath: string;
                        };
                      }>('/api/export/exportMdContent', { id: targetBlock.id });

                      if (exportResponse?.code === 0 && exportResponse?.data) {
                        size = new TextEncoder().encode(exportResponse.data.content).length;
                      }
                    } catch (sizeError) {
                      this.logger.debug('Could not get file size from export', {
                        error: sizeError,
                      });
                    }

                    return {
                      name: pathParts[pathParts.length - 1].replace('.sy', ''),
                      type: 'file',
                      size,
                      ctime: blockData.created ? new Date(blockData.created).getTime() : Date.now(),
                      mtime: blockData.updated ? new Date(blockData.updated).getTime() : Date.now(),
                    };
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn('Failed to get file stats via SiYuan API, using fallback', {
          path,
          error,
        });
      }
    }

    // Handle .folder virtual directories
    if (path.endsWith('.folder')) {
      const originalPath = path.replace('.folder', '');
      try {
        // Use the original .sy file's stats as base
        const originalStats = await this.getFileStats(originalPath);
        return {
          ...originalStats,
          name: path.split('/').pop()!.replace('.folder', ''),
          type: 'directory',
        };
      } catch (error) {
        this.logger.warn('Failed to get stats for .folder, using fallback', { path, error });
      }
    }

    // For any other case, use listDocsByPath to derive file info
    try {
      const pathParts = path.split('/').filter(Boolean);
      if (pathParts.length >= 2) {
        const notebookName = pathParts[0];
        const notebookId = this.notebookCache.get(notebookName);

        if (notebookId) {
          // Convert human-readable parent path to real SiYuan file path
          const parentHPath = '/' + pathParts.slice(1, -1).join('/');
          let parentRealPath = '/';

          if (parentHPath !== '/') {
            try {
              const parentIds = await this.getIDsByHPath(parentHPath, notebookId);
              if (parentIds.length > 0) {
                parentRealPath = `/${parentIds[0]}.sy`;
              }
            } catch (error) {
              this.logger.warn('Failed to get parent real path in getFileStats', {
                parentHPath,
                error,
              });
            }
          }

          const listResponse = await this.request<{
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
            path: parentRealPath,
          });

          if (listResponse?.code === 0 && listResponse?.data?.files) {
            const targetFile = listResponse.data.files.find(
              (file) =>
                file.name === pathParts[pathParts.length - 1] ||
                file.name + '.folder' === pathParts[pathParts.length - 1],
            );

            if (targetFile) {
              return {
                name: pathParts[pathParts.length - 1],
                type: targetFile.subFileCount !== undefined ? 'directory' : 'file',
                size: targetFile.size,
                ctime: targetFile.ctime * 1000,
                mtime: targetFile.mtime * 1000,
              };
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not derive stats from listDocsByPath', { path, error });
    }

    // Final fallback - return basic info
    const fileName = path.split('/').pop() || '';
    return {
      name: fileName,
      type: fileName.endsWith('.folder') ? 'directory' : 'file',
      size: 0,
      ctime: Date.now(),
      mtime: Date.now(),
    };
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

  updateConfig(config: Partial<SiYuanFSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SiYuanFSConfig {
    return { ...this.config };
  }

  // Utility methods for ID resolution
  async getIDsByHPath(path: string, notebookId?: string): Promise<string[]> {
    try {
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
        throw new Error('Cannot determine notebook ID for path');
      }

      this.logger.debug('getIDsByHPath API call', { path, targetNotebookId });
      const response = await this.request<{
        code: number;
        msg: string;
        data: string[];
      }>('/api/filetree/getIDsByHPath', {
        path,
        notebook: targetNotebookId,
      });

      this.logger.debug('getIDsByHPath API response', { response, path, targetNotebookId });
      if (response?.code === 0 && Array.isArray(response.data)) {
        return response.data;
      }

      throw new Error(response?.msg || 'Invalid API response format');
    } catch (error) {
      this.logger.error(`Failed to get IDs by HPath: ${path}`, error);
      throw error;
    }
  }
}

function paserIdDate(id: `${string}-${string}`) {
  return new Date(id.split('-')[0]);
}
