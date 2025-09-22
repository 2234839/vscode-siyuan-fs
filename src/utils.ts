// ABOUTME: Utility functions for error handling

import * as vscode from 'vscode';
import { Logger } from './logger';

export function logAndThrow(logger: Logger, message: string): never {
  const stack = new Error().stack?.split('\n').slice(3, 8).join('\n') || 'No stack trace available';
  logger.error(`${message}:\n${stack}`);
  throw new Error(message);
}

export function logAndThrowVscodeError(logger: Logger, uri: vscode.Uri, errorType: 'FileNotFound' | 'FileExists' | 'Unavailable', errorOrMessage?: string | Error): never {
  const errorMessage = typeof errorOrMessage === 'string' ? errorOrMessage : errorOrMessage?.message;
  const errorToLog = errorMessage || `${errorType}: ${uri.toString()}`;

  const stack = new Error().stack?.split('\n').slice(3, 8).join('\n') || 'No stack trace available';
  logger.error(`${errorToLog}:\n${stack}`);

  switch (errorType) {
    case 'FileNotFound':
      throw vscode.FileSystemError.FileNotFound(uri);
    case 'FileExists':
      throw vscode.FileSystemError.FileExists(uri);
    case 'Unavailable':
      throw vscode.FileSystemError.Unavailable(errorMessage);
  }
}