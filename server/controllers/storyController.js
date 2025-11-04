import fs from "fs";
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
        let fileId = '';

        // Upload media to imagekit
        if (media_type === 'image' || media_type === 'video') {
            const fileBuffer = fs.readFileSync(media.path);
            const response = await imagekit.upload({
                file: fileBuffer,
                fileName: media.originalname,
            });
            media_url = response.url;
            fileId = response.fileId;
            
            // Delete temporary file
            fs.unlinkSync(media.path);
        }

        // Create story
        const story = await Story.create({
            user: userId,
            content,
            media_url,
            media_type,
            background_color,
            fileId // Store for deletion
        });

        // Schedule story deletion after 24 hours
        await inngest.send({
            name: 'app/story.delete',
            data: { 
                storyId: story._id.toString(),
                fileId: fileId 
            },
            user: { id: userId }
        });

        res.json({ 
            success: true, 
            message: "Story created successfully",
            story 
        });

    } catch (error) {
        console.log(error);
        // Delete temporary file if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}

// Get User Stories
export const getStories = async (req, res) => {
    try {
        const { userId } = req.auth();
        const user = await User.findById(userId);

        // User connections and followings 
        const userIds = [userId, ...user.connections, ...user.following];

        // Get stories from last 24 hours only
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const stories = await Story.find({
            user: { $in: userIds },
            createdAt: { $gte: twentyFourHoursAgo }
        }).populate('user', 'username profile_picture name')
          .sort({ createdAt: -1 });

        // Group stories by user
        const storiesByUser = stories.reduce((acc, story) => {
            const userId = story.user._id.toString();
            if (!acc[userId]) {
                acc[userId] = {
                    user: story.user,
                    stories: []
                };
            }
            acc[userId].stories.push(story);
            return acc;
        }, {});

        res.json({ 
            success: true, 
            stories: storiesByUser 
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
}

// View Story (Add user to views_count)
export const viewStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { storyId } = req.params;

        const story = await Story.findById(storyId);
        
        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Story not found"
            });
        }

        // Check if user already viewed the story
        if (!story.views_count.includes(userId)) {
            story.views_count.push(userId);
            await story.save();
        }

        res.json({
            success: true,
            message: "Story viewed",
            views: story.views_count.length
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Get Story Views
export const getStoryViews = async (req, res) => {
    try {
        const { storyId } = req.params;

        const story = await Story.findById(storyId)
            .populate('views_count', 'username name profile_picture');

        if (!story) {
            return res.status(404).json({
                success: false,
                message: "Story not found"
            });
        }

        res.json({
            success: true,
            views: story.views_count,
            totalViews: story.views_count.length
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Delete Story Helper Function
export const deleteStoryAndMedia = async (storyId, fileId) => {
    try {
        // Delete media from ImageKit if exists
        if (fileId) {
            try {
                await imagekit.deleteFile(fileId);
                console.log(`Media ${fileId} deleted from ImageKit`);
            } catch (mediaError) {
                console.log('Error deleting media from ImageKit:', mediaError);
            }
        }

        // Delete story from database
        await Story.findByIdAndDelete(storyId);
        console.log(`Story ${storyId} deleted successfully`);

        return true;
    } catch (error) {
        console.error('Error deleting story:', error);
        throw error;
    }
}

// Manual cleanup of expired stories
export const cleanupExpiredStories = async (req, res) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const expiredStories = await Story.find({
            createdAt: { $lt: twentyFourHoursAgo }
        });

        let deletedCount = 0;
        for (const story of expiredStories) {
            try {
                await deleteStoryAndMedia(story._id, story.fileId);
                deletedCount++;
            } catch (error) {
                console.error(`Failed to delete story ${story._id}:`, error);
            }
        }

        res.json({
            success: true,
            message: `Deleted ${deletedCount} expired stories`
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}