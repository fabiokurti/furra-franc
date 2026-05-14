import { Router } from 'express';
import { register, login, me, getStaffUsers, createStaff, updateStaff, deleteStaff, createBusinessUser } from '../controllers/auth.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.get('/staff-users', authenticate, requireAdmin, getStaffUsers);
router.post('/create-staff', authenticate, requireAdmin, createStaff);
router.patch('/staff/:id', authenticate, requireAdmin, updateStaff);
router.delete('/staff/:id', authenticate, requireAdmin, deleteStaff);
router.post('/create-business', authenticate, requireAdmin, createBusinessUser);

export default router;
