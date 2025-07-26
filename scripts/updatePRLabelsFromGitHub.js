import mongoose from 'mongoose';
import PullRequest from '../models/PullRequest.js';
import dotenv from 'dotenv';
import { connectDB } from '../config/database.js';
import axios from 'axios';

dotenv.config();

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'InnoWebLabs';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'Vehigo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const githubApi = axios.create({
  baseURL: GITHUB_API,
  headers: {
    'Authorization': GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : undefined,
    'Accept': 'application/vnd.github.v3+json'
  }
});

async function updatePRLabels() {
  await connectDB();
  console.log('Connected to MongoDB');

  let page = 1;
  let hasMore = true;
  let updatedCount = 0;

  while (hasMore) {
    const response = await githubApi.get(
      `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
      {
        params: {
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          page,
          per_page: 100
        }
      }
    );
    const prs = response.data;
    if (prs.length === 0) {
      hasMore = false;
      break;
    }
    for (const pr of prs) {
      // Update the labels in the local DB for this PR
      await PullRequest.findOneAndUpdate(
        { prId: pr.number },
        {
          $set: {
            labels: pr.labels.map(label => ({
              name: label.name,
              color: label.color
            }))
          }
        }
      );
      updatedCount++;
      console.log(`Updated labels for PR #${pr.number}:`, pr.labels.map(l => l.name));
    }
    page++;
    if (page > 50) break;
  }

  console.log(`Label update complete. Updated ${updatedCount} PRs.`);
  mongoose.connection.close();
}

updatePRLabels().catch(err => {
  console.error('Error during label update:', err);
  mongoose.connection.close();
}); 