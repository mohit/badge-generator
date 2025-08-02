import express from 'express';
import multer from 'multer';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { promises as dns } from 'dns';
import { config } from 'dotenv';
import fetch from 'node-fetch';

config();

// Domain validation constants
const VERIFIED_ISSUER_DOMAIN = 'badge-generator-production.up.railway.app';
const SAFE_TEST_DOMAINS = [
  'example.com',
  'example.org', 
  'example.net',
  'test.example.com',
  'demo.example.org',
  'localhost',
  '127.0.0.1'
];

// Domain validation function
async function validateIssuerDomain(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Check if it's our verified issuer
    if (domain === VERIFIED_ISSUER_DOMAIN) {
      return {
        valid: true,
        type: 'verified',
        warnings: [],
        message: 'Using verified Badge Generator issuer'
      };
    }
    
    // Check if it's a verified external issuer
    const verifiedIssuer = getVerifiedIssuer(domain);
    if (verifiedIssuer && verifiedIssuer.status === 'verified') {
      return {
        valid: true,
        type: 'verified-external',
        warnings: [],
        message: `Using verified issuer: ${verifiedIssuer.displayName}`,
        issuer: verifiedIssuer
      };
    }
    
    // Check if it's a safe testing domain
    const isSafeTestDomain = SAFE_TEST_DOMAINS.some(safeDomain => 
      domain === safeDomain || domain.endsWith('.' + safeDomain)
    );
    
    if (isSafeTestDomain) {
      return {
        valid: true,
        type: 'testing',
        warnings: ['Using example.com domain - safe for testing only'],
        message: 'Safe testing domain'
      };
    }
    
    // Check if domain is registered (block real domains unless verified)
    try {
      await dns.lookup(domain);
      // Domain exists - check if it has a failed verification record
      if (verifiedIssuer && verifiedIssuer.status === 'failed') {
        return {
          valid: false,
          type: 'verification-failed',
          warnings: [],
          message: `Domain '${domain}' verification failed. Please fix your /.well-known/openbadges-issuer.json file and re-verify.`,
          error: 'VERIFICATION_FAILED',
          lastError: verifiedIssuer.lastError
        };
      }
      
      // Domain exists but not verified - suggest verification
      return {
        valid: false,
        type: 'unverified',
        warnings: [],
        message: `Domain '${domain}' appears to be registered but not verified. Please verify your domain using /api/issuers/verify or use example.com domains for testing.`,
        error: 'DOMAIN_UNVERIFIED'
      };
    } catch (err) {
      // Domain doesn't exist - allow it (might be local/test domain)
      return {
        valid: true,
        type: 'unregistered',
        warnings: ['Using unregistered domain - ensure this is intentional'],
        message: 'Unregistered domain allowed'
      };
    }
    
  } catch (err) {
    return {
      valid: false,
      type: 'invalid',
      warnings: [],
      message: 'Invalid URL format',
      error: 'INVALID_URL'
    };
  }
}

// Helper function to ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
  }
}

// Helper functions for verified issuer storage
function loadVerifiedIssuers() {
  const filePath = path.join('uploads', 'verified-issuers.json');
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('Error loading verified issuers:', error);
      return {};
    }
  }
  return {};
}

function saveVerifiedIssuers(issuers) {
  ensureUploadsDir();
  const filePath = path.join('uploads', 'verified-issuers.json');
  fs.writeFileSync(filePath, JSON.stringify(issuers, null, 2));
}

function getVerifiedIssuer(domain) {
  const issuers = loadVerifiedIssuers();
  return issuers[domain] || null;
}

function setVerifiedIssuer(domain, issuerData) {
  const issuers = loadVerifiedIssuers();
  issuers[domain] = {
    ...issuerData,
    lastUpdated: new Date().toISOString()
  };
  saveVerifiedIssuers(issuers);
  return issuers[domain];
}

