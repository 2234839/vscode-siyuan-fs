# SiYuanFS

This extension provides a virtual file system for SiYuan笔记 using HTTP API. It demonstrates how to implement a remote file system provider using VSCode's filesystem provider API.

## Features

* Connect to SiYuan笔记 instances via HTTP API
* Browse and edit documents remotely
* Real-time file system operations (read, write, delete, create directories)
* Configurable API endpoints and authentication
* Support for both HTTP and HTTPS connections

## Getting Started

* install this extension
* when *not* having a workspace opened, select 'F1 > [SiYuanFS] Setup Workspace' (optionally save the workspace now)
* select 'F1 > [SiYuanFS] Initialize Connection' to configure your SiYuan API settings
* select 'F1 > [SiYuanFS] Configure API Settings' to modify connection parameters
* ... try things out, e.g. browse files, edit documents, save changes via HTTP API
* 'F1 > [SiYuanFS] Reset Connection' to clear current configuration
* 'F1 > [SiYuanFS] Refresh Files' to reload file system content

## Configuration

The extension requires connection to a SiYuan笔记 instance with HTTP API enabled. Default configuration:
- Base URL: http://localhost:6806
- API Token: Optional (leave empty if no authentication required)
- Timeout: 10000ms

## Commands

* `SiYuanFS: Initialize Connection` - Set up connection to SiYuan API
* `SiYuanFS: Configure API Settings` - Modify connection parameters
* `SiYuanFS: Reset Connection` - Clear current configuration
* `SiYuanFS: Refresh Files` - Reload file system content
* `SiYuanFS: Setup Workspace` - Add SiYuanFS as workspace folder

## Implementation Notes

This extension serves as a reference for implementing remote file system providers and demonstrates:
* HTTP-based file system operations
* Asynchronous file system API usage
* Configuration management
* Error handling and user feedback