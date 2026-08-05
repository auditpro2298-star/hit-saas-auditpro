const fs = require('fs');
const path = require('path');
const { run, query } = require('./backend/database');

async function runUpdate() {
    console.log('🚀 Starting logo update script...');

    // 1. Ensure file is copied from frontend to backend/public
    const srcPath = path.join(__dirname, 'frontend', 'logo_electro_genesis.jpg');
    const destPath = path.join(__dirname, 'backend', 'public', 'logo_electro_genesis.jpg');

    try {
        if (fs.existsSync(srcPath)) {
            // Ensure destination directory exists
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(srcPath, destPath);
            console.log(`✅ Logo copied to ${destPath}`);
        } else {
            console.log(`⚠️ Source logo not found at ${srcPath}`);
        }
    } catch (err) {
        console.error('❌ Error copying logo file:', err.message);
    }

    // 2. Perform database updates
    try {
        console.log('🔍 Checking existing companies in the database...');
        const companies = await query('SELECT id_empresa, nombre_comercial, logo_url FROM empresas');
        console.log('Current companies in DB:', companies);

        // Update company where name is 'Electro Genesis' OR ID is 1 or 8
        const updateResult = await run(`
            UPDATE empresas 
            SET logo_url = '/logo_electro_genesis.jpg' 
            WHERE nombre_comercial = 'Electro Genesis' 
               OR nombre_comercial LIKE '%Electro%Genesis%'
               OR id_empresa = 1 
               OR id_empresa = 8
        `);

        console.log(`✅ Database update completed. Changes: ${updateResult.changes}`);

        // Verify updates
        const updatedCompanies = await query('SELECT id_empresa, nombre_comercial, logo_url FROM empresas');
        console.log('Updated companies in DB:', updatedCompanies);
        
        console.log('\n🎉 Update process finished successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating database:', err.message);
        process.exit(1);
    }
}

runUpdate();
