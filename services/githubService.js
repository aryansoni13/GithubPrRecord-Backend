import axios from 'axios';
import PullRequest from '../models/PullRequest.js';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'InnoWebLabs';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'Vehigo';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Check if GitHub token is configured
if (!GITHUB_TOKEN) {
  console.warn('\n⚠️  GitHub Token Missing:');
  console.warn('1. Create a GitHub Personal Access Token at:');
  console.warn('   https://github.com/settings/tokens');
  console.warn('2. Add it to your .env file as GITHUB_TOKEN=your_token_here');
  console.warn('3. Ensure the token has "repo" or "public_repo" permissions\n');
}

// Label point mapping
const LABEL_POINTS = {
  'level1': 2,
  'level2': 5,
  'level3': 10
};

const githubApi = axios.create({
  baseURL: GITHUB_API,
  headers: {
    'Authorization': GITHUB_TOKEN ? `token ${GITHUB_TOKEN}` : undefined,
    'Accept': 'application/vnd.github.v3+json'
  }
});

export const calculateMarks = (labels) => {
  let totalMarks = 0;
  const breakdown = [];

  labels.forEach(label => {
    const labelName = label.name.toLowerCase().replace(/\s+/g, '');
    if (LABEL_POINTS[labelName]) {
      const points = LABEL_POINTS[labelName];
      totalMarks += points;
      breakdown.push({
        label: label.name,
        points
      });
    }
  });

  return { totalMarks, breakdown };
};

export const fetchMergedPullRequests = async (page = 1, perPage = 100) => {
  try {
    if (!GITHUB_TOKEN) {
      throw new Error('GitHub token not configured. Please add GITHUB_TOKEN to your .env file.');
    }
    
    const response = await githubApi.get(
      `/repos/${REPO_OWNER}/${REPO_NAME}/pulls`,
      {
        params: {
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          page,
          per_page: perPage
        }
      }
    );

    // Filter only merged PRs
    return response.data.filter(pr => pr.merged_at);
  } catch (error) {
    if (error.response?.status === 403) {
      console.error('\n❌ GitHub API Error (403 Forbidden):');
      console.error('This usually means:');
      console.error('1. Your GitHub token is invalid or expired');
      console.error('2. Your token lacks required permissions');
      console.error('3. You\'ve hit the API rate limit\n');
      console.error('Please check your GITHUB_TOKEN in the .env file');
    } else if (error.response?.status === 404) {
      console.error('\n❌ Repository not found (404):');
      console.error(`Repository: ${REPO_OWNER}/${REPO_NAME}`);
      console.error('Please check GITHUB_REPO_OWNER and GITHUB_REPO_NAME in your .env file');
    } else {
      console.error('Error fetching pull requests:', error.message);
    }
    throw error;
  }
};

export const syncPullRequests = async () => {
  try {
    if (!GITHUB_TOKEN) {
      console.log('⚠️  Skipping PR sync - GitHub token not configured');
      return 0;
    }
    
    console.log('Starting PR sync...');
    let page = 1;
    let hasMore = true;
    let processedCount = 0;

    while (hasMore) {
      const pullRequests = await fetchMergedPullRequests(page);
      
      if (pullRequests.length === 0) {
        hasMore = false;
        break;
      }

      for (const pr of pullRequests) {
        const existingPR = await PullRequest.findOne({ prId: pr.number });
        
        if (!existingPR) {
          console.log('PR labels:', pr.labels, 'for PR:', pr.title);
          const { totalMarks, breakdown } = calculateMarks(pr.labels || []);
          
          const newPR = new PullRequest({
            prId: pr.number,
            title: pr.title,
            description: pr.body || '',
            author: {
              username: pr.user.login,
              avatar: pr.user.avatar_url,
              profileUrl: pr.user.html_url
            },
            labels: pr.labels.map(label => ({
              name: label.name,
              color: label.color
            })),
            mergeDate: new Date(pr.merged_at),
            link: pr.html_url,
            marks: totalMarks,
            marksBreakdown: breakdown
          });

          await newPR.save();
          await updateUserStats(pr.user.login, pr.user.avatar_url, pr.user.html_url, totalMarks);
          processedCount++;
        }
      }

      page++;
      // Limit to prevent infinite loops
      if (page > 50) break;
    }

    console.log(`PR sync completed. Processed ${processedCount} new PRs.`);
    return processedCount;
  } catch (error) {
    console.error('Error syncing pull requests:', error);
    throw error;
  }
};

const updateUserStats = async (username, avatar, profileUrl, marks) => {
  try {
    await User.findOneAndUpdate(
      { username },
      {
        $inc: { 
          totalMarks: marks,
          totalPRs: 1
        },
        $set: {
          avatar,
          profileUrl,
          lastActivity: new Date()
        }
      },
      { 
        upsert: true,
        new: true
      }
    );
  } catch (error) {
    console.error('Error updating user stats:', error);
  }
};