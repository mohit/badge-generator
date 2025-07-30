const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Helper function to ensure uploads directory exists
function ensureUploadsDir() {
  if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
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
              "id": "https://example.com/issuer/1",
              "name": "Example Organization",
              "url": "https://example.com",
              "email": "contact@example.com",
              "description": "An example organization that issues badges",
              "image": "https://example.com/logo.png"
            },
            'badge-class': {
              "@context": "https://w3id.org/openbadges/v2",
              "type": "BadgeClass",
              "id": "https://example.com/badge/excellence",
              "name": "Excellence Badge",
              "description": "Awarded for demonstrating excellence",
              "image": "https://example.com/badge.png",
              "criteria": "https://example.com/criteria/excellence",
              "issuer": "https://example.com/issuer/1",
              "tags": ["excellence", "achievement"]
            },
            'assertion': {
              "@context": "https://w3id.org/openbadges/v2",
              "type": "Assertion",
              "id": "https://example.com/assertion/123",
              "recipient": {
                "type": "email",
                "hashed": false,
                "identity": "recipient@example.com"
              },
              "badge": "https://example.com/badge/excellence",
              "issuedOn": new Date().toISOString(),
              "evidence": "https://example.com/evidence/123"
            },
            'issuer-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://example.com/issuers/1",
              "type": "Profile",
              "name": "Example Organization",
              "url": "https://example.com",
              "email": "contact@example.com",
              "description": "An example organization that issues badges"
            },
            'achievement-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://example.com/achievements/excellence",
              "type": "Achievement",
              "name": "Excellence Achievement",
              "description": "Awarded for demonstrating excellence in learning",
              "achievementType": "Certificate",
              "criteria": {
                "narrative": "Demonstrates mastery of core competencies"
              },
              "image": {
                "id": "https://example.com/badge.png",
                "type": "Image"
              }
            },
            'credential-v3': {
              "@context": [
                "https://www.w3.org/ns/credentials/v2",
                "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
              ],
              "id": "https://example.com/credentials/123",
              "type": ["VerifiableCredential", "OpenBadgeCredential"],
              "issuer": {
                "id": "https://example.com/issuers/1",
                "type": "Profile",
                "name": "Example Organization"
              },
              "validFrom": new Date().toISOString(),
              "name": "Excellence Badge",
              "credentialSubject": {
                "type": "AchievementSubject",
                "identifier": {
                  "type": "IdentityObject",
                  "hashed": false,
                  "identityType": "email",
                  "identity": "recipient@example.com"
                },
                "achievement": {
                  "id": "https://example.com/achievements/excellence",
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
  "id": "https://example.com/issuer/1",
  "name": "Example University",
  "url": "https://example.com",
  "email": "badges@example.com"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://example.com/badge/web-development",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development",
  "image": "https://example.com/badge-image.png",
  "criteria": "https://example.com/criteria/web-dev",
  "issuer": "https://example.com/issuer/1"
}

{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Assertion",
  "id": "https://example.com/assertion/123",
  "recipient": {
    "type": "email",
    "hashed": false,
    "identity": "student@example.com"
  },
  "badge": "https://example.com/badge/web-development",
  "issuedOn": "\${new Date().toISOString()}"
}\`;
          
          const exampleV3 = \`{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/issuers/1",
  "type": "Profile",
  "name": "Example University",
  "url": "https://example.com",
  "email": "badges@example.com"
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/achievements/web-development",
  "type": "Achievement",
  "name": "Web Development Certificate",
  "description": "Demonstrates proficiency in modern web development",
  "achievementType": "Certificate",
  "criteria": {
    "narrative": "Complete web development course with 80% score"
  }
}

{
  "@context": [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"
  ],
  "id": "https://example.com/credentials/123",
  "type": ["VerifiableCredential", "OpenBadgeCredential"],
  "issuer": {
    "id": "https://example.com/issuers/1",
    "type": "Profile",
    "name": "Example University"
  },
  "validFrom": "\${new Date().toISOString()}",
  "name": "Web Development Certificate",
  "credentialSubject": {
    "type": "AchievementSubject",
    "identifier": {
      "type": "IdentityObject",
      "hashed": false,
      "identityType": "email",
      "identity": "student@example.com"
    },
    "achievement": {
      "id": "https://example.com/achievements/web-development",
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
          try {
            // Try to parse as individual JSON objects
            const objects = content.trim().split('\\n\\n').map(obj => obj.trim()).filter(obj => obj);
            objects.forEach((obj, index) => {
              try {
                JSON.parse(obj);
              } catch (e) {
                throw new Error(\`Object \${index + 1}: \${e.message}\`);
              }
            });
            alert(\`Valid! Found \${objects.length} JSON objects.\`);
          } catch (e) {
            alert('Invalid JSON: ' + e.message);
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
    // Parse multiple JSON objects
    const objects = content.trim().split('\n\n').map(obj => obj.trim()).filter(obj => obj);
    const parsedObjects = objects.map(obj => JSON.parse(obj));
    
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

// API endpoint to list uploaded files
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

// API endpoints for creating issuers and badge classes
app.post('/api/issuer', requireApiKey, (req, res) => {
  const { id, name, url, email, description, image } = req.body;
  
  if (!id || !name || !url) {
    return res.status(400).json({ error: 'Missing required fields: id, name, url' });
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
    issuer: issuer
  });
});

app.post('/api/badge-class', requireApiKey, (req, res) => {
  const { id, name, description, image, criteria, issuer, tags } = req.body;
  
  if (!id || !name || !description || !criteria || !issuer) {
    return res.status(400).json({ error: 'Missing required fields: id, name, description, criteria, issuer' });
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
  
  res.json({
    message: 'Badge class created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    badgeClass: badgeClass
  });
});

// API endpoint to create credential subject (badge assertion)
app.post('/api/credential-subject', requireApiKey, (req, res) => {
  const { id, recipient, badge, issuedOn, expires, evidence } = req.body;
  
  if (!id || !recipient || !badge) {
    return res.status(400).json({ error: 'Missing required fields: id, recipient, badge' });
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
  
  res.json({
    message: 'Credential subject created successfully',
    filename: filename,
    url: `${req.protocol}://${req.get('host')}/badges/${filename}`,
    credentialSubject: credentialSubject
  });
});

app.listen(PORT, () => {
  console.log(`Badge Generator server running on port ${PORT}`);
  console.log(`Upload page: http://localhost:${PORT}/upload`);
  console.log(`Upload password: ${process.env.UPLOAD_PASSWORD}`);
  console.log(`API key: ${process.env.API_KEY}`);
});