// ABOUTME: HTTP client for SiYuanFS - using semantic API wrapper

import { SiYuanFSConfig, SiYuanFSFile } from './constants';
import { SiYuanApiClient } from './siyuanApi';

export class SiYuanFSHttpClient {
    private api: SiYuanApiClient;

    constructor(config: SiYuanFSConfig) {
        this.api = new SiYuanApiClient(config);
    }

    async listFiles(path: string = '/'): Promise<SiYuanFSFile[]> {
        return this.api.listFiles(path);
    }

    async readFile(path: string): Promise<string> {
        return this.api.getFileContent(path);
    }

    async writeFile(path: string, content: string, options?: { create?: boolean; overwrite?: boolean }): Promise<void> {
        return this.api.setFileContent(path, content, options);
    }

    async deleteFile(path: string): Promise<void> {
        return this.api.removeFile(path);
    }

    async createDirectory(path: string): Promise<void> {
        return this.api.createDirectory(path);
    }

    async getFileStats(path: string): Promise<SiYuanFSFile> {
        return this.api.getFileStats(path);
    }

    updateConfig(config: Partial<SiYuanFSConfig>): void {
        this.api.updateConfig(config);
    }

    getConfig(): SiYuanFSConfig {
        return this.api.getConfig();
    }

    // Expose the raw API client for advanced usage
    getApiClient(): SiYuanApiClient {
        return this.api;
    }
}