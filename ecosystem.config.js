module.exports = {
  apps: [{
    name: 'vitals',
    cwd: '/home/script/vitals',
    script: '/home/script/vitals/.venv/bin/uvicorn',
    args: 'app.main:app --host 127.0.0.1 --port 3015 --workers 1',
    interpreter: 'none',
    env: { PYTHONUNBUFFERED: '1' },
    error_file: '/home/script/vitals/logs/err.log',
    out_file: '/home/script/vitals/logs/out.log',
    time: true,
    autorestart: true,
  }]
}
