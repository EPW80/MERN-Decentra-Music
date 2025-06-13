const router = require("express").Router();
const { login, updateProfile } = require("../controllers/authController");
const auth = require("../middleware/auth");

router.post("/login", login);
router.put("/profile", auth, updateProfile);

module.exports = router;
