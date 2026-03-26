const app = {
    role: 'guest',
    data: {
        students: JSON.parse(localStorage.getItem('dp_students')) || [],
        teachers: JSON.parse(localStorage.getItem('dp_teachers')) || [],
        notices: JSON.parse(localStorage.getItem('dp_notices')) || [],
        gallery: JSON.parse(localStorage.getItem('dp_gallery')) || [],
        leaderPoints: JSON.parse(localStorage.getItem('dp_leader_pts')) || {},
        settings: JSON.parse(localStorage.getItem('dp_settings')) || { logo: 'logo.png' },
        pins: { admin: '1111', principal: '2222', teacher: '3333', 'mal-bhara': '4444' }
    },

    init() {
        this.cacheDom();
        this.bindEvents();
        this.renderAll();
        this.renderOnlineLink();
        this.renderGallery();
        this.renderSchoolInfo();
        this.initInstall();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
    },

    cacheDom() {
        this.sidebar = document.getElementById('sidebar');
        this.overlay = document.getElementById('overlay');
        this.menuList = document.getElementById('menuList');
        this.sections = document.querySelectorAll('.section');
        this.currentRoleSpan = document.getElementById('currentRole');
        this.studentsTable = document.querySelector('#studentsTable tbody');
        this.teachersTable = document.getElementById('teachersTable');
        this.leadersTable = document.getElementById('leadersTable');
        this.noticesList = document.getElementById('noticesList');
        this.scoresTable = document.querySelector('#scoresTable tbody');
        this.classGrid = document.getElementById('classGrid');
    },

    bindEvents() {
        document.getElementById('openMenu').addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('closeMenu').addEventListener('click', () => this.toggleSidebar(false));
        this.overlay.addEventListener('click', () => {
            this.toggleSidebar(false);
            document.getElementById('studentModal').style.display = 'none';
        });

        this.menuList.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (li) {
                this.showSection(li.dataset.section);
                this.toggleSidebar(false);
            }
        });

        document.getElementById('addStudentBtn').addEventListener('click', () => {
            document.getElementById('studentModal').style.display = 'block';
            this.overlay.classList.add('active');
        });

        document.getElementById('saveStudent').addEventListener('click', () => this.saveStudent());
    },

    toggleSidebar(open) {
        if (open) {
            this.sidebar.classList.add('active');
            this.overlay.classList.add('active');
        } else {
            this.sidebar.classList.remove('active');
            this.overlay.classList.remove('active');
        }
    },

    showSection(id) {
        this.sections.forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        this.menuList.querySelectorAll('li').forEach(li => {
            li.classList.toggle('active', li.dataset.section === id);
        });
        
        if (id === 'classes') this.renderClassAnalysis();
        if (id === 'leader-management') this.renderLeaders();
    },

    setRole(role) {
        if (role === 'student') {
            this.applyRole(role);
            return;
        }

        // Show PIN modal for protected roles
        this.pendingRole = role;
        document.getElementById('loginTitle').innerText = role.toUpperCase();
        document.getElementById('loginModal').style.display = 'block';
        document.getElementById('overlay').classList.add('active');
        document.getElementById('rolePinInput').value = '';
        document.getElementById('rolePinInput').focus();

        document.getElementById('verifyPinBtn').onclick = () => {
            const entered = document.getElementById('rolePinInput').value;
            if (entered === this.data.pins[role]) {
                this.applyRole(role);
                document.getElementById('loginModal').style.display = 'none';
                document.getElementById('overlay').classList.remove('active');
            } else {
                alert('Invalid PIN!');
            }
        };
    },

    applyRole(role) {
        this.role = role;
        this.currentRoleSpan.innerText = role.toUpperCase();
        document.body.className = 'role-' + role;
        this.updateUIVisibility();
        
        const controls = {
            'adminNoticeControl': ['admin', 'principal', 'teacher'],
            'leaderSelectionForm': ['admin', 'principal'],
            'galleryUpload': ['admin'],
            'teacherOnlineControl': ['admin', 'teacher'],
            'addStudentBtn': ['admin', 'teacher']
        };

        for (const [id, roles] of Object.entries(controls)) {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = (roles.includes(role) || role === 'admin') ? 'inline-block' : 'none';
            }
        }
        
        this.renderStudents(); // Re-render to show/hide action buttons
        alert(`Logged in as ${role}`);
    },

    updateUIVisibility() {
        const items = this.menuList.querySelectorAll('li');
        items.forEach(item => {
            const roles = Array.from(item.classList).filter(c => c.startsWith('role-'));
            if (roles.length === 0) {
                item.style.display = 'flex';
            } else {
                const hasAccess = roles.includes(`role-${this.role}`);
                item.style.display = (hasAccess || this.role === 'admin') ? 'flex' : 'none';
            }
        });
    },

    // --- Students ---
    saveStudent() {
        const student = {
            id: Date.now(),
            name: document.getElementById('s_name').value,
            dob: document.getElementById('s_dob').value,
            address: document.getElementById('s_address').value,
            whatsapp: document.getElementById('s_whatsapp').value,
            parent_whatsapp: document.getElementById('p_whatsapp').value,
            class: document.getElementById('s_class').value,
            points_mal: 0,
            points_gilan: 0,
            absentCount: 0
        };

        if (!student.name) return alert('Name is required');

        this.data.students.push(student);
        this.saveData('students');
        this.renderStudents();
        this.updateStats();
        
        document.getElementById('studentModal').style.display = 'none';
        this.overlay.classList.remove('active');
        document.querySelectorAll('#studentModal input, #studentModal textarea').forEach(i => i.value = '');
    },

    renderStudents() {
        this.studentsTable.innerHTML = '';
        const canEdit = (this.role !== 'student');
        
        this.data.students.sort((a,b) => a.class - b.class).forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.name}</td>
                <td>Grade ${s.class}</td>
                <td>${s.parent_whatsapp}</td>
                <td><a href="https://wa.me/${s.parent_whatsapp}" target="_blank" style="color: #25d366;"><i class="fab fa-whatsapp"></i> Chat</a></td>
                <td>
                    <button class="btn" ${canEdit ? '' : 'disabled'} style="background: ${s.absent ? '#ff5252' : '#4caf50'}; color: white;" onclick="app.toggleAttendance(${s.id})">
                        ${s.absent ? 'Absent' : 'Present'}
                    </button>
                </td>
                <td>
                    ${canEdit ? `<button class="btn btn-primary" onclick="app.deleteStudent(${s.id})"><i class="fas fa-trash"></i></button>` : 'Read Only'}
                </td>
            `;
            this.studentsTable.appendChild(tr);
        });
    },

    toggleAttendance(id) {
        const s = this.data.students.find(x => x.id === id);
        if (s) {
            s.absent = !s.absent;
            if (s.absent) {
                s.absentCount = (s.absentCount || 0) + 1;
                const msg = `Attention: ${s.name} is absent today from Dhaham Pasala.`;
                if (confirm('Student marked absent. Message parent?')) {
                    window.open(`https://wa.me/${s.parent_whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
                }
            }
            this.saveData('students');
            this.renderStudents();
        }
    },

    // --- Teachers ---
    showTeacherModal() {
        const name = prompt("Teacher Name:");
        const whatsapp = prompt("WhatsApp Number:");
        const address = prompt("Address:");
        const pos = prompt("Position or Class (e.g., Grade 5):");
        if (name && whatsapp) {
            this.data.teachers.push({ id: Date.now(), name, whatsapp, address, position: pos, absentDays: 0 });
            this.saveData('teachers');
            this.renderTeachers();
        }
    },

    renderTeachers() {
        this.teachersTable.innerHTML = '';
        this.data.teachers.forEach(t => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${t.name}</td>
                <td>${t.whatsapp}</td>
                <td>${t.address}</td>
                <td>${t.position}</td>
                <td>
                    <button class="btn" style="background: ${t.absent ? '#ff5252' : '#4caf50'}; color: white;" onclick="app.toggleTeacherAttendance(${t.id})">
                        ${t.absent ? 'Absent' : 'Present'}
                    </button>
                </td>
                <td>
                    <button class="btn btn-primary" onclick="app.deleteTeacher(${t.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
            this.teachersTable.appendChild(tr);
        });
        this.updateStats();
    },

    toggleTeacherAttendance(id) {
        const t = this.data.teachers.find(x => x.id === id);
        if (t) {
            t.absent = !t.absent;
            if (t.absent) {
                t.absentDays = (t.absentDays || 0) + 1;
                if (t.absentDays === 3) alert(`Warning: ${t.name} has been absent for 3 days. Message sent.`);
                if (t.absentDays >= 4) alert(`Report: ${t.name} added to Absence List.`);
            }
            this.saveData('teachers');
            this.renderTeachers();
        }
    },

    deleteTeacher(id) {
        if (confirm('Delete teacher record?')) {
            this.data.teachers = this.data.teachers.filter(t => t.id !== id);
            this.saveData('teachers');
            this.renderTeachers();
        }
    },

    // --- Online Classes ---
    setOnlineLink() {
        const link = document.getElementById('onlineLinkInput').value;
        if (!link) return;
        this.data.settings.online_link = link;
        this.saveData('settings');
        this.renderOnlineLink();
    },

    renderOnlineLink() {
        const link = this.data.settings.online_link;
        const display = document.getElementById('currentOnlineLink');
        if (link) {
            display.innerHTML = `Active Class: <a href="${link}" target="_blank" style="color: var(--primary); font-weight: 700;">Click to Join</a>`;
        } else {
            display.innerText = 'No active online classes currently.';
        }
    },

    // --- Gallery ---
    uploadPhotos() {
        // Since we don't have a server, we represent photos with placeholders or base64 (for demo)
        const fileInput = document.getElementById('photoInput');
        const eventName = document.getElementById('photoEvent').value;
        const date = document.getElementById('photoDate').value;
        
        if (fileInput.files.length > 0) {
            alert('Photos "Uploaded" (Simulated). In a real app, these would go to a database.');
            this.data.gallery.push({ id: Date.now(), event: eventName, date: date, src: 'logo.png' });
            this.saveData('gallery');
            this.renderGallery();
        }
    },

    renderGallery() {
        const container = document.getElementById('galleryContainer');
        container.innerHTML = '';
        this.data.gallery.forEach(img => {
            const div = document.createElement('div');
            div.className = 'gallery-item card';
            div.innerHTML = `<img src="${img.src}" style="width:100%;"><p style="font-size: 0.8rem;">${img.event} (${img.date})</p>`;
            container.appendChild(div);
        });
    },

    saveSchoolSettings() {
        this.data.settings.school_name = document.getElementById('set_school_name').value;
        this.data.settings.school_address = document.getElementById('set_school_address').value;
        this.data.settings.school_phone = document.getElementById('set_school_phone').value;
        this.data.settings.principal_name = document.getElementById('set_principal_name').value;
        
        this.saveData('settings');
        this.renderSchoolInfo();
        alert('Settings Saved Successfully!');
    },

    renderSchoolInfo() {
        const s = this.data.settings;
        document.getElementById('disp_school_name').innerText = s.school_name || 'Welcome to Dhaham Pasala';
        document.getElementById('disp_school_address').innerText = s.school_address || '';
        document.getElementById('disp_school_phone').innerText = s.school_phone ? 'Tel: ' + s.school_phone : '';
        document.getElementById('disp_principal_name').innerText = s.principal_name ? 'Principal: ' + s.principal_name : '';
        
        // Populate inputs if in settings
        if (document.getElementById('set_school_name')) {
            document.getElementById('set_school_name').value = s.school_name || '';
            document.getElementById('set_school_address').value = s.school_address || '';
            document.getElementById('set_school_phone').value = s.school_phone || '';
            document.getElementById('set_principal_name').value = s.principal_name || '';
        }
    },

    // --- Leader Management ---
    renderLeaders() {
        const select = document.getElementById('leaderStudentSelect');
        select.innerHTML = '<option value="">Select Student to Evaluate</option>';
        this.data.students.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name} (Grade ${s.class})</option>`;
        });

        this.leadersTable.innerHTML = '';
        const leaders = this.data.students
            .map(s => {
                const pts = this.data.leaderPoints[s.id] || {};
                const total = Object.values(pts).reduce((a, b) => a + b, 0);
                return { ...s, total };
            })
            .filter(s => s.total > 0)
            .sort((a, b) => b.total - a.total);

        leaders.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${l.name}</td><td>Grade ${l.class}</td><td>${l.total}/100</td><td>${l.total > 75 ? 'Senior' : 'Junior'}</td><td>-</td>`;
            this.leadersTable.appendChild(tr);
        });
    },

    saveLeaderPoints() {
        const id = document.getElementById('leaderStudentSelect').value;
        if (!id) return;
        
        const pts = {
            att: parseInt(document.getElementById('pts_att').value) || 0,
            clean: parseInt(document.getElementById('pts_clean').value) || 0,
            mal: parseInt(document.getElementById('pts_mal').value) || 0,
            gilan: parseInt(document.getElementById('pts_gilan').value) || 0,
            cert: parseInt(document.getElementById('pts_cert').value) || 0,
            skill: parseInt(document.getElementById('pts_skill').value) || 0,
            phys: parseInt(document.getElementById('pts_phys').value) || 0,
            pres: parseInt(document.getElementById('pts_pres').value) || 0,
            rec: parseInt(document.getElementById('pts_rec').value) || 0
        };

        this.data.leaderPoints[id] = pts;
        this.saveData('leaderPoints');
        alert('Points Saved');
        this.renderLeaders();
    },

    // --- Weekly Points Entry ---
    loadClassListForScores() {
        const cls = document.getElementById('score_class').value;
        this.scoresTable.innerHTML = '';
        if (!cls) return;

        const canEdit = (this.role !== 'student');
        const students = this.data.students.filter(s => s.class === cls);
        students.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${s.name}</td>
                <td><input type="number" ${canEdit ? '' : 'disabled'} value="${s.points_mal || 0}" max="10" onchange="app.updateStudentPoints(${s.id}, 'mal', this.value)"></td>
                <td><input type="number" ${canEdit ? '' : 'disabled'} value="${s.points_gilan || 0}" max="10" onchange="app.updateStudentPoints(${s.id}, 'gilan', this.value)"></td>
                <td>-</td>
            `;
            this.scoresTable.appendChild(tr);
        });
    },

    updateStudentPoints(id, type, val) {
        const s = this.data.students.find(x => x.id === id);
        if (s) {
            s[`points_${type}`] = parseInt(val) || 0;
            this.saveData('students');
        }
    },

    // --- Analysis ---
    renderClassAnalysis() {
        this.classGrid.innerHTML = '';
        for (let i = 1; i <= 11; i++) {
            const classStudents = this.data.students.filter(s => s.class == i);
            const sorted = classStudents.sort((a,b) => (b.points_mal + b.points_gilan) - (a.points_mal + a.points_gilan)).slice(0, 3);
            
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `<h3>Grade ${i} Top 3</h3><ol>${sorted.map(s => `<li>${s.name} (${s.points_mal + s.points_gilan} pts)</li>`).join('')}</ol>`;
            this.classGrid.appendChild(card);
        }
    },

    // --- Helpers ---
    saveData(key) {
        localStorage.setItem(`dp_${key}`, JSON.stringify(this.data[key]));
    },

    renderAll() {
        this.renderStudents();
        this.renderTeachers();
        this.renderNotices();
        this.updateStats();
    },

    updateStats() {
        document.getElementById('count-students').innerText = this.data.students.length;
        document.getElementById('count-teachers').innerText = this.data.teachers.length;
    },

    renderNotices() {
        this.noticesList.innerHTML = '';
        this.data.notices.forEach(n => {
            const div = document.createElement('div');
            div.className = 'notice-card';
            div.innerHTML = `<strong>${n.date}</strong> - ${n.target.toUpperCase()}<p>${n.text}</p>`;
            this.noticesList.appendChild(div);
        });
    },

    // --- PWA Installation ---
    deferredPrompt: null,
    initInstall() {
        const btn = document.getElementById('installBtn');
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            btn.style.display = 'flex';
        });

        btn.addEventListener('click', async () => {
            if (this.deferredPrompt) {
                this.deferredPrompt.prompt();
                const { outcome } = await this.deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    btn.style.display = 'none';
                }
                this.deferredPrompt = null;
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());

document.addEventListener('DOMContentLoaded', () => app.init());
