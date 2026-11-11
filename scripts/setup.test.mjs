import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setup } from './setup.mjs';

async function temporary(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'smart-setup-'));
  try {
    await writeFile(path.join(root, '.env.example'), 'HTTP_PORT=8081\n');
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('reexecutar setup preserva .env, senhas e identidades S3', () =>
  temporary(async (root) => {
    await setup(root);
    const passwordPath = path.join(root, '.secrets/backend/api-password');
    const before = await readFile(passwordPath, 'utf8');
    assert.ok(before.trim().length >= 32);
    assert.notEqual(
      before,
      await readFile(path.join(root, '.secrets/backend/migration-password'), 'utf8'),
    );
    const identityPath = path.join(root, '.secrets/backend/s3-identities.json');
    const identity = await readFile(identityPath, 'utf8');
    await writeFile(path.join(root, '.env'), 'HTTP_PORT=8099\n');
    await setup(root);
    assert.equal(await readFile(passwordPath, 'utf8'), before);
    assert.equal(await readFile(identityPath, 'utf8'), identity);
    assert.equal(await readFile(path.join(root, '.env'), 'utf8'), 'HTTP_PORT=8099\n');
    assert.deepEqual(JSON.parse(identity).identities[1].actions, [
      'Read:smart-cadastros-private',
      'Write:smart-cadastros-private',
      'List:smart-cadastros-private',
    ]);
  }));
test('setup recusa segredo inválido sem substituí-lo', () =>
  temporary(async (root) => {
    await setup(root);
    const target = path.join(root, '.secrets/backend/api-password');
    await chmod(target, 0o644);
    await writeFile(target, 'short');
    await assert.rejects(setup(root), /Credencial existente inválida/);
    assert.equal(await readFile(target, 'utf8'), 'short');
  }));
