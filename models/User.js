const mongoose = require('mongoose');
const { hashPassword } = require('../utils/bcrypt');

const usersSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        set: hashPassword 
    }
});

const User = mongoose.model('users', usersSchema);

module.exports = User;