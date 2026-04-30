// ========== EMAILJS CONFIGURATION ==========
const EMAILJS_PUBLIC_KEY = "0ES007IZBpdCZsW6d";
const EMAILJS_SERVICE_ID = "service_0nxc2qy";
const EMAILJS_TEMPLATE_ID = "template_0y9wskc";

emailjs.init(EMAILJS_PUBLIC_KEY);

// ========== DATABASE ==========
let currentUser = null;
let currentRole = null;
let auditLogs = [];
let offlineQueue = [];
let scannerActive = false;
let barcodeDetector = null;
let pendingAlerts = [];
let pendingReset = { username: null, email: null, pin: null, userType: null };

const assetIcons = { 'LAPTOP': '💻', 'FRIDGE': '🧊', 'MICROWAVE': '🍿', 'OTHER': '🔧' };

// ========== USERS ==========
let users = {
    guards: [
        { id: 'G001', name: 'John Doe', password: '1234', role: 'guard', gate: 'GATE_1', email: 'your_email@gmail.com' },
        { id: 'G002', name: 'Jane Smith', password: '1234', role: 'guard', gate: 'GATE_2', email: 'your_email@gmail.com' }
    ],
    admins: [
        { id: 'A001', name: 'Admin User', password: '1234', role: 'admin', email: 'bohlaleramoloto@gmail.com' }
    ],
    students: [
        { id: 'S001', student_number: 202394726, name: 'CN MALULEKE', password: '1234', accessibility: 'NONE', is_active: true, email: 'your_email@gmail.com' },
        { id: 'S002', student_number: 202393020, name: 'BZ TWALA', password: '1234', accessibility: 'VISUAL_IMPAIRMENT', is_active: true, email: 'your_email@gmail.com' },
        { id: 'S003', student_number: 240015914, name: 'TM SEKGOBELA', password: '1234', accessibility: 'NONE', is_active: true, email: 'your_email@gmail.com' },
        { id: 'S004', student_number: 202247479, name: 'C SETE', password: '1234', accessibility: 'NONE', is_active: true, email: 'your_email@gmail.com' },
        { id: 'S005', student_number: 240000760, name: 'CB RAMOLOTO', password: '1234', accessibility: 'NONE', is_active: true, email: 'your_email@gmail.com' }
    ]
};

// ========== ASSETS ==========
let assets = [
    { id: 'AST001', barcode_id: 'BAR001', asset_type: 'LAPTOP', serial_number: 'SN001', student_id: 'S001', student_name: 'CN MALULEKE', is_active: true },
    { id: 'AST002', barcode_id: 'BAR002', asset_type: 'FRIDGE', serial_number: 'SN002', student_id: 'S002', student_name: 'BZ TWALA', is_active: true },
    { id: 'AST003', barcode_id: 'BAR003', asset_type: 'MICROWAVE', serial_number: 'SN003', student_id: 'S003', student_name: 'TM SEKGOBELA', is_active: true },
    { id: 'AST004', barcode_id: 'BAR004', asset_type: 'LAPTOP', serial_number: 'SN004', student_id: 'S004', student_name: 'C SETE', is_active: true },
    { id: 'AST005', barcode_id: 'BAR005', asset_type: 'OTHER', serial_number: 'SN005', student_id: 'S005', student_name: 'CB RAMOLOTO', is_active: true }
];

let selectedRole = 'guard';

// ========== VOICE GUIDANCE (Only for Visually Impaired) ==========
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }
}

// ========== REAL BARCODE SCANNER ==========
async function startCamera() {
    if (scannerActive) return;
    
    try {
        if ('BarcodeDetector' in window) {
            barcodeDetector = new BarcodeDetector({ 
                formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'codabar', 'code_39', 'code_93'] 
            });
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const video = document.getElementById('video');
        video.srcObject = stream;
        await video.play();
        scannerActive = true;
        document.getElementById('scanStatus').innerHTML = '📷 Camera active - scanning for barcodes...';
        startBarcodeDetection();
    } catch (err) {
        document.getElementById('scanStatus').innerHTML = '⚠️ Camera access failed. Use manual entry.';
        alert('Camera access denied. Please use manual barcode entry.');
    }
}

