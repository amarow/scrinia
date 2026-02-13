import { Router } from 'express';
import { authenticateToken } from '../auth';
import { FileController } from '../controllers/FileController';

const router = Router();

router.get('/', authenticateToken, FileController.getAll);
router.get('/:id/text-content', authenticateToken, FileController.getTextContent);
router.get('/:id/content', authenticateToken, FileController.getContent);
router.get('/:id/zip-content', authenticateToken, FileController.getZipContent);
router.get('/:id/zip-entry', authenticateToken, FileController.getZipEntry);
router.post('/:id/open', authenticateToken, FileController.openFile);

// Tags Logic
router.post('/:id/tags', authenticateToken, FileController.addTag);
router.post('/bulk-tags', authenticateToken, FileController.bulkAddTags);
router.delete('/bulk-tags', authenticateToken, FileController.bulkRemoveTags);
router.delete('/:fileId/tags/:tagId', authenticateToken, FileController.removeTag);

export default router;
