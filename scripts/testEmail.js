require('dotenv').config();
const sendEmail = require('../utils/sendEmail');

/**
 * Test email configuration
 * Usage: node scripts/testEmail.js your-test-email@example.com
 */

async function testEmailConfiguration() {
  console.log('🔍 Testing Email Configuration...\n');
  
  // Get test email from command line or use default
  const testEmail = process.argv[2] || 'test@example.com';
  
  console.log('Configuration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Email Service: ${process.env.EMAIL_SERVICE || process.env.EMAIL_HOST || 'Ethereal (test)'}`);
  console.log(`Email User: ${process.env.EMAIL_USER || process.env.EMAIL_USERNAME || 'Not configured'}`);
  console.log(`Email Port: ${process.env.EMAIL_PORT || '587'}`);
  console.log(`From Name: ${process.env.FROM_NAME || 'Zeeventory'}`);
  console.log(`From Email: ${process.env.FROM_EMAIL || 'noreply@zeeventory.com'}`);
  console.log(`Test Recipient: ${testEmail}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    console.log('📧 Sending test email...');
    
    const result = await sendEmail({
      to: testEmail,
      subject: '✅ Test Email - Your Email Configuration Works!',
      text: 'This is a test email from your Inventory Management System.\n\nIf you received this, your email configuration is working correctly!\n\nYou can now send invoice emails to your customers.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #4F46E5;">✅ Email Configuration Test</h1>
          
          <p style="font-size: 16px; line-height: 1.6;">
            <strong>Congratulations!</strong> Your email configuration is working correctly.
          </p>
          
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h2 style="color: #1F2937; margin-top: 0;">What this means:</h2>
            <ul style="color: #4B5563;">
              <li>Your SMTP settings are configured properly</li>
              <li>You can now send invoice emails to customers</li>
              <li>Email notifications will work for your system</li>
            </ul>
          </div>
          
          <div style="background-color: #EFF6FF; padding: 20px; border-radius: 8px; border-left: 4px solid #4F46E5;">
            <h3 style="margin-top: 0; color: #1E40AF;">Next Steps:</h3>
            <ol style="color: #1E3A8A;">
              <li>Test sending an invoice from your application</li>
              <li>Check that invoice emails reach customers</li>
              <li>Verify PDF attachments are included</li>
              <li>Monitor email delivery rates</li>
            </ol>
          </div>
          
          <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">
            This test email was sent from your <strong>Inventory Management System</strong><br>
            Time: ${new Date().toLocaleString()}
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">
            Powered by Zeeventory - Inventory Management System
          </p>
        </div>
      `
    });

    console.log('\n✅ SUCCESS! Email sent successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Message ID: ${result.messageId}`);
    
    // Show preview URL for development (Ethereal)
    if (result.preview) {
      console.log(`\n📧 Preview URL (Ethereal): ${result.preview}`);
      console.log('\nNote: This is a test email service. In production, use a real email provider.');
    }
    
    console.log('\n✅ Your email configuration is working!');
    console.log('You can now send invoice emails to customers.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR: Email sending failed!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Error: ${error.message}\n`);
    
    // Provide troubleshooting tips
    console.log('💡 Troubleshooting Tips:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!process.env.EMAIL_HOST && !process.env.EMAIL_SERVICE) {
      console.log('⚠️  No email configuration found in .env file');
      console.log('   Add EMAIL_HOST, EMAIL_USER, and EMAIL_PASSWORD to backend/.env');
      console.log('\n   Example for Gmail:');
      console.log('   EMAIL_HOST=smtp.gmail.com');
      console.log('   EMAIL_PORT=587');
      console.log('   EMAIL_USER=your-email@gmail.com');
      console.log('   EMAIL_PASSWORD=your-app-password');
      console.log('   EMAIL_FROM=your-email@gmail.com\n');
    }
    
    if (error.message.includes('Invalid login')) {
      console.log('⚠️  Authentication failed - check your credentials');
      console.log('   For Gmail: Use an App Password, not your regular password');
      console.log('   Generate at: https://myaccount.google.com/apppasswords\n');
    }
    
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
      console.log('⚠️  Connection failed - check your EMAIL_HOST and EMAIL_PORT');
      console.log('   Make sure your firewall allows SMTP connections');
      console.log('   Try port 587 (TLS) or 465 (SSL)\n');
    }
    
    console.log('📖 For detailed setup instructions, see:');
    console.log('   EMAIL_CONFIGURATION_GUIDE.md\n');
    
    process.exit(1);
  }
}

// Run the test
testEmailConfiguration();

