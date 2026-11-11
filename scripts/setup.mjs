import { randomBytes } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function setup(root) {
  const secrets = path.join(root, '.secrets');
  await mkdir(secrets, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(secrets, 0o700);
  async function credential(folder, name) {
    const directory = path.join(secrets, folder);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (process.platform !== 'win32') await chmod(directory, 0o700);
    const target = path.join(directory, name);
    try {
      await writeFile(target, randomBytes(48).toString('hex') + '\n', { flag: 'wx', mode: 0o444 });
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    }
    const value = (await readFile(target, 'utf8')).trim();
    if (value.length < 32) throw new Error('Credencial existente inválida: ' + folder + '/' + name);
    if (process.platform !== 'win32') await chmod(target, 0o444);
    return value;
  }
  for (const name of ['access-key', 'secret-key', 'admin-password'])
    await credential('storage', name);
  const values = {};
  for (const name of [
    'migration-password',
    'api-password',
    's3-bootstrap-access-key',
    's3-bootstrap-secret-key',
    's3-api-access-key',
    's3-api-secret-key',
    's3-admin-password',
  ]) {
    values[name] = await credential('backend', name);
  }
  const identities = {
    identities: [
      {
        name: 'bootstrap',
        credentials: [
          {
            accessKey: values['s3-bootstrap-access-key'],
            secretKey: values['s3-bootstrap-secret-key'],
          },
        ],
        actions: ['Admin', 'Read', 'Write', 'List', 'Tagging'],
      },
      {
        name: 'api',
        credentials: [
          { accessKey: values['s3-api-access-key'], secretKey: values['s3-api-secret-key'] },
        ],
        actions: [
          'Read:smart-cadastros-private',
          'Write:smart-cadastros-private',
          'List:smart-cadastros-private',
        ],
      },
    ],
  };
  const identityPath = path.join(secrets, 'backend', 's3-identities.json');
  try {
    await writeFile(identityPath, JSON.stringify(identities) + '\n', { flag: 'wx', mode: 0o444 });
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
    if (
      JSON.stringify(JSON.parse(await readFile(identityPath, 'utf8'))) !==
      JSON.stringify(identities)
    ) {
      throw new Error('Identidades S3 divergem das credenciais existentes; revise a configuração.');
    }
  }
  try {
    await copyFile(
      path.join(root, '.env.example'),
      path.join(root, '.env'),
      constants.COPYFILE_EXCL,
    );
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await setup(fileURLToPath(new URL('../', import.meta.url)));
  console.log('Configuração pronta. .env e credenciais existentes foram preservados.');
}
