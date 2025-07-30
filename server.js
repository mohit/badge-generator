const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

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
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input[type="file"], input[type="text"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #28a745; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #218838; }
        .logout { float: right; background: #dc3545; }
        .logout:hover { background: #c82333; }
        .success { color: green; margin-top: 10px; }
        .error { color: red; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Upload Badge JSON Files</h2>
        <a href="/logout"><button class="logout">Logout</button></a>
      </div>
      
      <form method="POST" action="/upload" enctype="multipart/form-data">
        <div class="form-group">
          <label for="filename">Custom Filename (optional):</label>
          <input type="text" id="filename" name="filename" placeholder="badge.json">
        </div>
        <div class="form-group">
          <label for="file">JSON File:</label>
          <input type="file" id="file" name="file" accept=".json,application/json" required>
        </div>
        <button type="submit">Upload</button>
      </form>
      
      <h3>Uploaded Files</h3>
      <div id="file-list"></div>
      
      <script>
        // Load and display uploaded files
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
        url: \`/badges/\${file}\`
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
  
  const filename = \`issuer-\${Date.now()}.json\`;
  const filepath = path.join('uploads', filename);
  
  fs.writeFileSync(filepath, JSON.stringify(issuer, null, 2));
  
  res.json({
    message: 'Issuer created successfully',
    filename: filename,
    url: \`\${req.protocol}://\${req.get('host')}/badges/\${filename}\`,
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
  
  const filename = \`badge-class-\${Date.now()}.json\`;
  const filepath = path.join('uploads', filename);
  
  fs.writeFileSync(filepath, JSON.stringify(badgeClass, null, 2));
  
  res.json({
    message: 'Badge class created successfully',
    filename: filename,
    url: \`\${req.protocol}://\${req.get('host')}/badges/\${filename}\`,
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
  
  const filename = \`credential-\${Date.now()}.json\`;
  const filepath = path.join('uploads', filename);
  
  fs.writeFileSync(filepath, JSON.stringify(credentialSubject, null, 2));
  
  res.json({
    message: 'Credential subject created successfully',
    filename: filename,
    url: \`\${req.protocol}://\${req.get('host')}/badges/\${filename}\`,
    credentialSubject: credentialSubject
  });
});

app.listen(PORT, () => {
  console.log(\`Badge Generator server running on port \${PORT}\`);
  console.log(\`Upload page: http://localhost:\${PORT}/upload\`);
  console.log(\`Upload password: \${process.env.UPLOAD_PASSWORD}\`);
  console.log(\`API key: \${process.env.API_KEY}\`);
});