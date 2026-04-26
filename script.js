const API_BASE_URL = 'http://localhost:5500';

let needsData = [];
let volunteersData = [];
let appliedTasks = [];
let totalPoints = 0;
let workingScore = 0; 

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded, initializing HelpNetra...");
    initNavigation();
    
    renderAll();
    
    try {
        await fetchBackendData();
        console.log("Data fetched successfully");
    } catch (e) {
        console.error("Data fetch failed", e);
    }
    
    renderAll();
    
    initDataCollection();
    initAIMatch();
    initCommunication();
    initMap();
    initAuth();
    
    setInterval(updateAIInsights, 10000);
    updateAIInsights();
});

async function fetchBackendData() {
    try {
        const needsRes = await fetch(`${API_BASE_URL}/api/needs`);
        needsData = await needsRes.json();
        
        const volsRes = await fetch(`${API_BASE_URL}/api/volunteers`);
        volunteersData = await volsRes.json();

        // Fetch Achievements Data
        const achRes = await fetch(`${API_BASE_URL}/api/achievements`);
        const achData = await achRes.json();
        if (achData) {
            totalPoints = achData.totalPoints || 0;
            workingScore = achData.workingScore || 0;
            if (achData.totalPoints > 0 && appliedTasks.length === 0) {
                // Mock an applied task so the First Mission badge shows as unlocked in examples
                appliedTasks.push({ id: 999, title: "Mock Completed Task", status: "completed" });
            }
        }

    } catch (e) {
        console.warn("Backend API unavailable, using local mock defaults.");
        if (needsData.length === 0) {
            needsData = [
                {id: 1, title: "Flood Relief Distribution", location: "Downtown Riverside", urgency: "critical", category: "Food", reported: "12m ago", lat: 40.758, lng: -73.985},
                {id: 2, title: "Post-Storm Medical Camp", location: "East Side Clinic", urgency: "high", category: "Medical", reported: "45m ago", lat: 40.762, lng: -73.972},
                {id: 3, title: "Emergency Shelter Setup", location: "Community Center", urgency: "critical", category: "Infrastructure", reported: "1h ago", lat: 40.745, lng: -73.990},
                {id: 4, title: "Clean Water Logistics", location: "Sector 7 Depot", urgency: "medium", category: "Logistics", reported: "2h ago", lat: 40.738, lng: -73.978},
                {id: 5, title: "Missing Person Search", location: "Forest Reserve", urgency: "critical", category: "Search & Rescue", reported: "5m ago", lat: 40.752, lng: -74.001}
            ];
        }
        // Fallback achievements
        if (totalPoints === 0) {
            totalPoints = 3850;
            workingScore = 92;
        }
    }
}

function renderAll() {
    renderNeeds();
    renderVolunteers();
    renderDiscoverTasks();
    renderMyTasks();
    updateDashboardStats();
    updateRewards();
}

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.view-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            sections.forEach(sec => {
                sec.classList.remove('active');
                if (sec.id === targetId) {
                    sec.classList.add('active');
                }
            });
            
            if (targetId === 'dashboard' || targetId === 'home') {
                setTimeout(() => {
                    if (mapInstance) {
                        mapInstance.invalidateSize();
                        initMap(); // Re-draw with lines
                    }
                }, 300);
            }
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
    initPortalTabs();
}

function initPortalTabs() {
    const portalTabs = document.querySelectorAll('.portal-tab');
    const portalPanels = document.querySelectorAll('.portal-panel');

    portalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            portalTabs.forEach(t => t.classList.remove('active'));
            portalPanels.forEach(p => p.classList.add('hidden'));

            tab.classList.add('active');
            const target = tab.getAttribute('data-portal-tab');
            const panel = document.getElementById(`portal-${target}`);
            if (panel) panel.classList.remove('hidden');
        });
    });
}

function getUrgencyBadgeClass(urgency) {
    switch(urgency?.toLowerCase()) {
        case 'critical': return 'urgency-critical';
        case 'high': return 'urgency-high';
        case 'medium': return 'urgency-medium';
        default: return 'urgency-medium';
    }
}

function getBestMatchForNeed(need) {
    if (!volunteersData || volunteersData.length === 0) return "AI Matching...";
    
    let bestMatch = null;
    let highestScore = -Infinity;

    volunteersData.forEach(vol => {
        let score = 0;
        if (vol.location === need.location) score += 40;
        if (vol.skills && vol.skills.includes(need.category)) score += 50;
        
        if (vol.lat && need.lat) {
            const dist = Math.sqrt(Math.pow(vol.lat - need.lat, 2) + Math.pow(vol.lng - need.lng, 2));
            score -= (dist * 100);
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = vol;
        }
    });

    return bestMatch ? bestMatch.name : "AI Matching...";
}

