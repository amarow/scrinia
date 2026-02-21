import { Router } from 'express';
import { authenticateToken } from '../auth';
import { ShareController } from '../controllers/ShareController';

const router = Router();

router.get('/', authenticateToken, ShareController.getAll);
router.get('/generate', authenticateToken, ShareController.generateKey);
router.post('/', authenticateToken, ShareController.create);
router.delete('/:id', authenticateToken, ShareController.delete);
router.patch('/:id', authenticateToken, ShareController.update);

export default router;
