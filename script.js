// ========== DATABASE / STORAGE ==========
let currentUser = null;
let currentRole = null;
let auditLogs = [];
let offlineQueue = [];
let guardHistoryFilter = 'ALL';

// Demo Users (Guards, Admins, Students)
let users = {
    guards: [
        { id: 'G001', name: 'John Doe', password: '1234', role: 'guard', gate: 'GATE_1' },
        { id: 'G002', name: 'Jane Smith', password: '1234', role: 'guard', gate: 'GATE_2' }
    ],
    admins: [
        { id: 'A001', name: 'Admin User', password: '1234', role: 'admin' }
    ],
    students: [
        { id: 'S001', student_number: 202394726, name: 'CN MALULEKE', password: '1234', accessibility: 'NONE', is_active: true },
        { id: 'S002', student_number: 202393020, name: 'BZ TWALA', password: '1234', accessibility: 'VISUAL_IMPAIRMENT', is_active: true },
        { id: 'S003', student_number: 240015914, name: 'TM SEKGOBELA', password: '1234', accessibility: 'NONE', is_active: true },
        { id: 'S004', student_number: 202247479, name: 'C SETE', password: '1234', accessibility: 'NONE', is_active: true },
        { id: 'S005', student_number: 240000760, name: 'CB RAMOLOTO', password: '1234', accessibility: 'NONE', is_active: true }
    ]
};

// Assets linked to students
let assets = [
    { id: 'AST001', barcode_id: 'BAR001', asset_type: 'LAPTOP', serial_number: 'SN001', student_id: 'S001', is_active: true },
    { id: 'AST002', barcode_id: 'BAR002', asset_type: 'TABLET', serial_number: 'SN002', student_id: 'S002', is_active: true },
    { id: 'AST003', barcode_id: 'BAR003', asset_type: 'LAPTOP', serial_number: 'SN003', student_id: 'S003', is_active: true },
    { id: 'AST004', barcode_id: 'BAR004', asset_type: 'PHONE', serial_number: 'SN004', student_id: 'S004', is_active: true },
    { id: 'AST005', barcode_id: 'BAR005', asset_type: 'TABLET', serial_number: 'SN005', student_id: 'S005', is_active: true }
];

let selectedRole = 'guard';

// ========== ROLE SELECTION ==========
function selectRole(role) {
    selectedRole = role;
    document.getElementById('roleGuardBtn').classList.toggle('active', role === 'guard');
    document.getElementById('roleAdminBtn').classList.toggle('active', role === 'admin');
    
    const usernameLabel = document.getElementById('usernameLabel');
    if (role === 'guard') {
        usernameLabel.textContent = 'Badge Number';
        document.getElementById('username').placeholder = 'Enter your badge number (e.g., G001)';
    } else {
        usernameLabel.textContent = 'Admin Username';
        document.getElementById('username').placeholder = 'Enter admin username (e.g., A001)';
    }
}

// ========== LOGIN ==========
function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    
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
            errorDiv.textContent = 'Invalid badge number or password. Try G001/1234';
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
            errorDiv.textContent = 'Invalid admin credentials. Try A001/1234';
            errorDiv.style.display = 'block';
        }
    }
}

// ========== FORGOT PASSWORD ==========
function showForgotPassword() {
    showScreen('forgotPasswordScreen');
}

function resetPassword() {
    const username = document.getElementById('resetUsername').value.trim();
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
    
    let found = false;
    // Check guards
    const guardIndex = users.guards.findIndex(g => g.id === username);
    if (guardIndex !== -1) {
        users.guards[guardIndex].password = newPass;
        found = true;
    }
    // Check admins
    const adminIndex = users.admins.findIndex(a => a.id === username);
    if (adminIndex !== -1) {
        users.admins[adminIndex].password = newPass;
        found = true;
    }
    // Check students
    const studentIndex = users.students.findIndex(s => s.student_number.toString() === username || s.id === username);
    if (studentIndex !== -1) {
        users.students[studentIndex].password = newPass;
        found = true;
    }
    
    if (found) {
        successDiv.textContent = 'Password reset successful! Please login.';
        successDiv.style.display = 'block';
        setTimeout(() => backToLogin(), 2000);
    } else {
        errorDiv.textContent = 'Username not found';
        errorDiv.style.display = 'block';
    }
}

