import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface TokenPayload {
    userId: string;
    email: string;
    role: string;
}

export function verifyToken(token: string): TokenPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
        // JWT stores the user ID in the standard 'sub' claim
        return {
            userId: decoded.sub as string,
            email: decoded.email as string,
            role: decoded.role as string,
        };
    } catch {
        return null;
    }
}
