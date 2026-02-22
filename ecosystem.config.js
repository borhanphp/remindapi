module.exports = {
  apps: [{
    name: 'zeeremind-api',
    script: './server.js',

    // Environment
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000
    },

    // Instances
    instances: 1,
    exec_mode: 'fork', // Use 'fork' for single instance (required for in-memory rate limiting)

    // Restart behavior
    watch: false, // Set to true for auto-restart on file changes (dev only)
    ignore_watch: ['node_modules', 'logs', 'uploads'],
    max_memory_restart: '500M', // Restart if memory exceeds 500MB

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true, // Add timestamps to logs

    // Advanced
    autorestart: true, // Auto-restart on crash
    max_restarts: 10, // Max restarts within min_uptime
    min_uptime: '10s', // Min uptime before considered started
    restart_delay: 4000, // Delay between restarts (ms)

    // Graceful shutdown
    kill_timeout: 5000, // Time to wait for graceful shutdown
    wait_ready: false,

    // Environment variables from .env file
    env_file: '.env'
  }]
};
