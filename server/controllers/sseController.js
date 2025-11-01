// Store SSE connections
export const connections = new Map();

export const setupSSE = (req, res) => {
    const userId = req.params.userId;
    
    console.log('🔗 SSE connected for user:', userId);
    
    // Set headers for SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'SSE Connected' })}\n\n`);

    // Store the connection
    connections.set(userId, res);

    // Remove connection when client disconnects
    req.on('close', () => {
        console.log('🔌 SSE disconnected for user:', userId);
        connections.delete(userId);
        res.end();
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        if (connections.has(userId)) {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
        } else {
            clearInterval(heartbeat);
        }
    }, 30000);
};

// Send message to specific user via SSE
export const sendSSEMessage = (userId, data) => {
    const connection = connections.get(userId);
    if (connection) {
        connection.write(`data: ${JSON.stringify(data)}\n\n`);
        console.log('📤 SSE message sent to user:', userId);
        return true;
    }
    console.log('❌ No SSE connection for user:', userId);
    return false;
};