async function startBarcodeDetection() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const context = canvas.getContext('2d');
    
    async function detectFrame() {
        if (!scannerActive || !video.videoWidth) {
            if (scannerActive) requestAnimationFrame(detectFrame);
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        if (barcodeDetector) {
            try {
                const barcodes = await barcodeDetector.detect(canvas);
                if (barcodes.length > 0 && scannerActive) {
                    const code = barcodes[0].rawValue;
                    document.getElementById('scanStatus').innerHTML = `✅ Barcode detected: ${code}`;
                    stopCamera();
                    processScan(code);
                    return;
                }
            } catch (e) {}
        }
        
        if (scannerActive) requestAnimationFrame(detectFrame);
    }
    
    requestAnimationFrame(detectFrame);
}

function stopCamera() {
    if (scannerActive) {
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        scannerActive = false;
        barcodeDetector = null;
    }
}

// ========== PROCESS SCAN ==========
async function processScan(barcodeId) {
    stopCamera();
    
    if (!navigator.onLine) {
        offlineQueue.push({ id: Date.now(), barcode_id: barcodeId, timestamp: new Date().toISOString() });
        saveOfflineQueue();
        updateOfflineBanner();
        showResult({ decision: 'OFFLINE', subtext: 'Scan Saved', message: 'No network. Will sync when online.', colour: 'amber' });
        return;
    }
    
    const asset = assets.find(a => a.barcode_id === barcodeId);
    let decision, colour, message, studentInfo = null;
    
    if (!asset) {
        decision = 'DENIED';
        colour = 'red';
        message = 'Asset not registered in system';
    } else if (!asset.is_active) {
        decision = 'DENIED';
        colour = 'red';
        message = 'Asset is deactivated';
    } else {
        const student = users.students.find(s => s.id === asset.student_id && s.is_active);
        if (student) {
            decision = 'AUTHORISED';
            colour = 'green';
            message = `Exit Authorised for ${student.name}`;
            studentInfo = { ...asset, student_name: student.name, student_number: student.student_number };
            
            // Voice guidance ONLY for visually impaired students
            if (student.accessibility === 'VISUAL_IMPAIRMENT') {
                speakText(`Authorised. ${student.name}, your ${asset.asset_type} has been verified. Exit permitted.`);
            }
        } else {
            decision = 'FLAGGED';
            colour = 'amber';
            message = 'Asset ownership mismatch. Admin verification required.';
            studentInfo = asset;
            
            const alert = {
                id: Date.now(),
                scanId: Date.now(),
                barcode_id: barcodeId,
                student_id: asset.student_id,
                student_name: asset.student_name,
                asset_type: asset.asset_type,
                guard_id: currentUser?.id,
                guard_name: currentUser?.name,
                timestamp: new Date().toISOString(),
                status: 'pending'
            };
            pendingAlerts.push(alert);
            savePendingAlerts();
            updateAlertBadge();
        }
    }
    
    const student = studentInfo ? users.students.find(s => s.id === studentInfo.student_id) : null;
    
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        guard_id: currentUser?.id,
        student_id: student?.id,
        student_name: student?.name,
        barcode_id_scanned: barcodeId,
        decision: decision,
        gate_id: currentUser?.gate || 'GATE_1',
        asset_type: asset?.asset_type
    };
    auditLogs.unshift(logEntry);
    saveAuditLogs();
    
    if (currentRole === 'guard') {
        updateGuardStats();
        renderGuardRecentScans();
    }
    if (currentRole === 'admin') updateAdminStats();
    
    showResult({ decision, subtext: decision === 'AUTHORISED' ? 'Exit Permitted' : (decision === 'FLAGGED' ? 'Pending Admin Approval' : 'Do Not Allow Exit'), message, colour, studentInfo, barcode: barcodeId, assetType: asset?.asset_type });
}

// ========== ADMIN APPROVE/DENY ==========
function approveAlert(alertId) {
    const alert = pendingAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    auditLogs.unshift({
        id: alert.scanId,
        timestamp: alert.timestamp,
        guard_id: alert.guard_id,
        student_id: alert.student_id,
        student_name: alert.student_name,
        barcode_id_scanned: alert.barcode_id,
        decision: 'AUTHORISED',
        gate_id: 'GATE_1',
        asset_type: alert.asset_type,
        was_approved: true
    });
    
    pendingAlerts = pendingAlerts.filter(a => a.id !== alertId);
    savePendingAlerts();
    saveAuditLogs();
    updateAlertBadge();
    renderPendingAlerts();
    updateAdminStats();
    alert(`✅ Exit approved for ${alert.student_name}`);
}

