import { Router } from 'express';
import { authenticateToken } from '../auth';
import { SettingsController } from '../controllers/SettingsController';

const router = Router();

router.get('/preferences', authenticateToken, SettingsController.getPreferences);
router.post('/preferences', authenticateToken, SettingsController.setPreferences);
router.get('/search', authenticateToken, SettingsController.getSearchSettings);
router.put('/search', authenticateToken, SettingsController.updateSearchSettings);

export default router;
