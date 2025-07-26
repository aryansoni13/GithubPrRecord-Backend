import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/github-pr-monitor';
    
    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      connectTimeoutMS: 10000,
    });
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('\n🔧 MongoDB Setup Required:');
    console.log('1. Install MongoDB locally or use Docker:');
    console.log('   docker run -d -p 27017:27017 --name mongodb mongo:latest');
    console.log('2. Or use MongoDB Atlas cloud service');
    console.log('3. Update MONGODB_URI in your .env file\n');
    
    // Don't exit the process, let the app run without database
    console.log('⚠️  Running without database connection. Some features may not work.');
  }
};

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error);
});