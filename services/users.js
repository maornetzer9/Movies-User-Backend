const User = require("../models/User");
const crypto = require("crypto");
const { compareHash } = require("../utils/bcrypt");
const { writeUserJson, readUsersFile, deleteUserJson, writeUsersFile } = require("../utils/fileHandler");
const { Responses, usersResponses } = require("../responses/responses");
const jwtUtils = require("../utils/jwt");
const { sendAdminCreatedUserOnboardingEmail } = require("../utils/mail");

const success = Responses.success;
const error = Responses.internalError;
const unauthorized = Responses.unauthorized;
const badRequest = Responses.badRequest;

const PUBLIC_DEMO_PERMISSIONS = ["View-Movies", "View-Subscriptions"];

function generateTemporaryPassword(length = 12) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i += 1) {
        password += chars[bytes[i] % chars.length];
    }
    return password;
}

// TODO: Add the token to Admin also.
exports.login = async (req) => {
    try {
        const { username, password } = req.body;

        // Check if the username is "Admin"
        const isAdmin = username === "Admin";
        // For regular users, convert username to lowercase
        const normalizedUsername = isAdmin ? username : username.toLowerCase();

        const userRecord = await User.findOne({ username: normalizedUsername });

        // User not found
        if (!userRecord) 
        {
            const { code, message } = usersResponses.userNotFound;
            return { code, message };
        }

        // Password is not set
        if (!userRecord.password) return Responses.unauthorized;

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await compareHash(password, userRecord.password);

        // Invalid password
        if (!isPasswordValid) return Responses.unauthorized;

        // If the user is Admin, return success without additional data
        if (isAdmin) 
        {
            const token = jwtUtils.generateToken({ username }, '24h');

            const { code, message } = success;
            return { code, message, user: { username: userRecord.username }, token, mustChangePassword: false };
        }

        // For regular users, load additional data and permissions
        const users = await readUsersFile('users.json');
        const permissions = await readUsersFile('permissions.json');

        // Find user data and permissions by user ID
        const userData = users.find(user => user._id === userRecord._id.toString());
        const userPermissions = permissions.find(permission => permission._id === userRecord._id.toString());

        if (!userData) {
            const { code, message } = usersResponses.userNotFound;
            return { code, message };
        }

        const sessionMinutes = Number(userData.sessionTimeout);
        if (!Number.isFinite(sessionMinutes) || sessionMinutes <= 0) {
            const { code, message } = usersResponses.sessionLocked;
            return { code, message };
        }

        // Remove the _id field from permissions
        if (userPermissions) delete userPermissions._id;

        // Construct the user object to return
        const user = {
            ...userData,
            username: userRecord.username,
            permissions: userPermissions ? userPermissions.permissions : []
        };

        const token = jwtUtils.generateToken(
            { _id: user._id, permissions: user.permissions },
            `${sessionMinutes}m`
        );

        const { code, message } = success;
        return { code, message, user, token, mustChangePassword: Boolean(userRecord.mustChangePassword) };
    } 
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
    }
};

exports.register = async (req) => {
    try {
        const { username: name, password } = req.body;

        if (!name || !String(name).trim()) {
            return {
                code: badRequest.code,
                message: "Username is required.",
            };
        }

        if (!password || String(password).length < 6) {
            return {
                code: badRequest.code,
                message: "Password must be at least 6 characters.",
            };
        }

        if (name.toLowerCase() === "admin") {
            return { code: unauthorized.code, message: unauthorized.message };
        }

        const username = name !== "Admin" && name.toLocaleLowerCase();
        const normalizedUsername = username ? username : name;

        const isUserExists = await User.findOne({ username: normalizedUsername });
        const { code: errorCode, message: errorMessage } = usersResponses.usernameAlreadyTaken;
        if (isUserExists) return { code: errorCode, message: errorMessage };

        const user = await new User({
            username: normalizedUsername,
            password,
            mustChangePassword: false,
        }).save();
        const { _id } = user;

        const newUserPermissions = { _id, permissions: PUBLIC_DEMO_PERMISSIONS };
        const newUserData = {
            _id,
            firstName: "Demo",
            lastName: "User",
            sessionTimeout: 60,
            createAt: new Date().toLocaleDateString(),
        };

        const { code: fileCode, message: fileMessage } = await writeUserJson("users.json", newUserData);
        if (fileCode !== 200) return { code: fileCode, message: fileMessage };

        const permissionsWrite = await writeUserJson("permissions.json", newUserPermissions);
        if (permissionsWrite.code !== 200) return { code: permissionsWrite.code, message: permissionsWrite.message };

        const { code, message } = success;
        return { code, message };
    } catch (err) {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
    }
};

