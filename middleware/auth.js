const { Responses, sessionResponses } = require("../responses/responses");
const { verifyToken } = require("../utils/jwt");

// TODO: Check if you need to return the error handling with object { code, message } and not with json. 
const authMiddleware = async (req, res, next) => {
    try
    {
        const token = req.headers.authorization?.split(" ")[1]; 
        const { code, message } = sessionResponses.sessionExpired;

        const verify = await verifyToken(token);
        
        if(!verify) return res.status(code).json(message);

        req.user = verify;
        next();
    }
    catch(err)
    {
        const { code, message } = Responses.internalError;
        console.error(err.message);
        return res.status(code).json(message);
    }
}

module.exports = authMiddleware;