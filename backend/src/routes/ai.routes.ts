import { Router } from 'express';
import { chat } from '../controllers/ai.controller';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.post('/chat', authenticate, requireAdmin, chat);

export default router;
