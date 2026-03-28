const mongoose = require('mongoose');
const User = require('./models/User');
const { paddle } = require('./config/paddle');
const jwt = require('jsonwebtoken');

require('dotenv').config();

async function testVerify() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const user = await User.findOne({ email: 'test@example.com' }); // Replace with a user email
    if (!user) {
        console.log('User not found');
        process.exit(1);
    }
    console.log('Testing with user:', user.email, user._id);

    // Simulate verifyCheckout logic
    const transactionId = 'txn_01j78y6h2q37b8m9k6n7z21xtm'; // Replace with a valid test transaction id if you have one, or just test fetching.

    try {
        console.log('Fetching transaction from Paddle API...');
        const transaction = await paddle.transactions.get(transactionId);
        console.log(`Transaction fetched. Status: ${transaction?.status}, Subscription ID: ${transaction?.subscription_id}`);
    } catch (e) {
        console.error('Error fetching from paddle:', e.message);
    }

    process.exit(0);
}

testVerify();