// Verify issuer by fetching their well-known file
async function verifyIssuerDomain(domain) {
  try {
    const wellKnownUrl = `https://${domain}/.well-known/openbadges-issuer.json`;
    
    console.log(`Verifying issuer domain: ${domain}`);
    console.log(`Fetching: ${wellKnownUrl}`);
    
    // Fetch the well-known file
    const response = await fetch(wellKnownUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Badge-Generator-Verifier/1.0'
      }
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch well-known file: HTTP ${response.status}`,
        details: { 
          url: wellKnownUrl,
          status: response.status,
          statusText: response.statusText
        }
      };
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return {
        success: false,
        error: `Well-known file is not JSON (content-type: ${contentType})`,
        details: { url: wellKnownUrl, contentType }
      };
    }
    
    let issuerData;
    try {
      issuerData = await response.json();
    } catch (parseError) {
      return {
        success: false,
        error: `Invalid JSON in well-known file: ${parseError.message}`,
        details: { url: wellKnownUrl }
      };
    }
    
    // Validate required fields
    const requiredFields = ['id', 'type', 'name'];
    const missingFields = requiredFields.filter(field => !issuerData[field]);
    
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: { url: wellKnownUrl, missingFields }
      };
    }
    
    // Validate that the ID matches the well-known URL or domain
    const validIds = [
      wellKnownUrl,
      `https://${domain}`,
      `https://${domain}/`,
      `https://${domain}/.well-known/openbadges-issuer.json`
    ];
    
    if (!validIds.includes(issuerData.id)) {
      return {
        success: false,
        error: `Issuer ID '${issuerData.id}' does not match domain '${domain}'`,
        details: { 
          url: wellKnownUrl, 
          issuerId: issuerData.id,
          expectedIds: validIds 
        }
      };
    }
    
    // Validate type (Open Badges v2.0 or v3.0)
    const validTypes = ['Issuer', 'Profile'];
    if (!validTypes.includes(issuerData.type)) {
      return {
        success: false,
        error: `Invalid type '${issuerData.type}'. Must be 'Issuer' or 'Profile'`,
        details: { url: wellKnownUrl, type: issuerData.type }
      };
    }
    
    // Success - store the verified issuer
    const verifiedIssuer = {
      id: issuerData.id,
      domain: domain,
      status: 'verified',
      displayName: issuerData.name,
      type: issuerData.type,
      url: issuerData.url || `https://${domain}`,
      email: issuerData.email,
      description: issuerData.description,
      publicKeys: issuerData.publicKey ? [issuerData.publicKey] : (issuerData.publicKeys || []),
      wellKnownUrl: wellKnownUrl,
      lastVerified: new Date().toISOString(),
      verificationMethod: 'well-known',
      rawData: issuerData // Store original for debugging
    };
    
    setVerifiedIssuer(domain, verifiedIssuer);
    
    return {
      success: true,
      issuer: verifiedIssuer,
      message: `Successfully verified issuer: ${issuerData.name}`
    };
    
  } catch (error) {
    console.error(`Error verifying issuer ${domain}:`, error);
    return {
      success: false,
      error: `Verification failed: ${error.message}`,
      details: { domain, errorType: error.name }
    };
  }
}

// Ensure uploads directory exists at startup
ensureUploadsDir();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.UPLOAD_PASSWORD + '_session',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use('/badges', express.static('uploads'));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const filename = req.body.filename || file.originalname;
    cb(null, filename);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || path.extname(file.originalname) === '.json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Middleware to check API key
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid API key' });
  }
};

// Routes
app.get('/', (req, res) => {
  res.redirect('/upload');
});

