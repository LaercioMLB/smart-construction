const base = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8081').replace(/\/$/, '');
async function check(route, expected = 200) {
  const response = await fetch(base + route, { signal: AbortSignal.timeout(20000) });
  if (response.status !== expected) throw new Error(route + ': status ' + response.status);
  return response;
}
for (const route of [
  '/',
  '/catalogo',
  '/servicos',
  '/contato',
  '/admin/login',
  '/api/v1/health/live',
  '/api/v1/health/ready',
])
  await check(route);
const config = await (await check('/api/v1/cadastros/configuracao')).json();
if (
  !config.habilitado ||
  config.versao_termos !== 'termos-lab-2026-11-11' ||
  config.versao_privacidade !== 'privacidade-lab-2026-11-11'
)
  throw new Error('Configuração/versões dos cadastros divergem do laboratório.');
const page = await (await check('/faca-parte/profissional')).text();
if (!page.includes('Declaro') || page.includes('Cadastros indisponíveis neste ambiente'))
  throw new Error('Formulário profissional indisponível.');
await check('/api/v1/admin/cadastros', 401);
console.log(
  JSON.stringify({
    result: 'PASS',
    scope:
      'páginas, API/banco, formulário, versões e proteção administrativa; sem escrita de cadastros',
  }),
);
