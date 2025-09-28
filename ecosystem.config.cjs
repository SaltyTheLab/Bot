module.exports = {
  apps: [{
    name: "Febot",
    script: "dist//main-bot-min.js --name 'Febot-Prod'",
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