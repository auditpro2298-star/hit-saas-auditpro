const https = require('https');
const fs = require('fs');
const path = require('path');

function download(file) {
    return new Promise((resolve) => {
        const url = `https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/${file}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(path.join(__dirname, file), data, 'utf8');
                console.log(`Downloaded ${file} (${data.length} bytes)`);
                resolve();
            });
        });
    });
}

async function main() {
    await download('index.html');
    await download('links.html');
    await download('admin.html');
    await download('main.js');
}

main();
