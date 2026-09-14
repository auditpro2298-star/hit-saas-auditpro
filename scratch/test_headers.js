const https = require('https');

async function testHeader(url) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = https.get(url, (res) => {
            const time = Date.now() - start;
            res.resume();
            resolve({
                url,
                timeMs: time,
                statusCode: res.statusCode,
                cacheControl: res.headers['cache-control'],
                server: res.headers['server'],
                retryAfter: res.headers['retry-after'],
                rateLimitRemaining: res.headers['x-ratelimit-remaining']
            });
        });
        req.on('error', err => resolve({ url, error: err.message }));
    });
}

async function main() {
    const file = 'img/1788300646891_whatsapp_image_2026_08_30_at_10_23_05_pm__1_.jpeg';
    
    console.log('--- Testing raw.githubusercontent.com ---');
    console.log(await testHeader(`https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/${file}`));

    console.log('\n--- Testing electrogenesis10-ops.github.io ---');
    console.log(await testHeader(`https://electrogenesis10-ops.github.io/carta/${file}`));

    console.log('\n--- Testing jsDelivr CDN ---');
    console.log(await testHeader(`https://cdn.jsdelivr.net/gh/electrogenesis10-ops/carta@main/${file}`));
}

main();
