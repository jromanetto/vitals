module.exports = {
  apps: [{
    name: "vitals",
    cwd: "/home/script/vitals",
    script: "node_modules/next/dist/bin/next",
    args: "start -p 3015 -H 127.0.0.1",
    env: { NODE_ENV: "production" },
    error_file: "/home/script/vitals/logs/err.log",
    out_file: "/home/script/vitals/logs/out.log",
    autorestart: true,
  }]
}
