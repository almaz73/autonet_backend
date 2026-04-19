//authController.js
import jwt from 'jsonwebtoken';
import { promisify } from 'util';

// Simple in-memory user database
const users = [
    {
        id: 1,
        username: 'admin',
        password: 'admin',
        role: 'admin'
    }
];

// Promisify jwt.verify for easier use
const verifyAsync = promisify(jwt.verify).bind(jwt);

// Generatea token for a user
function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, 'secret_key', {
        expiresIn: '24h'
    });
}

// Login endpoint - validate credentials and return a token
export async function login(req,res) {
    try {
        const { username, password } = req.body;
        
        console.log('222 username, password  = ', username, password )

        // Find user by username
        const user = users.find(u => u.username === username);

        // Check if user exists and password is correct
        if (!user || user.password !== password) {
            return res.status(401).json({ error:'Ошибка в логине или пароле' });
        }

        // Generate token
        const token = generateToken(user);

        // Return token
        res.json({ token });
    } catch (error){
        console.error('Error during login:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
}

// Verify endpoint - check if a token is valid
export async function verifyToken(req, res) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

       if (!authHeader) {
            return res.status(401).json({ error: 'No token provided' });
        }

       // Extract token from header
        const token =authHeader.split(' ')[1];

        // Verify token
        const decoded = await verifyAsync(token, 'secret_key');

        // Check if user exists
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(404).json({ error:'User not found' });
       }

       // Return user info (without password)
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// Middleware to protect routes
export function authMiddleware(req, res, next) {
    
    console.log('23344 = ',23344)
    // Get token from header
    const authHeader = req.headers.authorization;
    
    console.log('authHeader = ',authHeader)

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Extract token from header
    const token = authHeader.split(' ')[1];
    
    console.log('token = ',token)

    // Verify token
    try {
        const decoded = jwt.verify(token, 'secret_key');

        // Find user by decoded id
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            return res.status(404).json({ error:'User not found' });
       }

       // Adduser to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Error in auth middleware:', error);
        res.status(401).json({ error: 'Authentication error' });
    }
}