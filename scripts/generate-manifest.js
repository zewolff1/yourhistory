// .github/scripts/generate-manifest.js
const fs = require('fs').promises;
const path = require('path');

const ROOT = process.cwd();            // repo root
const USII_DIR = path.join(ROOT, 'usii');
const OUT_PATH = path.join(USII_DIR, 'manifest.json');

function stripNumberPrefix(name) {
  return name.replace(/^\d+[_-]/, '');
}
function snakeToTitle(n) {
  return stripNumberPrefix(n).replace(/_/g, ' ')
    .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function existsSyncPath(p) {
  return fs.access(p).then(()=>true).catch(()=>false);
}

async function listDir(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

async function fileExists(dir, name) {
  return existsSyncPath(path.join(dir, name));
}

async function findFirstFile(dir, names) {
  for (const n of names) {
    if (await fileExists(dir, n)) return n;
  }
  return null;
}

async function buildManifest() {
  const manifest = { generated_at: new Date().toISOString(), units: [] };

  const units = await listDir(USII_DIR);
  for (const uEnt of units.filter(d => d.isDirectory())) {
    const unitName = uEnt.name;
    const unitPath = path.join(USII_DIR, unitName);
    const unitIconFile = await findFirstFile(unitPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
    const unitObj = {
      name: unitName,
      title: snakeToTitle(unitName),
      icon: unitIconFile ? path.posix.join('usii', unitName, unitIconFile) : null,
      lessons: []
    };

    const lessons = await listDir(unitPath);
    for (const lEnt of lessons.filter(d => d.isDirectory())) {
      const lessonName = lEnt.name;
      const lessonPath = path.join(unitPath, lessonName);
      const lessonIconFile = await findFirstFile(lessonPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
      const lessonObj = {
        name: lessonName,
        title: snakeToTitle(lessonName),
        icon: lessonIconFile ? path.posix.join('usii', unitName, lessonName, lessonIconFile) : null,
        tabs: []
      };

      // tabs are immediate subdirectories inside lessonPath
      const tabs = await listDir(lessonPath);
      for (const tEnt of tabs.filter(d => d.isDirectory())) {
        const tabName = tEnt.name;
        const tabPath = path.join(lessonPath, tabName);
        const tabIconFile = await findFirstFile(tabPath, ['icon.png','icon.svg','icon.jpg','icon.jpeg','bgimage.png','bgimage.jpg','bgimage.jpeg']);
        const tabObj = {
          name: tabName,
          title: snakeToTitle(tabName),
          icon: tabIconFile ? path.posix.join('usii', unitName, lessonName, tabName, tabIconFile) : null,
          cards: []
        };

        // cards are subdirectories under tabPath
        const cards = await listDir(tabPath);
        for (const cEnt of cards.filter(d => d.isDirectory())) {
          const cardName = cEnt.name;
          const cardPath = path.join(tabPath, cardName);
          const cardFiles = await listDir(cardPath);

          // find explicit bgimage.*, then list image/video files
          const bgFile = await findFirstFile(cardPath, ['bgimage.png','bgimage.jpg','bgimage.jpeg']);
          const media = cardFiles
            .filter(f => f.isFile())
            .map(f => f.name)
            .filter(n => !/^bgimage\./i.test(n))
            .filter(n => /\.(png|jpe?g|mp4|svg)$/i.test(n));

          const hasWriting = await fileExists(cardPath, 'writing');

          const cardObj = {
            name: cardName,
            title: snakeToTitle(cardName),
            bgimage: bgFile ? path.posix.join('usii', unitName, lessonName, tabName, cardName, bgFile) : null,
            has_writing: !!hasWriting,
            media: media // filenames only; client constructs raw.githubusercontent URLs
          };

          tabObj.cards.push(cardObj);
        } // cards

        lessonObj.tabs.push(tabObj);
      } // tabs

      unitObj.lessons.push(lessonObj);
    } // lessons

    manifest.units.push(unitObj);
  } // units

  return manifest;
}

async function writeManifestIfChanged(outPath, obj) {
  const newText = JSON.stringify(obj, null, 2) + '\n';
  let oldText = null;
  try { oldText = await fs.readFile(outPath, 'utf8'); } catch(e){ oldText = null; }
  if (oldText !== newText) {
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, newText, 'utf8');
    console.log('Wrote manifest to', outPath);
    return true;
  }
  console.log('Manifest unchanged');
  return false;
}

(async () => {
  try {
    const manifest = await buildManifest();
    const changed = await writeManifestIfChanged(OUT_PATH, manifest);
    if (changed) process.exit(0); // success: changed file (action will commit)
    else process.exit(0); // success: unchanged
  } catch (err) {
    console.error('Error generating manifest:', err);
    process.exit(2);
  }
})();
