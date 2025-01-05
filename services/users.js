const User = require("../models/User");
const { compareHash } = require("../utils/bcrypt");
const { writeUserJson, readUsersFile, deleteUserJson } = require("../utils/fileHandler");
const { Responses, usersResponses } = require("../responses/responses");
const jwtUtils = require("../utils/jwt");

const success = Responses.success;
const error = Responses.internalError;
const unauthorized = Responses.unauthorized;

// TODO: Add sessionTimeout implementation to disconnect the user

exports.register = async (req) => {
    try
    {
        let isUserExists;
        const { username: name, password } = req.body;

        const { code: unauthorizedCode, message: unauthorizedMessage } = unauthorized
        if(name === 'Admin' || name === "admin") return { code: unauthorizedCode, message: unauthorizedMessage };

        const username = name.toLocaleLowerCase();

        isUserExists = await User.findOne({ username });

        const { code: errorCode, message: errorMessage } = usersResponses.userNotFound;
        if(isUserExists === null || isUserExists === undefined) return { code: errorCode, message: errorMessage };

        isUserExists = await User.findOneAndUpdate(
            { username },
            { $set: { password, } },
            { new: true }
        );


        const { code, message } = success;
        return { code, message, isUserExists };

    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message, error: err.message };
    }
};

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
        if (!userRecord.password) 
        {
            const { code, message } = usersResponses.setUserPassword;
            return { code, message };
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = await compareHash(password, userRecord.password);

        // Invalid password
        if (!isPasswordValid) return Responses.unauthorized;

        // If the user is Admin, return success without additional data
        if (isAdmin) 
        {
            const token = jwtUtils.generateToken({username, expiresIn: '24h'});

            const { code, message } = success;
            return { code, message, user: { username: userRecord.username }, token };
        }

        // For regular users, load additional data and permissions
        const users = await readUsersFile('users.json');
        const permissions = await readUsersFile('permissions.json');

        // User data not found
        const { code: errorCode, errorMessage } = usersResponses.userNotFound;
        if (!users.length) return { code: errorCode, message: errorMessage };

        // Find user data and permissions by user ID
        const userData = users.find(user => user._id === userRecord._id.toString());
        const userPermissions = permissions.find(permission => permission._id === userRecord._id.toString());

        // Remove the _id field from permissions
        if (userPermissions) delete userPermissions._id;

        // Construct the user object to return
        const user = {
            ...userData,
            username: userRecord.username,
            permissions: userPermissions ? userPermissions.permissions : []
        };

        
        // FIXME: Check if you need to change the condition on remove him after send the token with admin also.
        const token = await jwtUtils.generateToken({
            _id: user._id,
            permissions: user.permissions,
            expiresIn: `${user.sessionTimeout ? user.sessionTimeout : 60}m`
        })

        const { code, message } = success;
        return { code, message, user, token };
    } 
    catch(err)
    {
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
        const { firstName, lastName, username: name, sessionTimeout, permissions } = req.body
        
        if (name.toLowerCase() === 'admin') 
            return { code: unauthorized.code, message: unauthorized.message };

        const username = name !== 'Admin' && name.toLocaleLowerCase();

        const isUserExists = await User.findOne({username: username ? username : name});

        const { code: errorCode, message: errorMessage } = usersResponses.usernameAlreadyTaken;
        if(isUserExists) return { code: errorCode, message: errorMessage };

        // TODO: Add here the sessionTimeout.
        user = await new User({username}).save();
        const { _id } = user;

        const newUserPermissions = {_id, permissions};
        const newUserData = {
            _id, 
            firstName,
            lastName,
            sessionTimeout,
            createAt: new Date().toLocaleDateString()
        };

        // TODO: Add error handler when you finish one step,
        const { code: fileCode } = await writeUserJson("users.json", newUserData);
        fileCode === 200 && await writeUserJson('permissions.json', newUserPermissions);
        
        user = { ...newUserData, username, permissions }
        
        const { code, message } = success;
        return { code, message, user };
    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message, error: err.message };
    }
};

exports.editUser = async (req) => {
    try
    {
        let allUsers;
        let updatedUsers;
        const { _id, firstName, lastName, username, sessionTimeout, permissions } = req.body;

        // TODO: Add here the sessionTimeout after you add it to the schema.
        const user = await User.findOneAndUpdate(
            { _id },
            { username },
            { new: true },
        );

        const userPermissionsData = { _id, permissions };
        const userNewData = { _id, firstName, lastName, username, sessionTimeout };
        
        // TODO: Add error handling for the user here.
        const { data: usersJson } = await writeUserJson('users.json', userNewData);
        const { data: permissionsJson } = await writeUserJson('permissions.json', userPermissionsData);
        
        if(user.username !== username || permissionsJson.length > 0)
            {
                allUsers = await User.find({ username: { $ne: 'Admin' } }, '_id username');

                updatedUsers = allUsers.map((user) => {
                    
                    const localUsersDB = usersJson.find((u) => u?._id == user?._id) || { _id: user._id };
                    const localPermissionsDB = permissionsJson.find((prem) => prem?._id == user._id) || { permissions : [] };

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
        return { code, message, users: updatedUsers, user  };
    }
    catch(err)
    {
        console.error(err.message);
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
        const { data: updatedUser } = await writeUserJson('users.json', user);

        if(user.sessionTimeout !== 0) return { code: 4, message: 'Failed to update sessionTimeout' };

        const { code, message } = success;
        return { code, message, user: updatedUser };

    }
    catch(err)
    {
        const { code, message } = error;
        console.error(err.message);
        return { code, message };
        
    }
}