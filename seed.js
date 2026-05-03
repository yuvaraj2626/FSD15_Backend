require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Clear only admin and support users
        await User.deleteMany({ role: { $in: ['ADMIN', 'SUPPORT'] } });
        console.log('🗑️  Cleared existing admin and support users');

        const salt = await bcrypt.genSalt(10);

        // Create DEFAULT ADMIN
        const adminUser = await User.create({
            name: 'System Admin',
            email: 'admin@organization.com',
            password: await bcrypt.hash('Admin@123', salt),
            role: 'ADMIN'
        });

        console.log('👤 Created DEFAULT ADMIN:');
        console.log('   Email: admin@organization.com');
        console.log('   Password: Admin@123');
        console.log('   Role: ADMIN');

        // Create SUPPORT TEAM
        const supportTeam = [
            { name: 'Ramu Kumar', email: 'ramu@support.gmail.com', password: 'Support@123' },
            { name: 'Priya Singh', email: 'priya@support.gmail.com', password: 'Support@123' },
            { name: 'Arjun Patel', email: 'arjun@support.gmail.com', password: 'Support@123' },
            { name: 'Divya Sharma', email: 'divya@support.gmail.com', password: 'Support@123' }
        ];

        const createdSupport = [];
        for (const member of supportTeam) {
            const supportUser = await User.create({
                name: member.name,
                email: member.email,
                password: await bcrypt.hash(member.password, salt),
                role: 'SUPPORT'
            });
            createdSupport.push(supportUser);
        }

        console.log('\n👥 Created SUPPORT TEAM:');
        supportTeam.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name}`);
            console.log(`      Email: ${member.email}`);
            console.log(`      Password: ${member.password}`);
        });

        // Create demo complaints
        console.log('\n✅ Database seeded successfully!');
        console.log('\n🎯 DEFAULT CREDENTIALS:');
        console.log('\n   ADMIN Account:');
        console.log('      Email: admin@organization.com');
        console.log('      Password: Admin@123');
        console.log('\n   SUPPORT TEAM (can login and manage complaints):');
        supportTeam.forEach(member => {
            console.log(`      - ${member.email} / ${member.password}`);
        });
        console.log('\n💡 NOTE: Any user can register themselves as USER role');
        console.log('   Users can create complaints. Support team will manage them.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
