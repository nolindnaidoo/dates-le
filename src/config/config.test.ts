import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { _resetMockState, _setConfig } from '../__mocks__/vscode';
import { DATE_KINDS } from '../extraction/kinds';
import {
	DEFAULT_EXCLUDED_FILES,
	DEFAULT_EXCLUDED_FOLDERS,
	DEFAULT_EXCLUDED_PATHS,
} from '../workspace/defaults';
import { CONFIG_DEFAULTS, getConfiguration } from './config';

/**
 * CONFIG_DEFAULTS must stay identical to the defaults declared in
 * package.json contributes.configuration — v1.x shipped with the two
 * silently disagreeing (openResultsSideBySide et al).
 */
describe('config defaults parity with package.json', () => {
	const manifest = JSON.parse(
		readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
	) as {
		contributes: {
			configuration: { properties: Record<string, { default: unknown }> };
		};
	};
	const props = manifest.contributes.configuration.properties;

	const KEY_MAP: Record<string, keyof typeof CONFIG_DEFAULTS> = {
		'dates-le.clipboardIncludesPositions': 'clipboardIncludesPositions',
		'dates-le.copyToClipboardEnabled': 'copyToClipboardEnabled',
		'dates-le.dateOrder': 'dateOrder',
		'dates-le.kinds': 'kinds',
		'dates-le.notificationsLevel': 'notificationsLevel',
		'dates-le.openResultsSideBySide': 'openResultsSideBySide',
		'dates-le.safety.enabled': 'safetyEnabled',
		'dates-le.safety.fileSizeWarnBytes': 'safetyFileSizeWarnBytes',
		'dates-le.showPositions': 'showPositions',
		'dates-le.statusBar.enabled': 'statusBarEnabled',
		'dates-le.telemetryEnabled': 'telemetryEnabled',
		'dates-le.workspace.scanAlwaysInclude': 'workspaceScanAlwaysInclude',
		'dates-le.workspace.scanExcludes': 'workspaceScanExcludes',
		'dates-le.workspace.scanMaxFiles': 'workspaceScanMaxFiles',
		'dates-le.workspace.scanMaxResults': 'workspaceScanMaxResults',
		'dates-le.workspace.scanPatterns': 'workspaceScanPatterns',
		'dates-le.workspace.scanRespectGitignore': 'workspaceScanRespectGitignore',
		'dates-le.workspace.scanSkipBinaryFiles': 'workspaceScanSkipBinaryFiles',
		'dates-le.workspace.scanUseDefaultExcludes':
			'workspaceScanUseDefaultExcludes',
	};

	it('covers every declared setting', () => {
		expect(Object.keys(props).sort()).toEqual(Object.keys(KEY_MAP).sort());
	});

	for (const [manifestKey, defaultsKey] of Object.entries(KEY_MAP)) {
		it(`${manifestKey} default matches`, () => {
			expect(CONFIG_DEFAULTS[defaultsKey]).toEqual(props[manifestKey]?.default);
		});
	}
});

describe('the README states the scan limits the code uses', () => {
	const readme = readFileSync(join(__dirname, '..', '..', 'README.md'), 'utf8');
	const grouped = (n: number) => n.toLocaleString('en-US');

	it('in the settings table', () => {
		expect(readme).toContain(
			`| \`dates-le.workspace.scanMaxFiles\` | \`${CONFIG_DEFAULTS.workspaceScanMaxFiles}\` |`,
		);
		expect(readme).toContain(
			`| \`dates-le.workspace.scanMaxResults\` | \`${CONFIG_DEFAULTS.workspaceScanMaxResults}\` |`,
		);
	});

	it('in the prose', () => {
		expect(readme).toContain(
			`It stops at ${grouped(CONFIG_DEFAULTS.workspaceScanMaxFiles)} files or ${grouped(CONFIG_DEFAULTS.workspaceScanMaxResults)} listed occurrences.`,
		);
	});
});

describe('the README lists the folders a scan skips', () => {
	it('exactly as the code has them', () => {
		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const listed =
			/<!-- built-in-folders -->\n(.*)\n<!-- \/built-in-folders -->/
				.exec(readme)?.[1]
				?.split(', ')
				.map((entry) => entry.replace(/`/g, ''));
		expect(listed).toEqual([...DEFAULT_EXCLUDED_FOLDERS, '*.egg-info']);
	});

	it('and the files, exactly as the code has them', () => {
		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		const listed = /<!-- built-in-files -->\n(.*)\n<!-- \/built-in-files -->/
			.exec(readme)?.[1]
			?.split(', ')
			.map((entry) => entry.replace(/`/g, ''));
		expect(listed).toEqual([
			...DEFAULT_EXCLUDED_FILES,
			...DEFAULT_EXCLUDED_PATHS,
		]);
	});
});

describe('dates-le.kinds', () => {
	afterEach(() => {
		_resetMockState();
	});

	it('leaves the Unix time out by default, and offers every kind the engine emits', () => {
		expect(CONFIG_DEFAULTS.kinds).not.toContain('unix');
		expect([...CONFIG_DEFAULTS.kinds, 'unix'].sort()).toEqual(
			[...DATE_KINDS].sort(),
		);
		const manifest = JSON.parse(
			readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'),
		);
		const items =
			manifest.contributes.configuration.properties['dates-le.kinds'].items;
		expect(items.enum).toEqual([...DATE_KINDS]);
		expect(items.enumDescriptions).toHaveLength(DATE_KINDS.length);
	});

	it('keeps the kinds it knows and drops what is not one', () => {
		_setConfig('dates-le.kinds', ['unix', 'nonsense', 'iso', 7]);
		expect(getConfiguration().kinds).toEqual(['iso', 'unix']);
	});

	it('reads an empty list as nothing, and a value that is not a list as the default', () => {
		_setConfig('dates-le.kinds', []);
		expect(getConfiguration().kinds).toEqual([]);
		_setConfig('dates-le.kinds', 'iso');
		expect(getConfiguration().kinds).toEqual(CONFIG_DEFAULTS.kinds);
	});

	it('is in the README settings table with its default', () => {
		const readme = readFileSync(
			join(__dirname, '..', '..', 'README.md'),
			'utf8',
		);
		expect(readme).toContain(
			`| \`dates-le.kinds\` | ${CONFIG_DEFAULTS.kinds.map((kind) => `\`${kind}\``).join(', ')} |`,
		);
	});
});