exports.changePasswordAfterFirstLogin = async (req) => {
    try {
        const userId = req.user && req.user._id;
        if (!userId) return Responses.unauthorized;

        const { newPassword } = req.body;
        const trimmedPassword = String(newPassword || "").trim();

        if (!trimmedPassword || trimmedPassword.length < 6) {
            return {
                code: badRequest.code,
                message: "A valid new password is required (minimum 6 characters).",
            };
        }

        const userRecord = await User.findById(userId);
        if (!userRecord) {
            const { code, message } = usersResponses.userNotFound;
            return { code, message };
        }

        if (!userRecord.mustChangePassword) {
            return {
                code: badRequest.code,
                message: "Password change is not required for this account.",
            };
        }

        await User.findOneAndUpdate(
            { _id: userRecord._id },
            { $set: { password: trimmedPassword, mustChangePassword: false } },
            { new: true }
        );

        const { code, message } = success;
        return { code, message };
    } catch (err) {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
    }
};


exports.loadingUsers = async (req) => {
    try
    {
        const localUsersDB = await readUsersFile('users.json',)
        const localUserPermissionsDB = await readUsersFile('permissions.json',)

        const dbUsers = await User.find({}, '_id username');

        const users = localUsersDB.map((user) => {
            const dbUser  = dbUsers.find((u) => u._id == user._id)
            const updatedPermissions = localUserPermissionsDB.find((prem) => prem._id === user._id);

            return {
                ...user,
                username: dbUser ? dbUser.username : 'Unknown',
                permissions: updatedPermissions ? updatedPermissions.permissions : []
            }
        }) 
        
        const { code, message } = success;
        return { code, message, users }
    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
    }
}

exports.addNewUser = async (req) => {
    try
    {
        let user;
        const {
            firstName,
            lastName,
            username: name,
            sessionTimeout,
            permissions,
            email,
            Email: emailAlt,
            userEmail,
        } = req.body;

        if (name.toLowerCase() === "admin")
            return { code: unauthorized.code, message: unauthorized.message };

        if (!String(firstName ?? "").trim() || !String(lastName ?? "").trim()) {
            return {
                code: badRequest.code,
                message: "firstName and lastName are required.",
            };
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return {
                code: badRequest.code,
                message: "At least one permission is required.",
            };
        }

        const rawEmail = email || emailAlt || userEmail;
        const trimmedEmail = typeof rawEmail === "string" ? rawEmail.trim() : "";
        if (!trimmedEmail || !trimmedEmail.includes("@")) {
            return {
                code: badRequest.code,
                message: "A valid email address is required.",
            };
        }

        const generatedPassword = generateTemporaryPassword();

        const username = name !== "Admin" && name.toLocaleLowerCase();

        const isUserExists = await User.findOne({ username: username ? username : name });

        const { code: errorCode, message: errorMessage } = usersResponses.usernameAlreadyTaken;
        if (isUserExists) return { code: errorCode, message: errorMessage };

        // TODO: Add here the sessionTimeout.
        user = await new User({
            username,
            password: generatedPassword,
            mustChangePassword: true,
        }).save();
        const { _id } = user;

        const newUserPermissions = { _id, permissions };
        const newUserData = {
            _id,
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            sessionTimeout,
            createAt: new Date().toLocaleDateString(),
        };

        const usersWrite = await writeUserJson("users.json", newUserData);
        if (usersWrite.code !== 200) {
            await User.findByIdAndDelete(_id);
            return { code: usersWrite.code, message: usersWrite.message };
        }

        const permissionsWrite = await writeUserJson("permissions.json", newUserPermissions);
        if (permissionsWrite.code !== 200) {
            await deleteUserJson("users.json", String(_id));
            await User.findByIdAndDelete(_id);
            return { code: permissionsWrite.code, message: permissionsWrite.message };
        }

        try {
            console.info("[addNewUser] sending onboarding email to=%s user=%s", trimmedEmail, username || name);
            await sendAdminCreatedUserOnboardingEmail({
                to: trimmedEmail,
                username: username || name,
                temporaryPassword: generatedPassword,
            });
        } catch (emailErr) {
            console.error("sendAdminCreatedUserOnboardingEmail failed:", emailErr.message);
            const { code } = error;
            return {
                code,
                message: `User was created, but the welcome email could not be sent: ${emailErr.message}`,
            };
        }

        user = { ...newUserData, username, permissions };

        const { code, message } = success;
        return { code, message, user };
    }
    catch (err) {
        const { code, message } = error;
        console.error(err.message);
        return { code, message, error: err.message };
    }
};

