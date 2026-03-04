module.exports = {
  apps: [
    {
      name: "reps",
      script: "dist/server/index.js",
      node_args: "--env-file=.env",
      cwd: "/var/www/reps",
      env: {
        NODE_ENV: "production",
        TZ: "America/Los_Angeles",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      // Pino handles log files directly — pm2 stdout is a fallback only
      out_file: "/var/log/reps/pm2-out.log",
      error_file: "/var/log/reps/pm2-error.log",
      merge_logs: true,
      autorestart: true,
      watch: false,
      ignore_watch: ["node_modules", "dist"],
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
