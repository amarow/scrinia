import { Router } from 'express';
import { authenticateAny } from '../auth';
import { PublicController } from '../controllers/PublicController';

const router = Router();

router.get('/files', authenticateAny, PublicController.getFiles);
router.get('/tags', authenticateAny, PublicController.getTags);
router.get('/search', authenticateAny, PublicController.search);
router.get('/files/:id/text', authenticateAny, PublicController.getFileText);

export default router;
