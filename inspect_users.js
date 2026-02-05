const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env
dotenv.config({ path: path.join(__dirname, '.env') });

// Import models
require('./models/Role');
require('./models/Organization');
require('./models/User');

async function inspect() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const users = await mongoose.model('User').find({}).sort({ createdAt: -1 }).limit(5);
        console.log('Scanning last 5 users:');

        for (const user of users) {
            console.log(`User: ${user.email}, Role: ${user.role} (Type: ${typeof user.role})`);
            console.log(`Organization: ${user.organization}`);
            console.log(`-------------------`);

            // Try to populate
            try {
                await user.populate('role');
                console.log(`Populated Role: ${user.role ? user.role.name : 'NULL (Failed to populate)'}`);
            } catch (e) {
                console.log(`Population failed: ${e.message}`);
            }
            console.log(`===================`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
