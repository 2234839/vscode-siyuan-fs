// ABOUTME: Constants for SiYuanFS virtual file system protocol

export const SIYUANFS_SCHEME = 'siyuanfs';

export interface SiYuanFSFile {
    name: string;
    type: 'file' | 'directory';
    size?: number;
    ctime?: number;
    mtime?: number;
    content?: string;
    children?: SiYuanFSFile[];
}

export interface SiYuanFSConfig {
    baseUrl: string;
    apiToken?: string;
    timeout?: number;
}