import { Router } from 'express';
import { authenticateToken } from '../auth';
import { TagController } from '../controllers/TagController';

const router = Router();

router.get('/', authenticateToken, TagController.getAll);
router.post('/', authenticateToken, TagController.create);
router.patch('/:id', authenticateToken, TagController.update);
router.delete('/:id', authenticateToken, TagController.delete);

export default router;
