module.exports = {
  apps: [
    {
      name: "reps",
      script: "dist/server/index.js",
      node_args: "--env-file=.env",
      cwd: "/var/www/reps",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      error_file: "/var/log/reps/error.log",
      out_file: "/var/log/reps/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      watch: false,
      ignore_watch: ["node_modules", "dist"],
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
