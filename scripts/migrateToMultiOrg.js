/**
 * Migration Script: Convert single-organization users to multi-organization membership model
 * 
 * This script:
 * 1. Finds all users with an organization
 * 2. Creates OrganizationMembership records for them
 * 3. Preserves their existing role and organization
 * 4. Keeps user.organization field for backward compatibility
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const OrganizationMembership = require('../models/OrganizationMembership');

const migrateToMultiOrg = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('📦 Connected to MongoDB');
    console.log('🔄 Starting migration to multi-organization model...\n');

    // Find all users with an organization
    const users = await User.find({ organization: { $exists: true, $ne: null } });

    console.log(`Found ${users.length} users with organizations\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if membership already exists
        const existingMembership = await OrganizationMembership.findOne({
          user: user._id,
          organization: user.organization
        });

        if (existingMembership) {
          console.log(`⏭️  Skipped: ${user.email} (membership already exists)`);
          skipped++;
          continue;
        }

        // Create membership
        await OrganizationMembership.create({
          user: user._id,
          organization: user.organization,
          role: user.role,
          isActive: user.isActive !== undefined ? user.isActive : true,
          joinedAt: user.createdAt || new Date(),
          // invitedBy is left null for migrated users
        });

        console.log(`✅ Created membership for: ${user.email}`);
        created++;
      } catch (error) {
        console.error(`❌ Error processing ${user.email}:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Created: ${created}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📝 Total: ${users.length}`);

    console.log('\n✨ Migration completed successfully!');
    console.log('\n⚠️  Note: user.organization fields have been preserved for backward compatibility');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateToMultiOrg();

