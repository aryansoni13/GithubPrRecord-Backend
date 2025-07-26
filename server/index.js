import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cron from 'node-cron';
import { connectDB } from './config/database.js';
import { syncPullRequests } from './services/githubService.js';
import pullRequestRoutes from './routes/pullRequests.js';
import userRoutes from './routes/users.js';
import webhookRoutes from './routes/webhooks.js';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());

// Add this before registering the webhook route
app.use('/api/webhooks/github', bodyParser.raw({ type: '*/*' }));

// Now add your JSON and URL-encoded middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
connectDB();

// Routes
app.use('/api/pull-requests', pullRequestRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Schedule periodic sync every 2 minutes
cron.schedule('*/2 * * * *', async () => {
  console.log('Running scheduled PR sync...');
  try {
    await syncPullRequests();
    console.log('Scheduled PR sync completed');
  } catch (error) {
    console.error('Scheduled PR sync failed:', error);
  }
});

// Initial sync on startup
setTimeout(async () => {
  console.log('Running initial PR sync...');
  try {
    const count = await syncPullRequests();
    if (count > 0) {
      console.log(`✅ Initial sync completed. Processed ${count} PRs.`);
    } else {
      console.log('ℹ️  Initial sync completed. No new PRs found or sync was skipped.');
    }
    console.log('Initial PR sync completed');
  } catch (error) {
    console.error('❌ Initial PR sync failed:', error.message);
    console.log('The server will continue running. Please check your configuration.\n');
  }
}, 5000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});