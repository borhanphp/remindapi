const mongoose = require('mongoose');
require('dotenv').config();

async function updateEmployeeRole() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const Role = require('../models/Role');

        // Update employee role to include portal permissions
        const result = await Role.updateOne(
            { name: 'employee' },
            {
                $addToSet: {
                    permissions: {
                        $each: ['hrm:view', 'leave:self', 'hrm:attendance']
                    }
                }
            }
        );

        console.log('Update result:', result);

        // Show the updated role
        const role = await Role.findOne({ name: 'employee' });
        if (role) {
            console.log('Updated employee role permissions:', role.permissions);
        } else {
            console.log('Employee role not found');
        }

        await mongoose.disconnect();
        console.log('Done');
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

updateEmployeeRole();
