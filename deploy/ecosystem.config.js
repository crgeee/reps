module.exports = {
  apps: [
    {
      name: "reps",
      script: "dist/server/index.js",
      env: { NODE_ENV: "production" },
    },
  ],
};