app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Badge Generator - Login</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0056b3; }
        .error { color: red; margin-top: 10px; }
      </style>
    </head>
    <body>
      <h2>Login to Badge Generator</h2>
      <form method="POST" action="/login">
        <div class="form-group">
          <label for="password">Password:</label>
          <input type="password" id="password" name="password" required>
        </div>
        <button type="submit">Login</button>
        ${req.query.error ? '<div class="error">Invalid password</div>' : ''}
      </form>
    </body>
    </html>
  `);
});

app.post('/login', (req, res) => {
  if (req.body.password === process.env.UPLOAD_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/upload');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/upload', requireAuth, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Badge Generator - Upload</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="file"], input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        textarea { width: 100%; height: 300px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 14px; }
        button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px; }
        button:hover { background: #218838; }
        .logout { float: right; background: #dc3545; margin-right: 0; }
        .logout:hover { background: #c82333; }
        .success { color: green; margin-top: 10px; }
        .error { color: red; margin-top: 10px; }
        .tabs { display: flex; margin-bottom: 20px; border-bottom: 1px solid #ddd; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; }
        .tab.active { border-bottom-color: #28a745; font-weight: bold; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .json-editor { border: 1px solid #ddd; border-radius: 4px; padding: 15px; background: #f8f9fa; }
        .template-buttons { margin-bottom: 15px; }
        .template-btn { background: #6c757d; font-size: 12px; padding: 5px 10px; }
        .template-btn:hover { background: #5a6268; }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Badge Generator</h2>
        <a href="/logout"><button class="logout">Logout</button></a>
      </div>
      
      <div class="tabs">
        <div class="tab active" onclick="switchTab('upload')">File Upload</div>
        <div class="tab" onclick="switchTab('editor')">JSON Editor</div>
        <div class="tab" onclick="switchTab('smart')">Smart Badge Creator</div>
      </div>
      
      <div id="upload-tab" class="tab-content active">
        <h3>Upload JSON File</h3>
        <form method="POST" action="/upload" enctype="multipart/form-data">
          <div class="form-group">
            <label for="filename">Custom Filename (optional):</label>
            <input type="text" id="filename" name="filename" placeholder="badge.json">
          </div>
          <div class="form-group">
            <label for="file">JSON File:</label>
            <input type="file" id="file" name="file" accept=".json,application/json" required>
          </div>
          <button type="submit">Upload File</button>
        </form>
      </div>
      
      <div id="editor-tab" class="tab-content">
        <h3>Create JSON Directly</h3>
        <div class="json-editor">
          <div class="template-buttons">
            <strong>v2.0 Templates:</strong><br>
            <button type="button" class="template-btn" onclick="loadTemplate('issuer')">Issuer</button>
            <button type="button" class="template-btn" onclick="loadTemplate('badge-class')">Badge Class</button>
            <button type="button" class="template-btn" onclick="loadTemplate('assertion')">Assertion</button>
            <br><br>
            <strong>v3.0 Templates:</strong><br>
            <button type="button" class="template-btn" onclick="loadTemplate('issuer-v3')">Profile (Issuer)</button>
            <button type="button" class="template-btn" onclick="loadTemplate('achievement-v3')">Achievement</button>
            <button type="button" class="template-btn" onclick="loadTemplate('credential-v3')">OpenBadgeCredential</button>
            <br><br>
            <button type="button" class="template-btn" onclick="clearEditor()">Clear</button>
          </div>
          <form method="POST" action="/create-json">
            <div class="form-group">
              <label for="json-filename">Filename:</label>
              <input type="text" id="json-filename" name="filename" placeholder="my-badge.json" required>
            </div>
            <div class="form-group">
              <label for="json-content">JSON Content:</label>
              <textarea id="json-content" name="content" placeholder="Enter your JSON here..." required></textarea>
            </div>
            <button type="submit">Create JSON File</button>
            <button type="button" onclick="validateJSON()">Validate JSON</button>
          </form>
        </div>
      </div>
      
      <div id="smart-tab" class="tab-content">
        <h3>Smart Badge Creator</h3>
        <p>Paste your Issuer, Badge Class, and Assertion JSON objects below. The system will automatically link them together and save them with proper references.</p>
        <form method="POST" action="/create-smart-badge">
          <div class="form-group">
            <label for="badge-title">Badge Title/Prefix:</label>
            <input type="text" id="badge-title" name="title" placeholder="my-awesome-badge" required>
            <small>Files will be saved as: {title}-issuer.json, {title}-badge.json, {title}-assertion.json</small>
          </div>
          <div class="form-group">
            <label for="smart-content">JSON Objects (paste all together):</label>
            <textarea id="smart-content" name="content" placeholder="Paste your Issuer, Badge Class, and Assertion JSON objects here. You can paste them all together - the system will separate and link them automatically." required style="height: 400px;"></textarea>
          </div>
          <button type="submit">Create Smart Badge</button>
          <button type="button" onclick="loadSmartExample()">Load Example</button>
          <button type="button" onclick="validateSmartJSON()">Validate JSON</button>
        </form>
      </div>
      
      <h3>Uploaded Files</h3>
      <div id="file-list"></div>
      
      <script>
        function switchTab(tabName) {
          document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
          
          document.querySelector(\`[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
          document.getElementById(\`\${tabName}-tab\`).classList.add('active');
        }
        
        function loadTemplate(type) {
          const templates = {
            'issuer': {
              "@context": "https://w3id.org/openbadges/v2",
              "type": "Issuer",
              "id": "https://demo.example.org/issuer/1",
              "name": "Demo Training Institute",
              "url": "https://demo.example.org",
              "email": "badges@demo.example.org",
              "description": "A demonstration training institute for testing badge issuance",
              "image": "https://demo.example.org/logo.png"
            },
            'badge-class': {
              "@context": "https://w3id.org/openbadges/v2",
              "type": "BadgeClass",
              "id": "https://demo.example.org/badge/excellence",
              "name": "Excellence Badge",
              "description": "Awarded for demonstrating excellence in learning",
              "image": "https://demo.example.org/badge.png",
              "criteria": "https://demo.example.org/criteria/excellence",
              "issuer": "https://demo.example.org/issuer/1",
              "tags": ["excellence", "achievement", "demo"]
            },
            'assertion': {
              "@context": "https://w3id.org/openbadges/v2",
              "type": "Assertion",
              "id": "https://demo.example.org/assertion/123",
              "recipient": {
                "type": "email",
                "hashed": false,
                "identity": "learner@test.example.com"
              },
              "badge": "https://demo.example.org/badge/excellence",
              "issuedOn": new Date().toISOString(),
              "evidence": "https://test.example.com/portfolio/123"
            },
            'issuer-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://demo.example.org/issuers/1",
              "type": "Profile",
              "name": "Demo Training Institute",
              "url": "https://demo.example.org",
              "email": "badges@demo.example.org",
              "description": "A demonstration training institute for testing v3.0 badge issuance"
            },
            'achievement-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://demo.example.org/achievements/excellence",
              "type": "Achievement",
              "name": "Excellence Achievement",
              "description": "Awarded for demonstrating excellence in learning and skill development",
              "achievementType": "Certificate",
              "criteria": {
                "narrative": "Demonstrates mastery of core competencies and sustained excellence"
              },
              "image": {
                "id": "https://demo.example.org/badge.png",
                "type": "Image"
              }
            },
            'credential-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://demo.example.org/credentials/123",
              "type": ["VerifiableCredential", "OpenBadgeCredential"],
              "issuer": {
                "id": "https://demo.example.org/issuers/1",
                "type": "Profile",
                "name": "Demo Training Institute"
              },
              "validFrom": new Date().toISOString(),
              "name": "Excellence Badge",
              "credentialSubject": {
                "type": "AchievementSubject",
                "identifier": {
                  "type": "IdentityObject",
                  "hashed": false,
                  "identityType": "email",
                  "identity": "learner@test.example.com"
                },
                "achievement": {
                  "id": "https://demo.example.org/achievements/excellence",
                  "type": "Achievement",
                  "name": "Excellence Achievement"
                }
              }
            }
          };
          
          document.getElementById('json-content').value = JSON.stringify(templates[type], null, 2);
        }
        
        function clearEditor() {
          document.getElementById('json-content').value = '';
        }
        
        function validateJSON() {
          const content = document.getElementById('json-content').value;
          try {
            JSON.parse(content);
            alert('Valid JSON!');
          } catch (e) {
            alert('Invalid JSON: ' + e.message);
          }
        }
        
        function loadSmartExample() {
          const exampleV2 = \`{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://demo.example.org/issuer/1",
  "name": "Demo Tech Academy",
  "url": "https://demo.example.org",
  "email": "badges@demo.example.org"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://demo.example.org/badge/web-development",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development technologies",
  "image": "https://demo.example.org/badge-image.png",
  "criteria": "https://demo.example.org/criteria/web-dev",
  "issuer": "https://demo.example.org/issuer/1"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Assertion",
  "id": "https://demo.example.org/assertion/123",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "student@test.example.com"
  },
  "badge": "https://demo.example.org/badge/web-development",
  "issuedOn": "2024-01-15T10:00:00Z"
}\`;
          
          const exampleV3 = \`{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://demo.example.org/issuers/1",
  "type": "Profile",
  "name": "Demo Tech Academy",
  "url": "https://demo.example.org",
  "email": "badges@demo.example.org"
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://demo.example.org/achievements/web-development",
  "type": "Achievement",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development technologies",
  "achievementType": "Certificate",
  "criteria": {
    "narrative": "Complete comprehensive web development course with 80% score"
  }
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://demo.example.org/credentials/123",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": {
    "id": "https://demo.example.org/issuers/1",
    "type": "Profile",
    "name": "Demo Tech Academy"
  },
  "validFrom": "2024-01-15T10:00:00Z",
  "name": "Web Development Certificate",
  "credentialSubject": {
    "type": "AchievementSubject",
    "identifier": {
      "type": "IdentityObject",
      "hashed": false,
      "identityType": "email",
      "identity": "student@test.example.com"
    },
    "achievement": {
      "id": "https://demo.example.org/achievements/web-development",
      "type": "Achievement",
      "name": "Web Development Certificate"
    }
  }
}\`;
          
          // Ask user which version they want
          const version = prompt("Which version would you like to load?\\n\\n1. Open Badges v2.0 (classic)\\n2. Open Badges v3.0 (with Verifiable Credentials)\\n\\nEnter 1 or 2:");
          
          if (version === "2" || version === "3.0" || version === "v3") {
            document.getElementById('smart-content').value = exampleV3;
          } else {
            document.getElementById('smart-content').value = exampleV2;
          }
        }
        
        function validateSmartJSON() {
          const content = document.getElementById('smart-content').value;
          
          if (!content.trim()) {
            alert('Please paste some JSON content first.');
            return;
          }
          
          try {
            // Try to parse as individual JSON objects
            const objects = content.trim().split('\\n\\n').map(obj => obj.trim()).filter(obj => obj);
            
            if (objects.length === 0) {
              alert('No JSON objects found. Please separate multiple objects with blank lines.');
              return;
            }
            
            let issuer = null, badgeClass = null, assertion = null;
            let isV3 = false;
            
            objects.forEach((obj, index) => {
              try {
                const parsed = JSON.parse(obj);
                
                // Detect object types
                if (parsed.type === 'Issuer') issuer = parsed;
                else if (parsed.type === 'BadgeClass') badgeClass = parsed;
                else if (parsed.type === 'Assertion') assertion = parsed;
                else if (parsed.type === 'Profile') { issuer = parsed; isV3 = true; }
                else if (parsed.type === 'Achievement') { badgeClass = parsed; isV3 = true; }
                else if (Array.isArray(parsed.type) && parsed.type.includes('OpenBadgeCredential')) { assertion = parsed; isV3 = true; }
                
              } catch (e) {
                // Enhanced error message with position info
                let errorMsg = \`Object \${index + 1}: \${e.message}\`;
                
                const posMatch = e.message.match(/position (\\d+)/);
                if (posMatch) {
                  const pos = parseInt(posMatch[1]);
                  const char = obj[pos] || 'EOF';
                  const context = obj.substring(Math.max(0, pos - 10), pos + 11);
                  errorMsg += \`\\n\\nCharacter at position \${pos}: "\${char}"\\nContext: "\${context}"\`;
                  
                  // Show which line has the error
                  const lines = obj.substring(0, pos).split('\\n');
                  errorMsg += \`\\nLine \${lines.length} in object \${index + 1}\`;
                }
                
                throw new Error(errorMsg);
              }
            });
            
            // Check if we have all required objects
            const missing = [];
            if (!issuer) missing.push('Issuer/Profile');
            if (!badgeClass) missing.push('BadgeClass/Achievement');
            if (!assertion) missing.push('Assertion/OpenBadgeCredential');
            
            let message = \`✅ Valid JSON! Found \${objects.length} objects\\n\`;
            message += \`📋 Detected: \${isV3 ? 'Open Badges v3.0' : 'Open Badges v2.0'}\\n\\n\`;
            message += \`Objects found:\\n\`;
            if (issuer) message += \`• \${isV3 ? 'Profile' : 'Issuer'}: \${issuer.name || 'Unnamed'}\\n\`;
            if (badgeClass) message += \`• \${isV3 ? 'Achievement' : 'BadgeClass'}: \${badgeClass.name || 'Unnamed'}\\n\`;
            if (assertion) message += \`• \${isV3 ? 'OpenBadgeCredential' : 'Assertion'}: Found\\n\`;
            
            if (missing.length > 0) {
              message += \`\\n⚠️ Missing required objects: \${missing.join(', ')}\`;
              message += \`\\n\\nFor a complete badge system, you need all three objects.\`;
            } else {
              message += \`\\n🎉 Complete badge system ready to create!\`;
            }
            
            alert(message);
            
          } catch (e) {
            alert('❌ Invalid JSON:\\n\\n' + e.message + '\\n\\nPlease fix the JSON syntax and try again.');
          }
        }
        
        // Load and display uploaded files
        function loadFiles() {
          fetch('/api/files')
            .then(response => response.json())
            .then(files => {
              const fileList = document.getElementById('file-list');
              if (files.length === 0) {
                fileList.innerHTML = '<p>No files uploaded yet.</p>';
              } else {
                fileList.innerHTML = files.map(file => 
                  \`<div style="margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
                    <strong>\${file.name}</strong><br>
                    <a href="/badges/\${file.name}" target="_blank">View JSON</a> | 
                    <a href="/badges/\${file.name}" download>Download</a>
                    <br><small>URL: \${window.location.origin}/badges/\${file.name}</small>
                  </div>\`
                ).join('');
              }
            });
        }
        
        loadFiles();
      </script>
    </body>
    </html>
  `);
});

