import * as vscode from 'vscode';
import type { Configuration } from '../types';

export interface SafetyResult {
	proceed: boolean;
	message: string;
}

export function handleSafetyChecks(
	document: vscode.TextDocument,
	config: Configuration,
): SafetyResult {
	if (!config.safetyEnabled) {
		return { proceed: true, message: '' };
	}

	// Check file size
	if (document.getText().length > config.safetyFileSizeWarnBytes) {
		return {
			proceed: false,
			message: vscode.l10n.t(
				'File size ({0} bytes) exceeds safety threshold ({1} bytes)',
				document.getText().length,
				config.safetyFileSizeWarnBytes,
			),
		};
	}

	return { proceed: true, message: '' };
}
