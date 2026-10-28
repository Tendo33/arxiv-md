// R4-01：pdf-parse-core 包结构 + 不准反向依赖插件代码
import fs from 'fs';
import path from 'path';
import { ESLint } from 'eslint';

const ROOT = path.resolve(__dirname, '../..');
const CORE = path.join(ROOT, 'packages/pdf-parse-core');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : (p.endsWith('.js') ? [p] : []);
  });
}

describe('R4-01 pdf-parse-core 包结构', () => {
  test('workspace / 别名都已配置', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.workspaces).toEqual(['packages/*']);
    expect(pkg.scripts.lint).toContain('packages/pdf-parse-core/src');
    expect(fs.readFileSync(path.join(ROOT, 'webpack.config.js'), 'utf8')).toMatch(/"@pdf-core": path\.resolve\(__dirname, "packages\/pdf-parse-core\/src"\)/);
    expect(require(path.join(ROOT, 'jest.config.js')).moduleNameMapper['^@pdf-core/(.*)$']).toBe('<rootDir>/packages/pdf-parse-core/src/$1');
    expect(JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')).name).toBe('pdf-parse-core');
  });

  test('core 源码里没有对插件代码的 import', () => {
    const bad = /from\s+['"](@core|@utils|@config|@ui|@background|@\/)|from\s+['"][./]*\/?src\//;
    for (const f of walk(path.join(CORE, 'src'))) {
      expect([path.relative(ROOT, f), bad.test(fs.readFileSync(f, 'utf8'))]).toEqual([path.relative(ROOT, f), false]);
    }
  });

  test('eslint no-restricted-imports 会拦住反向 import', async () => {
    const eslint = new ESLint({ cwd: ROOT });
    const file = path.join(CORE, 'src/__probe__.js');
    for (const spec of ['@core/converter', '@ui/popup/popup', '@utils/storage', '../../../src/core/task-manager']) {
      const [res] = await eslint.lintText(`import x from '${spec}';\nexport default x;\n`, { filePath: file });
      expect(res.messages.map((m) => m.ruleId)).toContain('no-restricted-imports');
    }
    const [ok] = await eslint.lintText('import { x } from \'./errors\';\nexport default x;\n', { filePath: file });
    expect(ok.messages.filter((m) => m.ruleId === 'no-restricted-imports')).toEqual([]);
    // 插件代码本身不受此规则影响
    const [plugin] = await eslint.lintText('import x from \'@core/task-manager\';\nexport default x;\n', { filePath: path.join(ROOT, 'src/background/__probe__.js') });
    expect(plugin.messages.filter((m) => m.ruleId === 'no-restricted-imports')).toEqual([]);
  });
});
