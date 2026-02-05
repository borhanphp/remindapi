# PM2 Deployment Guide - ZeeRemind

## 📋 **Quick Reference Commands**

### **Backend API**
```bash
pm2 start ecosystem.config.js --env production
pm2 logs zeeremind-api
pm2 restart zeeremind-api
pm2 stop zeeremind-api
```

### **Frontend**
```bash
npm run build
pm2 start ecosystem.config.js --env production
pm2 logs zeeremind-frontend
```

---

## 🚀 **Complete Production Deployment**

### **Step 1: Install PM2 Globally**
```bash
npm install -g pm2
```

### **Step 2: Deploy Backend**
```bash
cd /root/zeeremind-api

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Start with PM2
pm2 start ecosystem.config.js --env production

# Check status
pm2 list

# View logs
pm2 logs zeeremind-api --lines 50
```

### **Step 3: Deploy Frontend**
```bash
cd /path/to/invoice-reminder

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js --env production

# Check status
pm2 list
```

### **Step 4: Save & Auto-Start**
```bash
# Save current PM2 process list
pm2 save

# Generate startup script (run once)
pm2 startup

# Copy and run the command PM2 outputs
# Example output:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root
```

---

## 📊 **Process Management**

### **View All Processes**
```bash
pm2 list
pm2 status
pm2 ls
```

Output:
```
┌─────┬──────────────────────┬─────────────┬─────────┬─────────┬──────────┐
│ id  │ name                 │ mode        │ status  │ cpu     │ memory   │
├─────┼──────────────────────┼─────────────┼─────────┼─────────┼──────────┤
│ 0   │ zeeremind-api        │ cluster     │ online  │ 0%      │ 45.2mb   │
│ 1   │ zeeremind-frontend   │ cluster     │ online  │ 0.3%    │ 62.5mb   │
└─────┴──────────────────────┴─────────────┴─────────┴─────────┴──────────┘
```

### **Restart Processes**
```bash
# Restart single process
pm2 restart zeeremind-api

# Restart all
pm2 restart all

# Reload (zero-downtime)
pm2 reload zeeremind-api
```

### **Stop/Delete Processes**
```bash
# Stop
pm2 stop zeeremind-api
pm2 stop all

# Delete
pm2 delete zeeremind-api
pm2 delete all

# Kill all PM2 processes
pm2 kill
```

---

## 📜 **Logging**

### **View Logs**
```bash
# All logs (real-time)
pm2 logs

# Specific app
pm2 logs zeeremind-api

# Last N lines
pm2 logs zeeremind-api --lines 100

# Only errors
pm2 logs zeeremind-api --err

# Only output (not errors)
pm2 logs zeeremind-api --out

# Clear all logs
pm2 flush
```

### **Log Files Location**
```bash
# Backend logs
/root/zeeremind-api/logs/
  - error.log
  - out.log
  - combined.log

# Frontend logs
/path/to/invoice-reminder/logs/
  - error.log
  - out.log
  - combined.log
```

---

## 🔄 **Update Deployment**

### **Backend Updates**
```bash
cd /root/zeeremind-api

# Pull latest code
git pull origin main

# Install new dependencies
npm install

# Restart with zero downtime
pm2 reload zeeremind-api

# Or regular restart
pm2 restart zeeremind-api

# Check logs for errors
pm2 logs zeeremind-api --lines 50
```

### **Frontend Updates**
```bash
cd /path/to/invoice-reminder

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build new version
npm run build

# Reload with zero downtime
pm2 reload zeeremind-frontend

# Check status
pm2 logs zeeremind-frontend --lines 50
```

---

## 📊 **Monitoring**

### **Real-time Monitoring**
```bash
# Terminal dashboard
pm2 monit

# Process details
pm2 show zeeremind-api

# System info
pm2 info zeeremind-api
```

### **Check Health**
```bash
# List with uptime
pm2 list

# Check memory usage
pm2 list | grep memory

# Check CPU usage
pm2 list | grep cpu
```

---

## ⚙️ **Advanced Configuration**

