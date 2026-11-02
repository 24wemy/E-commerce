// PM2: menjalankan Next.js di VPS & restart otomatis. Pakai: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'freshminut',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 127.0.0.1',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
    },
  ],
};