function renderNeeds() {
    const container = document.getElementById('needs-container');
    if (!container) return;
    if (needsData.length === 0) return;
    container.innerHTML = '';
    
    needsData.forEach(need => {
        const item = document.createElement('div');
        item.className = 'need-item';
        const isApplied = appliedTasks.some(t => t.id === need.id);
        const bestMatch = getBestMatchForNeed(need);

        item.innerHTML = `
            <div class="need-info">
                <h4>${need.title} ${isApplied ? '<span class="badge" style="font-size:0.6rem; padding:0.1rem 0.4rem; margin:0; vertical-align:middle;">Assigned</span>' : ''}</h4>
                <div class="need-meta">
                    <span><i class="fa-solid fa-location-dot"></i> ${need.location}</span>
                    <span><i class="fa-regular fa-clock"></i> ${need.reported}</span>
                </div>
                <div class="ai-recommendation" style="font-size: 0.75rem; color: var(--primary-light); margin-top: 5px;">
                    <i class="fa-solid fa-robot"></i> Best AI Match: <strong>${bestMatch}</strong>
                </div>
            </div>
            <div class="need-badge">
                <span class="urgency-badge ${getUrgencyBadgeClass(need.urgency)}">${need.urgency.toUpperCase()}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderVolunteers() {
    const container = document.getElementById('volunteers-container');
    if (!container) return;
    if (volunteersData.length === 0) return;
    container.innerHTML = '';
    
    volunteersData.forEach(vol => {
        const skillsHtml = vol.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
        const item = document.createElement('div');
        item.className = 'volunteer-card';
        item.innerHTML = `
            <div class="volunteer-avatar">${vol.avatar}</div>
            <div class="volunteer-info">
                <h4>${vol.name}</h4>
                <p><i class="fa-solid fa-location-dot"></i> ${vol.location}</p>
                <div class="skills-tags">
                    ${skillsHtml}
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderDiscoverTasks() {
    const container = document.getElementById('tasks-grid');
    if (!container) return;
    
    const availableTasks = needsData.filter(need => !appliedTasks.some(t => t.id === need.id));
    
    if (availableTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 4rem; opacity: 0.6;">
                <i class="fa-solid fa-circle-check" style="font-size: 4rem; color: var(--success); margin-bottom: 1.5rem; display: block;"></i>
                <h3 style="color: white; margin-bottom: 0.5rem;">All Missions Clear!</h3>
                <p>You have successfully handled all pending tasks in your sector.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    availableTasks.forEach(task => {
        const matchScore = Math.floor(Math.random() * 15) + 82;
        const card = document.createElement('div');
        card.className = 'glass-card task-card';
        card.setAttribute('data-need-id', task.id);
        card.style.position = 'relative';
        card.style.padding = '1.8rem';
        
        // Category Icons
        let icon = 'fa-briefcase';
        if (task.category === 'Food') icon = 'fa-bowl-food';
        if (task.category === 'Medical') icon = 'fa-house-medical';
        if (task.category === 'Infrastructure') icon = 'fa-building';
        if (task.category === 'Logistics') icon = 'fa-truck-fast';
        if (task.category === 'Search & Rescue') icon = 'fa-person-rays';

        card.innerHTML = `
            <div class="task-match" style="background: rgba(76, 201, 240, 0.2); color: var(--primary-light); padding: 4px 12px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; position: absolute; top: 15px; right: 15px; border: 1px solid rgba(76, 201, 240, 0.3);">
                <i class="fa-solid fa-robot"></i> ${matchScore}% MATCH
            </div>
            <div class="task-icon" style="width: 50px; height: 50px; border-radius: 15px; background: linear-gradient(135deg, rgba(67, 97, 238, 0.2), rgba(255,255,255,0.05)); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; font-size: 1.4rem; color: var(--primary-light); border: 1px solid rgba(255,255,255,0.1);">
                <i class="fa-solid ${icon}"></i>
            </div>
            <h4 style="margin-bottom: 0.8rem; font-size: 1.2rem; letter-spacing: -0.5px;">${task.title}</h4>
            <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 1.8rem; opacity: 0.8; font-size: 0.85rem;">
                <span style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-location-dot" style="color: var(--primary-light); width: 15px;"></i> ${task.location}</span>
                <span style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-clock" style="color: var(--text-muted); width: 15px;"></i> Reported ${task.reported}</span>
                <span style="display: flex; align-items: center; gap: 8px;"><i class="fa-solid fa-shield-halved" style="color: ${task.urgency === 'critical' ? 'var(--danger)' : 'var(--warning)'}; width: 15px;"></i> Priority: <strong style="color: ${task.urgency === 'critical' ? 'var(--danger)' : 'var(--warning)'};">${task.urgency.toUpperCase()}</strong></span>
            </div>
            <button class="btn btn-primary btn-glow w-100" style="padding: 1rem; border-radius: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-size: 0.9rem;" onclick="applyForTask(${task.id})">
                Accept Mission
            </button>
        `;
        container.appendChild(card);
    });
}

function renderMyTasks() {
    const container = document.getElementById('my-tasks-list');
    if (!container) return;
    
    if (appliedTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>You haven't applied for any tasks yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    appliedTasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'glass-card task-row';
        row.innerHTML = `
            <div class="task-details">
                <h4>${task.title}</h4>
                <span class="badge ${task.status === 'completed' ? '' : 'badge-ai'}" 
                      style="margin-top: 0.5rem; display: inline-block; ${task.status === 'completed' ? 'background: rgba(76, 201, 240, 0.2); color: var(--success);' : ''}">
                    ${task.status === 'completed' ? 'Completed' : 'Ongoing'}
                </span>
            </div>
            <div class="task-actions">
                ${task.status === 'completed' ? 
                    `<button class="btn btn-outline btn-sm" disabled><i class="fa-solid fa-check"></i> Done</button>` :
                    `<button class="btn btn-primary btn-sm" onclick="completeTask(${task.id})"><i class="fa-solid fa-camera"></i> Mark Complete</button>`
                }
            </div>
        `;
        container.appendChild(row);
    });
}

let currentMissionId = null;

function applyForTask(taskId) {
    const task = needsData.find(t => t.id === taskId);
    if (!task) return;

    currentMissionId = taskId;
    const modal = document.getElementById('mission-modal');
    if (!modal) return;
    
    // Populate Modal
    document.getElementById('mission-title').innerText = task.title;
    document.getElementById('mission-location').innerText = task.location;
    document.getElementById('mission-priority').innerText = task.urgency.toUpperCase();
    document.getElementById('mission-priority').style.color = task.urgency === 'critical' ? 'var(--danger)' : 'var(--warning)';
    
    // Skill tags
    const skillContainer = document.getElementById('mission-skills');
    skillContainer.innerHTML = '';
    const skills = [task.category, 'Field Work', 'Crisis Response'];
    skills.forEach(s => {
        const span = document.createElement('span');
        span.className = 'skill-tag';
        span.innerText = s;
        skillContainer.appendChild(span);
    });

    // Reset Match Animation
    document.getElementById('match-percent-modal').innerText = '0%';
    const circle = document.getElementById('match-circle');
    circle.style.strokeDashoffset = 283;

    modal.classList.remove('hidden');

    // Animate match after a small delay
    setTimeout(() => {
        const matchPercent = Math.floor(Math.random() * 15) + 82; // High match for volunteers
        document.getElementById('match-percent-modal').innerText = matchPercent + '%';
        const offset = 283 - (283 * matchPercent) / 100;
        circle.style.strokeDashoffset = offset;
    }, 600);
}

function completeTask(taskId) {
    const task = appliedTasks.find(t => t.id === taskId);
    if (task && task.status !== 'completed') {
        task.status = 'completed';
        totalPoints += 500;
        workingScore = Math.min(100, workingScore + 15);
        renderAll();
        showNotification(`Success! Verified 500 points & +15% Confidence.`, 'success');
        initMap(); // Refresh map to update lines
    }
}

function updateDashboardStats() {
    const total = needsData.length || 10;
    const assignedCount = appliedTasks.length;
    const percentage = Math.round((assignedCount / total) * 100);
    
    const circBar = document.getElementById('circular-progress-bar');
    const percText = document.getElementById('needs-met-percentage');
    
    if (circBar) circBar.style.setProperty('--value', percentage);
    if (percText) percText.innerText = `${percentage}%`;
    
    const categories = ['Medical', 'Food', 'Education'];
    categories.forEach(cat => {
        const bar = document.getElementById(`stat-${cat.toLowerCase()}`);
        const label = document.getElementById(`label-${cat.toLowerCase()}`);
        if (bar) {
            const val = Math.min(100, 20 + (appliedTasks.filter(t => t.category === cat && t.status === 'completed').length * 25));
            bar.style.width = `${val}%`;
            if (label) label.innerText = `${val}%`;
        }
    });
}

function updateRewards() {
    const pointsDisplay = document.getElementById('total-impact-points');
    if (pointsDisplay) pointsDisplay.innerText = totalPoints.toLocaleString();
    
    const levelText = document.getElementById('impact-level');
    const levelBar = document.getElementById('level-progress-bar');
    const nextLevelInfo = document.getElementById('next-level-info');
    
    let level = "Starter";
    let nextThreshold = 1000;
    let prevThreshold = 0;

    if (totalPoints >= 5000) { level = "Elite Impact Maker"; prevThreshold = 5000; nextThreshold = 10000; }
    else if (totalPoints >= 2500) { level = "Specialist Aid"; prevThreshold = 2500; nextThreshold = 5000; }
    else if (totalPoints >= 1000) { level = "Impact Maker"; prevThreshold = 1000; nextThreshold = 2500; }
    else if (totalPoints >= 500) { level = "Active Helper"; prevThreshold = 500; nextThreshold = 1000; }

    const progress = ((totalPoints - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    
    if (levelText) levelText.innerText = `Level: ${level}`;
    if (levelBar) levelBar.style.width = `${progress}%`;
    if (nextLevelInfo) nextLevelInfo.innerText = `${Math.round(progress)}% to next rank`;

    const confValue = document.getElementById('confidence-score-value');
    const confBar = document.getElementById('confidence-bar-fill');
    if (confValue) confValue.innerText = `${workingScore}%`;
    if (confBar) confBar.style.width = `${workingScore}%`;

    updateBadges();
    updateCertificates();
}

function updateBadges() {
    const container = document.getElementById('badges-container');
    if (!container) return;

    const badges = [
        { id: 'starter', icon: 'fa-seedling', color: 'text-success', label: 'Starter', unlocked: true },
        { id: 'first-mission', icon: 'fa-rocket', color: 'text-primary', label: 'First Mission', unlocked: appliedTasks.length > 0 },
        { id: 'helper', icon: 'fa-heart', color: 'text-danger', label: 'Active Helper', unlocked: totalPoints >= 500 },
        { id: 'expert', icon: 'fa-brain', color: 'text-info', label: 'Data Expert', unlocked: workingScore >= 50 },
        { id: 'hero', icon: 'fa-crown', color: 'text-warning', label: 'Community Hero', unlocked: totalPoints >= 2500 }
    ];

    container.innerHTML = badges.map(b => `
        <div class="badge-item ${b.unlocked ? '' : 'locked'}">
            <i class="fa-solid ${b.icon} ${b.unlocked ? b.color : ''}"></i>
            <span>${b.label}</span>
        </div>
    `).join('');
}

function updateCertificates() {
    const certs = [
        { id: 'cert-community', threshold: 1000, title: 'Community Hero' },
        { id: 'cert-expert', threshold: 2500, title: 'Specialist Aid' },
        { id: 'cert-elite', threshold: 5000, title: 'Elite Impact Maker' }
    ];

    certs.forEach(c => {
        const el = document.getElementById(c.id);
        if (!el) return;
        
        if (totalPoints >= c.threshold) {
            el.classList.remove('locked');
            el.classList.add('unlocked');
            const btn = el.querySelector('button');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Download';
            btn.onclick = () => generateCertificate(c.title);
        }
    });
}

function generateCertificate(title) {
    const name = "Sarah Jones"; 
    const date = new Date().toLocaleDateString();
    
    const certHtml = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 2rem;">
            <div class="certificate-preview" style="transform: scale(0.8);">
                <div style="border: 2px solid #333; padding: 2rem;">
                    <h1 style="font-family: 'Playfair Display', serif; color: var(--primary);">HelpNetra</h1>
                    <p style="text-transform: uppercase; letter-spacing: 2px; margin: 1rem 0;">Certificate of Impact</p>
                    <hr style="width: 50%; margin: 1rem auto;">
                    <p>This is to certify that</p>
                    <h2 style="margin: 1rem 0;">${name}</h2>
                    <p>has achieved the rank of</p>
                    <h3 style="color: var(--success); text-transform: uppercase;">${title}</h3>
                    <p style="margin-top: 1rem;">For exceptional dedication to community coordination and AI-driven social impact.</p>
                    <div style="margin-top: 2rem; display: flex; justify-content: space-around;">
                        <div>
                            <div style="border-bottom: 1px solid #333; width: 150px;"></div>
                            <p style="font-size: 0.7rem;">HelpNetra AI Board</p>
                        </div>
                        <div>
                            <div style="border-bottom: 1px solid #333; width: 150px;"></div>
                            <p style="font-size: 0.7rem;">Date: ${date}</p>
                        </div>
                    </div>
                </div>
                <div class="stamp">OFFICIAL</div>
                <button class="btn btn-primary mt-4" onclick="this.parentElement.parentElement.remove()">Close Preview</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', certHtml);
}

function showNotification(message, type = 'primary') {
    const toast = document.createElement('div');
    toast.className = `toast-notif bg-${type}`;
    toast.style = `position: fixed; bottom: 20px; right: 20px; padding: 1rem 2rem; border-radius: 10px; color: white; z-index: 10000; box-shadow: 0 10px 20px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function updateAIInsights() {
    const forecastText = document.getElementById('ai-forecast-text');
    if (!forecastText) return;
    const insights = [
        "Expect a 25% increase in food requests in East Side next week.",
        "AI detection suggests high probability of medical supply shortage in Sector 4.",
        "Optimization complete: 15 volunteers redirected to high-urgency zones.",
        "Recent weather analysis predicts localized flooding risk in North District.",
        "Education gap detected in South Village - 3 new tutors recommended."
    ];
    forecastText.style.opacity = 0;
    setTimeout(() => {
        forecastText.innerText = insights[Math.floor(Math.random() * insights.length)];
        forecastText.style.opacity = 1;
        forecastText.style.transition = "opacity 0.5s ease";
    }, 500);
}

function initAIMatch() {
    const runBtn = document.getElementById('run-ai-match');
    const statusDiv = document.getElementById('match-status');
    const assignmentsContainer = document.getElementById('assignments-container');
    
    if (!runBtn) return;

    runBtn.addEventListener('click', () => {
        runBtn.classList.add('hidden');
        statusDiv.classList.remove('hidden');
        assignmentsContainer.innerHTML = '';
        
        fetch(`${API_BASE_URL}/api/match`, { method: 'POST' })
        .then(res => res.json())
        .then(matches => {
            statusDiv.classList.add('hidden');
            runBtn.classList.remove('hidden');
            
            const availableMatches = matches.filter(m => !appliedTasks.some(t => t.id === m.task.id));
            
            if (availableMatches.length === 0) {
                assignmentsContainer.innerHTML = `
                    <div class="empty-state" style="animation: fadeIn 0.5s ease;">
                        <i class="fa-solid fa-clipboard-check text-success" style="font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 0 15px var(--success);"></i>
                        <p style="color: white; font-weight: bold;">All Tasks Assigned!</p>
                        <p class="text-sm">The AI has successfully routed all available volunteers.</p>
                    </div>`;
                return;
            }

            availableMatches.slice(0, 5).forEach((match, index) => {
                setTimeout(() => renderMatchCard(match, assignmentsContainer), index * 200);
            });
        }).catch(() => {
            console.warn("Backend API unavailable, using local mock AI match.");
            statusDiv.classList.add('hidden');
            runBtn.classList.remove('hidden');
            
            // Local fallback logic
            const matches = [];
            needsData.forEach(need => {
                if (appliedTasks.some(t => t.id === need.id)) return; // skip already assigned
                
                let bestVol = null;
                let highestScore = -Infinity;
                let reasoning = "General match based on availability.";

                volunteersData.forEach(vol => {
                    let score = 0;
                    let localReasoning = [];

                    if (vol.location === need.location) { 
                        score += 45; 
                        localReasoning.push("Sector Match");
                    }
                    if (vol.skills && vol.skills.includes(need.category)) { 
                        score += 50; 
                        localReasoning.push("Skill Alignment");
                    }
                    
                    let dist_km = 0;
                    if (vol.lat && need.lat) {
                        dist_km = Math.sqrt(Math.pow(vol.lat - need.lat, 2) + Math.pow(vol.lng - need.lng, 2)) * 111;
                        if (dist_km < 3) {
                            score += 30;
                            localReasoning.push("Ultra-Proximity");
                        }
                        score -= (dist_km * 0.5);
                    }

                    if (score > highestScore) {
                        highestScore = score;
                        bestVol = vol;
                        bestVol.dist_km = dist_km;
                        reasoning = localReasoning.length > 0 ? localReasoning.join(" • ") : "Optimal cross-sector resource allocation.";
                    }
                });

                if (bestVol && highestScore > 0) {
                    matches.push({
                        volunteer: bestVol,
                        task: need,
                        score: Math.max(70, Math.min(99, Math.floor(highestScore + Math.random() * 5))),
                        reasoning: reasoning,
                        distance: bestVol.dist_km > 0 ? bestVol.dist_km.toFixed(1) + " km" : "Local"
                    });
                }
            });

            if (matches.length === 0) {
                assignmentsContainer.innerHTML = `
                    <div class="empty-state" style="animation: fadeIn 0.5s ease;">
                        <i class="fa-solid fa-clipboard-check text-success" style="font-size: 3rem; margin-bottom: 1rem; text-shadow: 0 0 15px var(--success);"></i>
                        <p style="color: white; font-weight: bold;">All Tasks Assigned!</p>
                        <p class="text-sm">The AI has successfully routed all available volunteers.</p>
                    </div>`;
                return;
            }

            matches.sort((a, b) => b.score - a.score).slice(0, 5).forEach((match, index) => {
                setTimeout(() => renderMatchCard(match, assignmentsContainer), index * 200);
            });
        });
    });
}

function renderMatchCard(match, container) {
    const card = document.createElement('div');
    card.className = 'match-card glass-card';
    card.style.marginBottom = '1.5rem';
    card.style.padding = '1.8rem';
    card.style.position = 'relative';
    card.style.overflow = 'hidden';
    card.style.borderLeft = '4px solid var(--primary)';
    card.style.animation = 'slideIn 0.4s ease-out backwards';

    const matchPercent = match.score;

    card.innerHTML = `
        <div class="match-score-badge" style="position: absolute; top: 15px; right: 15px; background: rgba(67, 97, 238, 0.2); color: var(--primary-light); padding: 5px 12px; border-radius: 20px; font-weight: bold; font-size: 0.75rem; border: 1px solid rgba(67, 97, 238, 0.3);">
            <i class="fa-solid fa-robot"></i> ${matchPercent}% Match
        </div>
        <div style="display: flex; gap: 1.5rem; align-items: flex-start;">
            <div class="volunteer-avatar" style="width: 55px; height: 55px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-light)); display: flex; align-items: center; justify-content: center; font-weight: bold; color: white; font-size: 1.4rem; flex-shrink: 0; box-shadow: 0 0 15px rgba(67, 97, 238, 0.3);">
                ${match.volunteer.avatar || match.volunteer.name.substring(0, 2).toUpperCase()}
            </div>
            <div style="flex: 1;">
                <h4 style="margin-bottom: 0.4rem; font-size: 1.1rem; color: white;">${match.volunteer.name}</h4>
                <div style="font-size: 0.85rem; color: var(--primary-light); margin-bottom: 1rem; font-weight: 500;">
                    Target: <span style="color: white; opacity: 0.9;">${match.task.title}</span>
                </div>
                
                <div style="display: flex; gap: 1.2rem; margin-bottom: 1.2rem; font-size: 0.8rem; opacity: 0.7;">
                    <span><i class="fa-solid fa-location-dot" style="color: var(--primary-light); margin-right: 5px;"></i> ${match.distance || 'Local'}</span>
                    <span><i class="fa-solid fa-briefcase" style="color: var(--warning); margin-right: 5px;"></i> ${match.volunteer.skills?.slice(0,2).join(', ') || 'Field Ops'}</span>
                </div>
                
                <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 1.5rem;">
                    <div style="font-size: 0.7rem; color: var(--primary-light); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">AI Reasoning Protocol</div>
                    <p style="margin: 0; font-size: 0.85rem; line-height: 1.5; color: rgba(255,255,255,0.9); font-style: italic;">"${match.reasoning}"</p>
                </div>

                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" style="flex: 2; padding: 0.8rem; font-size: 0.9rem; border-radius: 10px; font-weight: bold;" onclick="confirmMatch('${match.volunteer.name.replace(/'/g, "\\'")}', '${match.task.title.replace(/'/g, "\\'")}', ${match.task.id})">
                        Deploy Volunteer
                    </button>
                    <button class="btn btn-outline" style="flex: 1; padding: 0.8rem; font-size: 0.85rem; border-radius: 10px;" onclick="this.closest('.match-card').style.opacity='0'; setTimeout(() => this.closest('.match-card').remove(), 300); showNotification('AI Match discarded.', 'info')">
                        Discard
                    </button>
                </div>
            </div>
        </div>
    `;
    container.appendChild(card);
}

function confirmMatch(volName, taskTitle, taskId) {
    const task = needsData.find(t => t.id === taskId);
    if (task) {
        if (!appliedTasks.some(t => t.id === taskId)) {
            appliedTasks.push({ ...task, status: 'ongoing', assignedTo: volName });
            renderAll();
            showNotification(`Mission Authorized: ${volName} deployed to ${taskTitle}.`, 'success');
            initMap();
        }
    }
}

function initDataCollection() {
    const tabBtns = document.querySelectorAll('.tab-btn[data-input-tab]');
    const panels = document.querySelectorAll('.input-panel');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(t => t.classList.remove('active'));
            panels.forEach(p => p.classList.add('hidden'));
            
            btn.classList.add('active');
            const target = btn.getAttribute('data-input-tab');
            const panel = document.getElementById(`panel-${target}`);
            if(panel) {
                panel.classList.remove('hidden');
                panel.style.animation = 'none';
                panel.offsetHeight; 
                panel.style.animation = 'fadeIn 0.4s ease forwards';
            }
        });
    });

    const analyzeBtn = document.getElementById('btn-analyze');
    const resultsDiv = document.getElementById('ai-results');
    
    if(analyzeBtn) {
        analyzeBtn.addEventListener('click', () => {
            const activeTab = document.querySelector('.tab-btn.active').getAttribute('data-input-tab');
            let textInput = '';
            if (activeTab === 'manual') textInput = document.getElementById('manual-text').value;
            else if (activeTab === 'upload') textInput = "Scanned document text";
            else if (activeTab === 'voice') textInput = "Transcribed voice audio";
            
            if (!textInput) textInput = "General community request";

            analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Deep Processing...';
            analyzeBtn.disabled = true;
            
            fetch(`${API_BASE_URL}/api/analyze`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ text: textInput })
            })
            .then(res => res.json())
            .then(data => {
                analyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyze with AI';
                analyzeBtn.disabled = false;
                resultsDiv.classList.remove('hidden');
                
                const summary = document.getElementById('ai-summary-text');
                if (summary) {
                    summary.innerHTML = `<strong>AI Confidence: ${Math.floor(Math.random() * 10) + 90}%</strong><br>Detected a ${data.category} request in ${data.location}. Our NLP model suggests immediate volunteer dispatch for maximum impact reduction.`;
                }

                document.getElementById('ai-type').innerText = data.category;
                document.getElementById('ai-urgency').innerText = data.urgency.toUpperCase();
                document.getElementById('ai-location').innerText = data.location;
                document.getElementById('ai-impact').innerText = data.impact;
                
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }).catch(err => {
                console.warn("Analysis API failed, using local mock", err);
                analyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analyze with AI';
                analyzeBtn.disabled = false;
                
                resultsDiv.classList.remove('hidden');
                
                const summary = document.getElementById('ai-summary-text');
                if (summary) {
                    summary.innerHTML = `<strong>AI Confidence: 94.2%</strong><br>Detected a ${textInput ? 'request related to your input' : 'community support need'} in a densely populated area. Our NLP model suggests immediate volunteer dispatch for maximum impact reduction.`;
                }

                document.getElementById('ai-type').innerText = "Healthcare & Aid";
                document.getElementById('ai-urgency').innerText = "HIGH PRIORITY";
                document.getElementById('ai-location').innerText = "Zone 4B (Matched via Geo-Tag)";
                document.getElementById('ai-impact').innerText = "Projected 150+ beneficiaries";
                
                resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });
    }

    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('click', () => {
            uploadArea.innerHTML = '<i class="fa-solid fa-brain fa-fade text-primary" style="font-size: 3rem; margin-bottom: 1rem;"></i><p>AI Scanning Image for OCR Data...</p>';
            setTimeout(() => {
                uploadArea.innerHTML = '<i class="fa-solid fa-check-circle text-success" style="font-size: 3rem; margin-bottom: 1rem;"></i><p class="text-success fw-bold">Hand-written data digitized successfully!</p>';
            }, 2500);
        });
    }
    
    const voiceArea = document.querySelector('.btn-voice');
    if (voiceArea) {
        let isRecording = false;
        voiceArea.addEventListener('click', () => {
            if (!isRecording) {
                isRecording = true;
                voiceArea.innerHTML = '<i class="fa-solid fa-stop"></i>';
                voiceArea.parentElement.querySelector('p').innerText = "Recording... Tap to stop.";
                voiceArea.classList.add('recording-active');
            } else {
                isRecording = false;
                voiceArea.innerHTML = '<i class="fa-solid fa-check"></i>';
                voiceArea.parentElement.querySelector('p').innerText = "Voice captured and transcribed.";
                voiceArea.classList.remove('recording-active');
                voiceArea.classList.add('success-glow');
            }
        });
    }

    const submitBtn = document.getElementById('btn-submit-data');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const needData = {
                category: document.getElementById('ai-type').innerText,
                title: document.getElementById('manual-text').value || "Community Request",
                location: document.getElementById('ai-location').innerText,
                urgency: document.getElementById('ai-urgency').innerText.toLowerCase()
            };
            
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
            submitBtn.disabled = true;

            fetch(`${API_BASE_URL}/api/needs`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ need: needData })
            })
            .then(res => res.json())
            .then(data => {
                submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Submitted Successfully';
                showNotification("Data collected and synced to system successfully!", "success");
                
                needsData.unshift(data);
                renderAll();
                
                setTimeout(() => {
                    document.getElementById('manual-text').value = '';
                    resultsDiv.classList.add('hidden');
                    submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirm & Submit to System';
                    submitBtn.disabled = false;
                    document.querySelector('[data-target="dashboard"]').click();
                }, 2000);
            })
            .catch(err => {
                console.warn("Submit API failed, using local fallback", err);
                const newId = needsData.length + 1;
                needData.id = newId;
                needData.lat = 40.70 + Math.random() * 0.1;
                needData.lng = -74.00 + Math.random() * 0.1;
                needData.reported = "Just now";
                
                needsData.unshift(needData);
                renderAll();
                
                submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Submitted Offline';
                showNotification("Saved locally. Will sync when online.", "warning");
                
                setTimeout(() => {
                    document.getElementById('manual-text').value = '';
                    resultsDiv.classList.add('hidden');
                    submitBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirm & Submit to System';
                    submitBtn.disabled = false;
                    document.querySelector('[data-target="dashboard"]').click();
                }, 2000);
            });
        });
    }
}

function initCommunication() {
    const btnNotif = document.getElementById('btn-notifications');
    const panelNotif = document.getElementById('notifications-panel');
    const btnChat = document.getElementById('btn-chat');
    const panelChat = document.getElementById('chat-window');

    if(btnNotif) {
        btnNotif.addEventListener('click', () => {
            panelNotif.classList.toggle('hidden');
            if(!panelChat.classList.contains('hidden')) panelChat.classList.add('hidden');
        });
    }
    
    if(btnChat) {
        btnChat.addEventListener('click', () => {
            panelChat.classList.toggle('hidden');
            if(!panelNotif.classList.contains('hidden')) panelNotif.classList.add('hidden');
            setTimeout(() => {
                const chatBody = document.querySelector('.chat-body');
                if(chatBody) chatBody.scrollTop = chatBody.scrollHeight;
            }, 100);
        });
    }

    const closeNotif = document.getElementById('close-notifications');
    const closeChat = document.getElementById('close-chat');
    if(closeNotif) closeNotif.addEventListener('click', () => panelNotif.classList.add('hidden'));
    if(closeChat) closeChat.addEventListener('click', () => panelChat.classList.add('hidden'));

    // Chat functionality
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatBody = document.querySelector('.chat-body');

    const sendMessage = () => {
        if(!chatInput || !chatBody) return;
        const msg = chatInput.value.trim();
        if(!msg) return;

        const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Add User Message
        const sentMsg = document.createElement('div');
        sentMsg.className = 'chat-message sent';
        sentMsg.innerHTML = `<p>${msg}</p><span class="chat-time">${time}</span>`;
        chatBody.appendChild(sentMsg);
        
        chatInput.value = '';
        chatBody.scrollTop = chatBody.scrollHeight;

        // Show typing indicator
        const typingIndicator = document.createElement('div');
        typingIndicator.className = 'chat-message received typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        chatBody.appendChild(typingIndicator);
        chatBody.scrollTop = chatBody.scrollHeight;

        // Simulate reply
        setTimeout(() => {
            typingIndicator.remove();
            const replies = [
                "Understood, we'll coordinate that immediately.",
                "Thanks for the update. Our team is on standby.",
                "AI routing activated. Dispatching resources now.",
                "Got it. Is there any additional support needed?"
            ];
            const replyMsg = document.createElement('div');
            replyMsg.className = 'chat-message received';
            replyMsg.innerHTML = `<p>${replies[Math.floor(Math.random() * replies.length)]}</p><span class="chat-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>`;
            chatBody.appendChild(replyMsg);
            chatBody.scrollTop = chatBody.scrollHeight;
            
            // Badge update
            const chatBadge = document.querySelector('#btn-chat .icon-badge');
            if(chatBadge) {
                chatBadge.innerText = parseInt(chatBadge.innerText || 0) + 1;
                chatBadge.style.animation = 'pulse-danger 1s';
                setTimeout(() => chatBadge.style.animation = '', 1000);
            }
        }, 1500);
    };

    if(chatSendBtn) chatSendBtn.addEventListener('click', sendMessage);
    if(chatInput) chatInput.addEventListener('keypress', (e) => {
        if(e.key === 'Enter') sendMessage();
    });

    // Mark all as read
    const markReadBtn = document.getElementById('mark-all-read');
    if(markReadBtn) {
        markReadBtn.addEventListener('click', () => {
            document.querySelectorAll('.notification-item.unread').forEach(item => {
                item.classList.remove('unread');
            });
            const notifBadge = document.querySelector('#btn-notifications .icon-badge');
            if(notifBadge) notifBadge.style.display = 'none';
        });
    }
}

let mapInstance = null;
function initMap() {
    const mapElement = document.getElementById('impact-map');
    if (!mapElement || typeof L === 'undefined') return;

    if (!mapInstance) {
        mapInstance = L.map('impact-map', {
            zoomControl: false,
            attributionControl: false
        }).setView([40.74, -73.97], 13);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstance);
        
        // Add zoom control to right
        L.control.zoom({ position: 'topright' }).addTo(mapInstance);

        // Add Legend
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = function() {
            const div = L.DomUtil.create('div', 'map-legend');
            div.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: var(--primary-light);">Live Field Operations</div>
                <div class="legend-item"><div class="legend-color" style="background: var(--primary);"></div> Volunteer (Online)</div>
                <div class="legend-item"><div class="legend-color" style="background: #ff4d6d;"></div> Critical Need</div>
                <div class="legend-item"><div class="legend-color" style="background: #ff9f1c;"></div> Medium Need</div>
                <div class="legend-item"><div class="legend-color" style="background: #4cc9f0;"></div> Active Assignment</div>
                <div class="legend-item" style="border-top: 1px solid rgba(255,255,255,0.1); margin-top: 5px; padding-top: 5px; font-size: 0.7rem; opacity: 0.8;">
                    <i class="fa-solid fa-signal fa-fade" style="color: var(--success); margin-right: 5px;"></i> Live Updates Active
                </div>
            `;
            return div;
        };
        legend.addTo(mapInstance);

        // Start Live Movement Simulation
        setInterval(simulateLiveMovement, 3000);
    }

    // Clear existing layers except base tile
    mapInstance.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer.options.isMarker) {
            mapInstance.removeLayer(layer);
        }
    });

    // Add Needs
    needsData.forEach(need => {
        if (need.lat && need.lng) {
            const needIcon = L.divIcon({
                className: `map-marker-need ${need.urgency}`,
                html: need.urgency === 'critical' ? '!' : '?',
                iconSize: [24, 24]
            });

            const marker = L.marker([need.lat, need.lng], { 
                icon: needIcon,
                isMarker: true 
            }).addTo(mapInstance);
            
            marker.bindPopup(`
                <div class="glass-card" style="padding: 10px; min-width: 150px; border: none; background: rgba(15,23,42,0.9);">
                    <strong style="color: ${need.urgency === 'critical' ? '#ff4d6d' : '#ff9f1c'}; display: block;">${need.title}</strong>
                    <span style="font-size: 0.8rem; color: #ccc;">Status: ${need.urgency.toUpperCase()}</span>
                    <hr style="margin: 8px 0; opacity: 0.2;">
                    <button class="btn btn-primary" style="width: 100%; font-size: 0.7rem; padding: 4px;" onclick="showNeedDetails(${need.id})">View Details</button>
                </div>
            `, { className: 'custom-popup' });

            // Find best volunteer match and draw a line
            let nearestVol = null;
            let highestScore = -Infinity;

            volunteersData.forEach(vol => {
                if (vol.lat && vol.lng) {
                    let score = 0;
                    if (vol.location === need.location) score += 40;
                    if (vol.skills && vol.skills.includes(need.category)) score += 50;
                    
                    const dist = Math.sqrt(Math.pow(vol.lat - need.lat, 2) + Math.pow(vol.lng - need.lng, 2));
                    score -= (dist * 100);
                    
                    if (score > highestScore) {
                        highestScore = score;
                        nearestVol = vol;
                    }
                }
            });

            if (nearestVol) {
                const isAssigned = appliedTasks.some(t => t.id === need.id);
                const line = L.polyline([[need.lat, need.lng], [nearestVol.lat, nearestVol.lng]], {
                    color: isAssigned ? '#4cc9f0' : '#f8961e',
                    weight: isAssigned ? 3 : 2,
                    dashArray: isAssigned ? '' : '8, 12',
                    opacity: isAssigned ? 0.8 : 0.4,
                    className: isAssigned ? 'assigned-line' : 'suggested-line'
                }).addTo(mapInstance);

                line.bindTooltip(`${isAssigned ? 'ACTIVE MISSION' : 'AI SUGGESTION'}: ${nearestVol.name}`, { sticky: true });
            }
        }
    });

    // Add Volunteers
    volunteersData.forEach(vol => {
        if (vol.lat && vol.lng) {
            const volIcon = L.divIcon({
                className: 'map-marker-pulse',
                html: '<div class="map-marker-volunteer" style="width: 12px; height: 12px;"></div>',
                iconSize: [12, 12]
            });

            const marker = L.marker([vol.lat, vol.lng], { 
                icon: volIcon,
                isMarker: true 
            }).addTo(mapInstance);
            
            marker.bindPopup(`
                <div style="text-align: center;">
                    <div style="font-weight: bold; color: var(--primary);">${vol.name}</div>
                    <div style="font-size: 0.7rem; color: #888;">Field Volunteer</div>
                    <div style="color: var(--success); font-size: 0.7rem; margin-top: 3px;">
                        <i class="fa-solid fa-circle fa-fade"></i> ONLINE
                    </div>
                </div>
            `);
        }
    });
}

function simulateLiveMovement() {
    if (!volunteersData.length) return;
    volunteersData.forEach(vol => {
        if (vol.lat && vol.lng) {
            // Nudge coordinates slightly
            vol.lat += (Math.random() - 0.5) * 0.00015;
            vol.lng += (Math.random() - 0.5) * 0.00015;
        }
    });
    initMap(); 
}

function initAuth() {
    const loginBtns = document.querySelectorAll('.auth-buttons .btn-outline'); 
    const signupBtns = document.querySelectorAll('.auth-buttons .btn-primary'); 
    const authModal = document.getElementById('auth-modal');
    const closeAuth = document.getElementById('close-auth');
    const authTabs = document.querySelectorAll('.auth-tab');
    const emailGroup = document.querySelector('.input-group-email');
    const phoneGroup = document.querySelector('.input-group-phone');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');
    const switchModeBtn = document.getElementById('auth-switch-mode');
    const switchText = document.getElementById('auth-switch-text');
    
    if (!authModal) return;

    let isSignup = false;
    let authMethod = 'email';

    const openModal = (signup = false) => {
        isSignup = signup;
        authTitle.innerText = isSignup ? 'Create Account' : 'Welcome Back';
        authSubtitle.innerText = isSignup ? 'Join the community and start your impact.' : 'Sign in to continue your impact.';
        submitBtn.innerHTML = isSignup ? 'Sign Up <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>' : 'Log In <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>';
        switchText.innerText = isSignup ? 'Already have an account?' : "Don't have an account?";
        switchModeBtn.innerText = isSignup ? 'Log In' : 'Sign Up';
        authModal.classList.remove('hidden');
    };

    loginBtns.forEach(btn => btn.addEventListener('click', () => openModal(false)));
    signupBtns.forEach(btn => btn.addEventListener('click', () => openModal(true)));
    
    if(closeAuth) closeAuth.addEventListener('click', () => authModal.classList.add('hidden'));

    if(switchModeBtn) switchModeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(!isSignup);
    });

    authTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            authTabs.forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = 'var(--text-muted)';
                t.style.boxShadow = 'none';
            });
            tab.classList.add('active');
            tab.style.background = 'var(--primary)';
            tab.style.color = 'white';
            tab.style.boxShadow = '0 4px 10px rgba(67, 97, 238, 0.3)';
            
            authMethod = tab.getAttribute('data-type');
            if(authMethod === 'email') {
                emailGroup.classList.remove('hidden');
                phoneGroup.classList.add('hidden');
                document.getElementById('auth-email').required = true;
                if(document.getElementById('auth-phone')) document.getElementById('auth-phone').required = false;
            } else {
                emailGroup.classList.add('hidden');
                phoneGroup.classList.remove('hidden');
                document.getElementById('auth-email').required = false;
                if(document.getElementById('auth-phone')) document.getElementById('auth-phone').required = true;
            }
        });
    });

    if(authForm) authForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
        submitBtn.disabled = true;
        
        let userName = "Volunteer";
        let userInitials = "V";
        let emailVal = "";
        let gradientStart = "var(--primary)";
        let gradientEnd = "var(--primary-light)";
        let firstName = "Volunteer";
        let lastName = "";

        if (authMethod === 'email') {
            emailVal = document.getElementById('auth-email').value;
            if (emailVal) {
                const namePart = emailVal.split('@')[0];
                const nameParts = namePart.split(/[._-]/);
                firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
                lastName = nameParts.length > 1 ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : "";
                userName = lastName ? `${firstName} ${lastName}` : firstName;
                userInitials = lastName ? firstName.charAt(0) + lastName.charAt(0) : firstName.substring(0, 2).toUpperCase();
                
                // Simple hash for gradient colors
                const hash = Array.from(emailVal).reduce((hash, char) => hash + char.charCodeAt(0), 0);
                const hue1 = hash % 360;
                const hue2 = (hash + 40) % 360;
                gradientStart = `hsl(${hue1}, 80%, 50%)`;
                gradientEnd = `hsl(${hue2}, 80%, 60%)`;
            }
        } else {
            const phoneVal = document.getElementById('auth-phone').value;
            if (phoneVal) {
                userName = phoneVal;
                userInitials = phoneVal.substring(phoneVal.length - 2);
                emailVal = "No email provided";
                firstName = phoneVal;
            }
        }
        
        setTimeout(() => {
            submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> Success';
            submitBtn.style.background = 'var(--success)';
            showNotification(isSignup ? "Account created successfully!" : "Logged in successfully!", "success");
            
            setTimeout(() => {
                authModal.classList.add('hidden');
                submitBtn.disabled = false;
                submitBtn.innerHTML = isSignup ? 'Sign Up <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>' : 'Log In <i class="fa-solid fa-arrow-right" style="margin-left: 5px;"></i>';
                submitBtn.style.background = '';
                
                // Update UI to logged in state
                const authBtnsContainer = document.querySelector('.auth-buttons');
                if (authBtnsContainer) {
                    authBtnsContainer.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 1rem; padding-right: 1rem;">
                            <div style="text-align: right; display: none; @media(min-width: 768px){display: block;}">
                                <strong style="color: white; font-size: 0.9rem; display: block;">${userName}</strong>
                                <span style="color: var(--success); font-size: 0.75rem;">Online</span>
                            </div>
                            <div id="user-profile-btn" class="volunteer-avatar" style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, ${gradientStart}, ${gradientEnd}); display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 0 15px ${gradientStart}; font-size: 1.1rem; font-weight: bold; border: 2px solid rgba(255,255,255,0.2); cursor: pointer; transition: transform 0.2s;">${userInitials}</div>
                        </div>
                    `;

                    // Bind Profile Modal Open
                    const profileBtn = document.getElementById('user-profile-btn');
                    const profileModal = document.getElementById('profile-modal');
                    
                    if (profileBtn && profileModal) {
                        profileBtn.addEventListener('click', () => {
                            // Populate Profile Modal
                            document.getElementById('profile-fname').value = firstName;
                            document.getElementById('profile-lname').value = lastName;
                            document.getElementById('profile-email-input').value = emailVal !== "No email provided" ? emailVal : "";
                            
                            const modalAvatar = document.getElementById('profile-modal-avatar');
                            if(modalAvatar) {
                                modalAvatar.innerText = userInitials;
                                modalAvatar.style.background = `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`;
                                modalAvatar.style.boxShadow = `0 0 20px ${gradientStart}`;
                            }
                            
                            profileModal.classList.remove('hidden');
                        });
                    }
                }
            }, 1000);
        }, 1500);
    });

    // Profile Modal Logic
    const profileModal = document.getElementById('profile-modal');
    const closeProfile = document.getElementById('close-profile');
    const profileForm = document.getElementById('profile-form');
    const saveProfileBtn = document.getElementById('profile-save-btn');

    if (closeProfile) {
        closeProfile.addEventListener('click', () => profileModal.classList.add('hidden'));
    }

    if (profileForm) {
        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
            saveProfileBtn.disabled = true;

            setTimeout(() => {
                saveProfileBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved Successfully';
                showNotification("Profile updated successfully!", "success");
                
                setTimeout(() => {
                    profileModal.classList.add('hidden');
                    saveProfileBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" style="margin-right: 5px;"></i> Save Changes';
                    saveProfileBtn.disabled = false;
                }, 1000);
            }, 1000);
        });
    }
}

