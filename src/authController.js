//authController.js
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import {users} from "./env_secrets.js";

// секрет подписи JWT берём из .env: без него сервер не запустится
const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET не задан: добавьте секрет в .env')

// Promisify jwt.verify for easier use
const verifyAsync = promisify(jwt.verify).bind(jwt);

// Generatea token for a user
function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, jwtSecret, {
        expiresIn: '24h'
    });
}

// Login endpoint - validate credentials and return a token
export async function login(req,res) {
    try {
        const { username, password } = req.body;
        
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

// Middleware to protect routes
export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided !!!' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, jwtSecret);
        const user = users.find(u => u.id === decoded.id);

        if (!user)   return res.status(404).json({ error:'User not found' });

       // Adduser to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Error in auth middleware:', error);
        res.status(401).json({ error: 'Authentication error' });
    }
}