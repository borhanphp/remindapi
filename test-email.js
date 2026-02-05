// Quick email test script
require('dotenv').config();
const sendEmail = require('./utils/sendEmail');

async function testEmail() {
  console.log('Testing email configuration...');
  console.log('EMAIL_USERNAME:', process.env.EMAIL_USERNAME);
  console.log('EMAIL_SERVICE:', process.env.EMAIL_SERVICE || 'gmail');
  
  try {
    const result = await sendEmail({
      to: 'zeeventory@gmail.com',
      subject: '🧪 Test Email from Zeeventory',
      text: 'If you receive this, email is working!',
      html: '<h1>Success!</h1><p>Email configuration is working correctly.</p>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    process.exit(0);
  } catch (error) {
    console.error('❌ Email failed:', error.message);
    console.log('\n📝 Troubleshooting:');
    console.log('1. Check EMAIL_USERNAME in .env');
    console.log('2. Check EMAIL_PASSWORD is an App Password (not regular password)');
    console.log('3. Enable 2-Step Verification on Gmail');
    console.log('4. Generate new App Password at: https://myaccount.google.com/apppasswords');
    process.exit(1);
  }
}

testEmail();

