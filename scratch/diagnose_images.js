const https = require('https');

function checkUrl(url) {
    return new Promise((resolve) => {
        const req = https.get(url, (res) => {
            const status = res.statusCode;
            const size = res.headers['content-length'] ? parseInt(res.headers['content-length'], 10) : 0;
            res.resume(); // consume response data to free memory / sockets
            resolve({ url, status, size });
        });
        req.on('error', (err) => {
            resolve({ url, status: 'ERROR', error: err.message, size: 0 });
        });
        req.setTimeout(5000, () => {
            req.destroy();
            resolve({ url, status: 'TIMEOUT', size: 0 });
        });
    });
}

async function run() {
    const productsUrl = 'https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/productos.json';
    console.log('Fetching productos.json...');
    const dataRes = await new Promise((resolve) => {
        https.get(productsUrl, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    console.error('Failed to parse JSON', e);
                    resolve([]);
                }
            });
        });
    });

    console.log('Total items in productos.json:', dataRes.length);

    let okCount = 0;
    let failCount = 0;
    let totalSize = 0;
    const failedList = [];
    const heavyImages = [];

    // Batch in chunks of 20
    const chunkSize = 20;
    for (let i = 0; i < dataRes.length; i += chunkSize) {
        const chunk = dataRes.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(async (item) => {
            if (!item.imagen) return { item, res: { status: 'NO_IMAGE', size: 0 } };
            const imgUrl = item.imagen.startsWith('http') ? item.imagen : `https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/${item.imagen}`;
            const res = await checkUrl(imgUrl);
            return { item, res };
        }));

        for (const { item, res } of results) {
            if (res.status === 200) {
                okCount++;
                totalSize += res.size;
                if (res.size > 500 * 1024) { // > 500KB
                    heavyImages.push({
                        id: item.id,
                        nombre: item.nombre,
                        imagen: item.imagen,
                        sizeMB: (res.size / (1024 * 1024)).toFixed(2) + ' MB'
                    });
                }
            } else {
                failCount++;
                failedList.push({
                    id: item.id,
                    nombre: item.nombre,
                    imagen: item.imagen,
                    status: res.status
                });
            }
        }
    }

    console.log(`\n=================== DIAGNOSTIC REPORT ===================`);
    console.log(`Total Products: ${dataRes.length}`);
    console.log(`Working Images (200 OK): ${okCount}`);
    console.log(`Broken Images (404/Timeout/No Image): ${failCount}`);
    console.log(`Total Weight of working images: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`Average Weight per working image: ${okCount ? ((totalSize / okCount) / 1024).toFixed(1) + ' KB' : '0 KB'}`);

    console.log(`\n--- Heavy Images (> 500KB) [Count: ${heavyImages.length}]: ---`);
    console.log(heavyImages.slice(0, 10));

    console.log(`\n--- Broken Images Sample [Total: ${failedList.length}]: ---`);
    console.log(failedList.slice(0, 15));

    // Also check github raw vs github pages vs rate limit
    console.log(`\n--- Checking image loading domain performance & logic ---`);
}

run();
