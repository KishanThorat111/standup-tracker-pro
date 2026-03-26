/**
 * Standup Tracker Pro - Production Grade Forensic Attendance System
 * Warm Sage Color System | IndexedDB Persistence | Real PDF Export
 */

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

const STATUS_CONFIG = {
    present_active: { label: 'Present Active', abbr: 'PA', color: 'status-present' },
    present_async: { label: 'Present Async', abbr: 'AA', color: 'status-async' },
    present_ghost: { label: 'Ghost Promise', abbr: 'AG', color: 'status-ghost' },
    present_late: { label: 'Present Late', abbr: 'PL', color: 'status-late' },
    informed_valid: { label: 'Informed Valid', abbr: 'IV', color: 'status-informed' },
    absent_no_internet: { label: 'No Internet', abbr: 'NI', color: 'status-absent' },
    absent_no_response: { label: 'No Response', abbr: 'NR', color: 'status-absent' },
    absent_fake_excuse: { label: 'Fake Excuse', abbr: 'FE', color: 'status-fake' },
    remote_chat_only: { label: 'Chat Only', abbr: 'RC', color: 'status-async' },
    remote_async_deferred: { label: 'Async Deferred', abbr: 'AD', color: 'status-late' }
};

const STANDUP_TIME = '09:00'; // 9 AM default standup time

// Statuses that mean the person was absent for that session (no standup expected)
const ABSENT_STATUSES = ['absent_no_internet', 'absent_no_response', 'absent_fake_excuse', 'informed_valid'];

function isAbsentStatus(status) {
    return ABSENT_STATUSES.includes(status);
}

// Check if a morning absent status means full-day absent (evening not expected)
function isFullDayAbsentStatus(status) {
    return ['absent_no_internet', 'absent_no_response', 'absent_fake_excuse'].includes(status);
}

// ============================================
// AUTH & API CLIENT
// ============================================

const API_BASE = '/api';

const AuthState = {
    token: localStorage.getItem('auth_token'),
    user: JSON.parse(localStorage.getItem('auth_user') || 'null'),

    isAuthenticated() {
        return !!this.token;
    },

    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
    },

    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }
};