app.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }
  
  // Validate JSON
  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    JSON.parse(fileContent);
  } catch (error) {
    fs.unlinkSync(req.file.path); // Delete invalid file
    return res.status(400).send('Invalid JSON file');
  }
  
  res.redirect('/upload');
});

// Handle direct JSON creation
app.post('/create-json', requireAuth, (req, res) => {
  const { filename, content } = req.body;
  
  if (!filename || !content) {
    return res.status(400).send('Missing filename or content');
  }
  
  // Validate JSON
  try {
    JSON.parse(content);
  } catch (error) {
    return res.status(400).send('Invalid JSON: ' + error.message);
  }
  
  // Ensure filename ends with .json
  const jsonFilename = filename.endsWith('.json') ? filename : filename + '.json';
  const filepath = path.join('uploads', jsonFilename);
  
  // Write the JSON file
  ensureUploadsDir();
  fs.writeFileSync(filepath, content);
  
  res.redirect('/upload');
});

// Handle smart badge creation
app.post('/create-smart-badge', requireAuth, (req, res) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).send('Missing title or content');
  }
  
  try {
    // Smart JSON object parser - handles both separated and concatenated JSON
    function parseMultipleJSONObjects(content) {
      const trimmed = content.trim();
      
      // First try: split by blank lines (preferred format)
      let objects = trimmed.split('\n\n').map(obj => obj.trim()).filter(obj => obj);
      
      // If we only got one object but it looks like multiple concatenated JSONs, try smart parsing
      if (objects.length === 1 && (objects[0].includes('}{') || objects[0].includes('} {'))) {
        console.log('Detected concatenated JSON objects, attempting smart parsing...');
        objects = smartSplitJSON(objects[0]);
      }
      
      return objects;
    }
    
    // Smart JSON splitter for concatenated objects
    function smartSplitJSON(text) {
      const results = [];
      let current = '';
      let braceDepth = 0;
      let inString = false;
      let escapeNext = false;
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (escapeNext) {
          escapeNext = false;
          current += char;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          current += char;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
        }
        
        if (!inString) {
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
          }
        }
        
        current += char;
        
        // If we've closed a complete JSON object and we're not in a string
        if (braceDepth === 0 && current.trim() && !inString) {
          results.push(current.trim());
          current = '';
        }
      }
      
      // Add any remaining content
      if (current.trim()) {
        results.push(current.trim());
      }
      
      return results;
    }
    
    const objects = parseMultipleJSONObjects(content);
    
    if (objects.length === 0) {
      return res.status(400).send('No JSON objects found. Please paste valid JSON objects. Objects can be separated by blank lines or concatenated together.');
    }
    
    console.log(`Smart Badge Creator: Processing ${objects.length} JSON objects for title "${title}"`);
    
    const parsedObjects = [];
    objects.forEach((obj, index) => {
      try {
        const parsed = JSON.parse(obj);
        parsedObjects.push(parsed);
        console.log(`✅ Object ${index + 1} parsed: ${parsed.type || 'Unknown type'}`);
      } catch (parseError) {
        console.log(`❌ Error parsing object ${index + 1}: ${parseError.message}`);
        
        // Create detailed error message with context
        let errorMsg = `JSON parsing error in object ${index + 1}: ${parseError.message}`;
        
        // Try to find position information
        const posMatch = parseError.message.match(/position (\d+)/);
        if (posMatch) {
          const pos = parseInt(posMatch[1]);
          const char = obj[pos] || 'EOF';
          const context = obj.substring(Math.max(0, pos - 20), pos + 21);
          errorMsg += `\n\nCharacter at position ${pos}: "${char}"\nContext: "${context}"`;
          
          // Show line information
          const lines = obj.substring(0, pos).split('\n');
          const lineNum = lines.length;
          const charInLine = lines[lines.length - 1].length;
          errorMsg += `\nLine ${lineNum}, Character ${charInLine}`;
        }
        
        errorMsg += `\n\nObject ${index + 1} content preview:\n${obj.substring(0, 200)}${obj.length > 200 ? '...' : ''}`;
        
        throw new Error(errorMsg);
      }
    });
    
    // Identify object types (support both v2.0 and v3.0)
    let issuer = null, badgeClass = null, assertion = null;
    let isV3 = false;
    
    parsedObjects.forEach(obj => {
      // v2.0 types
      if (obj.type === 'Issuer') issuer = obj;
      else if (obj.type === 'BadgeClass') badgeClass = obj;
      else if (obj.type === 'Assertion') assertion = obj;
      // v3.0 types
      else if (obj.type === 'Profile') { issuer = obj; isV3 = true; }
      else if (obj.type === 'Achievement') { badgeClass = obj; isV3 = true; }
      else if (Array.isArray(obj.type) && obj.type.includes('OpenBadgeCredential')) { assertion = obj; isV3 = true; }
    });
    
    if (!issuer || !badgeClass || !assertion) {
      return res.status(400).send('Missing required objects. Please include Issuer/Profile, BadgeClass/Achievement, and Assertion/OpenBadgeCredential.');
    }
    
    // Generate new URLs based on the domain and title
    const baseUrl = `${req.protocol}://${req.get('host')}/badges`;
    const issuerUrl = `${baseUrl}/${title}-${isV3 ? 'profile' : 'issuer'}.json`;
    const badgeUrl = `${baseUrl}/${title}-${isV3 ? 'achievement' : 'badge'}.json`;
    const assertionUrl = `${baseUrl}/${title}-${isV3 ? 'credential' : 'assertion'}.json`;
    
    // Update IDs and references based on version
    if (isV3) {
      // v3.0 linking
      issuer.id = issuerUrl;
      badgeClass.id = badgeUrl;
      assertion.id = assertionUrl;
      
      // Update issuer reference in credential
      if (assertion.issuer) {
        assertion.issuer.id = issuerUrl;
      }
      
      // Update achievement reference in credential subject
      if (assertion.credentialSubject && assertion.credentialSubject.achievement) {
        assertion.credentialSubject.achievement.id = badgeUrl;
      }
    } else {
      // v2.0 linking
      issuer.id = issuerUrl;
      badgeClass.id = badgeUrl;
      badgeClass.issuer = issuerUrl;
      assertion.id = assertionUrl;
      assertion.badge = badgeUrl;
    }
    
    // Ensure uploads directory exists
    ensureUploadsDir();
    
    // Save all three files with appropriate names
    const issuerFilename = `${title}-${isV3 ? 'profile' : 'issuer'}.json`;
    const badgeFilename = `${title}-${isV3 ? 'achievement' : 'badge'}.json`;
    const assertionFilename = `${title}-${isV3 ? 'credential' : 'assertion'}.json`;
    
    fs.writeFileSync(path.join('uploads', issuerFilename), JSON.stringify(issuer, null, 2));
    fs.writeFileSync(path.join('uploads', badgeFilename), JSON.stringify(badgeClass, null, 2));
    fs.writeFileSync(path.join('uploads', assertionFilename), JSON.stringify(assertion, null, 2));
    
    res.redirect('/upload');
  } catch (error) {
    return res.status(400).send('Error processing badge: ' + error.message);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// API endpoint to list uploaded files (web session auth)
app.get('/api/files', requireAuth, (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }
    
    const fileList = files
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        url: `/badges/${file}`
      }));
    
    res.json(fileList);
  });
});

