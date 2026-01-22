module.exports = {
  apps: [
    {
      name: "Febot",
      script: "interactions.js",
      watch: false,
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
      },
      exec_mode: "fork"
    }]
};