const fs = require('fs');
const https = require('https');

async function check() {
    const gitIndex = await new Promise((resolve) => {
        https.get('https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/index.html', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
    });

    const localIndex = fs.readFileSync('C:\\Users\\cholo\\Desktop\\catalogolos los 2\\index.html', 'utf8');

    console.log('GitHub carta index.html length:', gitIndex.length);
    console.log('Local Desktop index.html length:', localIndex.length);
    console.log('Does GitHub have PAGE_SIZE / infinite scroll?', gitIndex.includes('PAGE_SIZE'));
    console.log('Does GitHub have getImgSources resilient fallback?', gitIndex.includes('getImgSources'));

    const gitVendIndex = await new Promise((resolve) => {
        https.get('https://raw.githubusercontent.com/electrogenesis10-ops/cartavendedores/main/index.html', (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        });
    });

    console.log('\nGitHub cartavendedores index.html length:', gitVendIndex.length);
    console.log('Does GitHub cartavendedores have PAGE_SIZE / infinite scroll?', gitVendIndex.includes('PAGE_SIZE'));
    console.log('Does GitHub cartavendedores have getImgSources resilient fallback?', gitVendIndex.includes('getImgSources'));
}

check();
