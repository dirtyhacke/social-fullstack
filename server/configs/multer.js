// configs/multer.js
import multer from "multer";

// Memory storage - store files in memory as buffers
const storage = multer.memoryStorage();

// File filter function for both images and videos
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Unsupported file type. Only images and video files are allowed.'), false);
    }
};

// Configure multer for media uploads
export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 4 // Max 4 files
    }
});

// Specific upload configurations
export const mediaUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 4
    }
}).array('media', 4); // Accept 'media' field with max 4 files

export const imageUpload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
    }
}).single('image');

export const audioUpload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024,
    }
}).single('audio');

export default upload;