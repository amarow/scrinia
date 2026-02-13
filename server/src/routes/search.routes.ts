import { Router } from 'express';
import { authenticateToken } from '../auth';
import { SearchController } from '../controllers/SearchController';

const router = Router();

router.get('/', authenticateToken, SearchController.search);

export default router;
