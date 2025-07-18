// Vercel serverless function for CORS proxy
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        console.log('🌅 Proxying request to homatherapie.de...');
        
        // Forward the request to homatherapie.de
        const response = await fetch('https://www.homatherapie.de/en/Agnihotra_Zeitenprogramm/results.html', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (compatible; AgnihotraApp/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            },
            body: new URLSearchParams(req.body).toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const htmlText = await response.text();
        
        // Log success
        console.log('✅ Successfully fetched data from homatherapie.de');
        
        // Return the HTML content
        res.status(200).send(htmlText);
        
    } catch (error) {
        console.error('❌ Error proxying request:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from homatherapie.de',
            details: error.message 
        });
    }
} 