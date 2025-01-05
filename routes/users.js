const express = require('express');
const { registerController, loginController, addNewUserController, loadingUsersController, deleteUserController, editUserController, disconnectUserController } = require('../controllers/users');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/register',  registerController        );
router.post('/login',     loginController           );
router.get('/',           authMiddleware, loadingUsersController    );
router.put('/edit',       editUserController        );
router.post('/add',       addNewUserController      );
router.delete('/delete',  deleteUserController      );
router.put('/disconnect', disconnectUserController  );

module.exports = { userRouter: router };