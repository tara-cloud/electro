#!/usr/bin/env node
// Custom migration runner (no Prisma CLI on Pi — mirrors venus pattern)
const { execSync } = require('child_process');
const path = require('path');

console.log('Running Prisma migrations...');
try {
    execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname),
        env: { ...process.env },
    });
    console.log('Migrations complete.');
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
}
