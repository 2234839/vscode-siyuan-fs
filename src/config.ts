// ABOUTME: Configuration management for SiYuanFS connections

export interface SiYuanConnection {
    id: string;
    name: string;
    baseUrl: string;
    apiToken: string;
    timeout: number;
    isActive: boolean;
    createdAt: number;
    lastUsed?: number;
}

export interface SiYuanFSConfig {
    connections: SiYuanConnection[];
    activeConnectionId: string | null;
}

export interface SiYuanFSSettings {
    siyuanfs: {
        connections: SiYuanConnection[];
        activeConnectionId: string | null;
    };
}

export const DEFAULT_CONFIG: SiYuanFSConfig = {
    connections: [],
    activeConnectionId: null
};