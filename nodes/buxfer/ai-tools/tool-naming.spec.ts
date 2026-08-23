/**
 * Self-check for tool-name derivation. No framework, no build step:
 *
 *   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
 *     nodes/buxfer/ai-tools/tool-naming.spec.ts
 *
 * (the flag only silences Node's "typeless package.json" notice; plain
 * `node nodes/buxfer/ai-tools/tool-naming.spec.ts` works the same)
 *
 * Throws on the first broken assumption, prints one line and exits 0 otherwise.
 * Excluded from tsc by the `**\/*.spec.ts` rule in tsconfig.json, so it never
 * ships in dist.
 */
import assert from 'node:assert/strict';
import type { INode } from 'n8n-workflow';
import { MAX_TOOL_NAME_LENGTH, buildToolNames } from './tool-naming.ts';

const node = (id: string, name: string) => ({ id, name }) as INode;
const VALID = /^[a-zA-Z0-9_-]+$/;

// (a) Default node name -> clean, hash-free names.
assert.deepEqual(buildToolNames(node('7f3c1a20-1111-4c2b-9e01-aaaaaaaaaaaa', 'Buxfer AI Tools'), 'transaction'), {
	main: 'transaction_Buxfer_AI_Tools',
	listAccounts: 'listAccounts_Buxfer_AI_Tools',
	listTags: 'listTags_Buxfer_AI_Tools',
});

// A renamed-but-canonical node also stays clean.
assert.equal(buildToolNames(node('7f3c1a20-2222-4c2b-9e01-aaaaaaaaaaaa', 'Buxfer Expenses'), 'tag').main, 'tag_Buxfer_Expenses');

// (b) Two different long names sharing a prefix past the 64-char budget.
const longA = node('aaaaaaaa-1111-4c2b-9e01-aaaaaaaaaaaa', 'Buxfer Expenses For The Australian Operations Team Alpha');
const longB = node('bbbbbbbb-2222-4c2b-9e01-bbbbbbbbbbbb', 'Buxfer Expenses For The Australian Operations Team Beta');
assert.notEqual(buildToolNames(longA, 'transaction').main, buildToolNames(longB, 'transaction').main);
assert.notEqual(buildToolNames(longA, 'transaction').listTags, buildToolNames(longB, 'transaction').listTags);

// (c) Names differing only in characters sanitization erases.
const spaced = node('cccccccc-1111-4c2b-9e01-cccccccccccc', 'Buxfer Expenses');
const scored = node('dddddddd-2222-4c2b-9e01-dddddddddddd', 'Buxfer_Expenses');
assert.equal(buildToolNames(spaced, 'transaction').main, 'transaction_Buxfer_Expenses');
assert.equal(buildToolNames(scored, 'transaction').main, 'transaction_Buxfer_Expenses__dddddddd');

// (d) No execution context is involved: a bare {id, name} is enough, and a node
// with an unusable id still gets deterministic, distinct names.
const bangA = node('', 'Buxfer Expenses!');
const bangB = node('', 'Buxfer Expenses?');
assert.deepEqual(buildToolNames(bangA, 'tag'), buildToolNames(node('', 'Buxfer Expenses!'), 'tag'));
assert.notEqual(buildToolNames(bangA, 'tag').main, buildToolNames(bangB, 'tag').main);

// Sweep: every name valid, within budget, and globally unique across resources.
const nodes: INode[] = [
	node('7f3c1a20-1111-4c2b-9e01-aaaaaaaaaaaa', 'Buxfer AI Tools'),
	node('7f3c1a20-3333-4c2b-9e01-aaaaaaaaaaaa', 'Buxfer AI Tools1'),
	longA,
	longB,
	spaced,
	scored,
	bangA,
	bangB,
	node('eeeeeeee-1111-4c2b-9e01-eeeeeeeeeeee', 'Buxfer  Expenses'),
	node('ffffffff-1111-4c2b-9e01-ffffffffffff', 'Buxfer-Expenses'),
	node('99999999-1111-4c2b-9e01-999999999999', '  '),
	node('88888888-1111-4c2b-9e01-888888888888', ''),
	node('77777777-1111-4c2b-9e01-777777777777', 'Café Dépenses 🏦'),
	node('66666666-1111-4c2b-9e01-666666666666', 'x'.repeat(200)),
	node('55555555-1111-4c2b-9e01-555555555555', 'x'.repeat(200) + 'y'),
];
const seen = new Map<string, string>();
for (const n of nodes) {
	for (const resource of ['transaction', 'account', 'tag']) {
		for (const name of Object.values(buildToolNames(n, resource))) {
			assert.match(name, VALID, `invalid tool name ${name}`);
			assert.ok(name.length <= MAX_TOOL_NAME_LENGTH, `too long: ${name}`);
			const owner = `${n.id}|${n.name}`;
			const previous = seen.get(name);
			assert.ok(previous === undefined || previous === owner, `collision on ${name}: ${previous} vs ${owner}`);
			seen.set(name, owner);
		}
	}
}

process.stdout.write(`tool-naming self-check ok (${seen.size} unique names)\n`);
