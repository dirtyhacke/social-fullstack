import imagekit from "../configs/imageKit.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";

// Add User Story
export const addUserStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { content, media_type, background_color } = req.body;
        const media = req.file;
        let media_url = '';

        console.log('📝 Creating story for user:', userId);
        console.log('📦 Media type:', media_type);
        console.log('📁 File received:', media ? {
            originalname: media.originalname,
            mimetype: media.mimetype,
            size: media.size,
            buffer: media.buffer ? `Buffer(${media.buffer.length} bytes)` : 'No buffer',
            path: media.path // This will be undefined with memory storage
        } : 'No file');

        // ✅ FIX: Use memory storage properly (media.buffer instead of media.path)
        if ((media_type === 'image' || media_type === 'video') && media) {
            console.log('📤 Uploading media to ImageKit...');
            
            // Check if we have a buffer (memory storage)
            if (!media.buffer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file upload - no file data received'
                });
            }

            // Convert buffer to base64 for ImageKit
            const fileBase64 = media.buffer.toString('base64');
            
            const response = await imagekit.upload({
                file: fileBase64, // Use base64 string
                fileName: media.originalname,
                folder: '/stories'
            });
            media_url = response.url;
            console.log('✅ Media uploaded:', media_url);
        }

        // Create story
        console.log('💾 Saving story to database...');
        const story = await Story.create({
            user: userId,
            content,
            media_url,
            media_type,
            background_color
        });

        console.log('✅ Story created with ID:', story._id);

        // ✅ Handle story deletion (make Inngest optional)
        console.log('⏰ Setting up story deletion...');
        
        try {
            // Check if Inngest is properly configured
            if (process.env.INNGEST_EVENT_KEY && process.env.INNGEST_EVENT_KEY.length > 10) {
                await inngest.send({
                    name: 'app/story.delete',
                    data: { storyId: story._id }
                });
                console.log('✅ Story deletion scheduled with Inngest');
            } else {
                console.log('⚠️ Inngest not configured, using manual deletion');
                scheduleManualDeletion(story._id);
            }
        } catch (inngestError) {
            console.log('⚠️ Inngest failed, using manual deletion:', inngestError.message);
            scheduleManualDeletion(story._id);
        }

        // ✅ SUCCESS: Return success response
        res.json({ 
            success: true, 
            message: 'Story created successfully!',
            story: {
                id: story._id,
                content: story.content,
                media_url: story.media_url,
                media_type: story.media_type,
                background_color: story.background_color
            }
        });

    } catch (error) {
        console.error('❌ Story creation error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        }); 
    }
}

// Manual story deletion function (fallback)
function scheduleManualDeletion(storyId) {
    setTimeout(async () => {
        try {
            const deletedStory = await Story.findByIdAndDelete(storyId);
            if (deletedStory) {
                console.log(`✅ Story ${storyId} auto-deleted after 24 hours (manual)`);
            } else {
                console.log(`⚠️ Story ${storyId} not found for deletion (may have been deleted already)`);
            }
        } catch (deleteError) {
            console.error('❌ Error auto-deleting story:', deleteError.message);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    console.log('✅ Manual deletion scheduled for story:', storyId);
}

// Get User Stories
export const getStories = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // User connections and followings 
        const userIds = [userId, ...user.connections, ...user.following];

        // Get stories from last 24 hours only
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const stories = await Story.find({
            user: { $in: userIds },
            createdAt: { $gte: twentyFourHoursAgo }
        }).populate('user').sort({ createdAt: -1 });

        res.json({ 
            success: true, 
            stories,
            count: stories.length 
        }); 

    } catch (error) {
        console.error('Get stories error:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        }); 
    }
}