// API endpoint to list uploaded files (API key auth)
app.get('/api/badge-files', requireApiKey, (req, res) => {
  fs.readdir('uploads', (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read files' });
    }
    
    const fileList = files
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        url: `/badges/${file}`,
        fullUrl: `${req.protocol}://${req.get('host')}/badges/${file}`
      }));
    
    res.json(fileList);
  });
});

// Domain validation endpoint
app.get('/api/validate-issuer-domain', requireApiKey, async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  const validation = await validateIssuerDomain(url);
  res.json(validation);
});

// Issuer verification endpoints
app.post('/api/issuers/verify', requireApiKey, async (req, res) => {
  const { domain } = req.body;
  
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  
  // Basic domain validation
  try {
    new URL(`https://${domain}`);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid domain format' });
  }
  
  const result = await verifyIssuerDomain(domain);
  
  if (result.success) {
    res.json({
      message: result.message,
      issuer: result.issuer,
      status: 'verified'
    });
  } else {
    res.status(400).json({
      error: result.error,
      details: result.details,
      status: 'failed'
    });
  }
});

// Get verified issuer info
app.get('/api/issuers/:domain', requireApiKey, async (req, res) => {
  const { domain } = req.params;
  const issuer = getVerifiedIssuer(domain);
  
  if (!issuer) {
    return res.status(404).json({ 
      error: 'Issuer not found or not verified',
      domain: domain
    });
  }
  
  res.json({
    issuer: issuer,
    status: issuer.status
  });
});

