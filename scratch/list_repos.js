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
    const repos = await get('https://api.github.com/users/electrogenesis10-ops/repos');
    console.log('Repos of electrogenesis10-ops:');
    if (Array.isArray(repos)) {
        repos.forEach(r => console.log(`- ${r.name} (${r.html_url}) - ${r.description}`));
    } else {
        console.log(repos);
    }
}

main();
