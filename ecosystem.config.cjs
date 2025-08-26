module.exports = {
  apps: [{
    name: "Febot",
    script: "index.js", // The main script of your application
    watch: false,
    max_memory_restart: "1G", // Optional: restart the app if it exceeds this memory usage
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    },
    exec_mode: "fork"
  }]
};