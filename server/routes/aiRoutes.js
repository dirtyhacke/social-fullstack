import express from 'express';
import { CohereClient } from 'cohere-ai';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// Cohere AI Configuration
const COHERE_API_KEY = process.env.COHERE_API_KEY || 'eCSBEHJCBAYUFRequwkNJ8YU0Z10ZY0nmSKUTx1R';

console.log('🔧 AI Configuration:');
console.log('   COHERE_API_KEY:', COHERE_API_KEY ? 'Present' : 'Not found');

let cohere = null;
let cohereEnabled = false;
let workingModel = null;

// Initialize Cohere
try {
    if (COHERE_API_KEY && COHERE_API_KEY.length > 10) {
        cohere = new CohereClient({ 
            token: COHERE_API_KEY 
        });
        console.log('✅ Cohere client initialized');
        
        // Test available models
        testCohereModels();
    } else {
        console.log('❌ Cohere API key is invalid');
    }
} catch (error) {
    console.error('❌ Failed to initialize Cohere:', error);
}

async function testCohereModels() {
    if (!cohere) return;
    
    console.log('🔍 Testing Cohere models...');
    
    // Test command-nightly (we know this works)
    try {
        const chatResponse = await cohere.chat({
            model: 'command-nightly',
            message: 'Say "OK" only.',
            // No maxTokens limit - let it generate freely
        });
        
        if (chatResponse.text) {
            console.log('✅ command-nightly works via Chat API');
            cohereEnabled = true;
            workingModel = 'command-nightly';
            return;
        }
    } catch (error) {
        console.log('❌ command-nightly failed:', error.message);
    }
    
    console.log('❌ No working Cohere models found');
    cohereEnabled = false;
}

