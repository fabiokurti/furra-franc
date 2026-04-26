import { Router } from 'express';
import { getAll, getToday, createToday, addItems, closeDay, reopenDay } from '../controllers/dailyStock.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/history', authenticate, requireAdmin, getAll);
router.get('/today', authenticate, getToday);
router.post('/', authenticate, requireAdmin, createToday);
router.patch('/:id/add-items', authenticate, requireAdmin, addItems);
router.patch('/:id/close', authenticate, requireAdmin, closeDay);
router.patch('/:id/reopen', authenticate, requireAdmin, reopenDay);

export default router;
