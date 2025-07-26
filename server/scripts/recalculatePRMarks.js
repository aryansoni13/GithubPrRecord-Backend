import mongoose from 'mongoose';
import PullRequest from '../models/PullRequest.js';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';

dotenv.config();

const LEVEL_POINTS = { level1: 2, level2: 5, level3: 10 };

function calculateMarks(labels) {
  let totalMarks = 0;
  const breakdown = [];
  labels.forEach(label => {
    const labelName = label.name.toLowerCase().replace(/\s+/g, '');
    if (LEVEL_POINTS[labelName]) {
      const points = LEVEL_POINTS[labelName];
      totalMarks += points;
      breakdown.push({ label: label.name, points });
    }
  });
  return { totalMarks, breakdown };
}

async function recalculatePRMarks() {
  await connectDB();
  console.log('Connected to MongoDB');

  const prs = await PullRequest.find({});
  let updatedCount = 0;
  for (const pr of prs) {
    const { totalMarks, breakdown } = calculateMarks(pr.labels || []);
    await PullRequest.updateOne(
      { _id: pr._id },
      {
        $set: {
          marks: totalMarks,
          marksBreakdown: breakdown
        }
      }
    );
    updatedCount++;
    console.log(`Updated PR #${pr.prId}: marks=${totalMarks}`);
  }

  console.log(`PR marks recalculation complete. Updated ${updatedCount} PRs.`);
  mongoose.connection.close();
}

recalculatePRMarks().catch(err => {
  console.error('Error during PR marks recalculation:', err);
  mongoose.connection.close();
}); 