// ABOUTME: SiYuanFS file system provider implementation

import * as vscode from 'vscode';
import { SIYUANFS_SCHEME, SiYuanFSConfig, SiYuanFSFile as SiYuanFSFileData } from './constants';
import { SiYuanFSHttpClient } from './SiYuanFSHttpClient';
import { Logger } from './logger';

export class SiYuanFSFile implements vscode.FileStat {
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;

    name: string;
    path: string;

    constructor(fileData: SiYuanFSFileData, filePath: string) {
        this.type = fileData.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File;
        this.ctime = fileData.ctime || Date.now();
        this.mtime = fileData.mtime || Date.now();
        this.size = fileData.size || 0;
        this.name = fileData.name;
        this.path = filePath;
    }
}

export class SiYuanFS implements vscode.FileSystemProvider {
    private client: SiYuanFSHttpClient;
    private config: SiYuanFSConfig;
    private logger: Logger;

    constructor(config: SiYuanFSConfig) {
        this.config = config;
        this.logger = Logger.getInstance();
        this.client = new SiYuanFSHttpClient(config);
        this.logger.info('SiYuanFS file system provider initialized');
    }

    // --- manage file metadata

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        try {
            const path = this.getPathFromUri(uri);
            const fileData = await this.client.getFileStats(path);
            return new SiYuanFSFile(fileData, path);
        } catch (error) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        try {
            const path = this.getPathFromUri(uri);

            const files = await this.client.listFiles(path);

            const result = files.map(file => {
                const displayName = file.type === 'directory' ? file.name : (file.name.endsWith('.md') ? file.name : file.name + '.md');
                return [
                    displayName,
                    file.type === 'directory' ? vscode.FileType.Directory : vscode.FileType.File
                ] as [string, vscode.FileType];
            });

            return result;
        } catch (error: any) {
            this.logger.error(`FileSystem Error: readDirectory ${this.getPathFromUri(uri)}`, error);
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    // --- manage file contents

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        try {
            const path = this.getPathFromUri(uri);
            const content = await this.client.readFile(path);
            return new TextEncoder().encode(content);
        } catch (error) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
        const path = this.getPathFromUri(uri);
        const contentStr = new TextDecoder().decode(content);

        try {
            await this.client.writeFile(path, contentStr, options);
            this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
        } catch (error: any) {
            if (error.message.includes('exists')) {
                throw vscode.FileSystemError.FileExists(uri);
            } else if (error.message.includes('not found')) {
                throw vscode.FileSystemError.FileNotFound(uri);
            } else {
                throw vscode.FileSystemError.Unavailable(error.message);
            }
        }
    }

    // --- manage files/folders

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
        // Note: HTTP API might not support rename directly, this is a placeholder
        // Implementation would depend on the actual API capabilities
        try {
            const oldPath = this.getPathFromUri(oldUri);
            const newPath = this.getPathFromUri(newUri);

            // Read content from old file
            const content = await this.client.readFile(oldPath);

            // Write to new file
            await this.client.writeFile(newPath, content, { create: true, overwrite: options.overwrite });

            // Delete old file
            await this.client.deleteFile(oldPath);

            this._fireSoon(
                { type: vscode.FileChangeType.Deleted, uri: oldUri },
                { type: vscode.FileChangeType.Created, uri: newUri }
            );
        } catch (error: any) {
            throw vscode.FileSystemError.Unavailable(error.message);
        }
    }

    async delete(uri: vscode.Uri): Promise<void> {
        try {
            const path = this.getPathFromUri(uri);
            await this.client.deleteFile(path);
            this._fireSoon({ uri, type: vscode.FileChangeType.Deleted });
        } catch (error: any) {
            throw vscode.FileSystemError.FileNotFound(uri);
        }
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        try {
            const path = this.getPathFromUri(uri);
            await this.client.createDirectory(path);
            this._fireSoon({ type: vscode.FileChangeType.Created, uri });
        } catch (error: any) {
            throw vscode.FileSystemError.Unavailable(error.message);
        }
    }

    // --- lookup helpers

    private getPathFromUri(uri: vscode.Uri): string {
        if (uri.scheme !== SIYUANFS_SCHEME) {
            throw new Error(`Invalid URI scheme: ${uri.scheme}`);
        }
        const path = uri.path || '/';
        return path;
    }

    // --- manage file events

    private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    private _bufferedEvents: vscode.FileChangeEvent[] = [];
    private _fireSoonHandle?: NodeJS.Timeout;

    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

    watch(_resource: vscode.Uri): vscode.Disposable {
        // Note: For HTTP-based file system, real-time watching might not be feasible
        // This is a basic implementation that doesn't actually watch for changes
        return new vscode.Disposable(() => { });
    }

    private _fireSoon(...events: vscode.FileChangeEvent[]): void {
        this._bufferedEvents.push(...events);

        if (this._fireSoonHandle) {
            clearTimeout(this._fireSoonHandle);
        }

        this._fireSoonHandle = setTimeout(() => {
            this._emitter.fire(this._bufferedEvents);
            this._bufferedEvents.length = 0;
        }, 5);
    }

    // --- configuration

    updateConfig(config: Partial<SiYuanFSConfig>): void {
        this.config = { ...this.config, ...config };
        this.client = new SiYuanFSHttpClient(this.config);
    }

    getConfig(): SiYuanFSConfig {
        return { ...this.config };
    }
}