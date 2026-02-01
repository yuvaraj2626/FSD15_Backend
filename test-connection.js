require('dotenv').config();
const mongoose = require('mongoose');

console.log('Testing MongoDB Connection...\n');
console.log('Connection String:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@'));

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
    .then(() => {
        console.log('\n✅ SUCCESS! MongoDB Connected Successfully');
        console.log('✅ Your database is ready to use!');
        console.log('\nYou can now run: npm run seed');
        process.exit(0);
    })
    .catch(err => {
        console.log('\n❌ CONNECTION FAILED!');
        console.log('\nError:', err.message);
        console.log('\n📋 SOLUTION:');
        console.log('1. Go to https://cloud.mongodb.com/');
        console.log('2. Navigate to: Database Access → Edit user password');
        console.log('3. Set a NEW password WITHOUT special characters (e.g., yuvaraj26)');
        console.log('4. Update the .env file with the new password');
        console.log('\nExample .env:');
        console.log('MONGODB_URI=mongodb+srv://yuvarajramu:yuvaraj26@fsd15.4ao4nc7.mongodb.net/complaint-management?retryWrites=true&w=majority&appName=FSD15');
        console.log('\n5. Also check Network Access - whitelist your IP or use 0.0.0.0/0');
        process.exit(1);
    });
