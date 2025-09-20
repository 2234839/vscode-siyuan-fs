import * as vscode from 'vscode';
import * as Types from '../api/types';

export class PathUtils {
  private static readonly SCHEME = 'siyuan';

  /**
   * Parse a Siyuan URI into components
   * Example: siyuan://work/notebooks/notebook-id/documents/doc-id.md
   */
  static parseUri(uri: vscode.Uri): {
    instanceId: string;
    path: string;
    isRoot: boolean;
    isNotebooks: boolean;
    isDocuments: boolean;
    notebookId?: string;
    documentId?: string;
    filename?: string;
  } {
    if (uri.scheme !== this.SCHEME) {
      throw new Error(`Invalid URI scheme: ${uri.scheme}`);
    }

    const path = uri.path.replace(/^\//, '');
    const parts = path.split('/').filter(part => part.length > 0);

    const result: {
      instanceId: string;
      path: string;
      isRoot: boolean;
      isNotebooks: boolean;
      isDocuments: boolean;
      notebookId?: string;
      documentId?: string;
      filename?: string;
    } = {
      instanceId: uri.authority,
      path: uri.path,
      isRoot: parts.length === 0,
      isNotebooks: parts[0] === 'notebooks',
      isDocuments: parts[0] === 'documents'
    };

    if (result.isNotebooks && parts.length > 1) {
      result.notebookId = parts[1];
    }

    if (result.isDocuments && parts.length > 1) {
      result.documentId = parts[1];
      if (parts[1].includes('.md')) {
        const [docId] = parts[1].split('.md');
        result.documentId = docId;
      }
      result.filename = parts[1];
    }

    return result;
  }

  /**
   * Create a Siyuan URI from components
   */
  static createUri(instanceId: string, ...pathParts: string[]): vscode.Uri {
    const path = '/' + pathParts.filter(part => part.length > 0).join('/');
    return vscode.Uri.from({
      scheme: this.SCHEME,
      authority: instanceId,
      path: path
    });
  }

  /**
   * Create root URI for an instance
   */
  static createRootUri(instanceId: string): vscode.Uri {
    return this.createUri(instanceId);
  }

  /**
   * Create notebooks root URI for an instance
   */
  static createNotebooksRootUri(instanceId: string): vscode.Uri {
    return this.createUri(instanceId, 'notebooks');
  }

  /**
   * Create notebook URI
   */
  static createNotebookUri(instanceId: string, notebookId: string): vscode.Uri {
    return this.createUri(instanceId, 'notebooks', notebookId);
  }

  /**
   * Create document URI
   */
  static createDocumentUri(instanceId: string, documentId: string, filename?: string): vscode.Uri {
    const fname = filename || `${documentId}.md`;
    return this.createUri(instanceId, 'documents', fname);
  }

  /**
   * Extract document ID from filename
   */
  static extractDocumentId(filename: string): string | null {
    const match = filename.match(/^(.+)\.md$/);
    return match ? match[1] : null;
  }

  /**
   * Generate safe filename from document title
   */
  static sanitizeFilename(title: string): string {
    return title
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  /**
   * Join path parts safely
   */
  static joinPath(...parts: string[]): string {
    return parts
      .filter(part => part.length > 0)
      .join('/')
      .replace(/\/+/g, '/');
  }

  /**
   * Get parent path
   */
  static getParentPath(path: string): string {
    const parts = path.split('/').filter(part => part.length > 0);
    if (parts.length <= 1) {
      return '/';
    }
    return '/' + parts.slice(0, -1).join('/');
  }

  /**
   * Get basename from path
   */
  static getBasename(path: string): string {
    const parts = path.split('/').filter(part => part.length > 0);
    return parts[parts.length - 1] || '';
  }

  /**
   * Check if path is root
   */
  static isRootPath(path: string): boolean {
    return path === '/' || path === '';
  }

  /**
   * Check if path is notebooks root
   */
  static isNotebooksRoot(path: string): boolean {
    return path === '/notebooks';
  }

  /**
   * Check if path is documents root
   */
  static isDocumentsRoot(path: string): boolean {
    return path === '/documents';
  }

  /**
   * Convert virtual file path to Siyuan API path
   */
  static virtualPathToSiyuanPath(virtualPath: string): string {
    // Remove /documents/ prefix and .md extension
    return virtualPath
      .replace(/^\/documents\//, '/')
      .replace(/\.md$/, '');
  }

  /**
   * Convert Siyuan API path to virtual file path
   */
  static siyuanPathToVirtualPath(siyuanPath: string): string {
    // Add /documents/ prefix and .md extension
    return '/documents/' + siyuanPath.replace(/^\//, '') + '.md';
  }

  /**
   * Validate instance ID
   */
  static validateInstanceId(instanceId: string): boolean {
    return /^[a-zA-Z0-9_-]+$/.test(instanceId);
  }

  /**
   * Get display path for UI
   */
  static getDisplayPath(uri: vscode.Uri): string {
    const parsed = this.parseUri(uri);

    if (parsed.isRoot) {
      return `siyuan://${parsed.instanceId}/`;
    }

    const pathParts = parsed.path.split('/').filter(part => part.length > 0);

    if (parsed.isNotebooks && parsed.notebookId) {
      return `📁 ${parsed.notebookId}`;
    }

    if (parsed.isDocuments && parsed.documentId) {
      return `📄 ${parsed.filename}`;
    }

    return `📂 ${pathParts.join('/')}`;
  }
}