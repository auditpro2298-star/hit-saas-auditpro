const fs = require('fs');

const f1 = fs.readFileSync('C:\\Users\\cholo\\Desktop\\catalogolos los 2\\index.html', 'utf8');
const f2 = fs.readFileSync('C:\\Users\\cholo\\Desktop\\catalogolos los 2\\catalovenderor\\index.html', 'utf8');

console.log('Length f1 (public):', f1.length);
console.log('Length f2 (vendedores):', f2.length);

// Let's find script differences
const script1 = f1.substring(f1.indexOf('<script>'));
const script2 = f2.substring(f2.indexOf('<script>'));

console.log('Script 1 length:', script1.length);
console.log('Script 2 length:', script2.length);

if (f1 === f2) {
    console.log('f1 and f2 are IDENTICAL!');
} else {
    console.log('f1 and f2 are DIFFERENT.');
    // Let's see what is different
    const lines1 = f1.split('\n');
    const lines2 = f2.split('\n');
    console.log(`Lines: ${lines1.length} vs ${lines2.length}`);
    for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
        if (lines1[i] !== lines2[i]) {
            console.log(`Diff at line ${i+1}:`);
            console.log(`f1: ${lines1[i]}`);
            console.log(`f2: ${lines2[i]}`);
            if (i > 10) break;
        }
    }
}
