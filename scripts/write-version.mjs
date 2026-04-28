/**
 * write-version.mjs — build 前自動寫 public/version.json
 * 內容：當前 package.json 版本 + build timestamp + 短 commit SHA（如果有 git）
 * 前端啟動後 fetch 這支與 bundled 版本對比，偵測新版部署。
 */
import { readFile, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

let commit = 'local';
try {
    commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
    // git 不可用就略過
}

const payload = {
    version: pkg.version,
    commit,
    buildTime: new Date().toISOString(),
};

await writeFile(
    join(root, 'public', 'version.json'),
    JSON.stringify(payload, null, 2) + '\n',
    'utf8'
);

console.log(`[write-version] ${payload.version} (${commit}) @ ${payload.buildTime}`);
