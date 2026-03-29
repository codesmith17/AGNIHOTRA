const fs = require('fs');
const path = require('path');

// Create public directory if it doesn't exist
const publicDir = 'public';
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('Created public directory');
}

// Files to copy to public directory
const filesToCopy = [
    'index.html',
    'script.js', 
    'style.css',
    'style.css.map',
    'assets/images/eternalagni-icon.png',
    'assets/images/app-icon.png',
    'assets/audio/mantras/sunrise-mantra.mpeg',
    'assets/audio/mantras/sunset-mantra.mpeg',
    'assets/audio/mantras/panchasheel-pratidnya.mpeg',
    'assets/audio/mantras/saptashloki.mpeg',
    'assets/audio/mantras/trisatya-sharanagati.mpeg',
    'assets/images/copper-pyramid.jpg',
    'assets/images/cow-dung-cakes.webp',
    'assets/images/cow-ghee.jpg',
    'assets/images/unpolished-rice-grains.jpg',
    'assets/images/agnihotra-timing-reference.jpg',
    'assets/audio/alerts/agnihotra-bell.mp3',
    'sw.js'
];

// Folders to copy to public directory
const foldersToCopy = [
    'api'
];

// Copy each file
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(publicDir, file));
        console.log(`Copied ${file} to public/`);
    } else {
        console.log(`⚠️  File not found: ${file}`);
    }
});

// Copy folders recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

foldersToCopy.forEach(folder => {
    if (fs.existsSync(folder)) {
        copyDir(folder, path.join(publicDir, folder));
        console.log(`Copied folder ${folder} to public/`);
    }
});

console.log('🎉 Build completed successfully!'); 