function denyAlert(alertId) {
    const alert = pendingAlerts.find(a => a.id === alertId);
    if (!alert) return;
    
    auditLogs.unshift({
        id: alert.scanId,
        timestamp: alert.timestamp,
        guard_id: alert.guard_id,
        student_id: alert.student_id,
        student_name: alert.student_name,
        barcode_id_scanned: alert.barcode_id,
        decision: 'DENIED',
        gate_id: 'GATE_1',
        asset_type: alert.asset_type,
        was_denied: true
    });
    
    pendingAlerts = pendingAlerts.filter(a => a.id !== alertId);
    savePendingAlerts();
    saveAuditLogs();
    updateAlertBadge();
    renderPendingAlerts();
    updateAdminStats();
    alert(`❌ Exit denied for ${alert.student_name}`);
}

function renderPendingAlerts() {
    const container = document.getElementById('pendingAlertsList');
    if (!container) return;
    
    if (pendingAlerts.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8">No pending verification requests</div>';
        return;
    }
    
    container.innerHTML = pendingAlerts.map(alert => `
        <div class="alert-item">
            <div><strong>${alert.student_name}</strong></div>
            <div>Barcode: ${alert.barcode_id} (${alert.asset_type})</div>
            <div>Guard: ${alert.guard_name || alert.guard_id}</div>
            <div>${new Date(alert.timestamp).toLocaleString()}</div>
            <div class="alert-actions">
                <button class="approve-btn" onclick="approveAlert(${alert.id})">✅ Approve Exit</button>
                <button class="deny-btn" onclick="denyAlert(${alert.id})">❌ Deny Exit</button>
            </div>
        </div>
    `).join('');
}

function updateAlertBadge() {
    const badge = document.getElementById('alertBadge');
    const countSpan = document.getElementById('alertCount');
    if (badge && countSpan) {
        if (pendingAlerts.length > 0) {
            badge.style.display = 'flex';
            countSpan.textContent = pendingAlerts.length;
        } else {
            badge.style.display = 'none';
        }
    }
}

// ========== LOGIN ==========
function selectRole(role) {
    selectedRole = role;
    document.getElementById('roleGuardBtn').classList.toggle('active', role === 'guard');
    document.getElementById('roleAdminBtn').classList.toggle('active', role === 'admin');
    const label = document.getElementById('usernameLabel');
    if (role === 'guard') {
        label.textContent = 'Badge Number';
        document.getElementById('username').placeholder = 'Enter your badge number';
    } else {
        label.textContent = 'Admin Username';
        document.getElementById('username').placeholder = 'Enter admin username';
    }
}

function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.style.display = 'none';
    
    if (selectedRole === 'guard') {
        const guard = users.guards.find(g => g.id === username && g.password === password);
        if (guard) {
            currentUser = guard;
            currentRole = 'guard';
            document.getElementById('guardNameDisplay').textContent = guard.name;
            document.getElementById('gateDisplay').textContent = guard.gate;
            loadGuardDashboard();
            showScreen('guardScreen');
            updateGuardStats();
            renderGuardRecentScans();
        } else {
            errorDiv.textContent = 'Invalid badge number or password';
            errorDiv.style.display = 'block';
        }
    } else if (selectedRole === 'admin') {
        const admin = users.admins.find(a => a.id === username && a.password === password);
        if (admin) {
            currentUser = admin;
            currentRole = 'admin';
            document.getElementById('adminNameDisplay').textContent = admin.name;
            loadAdminDashboard();
            showScreen('adminScreen');
        } else {
            errorDiv.textContent = 'Invalid username or password';
            errorDiv.style.display = 'block';
        }
    }
}

// ========== FORGOT PASSWORD (Sends Email - No display on screen) ==========
function showForgotPassword() {
    document.getElementById('step1Container').style.display = 'block';
    document.getElementById('step2Container').style.display = 'none';
    document.getElementById('step3Container').style.display = 'none';
    document.getElementById('resetError').style.display = 'none';
    document.getElementById('resetSuccess').style.display = 'none';
    showScreen('forgotPasswordScreen');
}

