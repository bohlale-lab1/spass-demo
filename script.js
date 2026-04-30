let currentGuard = null;
let auditLogs = [];
let offlineQueue = [];
let currentFilter = 'ALL';

const demoGuards = {
    'G001': { name: 'John Doe', password: '1234' },
    'G002': { name: 'Jane Smith', password: '1234' }
};

const assets = {
    'BAR001': { student_id: 'STU001', student_name: 'CN MALULEKE', student_number: 202394726, asset_type: 'LAPTOP', status: 'MATCH' },
    'BAR002': { student_id: 'STU002', student_name: 'BZ TWALA', student_number: 202393020, asset_type: 'TABLET', status: 'MATCH', voice_guidance: true },
    'BAR003': { student_id: 'STU003', student_name: 'TM SEKGOBELA', student_number: 240015914, asset_type: 'LAPTOP', status: 'MATCH' },
    'BAR999': { student_id: 'STU001', student_name: 'CN MALULEKE', student_number: 202394726, asset_type: 'LAPTOP', status: 'MISMATCH' }
};

const students = {
    'STU001': { name: 'CN MALULEKE', number: 202394726 },
    'STU002': { name: 'BZ TWALA', number: 202393020, accessibility: 'VISUAL_IMPAIRMENT' },
    'STU003': { name: 'TM SEKGOBELA', number: 240015914 }
};

function handleLogin() {
    const badgeNumber = document.getElementById('badgeNumber').value;
    const password = document.getElementById('password').value;
    const guard = demoGuards[badgeNumber];
    
    if (guard && guard.password === password) {
        currentGuard = { id: badgeNumber, name: guard.name };
        document.getElementById('guardNameDisplay').innerHTML = `Welcome, ${guard.name}`;
        showScreen('homeScreen');
        updateStats();
    } else {
        alert('Invalid credentials. Try G001/1234');
    }
}

function handleLogout() {
    currentGuard = null;
    showScreen('loginScreen');
}

function startScan() {
    showScreen('scanScreen');
}

