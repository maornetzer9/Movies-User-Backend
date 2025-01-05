require('dotenv').config();
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const session = require('express-session');

const ORIGIN = process.env.ORIGIN;
const SECRET_KEY = process.env.SECRET_KEY;
const MONGOOSE_URI = process.env.MONGOOSE_URI;

// TODO: Implement this in the second server and the update the server.js too. 
const mongooseConnection = async (next) => {
    try {
        await mongoose.connect(MONGOOSE_URI);

        const name = mongoose.connection.name;
        const state = mongoose.connection.readyState;
        
        console.info({
            name,
            ORIGIN,
            connection: state === 1 ? true : false
        });
        if(next) next();
    } catch(err) {
        console.error('Error connecting to MongoDB:', err.message);
        if(next) next(err);
    }
};

const mongooseSessionMiddleware = () => {
    return session({
        secret: SECRET_KEY,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: MONGOOSE_URI,
            collectionName: 'session',
            ttl: 60 * 60, // 1 hour session timeout
        }),
        cookie: { maxAge: 30 * 60 * 1000 }, // 30 minutes session timeout
    });
};

const mongooseSession = (next) => mongooseConnection(next);

module.exports = { mongooseSession, mongooseSessionMiddleware };