function showNeedDetails(needId) {
    const need = needsData.find(n => n.id === needId);
    if (!need) return;
    
    // Switch to Discover/Needs view
    const needsLink = document.querySelector('[data-target="needs"]');
    if (needsLink) needsLink.click();
    
    showNotification(`Locating: ${need.title}`, "info");
    
    // Scroll to the specific need card if it exists
    setTimeout(() => {
        const card = document.querySelector(`[data-need-id="${needId}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.border = '2px solid var(--primary)';
            setTimeout(() => card.style.border = '', 3000);
        }
    }, 500);
}

// Bind Mission Modal Buttons
document.getElementById('close-mission')?.addEventListener('click', () => {
    document.getElementById('mission-modal').classList.add('hidden');
});

document.getElementById('reject-mission')?.addEventListener('click', () => {
    document.getElementById('mission-modal').classList.add('hidden');
    showNotification("Mission Declined. AI will re-route this task.", "info");
});

document.getElementById('confirm-mission')?.addEventListener('click', () => {
    if (currentMissionId) {
        const task = needsData.find(t => t.id === currentMissionId);
        if (task && !appliedTasks.some(t => t.id === currentMissionId)) {
            appliedTasks.push({ ...task, status: 'ongoing' });
            renderAll();
            showNotification(`Mission Accepted: ${task.title}. Field agents notified!`, 'success');
            initMap();
        }
        document.getElementById('mission-modal').classList.add('hidden');
    }
});