function backToLogin() {
    document.getElementById('resetUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    showScreen('loginScreen');
}

function handleLogout() {
    currentUser = null;
    currentRole = null;
    showScreen('loginScreen');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== ADMIN DASHBOARD ==========
function loadAdminDashboard() {
    updateAdminStats();
    renderStudentsTable();
    renderAssetsTable();
    renderGuardsTable();
    renderAdminLogsTable();
    renderGuardReports();
    populateStudentDropdown();
}

function updateAdminStats() {
    document.getElementById('adminTotalStudents').textContent = users.students.filter(s => s.is_active !== false).length;
    document.getElementById('adminTotalAssets').textContent = assets.filter(a => a.is_active !== false).length;
    document.getElementById('adminTotalScans').textContent = auditLogs.length;
    document.getElementById('adminFlaggedScans').textContent = auditLogs.filter(l => l.decision === 'FLAGGED').length;
    
    // Recent activity
    const recent = auditLogs.slice(0, 10);
    const container = document.getElementById('adminRecentActivity');
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#94a3b8;padding:20px">No recent activity</div>';
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
    const tabs = ['dashboard', 'students', 'assets', 'scans', 'guards', 'logs'];
    tabs.forEach(t => {
        document.getElementById(`admin${t.charAt(0).toUpperCase() + t.slice(1)}Tab`).classList.remove('active');
        document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.remove('active');
    });
    document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).classList.add('active');
    document.getElementById(`tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add('active');
    
    if (tab === 'students') renderStudentsTable();
    if (tab === 'assets') renderAssetsTable();
    if (tab === 'guards') renderGuardsTable();
    if (tab === 'logs') renderAdminLogsTable();
    if (tab === 'scans') renderGuardReports();
}

// Student Management
function registerStudent() {
    const studentNumber = document.getElementById('newStudentNumber').value;
    const name = document.getElementById('newStudentName').value;
    const password = document.getElementById('newStudentPassword').value;
    const accessibility = document.getElementById('newAccessibility').value;
    
    if (!studentNumber || !name || !password) {
        document.getElementById('studentRegMessage').innerHTML = '<span style="color:red">Fill all fields</span>';
        return;
    }
    
    const newStudent = {
        id: 'S' + String(users.students.length + 1).padStart(3, '0'),
        student_number: parseInt(studentNumber),
        name: name.toUpperCase(),
        password: password,
        accessibility: accessibility,
        is_active: true
    };
    users.students.push(newStudent);
    
    document.getElementById('studentRegMessage').innerHTML = '<span style="color:green">✓ Student registered successfully!</span>';
    document.getElementById('newStudentNumber').value = '';
    document.getElementById('newStudentName').value = '';
    document.getElementById('newStudentPassword').value = '';
    renderStudentsTable();
    populateStudentDropdown();
    updateAdminStats();
}

function deleteStudent(studentId) {
    if (confirm('Delete this student? All linked assets will also be deleted.')) {
        const studentIndex = users.students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) users.students.splice(studentIndex, 1);
        // Delete linked assets
        for (let i = assets.length - 1; i >= 0; i--) {
            if (assets[i].student_id === studentId) assets.splice(i, 1);
        }
        renderStudentsTable();
        renderAssetsTable();
        populateStudentDropdown();
        updateAdminStats();
    }
}

function renderStudentsTable() {
    const container = document.getElementById('studentsTable');
    const searchTerm = document.getElementById('studentSearch')?.value.toLowerCase() || '';
    const filtered = users.students.filter(s => 
        s.name.toLowerCase().includes(searchTerm) || 
        s.student_number.toString().includes(searchTerm)
    );
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No students found</div>';
        return;
    }
    
    container.innerHTML = filtered.map(s => `
        <div class="table-row">
            <div><strong>${s.student_number}</strong><br><small>${s.name}</small><br><small>${s.accessibility}</small></div>
            <button class="delete-btn" onclick="deleteStudent('${s.id}')">Delete</button>
        </div>
    `).join('');
}

function filterStudents() { renderStudentsTable(); }

// Asset Management
function registerAsset() {
    const barcodeId = document.getElementById('newAssetBarcode').value;
    const assetType = document.getElementById('newAssetType').value;
    const serialNumber = document.getElementById('newAssetSerial').value;
    const studentId = document.getElementById('assetStudentId').value;
    
    if (!barcodeId || !studentId) {
        document.getElementById('assetRegMessage').innerHTML = '<span style="color:red">Fill barcode and select student</span>';
        return;
    }
    
    const newAsset = {
        id: 'AST' + String(assets.length + 1).padStart(3, '0'),
        barcode_id: barcodeId.toUpperCase(),
        asset_type: assetType,
        serial_number: serialNumber,
        student_id: studentId,
        is_active: true
    };
    assets.push(newAsset);
    
    document.getElementById('assetRegMessage').innerHTML = '<span style="color:green">✓ Asset registered and linked to student!</span>';
    document.getElementById('newAssetBarcode').value = '';
    document.getElementById('newAssetSerial').value = '';
    renderAssetsTable();
    updateAdminStats();
}

function deleteAsset(assetId) {
    if (confirm('Delete this asset?')) {
        const index = assets.findIndex(a => a.id === assetId);
        if (index !== -1) assets.splice(index, 1);
        renderAssetsTable();
        updateAdminStats();
    }
}

function renderAssetsTable() {
    const container = document.getElementById('assetsTable');
    const assetsWithStudents = assets.map(a => {
        const student = users.students.find(s => s.id === a.student_id);
        return { ...a, student_name: student?.name || 'Unknown', student_number: student?.student_number || 'N/A' };
    });
    
    if (assetsWithStudents.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No assets registered</div>';
        return;
    }
    
    container.innerHTML = assetsWithStudents.map(a => `
        <div class="table-row">
            <div><strong>${a.barcode_id}</strong><br><small>${a.asset_type}</small><br><small>Owner: ${a.student_name} (${a.student_number})</small></div>
            <button class="delete-btn" onclick="deleteAsset('${a.id}')">Delete</button>
        </div>
    `).join('');
}

function populateStudentDropdown() {
    const select = document.getElementById('assetStudentId');
    select.innerHTML = '<option value="">-- Select Student --</option>' + 
        users.students.filter(s => s.is_active !== false).map(s => 
            `<option value="${s.id}">${s.student_number} - ${s.name}</option>`
        ).join('');
}

// Guard Management
function registerGuard() {
    const badge = document.getElementById('newGuardBadge').value;
    const name = document.getElementById('newGuardName').value;
    const password = document.getElementById('newGuardPassword').value;
    const gate = document.getElementById('newGuardGate').value;
    
    if (!badge || !name || !password) {
        document.getElementById('guardRegMessage').innerHTML = '<span style="color:red">Fill all fields</span>';
        return;
    }
    
    users.guards.push({ id: badge.toUpperCase(), name: name, password: password, role: 'guard', gate: gate });
    
    document.getElementById('guardRegMessage').innerHTML = '<span style="color:green">✓ Guard registered successfully!</span>';
    document.getElementById('newGuardBadge').value = '';
    document.getElementById('newGuardName').value = '';
    document.getElementById('newGuardPassword').value = '';
    renderGuardsTable();
}

function deleteGuard(guardId) {
    if (confirm('Delete this guard?')) {
        const index = users.guards.findIndex(g => g.id === guardId);
        if (index !== -1) users.guards.splice(index, 1);
        renderGuardsTable();
    }
}

function renderGuardsTable() {
    const container = document.getElementById('guardsTable');
    if (users.guards.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No guards registered</div>';
        return;
    }
    
    container.innerHTML = users.guards.map(g => `
        <div class="table-row">
            <div><strong>${g.id}</strong><br><small>${g.name}</small><br><small>${g.gate}</small></div>
            <button class="delete-btn" onclick="deleteGuard('${g.id}')">Delete</button>
        </div>
    `).join('');
}

// Guard Scan Reports
function renderGuardReports() {
    const container = document.getElementById('guardReportsTable');
    const guardFilter = document.getElementById('guardFilter').value;
    
    // Group scans by guard
    const guardStats = {};
    auditLogs.forEach(log => {
        if (guardFilter !== 'ALL' && log.guard_id !== guardFilter) return;
        if (!guardStats[log.guard_id]) {
            guardStats[log.guard_id] = { total: 0, authorised: 0, flagged: 0, denied: 0 };
        }
        guardStats[log.guard_id].total++;
        if (log.decision === 'AUTHORISED') guardStats[log.guard_id].authorised++;
        else if (log.decision === 'FLAGGED') guardStats[log.guard_id].flagged++;
        else if (log.decision === 'DENIED') guardStats[log.guard_id].denied++;
    });
    
    // Populate guard filter dropdown
    const guardSelect = document.getElementById('guardFilter');
    if (guardSelect.innerHTML === '<option value="ALL">All Guards</option>' || guardSelect.options.length <= 1) {
        guardSelect.innerHTML = '<option value="ALL">All Guards</option>' + 
            users.guards.map(g => `<option value="${g.id}">${g.id} - ${g.name}</option>`).join('');
    }
    
    if (Object.keys(guardStats).length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No scan reports available</div>';
        return;
    }
    
    container.innerHTML = Object.entries(guardStats).map(([guardId, stats]) => `
        <div class="table-row">
            <div><strong>Guard: ${guardId}</strong></div>
            <div>Total: ${stats.total} | ✅ ${stats.authorised} | ⚠️ ${stats.flagged} | ❌ ${stats.denied}</div>
        </div>
    `).join('');
}

function filterScansByGuard() { renderGuardReports(); }

// Admin Logs
function renderAdminLogsTable() {
    const container = document.getElementById('logsTable');
    const filter = document.getElementById('logFilter')?.value || 'ALL';
    let filtered = auditLogs;
    if (filter !== 'ALL') filtered = auditLogs.filter(l => l.decision === filter);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No logs found</div>';
        return;
    }
    
    container.innerHTML = filtered.slice(0, 100).map(log => `
        <div class="table-row">
            <div><small>${new Date(log.timestamp).toLocaleString()}</small><br><strong>${log.student_name || 'Unknown'}</strong><br><small>${log.barcode_id_scanned}</small></div>
            <div><span class="history-chip chip-${log.decision.toLowerCase()}">${log.decision}</span><br><small>Guard: ${log.guard_id}</small></div>
        </div>
    `).join('');
}

function filterLogs() { renderAdminLogsTable(); }

function exportAllLogs() {
    let csv = 'Timestamp,Guard ID,Student Name,Barcode,Decision,Gate\n';
    auditLogs.forEach(l => {
        csv += `${l.timestamp},${l.guard_id},${l.student_name || 'Unknown'},${l.barcode_id_scanned},${l.decision},${l.gate_id || 'GATE_1'}\n`;
    });
    downloadCSV(csv, `spass_all_logs_${Date.now()}.csv`);
}

// ========== GUARD FUNCTIONS ==========
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
    const recent = auditLogs.filter(l => l.guard_id === currentUser?.id).slice(0, 10);
    
    if (recent.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8">No recent scans</div>';
        return;
    }
    
    container.innerHTML = recent.map(log => `
        <div class="history-item" style="margin-bottom:8px">
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
}

function cancelScan() {
    showScreen('guardScreen');
}

function simulateScan() {
    const barcodeId = document.getElementById('demoBarcodeSelect').value;
    if (!barcodeId) {
        alert('Please select a barcode to scan');
        return;
    }
    
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
    } else {
        const student = users.students.find(s => s.id === asset.student_id);
        if (asset.student_id && student) {
            decision = 'AUTHORISED';
            colour = 'green';
            message = 'Exit Authorised. Asset verified.';
            studentInfo = { ...asset, student_name: student.name, student_number: student.student_number };
        } else {
            decision = 'FLAGGED';
            colour = 'amber';
            message = 'Asset ownership mismatch. Manual verification required.';
            studentInfo = asset;
        }
    }
    
    const student = studentInfo ? users.students.find(s => s.id === studentInfo.student_id) : null;
    const requiresVoice = student?.accessibility === 'VISUAL_IMPAIRMENT';
    
    const logEntry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        guard_id: currentUser?.id,
        student_id: student?.id,
        student_name: student?.name,
        barcode_id_scanned: barcodeId,
        decision: decision,
        gate_id: currentUser?.gate || 'GATE_1'
    };
    auditLogs.unshift(logEntry);
    saveAuditLogs();
    
    updateGuardStats();
    renderGuardRecentScans();
    if (currentRole === 'admin') updateAdminStats();
    
    showResult({ decision, subtext: decision === 'AUTHORISED' ? 'Exit Permitted' : (decision === 'FLAGGED' ? 'Manual Review Required' : 'Do Not Allow Exit'), message, colour, studentInfo, requiresVoice, barcode: barcodeId });
}

