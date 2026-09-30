const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    default: function() {
      return this.email ? this.email.split('@')[0] : 'User';
    }
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['user', 'admin'], 
    default: 'user' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

let UserModel;
try {
  UserModel = mongoose.model('User', userSchema);
} catch (e) {
  UserModel = mongoose.models.User;
}

module.exports = UserModel;