// List all verified issuers
app.get('/api/issuers', requireApiKey, async (req, res) => {
  const issuers = loadVerifiedIssuers();
  const issuerList = Object.values(issuers).map(issuer => ({
    domain: issuer.domain,
    displayName: issuer.displayName,
    status: issuer.status,
    lastVerified: issuer.lastVerified,
    type: issuer.type
  }));
  
  res.json({
    issuers: issuerList,
    count: issuerList.length
  });
});

// Re-verify an existing issuer
app.post('/api/issuers/:domain/reverify', requireApiKey, async (req, res) => {
  const { domain } = req.params;
  
  const result = await verifyIssuerDomain(domain);
  
  if (result.success) {
    res.json({
      message: `Successfully re-verified issuer: ${result.issuer.displayName}`,
      issuer: result.issuer,
      status: 'verified'
    });
  } else {
    // Mark as failed but keep the record
    const existingIssuer = getVerifiedIssuer(domain);
    if (existingIssuer) {
      const failedIssuer = {
        ...existingIssuer,
        status: 'failed',
        lastVerificationAttempt: new Date().toISOString(),
        lastError: result.error
      };
      setVerifiedIssuer(domain, failedIssuer);
    }
    
    res.status(400).json({
      error: result.error,
      details: result.details,
      status: 'failed'
    });
  }
});

