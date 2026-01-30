// Place at: .github/scripts/generate-manifest.js
// Node script that generates usii/manifest.json from the usii folder.
// It inlines captions (.caption files) for media entries.

const fs = require('fs').promises;
const path = require('path');

const ROOT = process.cwd();
const USII_DIR = path.join(ROOT, 'usii');
const OUT_PATH = path.join(USII_DIR, 'manifest.json');

function stripNumberPrefix(name) { return name.replace(/^\d+[_-]/, ''); }
function snakeToTitle(n) {
  return stripNumberPrefix(n).replace(/_/g, ' ').split(' ')
    .map(w=> w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function exists(p){ try { await fs.access(p); return true; } catch { return false; } }
async function listDir(dir){ try { return await fs.readdir(dir, { withFileTypes: true }); } catch { return []; } }

async function findFirstFile(dir, names){
  for (const n of names) {
    if (await exists(path.join(dir, n))) return n;
  }
  return null;
}

async function readCaption(dir, baseName){
  const capPath = path.join(dir, `${baseName}.caption`);
  if (!await exists(capPath)) return null;
  try { return (await fs.readFile(capPath, 'utf8')).trim(); } catch { return null; }
}

async function buildManifest(){
  const manifest = { generated_at: new Date().toISOString(), units: [] };
  const units = await listDir(USII_DIR);
  for (const uEnt of units.filter(d => d.isDirectory())) {
    const unitName = uEnt.name;
    const unitPath = path.join(USII_DIR, unitName);
    const unitIconFile = await findFirstFile(unitPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
    const unitObj = { name: unitName, title: snakeToTitle(unitName), icon: unitIconFile ? path.posix.join('usii', unitName, unitIconFile) : null, lessons: [] };

    const lessons = await listDir(unitPath);
    for (const lEnt of lessons.filter(d => d.isDirectory())) {
      const lessonName = lEnt.name;
      const lessonPath = path.join(unitPath, lessonName);
      const lessonIconFile = await findFirstFile(lessonPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
      const lessonObj = { name: lessonName, title: snakeToTitle(lessonName), icon: lessonIconFile ? path.posix.join('usii', unitName, lessonName, lessonIconFile) : null, tabs: [] };

      const tabs = await listDir(lessonPath);
      for (const tEnt of tabs.filter(d => d.isDirectory())) {
        const tabName = tEnt.name;
        const tabPath = path.join(lessonPath, tabName);
        const tabIconFile = await findFirstFile(tabPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
        const tabObj = { name: tabName, title: snakeToTitle(tabName), icon: tabIconFile ? path.posix.join('usii', unitName, lessonName, tabName, tabIconFile) : null, cards: [] };

        const cards = await listDir(tabPath);
        for (const cEnt of cards.filter(d => d.isDirectory())) {
          const cardName = cEnt.name;
          const cardPath = path.join(tabPath, cardName);
          const cardFiles = await listDir(cardPath);

          const bgFile = await findFirstFile(cardPath, ['bgimage.png','bgimage.jpg','bgimage.jpeg']);
          const mediaFiles = cardFiles.filter(f=>f.isFile()).map(f=>f.name).filter(n => !/^bgimage\./i.test(n) && /\.(png|jpe?g|mp4|svg)$/i.test(n));

          const media = [];
          for (const mf of mediaFiles) {
            const base = mf.replace(/\.[^/.]+$/, '');
            const caption = await readCaption(cardPath, base);
            const type = /\.mp4$/i.test(mf) ? 'video' : 'image';
            media.push({ name: mf, type, caption: caption || null });
          }

          const hasWriting = await exists(path.join(cardPath, 'writing'));

          const cardObj = {
            name: cardName,
            title: snakeToTitle(cardName),
            bgimage: bgFile ? path.posix.join('usii', unitName, lessonName, tabName, cardName, bgFile) : null,
            has_writing: !!hasWriting,
            media
          };
          tabObj.cards.push(cardObj);
        }

        lessonObj.tabs.push(tabObj);
      }

      unitObj.lessons.push(lessonObj);
    }

    manifest.units.push(unitObj);
  }

  return manifest;
}

async function writeIfChanged(outPath, obj){
  const newText = JSON.stringify(obj, null, 2) + '\n';
  let oldText = null;
  try{ oldText = await fs.readFile(outPath,'utf8'); } catch {}
  if (oldText !== newText) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, newText, 'utf8');
    console.log('WROTE', outPath);
    return true;
  }
  console.log('UNCHANGED');
  return false;
}

(async ()=>{
  try {
    const manifest = await buildManifest();
    const changed = await writeIfChanged(OUT_PATH, manifest);
    process.exit(0);
  } catch (err) {
    console.error('ERROR', err);
    process.exit(2);
  }
})();
