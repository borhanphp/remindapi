# Email Configuration Guide

## Current Status
Your demo and guide request forms are now functional! They log all submissions to the console. To enable actual email sending, follow the setup instructions below.

## Option 1: Gmail Setup (Recommended for Quick Setup)

### Step 1: Enable 2-Factor Authentication
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification**
3. Enable 2-Step Verification if not already enabled

### Step 2: Generate App Password
1. Go to: https://myaccount.google.com/apppasswords
2. Select **Mail** as the app
3. Select **Other (Custom name)** as the device
4. Enter "Zeeventory" as the name
5. Click **Generate**
6. Copy the 16-character password (remove spaces)

### Step 3: Update Your .env File
Add these lines to `backend/.env`:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USERNAME=zeeventory@gmail.com
EMAIL_PASSWORD=your-16-char-app-password-here
FROM_NAME=Zeeventory
FROM_EMAIL=zeeventory@gmail.com
```

### Step 4: Restart Backend Server
```bash
cd backend
npm start
```

## Option 2: SendGrid (Recommended for Production)

SendGrid is more reliable for production and has a free tier (100 emails/day).

### Step 1: Create SendGrid Account
1. Sign up at: https://sendgrid.com/
2. Verify your email
3. Create an API key (Settings → API Keys)

### Step 2: Update Your .env File
```env
# Email Configuration
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-api-key-here
FROM_NAME=Zeeventory
FROM_EMAIL=support@zeeventory.com
```

### Step 3: Install SendGrid Package
```bash
cd backend
npm install @sendgrid/mail
```

### Step 4: Update sendEmail.js
Replace the Gmail configuration with SendGrid:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: options.to,
  from: options.from || process.env.FROM_EMAIL,
  subject: options.subject,
  text: options.text,
  html: options.html,
};

await sgMail.send(msg);
```

## Option 3: AWS SES (Best for High Volume)

Amazon SES is the most cost-effective for high-volume emails.

### Setup
1. Sign up for AWS
2. Verify your domain in SES
3. Get your SMTP credentials
4. Update .env with SES SMTP settings

## Testing Emails

### Console Logs
For now, all demo requests are logged to your server console:
```
📋 DEMO REQUEST RECEIVED:
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "company": "Acme Corp",
  ...
}
```

### Preview Emails in Browser
When email service is not configured, we use Ethereal Email (temporary test inboxes).
Check your console for preview URLs like:
```
Preview URL: https://ethereal.email/message/xxxxx
```

## Troubleshooting

### "Username and Password not accepted"
- Make sure you're using an **App Password**, not your regular Gmail password
- Remove any spaces from the app password
- Make sure 2FA is enabled on your Google account

### "Invalid login"
- Double-check your EMAIL_USERNAME matches your Gmail address
- Ensure EMAIL_PASSWORD is the 16-character app password

### Still not working?
1. Check your .env file is in the `backend` folder
2. Restart your backend server after changing .env
3. Check console for detailed error messages

## Current Behavior (Without Email Setup)

✅ **Working:**
- Demo form submissions are received
- All data is logged to console
- Form shows success message to users
- You can manually follow up using the console logs

❌ **Not Working Yet:**
- Automatic email notifications to zeeventory@gmail.com
- Automatic email notifications to support@zeeventory.com
- Confirmation emails to users
- Guide emails to users

## Next Steps

1. Set up Gmail App Password (5 minutes)
2. Update your .env file
3. Restart backend server
4. Test by submitting a demo request
5. Check both your Gmail and console logs

Need help? Contact your development team or check the nodemailer documentation: https://nodemailer.com/

