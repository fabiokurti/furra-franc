import { Router } from 'express';
import { getToday, createToday, closeDay } from '../controllers/dailyStock.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/today', authenticate, getToday);
router.post('/', authenticate, requireAdmin, createToday);
router.patch('/:id/close', authenticate, requireAdmin, closeDay);

export default router;
