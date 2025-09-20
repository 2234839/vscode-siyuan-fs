import * as vscode from 'vscode';
import { type } from 'arktype';
import * as Types from '../api/types';

export class ErrorHandler {
  static handle(error: unknown, context: string): void {
    console.error(`[${context}] Error:`, error);

    if (error instanceof Types.SiyuanApiError) {
      this.handleApiError(error, context);
    } else if (error instanceof Types.NetworkError) {
      this.handleNetworkError(error, context);
    } else if (error instanceof Types.ValidationError) {
      this.handleValidationError(error, context);
    } else if (error instanceof type.errors) {
      this.handleArkTypeError(error, context);
    } else if (error instanceof Error) {
      this.handleGenericError(error, context);
    } else {
      this.handleUnknownError(error, context);
    }
  }

  private static handleApiError(error: Types.SiyuanApiError, context: string): void {
    let message = `${context}: API Error (${error.code})`;

    switch (error.code) {
      case 401:
        message = 'Authentication failed. Please check your API token.';
        break;
      case 403:
        message = 'Access denied. Please check your permissions.';
        break;
      case 404:
        message = 'Resource not found.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      default:
        if (error.msg) {
          message += `: ${error.msg}`;
        }
    }

    vscode.window.showErrorMessage(message);
  }

  private static handleNetworkError(error: Types.NetworkError, context: string): void {
    const message = `${context}: Network error - ${error.message}`;
    vscode.window.showWarningMessage(message);
  }

  private static handleValidationError(error: Types.ValidationError, context: string): void {
    const message = `${context}: Validation error - ${error.message}`;
    vscode.window.showErrorMessage(message);

    if (process.env.NODE_ENV === 'development') {
      console.error('Validation details:', error.cause);
    }
  }

  private static handleArkTypeError(error: type.errors, context: string): void {
    const message = `${context}: Type validation error - ${error.summary}`;
    vscode.window.showErrorMessage(message);

    if (process.env.NODE_ENV === 'development') {
      console.error('Type validation details:', error);
    }
  }

  private static handleGenericError(error: Error, context: string): void {
    const message = `${context}: ${error.message}`;
    vscode.window.showErrorMessage(message);
  }

  private static handleUnknownError(error: unknown, context: string): void {
    const message = `${context}: Unknown error occurred`;
    vscode.window.showErrorMessage(message);
    console.error('Unknown error details:', error);
  }

  static async showUserFriendlyError(error: unknown, operation: string): Promise<void> {
    if (error instanceof Types.SiyuanApiError) {
      let userMessage = `Failed to ${operation}`;

      switch (error.code) {
        case 401:
          userMessage += ': Invalid API token';
          break;
        case 403:
          userMessage += ': Access denied';
          break;
        case 404:
          userMessage += ': File or directory not found';
          break;
        case 500:
          userMessage += ': Server error occurred';
          break;
        default:
          userMessage += `: ${error.msg || 'Unknown error'}`;
      }

      await vscode.window.showErrorMessage(userMessage);
    } else if (error instanceof Types.NetworkError) {
      await vscode.window.showWarningMessage(
        `Network error while ${operation}. Please check your connection and try again.`
      );
    } else if (error instanceof Error) {
      await vscode.window.showErrorMessage(
        `Failed to ${operation}: ${error.message}`
      );
    } else {
      await vscode.window.showErrorMessage(
        `An unknown error occurred while ${operation}.`
      );
    }
  }

  static isRetryableError(error: unknown): boolean {
    if (error instanceof Types.NetworkError) {
      return true; // Network errors are usually retryable
    }

    if (error instanceof Types.SiyuanApiError) {
      // Some API errors are retryable
      return [500, 502, 503, 504].includes(error.code);
    }

    return false;
  }

  static shouldShowDetails(error: unknown): boolean {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Show details for validation errors in all environments
    return error instanceof Types.ValidationError;
  }

  static logError(error: unknown, context: string): void {
    const timestamp = new Date().toISOString();
    const errorInfo = {
      timestamp,
      context,
      type: error?.constructor?.name || 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      details: error
    };

    console.error(JSON.stringify(errorInfo, null, 2));
  }

  static async showErrorWithAction(
    error: unknown,
    operation: string,
    actionLabel: string,
    action: () => Promise<void>
  ): Promise<void> {
    const errorMessage = this.getUserErrorMessage(error, operation);
    const result = await vscode.window.showErrorMessage(errorMessage, { modal: false }, actionLabel);

    if (result === actionLabel) {
      try {
        await action();
      } catch (actionError) {
        this.handle(actionError, `Error executing ${actionLabel}`);
      }
    }
  }

  private static getUserErrorMessage(error: unknown, operation: string): string {
    if (error instanceof Types.SiyuanApiError) {
      switch (error.code) {
        case 401:
          return `Authentication failed while ${operation}. Please check your API token.`;
        case 403:
          return `Access denied while ${operation}. Please check your permissions.`;
        case 404:
          return `Resource not found while ${operation}.`;
        case 500:
          return `Server error occurred while ${operation}. Please try again later.`;
        default:
          return `Failed to ${operation}: ${error.msg || 'Unknown error'}`;
      }
    }

    if (error instanceof Types.NetworkError) {
      return `Network error while ${operation}. Please check your connection.`;
    }

    if (error instanceof Error) {
      return `Failed to ${operation}: ${error.message}`;
    }

    return `An unknown error occurred while ${operation}.`;
  }
}