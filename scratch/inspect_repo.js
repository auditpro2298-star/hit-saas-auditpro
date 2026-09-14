const https = require('https');

function get(url) {
    return new Promise((resolve) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    resolve(data);
                }
            });
        });
    });
}

async function main() {
    const root = await get('https://api.github.com/repos/electrogenesis10-ops/carta/contents');
    console.log('Files in root of electrogenesis10-ops/carta:');
    if (Array.isArray(root)) {
        root.forEach(f => console.log(`- ${f.name} (${f.type})`));
    } else {
        console.log(root);
    }
}

main();