async function apiCall(path, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (AuthState.token) {
        headers['Authorization'] = `Bearer ${AuthState.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        AuthState.clearAuth();
        showAuthScreen();
        throw new Error('Session expired. Please login again.');
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'API request failed');
    }

    return data;
}

function showAuthScreen() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('authScreen').classList.remove('hidden');
    initAuthUI();
    lucide.createIcons();
}

function hideAuthScreen() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
}

let authUIInitialized = false;
function initAuthUI() {
    if (authUIInitialized) return;
    authUIInitialized = true;

    document.getElementById('loginTab').addEventListener('click', () => {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('loginTab').className = 'flex-1 py-2 rounded-md text-sm font-medium bg-action text-white transition-colors';
        document.getElementById('registerTab').className = 'flex-1 py-2 rounded-md text-sm font-medium text-slate hover:text-charcoal transition-colors';
        document.getElementById('authError').classList.add('hidden');
    });

    document.getElementById('registerTab').addEventListener('click', () => {
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerTab').className = 'flex-1 py-2 rounded-md text-sm font-medium bg-action text-white transition-colors';
        document.getElementById('loginTab').className = 'flex-1 py-2 rounded-md text-sm font-medium text-slate hover:text-charcoal transition-colors';
        document.getElementById('authError').classList.add('hidden');
    });

    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('loginPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('registerPassword').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        const data = await apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        AuthState.setAuth(data.token, data.user);
        errorEl.classList.add('hidden');
        hideAuthScreen();
        await initApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sign In';
    }
}

async function handleRegister() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('registerBtn');

    if (!name || !email || !password) {
        errorEl.textContent = 'Please fill in all fields';
        errorEl.classList.remove('hidden');
        return;
    }

    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = 'Creating account...';

        const data = await apiCall('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });

        AuthState.setAuth(data.token, data.user);
        errorEl.classList.add('hidden');
        hideAuthScreen();
        await initApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        AuthState.clearAuth();
        showAuthScreen();
    }
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

let db;

async function initDatabase() {
    db = new Dexie('StandupTrackerDB');
    
    db.version(1).stores({
        employees: '++id, full_name, team, is_active, trust_score',
        attendance_records: '[employee_id+date], employee_id, date',
        sync_queue: '++operation_id, timestamp, retry_count',
        app_settings: 'key'
    });

    db.version(2).stores({
        employees: '++id, full_name, team, is_active, trust_score',
        attendance_records: '[employee_id+date], employee_id, date',
        sync_queue: '++operation_id, timestamp, retry_count',
        app_settings: 'key',
        holidays: 'date'
    });

    db.version(3).stores({
        employees: '++id, full_name, team, is_active, trust_score',
        attendance_records: '[employee_id+date], employee_id, date',
        sync_queue: '++operation_id, timestamp, retry_count',
        app_settings: 'key',
        holidays: 'date',
        ai_history: '++id, timestamp'
    });
    
    try {
        await db.open();
        console.log('Database opened successfully');
        
        // Initialize default settings
        const settings = await db.app_settings.get('main');
        if (!settings) {
            await db.app_settings.put({
                key: 'main',
                install_date: new Date().toISOString(),
                last_backup: null,
                manager_name: '',
                theme: 'warm-sage'
            });
        }
        
        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        showToast('Failed to initialize database', 'error');
        return false;
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateUUID() {
    return crypto.randomUUID();
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString();
}

function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function escapeHtml(str) {
    if (!str) return '';
    const el = document.createElement('span');
    el.textContent = String(str);
    return el.innerHTML;
}

function debounce(fn, ms = 400) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

// ============================================
// HOLIDAY SYSTEM
// ============================================

function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.getDay() === 0 || d.getDay() === 6; // Sunday = 0, Saturday = 6
}

async function isHoliday(dateStr) {
    if (isWeekend(dateStr)) return true;
    const holiday = await db.holidays.get(dateStr);
    return !!holiday;
}

async function getHolidayName(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (d.getDay() === 0) return 'Sunday';
    if (d.getDay() === 6) return 'Saturday';
    const holiday = await db.holidays.get(dateStr);
    return holiday?.name || null;
}

async function getAllHolidays() {
    return await db.holidays.toArray();
}

async function addHoliday(dateStr, name) {
    await db.holidays.put({ date: dateStr, name: name || 'Holiday' });
    debouncedCloudSync();
}

async function removeHoliday(dateStr) {
    await db.holidays.delete(dateStr);
    debouncedCloudSync();
}

function getLastWorkingDay(fromDate) {
    const d = new Date(fromDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    // Skip weekends (custom holidays checked async separately)
    while (d.getDay() === 0 || d.getDay() === 6) {
        d.setDate(d.getDate() - 1);
    }
    return formatDate(d);
}

function calculateLagMinutes(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    return Math.round((end - start) / (1000 * 60));
}

function calculateLagHours(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const start = new Date(startTime);
    const end = new Date(endTime);
    return ((end - start) / (1000 * 60 * 60)).toFixed(1);
}

function isGhostPromise(record, session) {
    const data = record?.[session];
    if (!data) return false;
    
    const isPromise = data.status === 'present_async' || 
                      (data.notes?.toLowerCase().includes('will update')) ||
                      (data.notes?.toLowerCase().includes('later')) ||
                      (data.notes?.toLowerCase().includes('update soon'));
    
    return isPromise && !data.ghost_promise?.fulfilled;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const colors = {
        info: 'bg-dusty',
        success: 'bg-sage',
        error: 'bg-terracotta',
        warning: 'bg-amber'
    };
    
    toast.className = `toast px-4 py-3 rounded-lg text-white text-sm flex items-center gap-2 shadow-warm ${colors[type] || colors.info}`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'warning' ? 'alert-triangle' : 'info'}" class="w-4 h-4"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// STATE MANAGEMENT
// ============================================

const AppState = {
    currentScreen: 'dashboard',
    currentDate: formatDate(new Date()),
    employees: [],
    attendanceRecords: {},
    settings: {},
    isOnline: navigator.onLine,
    pendingSync: 0,
    
    async loadEmployees() {
        this.employees = await db.employees.toArray();
        this.employees.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        return this.employees;
    },
    
    async loadAttendanceForDate(date) {
        const records = await db.attendance_records.where('date').equals(date).toArray();
        this.attendanceRecords[date] = {};
        records.forEach(r => {
            this.attendanceRecords[date][r.employee_id] = r;
        });
        return this.attendanceRecords[date];
    },
    
    async loadSettings() {
        this.settings = await db.app_settings.get('main') || {};
        return this.settings;
    },
    
    async getPendingVerifications() {
        const records = await db.attendance_records.toArray();
        return records.filter(r => 
            (r.morning?.status === 'absent_no_internet' && r.morning?.verification_status === 'unverified') ||
            (r.evening?.status === 'absent_no_internet' && r.evening?.verification_status === 'unverified')
        );
    },
    
    async getGhostPromises(date) {
        const records = await db.attendance_records.where('date').equals(date).toArray();
        const ghosts = [];
        
        for (const record of records) {
            if (record.morning?.status === 'present_ghost') {
                const employee = await db.employees.get(record.employee_id);
                ghosts.push({
                    employee_id: record.employee_id,
                    employee_name: employee?.full_name || 'Unknown',
                    promise_time: record.morning.ghost_promise?.made_at,
                    lag_hours: record.morning.ghost_promise?.lag_hours
                });
            }
        }
        
        return ghosts;
    }
};

// ============================================
// TRUST SCORE SYSTEM
// ============================================

async function calculateTrustScore(employeeId) {
    // Exempt employees always have perfect trust — they don't participate in standups
    const emp = await db.employees.get(employeeId);
    if (emp?.standup_exempt) return 100;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = formatDate(thirtyDaysAgo);
    
    const records = await db.attendance_records
        .where('employee_id')
        .equals(employeeId)
        .filter(r => r.date >= cutoffDate)
        .toArray();
    
    if (records.length === 0) return 100;
    
    let score = 100;
    
    records.forEach(record => {
        // If morning is full-day absent, only penalize morning session — evening was auto-set
        const morningIsFullDayAbsent = isFullDayAbsentStatus(record.morning?.status);
        
        ['morning', 'evening'].forEach(session => {
            // Skip evening penalty if morning was full-day absent (evening is just a mirror)
            if (session === 'evening' && morningIsFullDayAbsent) return;
            
            const status = record[session]?.status;
            const verification = record[session]?.verification_status;
            
            if (status === 'absent_fake_excuse' || verification === 'verified_fake') {
                score -= 20;
            } else if (status === 'present_ghost') {
                score -= 15;
            } else if (status === 'absent_no_response') {
                score -= 10;
            } else if (status === 'present_late') {
                score -= 5;
            } else if (status === 'remote_async_deferred') {
                const lag = record[session]?.response_lag_minutes || 0;
                if (lag > 120) score -= 5; // More than 2 hours late
            }
        });
    });
    
    // Cap at 100
    return Math.max(0, Math.min(100, score));
}

async function updateTrustScore(employeeId) {
    const score = await calculateTrustScore(employeeId);
    await db.employees.update(employeeId, { trust_score: score });
    return score;
}

// ============================================
// GHOST DETECTION ENGINE
// ============================================

async function detectAndConvertGhosts(date) {
    const records = await db.attendance_records.where('date').equals(date).toArray();
    const converted = [];
    
    const now = new Date();
    const isAfterSixPM = now.getHours() >= 18;
    
    for (const record of records) {
        const morning = record.morning;
        const evening = record.evening;
        
        // Skip exempt employees — they don't participate in standups
        const emp = await db.employees.get(record.employee_id);
        if (emp?.standup_exempt) continue;
        
        // Skip anyone who was absent — they are not expected to give evening updates
        if (isAbsentStatus(morning?.status)) continue;
        
        // Check if morning was a promise to update later
        const isPromise = morning?.status === 'present_async' || 
                          (morning?.notes?.toLowerCase().includes('will update')) ||
                          (morning?.notes?.toLowerCase().includes('later')) ||
                          (morning?.notes?.toLowerCase().includes('update soon'));
        
        // Check if evening update is missing
        const noEveningUpdate = !evening?.status || 
                                evening?.status === 'absent_no_response' ||
                                evening?.status === '';
        
        if (isPromise && noEveningUpdate && (isAfterSixPM || morning?.force_ghost_check)) {
            // Convert to ghost using get + modify + put (Dexie 3.x compatible)
            const endOfDay = new Date(date + 'T18:00:00');
            const promiseTime = morning.timestamp ? new Date(morning.timestamp) : new Date(date + 'T09:00:00');
            const lagHours = calculateLagHours(promiseTime.toISOString(), endOfDay.toISOString());
            
            record.morning.status = 'present_ghost';
            record.morning.ghost_promise = {
                made_at: morning.timestamp || new Date().toISOString(),
                fulfilled: false,
                fulfilled_at: null,
                lag_hours: parseFloat(lagHours)
            };
            record.last_modified = new Date().toISOString();
            
            await db.attendance_records.put(record);
            
            // Add audit entry
            await addAuditEntry(record.employee_id, record.date, 'ghost_converted', AppState.settings.manager_name || 'system', morning.status, 'present_ghost');
            
            // Update trust score
            await updateTrustScore(record.employee_id);
            
            const employee = await db.employees.get(record.employee_id);
            converted.push({
                employee_id: record.employee_id,
                employee_name: employee?.full_name || 'Unknown',
                lag_hours: lagHours
            });
        }
    }
    
    return converted;
}

// ============================================
// AUDIT TRAIL
// ============================================

async function addAuditEntry(employeeId, date, action, user, oldValue, newValue) {
    try {
        const record = await db.attendance_records.get([employeeId, date]);
        if (!record) return;
        
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            user: user || 'system',
            old_value: oldValue,
            new_value: newValue
        };
        
        const auditTrail = record.audit_trail || [];
        auditTrail.push(entry);
        record.audit_trail = auditTrail;
        
        await db.attendance_records.put(record);
    } catch (err) {
        console.error('Audit entry failed:', err);
    }
}

// ============================================
// ATTENDANCE OPERATIONS
// ============================================

async function saveAttendance(employeeId, session, data) {
    const date = AppState.currentDate;
    
    let record = await db.attendance_records.get([employeeId, date]);
    
    if (!record) {
        record = {
            employee_id: employeeId,
            date: date,
            morning: {
                status: '',
                timestamp: null,
                claimed_issue: 'none',
                verification_status: 'unverified',
                verification_notes: '',
                verified_by: '',
                verified_at: null,
                proof_source: 'none',
                async_content: '',
                notes: '',
                response_lag_minutes: 0,
                ghost_promise: null
            },
            evening: {
                status: '',
                timestamp: null,
                claimed_issue: 'none',
                verification_status: 'unverified',
                verification_notes: '',
                verified_by: '',
                verified_at: null,
                proof_source: 'none',
                async_content: '',
                notes: '',
                response_lag_minutes: 0,
                ghost_promise: null
            },
            audit_trail: [],
            last_modified: new Date().toISOString()
        };
    }
    
    const oldStatus = record[session]?.status;
    
    // Update fields
    Object.keys(data).forEach(field => {
        record[session][field] = data[field];
    });
    
    // Set timestamp if status is being set for the first time
    if (data.status && !record[session].timestamp) {
        record[session].timestamp = new Date().toISOString();
        
        // Calculate response lag for async statuses (only if entering for today)
        if (['present_async', 'remote_async_deferred'].includes(data.status)) {
            const today = formatDate(new Date());
            if (date === today) {
                const standupTime = new Date(date + 'T' + STANDUP_TIME);
                const actualTime = new Date();
                const lag = calculateLagMinutes(standupTime.toISOString(), actualTime.toISOString());
                record[session].response_lag_minutes = Math.max(0, Math.min(lag, 480)); // Cap at 8 hours
            } else {
                record[session].response_lag_minutes = 0; // Don't calculate lag for past dates
            }
        }
    }
    
    record.last_modified = new Date().toISOString();
    
    await db.attendance_records.put(record);
    
    // Add audit entry
    await addAuditEntry(employeeId, date, `${session}_updated`, AppState.settings.manager_name || 'manager', oldStatus, data.status);
    
    // Update trust score if status changed
    if (data.status) {
        await updateTrustScore(employeeId);
        await AppState.loadEmployees();
    }
    
    updateSyncIndicator('synced');
    debouncedCloudSync();
    
    return record;
}

// ============================================
// UI RENDERING - DASHBOARD
// ============================================

function renderDashboard() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('dashboardTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
    
    // Set date picker
    const datePicker = document.getElementById('datePicker');
    datePicker.value = AppState.currentDate;
    datePicker.addEventListener('change', async (e) => {
        AppState.currentDate = e.target.value;
        await AppState.loadAttendanceForDate(AppState.currentDate);
        renderEmployeeList();
        updateInsights();
    });
    
    // Quick mark
    document.getElementById('quickMark').addEventListener('change', handleQuickMark);
    document.getElementById('copyYesterdayBtn').addEventListener('click', copyYesterday);
    document.getElementById('checkGhostsBtn').addEventListener('click', checkGhosts);
    document.getElementById('viewGhostsBtn')?.addEventListener('click', () => {
        document.querySelector('[data-screen="verification"]').click();
    });
    document.getElementById('addFirstEmployeeBtn')?.addEventListener('click', showAddEmployeeModal);
    
    renderEmployeeList();
    updateInsights();
}

async function renderEmployeeList() {
    const list = document.getElementById('employeeList');
    const emptyState = document.getElementById('emptyState');
    const holidayBanner = document.getElementById('holidayBanner');
    
    // Check if current date is a holiday
    const holidayName = await getHolidayName(AppState.currentDate);
    if (holidayName) {
        if (holidayBanner) {
            holidayBanner.classList.remove('hidden');
            document.getElementById('holidayName').textContent = holidayName;
        }
        list.innerHTML = '';
        emptyState.classList.add('hidden');
        return;
    } else if (holidayBanner) {
        holidayBanner.classList.add('hidden');
    }
    
    if (!AppState.employees.length) {
        list.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    const standupEmployees = AppState.employees.filter(e => e.is_active && !e.standup_exempt);
    
    if (!standupEmployees.length) {
        list.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    list.innerHTML = '';
    
    const records = await AppState.loadAttendanceForDate(AppState.currentDate);
    
    for (const employee of standupEmployees) {
        const record = records[employee.id] || null;
        const card = createEmployeeCard(employee, record);
        list.appendChild(card);
    }
    
    lucide.createIcons();
}

function createEmployeeCard(employee, record) {
    const template = document.getElementById('employeeCardTemplate');
    const card = template.content.cloneNode(true);
    const cardEl = card.querySelector('.employee-card');
    
    // Header
    card.querySelector('.employee-name').textContent = employee.full_name;
    card.querySelector('.employee-role').textContent = employee.role;
    card.querySelector('.employee-team').textContent = employee.team || 'No team';
    card.querySelector('.employee-avatar').textContent = getInitials(employee.full_name);
    
    // Trust score
    const trustBadge = card.querySelector('.trust-badge');
    const score = employee.trust_score || 100;
    trustBadge.textContent = `Trust: ${score}`;
    trustBadge.className = `trust-badge px-2 py-0.5 rounded text-xs font-medium ${score >= 80 ? 'trust-high' : score >= 50 ? 'trust-medium' : 'trust-low'}`;
    
    // Morning section
    const morningStatus = card.querySelector('.morning-status');
    const morningNotes = card.querySelector('.morning-notes');
    const morningTime = card.querySelector('.morning-time');
    const morningAsync = card.querySelector('.morning-async');
    const morningVerify = card.querySelector('.morning-verify');
    const morningGhost = card.querySelector('.morning-ghost-notice');
    const morningLag = card.querySelector('.morning-lag');
    
    if (record?.morning) {
        morningStatus.value = record.morning.status || '';
        morningNotes.value = record.morning.notes || '';
        morningTime.textContent = record.morning.timestamp ? formatTime(record.morning.timestamp) : '';
        
        // Show lag if exists
        if (record.morning.response_lag_minutes > 0) {
            const hours = Math.floor(record.morning.response_lag_minutes / 60);
            const mins = record.morning.response_lag_minutes % 60;
            morningLag.textContent = hours > 0 ? `+${hours}h ${mins}m` : `+${mins}m`;
            morningLag.className = 'morning-lag ml-auto text-xs font-medium text-amber';
        }
        
        // Show async fields
        if (['present_async', 'remote_async_deferred'].includes(record.morning.status)) {
            morningAsync.classList.remove('hidden');
            card.querySelector('.morning-source').value = record.morning.proof_source || '';
            card.querySelector('.morning-content').value = record.morning.async_content || '';
        }
        
        // Show verify button for unverified excuses
        if (record.morning.status === 'absent_no_internet' && record.morning.verification_status === 'unverified') {
            morningVerify.classList.remove('hidden');
            morningVerify.onclick = () => showVerifyModal(employee, record, 'morning');
        }
        
        // Show ghost notice
        if (record.morning.status === 'present_ghost') {
            morningGhost.classList.remove('hidden');
        }
        
        // Apply status color
        applyStatusColor(morningStatus, record.morning.status);
    }
    
    // Absent day banner (hidden by default, shown when morning is absent)
    const absentBanner = document.createElement('div');
    absentBanner.className = 'absent-day-banner hidden bg-informed-bg border border-informed rounded-lg p-3 mx-4 mb-2 flex items-center gap-2';
    absentBanner.innerHTML = `
        <i data-lucide="user-x" class="w-4 h-4 text-lavender"></i>
        <span class="text-sm text-lavender font-medium">Absent — No standup expected. Evening auto-set.</span>
    `;
    // Insert banner before the evening section
    const eveningSection = cardEl.querySelector('.p-4:last-of-type');
    if (eveningSection) cardEl.insertBefore(absentBanner, eveningSection);
    
    // Show banner if already absent
    if (record?.morning?.status && isFullDayAbsentStatus(record.morning.status)) {
        absentBanner.classList.remove('hidden');
        eveningStatus.disabled = true;
        eveningNotes.disabled = true;
    }
    
    // Morning status change
    morningStatus.addEventListener('change', async (e) => {
        const status = e.target.value;
        const updates = { status };
        
        // Require async content for async statuses
        if (['present_async', 'remote_async_deferred'].includes(status)) {
            morningAsync.classList.remove('hidden');
        } else {
            morningAsync.classList.add('hidden');
        }
        
        // Show verify button for no internet
        if (status === 'absent_no_internet') {
            morningVerify.classList.remove('hidden');
            morningVerify.onclick = () => showVerifyModal(employee, record, 'morning');
        } else {
            morningVerify.classList.add('hidden');
        }
        
        await saveAttendance(employee.id, 'morning', updates);
        applyStatusColor(morningStatus, status);
        
        // Handle full-day absent: auto-set evening to same absent status and lock it
        if (isFullDayAbsentStatus(status)) {
            absentBanner.classList.remove('hidden');
            eveningStatus.value = status;
            eveningStatus.disabled = true;
            eveningNotes.disabled = true;
            applyStatusColor(eveningStatus, status);
            await saveAttendance(employee.id, 'evening', { 
                status: status, 
                notes: record?.morning?.notes || '' 
            });
        } else {
            absentBanner.classList.add('hidden');
            // Enable evening fields now that morning has a status
            eveningStatus.disabled = false;
            eveningNotes.disabled = false;
            // If evening was auto-set to absent but morning changed to present, clear evening
            if (isFullDayAbsentStatus(eveningStatus.value)) {
                eveningStatus.value = '';
                eveningNotes.value = '';
                await saveAttendance(employee.id, 'evening', { status: '', notes: '' });
                applyStatusColor(eveningStatus, '');
            }
        }
        
        updateInsights();
    });
    
    // Morning notes (debounced)
    const debouncedMorningSave = debounce(async (notes) => {
        await saveAttendance(employee.id, 'morning', { notes });
    });
    morningNotes.addEventListener('input', (e) => debouncedMorningSave(e.target.value));
    morningNotes.addEventListener('blur', async (e) => {
        await saveAttendance(employee.id, 'morning', { notes: e.target.value });
    });
    
    // Morning async fields
    card.querySelector('.morning-source').addEventListener('change', async (e) => {
        await saveAttendance(employee.id, 'morning', { proof_source: e.target.value });
    });
    
    card.querySelector('.morning-content').addEventListener('blur', async (e) => {
        await saveAttendance(employee.id, 'morning', { async_content: e.target.value });
    });
    
    // Evening section
    const eveningStatus = card.querySelector('.evening-status');
    const eveningNotes = card.querySelector('.evening-notes');
    const eveningTime = card.querySelector('.evening-time');
    const eveningAsync = card.querySelector('.evening-async');
    const eveningLag = card.querySelector('.evening-lag');
    
    // Enable evening only if morning has a non-absent status
    const hasMorning = record?.morning?.status;
    const morningIsAbsent = isFullDayAbsentStatus(record?.morning?.status);
    eveningStatus.disabled = !hasMorning || morningIsAbsent;
    eveningNotes.disabled = !hasMorning || morningIsAbsent;
    
    if (record?.evening) {
        eveningStatus.value = record.evening.status || '';
        eveningNotes.value = record.evening.notes || '';
        eveningTime.textContent = record.evening.timestamp ? formatTime(record.evening.timestamp) : '';
        
        if (record.evening.response_lag_minutes > 0) {
            const hours = Math.floor(record.evening.response_lag_minutes / 60);
            const mins = record.evening.response_lag_minutes % 60;
            eveningLag.textContent = hours > 0 ? `+${hours}h ${mins}m` : `+${mins}m`;
            eveningLag.className = 'evening-lag ml-auto text-xs font-medium text-amber';
        }
        
        if (['present_async', 'remote_async_deferred'].includes(record.evening.status)) {
            eveningAsync.classList.remove('hidden');
            card.querySelector('.evening-source').value = record.evening.proof_source || '';
            card.querySelector('.evening-content').value = record.evening.async_content || '';
        }
        
        applyStatusColor(eveningStatus, record.evening.status);
    }
    
    eveningStatus.addEventListener('change', async (e) => {
        const status = e.target.value;
        
        if (['present_async', 'remote_async_deferred'].includes(status)) {
            eveningAsync.classList.remove('hidden');
        } else {
            eveningAsync.classList.add('hidden');
        }
        
        await saveAttendance(employee.id, 'evening', { status });
        applyStatusColor(eveningStatus, status);
        updateInsights();
    });
    
    eveningNotes.addEventListener('blur', async (e) => {
        await saveAttendance(employee.id, 'evening', { notes: e.target.value });
    });
    
    card.querySelector('.evening-source').addEventListener('change', async (e) => {
        await saveAttendance(employee.id, 'evening', { proof_source: e.target.value });
    });
    
    card.querySelector('.evening-content').addEventListener('blur', async (e) => {
        await saveAttendance(employee.id, 'evening', { async_content: e.target.value });
    });
    
    // Employee menu
    card.querySelector('.employee-menu').addEventListener('click', () => {
        showEmployeeProfile(employee.id);
    });
    
    // Previous history section (last 3 days)
    loadPreviousHistory(cardEl, employee.id);
    
    return cardEl;
}

async function loadPreviousHistory(cardEl, employeeId) {
    const today = new Date(AppState.currentDate + 'T00:00:00');
    const historyDays = [];
    for (let i = 1; i <= 3; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        historyDays.push(formatDate(d));
    }

    const records = await db.attendance_records
        .where('employee_id').equals(employeeId)
        .filter(r => historyDays.includes(r.date))
        .toArray();

    if (records.length === 0) return;

    records.sort((a, b) => b.date.localeCompare(a.date));

    const section = document.createElement('div');
    section.className = 'border-t border-border';
    section.innerHTML = `
        <button class="history-toggle w-full px-4 py-2 flex items-center gap-2 text-xs text-taupe hover:bg-cream/50 transition-colors">
            <i data-lucide="history" class="w-3.5 h-3.5"></i>
            <span>Previous Updates (${records.length} day${records.length > 1 ? 's' : ''})</span>
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 ml-auto history-chevron transition-transform"></i>
        </button>
        <div class="history-content hidden px-4 pb-3 space-y-2">
            ${records.map(r => {
                const mStatus = STATUS_CONFIG[r.morning?.status];
                const eStatus = STATUS_CONFIG[r.evening?.status];
                const mNotes = r.morning?.notes || '';
                const eNotes = r.evening?.notes || '';
                return `
                    <div class="bg-cream/60 border border-border rounded-lg p-2.5 text-xs">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-medium text-slate">${escapeHtml(r.date)}</span>
                            ${mStatus ? `<span class="${mStatus.color} px-1.5 py-0.5 rounded text-[10px] font-bold">${escapeHtml(mStatus.abbr)}</span>` : ''}
                            ${eStatus ? `<span class="${eStatus.color} px-1.5 py-0.5 rounded text-[10px] font-bold">${escapeHtml(eStatus.abbr)}</span>` : ''}
                        </div>
                        ${mNotes ? `<p class="text-taupe"><span class="text-slate font-medium">AM:</span> ${escapeHtml(mNotes)}</p>` : ''}
                        ${eNotes ? `<p class="text-taupe mt-0.5"><span class="text-slate font-medium">PM:</span> ${escapeHtml(eNotes)}</p>` : ''}
                        ${!mNotes && !eNotes ? '<p class="text-taupe italic">No notes recorded</p>' : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;

    section.querySelector('.history-toggle').addEventListener('click', () => {
        const content = section.querySelector('.history-content');
        const chevron = section.querySelector('.history-chevron');
        content.classList.toggle('hidden');
        chevron.style.transform = content.classList.contains('hidden') ? '' : 'rotate(180deg)';
    });

    cardEl.appendChild(section);
    lucide.createIcons();
}

function applyStatusColor(select, status) {
    const config = STATUS_CONFIG[status];
    const baseClass = select.classList.contains('evening-status') ? 'evening-status' : 'morning-status';
    if (config) {
        select.className = `${baseClass} select-field flex-1 min-w-[180px] text-sm ${config.color}`;
    } else {
        select.className = `${baseClass} select-field flex-1 min-w-[180px] text-sm`;
    }
}

async function handleQuickMark(e) {
    const value = e.target.value;
    if (!value) return;
    
    if (value === 'clear') {
        if (!confirm(`Clear ALL attendance records for ${AppState.currentDate}? This cannot be undone.`)) {
            e.target.value = '';
            return;
        }
        for (const employee of AppState.employees) {
            await db.attendance_records.delete([employee.id, AppState.currentDate]);
        }
        showToast('All records cleared', 'info');
    } else {
        for (const employee of AppState.employees) {
            if (!employee.is_active) continue;
            if (employee.standup_exempt) continue;
            await saveAttendance(employee.id, 'morning', { status: value });
        }
        showToast(`All employees marked as ${STATUS_CONFIG[value]?.label || value}`, 'success');
    }
    
    e.target.value = '';
    renderEmployeeList();
    updateInsights();
}

async function copyYesterday() {
    // Find last working day (skip weekends and holidays)
    let checkDate = new Date(AppState.currentDate + 'T00:00:00');
    let lastWorkDay = null;
    for (let i = 1; i <= 7; i++) {
        const d = new Date(checkDate);
        d.setDate(d.getDate() - i);
        const ds = formatDate(d);
        const isOff = await isHoliday(ds);
        if (!isOff) { lastWorkDay = ds; break; }
    }
    
    if (!lastWorkDay) {
        showToast('No working day found in last 7 days', 'warning');
        return;
    }
    
    const prevRecords = await AppState.loadAttendanceForDate(lastWorkDay);
    
    if (Object.keys(prevRecords).length === 0) {
        showToast(`No records from ${lastWorkDay}`, 'warning');
        return;
    }
    
    let copied = 0;
    for (const [employeeId, record] of Object.entries(prevRecords)) {
        const empId = Number(employeeId) || employeeId;
        const emp = AppState.employees.find(e => e.id === empId);
        if (emp?.standup_exempt) continue;
        const existing = await db.attendance_records.get([empId, AppState.currentDate]);
        
        if (!existing) {
            const newRecord = {
                employee_id: empId,
                date: AppState.currentDate,
                morning: { ...record.morning, timestamp: null, response_lag_minutes: 0 },
                evening: { ...record.evening, timestamp: null, response_lag_minutes: 0 },
                audit_trail: [],
                last_modified: new Date().toISOString()
            };
            await db.attendance_records.put(newRecord);
            copied++;
        }
    }
    
    showToast(`Copied ${copied} record(s) from ${lastWorkDay}`, 'success');
    renderEmployeeList();
    updateInsights();
}

async function checkGhosts() {
    const ghosts = await detectAndConvertGhosts(AppState.currentDate);
    
    if (ghosts.length > 0) {
        showToast(`${ghosts.length} ghost promise(s) detected and converted`, 'warning');
        renderEmployeeList();
    } else {
        showToast('No ghost promises found', 'success');
    }
    
    updateInsights();
}

async function updateInsights() {
    const records = await AppState.loadAttendanceForDate(AppState.currentDate);
    const ghosts = await AppState.getGhostPromises(AppState.currentDate);
    const pendingVerifications = await AppState.getPendingVerifications();
    
    // Calculate attendance rate based on active employees who are not standup exempt
    const activeEmployees = AppState.employees.filter(e => e.is_active && !e.standup_exempt);
    const totalExpected = activeEmployees.length; // Total who should have attended today
    let presentCount = 0;
    let absentCount = 0;
    let noRecordCount = 0;
    
    // Count from active employees, not just existing records
    for (const emp of activeEmployees) {
        const r = records[emp.id];
        if (!r || !r.morning?.status) {
            noRecordCount++; // Not yet marked
        } else if (['present_active', 'present_async', 'present_late', 'remote_chat_only', 'remote_async_deferred'].includes(r.morning.status)) {
            presentCount++;
        } else {
            absentCount++; // absent_*, informed_valid, present_ghost
        }
    }
    
    const attendanceRate = totalExpected > 0 ? Math.round((presentCount / totalExpected) * 100) : 0;
    
    // Calculate team trust average
    const avgTrust = activeEmployees.length > 0 
        ? Math.round(activeEmployees.reduce((sum, e) => sum + (e.trust_score || 100), 0) / activeEmployees.length)
        : 100;
    
    // Update UI
    document.getElementById('insightAttendance').textContent = `${attendanceRate}%`;
    document.getElementById('insightAttendance').title = `${presentCount} present, ${absentCount} absent, ${noRecordCount} unmarked out of ${totalExpected}`;
    document.getElementById('insightGhosts').textContent = ghosts.length;
    document.getElementById('insightUnverified').textContent = pendingVerifications.length;
    document.getElementById('insightTrust').textContent = avgTrust;
    
    // Ghost alert
    const ghostAlert = document.getElementById('ghostAlert');
    const ghostAlertText = document.getElementById('ghostAlertText');
    
    if (ghosts.length > 0) {
        ghostAlert.classList.remove('hidden');
        ghostAlertText.textContent = `${ghosts.length} people promised updates but never followed through`;
    } else {
        ghostAlert.classList.add('hidden');
    }
    
    // Update verification badge
    const verifyBadge = document.getElementById('verifyBadge');
    verifyBadge.textContent = pendingVerifications.length;
    verifyBadge.classList.toggle('hidden', pendingVerifications.length === 0);
}

// ============================================
// UI RENDERING - MATRIX
// ============================================

function renderMatrix() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('matrixTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
    
    const monthInput = document.getElementById('matrixMonth');
    monthInput.value = AppState.currentDate.slice(0, 7);
    
    monthInput.addEventListener('change', () => renderMatrixTable());
    document.getElementById('matrixFilter').addEventListener('change', () => renderMatrixTable());
    document.getElementById('matrixExportBtn').addEventListener('click', exportMatrix);
    
    renderMatrixTable();
}

async function renderMatrixTable() {
    const month = document.getElementById('matrixMonth').value;
    const filter = document.getElementById('matrixFilter').value;
    const thead = document.querySelector('#matrixTable thead tr');
    const tbody = document.getElementById('matrixBody');
    
    while (thead.children.length > 1) thead.removeChild(thead.lastChild);
    tbody.innerHTML = '';
    
    if (!month) return;
    
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const th = document.createElement('th');
        th.className = 'px-2 py-3 text-center font-medium text-charcoal border-b border-border min-w-[44px]';
        th.textContent = day;
        thead.appendChild(th);
    }
    
    const startDate = `${month}-01`;
    const endDate = `${month}-${daysInMonth}`;
    
    const records = await db.attendance_records
        .where('date')
        .between(startDate, endDate)
        .toArray();
    
    const byEmployee = {};
    records.forEach(r => {
        if (!byEmployee[r.employee_id]) byEmployee[r.employee_id] = {};
        byEmployee[r.employee_id][r.date] = r;
    });
    
    for (const employee of AppState.employees) {
        if (!employee.is_active) continue;
        if (employee.standup_exempt) continue;
        
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-cream/50';
        
        const nameCell = document.createElement('td');
        nameCell.className = 'sticky left-0 bg-cream px-3 py-2 text-charcoal border-b border-border font-medium text-sm';
        nameCell.textContent = employee.full_name;
        tr.appendChild(nameCell);
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${month}-${String(day).padStart(2, '0')}`;
            const record = byEmployee[employee.id]?.[dateStr];
            
            const td = document.createElement('td');
            td.className = 'px-1 py-1 border-b border-border cursor-pointer hover:opacity-80';
            
            if (record) {
                const mStatus = record.morning?.status;
                const eStatus = record.evening?.status;
                
                if (filter !== 'all') {
                    const shouldShow = (
                        (filter === 'ghosts' && (mStatus === 'present_ghost' || eStatus === 'present_ghost')) ||
                        (filter === 'fakes' && (mStatus === 'absent_fake_excuse' || eStatus === 'absent_fake_excuse')) ||
                        (filter === 'unverified' && (
                            (mStatus === 'absent_no_internet' && record.morning?.verification_status === 'unverified') ||
                            (eStatus === 'absent_no_internet' && record.evening?.verification_status === 'unverified')
                        ))
                    );
                    if (!shouldShow) td.classList.add('opacity-20');
                }
                
                const mConfig = STATUS_CONFIG[mStatus];
                const eConfig = STATUS_CONFIG[eStatus];
                
                // Solid colors for matrix cells (inline styles - Tailwind JIT can't compile arbitrary hex)
                const matrixColors = {
                    'status-present': '#7C9A6B',
                    'status-ghost': '#C17B74',
                    'status-late': '#D4A373',
                    'status-informed': '#8B8BAE',
                    'status-absent': '#9A9590',
                    'status-fake': '#A0524D',
                    'status-async': '#6B8E9B'
                };
                const mBg = mConfig ? (matrixColors[mConfig.color] || '#F7F5F0') : '#F7F5F0';
                const eBg = eConfig ? (matrixColors[eConfig.color] || '#F7F5F0') : '#F7F5F0';
                const mText = mConfig ? '#fff' : '#9A9590';
                const eText = eConfig ? '#fff' : '#9A9590';
                
                td.innerHTML = `
                    <div class="h-10 flex flex-col rounded overflow-hidden">
                        <div class="flex-1 flex items-center justify-center text-xs font-bold" style="background:${mBg};color:${mText}">
                            ${mConfig?.abbr || '-'}
                        </div>
                        <div class="flex-1 flex items-center justify-center text-xs font-bold" style="background:${eBg};color:${eText}">
                            ${eConfig?.abbr || '-'}
                        </div>
                    </div>
                `;
            } else {
                td.innerHTML = `
                    <div class="h-10 flex flex-col rounded overflow-hidden">
                        <div class="flex-1 bg-cream flex items-center justify-center text-xs text-taupe">-</div>
                        <div class="flex-1 bg-cream flex items-center justify-center text-xs text-taupe">-</div>
                    </div>
                `;
            }
            
            tr.appendChild(td);
        }
        
        tbody.appendChild(tr);
    }
}

async function exportMatrix() {
    const month = document.getElementById('matrixMonth').value;
    const [year, monthNum] = month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    
    let csv = 'Employee,';
    for (let day = 1; day <= daysInMonth; day++) csv += `${day},`;
    csv += '\n';
    
    const records = await db.attendance_records
        .where('date')
        .between(`${month}-01`, `${month}-${daysInMonth}`)
        .toArray();
    
    for (const employee of AppState.employees) {
        if (!employee.is_active) continue;
        if (employee.standup_exempt) continue;
        
        csv += `"${employee.full_name}",`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${month}-${String(day).padStart(2, '0')}`;
            const record = records.find(r => r.employee_id === employee.id && r.date === dateStr);
            
            if (record) {
                const m = STATUS_CONFIG[record.morning?.status]?.abbr || '-';
                const e = STATUS_CONFIG[record.evening?.status]?.abbr || '-';
                csv += `"${m}/${e}",`;
            } else {
                csv += '"-",';
            }
        }
        csv += '\n';
    }
    
    downloadFile(csv, `standup-matrix-${month}.csv`, 'text/csv');
    showToast('Matrix exported', 'success');
}

// ============================================
// UI RENDERING - VERIFICATION
// ============================================

async function renderVerification() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('verificationTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
    
    await renderVerificationList();
}

async function renderVerificationList() {
    const list = document.getElementById('verificationList');
    const empty = document.getElementById('emptyVerification');
    const count = document.getElementById('verifyCount');
    
    const pending = await AppState.getPendingVerifications();
    
    count.textContent = `${pending.length} pending`;
    
    if (pending.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    list.innerHTML = '';
    
    for (const record of pending) {
        const employee = await db.employees.get(record.employee_id);
        const session = record.morning?.status === 'absent_no_internet' ? 'morning' : 'evening';
        const claim = record[session]?.notes || 'No internet connection';
        
        const item = document.createElement('div');
        item.className = 'card p-4';
        item.innerHTML = `
            <div class="flex items-start justify-between">
                <div>
                    <h3 class="font-medium text-charcoal">${escapeHtml(employee?.full_name || 'Unknown')}</h3>
                    <p class="text-sm text-taupe mt-1">${escapeHtml(record.date)} - ${escapeHtml(session)}</p>
                    <p class="text-sm text-amber mt-2 font-medium">"${escapeHtml(claim)}"</p>
                </div>
                <div class="flex gap-2">
                    <button class="verify-btn px-3 py-2 bg-sage text-white rounded-lg text-sm hover:opacity-90">Verify</button>
                </div>
            </div>
        `;
        
        item.querySelector('.verify-btn').addEventListener('click', () => {
            showVerifyModal(employee, record, session);
        });
        
        list.appendChild(item);
    }
}

// ============================================
// UI RENDERING - TEAM
// ============================================

function renderTeam() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('teamTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
    
    document.getElementById('addEmployeeBtn').addEventListener('click', showAddEmployeeModal);
    
    const debouncedSearch = debounce(() => renderTeamList(), 250);
    document.getElementById('teamSearch').addEventListener('input', debouncedSearch);
    document.getElementById('showArchived').addEventListener('change', () => renderTeamList());
    
    renderTeamList();
}

async function renderTeamList() {
    const list = document.getElementById('teamList');
    const empty = document.getElementById('emptyTeam');
    const searchInput = document.getElementById('teamSearch');
    const showArchivedCheckbox = document.getElementById('showArchived');
    
    const searchTerm = (searchInput?.value || '').toLowerCase().trim();
    const showArchived = showArchivedCheckbox?.checked || false;
    
    let filtered = AppState.employees.filter(e => {
        if (!showArchived && !e.is_active) return false;
        if (searchTerm) {
            const haystack = `${e.full_name} ${e.role} ${e.team} ${e.email} ${e.slack_handle}`.toLowerCase();
            return haystack.includes(searchTerm);
        }
        return true;
    });
    
    if (!filtered.length) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    
    empty.classList.add('hidden');
    list.innerHTML = '';
    
    for (const employee of filtered) {
        const card = document.createElement('div');
        card.className = `card p-4 flex items-center gap-3 ${!employee.is_active ? 'opacity-60' : ''}`;
        
        const score = employee.trust_score || 100;
        const scoreClass = score >= 80 ? 'trust-high' : score >= 50 ? 'trust-medium' : 'trust-low';
        
        card.innerHTML = `
            <div class="w-12 h-12 bg-slate/20 rounded-full flex items-center justify-center text-lg font-semibold text-slate">
                ${escapeHtml(getInitials(employee.full_name))}
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-medium text-charcoal truncate">${escapeHtml(employee.full_name)} ${!employee.is_active ? '<span class="text-xs text-taupe">(Archived)</span>' : ''}${employee.standup_exempt ? '<span class="text-xs bg-dusty/15 text-dusty px-1.5 py-0.5 rounded ml-1">Standup Exempt</span>' : ''}</h3>
                <p class="text-sm text-taupe">${escapeHtml(employee.role)}</p>
                <div class="flex items-center gap-2 mt-1">
                    <span class="${scoreClass} px-2 py-0.5 rounded text-xs text-white font-medium">Trust: ${score}</span>
                    <span class="text-xs text-taupe">${escapeHtml(employee.team || 'No team')}</span>
                </div>
            </div>
            <div class="flex items-center gap-1">
                <button class="profile-btn p-2 hover:bg-cream rounded-lg transition-colors" title="View profile">
                    <i data-lucide="user" class="w-5 h-5 text-dusty"></i>
                </button>
                <button class="edit-btn p-2 hover:bg-cream rounded-lg transition-colors" title="Edit employee">
                    <i data-lucide="pencil" class="w-5 h-5 text-dusty"></i>
                </button>
                <button class="archive-btn p-2 hover:bg-cream rounded-lg transition-colors" title="${employee.is_active ? 'Archive' : 'Restore'} employee">
                    <i data-lucide="${employee.is_active ? 'archive' : 'archive-restore'}" class="w-5 h-5 text-taupe"></i>
                </button>
            </div>
        `;
        
        card.querySelector('.profile-btn').addEventListener('click', () => {
            showEmployeeProfile(employee.id);
        });

        card.querySelector('.edit-btn').addEventListener('click', () => {
            showEditEmployeeModal(employee.id);
        });

        card.querySelector('.archive-btn').addEventListener('click', async () => {
            const action = employee.is_active ? 'Archive' : 'Restore';
            if (confirm(`${action} ${employee.full_name}?`)) {
                await db.employees.update(employee.id, { is_active: !employee.is_active });
                await AppState.loadEmployees();
                debouncedCloudSync();
                renderTeamList();
                showToast(`Employee ${action.toLowerCase()}d`, 'info');
            }
        });
        
        list.appendChild(card);
    }
    
    lucide.createIcons();
}

// ============================================
// UI RENDERING - REPORTS
// ============================================

function renderReports() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('reportsTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));
    
    const today = new Date();
    document.getElementById('reportEnd').value = formatDate(today);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    document.getElementById('reportStart').value = formatDate(weekAgo);
    
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            const end = new Date();
            let start = new Date();
            
            switch (preset) {
                case 'today': start = end; break;
                case 'yesterday': start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); break;
                case 'week': start.setDate(start.getDate() - 7); break;
                case 'sprint': start.setDate(start.getDate() - 14); break;
                case 'month': start.setMonth(start.getMonth() - 1); break;
            }
            
            document.getElementById('reportStart').value = formatDate(start);
            document.getElementById('reportEnd').value = formatDate(end);
        });
    });
    
    document.getElementById('generateReportBtn').addEventListener('click', generateReport);
}

async function generateReport() {
    const startDate = document.getElementById('reportStart').value;
    const endDate = document.getElementById('reportEnd').value;
    const filter = document.getElementById('reportFilter').value;
    const format = document.querySelector('input[name="format"]:checked').value;
    const detailLevel = document.querySelector('input[name="detailLevel"]:checked')?.value || 'summary';
    
    if (!startDate || !endDate) {
        showToast('Please select date range', 'error');
        return;
    }
    
    let records = await db.attendance_records
        .where('date')
        .between(startDate, endDate)
        .toArray();
    
    // Apply filters
    if (filter === 'problems') {
        records = records.filter(r => 
            r.morning?.status?.includes('absent') || r.morning?.status?.includes('ghost') ||
            r.evening?.status?.includes('absent') || r.evening?.status?.includes('ghost')
        );
    } else if (filter === 'ghosts') {
        records = records.filter(r => r.morning?.status === 'present_ghost' || r.evening?.status === 'present_ghost');
    } else if (filter === 'fakes') {
        records = records.filter(r => r.morning?.status === 'absent_fake_excuse' || r.evening?.status === 'absent_fake_excuse');
    }
    
    switch (format) {
        case 'pdf': await generatePDF(records, startDate, endDate, detailLevel); break;
        case 'confluence': await generateConfluence(records, startDate, endDate); break;
        case 'csv': await generateCSV(records, startDate, endDate); break;
        case 'ghosts': await generateGhostAnalysis(records, startDate, endDate); break;
    }
}

async function generatePDF(records, startDate, endDate, detailLevel = 'summary') {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const employees = await db.employees.toArray();
    const standupParticipants = employees.filter(e => e.is_active && !e.standup_exempt);
    const exemptMembers = employees.filter(e => e.is_active && e.standup_exempt);
    // Filter records to only standup participants for stats
    const standupRecords = records.filter(r => {
        const emp = employees.find(e => e.id === r.employee_id);
        return emp && !emp.standup_exempt;
    });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const statusLabel = (s) => STATUS_CONFIG[s]?.label || s || 'No Response';
    const statusAbbr = (s) => STATUS_CONFIG[s]?.abbr || '-';
    
    // --- COVER PAGE ---
    // Dark header band
    doc.setFillColor(45, 55, 72);
    doc.rect(0, 0, pageWidth, 85, 'F');
    
    // Accent line
    doc.setFillColor(193, 123, 116);
    doc.rect(0, 85, pageWidth, 3, 'F');
    
    // Title text on dark background
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.text('Standup Tracker Pro', pageWidth / 2, 35, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(212, 163, 115);
    doc.text(detailLevel === 'complete' ? 'Comprehensive Team Report' : 'Team Summary Report', pageWidth / 2, 50, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(200, 200, 210);
    doc.text(`${startDate}  to  ${endDate}`, pageWidth / 2, 68, { align: 'center' });
    
    // Info cards below the header
    const infoY = 105;
    const cardW = 80;
    const gap = 10;
    const startX = (pageWidth - (cardW * 2 + gap)) / 2;
    
    // Card backgrounds
    doc.setFillColor(245, 243, 240);
    doc.roundedRect(startX, infoY, cardW, 40, 3, 3, 'F');
    doc.roundedRect(startX + cardW + gap, infoY, cardW, 40, 3, 3, 'F');
    doc.roundedRect(startX, infoY + 50, cardW, 40, 3, 3, 'F');
    doc.roundedRect(startX + cardW + gap, infoY + 50, cardW, 40, 3, 3, 'F');
    
    // Card content
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text('Delivery Lead', startX + cardW / 2, infoY + 12, { align: 'center' });
    doc.text('Team Size', startX + cardW + gap + cardW / 2, infoY + 12, { align: 'center' });
    doc.text('Total Records', startX + cardW / 2, infoY + 62, { align: 'center' });
    doc.text('Generated', startX + cardW + gap + cardW / 2, infoY + 62, { align: 'center' });
    
    doc.setFontSize(13);
    doc.setTextColor(45, 55, 72);
    doc.text(AppState.settings.manager_name || 'Not set', startX + cardW / 2, infoY + 28, { align: 'center' });
    doc.text(`${employees.filter(e => e.is_active).length} Members`, startX + cardW + gap + cardW / 2, infoY + 28, { align: 'center' });
    doc.text(`${records.length}`, startX + cardW / 2, infoY + 78, { align: 'center' });
    doc.text(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), startX + cardW + gap + cardW / 2, infoY + 78, { align: 'center' });
    
    // Standup breakdown line below cards
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${standupParticipants.length} standup participants  \u00B7  ${exemptMembers.length} exempt (${exemptMembers.map(e => e.full_name).join(', ') || 'none'})`, pageWidth / 2, infoY + 100, { align: 'center' });
    
    // Footer on cover
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text('Forensic Attendance System', pageWidth / 2, pageHeight - 20, { align: 'center' });
    
    // --- TEAM STATISTICS PAGE ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(45, 55, 72);
    doc.text('Team Statistics Overview', 14, 20);
    
    // Calculate team-level stats (only for standup participants, not exempt)
    const uniqueDates = [...new Set(standupRecords.map(r => r.date))].sort();
    const totalDays = uniqueDates.length;
    let morningPresent = 0, eveningSubmitted = 0, ghostCount = 0, fakeCount = 0, lateCount = 0;
    let absentFullDay = 0, noInternetCount = 0, noResponseCount = 0, informedValidCount = 0;
    
    for (const r of standupRecords) {
        const ms = r.morning?.status || '';
        if (['present_active', 'present_async', 'present_late', 'remote_chat_only', 'remote_async_deferred'].includes(ms)) morningPresent++;
        if (ms === 'present_ghost') ghostCount++;
        if (ms === 'absent_fake_excuse') fakeCount++;
        if (ms === 'present_late') lateCount++;
        if (ms === 'absent_no_internet') noInternetCount++;
        if (ms === 'absent_no_response') noResponseCount++;
        if (ms === 'informed_valid') informedValidCount++;
        if (isFullDayAbsentStatus(ms)) absentFullDay++;
        
        // Evening: only count evening updates for people who were actually present
        const es = r.evening?.status || '';
        const mFullAbsent = isFullDayAbsentStatus(ms);
        if (es && es !== 'absent_no_response' && !mFullAbsent) eveningSubmitted++;
    }
    
    // Non-absent records = people who were expected to attend standup
    const nonAbsentRecords = standupRecords.length - absentFullDay;
    
    const statsData = [
        ['Tracking Period', `${startDate} to ${endDate}`],
        ['Working Days Tracked', `${totalDays}`],
        ['Standup Participants', `${standupParticipants.length} (${exemptMembers.length} exempt)`],
        ['Total Participant-Day Records', `${standupRecords.length}`],
        ['Days Present (Standup Occurred)', `${morningPresent} out of ${standupRecords.length} (${standupRecords.length ? Math.round(morningPresent / standupRecords.length * 100) : 0}%)`],
        ['Days Absent (Full Day)', `${absentFullDay} out of ${standupRecords.length} (${standupRecords.length ? Math.round(absentFullDay / standupRecords.length * 100) : 0}%)`],
        ['Evening Updates (Present Days)', `${eveningSubmitted} out of ${nonAbsentRecords > 0 ? nonAbsentRecords : 0} (${nonAbsentRecords > 0 ? Math.round(eveningSubmitted / nonAbsentRecords * 100) : 0}%)`],
        ['Ghost Promises', `${ghostCount}`],
        ['Fake Excuses', `${fakeCount}`],
        ['Late Arrivals', `${lateCount}`],
        ['No Internet Claims', `${noInternetCount}`],
        ['No Response (Uncontacted)', `${noResponseCount}`],
        ['Informed Valid Leaves', `${informedValidCount}`]
    ];
    
    doc.autoTable({
        startY: 30,
        head: [['Metric', 'Value']],
        body: statsData,
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [45, 55, 72], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } }
    });
    
    // --- PER-EMPLOYEE SUMMARY TABLE ---
    doc.addPage();
    doc.setFontSize(16);
    doc.setTextColor(45, 55, 72);
    doc.text('Employee Summary', 14, 20);
    
    const empSummaryData = [];
    for (const emp of employees) {
        if (!emp.is_active) continue;
        
        if (emp.standup_exempt) {
            empSummaryData.push([
                emp.full_name,
                emp.role || '-',
                'Exempt',
                '-',
                '-',
                '-',
                '-'
            ]);
            continue;
        }
        
        const empRecords = records.filter(r => r.employee_id === emp.id);
        const mPresent = empRecords.filter(r => {
            const ms = r.morning?.status || '';
            return ['present_active', 'present_async', 'present_late', 'remote_chat_only', 'remote_async_deferred'].includes(ms);
        }).length;
        const empAbsent = empRecords.filter(r => isFullDayAbsentStatus(r.morning?.status || '')).length;
        const empPresentDays = empRecords.length - empAbsent;
        const eSub = empRecords.filter(r => {
            const ms = r.morning?.status || '';
            if (isFullDayAbsentStatus(ms)) return false;
            const es = r.evening?.status || '';
            return es && es !== 'absent_no_response';
        }).length;
        const ghosts = empRecords.filter(r => r.morning?.status === 'present_ghost').length;
        
        empSummaryData.push([
            emp.full_name,
            emp.role || '-',
            `${mPresent}/${totalDays} (${totalDays ? Math.round(mPresent / totalDays * 100) : 0}%)`,
            `${empAbsent}d`,
            `${eSub}/${empPresentDays > 0 ? empPresentDays : 0}`,
            `${ghosts}`,
            `${emp.trust_score || 100}`
        ]);
    }
    
    doc.autoTable({
        startY: 30,
        head: [['Name', 'Role', 'Attendance', 'Absent', 'Eve. Updates', 'Ghosts', 'Trust']],
        body: empSummaryData,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [45, 55, 72], textColor: 255 },
        columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 28 },
            2: { cellWidth: 28 },
            3: { cellWidth: 16 },
            4: { cellWidth: 25 },
            5: { cellWidth: 16 },
            6: { cellWidth: 16 }
        }
    });
    
    if (detailLevel === 'summary') {
        // --- SUMMARY MODE: Compact daily table ---
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(45, 55, 72);
        doc.text('Daily Records', 14, 20);
        
        const tableData = [];
        for (const record of records) {
            const employee = employees.find(e => e.id === record.employee_id);
            const morningStatus = statusLabel(record.morning?.status);
            const eveningStatus = statusLabel(record.evening?.status);
            const morningNotes = record.morning?.notes?.trim() || 'Not mentioned';
            const eveningNotes = record.evening?.notes?.trim() || 'Not mentioned';
            const combinedNotes = `AM: ${morningNotes}\nPM: ${eveningNotes}`;
            
            // Build reason/verification column
            let reasonCol = '-';
            const mAbsent = record.morning?.status?.startsWith('absent_');
            const eAbsent = record.evening?.status?.startsWith('absent_');
            const mGhost = record.morning?.status === 'present_ghost';
            const eGhost = record.evening?.status === 'present_ghost';
            if (mAbsent || eAbsent || mGhost || eGhost) {
                const parts = [];
                if (mAbsent) {
                    const vs = record.morning?.verification_status;
                    const tag = vs === 'verified_legit' ? 'LEGIT' : vs === 'verified_fake' ? 'FAKE' : 'PENDING';
                    parts.push(`AM: ${morningNotes} [${tag}]`);
                }
                if (eAbsent) {
                    const vs = record.evening?.verification_status;
                    const tag = vs === 'verified_legit' ? 'LEGIT' : vs === 'verified_fake' ? 'FAKE' : 'PENDING';
                    parts.push(`PM: ${eveningNotes} [${tag}]`);
                }
                if (mGhost) parts.push(`AM: Ghost promise`);
                if (eGhost) parts.push(`PM: Ghost promise`);
                reasonCol = parts.join('\n');
            }
            
            tableData.push([
                record.date,
                employee?.full_name || 'Unknown',
                morningStatus,
                eveningStatus,
                combinedNotes,
                reasonCol
            ]);
        }
        
        doc.autoTable({
            startY: 30,
            head: [['Date', 'Name', 'Morning', 'Evening', 'Notes', 'Absence Reason & Verification']],
            body: tableData,
            styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak' },
            headStyles: { fillColor: [45, 55, 72], textColor: 255, fontSize: 7 },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 24 },
                2: { cellWidth: 20 },
                3: { cellWidth: 20 },
                4: { cellWidth: 48 },
                5: { cellWidth: 'auto' }
            },
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 5) {
                    const val = data.cell.raw || '';
                    if (val.includes('FAKE')) data.cell.styles.textColor = [160, 82, 77];
                    else if (val.includes('Ghost')) data.cell.styles.textColor = [193, 123, 116];
                    else if (val.includes('PENDING')) data.cell.styles.textColor = [212, 163, 115];
                }
            }
        });
    } else {
        // --- COMPLETE MODE: Full per-employee individual reports ---
        
        // Helper: build detailed session info string
        const sessionDetail = (session, label) => {
            if (!session || !session.status) return `${label}: No record`;
            const lines = [];
            lines.push(`Status: ${statusLabel(session.status)}`);
            
            // Timestamp
            if (session.timestamp) {
                lines.push(`Time: ${new Date(session.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, day: '2-digit', month: 'short' })}`);
            }
            
            // Response lag
            if (session.response_lag_minutes > 0) {
                const lagH = Math.floor(session.response_lag_minutes / 60);
                const lagM = session.response_lag_minutes % 60;
                lines.push(`Response Lag: ${lagH > 0 ? lagH + 'h ' : ''}${lagM}m after standup`);
            }
            
            // Reason / Notes
            const reason = session.notes?.trim();
            lines.push(`Reason/Notes: ${reason || 'Not mentioned'}`);
            
            // Async proof content
            if (session.async_content?.trim()) {
                lines.push(`Async Update: ${session.async_content.trim()}`);
            }
            if (session.proof_source && session.proof_source !== 'none') {
                const sourceLabels = { slack_thread: 'Slack Thread', teams_chat: 'Teams Chat', email: 'Email', ticket_update: 'Ticket Update' };
                lines.push(`Proof Source: ${sourceLabels[session.proof_source] || session.proof_source}`);
            }
            
            // Verification details for absence claims
            const vs = session.verification_status;
            if (session.status?.startsWith('absent_') || vs === 'verified_legit' || vs === 'verified_fake') {
                const verifyLabels = { unverified: 'Unverified (Pending)', verified_legit: 'Verified - Legitimate', verified_fake: 'Verified - FAKE' };
                lines.push(`Verification: ${verifyLabels[vs] || vs || 'Unverified (Pending)'}`);
                if (session.verification_notes?.trim()) {
                    lines.push(`Verification Notes: ${session.verification_notes.trim()}`);
                }
                if (session.verified_by) {
                    lines.push(`Verified By: ${session.verified_by}${session.verified_at ? ' on ' + new Date(session.verified_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}`);
                }
            }
            
            // Ghost promise details
            if (session.status === 'present_ghost' && session.ghost_promise) {
                const gp = session.ghost_promise;
                lines.push(`Ghost Promise: Made at ${gp.made_at ? new Date(gp.made_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'Unknown'}, Lag: ${gp.lag_hours || 0}h, Fulfilled: ${gp.fulfilled ? 'Yes' : 'No'}`);
            }
            
            return lines.join('\n');
        };
        
        for (const emp of employees) {
            if (!emp.is_active) continue;
            
            const empRecords = records.filter(r => r.employee_id === emp.id).sort((a, b) => a.date.localeCompare(b.date));
            
            doc.addPage();
            
            // Employee header band
            doc.setFillColor(45, 55, 72);
            doc.rect(0, 0, pageWidth, 40, 'F');
            doc.setFillColor(107, 142, 155);
            doc.rect(0, 40, pageWidth, 2, 'F');
            
            doc.setFontSize(18);
            doc.setTextColor(255, 255, 255);
            doc.text(emp.full_name, 14, 18);
            doc.setFontSize(10);
            doc.setTextColor(200, 210, 220);
            const headerInfo = `${emp.role || '-'}  |  Team: ${emp.team || '-'}${emp.standup_exempt ? '  |  STANDUP EXEMPT' : `  |  Trust Score: ${emp.trust_score || 100}`}`;
            doc.text(headerInfo, 14, 28);
            if (emp.email || emp.slack_handle) {
                const contactParts = [];
                if (emp.email) contactParts.push(`Email: ${emp.email}`);
                if (emp.slack_handle) contactParts.push(`Slack: ${emp.slack_handle}`);
                doc.setTextColor(180, 190, 200);
                doc.text(contactParts.join('  |  '), 14, 36);
            }
            
            // If exempt, show a brief note and skip standup details
            if (emp.standup_exempt) {
                doc.setFontSize(11);
                doc.setTextColor(120);
                doc.text('This team member is exempt from daily standup updates.', 14, 55);
                doc.text('No attendance or standup records are tracked for this person.', 14, 65);
                continue;
            }
            
            // Individual stats — expanded
            const PARTICIPATED = ['present_active', 'present_async', 'present_late', 'remote_chat_only', 'remote_async_deferred'];
            const mPresent = empRecords.filter(r => PARTICIPATED.includes(r.morning?.status)).length;
            const eSub = empRecords.filter(r => PARTICIPATED.includes(r.evening?.status)).length;
            const ghosts = empRecords.filter(r => r.morning?.status === 'present_ghost').length;
            const fakes = empRecords.filter(r => r.morning?.status === 'absent_fake_excuse' || r.evening?.status === 'absent_fake_excuse').length;
            const lates = empRecords.filter(r => r.morning?.status === 'present_late').length;
            const noResponses = empRecords.filter(r => r.morning?.status === 'absent_no_response').length;
            const noInternet = empRecords.filter(r => r.morning?.status === 'absent_no_internet' || r.evening?.status === 'absent_no_internet').length;
            const unverified = empRecords.filter(r => 
                (r.morning?.status?.startsWith('absent_') && r.morning?.verification_status === 'unverified') ||
                (r.evening?.status?.startsWith('absent_') && r.evening?.verification_status === 'unverified')
            ).length;
            const verifiedLegit = empRecords.filter(r =>
                r.morning?.verification_status === 'verified_legit' || r.evening?.verification_status === 'verified_legit'
            ).length;
            const verifiedFake = empRecords.filter(r =>
                r.morning?.verification_status === 'verified_fake' || r.evening?.verification_status === 'verified_fake'
            ).length;
            
            // Compute average lag
            let totalLag = 0, lagEntries = 0;
            empRecords.forEach(r => {
                ['morning', 'evening'].forEach(s => {
                    const lag = r[s]?.response_lag_minutes;
                    if (lag > 0 && lag <= 480) { totalLag += lag; lagEntries++; }
                });
            });
            const avgLag = lagEntries > 0 ? Math.round(totalLag / lagEntries) : 0;
            
            const empStatsData = [
                ['Days Tracked', `${totalDays}`],
                ['Morning Present', `${mPresent}/${totalDays} (${totalDays ? Math.round(mPresent / totalDays * 100) : 0}%)`],
                ['Evening Updates', `${eSub}/${totalDays} (${totalDays ? Math.round(eSub / totalDays * 100) : 0}%)`],
                ['Avg Response Lag', avgLag > 0 ? `${Math.floor(avgLag / 60) > 0 ? Math.floor(avgLag / 60) + 'h ' : ''}${avgLag % 60}m` : 'On time'],
                ['Ghost Promises', `${ghosts}`],
                ['Fake Excuses', `${fakes}`],
                ['Late Arrivals', `${lates}`],
                ['No Response', `${noResponses}`],
                ['No Internet Claims', `${noInternet}`],
                ['Verifications — Legit', `${verifiedLegit}`],
                ['Verifications — Fake', `${verifiedFake}`],
                ['Verifications — Pending', `${unverified}`]
            ];
            
            doc.autoTable({
                startY: 48,
                head: [['Metric', 'Value']],
                body: empStatsData,
                styles: { fontSize: 8, cellPadding: 3 },
                headStyles: { fillColor: [107, 142, 155], textColor: 255 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55 } },
                tableWidth: 130
            });
            
            // Daily records — FULL DETAIL (one row per day, expanded session info)
            if (empRecords.length > 0) {
                const dailyData = [];
                for (const r of empRecords) {
                    const morningDetail = sessionDetail(r.morning, 'Morning');
                    const eveningDetail = sessionDetail(r.evening, 'Evening');
                    
                    // Absence reason summary column
                    let absenceReason = '-';
                    const mAbsent = r.morning?.status?.startsWith('absent_');
                    const eAbsent = r.evening?.status?.startsWith('absent_');
                    if (mAbsent || eAbsent) {
                        const parts = [];
                        if (mAbsent) {
                            const reason = r.morning?.notes?.trim() || 'Not mentioned';
                            const vs = r.morning?.verification_status;
                            const verifyTag = vs === 'verified_legit' ? ' [LEGIT]' : vs === 'verified_fake' ? ' [FAKE]' : ' [PENDING]';
                            parts.push(`AM: ${reason}${verifyTag}`);
                        }
                        if (eAbsent) {
                            const reason = r.evening?.notes?.trim() || 'Not mentioned';
                            const vs = r.evening?.verification_status;
                            const verifyTag = vs === 'verified_legit' ? ' [LEGIT]' : vs === 'verified_fake' ? ' [FAKE]' : ' [PENDING]';
                            parts.push(`PM: ${reason}${verifyTag}`);
                        }
                        absenceReason = parts.join('\n');
                    }
                    
                    // Ghost reason
                    if (r.morning?.status === 'present_ghost' || r.evening?.status === 'present_ghost') {
                        const ghostParts = [];
                        if (r.morning?.status === 'present_ghost') {
                            const original = r.morning?.notes?.trim() || 'Not mentioned';
                            ghostParts.push(`AM Ghost: Promised "${original}" but never delivered`);
                        }
                        if (r.evening?.status === 'present_ghost') {
                            const original = r.evening?.notes?.trim() || 'Not mentioned';
                            ghostParts.push(`PM Ghost: Promised "${original}" but never delivered`);
                        }
                        absenceReason = absenceReason === '-' ? ghostParts.join('\n') : absenceReason + '\n' + ghostParts.join('\n');
                    }
                    
                    dailyData.push([
                        r.date,
                        morningDetail,
                        eveningDetail,
                        absenceReason
                    ]);
                }
                
                doc.autoTable({
                    startY: doc.lastAutoTable.finalY + 8,
                    head: [['Date', 'Morning Session', 'Evening Session', 'Absence Reason & Verification']],
                    body: dailyData,
                    styles: { fontSize: 6.5, cellPadding: 3, overflow: 'linebreak', minCellHeight: 14 },
                    headStyles: { fillColor: [45, 55, 72], textColor: 255, fontSize: 7 },
                    columnStyles: {
                        0: { cellWidth: 18, fontStyle: 'bold' },
                        1: { cellWidth: 55 },
                        2: { cellWidth: 55 },
                        3: { cellWidth: 52 }
                    },
                    didParseCell: function(data) {
                        // Highlight absence/ghost/fake rows
                        if (data.section === 'body' && data.column.index === 3) {
                            const val = data.cell.raw || '';
                            if (val.includes('[FAKE]')) {
                                data.cell.styles.textColor = [160, 82, 77];
                                data.cell.styles.fontStyle = 'bold';
                            } else if (val.includes('Ghost')) {
                                data.cell.styles.textColor = [193, 123, 116];
                            } else if (val.includes('[PENDING]')) {
                                data.cell.styles.textColor = [212, 163, 115];
                            }
                        }
                    }
                });
                
                // --- ABSENCE & ISSUE SUMMARY for this employee ---
                const absentRecords = empRecords.filter(r =>
                    r.morning?.status?.startsWith('absent_') || r.evening?.status?.startsWith('absent_') ||
                    r.morning?.status === 'present_ghost' || r.evening?.status === 'present_ghost'
                );
                
                if (absentRecords.length > 0) {
                    const issueRows = [];
                    for (const r of absentRecords) {
                        for (const session of ['morning', 'evening']) {
                            const s = r[session];
                            if (!s?.status) continue;
                            const isAbsent = s.status.startsWith('absent_');
                            const isGhost = s.status === 'present_ghost';
                            if (!isAbsent && !isGhost) continue;
                            
                            const reason = s.notes?.trim() || 'Not mentioned';
                            const vs = s.verification_status;
                            const verifyLabel = vs === 'verified_legit' ? 'Legitimate' : vs === 'verified_fake' ? 'FAKE' : 'Pending';
                            const verifiedBy = s.verified_by || '-';
                            const verifyNotes = s.verification_notes?.trim() || 'Not mentioned';
                            
                            issueRows.push([
                                r.date,
                                session === 'morning' ? 'AM' : 'PM',
                                statusLabel(s.status),
                                reason,
                                isGhost ? 'N/A' : verifyLabel,
                                isGhost ? 'N/A' : verifiedBy,
                                isGhost ? (s.ghost_promise ? `Lag: ${s.ghost_promise.lag_hours || 0}h` : '-') : verifyNotes
                            ]);
                        }
                    }
                    
                    if (issueRows.length > 0) {
                        doc.autoTable({
                            startY: doc.lastAutoTable.finalY + 8,
                            head: [['Date', 'Sess.', 'Issue Type', 'Reason Given', 'Verification', 'Verified By', 'Verification Notes']],
                            body: issueRows,
                            styles: { fontSize: 6, cellPadding: 2.5, overflow: 'linebreak', minCellHeight: 10 },
                            headStyles: { fillColor: [160, 82, 77], textColor: 255, fontSize: 6.5 },
                            columnStyles: {
                                0: { cellWidth: 18 },
                                1: { cellWidth: 10 },
                                2: { cellWidth: 22 },
                                3: { cellWidth: 40 },
                                4: { cellWidth: 22 },
                                5: { cellWidth: 22 },
                                6: { cellWidth: 'auto' }
                            },
                            didParseCell: function(data) {
                                if (data.section === 'body' && data.column.index === 4) {
                                    const val = data.cell.raw || '';
                                    if (val === 'FAKE') data.cell.styles.textColor = [160, 82, 77];
                                    else if (val === 'Pending') data.cell.styles.textColor = [212, 163, 115];
                                    else if (val === 'Legitimate') data.cell.styles.textColor = [124, 154, 107];
                                }
                            }
                        });
                    }
                }
                
            } else {
                doc.setFontSize(10);
                doc.setTextColor(150);
                doc.text('No attendance records in this period.', 14, doc.lastAutoTable.finalY + 15);
            }
        }
        
        // --- TEAM ABSENCE & VERIFICATION OVERVIEW (after all employees) ---
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(45, 55, 72);
        doc.text('Team Absence & Verification Overview', 14, 20);
        
        const teamAbsenceRows = [];
        for (const r of records) {
            const emp = employees.find(e => e.id === r.employee_id);
            for (const session of ['morning', 'evening']) {
                const s = r[session];
                if (!s?.status) continue;
                const isAbsent = s.status.startsWith('absent_');
                const isGhost = s.status === 'present_ghost';
                if (!isAbsent && !isGhost) continue;
                
                const reason = s.notes?.trim() || 'Not mentioned';
                const vs = s.verification_status;
                const verifyLabel = vs === 'verified_legit' ? 'Legitimate' : vs === 'verified_fake' ? 'FAKE' : 'Pending';
                
                teamAbsenceRows.push([
                    r.date,
                    emp?.full_name || 'Unknown',
                    session === 'morning' ? 'AM' : 'PM',
                    statusLabel(s.status),
                    reason,
                    isGhost ? 'N/A' : verifyLabel,
                    isGhost ? (s.ghost_promise ? `Lag: ${s.ghost_promise.lag_hours || 0}h` : '-') : (s.verification_notes?.trim() || 'Not mentioned')
                ]);
            }
        }
        
        if (teamAbsenceRows.length > 0) {
            teamAbsenceRows.sort((a, b) => a[0].localeCompare(b[0]));
            
            doc.autoTable({
                startY: 28,
                head: [['Date', 'Employee', 'Sess.', 'Issue', 'Reason Given', 'Verification', 'Notes']],
                body: teamAbsenceRows,
                styles: { fontSize: 6.5, cellPadding: 2.5, overflow: 'linebreak', minCellHeight: 10 },
                headStyles: { fillColor: [160, 82, 77], textColor: 255, fontSize: 7 },
                columnStyles: {
                    0: { cellWidth: 18 },
                    1: { cellWidth: 28 },
                    2: { cellWidth: 10 },
                    3: { cellWidth: 22 },
                    4: { cellWidth: 38 },
                    5: { cellWidth: 22 },
                    6: { cellWidth: 'auto' }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        const val = data.cell.raw || '';
                        if (val === 'FAKE') data.cell.styles.textColor = [160, 82, 77];
                        else if (val === 'Pending') data.cell.styles.textColor = [212, 163, 115];
                        else if (val === 'Legitimate') data.cell.styles.textColor = [124, 154, 107];
                    }
                }
            });
        } else {
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text('No absences, ghost promises, or issues found in this period.', 14, 35);
        }
    }
    
    // --- EXEMPT TEAM MEMBERS PAGE (if any) ---
    if (exemptMembers.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(45, 55, 72);
        doc.text('Standup Exempt Team Members', 14, 20);
        
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text('These team members are not required to participate in daily standups.', 14, 28);
        
        const exemptData = exemptMembers.map(e => [
            e.full_name,
            e.role || '-',
            e.team || '-',
            e.email || '-'
        ]);
        
        doc.autoTable({
            startY: 35,
            head: [['Name', 'Role', 'Team', 'Email']],
            body: exemptData,
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [130, 130, 150], textColor: 255 },
            columnStyles: { 0: { fontStyle: 'bold' } }
        });
    }
    
    // Add page numbers
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth - 30, pageHeight - 10);
        doc.text('Standup Tracker Pro', 14, pageHeight - 10);
    }
    
    doc.save(`standup-report-${startDate}-to-${endDate}.pdf`);
    showToast('PDF report downloaded', 'success');
}

