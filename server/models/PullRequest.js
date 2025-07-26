import mongoose from 'mongoose';

const pullRequestSchema = new mongoose.Schema({
  prId: {
    type: Number,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  author: {
    username: {
      type: String,
      required: true
    },
    avatar: {
      type: String,
      default: ''
    },
    profileUrl: {
      type: String,
      default: ''
    }
  },
  labels: [{
    name: String,
    color: String
  }],
  mergeDate: {
    type: Date,
    required: true
  },
  link: {
    type: String,
    required: true
  },
  marks: {
    type: Number,
    default: 0
  },
  marksBreakdown: [{
    label: String,
    points: Number
  }]
}, {
  timestamps: true
});

// Index for efficient queries
pullRequestSchema.index({ author: 1 });
pullRequestSchema.index({ mergeDate: -1 });
pullRequestSchema.index({ labels: 1 });

export default mongoose.model('PullRequest', pullRequestSchema);