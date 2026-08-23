const User = require("../models/User");
const { Responses } = require("../responses/responses");

const passwordChangeRequired = {
    code: 403,
    message: "You must change your password before continuing.",
};

const enforcePasswordChanged = async (req, res, next) => {
    try {
        const userId = req.user && req.user._id;
        if (!userId) return next();

        const userRecord = await User.findById(userId).select("mustChangePassword");
        if (!userRecord || !userRecord.mustChangePassword) return next();

        const { code, message } = passwordChangeRequired;
        return res.status(code).json({ code, message });
    } catch (err) {
        const { code, message } = Responses.internalError;
        console.error(err.message);
        return res.status(code).json({ code, message });
    }
};

module.exports = enforcePasswordChanged;
