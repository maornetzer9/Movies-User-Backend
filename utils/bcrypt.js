const bcrypt = require('bcryptjs');
const saltRounds = 10;

const encryptionPassword = 
{
    hashPassword: function(myPlaintextPassword) 
    {
        const salt = bcrypt.genSaltSync(saltRounds);
        const hash = bcrypt.hashSync(myPlaintextPassword, salt);
        return hash;
    },

    compareHash: (myPlaintextPassword, hash) => bcrypt.compareSync(myPlaintextPassword, hash),
};


module.exports = encryptionPassword