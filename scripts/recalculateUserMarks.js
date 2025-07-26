import mongoose from 'mongoose';
import User from '../models/User.js';
import PullRequest from '../models/PullRequest.js';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';

dotenv.config();

const LEVEL_POINTS = { level1: 2, level2: 5, level3: 10 };

async function recalculateMarks() {
  await connectDB();
  console.log('Connected to MongoDB');

  // Map: username -> { totalMarks, totalPRs, levelMarks }
  const userStats = {};

  const prs = await PullRequest.find({});
  for (const pr of prs) {
    if (!pr.author || !pr.author.username) continue;
    const username = pr.author.username;
    if (!userStats[username]) {
      userStats[username] = {
        totalMarks: 0,
        totalPRs: 0,
        levelMarks: { level1: 0, level2: 0, level3: 0 }
      };
    }
    let prMarks = 0;
    if (pr.labels && Array.isArray(pr.labels)) {
      console.log(`PR #${pr.prId} by ${username} labels:`, pr.labels.map(l => l.name));
      pr.labels.forEach(label => {
        const lname = label.name?.toLowerCase().replace(/\s+/g, '');
        if (LEVEL_POINTS[lname]) {
          userStats[username].levelMarks[lname] += LEVEL_POINTS[lname];
          prMarks += LEVEL_POINTS[lname];
        }
      });
    }
    userStats[username].totalMarks += prMarks;
    userStats[username].totalPRs += 1;
  }

  console.log('Final userStats:', userStats);

  // Update users in DB
  for (const [username, stats] of Object.entries(userStats)) {
    await User.findOneAndUpdate(
      { username },
      {
        $set: {
          totalMarks: stats.totalMarks,
          totalPRs: stats.totalPRs,
          levelMarks: stats.levelMarks
        }
      },
      { upsert: true }
    );
    console.log(`Updated ${username}:`, stats);
  }

  console.log('User marks recalculation complete.');
  mongoose.connection.close();
}

recalculateMarks().catch(err => {
  console.error('Error during recalculation:', err);
  mongoose.connection.close();
}); 