### **Scale (Multiple Instances)**
```bash
# Scale to 2 instances
pm2 scale zeeremind-api 2

# Scale to max CPU cores
pm2 scale zeeremind-api max

# Scale down to 1
pm2 scale zeeremind-api 1
```

### **Environment Variables**
```bash
# View environment
pm2 env 0  # 0 is process ID

# Restart with new env vars (after updating .env)
pm2 restart zeeremind-api --update-env
```

---

## 🛠️ **Troubleshooting**

### **Port Already in Use**
```bash
# Find process on port 5000
lsof -i :5000

# Kill it
kill -9 $(lsof -t -i:5000)

# Or use fuser
fuser -k 5000/tcp

# Then start PM2
pm2 start ecosystem.config.js
```

### **Server Keeps Crashing**
```bash
# Check logs
pm2 logs zeeremind-api --lines 100

# Show process info
pm2 show zeeremind-api

# Reset restart counter
pm2 reset zeeremind-api

# Delete and restart fresh
pm2 delete zeeremind-api
pm2 start ecosystem.config.js
```

### **Memory Issues**
```bash
# Check memory usage
pm2 list

# Restart to clear memory
pm2 restart zeeremind-api

# Adjust max_memory_restart in ecosystem.config.js
# Change: max_memory_restart: '500M' to '1G' if needed
```

---

## 🔄 **Auto-Restart on Server Reboot**

### **Setup (Run Once)**
```bash
# Save current process list
pm2 save

# Generate startup script
pm2 startup

# PM2 will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Copy and run that command
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root

# Verify
systemctl status pm2-root
```

### **Update Saved Process List**
```bash
# After adding/removing processes
pm2 save
```

### **Disable Auto-Start**
```bash
pm2 unstartup
```

---

## 📝 **Daily Operations**

### **Check Status**
```bash
pm2 list
```

### **View Logs**
```bash
pm2 logs --lines 50
```

### **Restart After Code Update**
```bash
git pull
npm install
pm2 reload all
```

### **Clear Old Logs**
```bash
pm2 flush
```

---

## 🎯 **Production Checklist**

- [ ] PM2 installed globally
- [ ] Backend started with ecosystem.config.js
- [ ] Frontend built and started
- [ ] Both processes showing "online" in `pm2 list`
- [ ] Logs show no errors
- [ ] PM2 saved: `pm2 save`
- [ ] Auto-start configured: `pm2 startup`
- [ ] Nginx/reverse proxy configured (if needed)
- [ ] Firewall allows ports 5000 & 3002
- [ ] SSL certificates installed
- [ ] Environment variables set correctly

---

## 🌐 **Nginx Reverse Proxy** (Optional)

If using Nginx:

```nginx
# Backend API
server {
    listen 80;
    server_name api.zeeremind.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Frontend
server {
    listen 80;
    server_name zeeremind.com www.zeeremind.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 📚 **Useful PM2 Commands Cheat Sheet**

```bash
# Start
pm2 start ecosystem.config.js
pm2 start server.js --name myapp

# Manage
pm2 restart myapp
pm2 reload myapp      # Zero-downtime
pm2 stop myapp
pm2 delete myapp

# Monitor
pm2 list
pm2 logs myapp
pm2 logs myapp --lines 100
pm2 monit
pm2 show myapp

# Cluster
pm2 scale myapp 4
pm2 scale myapp max

# Maintenance
pm2 flush            # Clear logs
pm2 reset myapp      # Reset counters
pm2 save             # Save process list
pm2 resurrect        # Restore saved processes

# System
pm2 startup          # Setup auto-start
pm2 unstartup        # Remove auto-start
pm2 update           # Update PM2
pm2 kill             # Kill PM2 daemon
```

---

## ✅ **Your Build is Ready!**

TypeScript errors fixed. You can now deploy with PM2! 🚀

**Next steps:**
1. Deploy to your production server
2. Run: `pm2 start ecosystem.config.js --env production`
3. Save: `pm2 save`
4. Setup auto-start: `pm2 startup`