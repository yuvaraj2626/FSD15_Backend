require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Complaint = require('./models/Complaint');
const Feedback = require('./models/Feedback');

const seedDatabase = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Complaint.deleteMany({});
        await Feedback.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create demo users
        const salt = await bcrypt.genSalt(10);

        const demoUser = await User.create({
            name: 'Demo User',
            email: 'user@demo.com',
            password: await bcrypt.hash('user123', salt),
            role: 'USER'
        });

        const demoSupport = await User.create({
            name: 'Demo Support',
            email: 'support@demo.com',
            password: await bcrypt.hash('support123', salt),
            role: 'SUPPORT'
        });

        console.log('👥 Created demo users');
        console.log('   User: user@demo.com / user123');
        console.log('   Support: support@demo.com / support123');

        // Create demo complaints
        const complaint1 = await Complaint.create({
            userId: demoUser._id,
            title: 'Login Issue - Unable to access account',
            description: 'I am unable to login to my account. The system shows "Invalid credentials" even though I am using the correct password.',
            category: 'Technical',
            priority: 'High',
            status: 'OPEN'
        });

        const complaint2 = await Complaint.create({
            userId: demoUser._id,
            title: 'Billing discrepancy in last invoice',
            description: 'There seems to be an error in my last invoice. I was charged twice for the same service.',
            category: 'Billing',
            priority: 'Critical',
            status: 'IN_PROGRESS',
            assignedTo: demoSupport._id
        });

        const complaint3 = await Complaint.create({
            userId: demoUser._id,
            title: 'Feature request - Dark mode',
            description: 'It would be great to have a dark mode option for the application.',
            category: 'Other',
            priority: 'Low',
            status: 'RESOLVED',
            assignedTo: demoSupport._id
        });

        const complaint4 = await Complaint.create({
            userId: demoUser._id,
            title: 'Slow page loading',
            description: 'The dashboard page takes too long to load. It takes more than 10 seconds.',
            category: 'Technical',
            priority: 'Medium',
            status: 'CLOSED',
            assignedTo: demoSupport._id,
            closedAt: new Date()
        });

        console.log('📝 Created demo complaints');

        // Create demo feedback for closed complaint
        await Feedback.create({
            complaintId: complaint4._id,
            userId: demoUser._id,
            rating: 5,
            comment: 'The issue was resolved quickly and efficiently. Great support team!'
        });

        console.log('⭐ Created demo feedback');

        console.log('\n✅ Database seeded successfully!');
        console.log('\n🎯 You can now login with:');
        console.log('   USER: user@demo.com / user123');
        console.log('   SUPPORT: support@demo.com / support123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

seedDatabase();