exports.editUser = async (req) => {
    try
    {
        let updatedUsers;
        const { _id, firstName, lastName, username, sessionTimeout, permissions } = req.body;

        const normalizedId = String(_id ?? "").trim();
        if (!normalizedId) {
            return { code: badRequest.code, message: "User _id is required." };
        }

        if (!String(firstName ?? "").trim() || !String(lastName ?? "").trim()) {
            return { code: badRequest.code, message: "firstName and lastName are required." };
        }

        if (!String(username ?? "").trim()) {
            return { code: badRequest.code, message: "username is required." };
        }

        if (!Array.isArray(permissions) || permissions.length === 0) {
            return { code: badRequest.code, message: "At least one permission is required." };
        }

        const trimmedUsername = String(username).trim();
        if (trimmedUsername.toLowerCase() === "admin" && trimmedUsername !== "Admin") {
            return { code: unauthorized.code, message: unauthorized.message };
        }

        const normalizedUsername = trimmedUsername === "Admin" ? "Admin" : trimmedUsername.toLowerCase();

        const duplicateUser = await User.findOne({
            username: normalizedUsername,
            _id: { $ne: normalizedId },
        });
        if (duplicateUser) {
            const { code, message } = usersResponses.usernameAlreadyTaken;
            return { code, message };
        }

        const user = await User.findOneAndUpdate(
            { _id: normalizedId },
            { username: normalizedUsername },
            { new: true },
        );

        if (!user) {
            const { code, message } = usersResponses.userNotFound;
            return { code, message };
        }

        const existingUsers = await readUsersFile("users.json");
        const existingProfile = existingUsers.find((entry) => String(entry._id) === normalizedId);

        const userPermissionsData = { _id: normalizedId, permissions };
        const userNewData = {
            _id: normalizedId,
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            sessionTimeout,
            createAt: existingProfile?.createAt || new Date().toLocaleDateString(),
        };

        const usersWrite = await writeUserJson("users.json", userNewData);
        if (usersWrite.code !== 200) {
            return { code: usersWrite.code, message: usersWrite.message };
        }

        const permissionsWrite = await writeUserJson("permissions.json", userPermissionsData);
        if (permissionsWrite.code !== 200) {
            return { code: permissionsWrite.code, message: permissionsWrite.message };
        }

        const usersJson = usersWrite.data;
        const permissionsJson = permissionsWrite.data;

        const allUsers = await User.find({ username: { $ne: "Admin" } }, "_id username");

        updatedUsers = allUsers.map((u) => {
            const localUsersDB = usersJson.find((entry) => String(entry._id) === String(u._id)) || { _id: String(u._id) };
            const localPermissionsDB = permissionsJson.find((perm) => String(perm._id) === String(u._id)) || { permissions: [] };

            return {
                ...localUsersDB,
                username: u.username || "Unknown",
                permissions: localPermissionsDB.permissions,
            };
        });
    
        const { code, message } = success;
        return { code, message, users: updatedUsers, user: { ...userNewData, username: user.username, permissions } };
    }
    catch(err)
    {
        console.error(err.message);
        if (err.code === 11000) {
            const { code, message } = usersResponses.usernameAlreadyTaken;
            return { code, message };
        }
        const { code, message } = error;
        return { code, message};
    }
};


exports.deleteUser = async (req) => {
    try
    {
        let updatedUsers;
        const { _id } = req.query;
        const user = await User.findOneAndDelete({_id}, { new: true });

        const { code: errorCode, message: errorMessage } = usersResponses.userNotDeleted;
        
        if(!user) return { code: errorCode, message: errorMessage };

        // TODO: Add error handling here.
        const { data: users } = await deleteUserJson('users.json', _id)
        const { data: permissions }  = await deleteUserJson('permissions.json', _id);

        const allUsers = await User.find({ username: { $ne: 'Admin' } }, '_id username');

        if(permissions.length > 0 && users.length > 0)
        {
            updatedUsers = allUsers.map((user) => {

                const localUsersDB = users.find((u) => u._id.toString() === user._id.toString()) || {_id: user._id};
                const localPermissionsDB = permissions.find((prem) => prem._id.toString() == user._id.toString()) || { permissions : [] };

                return {
                    ...localUsersDB,
                    username: user.username || 'Unknown',
                    permissions: localPermissionsDB.permissions
                }
            })
        }
        else
        {
            updatedUsers = allUsers;

        }

        const { code, message } = success;
        return { code, message, users: updatedUsers || [] };
    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message, error: err.message };
    }
};


exports.disconnect = async (req) => {
    try
    {
        const { user } = req.body;
        const normalizedId = String(user?._id ?? "").trim();

        if (!normalizedId) {
            return { code: badRequest.code, message: "User _id is required to update session timeout." };
        }

        const mongoUser = await User.findById(normalizedId);
        if (!mongoUser) {
            const { code, message } = usersResponses.userNotFound;
            return { code, message };
        }

        const sessionTimeout = Number(user?.sessionTimeout);
        if (!Number.isFinite(sessionTimeout) || sessionTimeout < 0) {
            return { code: badRequest.code, message: "A valid sessionTimeout is required." };
        }

        const users = await readUsersFile("users.json");
        const index = users.findIndex((entry) => String(entry._id) === normalizedId);

        if (index === -1) {
            return { code: badRequest.code, message: "User profile not found in users.json." };
        }

        users[index] = { ...users[index], sessionTimeout };
        const writeResult = await writeUsersFile("users.json", users);

        if (writeResult.code !== 200) {
            return { code: writeResult.code, message: writeResult.message };
        }

        const { code, message } = success;
        return { code, message, user: users[index] };

    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
        
    }
}