// API endpoints for creating issuers and badge classes
app.post('/api/issuer', requireApiKey, async (req, res) => {
  const { id, name, url, email, description, image } = req.body;
  
  if (!id || !name || !url) {
    return res.status(400).json({ error: 'Missing required fields: id, name, url' });
  }
  
  // Validate the issuer domain
  const domainValidation = await validateIssuerDomain(id);
  if (!domainValidation.valid) {
    return res.status(400).json({ 
      error: domainValidation.message,
      domain_validation: domainValidation
    });
  }
  
  const issuer = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "Issuer",
    "id": id,
    "name": name,
    "url": url,
    "email": email,
    "description": description,
    "image": image
  };
  
  // Remove undefined fields
  Object.keys(issuer).forEach(key => issuer[key] === undefined && delete issuer[key]);
  
  const filename = `issuer-${Date.now()}.json`;
  const filepath = path.join('uploads', filename);
  
  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(issuer, null, 2));
  
  res.json({
    message: 'Issuer created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    issuer: issuer,
    warnings: domainValidation.warnings,
    domain_info: {
      type: domainValidation.type,
      message: domainValidation.message,
      is_production_ready: domainValidation.type === 'verified'
    }
  });
});

app.post('/api/badge-class', requireApiKey, async (req, res) => {
  const { id, name, description, image, criteria, issuer, tags } = req.body;
  
  if (!id || !name || !description || !criteria || !issuer) {
    return res.status(400).json({ error: 'Missing required fields: id, name, description, criteria, issuer' });
  }
  
  // Validate both the badge class ID and issuer domains
  const badgeValidation = await validateIssuerDomain(id);
  const issuerValidation = await validateIssuerDomain(issuer);
  
  if (!badgeValidation.valid) {
    return res.status(400).json({ 
      error: `Badge class domain validation failed: ${badgeValidation.message}`,
      domain_validation: badgeValidation
    });
  }
  
  if (!issuerValidation.valid) {
    return res.status(400).json({ 
      error: `Issuer domain validation failed: ${issuerValidation.message}`,
      domain_validation: issuerValidation
    });
  }
  
  const badgeClass = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "BadgeClass",
    "id": id,
    "name": name,
    "description": description,
    "image": image,
    "criteria": criteria,
    "issuer": issuer,
    "tags": tags
  };
  
  // Remove undefined fields
  Object.keys(badgeClass).forEach(key => badgeClass[key] === undefined && delete badgeClass[key]);
  
  const filename = `badge-class-${Date.now()}.json`;
  const filepath = path.join('uploads', filename);
  
  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(badgeClass, null, 2));
  
  const allWarnings = [...badgeValidation.warnings, ...issuerValidation.warnings];
  
  res.json({
    message: 'Badge class created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    badgeClass: badgeClass,
    warnings: allWarnings,
    domain_info: {
      badge_domain: {
        type: badgeValidation.type,
        message: badgeValidation.message
      },
      issuer_domain: {
        type: issuerValidation.type,
        message: issuerValidation.message
      },
      is_production_ready: badgeValidation.type === 'verified' && issuerValidation.type === 'verified'
    }
  });
});