function simulateScan() {
    const barcodeId = document.getElementById('demoBarcodeSelect').value;
    if (!barcodeId) { alert('Select a barcode'); return; }
    
    if (!navigator.onLine) {
        offlineQueue.push({ id: Date.now(), barcode_id: barcodeId, timestamp: new Date().toISOString() });
        saveOfflineQueue();
        updateOfflineBanner();
        showResult({ decision: 'OFFLINE', subtext: 'Scan Saved', message: 'No network. Will sync later.', colour: 'amber' });
        return;
    }
    
    const asset = assets[barcodeId];
    let decision, colour, message, studentInfo = null;
    
    if (!asset) {
        decision = 'DENIED'; colour = 'red'; message = 'Asset not registered';
    } else if (asset.status === 'MISMATCH') {
        decision = 'FLAGGED'; colour = 'amber'; message = 'Ownership mismatch. Manual review required.';
        studentInfo = asset;
    } else {
        decision = 'AUTHORISED'; colour = 'green'; message = 'Exit Authorised. Asset verified.';
        studentInfo = asset;
    }
    
    const student = students[asset?.student_id];
    const requiresVoice = student?.accessibility === 'VISUAL_IMPAIRMENT';
    
    auditLogs.unshift({
        id: Date.now(), timestamp: new Date().toISOString(), guard_id: currentGuard?.id,
        student_id: asset?.student_id, student_name: asset?.student_name,
        barcode_id_scanned: barcodeId, decision: decision
    });
    saveAuditLogs();
    updateStats();
    
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
            <div class="result-student-name">${data.studentInfo.student_name}</div>
            <div class="result-detail">Student: ${data.studentInfo.student_number}</div>
            <div class="result-detail">Asset: ${data.studentInfo.asset_type}</div>
            <div class="result-detail">Barcode: ${data.barcode}</div>
        </div>`;
    } else if (data.decision !== 'OFFLINE') {
        html += `<div class="result-card"><div class="result-detail">Barcode: ${data.barcode}</div><div>${data.message}</div></div>`;
    } else {
        html += `<div class="result-card"><div>${data.message}</div></div>`;
    }
    
    if (data.requiresVoice) html += `<div class="voice-badge">🎤 Voice Guidance Available</div>`;
    html += `<button onclick="backToHome()" class="btn-done">DONE</button>`;
    if (data.decision === 'FLAGGED' || data.decision === 'DENIED') {
        html += `<button onclick="alert('Supervisor notified')" class="btn-alert">⚠️ ALERT SUPERVISOR</button>`;
    }
    html += `</div>`;
    
    container.innerHTML = html;
    showScreen('resultScreen');
}

function backToHome() { showScreen('homeScreen'); document.getElementById('demoBarcodeSelect').value = ''; }
function cancelScan() { showScreen('homeScreen'); document.getElementById('demoBarcodeSelect').value = ''; }
function goHome() { showScreen('homeScreen'); }

function viewHistory() { renderHistory(); showScreen('historyScreen'); }

function renderHistory() {
    const list = document.getElementById('historyList');
    let filtered = currentFilter === 'ALL' ? auditLogs : auditLogs.filter(l => l.decision === currentFilter);
    if (filtered.length === 0) { list.innerHTML = '<div class="empty-history">No scan events yet.</div>'; return; }
    
    list.innerHTML = filtered.map(log => `
        <div class="history-item">
            <div class="history-border ${log.decision === 'AUTHORISED' ? 'border-green' : (log.decision === 'FLAGGED' ? 'border-amber' : 'border-red')}"></div>
            <div class="history-content">
                <div class="history-student">${log.student_name || 'Unknown'}</div>
                <div class="history-barcode">Barcode: ${log.barcode_id_scanned}</div>
                <div class="history-time">${new Date(log.timestamp).toLocaleString()}</div>
            </div>
            <div class="history-chip ${log.decision === 'AUTHORISED' ? 'chip-green' : (log.decision === 'FLAGGED' ? 'chip-amber' : 'chip-red')}">${log.decision}</div>
        </div>
    `).join('');
}

function filterHistory(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-chip').forEach((c, i) => {
        const filters = ['ALL', 'AUTHORISED', 'FLAGGED', 'DENIED'];
        c.classList.toggle('active', filters[i] === filter);
    });
    renderHistory();
}

function exportLogs() {
    let csv = 'timestamp,guard_id,student_id,barcode_id,decision\n';
    auditLogs.forEach(l => csv += `${l.timestamp},${l.guard_id},${l.student_id || ''},${l.barcode_id_scanned},${l.decision}\n`);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `spass_log_${Date.now()}.csv`;
    a.click();
    alert('Log exported as CSV');
}

function saveOfflineQueue() { localStorage.setItem('spass_offline', JSON.stringify(offlineQueue)); }
function loadOfflineQueue() { const saved = localStorage.getItem('spass_offline'); if(saved) { offlineQueue = JSON.parse(saved); updateOfflineBanner(); } }
function updateOfflineBanner() { 
    const banner = document.getElementById('offlineQueueBanner');
    if(offlineQueue.length > 0) { banner.style.display = 'block'; document.getElementById('queueSize').innerText = offlineQueue.length; }
    else { banner.style.display = 'none'; }
}
function syncOfflineQueue() {
    if(offlineQueue.length === 0) { alert('No offline scans'); return; }
    let synced = 0;
    offlineQueue.forEach(scan => {
        const asset = assets[scan.barcode_id];
        if(asset) {
            auditLogs.unshift({ id: Date.now()+synced, timestamp: scan.timestamp, guard_id: currentGuard?.id, student_id: asset.student_id, student_name: asset.student_name, barcode_id_scanned: scan.barcode_id, decision: asset.status === 'MATCH' ? 'AUTHORISED' : 'FLAGGED' });
            synced++;
        }
    });
    saveAuditLogs();
    offlineQueue = [];
    saveOfflineQueue();
    updateOfflineBanner();
    updateStats();
    alert(`${synced} scans synced`);
}

function saveAuditLogs() { localStorage.setItem('spass_logs', JSON.stringify(auditLogs)); }
function loadAuditLogs() { const saved = localStorage.getItem('spass_logs'); if(saved) auditLogs = JSON.parse(saved); }
function updateStats() {
    const today = new Date().toDateString();
    const todayLogs = auditLogs.filter(l => new Date(l.timestamp).toDateString() === today);
    document.getElementById('scanCount').innerText = todayLogs.length;
    document.getElementById('authCount').innerText = todayLogs.filter(l => l.decision === 'AUTHORISED').length;
    document.getElementById('flaggedCount').innerText = todayLogs.filter(l => l.decision === 'FLAGGED').length;
}
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }

window.addEventListener('online', () => { if(offlineQueue.length > 0 && currentGuard) alert('Network restored! Click "Sync Offline Scans"'); });
window.addEventListener('offline', () => alert('Network disconnected. Scans will be saved offline.'));

loadAuditLogs();
loadOfflineQueue();
updateStats();
