import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'src/ui'), { recursive: true });
fs.mkdirSync(path.join(dist, 'src/game'), { recursive: true });

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

for (const file of ['index.html']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

for (const file of [
  'src/ui/app.js',
  'src/ui/styles.css',
  'src/game/config.js',
  'src/game/moduleEffects.js',
  'src/game/random.js',
  'src/game/state.js',
  'src/game/reducer.js'
]) {
  const dest = path.join(dist, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(root, file), dest);
}

copyDir(path.join(root, 'src/ui/assets'), path.join(dist, 'src/ui/assets'));

console.log('Built web bundle to dist/');
