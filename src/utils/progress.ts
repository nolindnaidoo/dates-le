import * as vscode from 'vscode';

export async function showProgress<T>(
	message: string,
	task: () => Promise<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: message,
				cancellable: false,
			},
			async (progress) => {
				try {
					progress.report({ increment: 0 });
					const result = await task();
					progress.report({ increment: 100 });
					resolve(result);
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}

export async function showProgressWithCancellation<T>(
	message: string,
	task: (token: vscode.CancellationToken) => Promise<T>,
): Promise<T> {
	return new Promise((resolve, reject) => {
		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: message,
				cancellable: true,
			},
			async (progress, token) => {
				try {
					progress.report({ increment: 0 });
					const result = await task(token);
					progress.report({ increment: 100 });
					resolve(result);
				} catch (error) {
					reject(error);
				}
			},
		);
	});
}
