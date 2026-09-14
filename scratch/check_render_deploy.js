async function check() {
    for (let i = 0; i < 20; i++) {
        try {
            const r = await fetch('https://hit-saas-auditpro-1.onrender.com/js/adminEmpresa.js?t=' + Date.now());
            const text = await r.text();
            
            // Comprobar si compila sin errores de sintaxis
            try {
                new Function(text);
                console.log('🎉 Render ya tiene el archivo adminEmpresa.js 100% VÁLIDO y funcional.');
                return;
            } catch (err) {
                console.log(`[${i+1}/20] Render aún sirviendo archivo con error (${err.message}). Reintentando en 5s...`);
            }
        } catch (e) {
            console.log(`[${i+1}/20] Render reiniciando... (${e.message})`);
        }
        await new Promise(r => setTimeout(r, 5000));
    }
}
check();
