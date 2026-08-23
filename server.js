const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { validateEnv } = require('./config/validateEnv');
const { validateCorsOrigin } = require('./config/validateCors');
const { mongooseSession, mongooseSessionMiddleware } = require('./config/db');
const { userRouter } = require('./routes/users');
const { errorHandler } = require('./middleware/error');

const BODY_SIZE_LIMIT = '100kb';

validateEnv();
validateCorsOrigin();

const app = express();
const PORT = process.env.PORT || 3000;
const corsOptions = { origin: process.env.ORIGIN };

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: BODY_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: false, limit: BODY_SIZE_LIMIT }));
app.use(cors(corsOptions));
app.use(mongooseSessionMiddleware());

app.use('/users', userRouter);

app.use(errorHandler);

mongooseSession((err) => {
    if (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        process.exit(1);
    }

    app.listen(PORT, () => console.info(`Server is running on PORT: ${PORT}`));
});
