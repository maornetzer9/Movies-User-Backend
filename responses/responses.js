exports.Responses = {
    success         : { code: 200, message: "Success" },
    badRequest      : { code: 400, message: "Bad Request" },
    unauthorized    : { code: 401, message: "Unauthorized" },
    forbidden       : { code: 403, message: "Forbidden" },
    notFound        : { code: 404, message: "Not Found" },
    internalError   : { code: 500, message: "Internal Server Error" },
    fileError       : { code: 501, message: "An error occurred while handling the file" },
    
    custom: (code, message) => {
        return {
            code,
            message
        };
    }
};

exports.usersResponses = {
    userNotFound             : { code: 1, message: 'User not found' },
    usernameAlreadyTaken     : { code: 2, message: 'Username already taken' },
    sessionLocked            : { code: 3, message: 'Session expired. Contact your administrator for a new session.' },
    userNotDeleted           : { code: 5, message: 'User already deleted or does not exist"' }
};

exports.sessionResponses = {
   sessionExpired  :  { code: 401, message: "Session expired. Please log in again." },
}
