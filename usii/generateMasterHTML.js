// File: generateMasterHTML.js
// Description: Combine all writing files and images into one HTML for easy PDF export

const fs = require('fs');
const path = require('path');

// Root folder of your repo
const ROOT_DIR = path.join(__dirname, 'usii');

// Output HTML file
const OUTPUT_FILE = path.join(__dirname, 'master.html');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

// Utility: escape HTML special chars in text files
function escapeHtml(text) {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
}

// Recursively traverse folder structure and collect content
function traverseFolder(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    let htmlContent = '';

    items.forEach(item => {
        const itemPath = path.join(dir, item.name);

        if (item.isDirectory()) {
            // Check if this directory contains a 'writing' file → it's a card
            const writingFile = path.join(itemPath, 'writing');
            if (fs.existsSync(writingFile)) {
                // It's a card
                const cardName = item.name.replace(/_/g, ' ');
                htmlContent += `<h5>Card: ${cardName}</h5>\n`;

                // Read writing content
                let writingText = fs.readFileSync(writingFile, 'utf8');
                htmlContent += `<p>${writingText}</p>\n`;

                // Add images
                const cardFiles = fs.readdirSync(itemPath);
                cardFiles.forEach(f => {
                    const ext = path.extname(f).toLowerCase();
                    if (IMAGE_EXTENSIONS.includes(ext)) {
                        const imgRelPath = path.relative(ROOT_DIR, path.join(itemPath, f)).replace(/\\/g, '/');
                        htmlContent += `<img src="${imgRelPath}" style="max-width: 100%; margin: 10px 0;"><br>\n`;
                    }
                });

                // Add placeholder for videos
                cardFiles.forEach(f => {
                    const ext = path.extname(f).toLowerCase();
                    if (ext === '.mp4' || ext === '.mov' || ext === '.webm') {
                        htmlContent += `<p>[Video: ${f}]</p>\n`;
                    }
                });

            } else {
                // Not a card → could be group/lesson/unit/class
                // Use directory name as heading level based on depth
                const depth = itemPath.split(path.sep).length - ROOT_DIR.split(path.sep).length;
                const headingLevel = Math.min(depth, 4); // h1-h4 max
                const dirName = item.name.replace(/_/g, ' ');
                htmlContent += `<h${headingLevel}>${dirName}</h${headingLevel}>\n`;

                // Recurse
                htmlContent += traverseFolder(itemPath);
            }
        }
    });

    return htmlContent;
}

// Build master HTML
function buildMasterHTML() {
    const htmlHeader = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>US II - Master Document</title>
<style>
body { font-family: Arial, sans-serif; line-height: 1.4; margin: 40px; }
h1, h2, h3, h4, h5 { color: #2c3e50; }
img { display: block; margin: 10px 0; max-width: 100%; }
p { margin: 5px 0; }
</style>
</head>
<body>
`;

    const htmlFooter = `
</body>
</html>
`;

    const bodyContent = traverseFolder(ROOT_DIR);
    const fullHtml = htmlHeader + bodyContent + htmlFooter;

    fs.writeFileSync(OUTPUT_FILE, fullHtml, 'utf8');
    console.log(`✅ Master HTML created: ${OUTPUT_FILE}`);
}

// Run
buildMasterHTML();
