import mongoose from 'mongoose';

const userSchema = mongoose.Schema({
    slackId: String,
    token: Object,
});

const User = mongoose.model('User', userSchema);

export default User;