// pm2 ecosystem file — spusť: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "geote-api",
      script: "../venv/bin/python3",
      args: "-m uvicorn main:app --host 0.0.0.0 --port 8001",
      cwd: "./api",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        PYTHONUNBUFFERED: "1"
      }
    }
  ]
};
