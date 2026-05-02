const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file === 'dist' || file.startsWith('.')) return;
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

const files = walk(process.cwd());
files.forEach(f => {
    if (!f.endsWith('.tsx') && !f.endsWith('.ts') && !f.endsWith('.css')) return;
    const content = fs.readFileSync(f, 'utf8');
    if (content.match(/-\[\s*\]/g)) {
         console.log('Empty arbitrary value found in:', f);
    }
    if (content.match(/className="[^"]*-[ ]+[^"]*"/)) {
         console.log('Space after minus in className in:', f);
    }
    if (content.includes('-:')) {
         console.log('Found -: in', f);
    }
    const matches = content.match(/w-\[[^\]]+\]/g) || [];
    matches.forEach(m => {
       if (m.includes('- ') || m.includes(' -')) console.log('suspicious w-[] in:', f, m)
    });
});
