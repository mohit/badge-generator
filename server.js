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
            <button type="button" class="template-btn" onclick="loadTemplate('issuer')">Issuer Template</button>
            <button type="button" class="template-btn" onclick="loadTemplate('badge-class')">Badge Class Template</button>
            <button type="button" class="template-btn" onclick="loadTemplate('assertion')">Assertion Template</button>
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