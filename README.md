# EternalAgni - Agnihotra Timing App 🔥

Precise sunrise and sunset timing for Agnihotra practice with location-based calculations.

## 🌅 Features

- **Seconds-precision timing** for accurate Agnihotra practice
- **Automatic location detection** (GPS or IP-based)
- **Smart upcoming countdowns** based on current time
- **Offline-ready** with fallback APIs

## 🚀 Quick Start

### Option 1: Basic Usage (sunrisesunset.io API)
Simply open `index.html` in your browser. This provides seconds-precision timing suitable for Agnihotra.

### Option 2: Maximum Precision (homatherapie.de API)
For the most precise timing used by Agnihotra practitioners worldwide:

#### 🚀 Method A: Deployed Proxy (Best for sharing)
Deploy your own CORS proxy so **anyone can use your app**:

```bash
# Quick deployment (interactive script)
./deploy.sh

# Or deploy manually:
# Vercel: vercel --prod
# Netlify: netlify deploy --prod --dir .
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

#### 🔧 Method B: Local Proxy Server
```bash
# Install dependencies
npm install

# Start the CORS proxy server
npm start

# Open http://localhost:8080 in your browser
```

#### ⚡ Method C: Browser Extension
1. Install "CORS Unblock" extension in Chrome
2. Enable it when using the app
3. Disable it for normal browsing

#### 🛠️ Method D: Chrome with CORS Disabled
```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" file://$(pwd)/index.html

# Windows
chrome.exe --disable-web-security --user-data-dir="c:/temp/chrome_dev" file:///path/to/index.html

# Linux
google-chrome --disable-web-security --user-data-dir="/tmp/chrome_dev" file://$(pwd)/index.html
```

## 🔧 How It Works

### API Priority System
1. **homatherapie.de** (via local proxy) - Maximum precision
2. **sunrisesunset.io** (direct) - Seconds precision, CORS-friendly

### Location Detection
1. **GPS coordinates** (if permission granted) - Most accurate
2. **IP geolocation** (if GPS denied) - City-level accuracy
3. **Error handling** with clear user guidance

### Smart Timing Logic
- **Before sunrise**: Shows today's sunrise + sunset
- **After sunrise**: Shows tomorrow's sunrise + sunset

## 📱 Browser Compatibility

- ✅ **Chrome/Edge**: Full support
- ✅ **Firefox**: Full support  
- ✅ **Safari**: Full support
- ✅ **Mobile browsers**: Works on all devices

## 🛠️ Development

### Local Development with Proxy
```bash
# Start the proxy server
npm run dev

# Open http://localhost:8080 in browser
# Or serve the files via any web server
```

### Project Structure
```
AGNIHOTRA/
├── index.html          # Main app
├── script.js           # Core functionality
├── style.css           # Styling
├── cors-proxy.js       # CORS bypass server
├── package.json        # Node.js dependencies
└── README.md           # This file
```

## 🔒 Security Notes

- **CORS bypass methods are for development/personal use only**
- **Don't use CORS-disabled browsers for general browsing**
- **The proxy server only forwards requests to homatherapie.de**

## 🌍 Location Privacy

- **GPS data**: Never stored, only used for timing calculations
- **IP geolocation**: Uses free services, no tracking
- **No data collection**: Everything runs client-side

## 📖 Agnihotra Practice

This app provides the precise timing needed for traditional Agnihotra fire ceremonies:

- **Sunrise timing**: For morning Agnihotra
- **Sunset timing**: For evening Agnihotra  
- **Seconds precision**: Essential for proper practice
- **Location-specific**: Accurate for your exact coordinates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with both APIs
5. Submit a pull request

## 📄 License

MIT License - Feel free to use for personal or educational purposes.

---

**🕉️ May your Agnihotra practice bring peace and healing to the world** 🕉️ 