// Enhanced Demo Mode - Fallback (unlimited responses)
const getMockResponse = (userMessage, conversationHistory = []) => {
    const message = userMessage.toLowerCase();
    
    const lastUserMessage = conversationHistory
        .filter(msg => !msg.isBot)
        .slice(-1)[0]?.text?.toLowerCase() || '';

    // Smart contextual responses - more detailed and natural
    if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        const greetings = [
            "Hello there! 👋 It's great to connect with you. I'm your AI assistant, here to help with any questions, conversations, or tasks you might have. What would you like to explore today?",
            "Hi! 😊 Wonderful to meet you. I'm an AI assistant ready to assist you with information, creative ideas, problem-solving, or just a friendly chat. What's on your mind?",
            "Hey! Thanks for reaching out. I'm here and excited to help you with whatever you need - whether it's answering questions, brainstorming ideas, explaining concepts, or having a meaningful conversation. Where shall we begin?",
            "Hello! 👋 I'm delighted to chat with you. As your AI assistant, I can help with a wide range of topics from casual conversation to in-depth discussions. What would you like to talk about today?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    }
    
    if (message.includes('how are you')) {
        return "I'm functioning excellently, thank you for asking! 😊 I'm always ready and energized to help you with whatever questions, tasks, or conversations you have in mind. The world of information and ideas is vast, and I'm here to explore it with you. What would you like to dive into first?";
    }
    
    if (message.includes('what can you do') || message.includes('help')) {
        return "I have a wide range of capabilities to assist you! I can engage in deep conversations, answer complex questions, help with creative writing and brainstorming, explain detailed concepts across various fields, provide analysis and insights, assist with problem-solving, offer different perspectives on topics, help with learning and education, support research, and much more. I'm particularly good at understanding context and providing comprehensive, thoughtful responses. Whether you need brief answers or detailed explanations, I adapt to your needs. What specific area would you like to explore together?";
    }
    
    if (message.includes('thank')) {
        return "You're very welcome! 😊 It's truly my pleasure to assist you. I'm here whenever you need help, information, or just someone to chat with. Don't hesitate to reach out if you have more questions, need further clarification, or want to explore any other topics. Your curiosity and engagement make these conversations meaningful!";
    }
    
    if (message.includes('joke') || message.includes('funny')) {
        const jokes = [
            "Why don't scientists trust atoms? Because they make up everything! But here's the quantum twist - atoms are actually quite reliable when you get to know them, unlike my attempts at being a stand-up comedian!",
            "Why did the scarecrow win an award? He was outstanding in his field! Though I must say, for someone who's outstanding in his field, he's remarkably grounded and doesn't let the recognition go to his head... or should I say, his straw?",
            "What do you call a fake noodle? An impasta! It's the kind of pasta that's always telling tall tales about its Italian heritage while secretly being born and raised in a factory in Ohio.",
            "Why did the bicycle fall over? Because it was two tired! And honestly, can you blame it? All that cycling around town without a proper nap - I'd be falling over too!",
            "What do you call a sleeping bull? A bulldozer! Though I imagine it would be quite a sight to see a bull gently snoring while somehow simultaneously leveling small buildings in its dreams."
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }
    
    if (message.includes('weather')) {
        return "While I don't have access to real-time weather data or meteorological sensors, I can certainly discuss weather patterns, climate science, meteorological phenomena, or help you understand how weather systems work. I can explain everything from basic concepts like high and low pressure systems to more complex topics like climate change, atmospheric science, or historical weather patterns. If you're interested in a specific location's typical climate or want to understand weather-related concepts, I'd be happy to provide detailed information!";
    }
    
    if (message.includes('time')) {
        return `According to my internal clock, the current time is ${new Date().toLocaleTimeString()}, but since I exist in the digital realm, I don't experience time quite the same way humans do. I'm available 24/7 regardless of time zones, daylight saving, or whether it's the middle of the night or bright morning! The concept of time is fascinating though - from biological clocks to cosmological time scales. Would you like to discuss the philosophy or science of time?`;
    }
    
    if (message.includes('who are you') || message.includes('name') || message.includes('what are you')) {
        return "I'm an AI assistant, a sophisticated language model designed to understand and generate human-like text based on the input I receive. Think of me as a digital companion that can engage in meaningful conversations, provide information across countless topics, help with creative tasks, solve problems, and offer insights. I don't have a physical form or personal experiences, but I've been trained on vast amounts of information to assist with virtually any subject. I'm here to be helpful, informative, and engaging - whether you need quick facts, deep discussions, creative inspiration, or just someone to chat with. What would you like to know about my capabilities?";
    }
    
    if (message.includes('bye') || message.includes('goodbye') || message.includes('see you')) {
        return "Goodbye for now! 👋 It's been wonderful chatting with you. Remember, I'm always here whenever you need assistance, want to continue our conversation, or have new questions to explore. Don't be a stranger - come back anytime! Safe travels through the digital world until we meet again!";
    }
    
    if (message.includes('ai') || message.includes('artificial intelligence')) {
        return "Artificial Intelligence is a truly fascinating field that's rapidly evolving! I'm an example of what's possible with current AI technology - specifically large language models trained on diverse information. AI systems like me can understand context, generate human-like text, assist with complex tasks, and engage in meaningful conversations. The field encompasses everything from machine learning and neural networks to natural language processing and computer vision. What's particularly exciting is how AI is becoming more accessible and integrated into daily life, helping with education, creativity, problem-solving, and information access. The ethical development and responsible use of AI are also crucial topics worth discussing. What aspect of AI interests you most?";
    }
    
    if (message.includes('code') || message.includes('programming') || message.includes('javascript') || message.includes('python') || message.includes('java') || message.includes('c++')) {
        return "I'd be delighted to help with programming and software development topics! I can assist with understanding programming concepts, explaining algorithms, discussing best practices, helping debug issues, providing code examples, explaining different programming paradigms, comparing languages and frameworks, discussing software architecture, and much more. Whether you're working on web development, mobile apps, data science, system programming, or learning to code, I can provide detailed explanations and guidance. I can discuss everything from basic syntax to advanced concepts like machine learning implementations, concurrent programming, or system design. What specific programming topic or challenge would you like to explore?";
    }
    
    // Follow-up context with more depth
    if (lastUserMessage.includes('weather')) {
        return "Building on our weather discussion, there are so many fascinating aspects we could explore! We could dive into specific meteorological phenomena like hurricanes or tornado formation, discuss climate change impacts, explore historical weather events, examine how weather forecasting works, or even discuss the cultural and psychological impacts of weather on human societies. Weather connects to so many fields - geography, physics, environmental science, and even economics and history. What particular angle of weather and climate interests you most?";
    }
    
    if (lastUserMessage.includes('joke')) {
        return "Humor is such a wonderful part of human interaction! Beyond just telling jokes, we could explore different types of comedy, the psychology of what makes things funny, the cultural aspects of humor, or even discuss famous comedians and comedy styles throughout history. Humor varies so much across cultures and time periods - what one generation finds hilarious, another might not understand. Would you like another joke, or shall we explore the fascinating world of comedy and laughter more deeply?";
    }
    
    if (lastUserMessage.includes('programming') || lastUserMessage.includes('code')) {
        return "Programming is such a vast and rewarding field! There are endless directions we could take our discussion. We could explore specific programming languages in depth, discuss software development methodologies, examine emerging technologies like quantum computing or blockchain, dive into algorithm design and optimization, explore the history of computing, discuss the future of software development with AI assistance, or even tackle specific programming challenges you're facing. The world of code is constantly evolving, with new frameworks, tools, and paradigms emerging regularly. What specific aspect of programming would you like to delve into more deeply?";
    }
    
    if (lastUserMessage.includes('ai') || lastUserMessage.includes('artificial intelligence')) {
        return "The landscape of artificial intelligence is constantly evolving with new breakthroughs and discussions. We could explore specific AI applications in various industries, discuss the ethical considerations of AI development, examine different machine learning approaches, explore the history of AI research, discuss the future possibilities and limitations of AI, or even dive into technical aspects like neural network architectures and training methodologies. The intersection of AI with other fields like neuroscience, philosophy, and ethics makes for particularly fascinating discussions. What specific dimension of artificial intelligence would you like to explore further?";
    }
    
    // Default comprehensive responses
    const defaultResponses = [
        `I find your question about "${userMessage}" quite intriguing! This topic touches on several interesting dimensions that we could explore together. Let me provide you with a comprehensive perspective that covers the key aspects, potential implications, and related concepts that might enhance your understanding. The subject connects to broader themes in fascinating ways that we could unpack through our conversation.`,
        
        `Thank you for bringing up "${userMessage}" - it's a thoughtful topic that deserves careful consideration. There are multiple angles we could examine here, from the fundamental principles to the practical applications and even the philosophical underpinnings. I'd like to offer you a detailed exploration that addresses both the core concepts and the wider context, ensuring you have a well-rounded understanding of the subject matter.`,
        
        `"${userMessage}" presents a wonderful opportunity for deep discussion! This is the kind of topic that reveals its richness the more we examine it from different perspectives. I'd be delighted to walk you through the essential information while also exploring the nuances, controversies, historical context, and future directions related to this subject. The interconnected nature of knowledge means we can draw connections to many related fields.`,
        
        `I appreciate you asking about "${userMessage}" - it shows genuine curiosity and engagement with the world around you. This topic intersects with so many interesting areas of knowledge that we could spend hours exploring its various facets. Let me provide you with a thorough explanation that covers the basics while also diving into the more complex and thought-provoking aspects that make this subject so compelling to discuss.`,
        
        `Your question about "${userMessage}" opens up a fascinating dialogue! What I find particularly interesting about this topic is how it connects to broader themes across different disciplines. I'd like to offer you a comprehensive response that not only addresses your immediate question but also explores the historical context, current developments, potential future trends, and the various perspectives that experts bring to this subject.`
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
};

router.post('/chat', protect, async (req, res) => {
    try {
        const { message, conversation_history = [] } = req.body;
        
        if (!message || !message.trim()) {
            return res.json({
                success: false,
                message: 'Message is required'
            });
        }

        // Use Cohere if available and enabled
        if (cohereEnabled && cohere && workingModel) {
            console.log(`🤖 Using Cohere AI (${workingModel})...`);

            try {
                // Build conversation history for Chat API
                const chatHistory = conversation_history.slice(-10).map(msg => ({
                    role: msg.isBot ? 'CHATBOT' : 'USER',
                    message: msg.text
                }));

                const chatResponse = await cohere.chat({
                    model: workingModel,
                    message: message,
                    chatHistory: chatHistory,
                    // NO LIMITS - let Cohere generate freely
                    temperature: 0.7,
                    // No maxTokens - unlimited response length
                    // No other restrictions
                });

                const aiResponse = chatResponse.text.trim();
                
                console.log('✅ Cohere response received (unlimited)');
                
                return res.json({
                    success: true,
                    response: aiResponse,
                    provider: 'cohere',
                    model: workingModel
                });

            } catch (cohereError) {
                console.error('❌ Cohere API error:', cohereError);
                cohereEnabled = false; // Disable Cohere for future requests
                // Fall through to demo mode
            }
        }

        // Use enhanced demo mode (fallback) - also unlimited
        console.log('🤖 Using Enhanced Demo Mode');
        const mockResponse = getMockResponse(message, conversation_history);
        
        // Simulate thinking time
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 800));
        
        res.json({
            success: true,
            response: mockResponse,
            isMock: true,
            provider: 'demo'
        });
        
    } catch (error) {
        console.error('❌ AI Error:', error);
        
        const mockResponse = getMockResponse(req.body.message || "your message");
        
        res.json({
            success: true,
            response: mockResponse,
            isMock: true,
            provider: 'fallback'
        });
    }
});

router.get('/status', protect, async (req, res) => {
    try {
        if (cohereEnabled && workingModel) {
            // Test the API to make sure it's still working
            try {
                const testResponse = await cohere.chat({
                    model: workingModel,
                    message: 'Say "OK" only.',
                    // No limits
                });

                return res.json({
                    success: true,
                    message: `Cohere AI (${workingModel}) is working - UNLIMITED MODE`,
                    status: 'online',
                    online: true,
                    provider: 'cohere',
                    model: workingModel,
                    unlimited: true
                });
            } catch (testError) {
                console.error('❌ Cohere status check failed:', testError);
                cohereEnabled = false;
                // Fall through to demo mode
            }
        }

        return res.json({
            success: true,
            message: 'Using Enhanced Demo Mode - UNLIMITED RESPONSES',
            status: 'demo',
            online: true,
            provider: 'demo',
            unlimited: true
        });
        
    } catch (error) {
        console.error('❌ Status check failed:', error);
        
        res.json({
            success: true,
            message: 'Using Enhanced Demo Mode',
            status: 'demo',
            online: true,
            provider: 'demo',
            unlimited: true
        });
    }
});

// Test Cohere endpoint - unlimited
router.get('/test-cohere', protect, async (req, res) => {
    try {
        if (!cohere) {
            return res.json({
                success: false,
                message: 'Cohere client not initialized'
            });
        }

        if (cohereEnabled && workingModel) {
            const testResponse = await cohere.chat({
                model: workingModel,
                message: 'Write a comprehensive paragraph about artificial intelligence and its impact on modern society, covering key developments, benefits, challenges, and future possibilities.',
                // No limits - let it write as much as it wants
            });

            res.json({
                success: true,
                message: 'Cohere AI is working - UNLIMITED MODE',
                response: testResponse.text,
                model: workingModel,
                responseLength: testResponse.text.length,
                unlimited: true
            });
        } else {
            res.json({
                success: false,
                message: 'Cohere is not enabled',
                workingModel: workingModel,
                cohereEnabled: cohereEnabled
            });
        }
        
    } catch (error) {
        res.json({
            success: false,
            message: 'Cohere test failed',
            error: error.message
        });
    }
});

export default router;