import fs from 'node:fs';
import { randomBytes } from 'node:crypto';

fs.mkdirSync('/secrets', { recursive: true });
for (const [name, bytes] of [
  ['access-key', 16],
  ['secret-key', 32],
  ['admin-password', 24],
]) {
  const target = `/secrets/${name}`;
  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, randomBytes(bytes).toString('hex') + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  }
}
console.log('Credenciais prontas em .secrets/storage. Valores existentes foram preservados.');
