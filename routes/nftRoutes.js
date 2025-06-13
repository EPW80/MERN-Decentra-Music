const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  createAlbum,
  getAlbums,
  getAlbum
} = require('../controllers/nftController');

router.post('/album', auth, createAlbum);
router.get('/albums', getAlbums);
router.get('/album/:albumId', getAlbum);

module.exports = router;