// API endpoint to create credential subject (badge assertion)
app.post('/api/credential-subject', requireApiKey, async (req, res) => {
  const { id, recipient, badge, issuedOn, expires, evidence } = req.body;
  
  if (!id || !recipient || !badge) {
    return res.status(400).json({ error: 'Missing required fields: id, recipient, badge' });
  }
  
  // Validate credential and badge domains
  const credentialValidation = await validateIssuerDomain(id);
  const badgeValidation = await validateIssuerDomain(badge);
  
  if (!credentialValidation.valid) {
    return res.status(400).json({ 
      error: `Credential domain validation failed: ${credentialValidation.message}`,
      domain_validation: credentialValidation
    });
  }
  
  if (!badgeValidation.valid) {
    return res.status(400).json({ 
      error: `Badge domain validation failed: ${badgeValidation.message}`,
      domain_validation: badgeValidation
    });
  }
  
  const credentialSubject = {
    "@context": "https://w3id.org/openbadges/v2",
    "type": "Assertion",
    "id": id,
    "recipient": recipient,
    "badge": badge,
    "issuedOn": issuedOn || new Date().toISOString(),
    "expires": expires,
    "evidence": evidence
  };
  
  // Remove undefined fields
  Object.keys(credentialSubject).forEach(key => credentialSubject[key] === undefined && delete credentialSubject[key]);
  
  const filename = `credential-${Date.now()}.json`;
  const filepath = path.join('uploads', filename);
  
  ensureUploadsDir();
  fs.writeFileSync(filepath, JSON.stringify(credentialSubject, null, 2));
  
  const allWarnings = [...credentialValidation.warnings, ...badgeValidation.warnings];
  
  res.json({
    message: 'Credential subject created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    credentialSubject: credentialSubject,
    warnings: allWarnings,
    domain_info: {
      credential_domain: {
        type: credentialValidation.type,
        message: credentialValidation.message
      },
      badge_domain: {
        type: badgeValidation.type,
        message: badgeValidation.message
      },
      is_production_ready: credentialValidation.type === 'verified' && badgeValidation.type === 'verified'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Badge Generator server running on port ${PORT}`);
  console.log(`Upload page: http://localhost:${PORT}/upload`);
  console.log(`Upload password: ${process.env.UPLOAD_PASSWORD}`);
  console.log(`API key: ${process.env.API_KEY}`);
});