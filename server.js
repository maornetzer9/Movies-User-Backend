require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { mongooseSession, mongooseSessionMiddleware } = require('./config/db');
const { userRouter } = require('./routes/users');

const app = express();
const PORT = 3000;
const corsOptions = { ORIGIN: process.env.ORIGIN };

mongooseSession((err) => {
    if (err) 
    {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    } 
});

// Middleware setup
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors(corsOptions));
app.use(mongooseSessionMiddleware());


// API routes
app.use('/users', userRouter);

// Start the server only if MongoDB connection succeeds
app.listen(PORT, () => console.info(`Server is running on PORT: ${PORT}`));