async function generateConfluence(records, startDate, endDate) {
    let content = `h1. Standup Report: ${startDate} to ${endDate}\n\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    
    content += '|| Date || Name || M || E || Status || Notes ||\n';
    
    for (const record of records) {
        const employee = await db.employees.get(record.employee_id);
        const m = STATUS_CONFIG[record.morning?.status]?.abbr || '-';
        const e = STATUS_CONFIG[record.evening?.status]?.abbr || '-';
        const status = record.morning?.status === 'present_ghost' ? 'Ghost Promise' : 
                      record.morning?.status === 'absent_fake_excuse' ? 'Fake Excuse' : 'Clean';
        const notes = (record.morning?.notes || '').replace(/\|/g, '\\|');
        const eNotes = (record.evening?.notes || '').replace(/\|/g, '\\|');
        const combinedNotes = eNotes ? `AM: ${notes} / PM: ${eNotes}` : notes;
        
        content += `| ${record.date} | ${employee?.full_name || 'Unknown'} | ${m} | ${e} | ${status} | ${combinedNotes} |\n`;
    }
    
    downloadFile(content, `standup-confluence-${startDate}.txt`, 'text/plain');
    showToast('Confluence export downloaded', 'success');
}

async function generateCSV(records, startDate, endDate) {
    let csv = 'Date,Employee,Morning Status,Evening Status,Morning Notes,Evening Notes,Verification Status\n';
    
    for (const record of records) {
        const employee = await db.employees.get(record.employee_id);
        csv += `"${record.date}","${employee?.full_name || 'Unknown'}","${record.morning?.status || ''}","${record.evening?.status || ''}","${(record.morning?.notes || '').replace(/"/g, '""')}","${(record.evening?.notes || '').replace(/"/g, '""')}","${record.morning?.verification_status || ''}"\n`;
    }
    
    downloadFile(csv, `standup-report-${startDate}.csv`, 'text/csv');
    showToast('CSV export downloaded', 'success');
}

async function generateGhostAnalysis(records, startDate, endDate) {
    const ghostRecords = records.filter(r => 
        r.morning?.status === 'present_ghost' || r.evening?.status === 'present_ghost'
    );
    
    let content = `GHOST PROMISE ANALYSIS\n`;
    content += `Period: ${startDate} to ${endDate}\n`;
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += `Total Ghost Promises: ${ghostRecords.length}\n\n`;
    
    content += 'Date,Name,Session,Lag Hours\n';
    
    for (const record of ghostRecords) {
        const employee = await db.employees.get(record.employee_id);
        if (record.morning?.status === 'present_ghost') {
            const lag = record.morning?.ghost_promise?.lag_hours || 0;
            content += `${record.date},${employee?.full_name || 'Unknown'},Morning,${lag}\n`;
        }
        if (record.evening?.status === 'present_ghost') {
            const lag = record.evening?.ghost_promise?.lag_hours || 0;
            content += `${record.date},${employee?.full_name || 'Unknown'},Evening,${lag}\n`;
        }
    }
    
    downloadFile(content, `ghost-analysis-${startDate}.txt`, 'text/plain');
    showToast('Ghost analysis downloaded', 'success');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ============================================
// CLOUD SYNC
// ============================================

async function syncToCloud() {
    if (!AuthState.isAuthenticated()) return;

    try {
        updateSyncIndicator('pending');

        const employees = await db.employees.toArray();
        const attendance_records = await db.attendance_records.toArray();
        const settings = await db.app_settings.get('main');
        const holidays = await db.holidays.toArray();

        await apiCall('/sync/push', {
            method: 'POST',
            body: JSON.stringify({ employees, attendance_records, settings, holidays })
        });

        // Update last sync time
        await db.app_settings.update('main', { last_cloud_sync: new Date().toISOString() });
        updateSyncIndicator('synced');
    } catch (err) {
        console.error('Cloud sync failed:', err);
        updateSyncIndicator('offline');
    }
}

async function syncFromCloud() {
    if (!AuthState.isAuthenticated()) return;

    try {
        updateSyncIndicator('pending');

        const data = await apiCall('/sync/pull');

        // Only replace local data if cloud has data
        if (data.employees?.length || data.attendance_records?.length || data.holidays?.length) {
            if (data.employees?.length) {
                await db.employees.clear();
                await db.employees.bulkAdd(data.employees);
            }
            if (data.attendance_records?.length) {
                await db.attendance_records.clear();
                await db.attendance_records.bulkAdd(data.attendance_records);
            }
            if (data.settings) {
                const existing = await db.app_settings.get('main') || {};
                await db.app_settings.put({ ...existing, ...data.settings, key: 'main' });
            }
            if (data.holidays?.length) {
                await db.holidays.clear();
                await db.holidays.bulkAdd(data.holidays);
            }

            await AppState.loadEmployees();
            await AppState.loadSettings();
            await AppState.loadAttendanceForDate(AppState.currentDate);

            showToast('Data synced from cloud', 'success');
            if (AppState.currentScreen === 'dashboard') renderDashboard();
        }

        await db.app_settings.update('main', { last_cloud_sync: new Date().toISOString() });
        updateSyncIndicator('synced');
    } catch (err) {
        console.error('Pull from cloud failed:', err);
        showToast('Cloud sync failed', 'error');
        updateSyncIndicator('offline');
    }
}

const debouncedCloudSync = debounce(syncToCloud, 5000);

// ============================================
// GEMINI AI INTEGRATION
// ============================================

async function getGeminiApiKey() {
    const settings = await db.app_settings.get('main');
    return settings?.gemini_api_key || '';
}

async function analyzeWithGemini(employeeId) {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        showToast('Please add your Gemini API key in Settings first', 'warning');
        return null;
    }

    const employee = await db.employees.get(employeeId);
    if (!employee) return null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const records = await db.attendance_records
        .where('employee_id')
        .equals(employeeId)
        .filter(r => r.date >= formatDate(thirtyDaysAgo))
        .toArray();

    records.sort((a, b) => b.date.localeCompare(a.date));

    const employeeData = {
        name: employee.full_name,
        role: employee.role,
        team: employee.team,
        trust_score: employee.trust_score,
        total_days_tracked: records.length,
        records: records.map(r => ({
            date: r.date,
            morning_status: STATUS_CONFIG[r.morning?.status]?.label || 'Not recorded',
            morning_notes: r.morning?.notes || '',
            evening_status: STATUS_CONFIG[r.evening?.status]?.label || 'Not recorded',
            evening_notes: r.evening?.notes || '',
            lag_minutes: r.morning?.response_lag_minutes || 0
        }))
    };

    try {
        const data = await apiCall('/ai/analyze', {
            method: 'POST',
            body: JSON.stringify({ apiKey, employeeData })
        });
        return data.analysis;
    } catch (err) {
        showToast('AI analysis failed: ' + err.message, 'error');
        return null;
    }
}

// ============================================
// AI-READY DATA EXPORT
// ============================================

// Build team data payload for AI queries
async function buildTeamDataForAI(daysBack = 7) {
    const employees = await db.employees.toArray();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = formatDate(cutoff);

    const allRecords = await db.attendance_records
        .filter(r => r.date >= cutoffStr)
        .toArray();

    return {
        today: AppState.currentDate,
        manager: AppState.settings.manager_name || 'Manager',
        schedule: {
            morning_standup: '10:00 AM - 10:30 AM IST',
            evening_update: '6:30 PM - 7:00 PM IST',
            friday_weekly_review: '4:30 PM - 6:00 PM IST (Fridays)'
        },
        employees: employees.filter(e => e.is_active && !e.standup_exempt).map(emp => {
            const empRecords = allRecords
                .filter(r => r.employee_id === emp.id)
                .sort((a, b) => b.date.localeCompare(a.date));

            return {
                name: emp.full_name,
                role: emp.role,
                team: emp.team,
                trust: emp.trust_score,
                records: empRecords.map(r => {
                    const rec = { d: r.date };
                    if (r.morning?.status) rec.ms = STATUS_CONFIG[r.morning.status]?.label || r.morning.status;
                    if (r.morning?.notes) rec.mn = r.morning.notes;
                    if (r.morning?.response_lag_minutes) rec.lag = r.morning.response_lag_minutes;
                    if (r.evening?.status) rec.es = STATUS_CONFIG[r.evening.status]?.label || r.evening.status;
                    if (r.evening?.notes) rec.en = r.evening.notes;
                    if (r.morning?.status === 'present_ghost') rec.ghost = true;
                    if (r.morning?.status === 'absent_fake_excuse') rec.fake = true;
                    return rec;
                })
            };
        })
    };
}

// Build data for a single employee
async function buildEmployeeDataForAI(employeeId, daysBack = 14) {
    const employee = await db.employees.get(employeeId);
    if (!employee) return null;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);

    const records = await db.attendance_records
        .where('employee_id').equals(employeeId)
        .filter(r => r.date >= formatDate(cutoff))
        .toArray();

    records.sort((a, b) => b.date.localeCompare(a.date));

    return {
        name: employee.full_name,
        role: employee.role,
        team: employee.team,
        trust_score: employee.trust_score,
        records: records.map(r => ({
            date: r.date,
            morning_status: STATUS_CONFIG[r.morning?.status]?.label || 'Not recorded',
            morning_notes: r.morning?.notes || '',
            morning_async: r.morning?.async_content || '',
            evening_status: STATUS_CONFIG[r.evening?.status]?.label || 'Not recorded',
            evening_notes: r.evening?.notes || '',
            evening_async: r.evening?.async_content || '',
            is_ghost: r.morning?.status === 'present_ghost',
            is_fake: r.morning?.status === 'absent_fake_excuse'
        }))
    };
}

// Send query to AI chat endpoint
async function askAI(question, teamData, mode = 'chat') {
    const apiKey = await getGeminiApiKey();
    if (!apiKey) {
        showToast('Please add your Gemini API key in Settings first', 'warning');
        return null;
    }

    const data = await apiCall('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ apiKey, question, teamData, mode })
    });

    return data.response;
}

// ============================================
// AI ASSISTANT SCREEN
// ============================================

function renderAIAssistant() {
    const mainContent = document.getElementById('mainContent');
    const template = document.getElementById('aiAssistantTemplate');
    mainContent.innerHTML = '';
    mainContent.appendChild(template.content.cloneNode(true));

    // Auto-prep based on current time
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri
    const banner = document.getElementById('autoPrepBanner');

    if (banner) {
        let prepHandler = null;
        if (dayOfWeek === 5 && hours >= 15 && hours < 18) {
            // Friday 3-6 PM → Friday Weekly Review
            document.getElementById('autoPrepTitle').textContent = 'Friday Weekly Review Prep';
            document.getElementById('autoPrepDesc').textContent = 'Your 4:30 PM weekly review call is coming up. Generate prep now.';
            document.getElementById('autoPrepIcon').setAttribute('data-lucide', 'calendar-check');
            prepHandler = handleFridayReview;
        } else if (hours >= 17 && hours < 19) {
            // 5-7 PM → Evening Update Prep
            document.getElementById('autoPrepTitle').textContent = 'Evening Update Prep';
            document.getElementById('autoPrepDesc').textContent = 'Your 6:30 PM update call is coming up. Check morning commitments.';
            document.getElementById('autoPrepIcon').setAttribute('data-lucide', 'sunset');
            prepHandler = handleEveningPrep;
        } else if (hours >= 8 && hours < 11) {
            // 8-11 AM → Morning Standup Prep
            document.getElementById('autoPrepTitle').textContent = 'Morning Standup Prep';
            document.getElementById('autoPrepDesc').textContent = 'Your 10 AM standup is coming up. Generate questions for your team.';
            document.getElementById('autoPrepIcon').setAttribute('data-lucide', 'sunrise');
            prepHandler = handleMorningPrep;
        }

        if (prepHandler && dayOfWeek !== 0 && dayOfWeek !== 6) {
            banner.classList.remove('hidden');
            document.getElementById('autoPrepRun').addEventListener('click', async function() {
                this.disabled = true;
                this.textContent = 'Generating...';
                await prepHandler();
                banner.classList.add('hidden');
            });
        }
    }

    // Render employee quick-ask buttons
    const btnContainer = document.getElementById('aiEmployeeButtons');
    AppState.employees.filter(e => e.is_active && !e.standup_exempt).forEach(emp => {
        const btn = document.createElement('button');
        btn.className = 'ai-emp-btn flex items-center gap-1.5 px-3 py-1.5 bg-cream border border-border rounded-full text-sm text-slate hover:border-action hover:text-charcoal transition-colors';
        btn.innerHTML = `<span class="w-6 h-6 bg-slate/20 rounded-full flex items-center justify-center text-[10px] font-semibold text-slate">${escapeHtml(getInitials(emp.full_name))}</span> ${escapeHtml(emp.full_name)}`;
        btn.addEventListener('click', () => handleAIEmployeeAsk(emp));
        btnContainer.appendChild(btn);
    });

    // Quick action buttons
    document.getElementById('aiMorningPrep').addEventListener('click', handleMorningPrep);
    document.getElementById('aiEveningPrep').addEventListener('click', handleEveningPrep);
    document.getElementById('aiFridayReview').addEventListener('click', handleFridayReview);
    document.getElementById('aiTeamSummary').addEventListener('click', handleTeamSummary);
    document.getElementById('aiConcerns').addEventListener('click', handleConcerns);
    document.getElementById('aiMonthlyReport').addEventListener('click', handleMonthlyReport);
    document.getElementById('aiBestPerformer').addEventListener('click', handleBestPerformer);

    // Chat input
    const chatInput = document.getElementById('aiChatInput');
    const chatSend = document.getElementById('aiChatSend');

    chatSend.addEventListener('click', () => handleAIChatSend(chatInput));
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAIChatSend(chatInput);
    });

    // Suggestion chips
    document.querySelectorAll('.ai-suggestion').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.textContent;
            handleAIChatSend(chatInput);
        });
    });

    lucide.createIcons();

    // Clear history button
    document.getElementById('clearAIHistory')?.addEventListener('click', async () => {
        await db.ai_history.clear();
        const area = document.getElementById('aiResponseArea');
        if (area) area.innerHTML = '';
    });

    // Load saved AI history
    loadAIHistory();
}

function addAIResponse(title, icon, content, isLoading = false) {
    const area = document.getElementById('aiResponseArea');
    const card = document.createElement('div');
    card.className = 'card p-4 space-y-2 ai-response-card';

    if (isLoading) {
        card.innerHTML = `
            <div class="flex items-center gap-2">
                <i data-lucide="${icon}" class="w-4 h-4 text-action"></i>
                <span class="font-medium text-charcoal text-sm">${escapeHtml(title)}</span>
            </div>
            <div class="animate-pulse space-y-2">
                <div class="h-3 bg-cream rounded w-3/4"></div>
                <div class="h-3 bg-cream rounded w-1/2"></div>
                <div class="h-3 bg-cream rounded w-5/6"></div>
                <div class="h-3 bg-cream rounded w-2/3"></div>
            </div>
        `;
    } else {
        const timeStr = new Date().toLocaleTimeString();
        card.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <i data-lucide="${icon}" class="w-4 h-4 text-action"></i>
                    <span class="font-medium text-charcoal text-sm">${escapeHtml(title)}</span>
                </div>
                <span class="text-[10px] text-taupe">${timeStr}</span>
            </div>
            <div class="text-sm text-slate leading-relaxed ai-text">${renderMarkdown(content)}</div>
        `;
        // Save to history
        db.ai_history.add({
            title,
            icon,
            content,
            timestamp: new Date().toISOString()
        }).catch(() => {});
    }

    if (!area) return card;
    area.insertBefore(card, area.firstChild);
    lucide.createIcons();
    return card;
}

