const https = require('https');

async function analyzeProductos() {
    const productsUrl = 'https://raw.githubusercontent.com/electrogenesis10-ops/carta/main/productos.json';
    const data = await new Promise((resolve) => {
        https.get(productsUrl, (res) => {
            let buf = '';
            res.on('data', c => buf += c);
            res.on('end', () => resolve(JSON.parse(buf)));
        });
    });

    console.log('Total productos:', data.length);
    const withNoImage = [];
    const withBadPath = [];
    const categories = {};

    data.forEach((p, index) => {
        const cat = p.categoria || 'Sin categoria';
        categories[cat] = (categories[cat] || 0) + 1;

        if (!p.imagen || p.imagen.trim() === '') {
            withNoImage.push({ index, id: p.id, nombre: p.nombre, categoria: p.categoria });
        }
    });

    console.log('Productos sin campo imagen o vacio:', withNoImage.length);
    console.log('Sample sin imagen:', withNoImage.slice(0, 15));
    console.log('Categories count:', categories);
}

analyzeProductos();
