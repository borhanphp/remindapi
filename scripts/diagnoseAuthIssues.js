const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Role = require('../models/Role');
const OrganizationMembership = require('../models/OrganizationMembership');

// Load env vars
dotenv.config();

// Connect to DB
mongoose.connect(process.env.MONGO_URI);

const diagnoseAuthIssues = async () => {
  try {
    console.log('🔍 Diagnosing authentication issues...\n');
    
    // 1. Check Roles
    console.log('📋 Checking Roles...');
    const roles = await Role.find({});
    console.log(`   Found ${roles.length} roles in database`);
    
    if (roles.length === 0) {
      console.log('   ⚠️  WARNING: No roles found! Users cannot authenticate without roles.');
      console.log('   Run: node scripts/updateRolePermissions.js to create roles\n');
      process.exit(1);
    }
    
    roles.forEach(role => {
      console.log(`   - ${role.name} (${role.permissions.length} permissions)`);
    });
    console.log();
    
    // 2. Check Users
    console.log('👥 Checking Users...');
    const users = await User.find({}).select('name email role organization isSuperAdmin isActive');
    console.log(`   Found ${users.length} users\n`);
    
    let issuesFound = 0;
    
    for (const user of users) {
      const issues = [];
      
      // Check if role exists
      if (!user.role) {
        issues.push('❌ No role assigned');
        issuesFound++;
      } else {
        // Verify role exists in database
        const roleExists = await Role.findById(user.role);
        if (!roleExists) {
          issues.push('❌ Role ID invalid (role not found)');
          issuesFound++;
        }
      }
      
      // Check if organization exists (for non-super admins)
      if (!user.isSuperAdmin && !user.organization) {
        issues.push('⚠️  No organization assigned');
      }
      
      // Check if user is active
      if (!user.isActive) {
        issues.push('⚠️  User is inactive');
      }
      
      if (issues.length > 0) {
        console.log(`   User: ${user.name} (${user.email})`);
        issues.forEach(issue => console.log(`      ${issue}`));
        console.log();
      }
    }
    
    // 3. Check Organization Memberships
    console.log('🏢 Checking Organization Memberships...');
    const memberships = await OrganizationMembership.find({})
      .populate('user', 'name email')
      .populate('role', 'name')
      .populate('organization', 'name');
    
    console.log(`   Found ${memberships.length} memberships\n`);
    
    let membershipIssues = 0;
    
    for (const membership of memberships) {
      const issues = [];
      
      if (!membership.role) {
        issues.push('❌ No role assigned');
        membershipIssues++;
      } else if (typeof membership.role === 'object' && !membership.role.name) {
        issues.push('❌ Role not found (invalid ID)');
        membershipIssues++;
      }
      
      if (!membership.organization) {
        issues.push('❌ No organization');
        membershipIssues++;
      }
      
      if (!membership.user) {
        issues.push('❌ No user');
        membershipIssues++;
      }
      
      if (issues.length > 0) {
        console.log(`   Membership: ${membership.user?.email || 'Unknown'} @ ${membership.organization?.name || 'Unknown'}`);
        issues.forEach(issue => console.log(`      ${issue}`));
        console.log();
      }
    }
    
    // 4. Summary
    console.log('📊 Summary:');
    console.log(`   Total Roles: ${roles.length}`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Total Memberships: ${memberships.length}`);
    console.log(`   User Issues: ${issuesFound}`);
    console.log(`   Membership Issues: ${membershipIssues}`);
    
    if (issuesFound > 0 || membershipIssues > 0) {
      console.log('\n❌ Issues found! Please fix them before users can authenticate properly.');
      console.log('\nSuggested fixes:');
      console.log('   1. Run: node scripts/syncRolePermissions.js');
      console.log('   2. Check that all users have valid role assignments');
      console.log('   3. Check that all memberships have valid role assignments');
    } else {
      console.log('\n✅ No authentication issues found!');
    }
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during diagnosis:', err);
    process.exit(1);
  }
};

diagnoseAuthIssues();
