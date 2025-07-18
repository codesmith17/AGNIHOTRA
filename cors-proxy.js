const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Enable CORS for all routes
app.use(cors());

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Proxy endpoint for homatherapie.de
app.use('/api/agnihotra', createProxyMiddleware({
    target: 'https://www.homatherapie.de',
    changeOrigin: true,
    pathRewrite: {
        '^/api/agnihotra': '/en/Agnihotra_Zeitenprogramm/results.html'
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request to homatherapie.de:', req.method, req.originalUrl);
        
        // Forward form data for POST requests
        if (req.method === 'POST' && req.body) {
            const bodyData = new URLSearchParams(req.body).toString();
            proxyReq.setHeader('Content-Type', 'application/x-www-form-urlencoded');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        }
    }
}));

// Serve static files from current directory
app.use(express.static('.'));

app.listen(PORT, () => {
    console.log(`🌅 Agnihotra CORS Proxy running on http://localhost:${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser`);
    console.log(`🔧 Proxy endpoint: http://localhost:${PORT}/api/agnihotra`);
}); 