async function sendResetPin() {
    const email = document.getElementById('resetEmail').value.trim();
    const username = document.getElementById('resetUsername').value.trim();
    const errorDiv = document.getElementById('resetError');
    const successDiv = document.getElementById('resetSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    let foundUser = null;
    let userType = null;
    
    let user = users.guards.find(g => g.id === username && g.email === email);
    if (user) { foundUser = user; userType = 'guard'; }
    if (!foundUser) {
        user = users.admins.find(a => a.id === username && a.email === email);
        if (user) { foundUser = user; userType = 'admin'; }
    }
    if (!foundUser) {
        user = users.students.find(s => (s.id === username || s.student_number.toString() === username) && s.email === email);
        if (user) { foundUser = user; userType = 'student'; }
    }
    
    if (!foundUser) {
        errorDiv.textContent = 'No account found with these credentials';
        errorDiv.style.display = 'block';
        return;
    }
    
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    pendingReset = { username: username, email: email, pin: pin, userType: userType };
    
    try {
        const templateParams = {
            to_email: email,
            to_name: foundUser.name,
            passcode: pin,
            time: new Date().toLocaleTimeString()
        };
        
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        successDiv.innerHTML = `✓ Verification PIN sent to ${email}. Please check your inbox.`;
        successDiv.style.display = 'block';
        
        document.getElementById('step1Container').style.display = 'none';
        document.getElementById('step2Container').style.display = 'block';
        document.getElementById('resetPin').value = '';
    } catch (err) {
        console.error('Email error:', err);
        errorDiv.innerHTML = 'Failed to send email. Please check your EmailJS setup.';
        errorDiv.style.display = 'block';
    }
}

function verifyPin() {
    const enteredPin = document.getElementById('resetPin').value;
    const errorDiv = document.getElementById('resetError');
    
    if (enteredPin === pendingReset.pin) {
        document.getElementById('step2Container').style.display = 'none';
        document.getElementById('step3Container').style.display = 'block';
    } else {
        errorDiv.textContent = 'Invalid PIN. Please try again.';
        errorDiv.style.display = 'block';
    }
}

function updatePassword() {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const errorDiv = document.getElementById('resetError');
    const successDiv = document.getElementById('resetSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (newPass !== confirmPass) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        return;
    }
    
    if (newPass.length < 4) {
        errorDiv.textContent = 'Password must be at least 4 characters';
        errorDiv.style.display = 'block';
        return;
    }
    
    let found = false;
    if (pendingReset.userType === 'guard') {
        const idx = users.guards.findIndex(g => g.id === pendingReset.username);
        if (idx !== -1) { users.guards[idx].password = newPass; found = true; }
    } else if (pendingReset.userType === 'admin') {
        const idx = users.admins.findIndex(a => a.id === pendingReset.username);
        if (idx !== -1) { users.admins[idx].password = newPass; found = true; }
    } else if (pendingReset.userType === 'student') {
        const idx = users.students.findIndex(s => s.id === pendingReset.username || s.student_number.toString() === pendingReset.username);
        if (idx !== -1) { users.students[idx].password = newPass; found = true; }
    }
    
    if (found) {
        successDiv.textContent = 'Password updated successfully! Please login.';
        successDiv.style.display = 'block';
        pendingReset = {};
        setTimeout(() => backToLogin(), 2000);
    }
}

function backToLogin() {
    showScreen('loginScreen');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function handleLogout() {
    stopCamera();
    currentUser = null;
    currentRole = null;
    showScreen('loginScreen');
}

// ========== ADMIN FUNCTIONS ==========
function loadAdminDashboard() {
    updateAdminStats();
    renderStudentsTable();
    renderAssetsTable();
    renderGuardsTable();
    renderAdminLogsTable();
    renderGuardReports();
    renderPendingAlerts();
    populateStudentDropdown();
    updateAlertBadge();
}

function updateAdminStats() {
    document.getElementById('adminTotalStudents').textContent = users.students.filter(s => s.is_active !== false).length;
    document.getElementById('adminTotalAssets').textContent = assets.filter(a => a.is_active !== false).length;
    document.getElementById('adminTotalScans').textContent = auditLogs.length;
    document.getElementById('adminFlaggedScans').textContent = auditLogs.filter(l => l.decision === 'FLAGGED').length;
    
    const recent = auditLogs.slice(0, 10);
    const container = document.getElementById('adminRecentActivity');
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No recent activity</div>';
    } else {
        container.innerHTML = recent.map(log => `
            <div class="table-row">
                <span>${new Date(log.timestamp).toLocaleString()}</span>
                <span>${log.student_name || 'Unknown'}</span>
                <span class="history-chip chip-${log.decision.toLowerCase()}">${log.decision}</span>
            </div>
        `).join('');
    }
}

function showAdminTab(tab) {
    const tabs = ['dashboard', 'students', 'assets', 'alerts', 'scans', 'guards', 'logs'];
    tabs.forEach(t => {
        const tabEl = document.getElementById(`admin${t.charAt(0).toUpperCase() + t.slice(1)}Tab`);
        const btnEl = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (tabEl) tabEl.classList.remove('active');
        if (btnEl) btnEl.classList.remove('active');
    });
    document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.add('active');
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    
    if (tab === 'students') renderStudentsTable();
    if (tab === 'assets') renderAssetsTable();
    if (tab === 'guards') renderGuardsTable();
    if (tab === 'logs') renderAdminLogsTable();
    if (tab === 'scans') renderGuardReports();
    if (tab === 'alerts') renderPendingAlerts();
}

function registerStudent() {
    const studentNumber = document.getElementById('newStudentNumber').value;
    const name = document.getElementById('newStudentName').value;
    const email = document.getElementById('newStudentEmail').value;
    const password = document.getElementById('newStudentPassword').value;
    const accessibility = document.getElementById('newAccessibility').value;
    
    if (!studentNumber || !name || !email || !password) {
        document.getElementById('studentRegMessage').innerHTML = '<span style="color:red">Fill all fields</span>';
        return;
    }
    
    const newStudent = {
        id: 'S' + String(users.students.length + 1).padStart(3, '0'),
        student_number: parseInt(studentNumber),
        name: name.toUpperCase(),
        password: password,
        email: email,
        accessibility: accessibility,
        is_active: true
    };
    users.students.push(newStudent);
    
    document.getElementById('studentRegMessage').innerHTML = '<span style="color:green">✓ Student registered!</span>';
    document.getElementById('newStudentNumber').value = '';
    document.getElementById('newStudentName').value = '';
    document.getElementById('newStudentEmail').value = '';
    document.getElementById('newStudentPassword').value = '';
    renderStudentsTable();
    populateStudentDropdown();
    updateAdminStats();
}

function registerAsset() {
    const barcodeId = document.getElementById('newAssetBarcode').value;
    const assetType = document.getElementById('newAssetType').value;
    const serialNumber = document.getElementById('newAssetSerial').value;
    const studentId = document.getElementById('assetStudentId').value;
    
    if (!barcodeId || !studentId) {
        document.getElementById('assetRegMessage').innerHTML = '<span style="color:red">Fill barcode and select student</span>';
        return;
    }
    
    const student = users.students.find(s => s.id === studentId);
    if (!student) {
        document.getElementById('assetRegMessage').innerHTML = '<span style="color:red">Invalid student</span>';
        return;
    }
    
    const newAsset = {
        id: 'AST' + String(assets.length + 1).padStart(3, '0'),
        barcode_id: barcodeId.toUpperCase(),
        asset_type: assetType,
        serial_number: serialNumber || 'N/A',
        student_id: studentId,
        student_name: student.name,
        is_active: true
    };
    assets.push(newAsset);
    
    document.getElementById('assetRegMessage').innerHTML = `<span style="color:green">✓ Asset registered! Barcode: ${barcodeId.toUpperCase()}</span>`;
    document.getElementById('newAssetBarcode').value = '';
    document.getElementById('newAssetSerial').value = '';
    renderAssetsTable();
    updateAdminStats();
}

function registerGuard() {
    const badge = document.getElementById('newGuardBadge').value;
    const name = document.getElementById('newGuardName').value;
    const email = document.getElementById('newGuardEmail').value;
    const password = document.getElementById('newGuardPassword').value;
    const gate = document.getElementById('newGuardGate').value;
    
    if (!badge || !name || !email || !password) {
        document.getElementById('guardRegMessage').innerHTML = '<span style="color:red">Fill all fields</span>';
        return;
    }
    
    users.guards.push({ id: badge.toUpperCase(), name: name, password: password, role: 'guard', gate: gate, email: email });
    document.getElementById('guardRegMessage').innerHTML = '<span style="color:green">✓ Guard registered!</span>';
    document.getElementById('newGuardBadge').value = '';
    document.getElementById('newGuardName').value = '';
    document.getElementById('newGuardEmail').value = '';
    document.getElementById('newGuardPassword').value = '';
    renderGuardsTable();
}

function renderStudentsTable() {
    const container = document.getElementById('studentsTable');
    if (!container) return;
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const filtered = users.students.filter(s => s.name.toLowerCase().includes(searchTerm) || s.student_number.toString().includes(searchTerm));
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center">No students found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(s => `
        <div class="table-row">
            <div><strong>${s.student_number}</strong><br><small>${s.name}</small><br><small>📧 ${s.email}</small><br><small>${s.accessibility}</small></div>
            <button class="delete-btn" onclick="deleteStudent('${s.id}')">Delete</button>
        </div>
    `).join('');
}

function renderAssetsTable() {
    const container = document.getElementById('assetsTable');
    if (!container) return;
    
    if (assets.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center">No assets registered</div>';
        return;
    }
    
    container.innerHTML = assets.map(a => {
        const student = users.students.find(s => s.id === a.student_id);
        return `
            <div class="table-row">
                <div><strong>${a.barcode_id}</strong><br><small>${assetIcons[a.asset_type]} ${a.asset_type}</small><br><small>Owner: ${student?.name || 'Unknown'}</small></div>
                <button class="delete-btn" onclick="deleteAsset('${a.id}')">Delete</button>
            </div>
        `;
    }).join('');
}

function renderGuardsTable() {
    const container = document.getElementById('guardsTable');
    if (!container) return;
    
    if (users.guards.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center">No guards registered</div>';
        return;
    }
    
    container.innerHTML = users.guards.map(g => `
        <div class="table-row">
            <div><strong>${g.id}</strong><br><small>${g.name}</small><br><small>${g.gate}</small><br><small>📧 ${g.email}</small></div>
            <button class="delete-btn" onclick="deleteGuard('${g.id}')">Delete</button>
        </div>
    `).join('');
}

function renderAdminLogsTable() {
    const container = document.getElementById('logsTable');
    if (!container) return;
    const filter = document.getElementById('logFilter')?.value || 'ALL';
    let filtered = filter === 'ALL' ? auditLogs : auditLogs.filter(l => l.decision === filter);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center">No logs found</div>';
        return;
    }
    
    container.innerHTML = filtered.slice(0, 100).map(log => `
        <div class="table-row">
            <div><small>${new Date(log.timestamp).toLocaleString()}</small><br><strong>${log.student_name || 'Unknown'}</strong><br><small>${log.barcode_id_scanned} - ${log.asset_type || 'N/A'}</small></div>
            <div><span class="history-chip chip-${log.decision.toLowerCase()}">${log.decision}</span><br><small>Guard: ${log.guard_id}</small></div>
        </div>
    `).join('');
}

function renderGuardReports() {
    const container = document.getElementById('guardReportsTable');
    if (!container) return;
    const guardFilter = document.getElementById('guardFilter').value;
    
    const guardStats = {};
    auditLogs.forEach(log => {
        if (guardFilter !== 'ALL' && log.guard_id !== guardFilter) return;
        if (!guardStats[log.guard_id]) guardStats[log.guard_id] = { total: 0, authorised: 0, flagged: 0, denied: 0 };
        guardStats[log.guard_id].total++;
        if (log.decision === 'AUTHORISED') guardStats[log.guard_id].authorised++;
        else if (log.decision === 'FLAGGED') guardStats[log.guard_id].flagged++;
        else if (log.decision === 'DENIED') guardStats[log.guard_id].denied++;
    });
    
    const guardSelect = document.getElementById('guardFilter');
    if (guardSelect && (guardSelect.innerHTML === '<option value="ALL">All Guards</option>' || guardSelect.options.length <= 1)) {
        guardSelect.innerHTML = '<option value="ALL">All Guards</option>' + users.guards.map(g => `<option value="${g.id}">${g.id} - ${g.name}</option>`).join('');
    }
    
    if (Object.keys(guardStats).length === 0) {
        container.innerHTML = '<div style="padding:20px;color:#94a3b8;text-align:center">No scan reports</div>';
        return;
    }
    
    container.innerHTML = Object.entries(guardStats).map(([guardId, stats]) => `
        <div class="table-row">
            <div><strong>Guard: ${guardId}</strong></div>
            <div>Total: ${stats.total} | ✅ ${stats.authorised} | ⚠️ ${stats.flagged} | ❌ ${stats.denied}</div>
        </div>
    `).join('');
}

function populateStudentDropdown() {
    const select = document.getElementById('assetStudentId');
    if (select) {
        select.innerHTML = '<option value="">-- Select Student --</option>' + 
            users.students.filter(s => s.is_active !== false).map(s => `<option value="${s.id}">${s.student_number} - ${s.name}</option>`).join('');
    }
}

function deleteStudent(id) {
    if (confirm('Delete student? Their assets will also be deleted.')) {
        users.students = users.students.filter(s => s.id !== id);
        assets = assets.filter(a => a.student_id !== id);
        renderStudentsTable();
        renderAssetsTable();
        populateStudentDropdown();
        updateAdminStats();
    }
}

function deleteAsset(id) {
    if (confirm('Delete this asset?')) {
        assets = assets.filter(a => a.id !== id);
        renderAssetsTable();
        updateAdminStats();
    }
}

function deleteGuard(id) {
    if (confirm('Delete this guard?')) {
        users.guards = users.guards.filter(g => g.id !== id);
        renderGuardsTable();
    }
}

function filterStudents() { renderStudentsTable(); }
function filterLogs() { renderAdminLogsTable(); }
function filterScansByGuard() { renderGuardReports(); }

function exportAllLogs() {
    let csv = 'Timestamp,Guard ID,Student Name,Barcode,Asset Type,Decision,Gate\n';
    auditLogs.forEach(l => {
        csv += `${l.timestamp},${l.guard_id},${l.student_name || 'Unknown'},${l.barcode_id_scanned},${l.asset_type || 'N/A'},${l.decision},${l.gate_id}\n`;
    });
    downloadCSV(csv, `spass_logs_${Date.now()}.csv`);
}

// ========== GUARD FUNCTIONS (No History View) ==========
function loadGuardDashboard() {
    updateGuardStats();
    renderGuardRecentScans();
}

function updateGuardStats() {
    const today = new Date().toDateString();
    const todayLogs = auditLogs.filter(l => l.guard_id === currentUser?.id && new Date(l.timestamp).toDateString() === today);
    document.getElementById('guardScanCount').textContent = todayLogs.length;
    document.getElementById('guardAuthCount').textContent = todayLogs.filter(l => l.decision === 'AUTHORISED').length;
    document.getElementById('guardFlaggedCount').textContent = todayLogs.filter(l => l.decision === 'FLAGGED').length;
    document.getElementById('guardDeniedCount').textContent = todayLogs.filter(l => l.decision === 'DENIED').length;
}

function renderGuardRecentScans() {
    const container = document.getElementById('guardRecentScans');
    if (!container) return;
    const recent = auditLogs.filter(l => l.guard_id === currentUser?.id).slice(0, 10);
    
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No scans today</div>';
        return;
    }
    
    container.innerHTML = recent.map(log => `
        <div class="history-item">
            <div class="history-border ${log.decision === 'AUTHORISED' ? 'green' : (log.decision === 'FLAGGED' ? 'amber' : 'red')}"></div>
            <div class="history-content">
                <div class="history-student">${log.student_name || 'Unknown'}</div>
                <div class="history-barcode">${log.barcode_id_scanned}</div>
                <div class="history-time">${new Date(log.timestamp).toLocaleTimeString()}</div>
            </div>
            <div class="history-chip chip-${log.decision.toLowerCase()}">${log.decision}</div>
        </div>
    `).join('');
}

function startScan() {
    showScreen('scanScreen');
    setTimeout(() => startCamera(), 500);
}

function cancelScan() {
    stopCamera();
    showScreen('guardScreen');
    document.getElementById('manualBarcode').value = '';
}

function manualScan() {
    const barcode = document.getElementById('manualBarcode').value.trim();
    if (!barcode) {
        alert('Enter a barcode number');
        return;
    }
    processScan(barcode);
}

function showResult(data) {
    const container = document.getElementById('resultContainer');
    const icon = data.decision === 'AUTHORISED' ? '✓' : (data.decision === 'FLAGGED' ? '△' : (data.decision === 'OFFLINE' ? '📱' : '✗'));
    const assetIcon = assetIcons[data.assetType] || '📦';
    
    let html = `<div class="result-container ${data.colour}">
        <div class="result-icon">${icon}</div>
        <div class="result-text">${data.decision}</div>
        <div class="result-subtext">${data.subtext}</div>`;
    
    if (data.studentInfo) {
        html += `<div class="result-card">
            <div class="result-student-name">${data.studentInfo.student_name || 'Unknown'}</div>
            <div class="result-detail">Student: ${data.studentInfo.student_number || 'N/A'}</div>
            <div class="result-detail">${assetIcon} Asset: ${data.studentInfo.asset_type || 'Unknown'}</div>
            <div class="result-detail">Barcode: ${data.barcode}</div>
        </div>`;
    } else if (data.decision !== 'OFFLINE') {
        html += `<div class="result-card"><div class="result-detail">Barcode: ${data.barcode}</div><div>${data.message}</div></div>`;
    }
    
    if (data.decision === 'FLAGGED') {
        html += `<div class="voice-badge">⚠️ Admin has been notified. Please wait for approval.</div>`;
    }
    
    html += `<button onclick="backToGuardDashboard()" class="btn-done">DONE</button>`;
    if (data.decision === 'DENIED') {
        html += `<button onclick="alertSupervisor()" class="btn-alert">⚠️ ALERT SUPERVISOR</button>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
    showScreen('resultScreen');
}

function backToGuardDashboard() {
    showScreen('guardScreen');
    document.getElementById('manualBarcode').value = '';
}

function alertSupervisor() {
    alert('🚨 Supervisor has been notified of this security incident.');
}

// ========== OFFLINE QUEUE ==========
function saveOfflineQueue() { localStorage.setItem('spass_offline', JSON.stringify(offlineQueue)); }
function loadOfflineQueue() { 
    const saved = localStorage.getItem('spass_offline'); 
    if(saved) { offlineQueue = JSON.parse(saved); updateOfflineBanner(); } 
}
function updateOfflineBanner() {
    const banner = document.getElementById('offlineQueueBanner');
    if(banner && offlineQueue.length > 0) { 
        banner.style.display = 'block'; 
        document.getElementById('queueSize').innerText = offlineQueue.length; 
    } else if(banner) { banner.style.display = 'none'; }
}
function syncOfflineQueue() {
    if(offlineQueue.length === 0) { alert('No offline scans'); return; }
    let synced = 0;
    offlineQueue.forEach(scan => {
        const asset = assets.find(a => a.barcode_id === scan.barcode_id);
        if(asset) {
            const student = users.students.find(s => s.id === asset.student_id);
            auditLogs.unshift({ id: Date.now()+synced, timestamp: scan.timestamp, guard_id: currentUser?.id, student_id: student?.id, student_name: student?.name, barcode_id_scanned: scan.barcode_id, decision: 'AUTHORISED', gate_id: currentUser?.gate, asset_type: asset.asset_type });
            synced++;
        }
    });
    saveAuditLogs();
    offlineQueue = [];
    saveOfflineQueue();
    updateOfflineBanner();
    updateGuardStats();
    renderGuardRecentScans();
    alert(`${synced} scans synced`);
}

// ========== STORAGE ==========
function saveAuditLogs() { localStorage.setItem('spass_logs', JSON.stringify(auditLogs)); }
function loadAuditLogs() { const saved = localStorage.getItem('spass_logs'); if(saved) auditLogs = JSON.parse(saved); }
function savePendingAlerts() { localStorage.setItem('spass_alerts', JSON.stringify(pendingAlerts)); }
function loadPendingAlerts() { const saved = localStorage.getItem('spass_alerts'); if(saved) pendingAlerts = JSON.parse(saved); }
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blob);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ========== INITIALIZE ==========
window.addEventListener('online', () => { if(offlineQueue.length > 0 && currentUser) alert('Network restored! Click "Sync Offline Scans"'); });
window.addEventListener('offline', () => alert('⚠️ Network disconnected. Scans will be saved offline.'));

loadAuditLogs();
loadOfflineQueue();
loadPendingAlerts();
