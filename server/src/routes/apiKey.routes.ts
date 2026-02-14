import { Router } from 'express';
import { authenticateToken } from '../auth';
import { ApiKeyController } from '../controllers/ApiKeyController';

const router = Router();

router.get('/', authenticateToken, ApiKeyController.getAll);
router.get('/generate', authenticateToken, ApiKeyController.generateKey);
router.post('/', authenticateToken, ApiKeyController.create);
router.delete('/:id', authenticateToken, ApiKeyController.delete);
router.patch('/:id', authenticateToken, ApiKeyController.update);

export default router;
