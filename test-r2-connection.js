/**
 * Test script to verify Cloudflare R2 connection
 * Run with: node test-r2-connection.js
 */

require('dotenv').config();
const { S3Client, ListBucketsCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

console.log('🔍 Testing Cloudflare R2 Connection...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? '✅ Set' : '❌ Missing');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set (hidden)' : '❌ Missing');
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME || '❌ Missing');
console.log('R2_PUBLIC_URL:', process.env.R2_PUBLIC_URL || '❌ Missing');
console.log('');

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error('❌ Missing required environment variables!');
  console.log('\nPlease add these to your .env file:');
  console.log('R2_ACCOUNT_ID=your_account_id');
  console.log('R2_ACCESS_KEY_ID=your_access_key');
  console.log('R2_SECRET_ACCESS_KEY=your_secret_key');
  console.log('R2_BUCKET_NAME=your_bucket_name');
  console.log('R2_PUBLIC_URL=https://pub-xxx.r2.dev');
  process.exit(1);
}

// Initialize R2 Client with multiple configuration attempts
const configs = [
  {
    name: 'Standard Configuration',
    config: {
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: false,
    }
  },
  {
    name: 'Alternative Configuration (wnam region)',
    config: {
      region: 'wnam',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: false,
    }
  },
  {
    name: 'Path Style Configuration',
    config: {
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    }
  }
];

async function testConfiguration(configName, clientConfig) {
  console.log(`\n📡 Testing: ${configName}`);
  console.log('Endpoint:', clientConfig.endpoint);
  console.log('Region:', clientConfig.region);
  console.log('ForcePathStyle:', clientConfig.forcePathStyle);
  
  try {
    const client = new S3Client(clientConfig);
    
    // Test 1: Upload a test file
    console.log('\n  Test 1: Uploading test file...');
    const testContent = Buffer.from('Test file from R2 connection test');
    const testKey = `test/connection-test-${Date.now()}.txt`;
    
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });
    
    await client.send(uploadCommand);
    console.log('  ✅ Upload successful!');
    console.log(`  📁 File uploaded: ${testKey}`);
    console.log(`  🌐 Public URL: ${process.env.R2_PUBLIC_URL}/${testKey}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Failed:', error.message);
    if (error.code) {
      console.log('  Error Code:', error.code);
    }
    if (error.$metadata) {
      console.log('  HTTP Status:', error.$metadata.httpStatusCode);
    }
    return false;
  }
}

async function runTests() {
  let successCount = 0;
  
  for (const { name, config } of configs) {
    const success = await testConfiguration(name, config);
    if (success) {
      successCount++;
      console.log(`\n✅ SUCCESS! Use "${name}" in your application.`);
      break; // Stop at first success
    }
  }
  
  if (successCount === 0) {
    console.log('\n\n❌ All configuration attempts failed!');
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Verify your R2_ACCOUNT_ID is correct (from Cloudflare dashboard)');
    console.log('2. Check that your API token has "Object Read & Write" permissions');
    console.log('3. Ensure the API token is scoped to the correct bucket');
    console.log('4. Verify the bucket name matches exactly (case-sensitive)');
    console.log('5. Check if public access is enabled on the bucket');
    console.log('6. Try regenerating the API token in Cloudflare dashboard');
    console.log('\n📚 Documentation: https://developers.cloudflare.com/r2/');
  } else {
    console.log('\n\n🎉 R2 Connection Test PASSED!');
    console.log('Your application should now be able to upload images.');
  }
}

runTests().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});

