const fs = require('fs');
const path = require('path');

// Create public directory if it doesn't exist
const publicDir = 'public';
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
    console.log('✅ Created public directory');
}

// Files to copy to public directory
const filesToCopy = [
    'index.html',
    'script.js', 
    'style.css',
    'style.css.map',
    '68fdb35faa0209f017128af309265ac2_icon.png',
    'Sunrise Agnihotra Mantra.mp3',
    'Sunset Agnihotra Mantra.mp3'
];

// Copy each file
filesToCopy.forEach(file => {
    if (fs.existsSync(file)) {
        fs.copyFileSync(file, path.join(publicDir, file));
        console.log(`✅ Copied ${file} to public/`);
    } else {
        console.log(`⚠️  File not found: ${file}`);
    }
});

console.log('🎉 Build completed successfully!'); 