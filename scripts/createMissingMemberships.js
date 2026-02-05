const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars first - use path relative to this script
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Verify MONGO_URI is set
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set in .env file');
  console.error('   Please check your backend/.env file');
  process.exit(1);
}

console.log('📡 Connecting to MongoDB...');
console.log('   URI:', process.env.MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')); // Hide credentials

// Load all models
require('../models');

const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMembership = require('../models/OrganizationMembership');
const Role = require('../models/Role');

// Connect to DB with timeout
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000, // 30 seconds
  socketTimeoutMS: 45000, // 45 seconds
}).then(() => {
  console.log('✅ Connected to MongoDB');
  createMissingMemberships();
}).catch((err) => {
  console.error('❌ Failed to connect to MongoDB:', err.message);
  process.exit(1);
});

const createMissingMemberships = async () => {
  try {
    console.log('🔄 Creating missing organization memberships...\n');

    // Get all users with organization and role
    const users = await User.find({
      organization: { $exists: true, $ne: null },
      role: { $exists: true, $ne: null }
    }).populate('organization').populate('role');

    console.log(`📋 Found ${users.length} users with organization and role\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        if (!user.organization || !user.role) {
          console.log(`   ⚠️  Skipping ${user.email} - missing org or role`);
          skipped++;
          continue;
        }

        // Check if membership already exists
        const existingMembership = await OrganizationMembership.findOne({
          user: user._id,
          organization: user.organization._id
        });

        if (existingMembership) {
          console.log(`   ℹ️  ${user.email} @ ${user.organization.name} - membership exists`);
          skipped++;
          continue;
        }

        // Create new membership
        const membership = await OrganizationMembership.create({
          user: user._id,
          organization: user.organization._id,
          role: user.role._id,
          isActive: user.isActive !== false, // Default to true if not set
          joinedAt: user.createdAt || new Date()
        });

        console.log(`   ✅ Created membership: ${user.email} @ ${user.organization.name} (${user.role.name})`);
        created++;
      } catch (err) {
        console.error(`   ❌ Error creating membership for ${user.email}:`, err.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Total users processed: ${users.length}`);
    console.log(`   Memberships created: ${created}`);
    console.log(`   Skipped (already exist): ${skipped}`);
    console.log(`   Errors: ${errors}`);

    if (created > 0) {
      console.log('\n✅ Migration completed successfully!');
      console.log('Users should now be able to login and access their organizations.');
    } else {
      console.log('\n⚠️  No new memberships created.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating memberships:', err);
    process.exit(1);
  }
};

createMissingMemberships();

