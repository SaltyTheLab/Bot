module.exports = {
  apps: [{
    name: "Febot",
    script: "index.js",
    watch: false,
    max_memory_restart: "150M",
    env: {
      NODE_ENV: "production",
    },
    env_production: {
      NODE_ENV: "production",
    },
    exec_mode: "fork"
  }]
};