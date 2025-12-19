export const generateMockUsers = (count = 10) => {
    const names = [
        "Alex Johnson", "Sarah Miller", "Michael Chen", "Emma Wilson", 
        "David Brown", "Lisa Taylor", "James Wilson", "Olivia Davis",
        "Robert Garcia", "Sophia Martinez", "William Anderson", "Isabella Thomas"
    ];
    
    const statuses = ['outgoing', 'incoming', 'missed'];
    const callTypes = ['voice', 'video'];
    const times = ['Just now', '10:30 AM', 'Yesterday', '2 days ago', 'Last week', 'Jan 15', 'Jan 10'];
    
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: names[Math.floor(Math.random() * names.length)],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`,
        lastCall: times[Math.floor(Math.random() * times.length)],
        callType: callTypes[Math.floor(Math.random() * callTypes.length)],
        status: statuses[Math.floor(Math.random() * statuses.length)],
        missed: Math.random() > 0.7
    }));
};