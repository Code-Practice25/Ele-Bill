const User = require('../models/customerModel');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('./emailService');

/**
 * Service to handle user signup
 * @param {Object} data - User signup data
 * @returns {Object} - Newly created user
 */

const signupService = async (data) => {
    const { firstName, lastName, email, password } = data;

    // Use findOne instead of find for better performance
    const existingUser = await User.findOne({ email });
    if (existingUser) throw new Error('Email already registered.');

    const newUser = new User({ firstName, lastName, email, password });
    await newUser.save();
    return newUser;
};

/**
 * Service to handle user login
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Object} - User data and JWT token
 */
const loginService = async (email, password) => {
    // Use findOne instead of find for better performance
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found.');

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new Error('Invalid credentials.');

    const token = user.generateJWT();
    return { token, user };
};

/**
 * Service to initiate password reset
 * @param {string} email - User email
 * @returns {Object} - Success message
 */
const resetPasswordService = async (email) => {
    // Use findOne instead of find for better performance
    const user = await User.findOne({ email });
    if (!user) throw new Error('No account associated with this email.');

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    await emailService.sendResetPasswordEmail(email, token);
    return { message: 'Password reset email sent' };
};

/**
 * Service to recover account with reset token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Object} - Updated user
 */
const recoverAccountService = async (token, newPassword) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Use findOne instead of find for better performance
        const user = await User.findOne({ 
            _id: decoded.id, 
            resetPasswordToken: token, 
            resetPasswordExpires: { $gt: Date.now() } 
        });
        
        if (!user) throw new Error('Invalid or expired reset token.');

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();
        return user;
    } catch (error) {
        // Provide more specific error messages based on JWT verification errors
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token format');
        } else if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        } else {
            throw new Error('Error while recovering account: ' + error.message);
        }
    }
};

/**
 * Service to update customer information
 * @param {string} customerId - Customer ID
 * @param {Object} updateData - Data to update
 * @returns {Object} - Updated customer
 */
const updateCustomerService = async (customerId, updateData) => {
    try {
        const updatedCustomer = await User.findByIdAndUpdate(
            customerId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCustomer) {
            throw new Error('Customer not found');
        }

        return updatedCustomer;
    } catch (error) {
        // Check if this is a validation error
        if (error.name === 'ValidationError') {
            throw new Error('Validation error: ' + error.message);
        } else if (error.name === 'CastError') {
            throw new Error('Invalid customer ID format');
        } else {
            throw new Error(error.message);
        }
    }
};
/**
 * Service to get user data by ID
 * @param {string} userId - User ID
 * @returns {Object} - User data
 */
const getUserDataService = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        return user;
    } catch (error) {
        if (error.name === 'CastError') {
            throw new Error('Invalid user ID format');
        } else {
            throw new Error(error.message);
        }
    }
};


module.exports = { 
    getUserDataService, 
    signupService, 
    loginService, 
    resetPasswordService, 
    recoverAccountService, 
    updateCustomerService 
};
