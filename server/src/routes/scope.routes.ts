import { Router } from 'express';
import { authenticateToken } from '../auth';
import { ScopeController } from '../controllers/ScopeController';

const router = Router();

router.get('/', authenticateToken, ScopeController.getAll);
router.post('/', authenticateToken, ScopeController.create);
router.post('/:id/refresh', authenticateToken, ScopeController.refresh);
router.delete('/:id', authenticateToken, ScopeController.delete);

export default router;
