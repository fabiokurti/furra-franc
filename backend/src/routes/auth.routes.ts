import { Router } from 'express';
import { register, login, me, getStaffUsers } from '../controllers/auth.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/staff-users', authenticate, requireAdmin, getStaffUsers);

export default router;
