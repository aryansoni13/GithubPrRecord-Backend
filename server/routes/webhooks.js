import express from 'express';
import crypto from 'crypto';
import PullRequest from '../models/PullRequest.js';
import User from '../models/User.js';
import { calculateMarks } from '../services/githubService.js';

const router = express.Router();

// Verify webhook signature
const verifySignature = (payload, signature, secret) => {
  if (!signature || !secret) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
};

const LEVEL_POINTS = { level1: 2, level2: 5, level3: 10 };

// GitHub webhook endpoint
router.post('/github', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256']?.replace('sha256=', '');
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    // Always use req.body (Buffer) for signature verification
    if (webhookSecret && !verifySignature(req.body, signature, webhookSecret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch (e) {
      payload = req.body;
    }
    
    const event = req.headers['x-github-event'];
    
    // Only handle pull_request events with a pull_request object
    if (event !== 'pull_request' || !payload.pull_request) {
      return res.status(200).json({ status: 'ignored', message: 'Event not handled or no pull_request object' });
    }
    
    // Handle pull request events
    const pr = payload.pull_request;
    if (payload.action === 'closed' && pr.merged) {
      const existingPR = await PullRequest.findOne({ prId: pr.number });
      if (!existingPR) {
        // Normalize labels and calculate marks
        const levelIncrements = { level1: 0, level2: 0, level3: 0 };
        let totalMarks = 0;
        (pr.labels || []).forEach(label => {
          const lname = label.name?.toLowerCase().replace(/\s+/g, '');
          if (LEVEL_POINTS[lname]) {
            levelIncrements[lname] += LEVEL_POINTS[lname];
            totalMarks += LEVEL_POINTS[lname];
          }
        });

        const breakdown = Object.entries(levelIncrements)
          .filter(([_, points]) => points > 0)
          .map(([level, points]) => ({ label: level, points }));

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

        await User.findOneAndUpdate(
          { username: pr.user.login },
          {
            $inc: {
              totalMarks: totalMarks,
              totalPRs: 1,
              'levelMarks.level1': levelIncrements.level1,
              'levelMarks.level2': levelIncrements.level2,
              'levelMarks.level3': levelIncrements.level3,
              [`projectMarks.${pr.base?.repo?.name || process.env.GITHUB_REPO_NAME || 'default'}`]: totalMarks
            },
            $set: {
              avatar: pr.user.avatar_url,
              profileUrl: pr.user.html_url,
              lastActivity: new Date()
            }
          },
          { upsert: true, new: true }
        );
      }
      console.log(`🟩 PR merged: "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    } else if (payload.action === 'opened') {
      console.log(`🟢 PR opened: "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    } else if (payload.action === 'reopened') {
      console.log(`🟣 PR reopened: "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    } else if (payload.action === 'synchronize') {
      console.log(`🟡 PR updated (synchronize): "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    } else if (payload.action === 'closed' && !pr.merged) {
      console.log(`🔴 PR closed without merge: "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    } else {
      console.log(`🔘 PR event: ${payload.action} for "${pr.title}" by ${pr.user.login} (#${pr.number})`);
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;