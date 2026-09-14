const https = require('https');
const fs = require('fs');
const path = require('path');

function download(file) {
    return new Promise((resolve) => {
        const url = `https://raw.githubusercontent.com/electrogenesis10-ops/cartavendedores/main/${file}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const target = path.join(__dirname, 'vendedores_' + file);
                fs.writeFileSync(target, data, 'utf8');
                console.log(`Downloaded vendedores_${file} (${data.length} bytes)`);
                resolve();
            });
        });
    });
}

async function main() {
    await download('index.html');
    await download('main.js');
    await download('admin.html');
}

main();
