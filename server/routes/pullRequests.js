import express from 'express';
import mongoose from 'mongoose';
import PullRequest from '../models/PullRequest.js';
import { syncPullRequests } from '../services/githubService.js';

const router = express.Router();

// Get all pull requests with filtering
router.get('/', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ 
        error: 'Database not connected',
        message: 'Please check your MongoDB connection'
      });
    }
    
    const { 
      page = 1, 
      limit = 20, 
      author, 
      label, 
      startDate, 
      endDate,
      sortBy = 'mergeDate',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (author) {
      filter['author.username'] = { $regex: author, $options: 'i' };
    }
    
    if (label) {
      filter['labels.name'] = { $regex: label, $options: 'i' };
    }
    
    if (startDate || endDate) {
      filter.mergeDate = {};
      if (startDate) filter.mergeDate.$gte = new Date(startDate);
      if (endDate) filter.mergeDate.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [pullRequests, total] = await Promise.all([
      PullRequest.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      PullRequest.countDocuments(filter)
    ]);

    res.json({
      pullRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pull request by ID
router.get('/:id', async (req, res) => {
  try {
    const pullRequest = await PullRequest.findOne({ prId: req.params.id });
    
    if (!pullRequest) {
      return res.status(404).json({ error: 'Pull request not found' });
    }
    
    res.json(pullRequest);
  } catch (error) {
    console.error('Error fetching pull request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get PR statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const [totalPRs, totalMarks, avgMarks] = await Promise.all([
      PullRequest.countDocuments(),
      PullRequest.aggregate([
        { $group: { _id: null, total: { $sum: '$marks' } } }
      ]),
      PullRequest.aggregate([
        { $group: { _id: null, avg: { $avg: '$marks' } } }
      ])
    ]);

    res.json({
      totalPRs,
      totalMarks: totalMarks[0]?.total || 0,
      avgMarks: Math.round((avgMarks[0]?.avg || 0) * 100) / 100
    });
  } catch (error) {
    console.error('Error fetching PR stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Manual sync endpoint
router.post('/sync', async (req, res) => {
  try {
    console.log('Manual sync triggered...');
    const count = await syncPullRequests();
    res.json({ 
      success: true, 
      message: `Sync completed. Processed ${count} PRs.`,
      processedCount: count 
    });
  } catch (error) {
    console.error('Manual sync failed:', error);
    res.status(500).json({ 
      error: 'Sync failed', 
      message: error.message 
    });
  }
});

export default router;