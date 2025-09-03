module.exports = {
  apps: [{
    name: "Febot",
    script: "index.js",
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    },
    exec_mode: "fork"
  }]
};