// Load saved AI history when rendering AI Assistant tab
async function loadAIHistory() {
    const area = document.getElementById('aiResponseArea');
    if (!area) return;
    
    try {
        // Get last 20 responses, newest first
        const history = await db.ai_history.orderBy('id').reverse().limit(20).toArray();
        
        history.forEach(item => {
            const card = document.createElement('div');
            card.className = 'card p-4 space-y-2 ai-response-card';
            const time = new Date(item.timestamp).toLocaleTimeString();
            card.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${escapeHtml(item.icon)}" class="w-4 h-4 text-action"></i>
                        <span class="font-medium text-charcoal text-sm">${escapeHtml(item.title)}</span>
                    </div>
                    <span class="text-[10px] text-taupe">${time}</span>
                </div>
                <div class="text-sm text-slate leading-relaxed ai-text">${renderMarkdown(item.content)}</div>
            `;
            area.appendChild(card);
        });
        lucide.createIcons();
    } catch (e) {
        console.error('Failed to load AI history:', e);
    }
}

// Lightweight markdown to HTML renderer
function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);
    // Headers
    html = html.replace(/^###\s+(.+)$/gm, '<h4 class="font-semibold text-charcoal mt-3 mb-1">$1</h4>');
    html = html.replace(/^##\s+(.+)$/gm, '<h3 class="font-semibold text-charcoal text-base mt-4 mb-1">$1</h3>');
    // Bold (before bullet processing)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-charcoal font-semibold">$1</strong>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-cream px-1 rounded text-xs">$1</code>');
    // Nested bullets (indented with spaces/tabs)
    html = html.replace(/^[\t ]{2,}[*\-]\s+(.+)$/gm, '<li class="ml-8 list-circle text-sm">$1</li>');
    // Top-level bullets
    html = html.replace(/^[*\-]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
    // Numbered lists
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
    // Wrap consecutive <li> in <ul>/<ol>
    html = html.replace(/((?:<li class="ml-[48] list-(?:disc|circle)[^"]*">.+<\/li>\n?)+)/g, '<ul class="space-y-0.5 my-1">$1</ul>');
    html = html.replace(/((?:<li class="ml-4 list-decimal">.+<\/li>\n?)+)/g, '<ol class="space-y-0.5 my-1">$1</ol>');
    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr class="my-2 border-border">');
    // Line breaks (not after block elements)
    html = html.replace(/\n(?!<[hulo])/g, '<br>');
    // Clean up extra <br> after block elements
    html = html.replace(/(<\/(?:h[34]|ul|ol|li|hr)>)\s*<br>/g, '$1');
    return html;
}

async function handleAIChatSend(input) {
    const question = input.value.trim();
    if (!question) return;
    input.value = '';

    const loadingCard = addAIResponse(question, 'message-circle', '', true);

    try {
        const teamData = await buildTeamDataForAI(14);
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const enrichedQuestion = `[Today: ${today}, Current time: ${currentTime}] ${question}`;
        const response = await askAI(enrichedQuestion, teamData, 'chat');
        loadingCard.remove();
        addAIResponse(question, 'message-circle', response || 'No response from AI');
    } catch (err) {
        loadingCard.remove();
        addAIResponse(question, 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleAIEmployeeAsk(employee) {
    const loadingCard = addAIResponse(`About ${employee.full_name}`, 'user', '', true);

    try {
        const empData = await buildEmployeeDataForAI(employee.id, 14);
        
        // Check if there's any actual data
        if (!empData || !empData.records || empData.records.length === 0) {
            loadingCard.remove();
            addAIResponse(`About ${employee.full_name}`, 'user', 
                `No attendance records found for **${employee.full_name}** yet.\n\n` +
                `**Role:** ${employee.role || 'Not set'}\n` +
                `**Team:** ${employee.team || 'Not set'}\n` +
                `**Trust Score:** ${employee.trust_score || 100}\n\n` +
                `Start tracking their attendance on the Dashboard to get AI insights.`);
            return;
        }
        
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Overview of ${employee.full_name} as of ${today} (current time: ${currentTime}). Analyze their WORK: what they've been working on, what they promised vs delivered, any recurring patterns. Also: attendance summary, concerns, and 2 specific work-related questions for next standup.`;
        const response = await askAI(question, { employee: empData, today: AppState.currentDate }, 'chat');
        loadingCard.remove();
        addAIResponse(`About ${employee.full_name}`, 'user', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse(`About ${employee.full_name}`, 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleMorningPrep() {
    const loadingCard = addAIResponse('Morning Standup Prep (10 AM)', 'sunrise', '', true);

    try {
        const teamData = await buildTeamDataForAI(7);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse('Morning Standup Prep (10 AM)', 'sunrise', 'No attendance data recorded yet. Start tracking on the Dashboard first, then come back for AI-powered prep.');
            return;
        }
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Prepare me for today's 10 AM standup. TODAY is ${today}, current time is ${currentTime}. The standup has NOT happened yet — do NOT say anyone missed today's standup. Cover ALL ${teamData.employees.length} team members. Use their PREVIOUS days' notes to generate specific follow-up questions. Track what they PROMISED to do vs what they actually DELIVERED.`;
        const response = await askAI(question, teamData, 'morning_prep');
        loadingCard.remove();
        addAIResponse('Morning Standup Prep (10 AM)', 'sunrise', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Morning Standup Prep', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleEveningPrep() {
    const loadingCard = addAIResponse('Evening Update Prep (6:30 PM)', 'sunset', '', true);

    try {
        const teamData = await buildTeamDataForAI(3);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse('Evening Update Prep (6:30 PM)', 'sunset', 'No attendance data recorded yet. Start tracking on the Dashboard first.');
            return;
        }
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Prepare me for today's 6:30 PM evening update. TODAY is ${today}, current time is ${currentTime}. Cover ALL present team members. For each person, show what they COMMITTED to this morning (from their mn notes) and what specific tasks I should verify they completed.`;
        const response = await askAI(question, teamData, 'evening_prep');
        loadingCard.remove();
        addAIResponse('Evening Update Prep (6:30 PM)', 'sunset', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Evening Update Prep', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleFridayReview() {
    const loadingCard = addAIResponse('Friday Weekly Review Prep (4:30 PM)', 'calendar-check', '', true);

    try {
        const teamData = await buildTeamDataForAI(7);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse('Friday Weekly Review Prep (4:30 PM)', 'calendar-check', 'No attendance data this week. Start tracking on the Dashboard first.');
            return;
        }
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Friday weekly review for week ending ${today} (current time: ${currentTime}). Cover ALL ${teamData.employees.length} team members. For each person, analyze their WORK across the week — what they promised vs what they delivered. End with team summary and action items.`;
        const response = await askAI(question, teamData, 'friday_review');
        loadingCard.remove();
        addAIResponse('Friday Weekly Review Prep (4:30 PM)', 'calendar-check', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Friday Weekly Review', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleTeamSummary() {
    const loadingCard = addAIResponse('Team Overview - This Week', 'users', '', true);

    try {
        const teamData = await buildTeamDataForAI(7);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse('Team Overview - This Week', 'users', `**${teamData.employees.length} employees** registered but no attendance data yet.\nStart tracking on the Dashboard to get team insights.`);
            return;
        }
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Team performance overview as of ${today} (current time: ${currentTime}). Cover ALL ${teamData.employees.length} members. Analyze their WORK CONTENT — what they've been working on, delivery patterns, and collaboration patterns.`;
        const response = await askAI(question, teamData, 'team_summary');
        loadingCard.remove();
        addAIResponse('Team Overview - This Week', 'users', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Team Overview', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleConcerns() {
    const loadingCard = addAIResponse('Flagged Concerns', 'alert-triangle', '', true);

    try {
        const teamData = await buildTeamDataForAI(14);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse('Flagged Concerns', 'alert-triangle', 'No data to analyze yet. Start tracking attendance to detect concerns.');
            return;
        }
        const today = formatDate(new Date());
        const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        const question = `Team concerns as of ${today} (current time: ${currentTime}). Focus on: broken promises (said they'd do X but didn't), recurring blockers, low engagement, and trust issues. Rank by severity with specific evidence.`;
        const response = await askAI(question, teamData, 'concerns');
        loadingCard.remove();
        addAIResponse('Flagged Concerns', 'alert-triangle', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Flagged Concerns', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleMonthlyReport() {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const loadingCard = addAIResponse(`Monthly Report — ${monthName}`, 'bar-chart-3', '', true);

    try {
        const teamData = await buildTeamDataForAI(31);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse(`Monthly Report — ${monthName}`, 'bar-chart-3', 'No data for this month yet. Start tracking attendance to generate monthly reports.');
            return;
        }
        const today = formatDate(new Date());
        const question = `Full MONTHLY REPORT for ${monthName} as of ${today}. Cover ALL ${teamData.employees.length} team members with individual ratings, work delivered, promises vs delivery track record, and attendance stats. Include overall team metrics.`;
        const response = await askAI(question, teamData, 'monthly_report');
        loadingCard.remove();
        addAIResponse(`Monthly Report — ${monthName}`, 'bar-chart-3', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Monthly Report', 'alert-circle', 'Error: ' + err.message);
    }
}

async function handleBestPerformer() {
    const now = new Date();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const loadingCard = addAIResponse(`Best Performer — ${monthName}`, 'trophy', '', true);

    try {
        const teamData = await buildTeamDataForAI(31);
        const hasData = teamData.employees.some(e => e.records.length > 0);
        if (!hasData) {
            loadingCard.remove();
            addAIResponse(`Best Performer — ${monthName}`, 'trophy', 'No data for this month yet.');
            return;
        }
        const today = formatDate(new Date());
        const question = `Determine the BEST PERFORMER for ${monthName} (up to ${today}) from ${teamData.employees.length} team members. Rank ALL employees. Evaluate based on: attendance, work quality (depth of notes, specific tasks), delivery rate (promises kept), and reliability (trust score, no ghost/fake). Give detailed breakdown.`;
        const response = await askAI(question, teamData, 'best_performer');
        loadingCard.remove();
        addAIResponse(`Best Performer — ${monthName}`, 'trophy', response || 'No response');
    } catch (err) {
        loadingCard.remove();
        addAIResponse('Best Performer', 'alert-circle', 'Error: ' + err.message);
    }
}

async function exportAiData() {
    const employees = await db.employees.toArray();
    const allRecords = await db.attendance_records.toArray();

    const aiData = {
        export_metadata: {
            exported_at: new Date().toISOString(),
            format_version: '1.0',
            purpose: 'AI analysis of employee work patterns, attendance, and standup data'
        },
        team_summary: {
            total_employees: employees.filter(e => e.is_active).length,
            archived_employees: employees.filter(e => !e.is_active).length,
            total_records: allRecords.length
        },
        employees: employees.map(emp => {
            const empRecords = allRecords
                .filter(r => r.employee_id === emp.id)
                .sort((a, b) => b.date.localeCompare(a.date));

            return {
                id: emp.id,
                name: emp.full_name,
                role: emp.role,
                team: emp.team,
                is_active: emp.is_active,
                trust_score: emp.trust_score,
                total_tracked_days: empRecords.length,
                daily_records: empRecords.map(r => ({
                    date: r.date,
                    morning: {
                        status: r.morning?.status || null,
                        status_label: STATUS_CONFIG[r.morning?.status]?.label || null,
                        notes: r.morning?.notes || null,
                        async_content: r.morning?.async_content || null,
                        timestamp: r.morning?.timestamp || null,
                        lag_minutes: r.morning?.response_lag_minutes || 0,
                        verification: r.morning?.verification_status || null,
                        is_ghost: r.morning?.status === 'present_ghost',
                        is_fake: r.morning?.status === 'absent_fake_excuse'
                    },
                    evening: {
                        status: r.evening?.status || null,
                        status_label: STATUS_CONFIG[r.evening?.status]?.label || null,
                        notes: r.evening?.notes || null,
                        async_content: r.evening?.async_content || null,
                        timestamp: r.evening?.timestamp || null,
                        lag_minutes: r.evening?.response_lag_minutes || 0,
                        verification: r.evening?.verification_status || null,
                        is_ghost: r.evening?.status === 'present_ghost',
                        is_fake: r.evening?.status === 'absent_fake_excuse'
                    }
                }))
            };
        })
    };

    downloadFile(
        JSON.stringify(aiData, null, 2),
        `standup-ai-export-${formatDate(new Date())}.json`,
        'application/json'
    );
    showToast('AI-ready data exported', 'success');
}

// ============================================
// MODALS
// ============================================

function showModal(content) {
    const container = document.getElementById('modalContainer');
    const contentEl = document.getElementById('modalContent');
    
    contentEl.innerHTML = '';
    contentEl.appendChild(content);
    
    container.classList.remove('hidden');
    lucide.createIcons();
    
    document.getElementById('modalBackdrop').onclick = closeModal;
    contentEl.querySelectorAll('.modal-close').forEach(btn => {
        btn.onclick = closeModal;
    });
}

function closeModal() {
    document.getElementById('modalContainer').classList.add('hidden');
}

function showAddEmployeeModal() {
    const template = document.getElementById('addEmployeeModalTemplate');
    const content = template.content.cloneNode(true);
    
    content.getElementById('saveEmployeeBtn').addEventListener('click', async () => {
        const name = document.getElementById('empName').value.trim();
        const role = document.getElementById('empRole').value.trim();
        const team = document.getElementById('empTeam').value.trim();
        const email = document.getElementById('empEmail').value.trim();
        const slack = document.getElementById('empSlack').value.trim();
        const standupExempt = document.getElementById('empStandupExempt').checked;
        
        if (!name || !role) {
            showToast('Name and role are required', 'error');
            return;
        }
        
        const employee = {
            id: generateUUID(),
            full_name: name,
            role,
            team,
            email,
            slack_handle: slack,
            is_active: true,
            standup_exempt: standupExempt,
            trust_score: 100,
            created_at: new Date().toISOString()
        };
        
        await db.employees.add(employee);
        await AppState.loadEmployees();
        debouncedCloudSync();
        
        showToast('Employee added successfully', 'success');
        closeModal();
        
        if (AppState.currentScreen === 'dashboard') {
            renderEmployeeList();
            updateInsights();
        } else if (AppState.currentScreen === 'team') {
            renderTeamList();
        }
    });
    
    showModal(content);
}

async function showEditEmployeeModal(employeeId) {
    const employee = await db.employees.get(employeeId);
    if (!employee) return;

    const template = document.getElementById('editEmployeeModalTemplate');
    const content = template.content.cloneNode(true);

    content.getElementById('editEmpName').value = employee.full_name || '';
    content.getElementById('editEmpRole').value = employee.role || '';
    content.getElementById('editEmpTeam').value = employee.team || '';
    content.getElementById('editEmpEmail').value = employee.email || '';
    content.getElementById('editEmpSlack').value = employee.slack_handle || '';
    content.getElementById('editEmpActive').value = employee.is_active ? 'true' : 'false';
    content.getElementById('editEmpStandupExempt').checked = !!employee.standup_exempt;

    content.getElementById('updateEmployeeBtn').addEventListener('click', async () => {
        const name = document.getElementById('editEmpName').value.trim();
        const role = document.getElementById('editEmpRole').value.trim();
        const team = document.getElementById('editEmpTeam').value.trim();
        const email = document.getElementById('editEmpEmail').value.trim();
        const slack = document.getElementById('editEmpSlack').value.trim();
        const isActive = document.getElementById('editEmpActive').value === 'true';
        const standupExempt = document.getElementById('editEmpStandupExempt').checked;

        if (!name || !role) {
            showToast('Name and role are required', 'error');
            return;
        }

        await db.employees.update(employeeId, {
            full_name: name,
            role,
            team,
            email,
            slack_handle: slack,
            is_active: isActive,
            standup_exempt: standupExempt
        });

        await AppState.loadEmployees();
        debouncedCloudSync();
        showToast('Employee updated successfully', 'success');
        closeModal();

        if (AppState.currentScreen === 'dashboard') {
            renderEmployeeList();
            updateInsights();
        } else if (AppState.currentScreen === 'team') {
            renderTeamList();
        }
    });

    showModal(content);
}

function showVerifyModal(employee, record, session) {
    const template = document.getElementById('verifyModalTemplate');
    const content = template.content.cloneNode(true);
    
    content.getElementById('verifyEmployeeName').textContent = employee?.full_name || 'Unknown';
    content.getElementById('verifyClaim').textContent = record[session]?.notes || 'No internet connection';
    content.getElementById('verifyDate').textContent = `${record.date} - ${session}`;
    
    // Handle screenshot file
    let screenshotBase64 = null;
    content.getElementById('screenshotFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => { screenshotBase64 = e.target.result; };
            reader.readAsDataURL(file);
        }
    });
    
    content.getElementById('markLegitBtn').addEventListener('click', async () => {
        const notes = document.getElementById('verifyNotes').value;
        const vpnLogs = document.getElementById('vpnLogs').value;
        const callNotes = document.getElementById('callNotes').value;
        
        const verificationNotes = [notes, vpnLogs, callNotes].filter(Boolean).join(' | ');
        
        // Use get + modify + put pattern (Dexie 3.x compatible)
        const fresh = await db.attendance_records.get([record.employee_id, record.date]);
        if (fresh) {
            fresh[session].verification_status = 'verified_legit';
            fresh[session].verification_notes = verificationNotes;
            fresh[session].verified_by = AppState.settings.manager_name || 'manager';
            fresh[session].verified_at = new Date().toISOString();
            fresh[session].screenshot_proof = screenshotBase64;
            fresh.last_modified = new Date().toISOString();
            await db.attendance_records.put(fresh);
        }
        
        await addAuditEntry(record.employee_id, record.date, 'verified_legit', AppState.settings.manager_name || 'manager', 'unverified', 'verified_legit');
        
        showToast('Marked as legitimate', 'success');
        closeModal();
        
        if (AppState.currentScreen === 'verification') {
            renderVerificationList();
        } else {
            renderEmployeeList();
        }
        updateInsights();
    });
    
    content.getElementById('markFakeBtn').addEventListener('click', async () => {
        const notes = document.getElementById('verifyNotes').value;
        
        // Use get + modify + put pattern (Dexie 3.x compatible)
        const fresh = await db.attendance_records.get([record.employee_id, record.date]);
        if (fresh) {
            fresh[session].status = 'absent_fake_excuse';
            fresh[session].verification_status = 'verified_fake';
            fresh[session].verification_notes = notes;
            fresh[session].verified_by = AppState.settings.manager_name || 'manager';
            fresh[session].verified_at = new Date().toISOString();
            fresh[session].screenshot_proof = screenshotBase64;
            fresh.last_modified = new Date().toISOString();
            await db.attendance_records.put(fresh);
        }
        
        await addAuditEntry(record.employee_id, record.date, 'verified_fake', AppState.settings.manager_name || 'manager', 'absent_no_internet', 'absent_fake_excuse');
        
        await updateTrustScore(record.employee_id);
        await AppState.loadEmployees();
        
        showToast('Marked as fake - trust score decreased', 'warning');
        closeModal();
        
        if (AppState.currentScreen === 'verification') {
            renderVerificationList();
        } else {
            renderEmployeeList();
        }
        updateInsights();
    });
    
    showModal(content);
}

async function showEmployeeProfile(employeeId) {
    const employee = await db.employees.get(employeeId);
    if (!employee) return;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const records = await db.attendance_records
        .where('employee_id')
        .equals(employeeId)
        .filter(r => r.date >= formatDate(thirtyDaysAgo))
        .toArray();
    
    records.sort((a, b) => b.date.localeCompare(a.date));
    
    let morningPresent = 0, ghostCount = 0, fakeCount = 0, totalLag = 0, lagCount = 0;
    let absentCount = 0, lateCount = 0;
    
    records.forEach(r => {
        // Morning attendance (primary indicator)
        const ms = r.morning?.status;
        if (ms && ms !== 'absent_no_response' && ms !== 'absent_no_internet' && ms !== 'absent_fake_excuse') {
            morningPresent++;
        }
        if (ms === 'present_ghost') ghostCount++;
        if (ms === 'absent_fake_excuse') fakeCount++;
        if (ms === 'present_late') lateCount++;
        if (ms?.includes('absent')) absentCount++;
        
        // Evening stats
        const es = r.evening?.status;
        if (es === 'present_ghost') ghostCount++;
        if (es === 'absent_fake_excuse') fakeCount++;
        
        // Lag (from both sessions, cap at 480 min)
        ['morning', 'evening'].forEach(s => {
            const lag = r[s]?.response_lag_minutes;
            if (lag > 0 && lag <= 480) {
                totalLag += lag;
                lagCount++;
            }
        });
    });
    
    const totalDays = records.length || 1;
    const attendanceRate = Math.round((morningPresent / totalDays) * 100);
    const ghostRate = Math.round((ghostCount / totalDays) * 100);
    const fakeRate = Math.round((fakeCount / totalDays) * 100);
    const avgLag = lagCount > 0 ? Math.round(totalLag / lagCount) : 0;
    
    // Weekly breakdown
    const weekMap = {};
    records.forEach(r => {
        const d = new Date(r.date + 'T00:00:00');
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const weekKey = formatDate(weekStart);
        if (!weekMap[weekKey]) weekMap[weekKey] = { present: 0, absent: 0, ghost: 0, total: 0 };
        ['morning', 'evening'].forEach(s => {
            const st = r[s]?.status;
            if (st) {
                weekMap[weekKey].total++;
                if (st.includes('present')) weekMap[weekKey].present++;
                if (st.includes('absent')) weekMap[weekKey].absent++;
                if (st === 'present_ghost') weekMap[weekKey].ghost++;
            }
        });
    });
    
    const content = document.createElement('div');
    content.className = 'p-6 space-y-6';
    content.innerHTML = `
        <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold text-charcoal">Employee Profile</h2>
            <div class="flex items-center gap-2">
                <button class="edit-profile-btn p-2 hover:bg-cream rounded-lg transition-colors" title="Edit">
                    <i data-lucide="pencil" class="w-5 h-5 text-dusty"></i>
                </button>
                <button class="modal-close p-2 hover:bg-cream rounded-lg transition-colors">
                    <i data-lucide="x" class="w-5 h-5 text-taupe"></i>
                </button>
            </div>
        </div>
        
        <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-slate/20 rounded-full flex items-center justify-center text-2xl font-semibold text-slate">
                ${escapeHtml(getInitials(employee.full_name))}
            </div>
            <div class="flex-1">
                <h3 class="text-lg font-medium text-charcoal">${escapeHtml(employee.full_name)}</h3>
                <p class="text-taupe">${escapeHtml(employee.role)}</p>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                    <span class="inline-block px-2 py-0.5 ${employee.trust_score >= 80 ? 'bg-sage' : employee.trust_score >= 50 ? 'bg-amber' : 'bg-terracotta'} rounded text-xs text-white font-medium">
                        Trust: ${employee.trust_score || 100}
                    </span>
                    ${employee.team ? `<span class="text-xs text-taupe">${escapeHtml(employee.team)}</span>` : ''}
                    ${employee.email ? `<span class="text-xs text-taupe">${escapeHtml(employee.email)}</span>` : ''}
                    ${employee.slack_handle ? `<span class="text-xs text-dusty">${escapeHtml(employee.slack_handle)}</span>` : ''}
                </div>
            </div>
        </div>
        
        <!-- Stats Grid -->
        <div class="grid grid-cols-3 gap-3">
            <div class="bg-cream border border-border rounded-lg p-3 text-center">
                <p class="text-2xl font-bold text-sage">${attendanceRate}%</p>
                <p class="text-xs text-taupe">Attendance</p>
            </div>
            <div class="bg-cream border border-border rounded-lg p-3 text-center">
                <p class="text-2xl font-bold text-terracotta">${ghostCount}</p>
                <p class="text-xs text-taupe">Ghosts</p>
            </div>
            <div class="bg-cream border border-border rounded-lg p-3 text-center">
                <p class="text-2xl font-bold text-amber">${avgLag >= 60 ? Math.floor(avgLag / 60) + 'h ' + (avgLag % 60) + 'm' : avgLag + 'm'}</p>
                <p class="text-xs text-taupe">Avg Lag</p>
            </div>
        </div>
        
        <div class="grid grid-cols-3 gap-3">
            <div class="bg-cream border border-border rounded-lg p-2.5 text-center">
                <p class="text-lg font-bold text-rust">${fakeCount}</p>
                <p class="text-[10px] text-taupe">Fake Excuses</p>
            </div>
            <div class="bg-cream border border-border rounded-lg p-2.5 text-center">
                <p class="text-lg font-bold text-amber">${lateCount}</p>
                <p class="text-[10px] text-taupe">Late Records</p>
            </div>
            <div class="bg-cream border border-border rounded-lg p-2.5 text-center">
                <p class="text-lg font-bold text-taupe">${absentCount}</p>
                <p class="text-[10px] text-taupe">Absences</p>
            </div>
        </div>
        
        <!-- Weekly Breakdown -->
        ${Object.keys(weekMap).length > 0 ? `
        <div>
            <p class="text-sm font-medium text-slate mb-2">Weekly Breakdown</p>
            <div class="space-y-1.5">
                ${Object.entries(weekMap).sort(([a],[b]) => b.localeCompare(a)).map(([week, data]) => {
                    const pct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
                    return `
                        <div class="flex items-center gap-3 text-xs">
                            <span class="text-taupe w-20 shrink-0">Wk ${escapeHtml(week.slice(5))}</span>
                            <div class="flex-1 bg-border rounded-full h-4 overflow-hidden">
                                <div class="h-full bg-sage rounded-full" style="width: ${pct}%"></div>
                            </div>
                            <span class="text-slate font-medium w-10 text-right">${pct}%</span>
                            ${data.ghost > 0 ? `<span class="text-terracotta">${data.ghost}G</span>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        ` : ''}
        
        <!-- Detailed Daily History -->
        <div>
            <p class="text-sm font-medium text-slate mb-2">Daily History (Last 30 Days)</p>
            <div class="space-y-2 max-h-80 overflow-auto">
                ${records.length === 0 ? '<p class="text-sm text-taupe italic">No records in the last 30 days</p>' : ''}
                ${records.map(r => {
                    const mStatus = STATUS_CONFIG[r.morning?.status];
                    const eStatus = STATUS_CONFIG[r.evening?.status];
                    const mNotes = r.morning?.notes || '';
                    const eNotes = r.evening?.notes || '';
                    const mAsync = r.morning?.async_content || '';
                    const eAsync = r.evening?.async_content || '';
                    const isGhost = r.morning?.status === 'present_ghost' || r.evening?.status === 'present_ghost';
                    const isFake = r.morning?.status === 'absent_fake_excuse' || r.evening?.status === 'absent_fake_excuse';
                    return `
                    <div class="bg-cream border ${isGhost ? 'border-terracotta' : isFake ? 'border-rust' : 'border-border'} rounded-lg p-3 text-sm">
                        <div class="flex items-center gap-2 mb-1.5">
                            <span class="font-medium text-charcoal">${escapeHtml(r.date)}</span>
                            ${mStatus ? `<span class="${mStatus.color} px-1.5 py-0.5 rounded text-xs font-bold">M: ${escapeHtml(mStatus.abbr)}</span>` : ''}
                            ${eStatus ? `<span class="${eStatus.color} px-1.5 py-0.5 rounded text-xs font-bold">E: ${escapeHtml(eStatus.abbr)}</span>` : ''}
                            ${isGhost ? '<span class="text-xs text-terracotta font-medium ml-auto">GHOST</span>' : ''}
                            ${isFake ? '<span class="text-xs text-rust font-medium ml-auto">FAKE</span>' : ''}
                        </div>
                        ${mNotes ? `<p class="text-taupe text-xs"><span class="text-slate font-medium">Morning:</span> ${escapeHtml(mNotes)}</p>` : ''}
                        ${mAsync ? `<p class="text-dusty text-xs"><span class="text-slate font-medium">Async:</span> ${escapeHtml(mAsync)}</p>` : ''}
                        ${eNotes ? `<p class="text-taupe text-xs mt-0.5"><span class="text-slate font-medium">Evening:</span> ${escapeHtml(eNotes)}</p>` : ''}
                        ${eAsync ? `<p class="text-dusty text-xs"><span class="text-slate font-medium">Async:</span> ${escapeHtml(eAsync)}</p>` : ''}
                        ${!mNotes && !eNotes && !mAsync && !eAsync ? '<p class="text-taupe text-xs italic">No notes</p>' : ''}
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- AI Analysis -->
        <div>
            <button class="ai-analyze-btn btn-primary w-full flex items-center justify-center gap-2">
                <i data-lucide="sparkles" class="w-4 h-4"></i>
                AI Analysis (Gemini)
            </button>
            <div class="ai-result hidden mt-3 bg-cream border border-dusty/30 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-2">
                    <i data-lucide="sparkles" class="w-4 h-4 text-action"></i>
                    <span class="font-medium text-charcoal text-sm">AI Insights</span>
                </div>
                <div class="ai-result-text text-sm text-slate whitespace-pre-wrap leading-relaxed"></div>
            </div>
        </div>
    `;
    
    content.querySelector('.edit-profile-btn').addEventListener('click', () => {
        closeModal();
        showEditEmployeeModal(employeeId);
    });

    content.querySelector('.ai-analyze-btn').addEventListener('click', async function() {
        this.disabled = true;
        this.innerHTML = '<span class="animate-pulse">Analyzing with Gemini...</span>';

        const analysis = await analyzeWithGemini(employeeId);

        this.disabled = false;
        this.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i> AI Analysis (Gemini)';
        lucide.createIcons();

        if (analysis) {
            const resultDiv = content.querySelector('.ai-result');
            resultDiv.classList.remove('hidden');
            resultDiv.querySelector('.ai-result-text').innerHTML = renderMarkdown(analysis);
        }
    });
    
    showModal(content);
}

function showSettingsModal() {
    const template = document.getElementById('settingsModalTemplate');
    const content = template.content.cloneNode(true);
    
    content.getElementById('settingManagerName').value = AppState.settings.manager_name || '';
    content.getElementById('settingGeminiKey').value = AppState.settings.gemini_api_key || '';

    // Show last sync time
    const lastSync = AppState.settings.last_cloud_sync;
    const lastSyncEl = content.getElementById('lastSyncInfo');
    if (lastSync) {
        lastSyncEl.textContent = `Last synced: ${new Date(lastSync).toLocaleString()}`;
    }

    // Toggle API key visibility
    content.getElementById('toggleKeyVisibility').addEventListener('click', () => {
        const input = document.getElementById('settingGeminiKey');
        input.type = input.type === 'password' ? 'text' : 'password';
    });
    
    content.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const name = document.getElementById('settingManagerName').value;
        const geminiKey = document.getElementById('settingGeminiKey').value.trim();
        await db.app_settings.update('main', { manager_name: name, gemini_api_key: geminiKey });
        await AppState.loadSettings();
        debouncedCloudSync();
        showToast('Settings saved', 'success');
        closeModal();
    });

    // Cloud sync buttons
    content.getElementById('syncPushBtn').addEventListener('click', async () => {
        const btn = document.getElementById('syncPushBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';
        await syncToCloud();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="cloud-upload" class="w-4 h-4"></i> Upload to Cloud';
        lucide.createIcons();
        const syncInfo = document.getElementById('lastSyncInfo');
        if (syncInfo) syncInfo.textContent = `Last synced: ${new Date().toLocaleString()}`;
        showToast('Data uploaded to cloud', 'success');
    });

    content.getElementById('syncPullBtn').addEventListener('click', async () => {
        if (!confirm('This will replace local data with cloud data. Continue?')) return;
        const btn = document.getElementById('syncPullBtn');
        btn.disabled = true;
        btn.textContent = 'Downloading...';
        await syncFromCloud();
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="cloud-download" class="w-4 h-4"></i> Download from Cloud';
        lucide.createIcons();
        closeModal();
    });
    
    content.getElementById('exportDbBtn').addEventListener('click', async () => {
        const data = {
            employees: await db.employees.toArray(),
            attendance_records: await db.attendance_records.toArray(),
            app_settings: await db.app_settings.toArray(),
            holidays: await db.holidays.toArray(),
            exported_at: new Date().toISOString()
        };
        
        downloadFile(JSON.stringify(data, null, 2), `standup-backup-${formatDate(new Date())}.json`, 'application/json');
        await db.app_settings.update('main', { last_backup: new Date().toISOString() });
        showToast('Database exported', 'success');
    });

    content.getElementById('exportAiBtn').addEventListener('click', exportAiData);
    
    content.getElementById('importDbBtn').addEventListener('click', () => {
        document.getElementById('importFile').click();
    });
    
    content.getElementById('importFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate import structure
            if (!data || typeof data !== 'object') {
                showToast('Invalid backup file format', 'error');
                return;
            }
            if (data.employees && !Array.isArray(data.employees)) {
                showToast('Invalid employees data in backup', 'error');
                return;
            }
            if (data.attendance_records && !Array.isArray(data.attendance_records)) {
                showToast('Invalid attendance data in backup', 'error');
                return;
            }
            
            if (confirm('This will replace all existing data. Continue?')) {
                await db.employees.clear();
                await db.attendance_records.clear();
                await db.holidays.clear();
                
                if (data.employees) await db.employees.bulkAdd(data.employees);
                if (data.attendance_records) await db.attendance_records.bulkAdd(data.attendance_records);
                if (data.holidays) await db.holidays.bulkAdd(data.holidays);
                
                await AppState.loadEmployees();
                showToast('Database imported', 'success');
                closeModal();
            }
        } catch (err) {
            showToast('Import failed: ' + err.message, 'error');
        }
    });

    // Holiday management
    async function renderHolidayList() {
        const list = document.getElementById('holidayList');
        if (!list) return;
        const holidays = await getAllHolidays();
        holidays.sort((a, b) => a.date.localeCompare(b.date));
        
        if (holidays.length === 0) {
            list.innerHTML = '<p class="text-xs text-taupe italic">No custom holidays added</p>';
            return;
        }
        
        list.innerHTML = holidays.map(h => `
            <div class="flex items-center justify-between py-1.5 px-2 bg-cream rounded text-sm">
                <span class="text-slate">${escapeHtml(h.date)}</span>
                <span class="text-charcoal font-medium">${escapeHtml(h.name)}</span>
                <button class="remove-holiday text-taupe hover:text-terracotta text-xs" data-date="${escapeHtml(h.date)}">Remove</button>
            </div>
        `).join('');
        
        list.querySelectorAll('.remove-holiday').forEach(btn => {
            btn.addEventListener('click', async () => {
                await removeHoliday(btn.dataset.date);
                showToast('Holiday removed', 'info');
                renderHolidayList();
            });
        });
    }

    content.getElementById('addHolidayBtn').addEventListener('click', async () => {
        const dateInput = document.getElementById('holidayDate');
        const nameInput = document.getElementById('holidayNameInput');
        const dateVal = dateInput.value;
        const nameVal = nameInput.value.trim();
        
        if (!dateVal) {
            showToast('Please select a date', 'error');
            return;
        }
        
        await addHoliday(dateVal, nameVal || 'Holiday');
        showToast('Holiday added', 'success');
        dateInput.value = '';
        nameInput.value = '';
        renderHolidayList();
    });

    // Initial render of holidays
    setTimeout(renderHolidayList, 100);
    
    showModal(content);
}

// ============================================
// NAVIGATION & SYNC
// ============================================

function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            document.querySelectorAll('.nav-tab').forEach(t => {
                t.classList.remove('bg-action', 'text-white');
                t.classList.add('text-slate');
            });
            tab.classList.remove('text-slate');
            tab.classList.add('bg-action', 'text-white');
            
            const screen = tab.dataset.screen;
            AppState.currentScreen = screen;
            
            switch (screen) {
                case 'dashboard': renderDashboard(); break;
                case 'matrix': renderMatrix(); break;
                case 'verification': renderVerification(); break;
                case 'team': renderTeam(); break;
                case 'reports': renderReports(); break;
                case 'ai': renderAIAssistant(); break;
            }
        });
    });
    
    document.getElementById('settingsBtn').addEventListener('click', showSettingsModal);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
    document.getElementById('syncIndicator').addEventListener('click', syncToCloud);
}

function updateSyncIndicator(status) {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    
    const configs = {
        synced: { class: 'sync-green', text: 'Synced' },
        pending: { class: 'sync-orange', text: 'Pending' },
        offline: { class: 'sync-red', text: 'Offline' }
    };
    
    const config = configs[status] || configs.synced;
    dot.className = `sync-dot ${config.class}`;
    text.textContent = config.text;
    text.className = `text-sm ${status === 'offline' ? 'text-terracotta' : 'text-slate'}`;
}

// ============================================
// OFFLINE SUPPORT
// ============================================

function initOfflineSupport() {
    const banner = document.getElementById('offlineBanner');
    
    window.addEventListener('online', () => {
        AppState.isOnline = true;
        banner.classList.add('hidden');
        updateSyncIndicator('synced');
        showToast('Back online', 'success');
    });
    
    window.addEventListener('offline', () => {
        AppState.isOnline = false;
        banner.classList.remove('hidden');
        updateSyncIndicator('offline');
    });
    
    if (!navigator.onLine) {
        banner.classList.remove('hidden');
        updateSyncIndicator('offline');
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            showToast('All changes saved', 'success');
        }
        
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            document.querySelector('[data-screen="reports"]').click();
        }
        
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

// ============================================
// SERVICE WORKER
// ============================================

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.register('sw.js');
            // Force check for updates immediately
            reg.update();
            console.log('Service Worker registered');
        } catch (error) {
            console.log('SW registration failed:', error);
        }
    }
}

// ============================================
// MAIN INITIALIZATION
// ============================================

async function initApp() {
    try {
        const dbReady = await initDatabase();
        if (!dbReady) return;
        
        // Load all data in parallel for faster startup
        await Promise.all([
            AppState.loadEmployees(),
            AppState.loadSettings(),
            AppState.loadAttendanceForDate(AppState.currentDate)
        ]);
        
        initNavigation();
        initKeyboardShortcuts();
        initOfflineSupport();
        registerServiceWorker();
        
        renderDashboard();
        
        // Auto-sync from cloud on first load after login
        if (AuthState.isAuthenticated()) {
            syncFromCloud().catch(() => {});
        }
        
        console.log('Standup Tracker Pro initialized');
    } catch (err) {
        console.error('App initialization failed:', err);
        document.getElementById('mainContent').innerHTML = `
            <div class="text-center py-12">
                <h2 class="text-xl font-semibold text-charcoal">Something went wrong</h2>
                <p class="text-sm text-taupe mt-2">Please refresh the page to try again.</p>
                <button onclick="location.reload()" class="mt-4 btn-primary">Refresh</button>
            </div>
        `;
    }
}

function hideLoadingScreen() {
    const ls = document.getElementById('loadingScreen');
    if (ls) {
        ls.style.opacity = '0';
        setTimeout(() => ls.remove(), 300);
    }
}

async function startApp() {
    if (AuthState.isAuthenticated()) {
        try {
            await apiCall('/auth/me');
            hideAuthScreen();
            await initApp();
        } catch {
            AuthState.clearAuth();
            showAuthScreen();
        }
    } else {
        showAuthScreen();
    }
    hideLoadingScreen();
}

document.addEventListener('DOMContentLoaded', startApp);