function showResult(data) {
    const container = document.getElementById('resultContainer');
    const icon = data.decision === 'AUTHORISED' ? '✓' : (data.decision === 'FLAGGED' ? '△' : (data.decision === 'OFFLINE' ? '📱' : '✗'));
    
    let html = `<div class="result-container ${data.colour}" style="min-height:700px">
        <div class="result-icon">${icon}</div>
        <div class="result-text">${data.decision}</div>
        <div class="result-subtext">${data.subtext}</div>`;
    
    if (data.studentInfo) {
        html += `<div class="result-card">
            <div class="result-student-name">${data.studentInfo.student_name || 'Unknown'}</div>
            <div class="result-detail">Student Number: ${data.studentInfo.student_number || 'N/A'}</div>
            <div class="result-detail">Asset Type: ${data.studentInfo.asset_type || 'Unknown'}</div>
            <div class="result-detail">Barcode: ${data.barcode}</div>
        </div>`;
    } else if (data.decision !== 'OFFLINE') {
        html += `<div class="result-card"><div class="result-detail">Barcode: ${data.barcode}</div><div>${data.message}</div></div>`;
    }
    
    if (data.requiresVoice) html += `<div class="voice-badge">🎤 Voice Guidance Available - Audio assistance enabled</div>`;
    html += `<button onclick="backToGuardDashboard()" class="btn-done">DONE</button>`;
    if (data.decision === 'FLAGGED' || data.decision === 'DENIED') {
        html += `<button onclick="alertSupervisor()" class="btn-alert">⚠️ ALERT SUPERVISOR</button>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
    showScreen('resultScreen');
}

function backToGuardDashboard() {
    showScreen('guardScreen');
    document.getElementById('demoBarcodeSelect').value = '';
}

function alertSupervisor() {
    alert('🚨 Supervisor has been notified of this security incident.');
}

function viewGuardHistory() {
    renderGuardHistory();
    showScreen('guardHistoryScreen');
}

function backToGuardDashboardFromHistory() {
    showScreen('guardScreen');
}

function renderGuardHistory() {
    const container = document.getElementById('guardHistoryList');
    let filtered = auditLogs.filter(l => l.guard_id === currentUser?.id);
    if (guardHistoryFilter !== 'ALL') filtered = filtered.filter(l => l.decision === guardHistoryFilter);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-history">No scan events found.</div>';
        return;
    }
    
    container.innerHTML = filtered.map(log => `
        <div class="history-item">
            <div class="history-border ${log.decision === 'AUTHORISED' ? 'green' : (log.decision === 'FLAGGED' ? 'amber' : 'red')}"></div>
            <div class="history-content">
                <div class="history-student">${log.student_name || 'Unknown Student'}</div>
                <div class="history-barcode">Barcode: ${log.barcode_id_scanned}</div>
                <div class="history-time">${new Date(log.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-chip chip-${log.decision.toLowerCase()}">${log.decision}</div>
        </div>
    `).join('');
}

function filterGuardHistory(filter) {
    guardHistoryFilter = filter;
    document.querySelectorAll('#guardHistoryScreen .filter-chip').forEach((chip, i) => {
        const filters = ['ALL', 'AUTHORISED', 'FLAGGED', 'DENIED'];
        chip.classList.toggle('active', filters[i] === filter);
    });
    renderGuardHistory();
}

function exportGuardLogs() {
    let csv = 'Timestamp,Student Name,Barcode,Decision,Gate\n';
    const filtered = auditLogs.filter(l => l.guard_id === currentUser?.id);
    filtered.forEach(l => {
        csv += `${l.timestamp},${l.student_name || 'Unknown'},${l.barcode_id_scanned},${l.decision},${l.gate_id}\n`;
    });
    downloadCSV(csv, `guard_${currentUser?.id}_logs_${Date.now()}.csv`);
}

// ========== OFFLINE QUEUE ==========
function saveOfflineQueue() { localStorage.setItem('spass_offline', JSON.stringify(offlineQueue)); }
function loadOfflineQueue() { const saved = localStorage.getItem('spass_offline'); if(saved) { offlineQueue = JSON.parse(saved); updateOfflineBanner(); } }
function updateOfflineBanner() {
    const banner = document.getElementById('offlineQueueBanner');
    if(banner && offlineQueue.length > 0) { banner.style.display = 'block'; document.getElementById('queueSize').innerText = offlineQueue.length; }
    else if(banner) { banner.style.display = 'none'; }
}
function syncOfflineQueue() {
    if(offlineQueue.length === 0) { alert('No offline scans'); return; }
    let synced = 0;
    offlineQueue.forEach(scan => {
        const asset = assets.find(a => a.barcode_id === scan.barcode_id);
        if(asset) {
            const student = users.students.find(s => s.id === asset.student_id);
            auditLogs.unshift({ id: Date.now()+synced, timestamp: scan.timestamp, guard_id: currentUser?.id, student_id: student?.id, student_name: student?.name, barcode_id_scanned: scan.barcode_id, decision: asset.student_id ? 'AUTHORISED' : 'FLAGGED', gate_id: currentUser?.gate });
            synced++;
        }
    });
    saveAuditLogs();
    offlineQueue = [];
    saveOfflineQueue();
    updateOfflineBanner();
    updateGuardStats();
    renderGuardRecentScans();
    alert(`${synced} scans synced successfully`);
}

// ========== STORAGE ==========
function saveAuditLogs() { localStorage.setItem('spass_logs', JSON.stringify(auditLogs)); }
function loadAuditLogs() { const saved = localStorage.getItem('spass_logs'); if(saved) auditLogs = JSON.parse(saved); }
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blob);
}

// ========== NETWORK LISTENERS ==========
window.addEventListener('online', () => { if(offlineQueue.length > 0 && currentUser) alert('Network restored! Click "Sync Offline Scans"'); });
window.addEventListener('offline', () => alert('⚠️ Network disconnected. Scans will be saved offline.'));

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ========== INITIALIZE ==========
loadAuditLogs();
loadOfflineQueue();
