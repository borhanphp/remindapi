const mongoose = require('mongoose');
require('dotenv').config();

async function fixCustomerEmailIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('customers');

    // Get existing indexes
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(idx => idx.name));

    // Drop the old organization_1_email_1 index if it exists
    try {
      await collection.dropIndex('organization_1_email_1');
      console.log('✓ Dropped old organization_1_email_1 index');
    } catch (error) {
      if (error.code === 27) {
        console.log('Index organization_1_email_1 does not exist, skipping...');
      } else {
        throw error;
      }
    }

    // Create new partial index
    await collection.createIndex(
      { organization: 1, email: 1 },
      {
        unique: true,
        partialFilterExpression: { 
          email: { $type: 'string', $gt: '' }
        },
        name: 'organization_1_email_1_partial'
      }
    );
    console.log('✓ Created new partial index: organization_1_email_1_partial');

    // Verify new indexes
    const newIndexes = await collection.indexes();
    console.log('\nNew indexes:', newIndexes.map(idx => idx.name));

    console.log('\n✅ Index migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixCustomerEmailIndex();

