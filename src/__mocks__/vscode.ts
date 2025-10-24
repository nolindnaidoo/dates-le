// Mock VS Code API for testing
export const window = {
	activeTextEditor: undefined,
	showInformationMessage: jest.fn(),
	showWarningMessage: jest.fn(),
	showErrorMessage: jest.fn(),
	createStatusBarItem: jest.fn(() => ({
		text: '',
		tooltip: '',
		command: '',
		show: jest.fn(),
		hide: jest.fn(),
		dispose: jest.fn(),
	})),
	createOutputChannel: jest.fn(() => ({
		appendLine: jest.fn(),
		dispose: jest.fn(),
	})),
	withProgress: jest.fn(),
};

export const workspace = {
	openTextDocument: jest.fn(),
	applyEdit: jest.fn(),
	getConfiguration: jest.fn(),
};

export const commands = {
	registerCommand: jest.fn(),
	executeCommand: jest.fn(),
};

export const env = {
	clipboard: {
		writeText: jest.fn(),
	},
};

export const ViewColumn = {
	Beside: 2,
};

export const StatusBarAlignment = {
	Left: 1,
	Right: 2,
};

export const Range = jest.fn();
export const WorkspaceEdit = jest.fn();
