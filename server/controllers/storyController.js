import imagekit from "../configs/imageKit.js";
import Story from "../models/Story.js";
import User from "../models/User.js";
import { inngest } from "../inngest/index.js";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import stream from 'stream';
import { Buffer } from 'buffer';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Video compression settings for stories
const STORY_VIDEO_SETTINGS = {
  maxSize: 50 * 1024 * 1024, // 50MB for stories
  maxDuration: 30, // 30 seconds for stories
  targetResolution: '720x1280', // Vertical format for stories
  crf: 28,
  preset: 'fast',
  videoBitrate: '1200k',
  audioBitrate: '96k',
  fps: 30
};

// Get video duration safely
const getVideoDuration = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .ffprobe((err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const duration = metadata.format.duration;
        resolve(duration);
      });
  });
};

// Process video in chunks to avoid memory issues
const processVideoInChunks = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    console.log('🎥 Processing story video with compression...');
    
    const chunks = [];
    let totalSize = 0;
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size(STORY_VIDEO_SETTINGS.targetResolution)
      .videoBitrate(STORY_VIDEO_SETTINGS.videoBitrate)
      .fps(STORY_VIDEO_SETTINGS.fps)
      .addOptions([
        `-crf ${STORY_VIDEO_SETTINGS.crf}`,
        `-preset ${STORY_VIDEO_SETTINGS.preset}`,
        '-movflags +faststart',
        '-profile:v high',
        '-level 4.0',
        '-threads 2',
        '-max_muxing_queue_size 1024'
      ])
      .audioCodec('aac')
      .audioBitrate(STORY_VIDEO_SETTINGS.audioBitrate)
      .format('mp4')
      .on('start', () => {
        console.log('🚀 Story video compression started');
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`📊 Story compression progress: ${Math.round(progress.percent)}%`);
        }
      })
      .on('error', (error) => {
        console.log('❌ Story compression error:', error);
        reject(error);
      })
      .on('end', () => {
        console.log('✅ Story video compression completed');
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .pipe()
      .on('data', (chunk) => {
        chunks.push(chunk);
        totalSize += chunk.length;
        
        if (totalSize > STORY_VIDEO_SETTINGS.maxSize) {
          reject(new Error('Compressed video still too large'));
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Fast light compression for large files
const fastLightCompression = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size('720x1280')
      .addOptions([
        '-crf 32',
        '-preset ultrafast',
        '-movflags +faststart',
        '-threads 2'
      ])
      .audioCodec('aac')
      .audioBitrate('64k')
      .format('mp4')
      .on('end', () => {
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .on('error', reject)
      .pipe()
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', reject);
  });
};

// Fallback compression - minimal processing
const fallbackCompression = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    const readableStream = new stream.PassThrough();
    readableStream.end(fileBuffer);
    
    ffmpeg(readableStream)
      .videoCodec('libx264')
      .size('540x960')
      .addOptions([
        '-crf 35',
        '-preset ultrafast'
      ])
      .audioCodec('aac')
      .audioBitrate('48k')
      .format('mp4')
      .on('end', () => {
        const compressedBuffer = Buffer.concat(chunks);
        resolve(compressedBuffer);
      })
      .on('error', (error) => {
        console.log('❌ Fallback compression failed, using original:', error.message);
        resolve(fileBuffer);
      })
      .pipe()
      .on('data', (chunk) => chunks.push(chunk))
      .on('error', () => resolve(fileBuffer));
  });
};

// Optimized video processing with fallbacks
const optimizeVideoProcessing = async (fileBuffer, originalSize) => {
  try {
    if (originalSize <= 25 * 1024 * 1024) {
      return await processVideoInChunks(fileBuffer);
    } else {
      console.log('⚡ Using fast compression for large story video...');
      return await fastLightCompression(fileBuffer);
    }
  } catch (error) {
    console.log('⚠️ Primary compression failed, using fallback:', error.message);
    return await fallbackCompression(fileBuffer);
  }
};

// Add User Story with Video Compression
export const addUserStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { 
            content, 
            media_type, 
            background_color,
            music_data,
            music_duration,
            music_position,
            show_lyrics,
            hide_watermark,
            favorite_part_start,
            card_size,
            card_style
        } = req.body;
        
        const media = req.file;
        let media_url = '';

        console.log('📝 Creating story for user:', userId);
        console.log('📊 Media type:', media_type);
        console.log('📁 Media file:', media ? `Yes (${media.size} bytes)` : 'No');

        // Handle media upload with compression for videos
        if ((media_type === 'image' || media_type === 'video') && media) {
            console.log('📤 Processing media for story...');
            
            // Check if we have a buffer (memory storage)
            if (!media.buffer) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid file upload - no file data received'
                });
            }

            let finalMediaBuffer = media.buffer;

            // Handle video compression
            if (media_type === 'video') {
                console.log('🎥 Processing video for story...');
                
                // Check video size
                if (media.size > STORY_VIDEO_SETTINGS.maxSize) {
                    return res.status(400).json({
                        success: false,
                        message: `Video too large. Maximum size is 50MB. Your file: ${(media.size / 1024 / 1024).toFixed(2)}MB`
                    });
                }

                // Check video duration
                try {
                    const duration = await getVideoDuration(media.buffer);
                    console.log(`⏱️ Story video duration: ${duration} seconds`);
                    
                    if (duration > STORY_VIDEO_SETTINGS.maxDuration) {
                        return res.status(400).json({
                            success: false,
                            message: `Video too long. Maximum duration is 30 seconds. Your video: ${Math.ceil(duration)} seconds`
                        });
                    }
                } catch (durationError) {
                    console.log('⚠️ Could not determine video duration:', durationError.message);
                }

                // Compress videos larger than 5MB
                if (media.size > 5 * 1024 * 1024) {
                    console.log('🔧 Compressing story video for optimal storage...');
                    try {
                        finalMediaBuffer = await optimizeVideoProcessing(media.buffer, media.size);
                        console.log(`✅ Story video compressed: ${(media.size / 1024 / 1024).toFixed(2)}MB → ${(finalMediaBuffer.length / 1024 / 1024).toFixed(2)}MB`);
                        
                        // Check if compressed size is still too large
                        if (finalMediaBuffer.length > STORY_VIDEO_SETTINGS.maxSize) {
                            return res.status(400).json({
                                success: false,
                                message: 'Compressed video still exceeds 50MB limit'
                            });
                        }
                    } catch (compressError) {
                        console.log('⚠️ Story video compression failed, using original:', compressError.message);
                        if (media.size > STORY_VIDEO_SETTINGS.maxSize) {
                            return res.status(400).json({
                                success: false,
                                message: 'Video too large and compression failed'
                            });
                        }
                    }
                } else {
                    console.log('✅ Video is small enough, no compression needed');
                }
            }

            // Upload to ImageKit
            console.log('☁️ Uploading media to ImageKit...');
            const fileBase64 = finalMediaBuffer.toString('base64');
            
            const response = await imagekit.upload({
                file: fileBase64,
                fileName: `story_${Date.now()}_${media.originalname}`,
                folder: '/stories'
            });
            media_url = response.url;
            console.log('✅ Media uploaded to ImageKit:', media_url);
        }

        // Parse music data if provided
        let parsedMusicData = null;
        if (music_data) {
            try {
                parsedMusicData = typeof music_data === 'string' ? JSON.parse(music_data) : music_data;
                console.log('🎵 Parsed music data:', {
                    name: parsedMusicData.name,
                    artist: parsedMusicData.artist,
                    duration: parsedMusicData.duration
                });
            } catch (parseError) {
                console.error('❌ Error parsing music data:', parseError);
                parsedMusicData = null;
            }
        }

        // Parse music position
        let parsedMusicPosition = { x: 50, y: 20 };
        if (music_position) {
            try {
                parsedMusicPosition = typeof music_position === 'string' ? JSON.parse(music_position) : music_position;
            } catch (error) {
                console.error('❌ Error parsing music position:', error);
            }
        }

        // Create story
        console.log('💾 Saving story to database...');
        const storyData = {
            user: userId,
            content,
            media_url,
            media_type,
            background_color,
            music_data: parsedMusicData,
            music_position: parsedMusicPosition,
            show_lyrics: show_lyrics === 'true',
            hide_watermark: hide_watermark === 'true',
            favorite_part_start: parseInt(favorite_part_start) || 0,
            card_size: card_size || 'medium',
            card_style: card_style || 'default'
        };

        const story = await Story.create(storyData);

        console.log('✅ Story created with ID:', story._id);
        console.log('🎵 Music attached:', !!parsedMusicData);

        // Handle story deletion (make Inngest optional)
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

        // SUCCESS: Return success response
        res.json({ 
            success: true, 
            message: 'Story created successfully!',
            story: {
                id: story._id,
                content: story.content,
                media_url: story.media_url,
                media_type: story.media_type,
                background_color: story.background_color,
                music_data: story.music_data,
                music_position: story.music_position,
                show_lyrics: story.show_lyrics,
                hide_watermark: story.hide_watermark,
                card_size: story.card_size,
                card_style: story.card_style,
                favorite_part_start: story.favorite_part_start,
                createdAt: story.createdAt
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

// Get Single Story
export const getStory = async (req, res) => {
    try {
        const { storyId } = req.params;
        
        const story = await Story.findById(storyId).populate('user');
        
        if (!story) {
            return res.status(404).json({
                success: false,
                message: 'Story not found'
            });
        }

        res.json({
            success: true,
            story
        });

    } catch (error) {
        console.error('Get story error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Delete Story
export const deleteStory = async (req, res) => {
    try {
        const { userId } = req.auth();
        const { storyId } = req.params;

        const story = await Story.findOne({ _id: storyId, user: userId });
        
        if (!story) {
            return res.status(404).json({
                success: false,
                message: 'Story not found or you do not have permission to delete it'
            });
        }

        await Story.findByIdAndDelete(storyId);
        
        console.log(`✅ Story ${storyId} deleted by user ${userId}`);
        
        res.json({
            success: true,
            message: 'Story deleted successfully'
        });

    } catch (error) {
        console.error('Delete story error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}