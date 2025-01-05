
const fs = require('fs').promises;
const path = require('path');
const { Responses } = require('../responses/responses');
const { promises } = require('dns');

const success = Responses.success
// TODO: Add here checkout if the file is exists if not create one. 
// Helper function to read JSON file
const readUsersFile = async (fileName) => {
    try 
    {
        const filePath = path.join(__dirname, `../repositories/${fileName}`);
        const data = await fs.readFile(filePath, 'utf-8');
        if(!data) return [];
        return JSON.parse(data);;
    } 
    catch(err) 
    {
        console.error("Error reading file:", err.message);
        throw new Error(`Failed to reading file: ${fileName}: ${err.message}`);
    }
}


// Helper function to write JSON file
const writeUsersFile = async (fileName, users) => {
    try 
    {
        const filePath = path.join(__dirname, `../repositories/${fileName}`);
        await fs.writeFile(filePath, JSON.stringify(users, null, 2));
        const { code } = success;
        return { code };
    } 
    catch (err) 
    {
        console.error("Error writing file:", err.message);
        return { code: 500, message: `Failed to write to ${fileName}: ${err.message}` };
    }
};


// Main function to add or update user.
const writeUserJson = async (fileName, newUser) => {
    const users = await readUsersFile(fileName);

    // Check if user exists
    const data = newUser._id ? newUser._id : newUser
    const existingUserIndex = users.findIndex(user => user._id == data);

    if (existingUserIndex !== -1) 
    {
        const { code } = success
        users.splice(existingUserIndex, 1, newUser);
        await writeUsersFile(fileName, users);
        return { code, data: users } 
    } 
    else 
    {
        users.push(newUser);
    }

    await writeUsersFile(fileName, users);
    const { code } = success;
    return { code, data: users }
}


// Main function to delete user or permissions.
const deleteUserJson = async (fileName, _id) => {
    try 
    {
        const getUsers = await readUsersFile(fileName);
        const updatedUsers = getUsers.filter(user => user._id.toString() !== _id);
        
        await writeUsersFile(fileName, updatedUsers);

        const { code } = success;
        return { code, data: updatedUsers || [] };
    } 
    catch(err) 
    {
        console.error("Error in deleteUserJson:", err.message);
        throw new Error(`Failed to write to ${fileName}: ${err.message}`);
    }
};


module.exports = {
    readUsersFile,
    writeUsersFile,
    writeUserJson,
    deleteUserJson
};