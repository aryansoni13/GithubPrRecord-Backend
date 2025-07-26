import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String,
    default: ''
  },
  profileUrl: {
    type: String,
    default: ''
  },
  totalMarks: {
    type: Number,
    default: 0
  },
  levelMarks: {
    level1: { type: Number, default: 0 },
    level2: { type: Number, default: 0 },
    level3: { type: Number, default: 0 }
  },
  projectMarks: {
    type: Map,
    of: Number,
    default: {}
  },
  totalPRs: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for leaderboard queries
userSchema.index({ totalMarks: -1 });

export default mongoose.model('User', userSchema);