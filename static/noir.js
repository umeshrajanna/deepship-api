// Check if user is logged in
function isUserLoggedIn() {
    return currentUser !== null && currentUser.token !== null && currentUser.token !== undefined;
}

// Show login panel
function openLoginPanel() {

    const loginPanel = document.getElementById('login-panel');
    const loginPanelBackdrop = document.getElementById('login-panel-backdrop');
    
    if (loginPanel && loginPanelBackdrop) {
        loginPanel.classList.add('active');
        loginPanelBackdrop.classList.add('active');
        clearUseCasesOnLogin();
    }
}

// Make sure this is at the TOP LEVEL of your JS file, not inside any other function
function toggleConversationsPanel() {
    const panel = document.querySelector('.conversations-panel');
 
    // panel.style.display = "flex"
    console.log('Toggle clicked, panel found:', !!panel);
    if (panel) {
        const wasCollapsed = panel.classList.contains('collapsed');
        panel.classList.toggle('collapsed');
        console.log('Was collapsed:', wasCollapsed, 'Now collapsed:', panel.classList.contains('collapsed'));
        
        // Save state to localStorage
        const isCollapsed = panel.classList.contains('collapsed');
        localStorage.setItem('conversations_panel_collapsed', isCollapsed);
         
    }
}

 
// On mobile, start with panel collapsed (hidden)
document.addEventListener('DOMContentLoaded', function() {
    // Mobile: start hidden
    if (window.innerWidth <= 1024) {
        document.querySelector('.conversations-panel')?.classList.add('mobile-hidden');
    }
    
    // Toggle button click
    const toggleBtn = document.getElementById('panel-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleConversationsPanel();
            console.log('Toggle button clicked!');
        });
    }
});

async function login() {
     
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    console.log('Login attempt with:', email);
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Response status:', response.status);
 
        if (response.ok) {
            const data = await response.json();
            console.log('Login data:', data);
            
            console.log("token ->" + data.access_token)
            
            // Store user data
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('username', data.username);
            
            currentUser = {
                user_id: data.user_id,
                email: data.email,
                token: data.access_token
            };
            
            console.log('currentUser set to:', currentUser);
            
            // Show logged in state in the panel
            showLoggedInState(email);
            
            // Load conversations
            loadConversations();
            
            showAuthSuccess('Login successful!');
        } else {
            const data = await response.json();
            showAuthError(data.detail || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showAuthError('Connection error: ' + error.message);
    }
}

    // Configure marked.js
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {}
            }
            return hljs.highlightAuto(code).value;
        }
    });
 
    // Auto-detect environment
    // const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    //     ? 'https://localhost:8082'
    //     : 'https://noirai-production.up.railway.app';

    // const API_URL = "https://www.deepship.dev"
    const API_URL = "http://127.0.0.1:8082"
    console.log('🌐 Environment:', window.location.hostname);
    console.log('🔗 API URL:', API_URL);
    
    let currentUser = null;
    let currentConversationId = null;
    let conversations = [];

// Helper function to get active messages container
function getActiveMessagesContainer() {
    if (isSplitScreenActive) {
        return document.getElementById('split-messages');
    }
    return document.getElementById('messages');
}

function groupConversationsByDate(conversations) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const groups = {
        today: { label: 'Today', conversations: [] },
        yesterday: { label: 'Yesterday', conversations: [] },
        week: { label: 'This Week', conversations: [] },
        month: { label: 'This Month', conversations: [] },
        older: { label: 'Older', conversations: [] }
    };
    
    conversations.forEach(conv => {
        const convDate = new Date(conv.updated_at);
        
        if (convDate >= today) {
            groups.today.conversations.push(conv);
        } else if (convDate >= yesterday) {
            groups.yesterday.conversations.push(conv);
        } else if (convDate >= weekAgo) {
            groups.week.conversations.push(conv);
        } else if (convDate >= monthAgo) {
            groups.month.conversations.push(conv);
        } else {
            groups.older.conversations.push(conv);
        }
    });
    
    return groups;
}

function collapseAll() {
    document.querySelectorAll('.date-group').forEach(g => g.classList.add('collapsed'));
}

function expandAll() {
    document.querySelectorAll('.date-group').forEach(g => g.classList.remove('collapsed'));
}

// Save state to localStorage
function toggleGroup(groupKey) {
    const collapsed = localStorage.getItem(`group_${groupKey}_collapsed`) === 'true';
    localStorage.setItem(`group_${groupKey}_collapsed`, !collapsed);
}

// Restore state on load
function restoreGroupStates() {
    document.querySelectorAll('.date-group').forEach((group, index) => {
        const keys = ['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'];
        const isCollapsed = localStorage.getItem(`group_${keys[index]}_collapsed`) === 'true';
        if (isCollapsed) {
            group.classList.add('collapsed');
        }
    });
}

//     function renderConversationsGrouped(conversations) {
//     console.log('Rendering conversations:', conversations);
//     const groups = groupConversationsByDate(conversations);

//     const container = document.querySelector('.conversations');

//     const filterSelect = document.getElementById('conversation-filter');

//     const selectedFilter = filterSelect ? filterSelect.value : 'all';
         
    
//     // container.innerHTML = '';
 
//     // Store all conversations for filtering
//     window.allConversations = conversations;
    
//     // Filter conversations based on selection
//     let conversationsToShow = [];
  
//     if (selectedFilter === 'all') {
//         // Show all, grouped by date with headers
//         Object.entries(groups).forEach(([key, group]) => {
//             if (group.conversations.length === 0) return;
            
//             // Add date header
//             const headerDiv = document.createElement('div');
//             headerDiv.className = 'date-header-simple';
//             headerDiv.innerHTML = `
//                 <span>${group.label}</span>
//                 <span class="date-count">${group.conversations.length}</span>
//             `;
//             container.appendChild(headerDiv);
            
//             // Add conversations
//             group.conversations.forEach(conv => {
//                 const div = createConversationItem(conv);
//                 container.appendChild(div);
//             });
//         });
//     } else {
//         // Show only selected time period
//         const selectedGroup = groups[selectedFilter];
//         if (selectedGroup && selectedGroup.conversations.length > 0) {
//             selectedGroup.conversations.forEach(conv => {
//                 const div = createConversationItem(conv);
//                 container.appendChild(div);
//             });
//         } else {
//             container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 11px;">No conversations in this period</div>';
//         }
//     }
// }

function renderConversationsGrouped(conversations) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🎨 renderConversationsGrouped() CALLED');
    console.log('═══════════════════════════════════════');
    console.log('Input:');
    console.log('   - conversations.length:', conversations.length);
    console.log('   - conversations:', conversations);
    
    const groups = groupConversationsByDate(conversations);
    console.log('   - groups:', groups);

    const container = document.querySelector('.conversations');
    console.log('   - container element found?', !!container);
    
    const filterSelect = document.getElementById('conversation-filter');
    const selectedFilter = filterSelect ? filterSelect.value : 'all';
    console.log('   - selectedFilter:', selectedFilter);
    
    // Clear container
    if (container) {
        container.innerHTML = '';
        console.log('✅ Container cleared');
    }
 
    // Store all conversations for filtering
    window.allConversations = conversations;
    console.log('✅ Stored in window.allConversations');
    
    // Filter conversations based on selection
    if (selectedFilter === 'all') {
        console.log('📋 Rendering ALL conversations with date headers...');
        
        let totalRendered = 0;
        Object.entries(groups).forEach(([key, group]) => {
            if (group.conversations.length === 0) {
                console.log(`   Skipping empty group: ${key}`);
                return;
            }
            
            console.log(`   Rendering group: ${key} (${group.conversations.length} convs)`);
            
            // Add date header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'date-header-simple';
            headerDiv.innerHTML = `
                <span>${group.label}</span>
                <span class="date-count">${group.conversations.length}</span>
            `;
            container.appendChild(headerDiv);
            
            // Add conversations
            group.conversations.forEach((conv, idx) => {
                console.log(`      Adding conversation ${idx + 1}:`, {
                    id: conv.id,
                    title: conv.title
                });
                const div = createConversationItem(conv);
                container.appendChild(div);
                totalRendered++;
            });
        });
        
        console.log(`✅ Rendered ${totalRendered} conversations total`);
    } else {
        console.log(`📋 Rendering FILTERED conversations: ${selectedFilter}`);
        
        // Show only selected time period
        const selectedGroup = groups[selectedFilter];
        if (selectedGroup && selectedGroup.conversations.length > 0) {
            selectedGroup.conversations.forEach(conv => {
                const div = createConversationItem(conv);
                container.appendChild(div);
            });
            console.log(`✅ Rendered ${selectedGroup.conversations.length} conversations`);
        } else {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 11px;">No conversations in this period</div>';
            console.log('ℹ️ No conversations in selected period');
        }
    }
    
    console.log('✅ renderConversationsGrouped() COMPLETED');
    console.log('═══════════════════════════════════════');
    console.log('');
}

// function createConversationItem(conv) {
//     const div = document.createElement('div');
//     div.className = 'conversation-item';
    
//     // Only add active class if this conversation is actually selected
//     if (conv.id === currentConversationId) {
//         div.classList.add('active');
//     }
    
//     div.dataset.id = conv.id;
    
//     div.innerHTML = `
//         <span class="conversation-title">${escapeHtml(conv.title)}</span>
//         <button class="delete-btn" onclick="deleteConversation('${conv.id}', event)">×</button>
//     `;
    
//     div.addEventListener('click', (e) => {
//         if (!e.target.classList.contains('delete-btn')) {
//             selectConversation(conv.id);
//         }
//     });
    
//     return div;
// }

//    async function loadConversations() {
 
//     if (!currentUser || !currentUser.token) {
//         console.log('No user logged in, skipping conversation load');
//         return;
//     } 
//     console.log(currentUser.token)
//     try {
//          console.log("token is ->" + currentUser.token)
//         const response = await fetch(`${API_URL}/conversations`, {
//             headers: {
//                 'Authorization': `Bearer ${currentUser.token}`
//             }
//         });
        
         
//         if (response.ok) {
//             const conversations = await response.json();
//             console.log('Loaded conversations:', conversations);
//             renderConversationsGrouped(conversations);
            
//             // DON'T auto-select any conversation on load
//             // Let the user click one or start a new chat
//         } else {
//             console.error('Failed to load conversations:', response.status);
//         }

//         updateConversationTooltips();
//     } catch (error) {
//         console.log('Failed to load conversations:' + error.toString());
//     }
// }

function createConversationItem(conv) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    
    // Only add active class if this conversation is actually selected
    if (conv.id === currentConversationId) {
        div.classList.add('active');
    }
    
    div.dataset.id = conv.id;
    
    div.innerHTML = `
        <span class="conversation-title">${escapeHtml(conv.title).substring(0,35) + "..."}</span>
        <button class="delete-btn" onclick="deleteConversation('${conv.id}', event)">×</button>
    `;
    
    div.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn')) {
            selectConversation(conv.id);
        }
    });
    
    return div;
}

async function loadConversations() {
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📞 loadConversations() CALLED');
    console.log('═══════════════════════════════════════');
    
    if (!currentUser || !currentUser.token) {
        console.log('❌ No user logged in, skipping conversation load');
        console.log('   - currentUser:', currentUser);
        console.log('   - currentUser.token:', currentUser?.token);
        return;
    }
    
    console.log('✅ User is logged in');
    console.log('   - currentUser.user_id:', currentUser.user_id);
    console.log('   - currentUser.email:', currentUser.email);
    console.log('   - currentUser.token:', currentUser.token?.substring(0, 20) + '...');
    
    try {
        const url = `${API_URL}/conversations`;
        console.log('');
        console.log('📡 Fetching conversations from:', url);
        console.log('   - Authorization header:', `Bearer ${currentUser.token.substring(0, 20)}...`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            }
        });
        
        console.log('📥 Response received:');
        console.log('   - Status:', response.status);
        console.log('   - OK?', response.ok);
        console.log('   - Status Text:', response.statusText);
        
        if (response.ok) {
            const conversations = await response.json();
            console.log('');
            console.log('✅ Conversations loaded successfully');
            console.log('   - Total conversations:', conversations.length);
            console.log('   - Conversations:', conversations.map(c => ({
                id: c.id,
                title: c.title,
                updated_at: c.updated_at
            })));
            
            console.log('');
            console.log('🎨 Rendering conversations...');
            renderConversationsGrouped(conversations);
            console.log('✅ renderConversationsGrouped() completed');
            
            // Check what was actually rendered
            const renderedItems = document.querySelectorAll('.conversation-item');
            console.log('');
            console.log('📊 After rendering:');
            console.log('   - Items in DOM:', renderedItems.length);
            console.log('   - Item details:', Array.from(renderedItems).map(item => ({
                id: item.dataset.id,
                title: item.querySelector('.conversation-title')?.textContent
            })));
            
            // DON'T auto-select any conversation on load
            // Let the user click one or start a new chat
        } else {
            console.error('❌ Failed to load conversations');
            console.error('   - Status:', response.status);
            console.error('   - Response text:', await response.text());
        }

        updateConversationTooltips();
        
    } catch (error) {
        console.error('');
        console.error('❌ Error in loadConversations():');
        console.error('   - Error message:', error.message);
        console.error('   - Error stack:', error.stack);
        console.error('');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📞 loadConversations() FINISHED');
    console.log('═══════════════════════════════════════');
    console.log('');
}

    function renderConversations() {
        const container = document.getElementById('conversations');
        container.innerHTML = '';

        conversations.forEach(conv => {
            console.log('Conversation:', conv.title, 'Updated:', conv.updated_at);
            const div = document.createElement('div');
            div.className = 'conversation-item';
            if (conv.id === currentConversationId) {
                div.classList.add('active');
            }

            div.innerHTML = `<span class="conversation-title">${conv.title || 'New Chat'}</span>`;

            div.addEventListener('click', () => {
                selectConversation(conv.id, conv.title);
            });

            container.appendChild(div);
        });
    }

// Replace the existing event listener for new-conversation-btn

document.getElementById('new-conversation-btn').addEventListener('click', () => {
    // Clear apps data when starting new conversation
    window.appsData = {};
    
    currentConversationId = null;
    
    const container = getActiveMessagesContainer();
    if (container) {
        container.innerHTML = ``;
    }
    
    // const titleElement = document.getElementById('current-conversation-title');
    // if (titleElement) {
    //     titleElement.textContent = 'New Conversation';
    //     titleElement.classList.add('empty');
    // }
    
    // Remove active class from all conversations
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
});
 
async function selectConversation(id) {
    
    // Clear apps data when switching conversations
    window.appsData = {};
    
    // Close split screen if it's open
    if (isSplitScreenActive) {
        closeSplitScreen();
    }
    
    currentConversationId = id;
    await loadMessages(id);
    
    // Update conversation title in header
    const conv = window.allConversations?.find(c => c.id === id);
    // const titleElement = document.getElementById('current-conversation-title');
    // if (titleElement && conv) {
    //     titleElement.textContent = conv.title;
    //     titleElement.classList.remove('empty');
    // }
    
    // Remove active class from all items, then add to selected
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedItem = document.querySelector(`.conversation-item[data-id="${id}"]`);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }
    
    const container = getActiveMessagesContainer();
    if (container) {
        setTimeout(() => {
            container.scrollTop = 0;
        }, 100);
    }
    
    // Auto-activate split screen if conversation has apps
    // Longer delay to ensure messages are fully loaded and appsData is populated
    setTimeout(() => {
        if (window.appsData && Object.keys(window.appsData).length > 0) {
            
            // Get the first app to show in split screen
            const firstAppId = Object.keys(window.appsData)[0];
            const firstApp = window.appsData[firstAppId];
            const appHtml = Array.isArray(firstApp) ? firstApp[0] : firstApp;
            
            if (appHtml) {
                console.log('📱 Auto-activating split screen for conversation with apps');
                showSplitScreen(appHtml);
                
                // Setup selector after split screen is created
                setTimeout(() => {
                    if (typeof setupSplitAppSelector === 'function') {
                        setupSplitAppSelector();
                    }
                }, 200);
            }
        }
    }, 800); // Increased delay to 800ms
}

//    async function loadMessages(convId) {
    
//     try {
//         const headers = {};
//         const token = localStorage.getItem('access_token');
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const response = await fetch(`${API_URL}/conversations/${convId}/messages`, {
//             headers: headers
//         });
        
//         if (response.ok) {
//             const messages = await response.json();
//             const container = getActiveMessagesContainer();
//             if (container) {
//                 container.innerHTML = '';
//             }

//             if (messages && messages.length > 0) {
//                 messages.forEach(msg => {
//                     // Parse sources and reasoning steps
//                     let sources = null;
//                     let reasoningSteps = null;
//                     let assets = null;  

//                     if (msg.sources) {
//                         if (typeof msg.sources === 'string') {
//                             try {
//                                 sources = JSON.parse(msg.sources);
//                             } catch (e) {
//                                 console.error('Failed to parse sources:', e);
//                             }
//                         } else if (Array.isArray(msg.sources)) {
//                             sources = msg.sources;
//                         }
//                     }
                    
//                     if (msg.reasoning_steps) {
//                         if (typeof msg.reasoning_steps === 'string') {
//                             try {
//                                 reasoningSteps = JSON.parse(msg.reasoning_steps);
//                             } catch (e) {
//                                 console.error('Failed to parse reasoning steps:', e);
//                             }
//                         } else if (Array.isArray(msg.reasoning_steps)) {
//                             reasoningSteps = msg.reasoning_steps;
//                         }
//                     }

//                     // ADD THIS BLOCK - Parse assets
//                     if (msg.assets) {
//                         console.log('Raw assets from message:', msg.assets); // Debug log
//                         if (typeof msg.assets === 'string') {
//                             try {
//                                 assets = JSON.parse(msg.assets);
//                                 console.log('Parsed assets:', assets); // Debug log
//                             } catch (e) {
//                                 console.error('Failed to parse assets:', e);
//                             }
//                         } else if (Array.isArray(msg.assets)) {
//                             assets = msg.assets;
//                         }
//                     }

//                     let app = null;
                    
//                     if (msg.app) {
                    
//                         if (typeof msg.app === 'string') {
//                             try {
//                                 // app = JSON.parse(msg.app);
//                                 app = msg.app
                                 
//                             } catch (e) {
//                                 console.error('Failed to parse app:', e);
//                             }
//                         } else if (typeof msg.app === 'object') {
//                             app = msg.app;
//                         }
//                     }
                    
                    
//                     // Pass assets to appendMessage - UPDATE THIS LINE
//                     appendMessage(msg.role, msg.content, false, sources, reasoningSteps, msg.id, assets,app);
//                 });
                
//                 setTimeout(() => {
//                     if (container) {
//                         container.querySelectorAll('pre code').forEach((block) => {
//                             hljs.highlightElement(block);
//                         });
//                     }
//                 }, 100);
                
//                 if (container) {
//                     container.scrollTop = 0;
//                 }
//             } else {
//                 if (container) {
//                     container.innerHTML = '';
//                 }
//             }
//         }
//     } catch (error) {
//         console.error('Failed to load messages:', error);
//     }
// }

async function loadMessages(convId) {
    
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('📖 loadMessages() CALLED');
    console.log('═══════════════════════════════════════');
    console.log('   - Conversation ID:', convId);
    
    try {
        const headers = {};
        const token = localStorage.getItem('access_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('   - Auth token present');
        }
        
        const url = `${API_URL}/conversations/${convId}/messages`;
        console.log('   - Fetching from:', url);
        
        const response = await fetch(url, {
            headers: headers
        });
        
        console.log('   - Response status:', response.status);
        
        if (response.ok) {
            const messages = await response.json();
            console.log('');
            console.log('✅ Messages loaded:', messages.length);
            console.log('   - Full messages array:', messages);
            
            const container = getActiveMessagesContainer();
            if (container) {
                container.innerHTML = '';
                console.log('   - Container cleared');
            }

            if (messages && messages.length > 0) {
                messages.forEach((msg, msgIndex) => {
                    console.log('');
                    console.log('═══════════════════════════════════════');
                    console.log(`📨 Processing message ${msgIndex + 1}/${messages.length}:`);
                    console.log('═══════════════════════════════════════');
                    console.log('   - Role:', msg.role);
                    console.log('   - Content length:', msg.content?.length || 0);
                    console.log('   - Content preview:', msg.content?.substring(0, 100));
                    console.log('');
                    console.log('   - Role:', msg.role);
                    console.log('   - Content length:', msg.content?.length || 0);
                    console.log('   - Content preview:', msg.content?.substring(0, 100));
                    console.log('   - Message status:', msg.status);  // ← ADD THIS
                    console.log('');
 
                    console.log('🔍 RAW MESSAGE OBJECT:', msg);
                    console.log('');
                    console.log('🔍 REASONING STEPS INSPECTION:');
                    console.log('   - msg.reasoning_steps RAW:', msg.reasoning_steps);
                    console.log('   - Type:', typeof msg.reasoning_steps);
                    console.log('   - Is null?', msg.reasoning_steps === null);
                    console.log('   - Is undefined?', msg.reasoning_steps === undefined);
                    console.log('   - Is array?', Array.isArray(msg.reasoning_steps));
                    console.log('   - Is string?', typeof msg.reasoning_steps === 'string');
                    console.log('   - Truthy?', !!msg.reasoning_steps);
                    console.log('');
                    console.log('   - Has sources?', !!msg.sources);
                    console.log('   - Has reasoning_steps?', !!msg.reasoning_steps);
                    console.log('   - Has assets?', !!msg.assets);
                    console.log('   - Has app?', !!msg.app);
                    
                    // Parse sources and reasoning steps
                    let sources = null;
                    let reasoningSteps = null;
                    let assets = null;  

                    if (msg.sources) {
                        if (typeof msg.sources === 'string') {
                            try {
                                sources = JSON.parse(msg.sources);
                                console.log('   ✅ Parsed sources (string):', sources.length);
                            } catch (e) {
                                console.error('   ❌ Failed to parse sources:', e);
                            }
                        } else if (Array.isArray(msg.sources)) {
                            sources = msg.sources;
                            console.log('   ✅ Sources already array:', sources.length);
                        }
                    }
                    
                    console.log('');
                    console.log('⚙️ PARSING REASONING STEPS:');
                    if (msg.reasoning_steps) {
                        console.log('   🔍 reasoning_steps exists, attempting to parse...');
                        console.log('   🔍 Type:', typeof msg.reasoning_steps);
                        
                        if (typeof msg.reasoning_steps === 'string') {
                            console.log('   📝 It\'s a string, parsing JSON...');
                            console.log('   📝 String value:', msg.reasoning_steps);
                            try {
                                reasoningSteps = JSON.parse(msg.reasoning_steps);
                                console.log('   ✅ Successfully parsed reasoning steps!');
                                console.log('   ✅ Parsed array length:', reasoningSteps.length);
                                console.log('   ✅ Parsed content:', reasoningSteps);
                            } catch (e) {
                                console.error('   ❌ Failed to parse reasoning steps string!');
                                console.error('   ❌ Error:', e);
                                console.error('   ❌ String that failed:', msg.reasoning_steps);
                            }
                        } else if (Array.isArray(msg.reasoning_steps)) {
                            console.log('   ✅ Already an array!');
                            reasoningSteps = msg.reasoning_steps;
                            console.log('   ✅ Array length:', reasoningSteps.length);
                            console.log('   ✅ Array content:', reasoningSteps);
                        } else {
                            console.warn('   ⚠️ reasoning_steps is neither string nor array!');
                            console.warn('   ⚠️ Type:', typeof msg.reasoning_steps);
                            console.warn('   ⚠️ Value:', msg.reasoning_steps);
                        }
                    } else {
                        console.log('   ℹ️ No reasoning_steps in message (null/undefined)');
                    }
                    
                    console.log('');
                    console.log('📊 FINAL PARSED VALUES:');
                    console.log('   - sources:', sources?.length || 0, 'items');
                    console.log('   - reasoningSteps:', reasoningSteps?.length || 0, 'items');
                    console.log('   - reasoningSteps value:', reasoningSteps);

                    // Parse assets
                    if (msg.assets) {
                        console.log('   Raw assets from message:', msg.assets);
                        if (typeof msg.assets === 'string') {
                            try {
                                assets = JSON.parse(msg.assets);
                                console.log('   ✅ Parsed assets:', assets);
                            } catch (e) {
                                console.error('   ❌ Failed to parse assets:', e);
                            }
                        } else if (Array.isArray(msg.assets)) {
                            assets = msg.assets;
                        }
                    }

                    let app = null;
                    
                    if (msg.app) {
                        if (typeof msg.app === 'string') {
                            try {
                                app = msg.app;
                                console.log('   ✅ App loaded (string)');
                            } catch (e) {
                                console.error('   ❌ Failed to parse app:', e);
                            }
                        } else if (typeof msg.app === 'object') {
                            app = msg.app;
                            console.log('   ✅ App loaded (object)');
                        }
                    }
                    
                    // Create the message element
                    console.log('');
                    console.log('🎨 Creating message element...');
                    console.log('   - Content:', msg.content?.substring(0, 100) || 'EMPTY');
                    console.log('   - Has content?', !!(msg.content && msg.content.trim()));
                    console.log('   - Will pass reasoningSteps:', !!reasoningSteps, reasoningSteps?.length || 0);
                    console.log('   - Will pass sources:', !!sources, sources?.length || 0);
                    console.log('   - Will pass assets:', !!assets, assets?.length || 0);
                    console.log('   - Will pass app:', !!app);
                    
                    // appendMessage will handle everything including reasoning steps
                    const messageDiv = appendMessage(msg.role, msg.content, false, sources, reasoningSteps, msg.id, assets, app);
                    console.log('   ✅ Message element created');
                    console.log('   - messageDiv found?', !!messageDiv);
                    console.log('   - messageDiv classes:', messageDiv?.className);
                    
                    // ✅ CHECK IF MESSAGE IS INCOMPLETE - SHOW STREAMING INDICATOR
                    console.log('   🔍 Checking status for streaming indicator...');
                    console.log('   - Is assistant?', msg.role === 'assistant');
                    console.log('   - Has status?', !!msg.status);
                    console.log('   - Status value:', msg.status);
                    console.log('   - Is streaming?', msg.status === 'streaming');
                    console.log('   - Is processing?', msg.status === 'processing');

                
                    if (msg.role === 'assistant' && msg.status && (msg.status === 'streaming' || msg.status === 'processing')) {
                    console.log('   ⏳ Message is incomplete (status:', msg.status, ') - adding streaming indicator');
                    
                    // Try multiple selectors to find where to put the indicator
                    let targetElement = messageDiv.querySelector('.response-content');
                    
                    if (!targetElement) {
                        console.log('   - .response-content not found, trying .tab-content.active');
                        targetElement = messageDiv.querySelector('.tab-content.active');
                    }
                    
                    if (!targetElement) {
                        console.log('   - .tab-content.active not found, trying .message-content');
                        targetElement = messageDiv.querySelector('.message-content');
                    }
                    
                    console.log('   - Target element found?', !!targetElement);
                    console.log('   - Target element class:', targetElement?.className);
                    
                    if (targetElement) {
                        // Add streaming indicator if not already present
                        if (!targetElement.querySelector('.streaming-indicator')) {
                            const streamingIndicator = document.createElement('div');
                            streamingIndicator.className = 'streaming-indicator';
                            streamingIndicator.innerHTML = `
                                <div class="streaming-dot"></div>
                                <div class="streaming-dot"></div>
                                <div class="streaming-dot"></div>
                            `;
                            
                            // Append at the end
                            targetElement.appendChild(streamingIndicator);
                            console.log('   ✅ Added streaming indicator to incomplete message');
                        } else {
                            console.log('   ℹ️ Streaming indicator already exists');
                        }
                        
                        // Also add the streaming-message class to the parent
                        messageDiv.classList.add('streaming-message');
                        console.log('   ✅ Added streaming-message class');
                    } else {
                        console.error('   ❌ Could not find any suitable element to add indicator');
                        console.error('   - Message structure:', messageDiv.innerHTML.substring(0, 200));
                    }
                }
                
                else {
                    console.log('   ℹ️ Not adding streaming indicator - conditions not met');
                }
                    console.log('═══════════════════════════════════════');
                });
                
                setTimeout(() => {
                    if (container) {
                        container.querySelectorAll('pre code').forEach((block) => {
                            hljs.highlightElement(block);
                        });
                    }
                }, 100);
                
                if (container) {
                    container.scrollTop = 0;
                }
            } else {
                if (container) {
                    container.innerHTML = '';
                }
            }
        }
    } catch (error) {
        console.error('');
        console.error('❌ Failed to load messages:', error);
        console.error('   Stack:', error.stack);
        console.error('');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('📖 loadMessages() FINISHED');
    console.log('═══════════════════════════════════════');
    console.log('');
}

async function downloadExport(messageId, format) {
    try {
        const token = localStorage.getItem('access_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_URL}/messages/${messageId}/export/${format}`, {
            headers: headers
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `noir-ai-response-${messageId.substring(0, 8)}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert(`Failed to generate ${format.toUpperCase()}`);
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Error downloading file');
    }
}

function downloadApp(index) {
    const htmlContent = window.appsData[index];
    if (!htmlContent) {
        alert('App content not available');
        return;
    }
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noir-app-${index}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

let isSplitScreenActive = false;
let currentAppHtml = null; 
 
function shouldShowCodeTab() {
    // Don't show code in deep search or lab mode
    return  isLabModeEnabled;
}
// function showSplitScreen(appHtml) {
    
//     currentAppHtml = appHtml;
//     isSplitScreenActive = true;
    
//     const container = document.querySelector('.container');
    
//     // Create split screen container if it doesn't exist
//     let splitContainer = document.getElementById('split-screen-container');
//     if (!splitContainer) {
//         splitContainer = document.createElement('div');
//         splitContainer.id = 'split-screen-container';
//         splitContainer.className = 'split-screen-container';
//         splitContainer.innerHTML = `
//             <div class="split-left">
//                 <div class="messages" id="split-messages"></div>
//                 <div class="input-area">
//                     <div class="input-container">
//                         <div id="split-input-placeholder"></div>
//                     </div>
//                 </div>
//             </div>
//             <div class="split-right">
//                 <div class="split-tabs">
//                     <div style="display: flex; gap: 8px; align-items: center;">
//                         <button class="split-tab active" data-tab="preview">
//                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
//                                 <circle cx="12" cy="12" r="3"></circle>
//                             </svg>
//                             Preview
//                         </button>
//                          ${shouldShowCodeTab() ? `
//                         <button class="split-tab" data-tab="code">
//                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <polyline points="16 18 22 12 16 6"></polyline>
//                                 <polyline points="8 6 2 12 8 18"></polyline>
//                             </svg>
//                             HTML
//                         </button>   ` : ''}
//                     </div>
//                     <div style="display: flex; gap: 8px; align-items: center;">
//                         <!-- App selector for multiple apps in conversation -->
//                         <div id="split-app-selector" style="display: none; align-items: center; gap: 6px;">
//                             <span style="font-size: 11px; color: rgba(255,255,255,0.6);">App:</span>
//                             <select id="split-app-select" class="version-dropdown" style="
//                                 padding: 6px 12px;
//                                 background: rgba(255,255,255,0.05);
//                                 border: 1px solid rgba(255,255,255,0.1);
//                                 border-radius: 6px;
//                                 color: #fff;
//                                 font-size: 12px;
//                                 font-family: 'Roboto Mono', monospace;
//                                 cursor: pointer;
//                             ">
//                             </select>
//                         </div>
//                         <button class="split-close" onclick="closeSplitScreen()">
//                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <line x1="18" y1="6" x2="6" y2="18"></line>
//                                 <line x1="6" y1="6" x2="18" y2="18"></line>
//                             </svg>
//                         </button>
//                     </div>
//                 </div>
//                 <div class="split-content-area">
//                     <div class="split-tab-content active" data-content="preview">
//                         <iframe id="split-preview-iframe" 
//                                 sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
//                                 class="split-preview-iframe"></iframe>
//                     </div>${shouldShowCodeTab() ? `
//                     <div class="split-tab-content" data-content="code">
//                         <pre class="split-code-block"><code class="language-html" id="split-html-code"></code></pre>
//                         <button class="split-copy-btn" onclick="copySplitHtml()">
//                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
//                                 <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
//                             </svg>
//                             Copy HTML
//                         </button>
//                     </div>` : ''}
//                 </div>
//             </div>
//         `;
//         container.appendChild(splitContainer);
        
//         // Setup tab listeners for right panel (Preview/HTML tabs)
//         splitContainer.querySelectorAll('.split-tab').forEach(tab => {
//             tab.addEventListener('click', function() {
//                 const targetTab = this.dataset.tab;
                
//                 splitContainer.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
//                 this.classList.add('active');
                
//                 splitContainer.querySelectorAll('.split-tab-content').forEach(content => {
//                     content.classList.remove('active');
//                 });
//                 splitContainer.querySelector(`[data-content="${targetTab}"]`).classList.add('active');
                
//                 // Re-highlight when switching to code tab
//                 if (targetTab === 'code') {
//                     setTimeout(() => {
//                         const codeBlock = document.getElementById('split-html-code');
//                         if (!codeBlock) return;
                        
//                         // Clear previous highlighting
//                         codeBlock.removeAttribute('data-highlighted');
//                         codeBlock.className = 'language-markup';
                        
//                         // Apply highlighting
//                         if (typeof hljs !== 'undefined') {
//                             hljs.highlightElement(codeBlock);
//                         } else if (typeof Prism !== 'undefined') {
//                             Prism.highlightElement(codeBlock);
//                         }
//                     }, 50);
//                 }
//             });
//         });
//     }
    
//     // Hide original messages container
//     const messagesContainer = document.getElementById('messages');
//     if (messagesContainer) {
//         messagesContainer.style.display = 'none';
//     }
    
//     // Hide original input area
//     const originalInputArea = document.querySelector('.chat-area > .input-area');
//     if (originalInputArea) {
//         originalInputArea.style.display = 'none';
//     }
    
//     // Show split screen
//     splitContainer.style.display = 'flex';
//     document.body.classList.add('split-screen-active');
    
//     // Collapse the conversations panel (leftmost sidebar)
//     const conversationsPanel = document.querySelector('.conversations-panel');
//     if (conversationsPanel && !conversationsPanel.classList.contains('collapsed')) {
//         // Store the state before collapsing (so we can restore it later if needed)
//         window.wasPanelCollapsedBeforeSplit = conversationsPanel.classList.contains('collapsed');
//         conversationsPanel.classList.add('collapsed');
//     }
    
//     // Move input wrapper to split view
//     const inputWrapper = document.querySelector('.input-wrapper');
//     const splitPlaceholder = document.getElementById('split-input-placeholder');
    
//     if (inputWrapper && splitPlaceholder) {
//         console.log('Moving input to split view');
//         splitPlaceholder.appendChild(inputWrapper);
//         inputWrapper.style.display = 'flex';
//     }
    
//     // Copy messages to split view
//     const splitMessages = document.getElementById('split-messages');
//     if (messagesContainer && splitMessages) {
//         splitMessages.innerHTML = messagesContainer.innerHTML;
        
//         // Re-attach tab click handlers to the copied tabs
//         splitMessages.querySelectorAll('.response-tab').forEach(tab => {
//             tab.addEventListener('click', function() {
//                 const messageDiv = this.closest('.message');
//                 const tabs = messageDiv.querySelectorAll('.response-tab');
//                 const tabContents = messageDiv.querySelectorAll('.tab-content');
//                 const targetTab = this.dataset.tab;
                
//                 // Special handling for Apps tab in split mode
//                 if (targetTab === 'apps') {
//                     const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
//                     if (firstTabContent) {
//                         const uniqueId = firstTabContent.id.split('-').pop();
//                         const appsTab = messageDiv.querySelector(`#apps-tab-${uniqueId}`);
//                         const iframe = appsTab ? appsTab.querySelector('iframe[id^="app-preview-iframe-"]') : null;
                        
//                         if (iframe) {
//                             const msgId = iframe.id.replace('app-preview-iframe-', '');
                            
//                             if (window.appsData && window.appsData[msgId]) {
//                                 const apps = window.appsData[msgId];
//                                 const appHtml = Array.isArray(apps) ? apps[0] : apps;
                                
//                                 // Update the right panel and selector
//                                 console.log('📱 Updating split screen app preview');
//                                 loadAppInSplit(appHtml);
//                                 currentAppHtml = appHtml;
                                
//                                 // Update the app selector to highlight this app
//                                 updateSplitAppSelector(msgId);
                                
//                                 return; // Don't switch tabs
//                             }
//                         }
//                     }
//                 }
                
//                 // Normal tab switching for other tabs
//                 tabs.forEach(t => t.classList.remove('active'));
//                 tabContents.forEach(tc => tc.classList.remove('active'));
                
//                 this.classList.add('active');
                
//                 const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
//                 if (firstTabContent) {
//                     const uniqueId = firstTabContent.id.split('-').pop();
//                     const targetContent = messageDiv.querySelector(`#${targetTab}-tab-${uniqueId}`);
//                     if (targetContent) {
//                         targetContent.classList.add('active');
//                     }
//                 }
//             });
//         });
        
//         // Re-attach export menu handlers
//         splitMessages.querySelectorAll('.export-btn').forEach(exportBtn => {
//             const messageId = exportBtn.id.replace('export-btn-', '');
//             const dropdown = splitMessages.querySelector(`#dropdown-${messageId}`);
            
//             if (dropdown) {
//                 exportBtn.addEventListener('click', (e) => {
//                     e.stopPropagation();
//                     dropdown.classList.toggle('show');
//                 });
                
//                 // Close dropdown when clicking outside
//                 document.addEventListener('click', (e) => {
//                     if (!exportBtn.contains(e.target)) {
//                         dropdown.classList.remove('show');
//                     }
//                 });
                
//                 dropdown.querySelectorAll('.export-option').forEach(option => {
//                     option.addEventListener('click', () => {
//                         const format = option.dataset.format;
//                         const msgId = option.dataset.messageId;
//                         downloadExport(msgId, format);
//                         dropdown.classList.remove('show');
//                     });
//                 });
//             }
//         });
        
//         // Scroll to bottom
//         setTimeout(() => {
//             splitMessages.scrollTop = 0;
//         }, 100);
//     }
    
//     // Set up observer to sync messages in real-time
//     if (messagesContainer && splitMessages) {
//         // Disconnect existing observer if any
//         if (window.splitMessagesObserver) {
//             window.splitMessagesObserver.disconnect();
//         }
        
//         const observer = new MutationObserver((mutations) => {
//             // Copy any new content from original to split
//             splitMessages.innerHTML = messagesContainer.innerHTML;
            
//             // Re-attach all event listeners again after mutation
//             splitMessages.querySelectorAll('.response-tab').forEach(tab => {
//                 const newTab = tab.cloneNode(true);
//                 tab.parentNode.replaceChild(newTab, tab);
                
//                 newTab.addEventListener('click', function() {
//                     const messageDiv = this.closest('.message');
//                     const tabs = messageDiv.querySelectorAll('.response-tab');
//                     const tabContents = messageDiv.querySelectorAll('.tab-content');
//                     const targetTab = this.dataset.tab;
                    
//                     // Special handling for Apps tab
//                     if (targetTab === 'apps') {
//                         const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
//                         if (firstTabContent) {
//                             const uniqueId = firstTabContent.id.split('-').pop();
//                             const appsTab = messageDiv.querySelector(`#apps-tab-${uniqueId}`);
//                             const iframe = appsTab ? appsTab.querySelector('iframe[id^="app-preview-iframe-"]') : null;
                            
//                             if (iframe) {
//                                 const msgId = iframe.id.replace('app-preview-iframe-', '');
                                
//                                 if (window.appsData && window.appsData[msgId]) {
//                                     const apps = window.appsData[msgId];
//                                     const appHtml = Array.isArray(apps) ? apps[0] : apps;
                                    
//                                     // Update the right panel
//                                     console.log('📱 Updating split screen app preview');
//                                     loadAppInSplit(appHtml);
//                                     currentAppHtml = appHtml;
                                    
//                                     // Update selector
//                                     updateSplitAppSelector(msgId);
                                    
//                                     return; // Don't switch tabs in left panel
//                                 }
//                             }
//                         }
//                     }
                    
//                     // Normal tab switching for other tabs
//                     tabs.forEach(t => t.classList.remove('active'));
//                     tabContents.forEach(tc => tc.classList.remove('active'));
                    
//                     this.classList.add('active');
                    
//                     const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
//                     if (firstTabContent) {
//                         const uniqueId = firstTabContent.id.split('-').pop();
//                         const targetContent = messageDiv.querySelector(`#${targetTab}-tab-${uniqueId}`);
//                         if (targetContent) {
//                             targetContent.classList.add('active');
//                         }
//                     }
//                 });
//             });
            
//             // Update app selector in case new apps were added
//             setupSplitAppSelector();
            
//             splitMessages.scrollTop = 0;
//         });

//         observer.observe(messagesContainer, {
//             childList: true,
//             subtree: true,
//             characterData: true
//         });
        
//         // Store observer to disconnect later
//         window.splitMessagesObserver = observer;
//     }
     
//     // Load app HTML
//     loadAppInSplit(appHtml);
    
//     // Setup app selector
//     setupSplitAppSelector();
// }
 
function showSplitScreen(appHtml) {
    
    currentAppHtml = appHtml;
    isSplitScreenActive = true;
    
    const container = document.querySelector('.container');
    
    // Create split screen container if it doesn't exist
    let splitContainer = document.getElementById('split-screen-container');
    if (!splitContainer) {
        splitContainer = document.createElement('div');
        splitContainer.id = 'split-screen-container';
        splitContainer.className = 'split-screen-container';
        splitContainer.innerHTML = `
            <div class="split-left" id="split-left-div">
                <div class="messages" id="split-messages"></div>
                <div class="input-area">
                    <div class="input-container">
                        <div id="split-input-placeholder"></div>
                    </div>
                </div>
            </div>
            <div class="split-right">
                <div class="split-tabs">

                 <button class="split-close" onclick="closeSplitScreen()"  id="closeSplitScreen">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>

                    <div style="display: flex; gap: 8px; align-items: center;">
                        <!-- App selector for multiple apps -->
                        <div id="split-app-selector" style="display: none; align-items: center; gap: 6px;">
                            
                            <select id="split-app-select" class="version-dropdown" >
                            </select>
                        </div>

                    </div>

                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="preview" data-tab="preview">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        ${true ? `
                        <button class="code" data-tab="code">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 18 22 12 16 6"></polyline>
                                <polyline points="8 6 2 12 8 18"></polyline>
                            </svg>
                       
                        </button>   ` : ''}
                    </div>
                       
                </div>
                <div class="split-content-area">
                    <div class="split-tab-content active" data-content="preview">
                        <iframe id="split-preview-iframe" 
                                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                                class="split-preview-iframe"></iframe>
                    </div>${shouldShowCodeTab() ? `
                    <div class="split-tab-content" data-content="code">
                        <pre class="split-code-block"><code class="language-html" id="split-html-code"></code></pre>
                        <button class="split-copy-btn" onclick="copySplitHtml()">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy HTML
                        </button>
                    </div>` : ''}
                </div>
            </div>
        `;
        container.appendChild(splitContainer);
        
        // Setup tab listeners for right panel
        splitContainer.querySelectorAll('.split-tab').forEach(tab => {
            tab.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                splitContainer.querySelectorAll('.split-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                splitContainer.querySelectorAll('.split-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                splitContainer.querySelector(`[data-content="${targetTab}"]`).classList.add('active');
                
                // Re-highlight when switching to code tab
                if (targetTab === 'code') {
                    setTimeout(() => {
                        const codeBlock = document.getElementById('split-html-code');
                        if (!codeBlock) return;
                        
                        codeBlock.removeAttribute('data-highlighted');
                        codeBlock.className = 'language-markup';
                        
                        if (typeof hljs !== 'undefined') {
                            hljs.highlightElement(codeBlock);
                        } else if (typeof Prism !== 'undefined') {
                            Prism.highlightElement(codeBlock);
                        }
                    }, 50);
                }
            });
        });
    }
    
    // Hide original messages container
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
        messagesContainer.style.display = 'none';
    }
    
    // Hide original input area
    const originalInputArea = document.querySelector('.chat-area > .input-area');
    if (originalInputArea) {
        originalInputArea.style.display = 'none';
    }
    
    // Show split screen
    splitContainer.style.display = 'flex';
    document.body.classList.add('split-screen-active');
    
    // Collapse conversations panel
    const conversationsPanel = document.querySelector('.conversations-panel');
    if (conversationsPanel && !conversationsPanel.classList.contains('collapsed')) {
        window.wasPanelCollapsedBeforeSplit = conversationsPanel.classList.contains('collapsed');
        conversationsPanel.classList.add('collapsed');
    }
    
    // Move input wrapper to split view (desktop only)
    if (window.innerWidth > 1024) {
        const inputWrapper = document.querySelector('.input-wrapper');
        const splitPlaceholder = document.getElementById('split-input-placeholder');
        
        if (inputWrapper && splitPlaceholder) {
            splitPlaceholder.appendChild(inputWrapper);
            inputWrapper.style.display = 'flex';
        }
    }
    
    
    // Copy messages to split view
    const splitMessages = document.getElementById('split-messages');
    if (messagesContainer && splitMessages) {
        splitMessages.innerHTML = messagesContainer.innerHTML;
        
        // Re-attach event handlers (existing code...)
        // ... your existing event handler code ...
        
        // Scroll to bottom
        setTimeout(() => {
            splitMessages.scrollTop = 0;
        }, 100);
    }
    
    // Set up observer to sync messages (existing code...)
    // ... your existing observer code ...
     
    // Load app HTML
    loadAppInSplit(appHtml);
    
    // Setup app selector
    setupSplitAppSelector();

    // Re-attach tab click handlers to the copied tabs
        splitMessages.querySelectorAll('.response-tab').forEach(tab => {
            // Remove existing listeners by cloning
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            newTab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Save scroll position
                const currentScrollTop = splitMessages ? splitMessages.scrollTop : 0;
                
                const messageDiv = this.closest('.message');
                const tabs = messageDiv.querySelectorAll('.response-tab');
                const tabContents = messageDiv.querySelectorAll('.tab-content');
                const targetTab = this.dataset.tab;
                
                console.log('🔘 Tab clicked in split view:', targetTab);
                
                // Special handling for Apps tab in split mode
                if (targetTab === 'apps') {
                    const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
                    if (firstTabContent) {
                        const uniqueId = firstTabContent.id.split('-').pop();
                        const appsTab = messageDiv.querySelector(`#apps-tab-${uniqueId}`);
                        const iframe = appsTab ? appsTab.querySelector('iframe[id^="app-preview-iframe-"]') : null;
                        
                        if (iframe) {
                            const msgId = iframe.id.replace('app-preview-iframe-', '');
                            
                            if (window.appsData && window.appsData[msgId]) {
                                const apps = window.appsData[msgId];
                                const appHtml = Array.isArray(apps) ? apps[0] : apps;
                                
                                console.log('📱 Updating split screen app preview');
                                loadAppInSplit(appHtml);
                                currentAppHtml = appHtml;
                                updateSplitAppSelector(msgId);
                                
                                // Restore scroll
                                if (splitMessages) {
                                    splitMessages.scrollTop = currentScrollTop;
                                }
                                return;
                            }
                        }
                    }
                }
                
                // Normal tab switching for other tabs
                console.log('✅ Switching to tab:', targetTab);
                
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                this.classList.add('active');
                
                const firstTabContent = messageDiv.querySelector('[id^="answer-tab-"]');
                if (firstTabContent) {
                    const uniqueId = firstTabContent.id.split('-').pop();
                    const targetContent = messageDiv.querySelector(`#${targetTab}-tab-${uniqueId}`);
                    
                    console.log('Looking for content:', `#${targetTab}-tab-${uniqueId}`);
                    console.log('Found content:', !!targetContent);
                    
                    if (targetContent) {
                        targetContent.classList.add('active');
                        console.log('✅ Content activated');
                    } else {
                        console.error('❌ Content not found!');
                    }
                }
                
                // Restore scroll position
                if (splitMessages) {
                    splitMessages.scrollTop = currentScrollTop;
                }
            });
        });
}
function setupSplitAppSelector() {
    const appSelector = document.getElementById('split-app-selector');
    const appSelect = document.getElementById('split-app-select');
    
    if (!appSelector || !appSelect || !window.appsData) return;
    
    // Collect all apps from all messages in the conversation
    const allApps = [];
    let currentAppIndex = -1;
    
    // Get all messages to find user messages before each app
    const messagesContainer = document.getElementById('messages') || document.getElementById('split-messages');
    const allMessageDivs = messagesContainer ? messagesContainer.querySelectorAll('.message') : [];
    
    for (const [msgId, apps] of Object.entries(window.appsData)) {
        const appHtml = Array.isArray(apps) ? apps[0] : apps; // Each message has one app
        
        if (appHtml) {
            const appIndex = allApps.length;
            
            // Check if this is the currently displayed app
            if (appHtml === currentAppHtml) {
                currentAppIndex = appIndex;
            }
            
            // Find the assistant message with this app
            let userMessageText = 'App';
            const assistantMsg = Array.from(allMessageDivs).find(msg => {
                const iframe = msg.querySelector(`iframe[id="app-preview-iframe-${msgId}"]`);
                return iframe !== null;
            });
            
            // If found, get the previous user message
            if (assistantMsg) {
                let prevElement = assistantMsg.previousElementSibling;
                while (prevElement) {
                    if (prevElement.classList.contains('message') && prevElement.classList.contains('user')) {
                        const userContent = prevElement.querySelector('.message-content');
                        if (userContent) {
                            userMessageText = userContent.textContent.trim();
                            // Slice to 50 characters
                            if (userMessageText.length > 50) {
                                userMessageText = userMessageText.substring(0, 50) + '...';
                            }
                        }
                        break;
                    }
                    prevElement = prevElement.previousElementSibling;
                }
            }
            
            allApps.push({ 
                msgId, 
                appHtml,
                label: userMessageText
            });
        }
    }
    
    // Only show selector if there are multiple apps
    if (allApps.length > 1) {
        appSelect.innerHTML = '';
        
        allApps.forEach((appData, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = appData.label;
            option.title = appData.label; // Full text on hover
            if (index === currentAppIndex) {
                option.selected = true;
            }
            appSelect.appendChild(option);
        });
        
        // Add change handler
        appSelect.onchange = function() {
            const selectedIndex = parseInt(this.value);
            const appData = allApps[selectedIndex];
            loadAppInSplit(appData.appHtml);
            currentAppHtml = appData.appHtml;
            console.log(`Switched to: "${appData.label}" (Message ID: ${appData.msgId})`);
        };
        
        appSelector.style.display = 'flex';
    } else {
        appSelector.style.display = 'none';
    }
}

function updateSplitAppSelector(msgId) {
    const appSelect = document.getElementById('split-app-select');
    if (!appSelect || !window.appsData) return;
    
    // Find the index of this msgId in the selector
    const allApps = [];
    const messagesContainer = document.getElementById('messages') || document.getElementById('split-messages');
    const allMessageDivs = messagesContainer ? messagesContainer.querySelectorAll('.message') : [];
    
    for (const [id, apps] of Object.entries(window.appsData)) {
        const appHtml = Array.isArray(apps) ? apps[0] : apps;
        if (appHtml) {
            allApps.push({ msgId: id, appHtml });
        }
    }
    
    // Find and select the matching option
    for (let i = 0; i < allApps.length; i++) {
        if (allApps[i].msgId === msgId) {
            appSelect.value = i;
            break;
        }
    }
}

//  function loadAppInSplit(htmlContent) {
     
//     // Load preview
//     const iframe = document.getElementById('split-preview-iframe');
//     if (iframe) {
//         const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
//         iframeDoc.open();
        
//         // Check if content is markdown (doesn't start with < or <!DOCTYPE)
//         const isMarkdown = !htmlContent.trim().startsWith('<') && !htmlContent.trim().toLowerCase().startsWith('<!doctype');
        
//         if (isMarkdown && typeof marked !== 'undefined') {
//             // Render markdown as HTML with proper structure
//             const renderedHtml = `
//                 <!DOCTYPE html>
//                 <html>
//                 <head>
//                     <meta charset="UTF-8">
//                     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//                     <style>
//                         body {
//                             font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
//                             line-height: 1.6;
//                             padding: 20px;
//                             max-width: 800px;
//                             margin: 0 auto;
//                             color: #333;
//                             background: #fff;
//                         }
//                         h1, h2, h3, h4, h5, h6 {
//                             margin-top: 24px;
//                             margin-bottom: 16px;
//                             font-weight: 600;
//                         }
//                         p {
//                             margin-bottom: 16px;
//                         }
//                         code {
//                             background: #f6f8fa;
//                             padding: 2px 6px;
//                             border-radius: 3px;
//                             font-family: 'Courier New', monospace;
//                             font-size: 0.9em;
//                         }
//                         pre {
//                             background: #f6f8fa;
//                             padding: 16px;
//                             border-radius: 6px;
//                             overflow-x: auto;
//                         }
//                         pre code {
//                             background: none;
//                             padding: 0;
//                         }
//                         a {
//                             color: #0366d6;
//                             text-decoration: none;
//                         }
//                         a:hover {
//                             text-decoration: underline;
//                         }
//                         img {
//                             max-width: 100%;
//                             height: auto;
//                         }
//                         blockquote {
//                             border-left: 4px solid #dfe2e5;
//                             padding-left: 16px;
//                             margin-left: 0;
//                             color: #6a737d;
//                         }
//                         table {
//                             border-collapse: collapse;
//                             width: 100%;
//                             margin-bottom: 16px;
//                         }
//                         table th, table td {
//                             border: 1px solid #dfe2e5;
//                             padding: 8px 12px;
//                         }
//                         table th {
//                             background: #f6f8fa;
//                             font-weight: 600;
//                         }
//                     </style>
//                 </head>
//                 <body>
//                     ${marked.parse(htmlContent)}
//                 </body>
//                 </html>
//             `;
//             iframeDoc.write(renderedHtml);
//         } else {
//             // Write HTML directly
//             iframeDoc.write(htmlContent);
//         }
        
//         iframeDoc.close();
//     } 
    
//     // Only load HTML code if code tab should be shown (lab mode)
//     if (shouldShowCodeTab()) {
//         const codeBlock = document.getElementById('split-html-code');
//         if (codeBlock) {
//             codeBlock.textContent = htmlContent;
//             codeBlock.className = 'language-markup';
//             delete codeBlock.dataset.highlighted;
             
//             if (typeof Prism !== 'undefined') {
//                 const splitRight = document.querySelector('.split-right');
//                 if (splitRight) {
//                     splitRight.querySelectorAll('code[data-highlighted="yes"]').forEach(block => {
//                         delete block.dataset.highlighted;
//                     });
//                     Prism.highlightAllUnder(splitRight);
//                 }
//             }
//         }
//     }
// }

function loadAppInSplit(htmlContent) {
         
    // Load preview
    const iframe = document.getElementById('split-preview-iframe');
    if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        
        // Check if content is markdown (doesn't start with < or <!DOCTYPE)
        const isMarkdown = !htmlContent.trim().startsWith('<') && !htmlContent.trim().toLowerCase().startsWith('<!doctype');
        
        if (isMarkdown && typeof marked !== 'undefined') {
            // Render markdown as HTML with proper structure
            const renderedHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                            line-height: 1.6;
                            padding: 20px;
                            max-width: 800px;
                            margin: 0 auto;
                            color: #333;
                            background: #F6F5EF;
                            font-size: 14px;
                            
                        }
                        h1, h2, h3, h4, h5, h6 {
                            margin-top: 24px;
                            margin-bottom: 16px;
                            font-weight: 600;
                        }
                        p {
                            margin-bottom: 16px;
                        }
                        code {
                            background: #f6f8fa;
                            padding: 2px 6px;
                            border-radius: 3px;
                            font-family: 'Courier New', monospace;
                            font-size: 0.9em;
                        }
                        pre {
                            background: #f6f8fa;
                            padding: 16px;
                            border-radius: 6px;
                            overflow-x: auto;
                        }
                        pre code {
                            background: none;
                            padding: 0;
                        }
                        a {
                            color: #0366d6;
                            text-decoration: none;
                        }
                        a:hover {
                            text-decoration: underline;
                        }
                        img {
                            max-width: 100%;
                            height: auto;
                        }
                        blockquote {
                            border-left: 4px solid #dfe2e5;
                            padding-left: 16px;
                            margin-left: 0;
                            color: #6a737d;
                        }
                        table {
                            border-collapse: collapse;
                            width: 100%;
                            margin-bottom: 16px;
                        }
                        table th, table td {
                            border: 1px solid #dfe2e5;
                            padding: 8px 12px;
                        }
                        table th {
                            background: #f6f8fa;
                            font-weight: 600;
                        }
                    </style>
                </head>
                <body>
                    ${marked.parse(htmlContent)}
                </body>
                </html>
            `;
            iframeDoc.write(renderedHtml);
        } else {
            // For HTML content, inject background style if not present
            let modifiedHtml = htmlContent;
            
            // Check if HTML has a body tag
            if (modifiedHtml.includes('<body')) {
                // Add background style to existing body tag
                modifiedHtml = modifiedHtml.replace(
                    /<body([^>]*)>/i,
                    '<body$1 style="background: #1a1a1a; margin: 0; padding: 0;">'
                );
            } else if (modifiedHtml.includes('<html')) {
                // Has HTML tag but no body, add body wrapper
                modifiedHtml = modifiedHtml.replace(
                    '</html>',
                    '<style>body { background: #1a1a1a; margin: 0; padding: 0; }</style></html>'
                );
            } else {
                // No HTML structure, wrap it
                modifiedHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body {
                                background: #1a1a1a;
                                margin: 0;
                                padding: 0;
                            }
                        </style>
                    </head>
                    <body>
                        ${htmlContent}
                    </body>
                    </html>
                `;
            }
            
            iframeDoc.write(modifiedHtml);
        }
        
        iframeDoc.close();
    } 
    
    // Only load HTML code if code tab should be shown (lab mode)
    if (shouldShowCodeTab()) {
        const codeBlock = document.getElementById('split-html-code');
        if (codeBlock) {
            codeBlock.textContent = htmlContent;
            codeBlock.className = 'language-markup';
            delete codeBlock.dataset.highlighted;
             
            if (typeof Prism !== 'undefined') {
                const splitRight = document.querySelector('.split-right');
                if (splitRight) {
                    splitRight.querySelectorAll('code[data-highlighted="yes"]').forEach(block => {
                        delete block.dataset.highlighted;
                    });
                    Prism.highlightAllUnder(splitRight);
                }
            }
        }
    }

    
}
//  function closeSplitScreen() {
//     isSplitScreenActive = false;
//     currentAppHtml = null;
    
//     // Disconnect observer
//     if (window.splitMessagesObserver) {
//         window.splitMessagesObserver.disconnect();
//         window.splitMessagesObserver = null;
//     }
    
//     const splitContainer = document.getElementById('split-screen-container');
//     const messagesContainer = document.getElementById('messages');
//     const chatArea = document.querySelector('.chat-area');
//     const inputWrapper = document.querySelector('.input-wrapper');
    
//     // *** ENHANCED FIX: Save scroll position and lock it ***
//     const splitMessages = document.getElementById('split-messages');
//     const savedScrollPosition = splitMessages ? splitMessages.scrollTop : 0;
    
//     // Temporarily disable smooth scrolling
//     const originalScrollBehavior = document.documentElement.style.scrollBehavior;
//     document.documentElement.style.scrollBehavior = 'auto';
    
//     // Lock the scroll by preventing scroll events
//     let scrollLocked = true;
//     const preventScroll = (e) => {
//         if (scrollLocked) {
//             e.preventDefault();
//             e.stopPropagation();
//         }
//     };
    
//     // Add scroll lock
//     if (messagesContainer) {
//         messagesContainer.addEventListener('scroll', preventScroll, { passive: false });
//     }
//     document.addEventListener('scroll', preventScroll, { passive: false });
//     window.addEventListener('scroll', preventScroll, { passive: false });
    
//     if (splitContainer) {
//         splitContainer.style.display = 'none';
//     }
    
//     document.body.classList.remove('split-screen-active');
    
//     // Restore conversations panel to its previous state (optional)
//     const conversationsPanel = document.querySelector('.conversations-panel');
//     if (conversationsPanel && window.wasPanelCollapsedBeforeSplit === false) {
//         conversationsPanel.classList.remove('collapsed');
//     }
    
//     // Move input back to original chat area
//     if (inputWrapper && chatArea) {
//         let originalInputArea = chatArea.querySelector('.input-area');
        
//         if (originalInputArea) {
//             let inputContainer = originalInputArea.querySelector('.input-container');
//             if (!inputContainer) {
//                 inputContainer = document.createElement('div');
//                 inputContainer.className = 'input-container';
//                 originalInputArea.appendChild(inputContainer);
//             }
//             inputContainer.appendChild(inputWrapper);
//             originalInputArea.style.display = 'flex';
//         }
//     }
    
//     // Show messages container again
//     if (messagesContainer) {
//         messagesContainer.style.display = 'block';
        
//         // Force immediate scroll position restoration
//         messagesContainer.scrollTop = savedScrollPosition;
        
//         // Use multiple RAF to ensure position sticks
//         requestAnimationFrame(() => {
//             messagesContainer.scrollTop = savedScrollPosition;
            
//             requestAnimationFrame(() => {
//                 messagesContainer.scrollTop = savedScrollPosition;
                
//                 // Remove scroll lock after everything settles
//                 setTimeout(() => {
//                     scrollLocked = false;
//                     if (messagesContainer) {
//                         messagesContainer.removeEventListener('scroll', preventScroll);
//                     }
//                     document.removeEventListener('scroll', preventScroll);
//                     window.removeEventListener('scroll', preventScroll);
                    
//                     // Restore original scroll behavior
//                     document.documentElement.style.scrollBehavior = originalScrollBehavior;
//                 }, 100);
//             });
//         });
//     }
// //  if (window.innerWidth <= 1024) {
// //     requestAnimationFrame(() => {
// //         requestAnimationFrame(() => {
// //             const inputWrapper = document.querySelector('.input-wrapper');
// //             if (inputWrapper) {
// //                 // Set to 100% width
// //                 inputWrapper.style.setProperty('left', 'auto', 'important');
// //                 inputWrapper.style.setProperty('right', 'auto', 'important');
// //                 inputWrapper.style.setProperty('position', 'relative', 'important');
// //                 inputWrapper.style.setProperty('width', '88vw', 'important');
// //                 inputWrapper.style.setProperty('max-width', '100%', 'important');
// //                 inputWrapper.style.setProperty('min-width', '100%', 'important');
// //                 inputWrapper.style.setProperty('transform', 'none', 'important');
// //                 inputWrapper.style.setProperty('margin', '0', 'important');
// //                 inputWrapper.style.setProperty('display', 'flex', 'important');
// //             }
// //         });
// //     });
// // }

// // setTimeout(() => {
// //     const inputWrapper = document.querySelector('.input-wrapper');
// //     console.log('Input wrapper found?', !!inputWrapper);
    
// //     if (inputWrapper) {
// //         console.log('Parent element:', inputWrapper.parentElement?.className);
// //         console.log('Inline styles:', inputWrapper.style.cssText);
        
// //         const computed = window.getComputedStyle(inputWrapper);
// //         console.log('Computed left:', computed.left);
// //         console.log('Computed right:', computed.right);
// //         console.log('Computed position:', computed.position);
// //         console.log('Computed width:', computed.width);
// //     }
// // }, 600);

// }

function closeSplitScreen() {
    isSplitScreenActive = false;
    currentAppHtml = null;
    
    // Disconnect observer
    if (window.splitMessagesObserver) {
        window.splitMessagesObserver.disconnect();
        window.splitMessagesObserver = null;
    }
    
    const splitContainer = document.getElementById('split-screen-container');
    const messagesContainer = document.getElementById('messages');
    const chatArea = document.querySelector('.chat-area');
    const inputWrapper = document.querySelector('.input-wrapper');
    
    // Save scroll position and lock it
    const splitMessages = document.getElementById('split-messages');
    const savedScrollPosition = splitMessages ? splitMessages.scrollTop : 0;
    
    // Temporarily disable smooth scrolling
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Lock the scroll by preventing scroll events
    let scrollLocked = true;
    const preventScroll = (e) => {
        if (scrollLocked) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    // Add scroll lock
    if (messagesContainer) {
        messagesContainer.addEventListener('scroll', preventScroll, { passive: false });
    }
    document.addEventListener('scroll', preventScroll, { passive: false });
    window.addEventListener('scroll', preventScroll, { passive: false });
    
    if (splitContainer) {
        splitContainer.style.display = 'none';
    }
    
    document.body.classList.remove('split-screen-active');
    
    // Restore conversations panel to its previous state
    const conversationsPanel = document.querySelector('.conversations-panel');
    if (conversationsPanel && window.wasPanelCollapsedBeforeSplit === false) {
        conversationsPanel.classList.remove('collapsed');
    }
    
    // Remove hidden class from split-left
    const splitLeft = document.querySelector('.split-left');
    if (splitLeft) {
        splitLeft.classList.remove('hidden');
    }
    
    // Remove active class from split-right
    const splitRight = document.querySelector('.split-right');
    if (splitRight) {
        splitRight.classList.remove('active');
    }
    
    // Move input back to original chat area
    if (inputWrapper && chatArea) {
        let originalInputArea = chatArea.querySelector('.input-area');
        
        if (originalInputArea) {
            let inputContainer = originalInputArea.querySelector('.input-container');
            if (!inputContainer) {
                inputContainer = document.createElement('div');
                inputContainer.className = 'input-container';
                originalInputArea.appendChild(inputContainer);
            }
            inputContainer.appendChild(inputWrapper);
            originalInputArea.style.display = 'flex';
            
            // Clear inline styles from input-wrapper
            inputWrapper.removeAttribute('style');
            
            // Force reflow to ensure CSS recalculates
            void inputWrapper.offsetHeight;
        }
    }
    
    // Show messages container again
    if (messagesContainer) {
        messagesContainer.style.display = 'block';
        
        // Force immediate scroll position restoration
        messagesContainer.scrollTop = savedScrollPosition;
        
        // Use multiple RAF to ensure position sticks
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = savedScrollPosition;
            
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = savedScrollPosition;
                
                // Remove scroll lock after everything settles
                setTimeout(() => {
                    scrollLocked = false;
                    if (messagesContainer) {
                        messagesContainer.removeEventListener('scroll', preventScroll);
                    }
                    document.removeEventListener('scroll', preventScroll);
                    window.removeEventListener('scroll', preventScroll);
                    
                    // Restore original scroll behavior
                    document.documentElement.style.scrollBehavior = originalScrollBehavior;
                }, 100);
            });
        });
    }
}

function copySplitHtml() {
    if (!currentAppHtml) return;
    
    navigator.clipboard.writeText(currentAppHtml).then(() => {
        const btn = document.querySelector('.split-copy-btn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            btn.innerHTML = originalHtml;
        }, 2000);
    });
}

// Modify the appendMessage function to detect apps
// Add this after the existing appendMessage function
// const originalAppendMessage = appendMessage;
// function appendMessage2(role, content, isStreaming = false, sources = null, reasoningSteps = null, messageId = null, assets = null, app = null) {
//     // Call original function
//      console.log("showing split screen")
//     const result = originalAppendMessage(role, content, isStreaming, sources, reasoningSteps, messageId, assets, app);
    
//     // Check if there's an app and auto-open split screen
//     if (role === 'assistant' && app && !isStreaming) {
//         // Small delay to ensure message is rendered
//         setTimeout(() => {
           
//             showSplitScreen(app);
//         }, 500);
//     }
    
//     return result;
// }

  function renderAppsTab(apps) {
    if (!apps || (Array.isArray(apps) && apps.length === 0)) {
        return '<div class="no-content">No apps available</div>';
    }
    
    // Convert single app to array format for backwards compatibility
    const appsArray = Array.isArray(apps) ? apps : [apps];
    
    // Store all apps globally
    if (!window.appsData) {
        window.appsData = {};
    }
    
    const messageId = Date.now(); // Use a unique ID for this message
    window.appsData[messageId] = appsArray;
    
    // Current selected version (default to latest - last in array)
    let currentVersion = appsArray.length - 1;
    
    const html = `
        <div class="apps-container">
        
            <div class="app-preview-container" id="app-preview-${messageId}">
                <div class="app-preview-header">
                    <div class="app-preview-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="9" y1="3" x2="9" y2="21"></line>
                        </svg>
                        <span id="app-title-${messageId}">Interactive App</span>
                        ${appsArray.length > 1 ? `
                            <div class="app-version-selector">
                                <select id="version-select-${messageId}" class="version-dropdown" onchange="switchAppVersion(${messageId}, parseInt(this.value))">
                                    ${appsArray.map((app, index) => `
                                        <option value="${index}" ${index === currentVersion ? 'selected' : ''}>
                                            v${index}${index === appsArray.length - 1 ? ' (Latest)' : ''}
                                        </option>
                                    `).join('')}
                                </select>
                                <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                        ` : `<span class="app-version-badge">v${currentVersion}</span>`}
                    </div>
                    <div class="app-preview-actions">
                        <button class="action-btn" id="split-btn-${messageId}" onclick="showSplitScreenVersion(${messageId}, parseInt(document.getElementById('version-select-${messageId}')?.value || ${currentVersion}))">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                            Split View
                        </button>
                        <button class="action-btn" id="fullscreen-btn-${messageId}" onclick="openAppFullscreenVersion(${messageId}, parseInt(document.getElementById('version-select-${messageId}')?.value || ${currentVersion}))">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                            </svg>
                            Fullscreen
                        </button>
                        <button class="action-btn" id="download-btn-${messageId}" onclick="downloadAppVersion(${messageId}, parseInt(document.getElementById('version-select-${messageId}')?.value || ${currentVersion}))">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download
                        </button>
                    </div>
                </div>
                <div class="app-preview-iframe-container">
                    <iframe 
                        id="app-preview-iframe-${messageId}"
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
                        class="app-preview-iframe"
                    ></iframe>
                </div>
            </div>
        </div>
    `;
    
    // Initialize iframe with latest version AFTER the DOM is ready
    setTimeout(() => {
        const iframe = document.getElementById(`app-preview-iframe-${messageId}`);
        if (iframe && appsArray[currentVersion]) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(appsArray[currentVersion]);
            iframeDoc.close();
        }
    }, 100);
    
    return html;
}
 function openAppFullscreen(index) {
    const htmlContent = window.appsData[index];
    if (!htmlContent) {
        alert('App content not available');
        return;
    }
    
    // Create fullscreen overlay with download button
    const overlay = document.createElement('div');
    overlay.className = 'app-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="app-fullscreen-container">
            <div class="app-fullscreen-header">
                <span class="app-fullscreen-title">Interactive App</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="app-fullscreen-download" onclick="event.stopPropagation(); downloadApp(0)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download HTML
                    </button>
                    <button class="app-fullscreen-close" onclick="this.closest('.app-fullscreen-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Close
                    </button>
                </div>
            </div>
            <iframe 
                id="fullscreen-app-iframe"
                class="app-fullscreen-iframe" 
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            ></iframe>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Write content to iframe after it's in the DOM
    setTimeout(() => {
        const iframe = document.getElementById('fullscreen-app-iframe');
        if (iframe) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(htmlContent);
            iframeDoc.close();
        }
    }, 0);
}

function autoOpenAppsFullscreen() {
    // This will be called when Apps tab becomes active
    setTimeout(() => {
        if (window.appsData && window.appsData[0]) {
            openAppFullscreen(0);
        }
    }, 100);
}
// Download app as HTML file
function downloadAppHTML(index, title) {
    const htmlContent = window.appsData[index];
    if (!htmlContent) {
        alert('App content not available');
        return;
    }
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_app.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// function appendMessage(role, content, isStreaming = false, sources = null, reasoningSteps = null, messageId = null, assets = null, app = null) {
     
//     const container = getActiveMessagesContainer();
//     if (!container) return;
    
//     const emptyState = container.querySelector('.empty-state');
//     if (emptyState) {
//         emptyState.remove();
//     }

//     const messageDiv = document.createElement('div');
//     messageDiv.className = `message ${role}`;
    
//     // Store message ID as data attribute
//     if (messageId) {
//         messageDiv.dataset.messageId = messageId;
//     }

//     let displayContent;
//     if (role === 'assistant' && !isStreaming) {
//         displayContent = renderMarkdown(content);
//     } else if (role === 'user') {
//         displayContent = escapeHtml(content);
//     } else {
//         displayContent = content;
//     }
    
//     // Check if this is an assistant message with sources, reasoning steps, or assets
//     const hasSources = sources && sources.length > 0;
//     const hasSteps = reasoningSteps && reasoningSteps.length > 0;
//     const hasAssets = assets && assets.length > 0;
//     const hasApp = app !== null && app !== undefined; 

//     if (role === 'assistant' && (hasSources || hasSteps || hasAssets || hasApp)) {
//         // Generate unique ID - ensure it's truly unique
//         let uniqueId = Date.now();
//         while (document.querySelector(`#answer-tab-${uniqueId}`)) {
//             uniqueId++;
//         }
        
//         const hasCategorizedSources = reasoningSteps && reasoningSteps.some(step => 
//             step.category && step.query && step.sources
//         );
        
//         // Build tabs HTML with new Sources tab rendering
//         const sourcesTabHtml = hasCategorizedSources ? `
//             <div class="tab-content" id="sources-tab-${uniqueId}">
//                 ${renderCategorizedSources(reasoningSteps)}
//             </div>
//         ` : hasSources ? `
//             <div class="tab-content" id="sources-tab-${uniqueId}">
//                 <div class="sources-grid">
//                     ${sources.map(source => {
//                         const url = typeof source === 'string' ? source : source.url;
//                         const title = typeof source === 'object' ? source.title || '' : '';
//                         const snippet = typeof source === 'object' ? source.snippet || '' : '';
                  
//                         let domain = '';
//                         let displayUrl = url;
//                         try {
//                             const urlObj = new URL(url);
//                             domain = urlObj.hostname;
//                             displayUrl = urlObj.hostname + urlObj.pathname;
//                             if (displayUrl.length > 60) {
//                                 displayUrl = displayUrl.substring(0, 60) + '...';
//                             }
//                         } catch (e) {
//                             domain = '';
//                         }
                        
//                         return `
//                             <a href="${url}" target="_blank" class="source-card">
//                                 <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
//                                      class="source-favicon" 
//                                      alt=""
//                                      onerror="this.style.display='none'">
//                                 <div class="source-info">
//                                     <div class="source-card-title">${escapeHtml(title || domain || 'Source')}</div>
//                                     <div class="source-card-description">${escapeHtml(snippet || displayUrl)}</div>
//                                 </div>
//                             </a>
//                         `;
//                     }).join('')}
//                 </div>
//             </div>
//         ` : '';
        
//         // Build tabs HTML
//         const tabsHtml = `
//             <div class="response-tabs" style="display: flex; justify-content: space-between; align-items: center;">
//                 <div style="display: flex; gap: 8px;">
//                     <button class="response-tab active" data-tab="answer">Answer</button>
//                     ${hasSources ? '<button class="response-tab" data-tab="sources">Sources</button>' : ''}
//                     ${hasSteps ? '<button class="response-tab" data-tab="steps">Research Steps</button>' : ''}
//                     ${hasAssets ? '<button class="response-tab" data-tab="assets">Assets</button>' : ''}
//                     ${hasApp ? '<button class="response-tab" data-tab="apps">Apps</button>' : ''}
//                 </div>
//                 ${messageId ? `
//                     <div class="export-menu">
//                         <button class="export-btn" id="export-btn-${messageId}">
//                             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
//                                 <polyline points="7 10 12 15 17 10"></polyline>
//                                 <line x1="12" y1="15" x2="12" y2="3"></line>
//                             </svg>
//                             Export
//                             <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <polyline points="6 9 12 15 18 9"></polyline>
//                             </svg>
//                         </button>
//                         <div class="export-dropdown" id="dropdown-${messageId}">
//                             <div class="export-option" data-format="pdf" data-message-id="${messageId}">
//                                 📄 PDF
//                             </div>
//                             <div class="export-option" data-format="docx" data-message-id="${messageId}">
//                                 📝 DOCX
//                             </div>
//                             <div class="export-option" data-format="md" data-message-id="${messageId}">
//                                 📋 Markdown
//                             </div>
//                         </div>
//                     </div>
//                 ` : ''}
//             </div>
//         `;
        
//         // Answer Tab
//         const answerTabHtml = `
//             <div class="tab-content active" id="answer-tab-${uniqueId}">
//                 <div class="response-content">${displayContent}</div>
//             </div>
//         `;
        
//         // Research Steps Tab
//         const stepsTabHtml = hasSteps ? `
//             <div class="tab-content" id="steps-tab-${uniqueId}">
//                 <div class="steps-timeline">
//                     ${reasoningSteps.map((step, index) => `
//                         <div class="step-item">
//                             <div class="step-number">${index + 1}</div>
//                             <div class="step-content">
                                 
//                                 <div class="step-description">${escapeHtml(step.content || '')}</div>
//                                 ${step.sources && step.sources.length > 0? `<div class="step-sources">${step.sources.length} sources retrieved</div>` : ''}
//                             </div>
//                         </div>
//                     `).join('')}
//                 </div>
//             </div>
//         ` : '';
        
//         // Assets Tab
//         const assetsTabHtml = hasAssets ? `
//             <div class="tab-content" id="assets-tab-${uniqueId}">
//                 ${renderAssetsTab(assets)}
//             </div>
//         ` : '';
        
//         const appsTabHtml = hasApp ? `
//             <div class="tab-content" id="apps-tab-${uniqueId}">
//                 ${renderAppsTab(app)}
//             </div>
//         ` : '';
        
//         // Combine all tabs
//         messageDiv.innerHTML = `
//             <div class="message-content">
//                 ${tabsHtml}
//                 ${answerTabHtml}
//                 ${sourcesTabHtml}
//                 ${stepsTabHtml}
//                 ${assetsTabHtml}
//                 ${appsTabHtml}
//             </div>
//         `;
        
//         // *** ENHANCED FIX: Add tab switching functionality with complete scroll prevention ***
//         const tabs = messageDiv.querySelectorAll('.response-tab');
//         const tabContents = messageDiv.querySelectorAll('.tab-content');
        
//         tabs.forEach(tab => {
//             tab.addEventListener('click', (e) => {
//                 // *** CRITICAL: Prevent ALL default behaviors that could cause scrolling ***
//                 e.preventDefault();
//                 e.stopPropagation();
//                 e.stopImmediatePropagation();
                
//                 // Save current scroll position BEFORE any changes
//                 const currentScrollTop = container ? container.scrollTop : 0;
                
//                 const targetTab = tab.dataset.tab;
                
//                 // Special handling for Apps tab - it just triggers split screen
//                 if (targetTab === 'apps') {
//                     const appsTab = messageDiv.querySelector(`#apps-tab-${uniqueId}`);
//                     const iframe = appsTab ? appsTab.querySelector('iframe[id^="app-preview-iframe-"]') : null;
                    
//                     if (iframe) {
//                         const msgId = iframe.id.replace('app-preview-iframe-', '');
//                         const dropdown = appsTab.querySelector(`select[id^="version-select-"]`);
//                         const versionIndex = dropdown ? parseInt(dropdown.value) : 0;
                        
//                         if (window.appsData && window.appsData[msgId]) {
//                             const apps = window.appsData[msgId];
//                             const appHtml = Array.isArray(apps) ? apps[versionIndex] : apps;
                            
//                             console.log('📱 Opening split screen, keeping current tab view');
                            
//                             // Restore scroll position immediately after opening split screen
//                             showSplitScreen(appHtml);
                            
//                             // Force scroll position restoration
//                             if (container) {
//                                 container.scrollTop = currentScrollTop;
//                             }
                            
//                             return false; // Exit early - don't switch tabs
//                         }
//                     }
//                 }
                
//                 // Normal tab switching for all other tabs (Answer, Sources, Steps, Assets)
//                 tabs.forEach(t => t.classList.remove('active'));
//                 tabContents.forEach(tc => tc.classList.remove('active'));
                
//                 tab.classList.add('active');
//                 const targetContent = messageDiv.querySelector(`#${targetTab}-tab-${uniqueId}`);
//                 if (targetContent) {
//                     targetContent.classList.add('active');
//                 }
                
//                 // Restore scroll position after tab switch
//                 if (container) {
//                     container.scrollTop = currentScrollTop;
//                 }
                
//                 return false;
//             });
//         });
        
//         // Add export menu handlers
//         if (messageId) {
//             const exportBtn = messageDiv.querySelector(`#export-btn-${messageId}`);
//             const dropdown = messageDiv.querySelector(`#dropdown-${messageId}`);
            
//             if (exportBtn && dropdown) {
//                 exportBtn.addEventListener('click', (e) => {
//                     e.stopPropagation();
//                     dropdown.classList.toggle('show');
//                 });
                
//                 document.addEventListener('click', (e) => {
//                     if (!exportBtn.contains(e.target)) {
//                         dropdown.classList.remove('show');
//                     }
//                 });
                
//                 dropdown.querySelectorAll('.export-option').forEach(option => {
//                     option.addEventListener('click', () => {
//                         const format = option.dataset.format;
//                         const msgId = option.dataset.messageId;
//                         downloadExport(msgId, format);
//                         dropdown.classList.remove('show');
//                     });
//                 });
//             }
//         }
        
//     } else {
//         // Simple message without tabs
//         messageDiv.innerHTML = `
//             <div class="message-content">
//                 ${displayContent}
//             </div>
//         `;
//     }

//     container.appendChild(messageDiv);
//     if (container) {
//         container.scrollTop = container.scrollHeight;
//     }
    
//     toggleEmptyChat();
    
//     // Auto-open split screen removed - now manual via Apps tab click
    
//     return messageDiv;
// }

function appendMessage(role, content, isStreaming = false, sources = null, reasoningSteps = null, messageId = null, assets = null, app = null) {
     
    const container = getActiveMessagesContainer();
    if (!container) return;
    
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    // Store message ID as data attribute
    if (messageId) {
        messageDiv.dataset.messageId = messageId;
    }

    // ✅ Handle empty content with reasoning steps
    let displayContent;
    if (role === 'assistant' && (!content || content.trim() === '')) {
        // If no content but has reasoning steps, show "Processing..."
        if (reasoningSteps && reasoningSteps.length > 0) {
            displayContent = '<div style="color: #888; font-style: italic; padding: 20px; text-align: center;">🔄 Processing your request...</div>';
        } else {
            displayContent = '<div style="color: #888; font-style: italic; padding: 20px; text-align: center;">⏳ Waiting for response...</div>';
        }
    } else if (role === 'assistant' && !isStreaming) {
        displayContent = renderMarkdown(content);
    } else if (role === 'user') {
        displayContent = escapeHtml(content);
    } else {
        displayContent = content;
    }
    
    // Check if this is an assistant message with sources, reasoning steps, or assets
    const hasSources = sources && sources.length > 0;
    const hasSteps = reasoningSteps && reasoningSteps.length > 0;
    const hasAssets = assets && assets.length > 0;
    const hasApp = app !== null && app !== undefined;
    const hasContent = content && content.trim() !== '';

    if (role === 'assistant' && (hasSources || hasSteps || hasAssets || hasApp)) {
        // Generate unique ID - ensure it's truly unique
        let uniqueId = Date.now();
        while (document.querySelector(`#answer-tab-${uniqueId}`)) {
            uniqueId++;
        }
        
        const hasCategorizedSources = reasoningSteps && reasoningSteps.some(step => 
            step.category && step.query && step.sources
        );
        
        // ✅ Build tabs - Answer tab is optional if content is empty
        let tabsHtml = '<div style="display: flex; gap: 8px;">';
        
        // Determine which tab should be active by default
        let defaultActiveTab = 'answer';
        if (!hasContent) {
            if (hasSteps) defaultActiveTab = 'steps';
            else if (hasSources) defaultActiveTab = 'sources';
            else if (hasAssets) defaultActiveTab = 'assets';
            else if (hasApp) defaultActiveTab = 'apps';
        }
        
        // Only show Answer tab if we have content
        if (hasContent) {
            tabsHtml += `<button class="response-tab ${defaultActiveTab === 'answer' ? 'active' : ''}" data-tab="answer">Answer</button>`;
        }
        
        // Always show these tabs if they have data
        if (hasSources) {
            tabsHtml += `<button class="response-tab ${defaultActiveTab === 'sources' ? 'active' : ''}" data-tab="sources">Sources</button>`;
        }
        if (hasSteps) {
            tabsHtml += `<button class="response-tab ${defaultActiveTab === 'steps' ? 'active' : ''}" data-tab="steps">Research Steps</button>`;
        }
        if (hasAssets) {
            tabsHtml += `<button class="response-tab ${defaultActiveTab === 'assets' ? 'active' : ''}" data-tab="assets">Assets</button>`;
        }
        if (hasApp) {
            tabsHtml += `<button class="response-tab ${defaultActiveTab === 'apps' ? 'active' : ''}" data-tab="apps">Apps</button>`;
        }
        
        tabsHtml += '</div>';
        
        // Build tabs HTML with new Sources tab rendering
        const sourcesTabHtml = hasCategorizedSources ? `
            <div class="tab-content ${defaultActiveTab === 'sources' ? 'active' : ''}" id="sources-tab-${uniqueId}">
                ${renderCategorizedSources(reasoningSteps)}
            </div>
        ` : hasSources ? `
            <div class="tab-content ${defaultActiveTab === 'sources' ? 'active' : ''}" id="sources-tab-${uniqueId}">
                <div class="sources-grid">
                    ${sources.map(source => {
                        const url = typeof source === 'string' ? source : source.url;
                        const title = typeof source === 'object' ? source.title || '' : '';
                        const snippet = typeof source === 'object' ? source.snippet || '' : '';
                  
                        let domain = '';
                        let displayUrl = url;
                        try {
                            const urlObj = new URL(url);
                            domain = urlObj.hostname;
                            displayUrl = urlObj.hostname + urlObj.pathname;
                            if (displayUrl.length > 60) {
                                displayUrl = displayUrl.substring(0, 60) + '...';
                            }
                        } catch (e) {
                            domain = '';
                        }
                        
                        return `
                            <a href="${url}" target="_blank" class="source-card">
                                <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
                                     class="source-favicon" 
                                     alt=""
                                     onerror="this.style.display='none'">
                                <div class="source-info">
                                    <div class="source-card-title">${escapeHtml(title || domain || 'Source')}</div>
                                    <div class="source-card-description">${escapeHtml(snippet || displayUrl)}</div>
                                </div>
                            </a>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';
        
        // Answer Tab - only if we have content
        const answerTabHtml = hasContent ? `
            <div class="tab-content ${defaultActiveTab === 'answer' ? 'active' : ''}" id="answer-tab-${uniqueId}">
                <div class="response-content">${displayContent}</div>
            </div>
        ` : '';
        
        // Research Steps Tab
        const stepsTabHtml = hasSteps ? `
            <div class="tab-content ${defaultActiveTab === 'steps' ? 'active' : ''}" id="steps-tab-${uniqueId}">
                <div class="steps-timeline">
                    ${reasoningSteps.map((step, index) => `
                        <div class="step-item">
                            <div class="step-number">${index + 1}</div>
                            <div class="step-content">
                                <div class="step-description">${escapeHtml(step.content || step.step || '')}</div>
                                ${step.sources && step.sources.length > 0 ? `<div class="step-sources">${step.sources.length} sources retrieved</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';
        
        // Assets Tab
        const assetsTabHtml = hasAssets ? `
            <div class="tab-content ${defaultActiveTab === 'assets' ? 'active' : ''}" id="assets-tab-${uniqueId}">
                ${renderAssetsTab(assets)}
            </div>
        ` : '';
        
        const appsTabHtml = hasApp ? `
            <div class="tab-content ${defaultActiveTab === 'apps' ? 'active' : ''}" id="apps-tab-${uniqueId}">
                ${renderAppsTab(app)}
            </div>
        ` : '';
        
        // Combine all tabs
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="response-tabs" style="display: flex; justify-content: space-between; align-items: center;">
                    ${tabsHtml}
                    ${messageId ? `
                        <div class="export-menu">
                            <button class="export-btn" id="export-btn-${messageId}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                </svg>
                                Export
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>
                            <div class="export-dropdown" id="dropdown-${messageId}">
                                <div class="export-option" data-format="pdf" data-message-id="${messageId}">
                                    📄 PDF
                                </div>
                                <div class="export-option" data-format="docx" data-message-id="${messageId}">
                                    📝 DOCX
                                </div>
                                <div class="export-option" data-format="md" data-message-id="${messageId}">
                                    📋 Markdown
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
                ${answerTabHtml}
                ${sourcesTabHtml}
                ${stepsTabHtml}
                ${assetsTabHtml}
                ${appsTabHtml}
            </div>
        `;
        
        // *** Add tab switching functionality with scroll prevention ***
        const tabs = messageDiv.querySelectorAll('.response-tab');
        const tabContents = messageDiv.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // *** Prevent ALL default behaviors that could cause scrolling ***
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                // Save current scroll position BEFORE any changes
                const currentScrollTop = container ? container.scrollTop : 0;
                
                const targetTab = tab.dataset.tab;
                
                // Special handling for Apps tab - it just triggers split screen
                if (targetTab === 'apps') {
                    const appsTab = messageDiv.querySelector(`#apps-tab-${uniqueId}`);
                    const iframe = appsTab ? appsTab.querySelector('iframe[id^="app-preview-iframe-"]') : null;
                    
                    if (iframe) {
                        const msgId = iframe.id.replace('app-preview-iframe-', '');
                        const dropdown = appsTab.querySelector(`select[id^="version-select-"]`);
                        const versionIndex = dropdown ? parseInt(dropdown.value) : 0;
                        
                        if (window.appsData && window.appsData[msgId]) {
                            const apps = window.appsData[msgId];
                            const appHtml = Array.isArray(apps) ? apps[versionIndex] : apps;
                            
                            console.log('📱 Opening split screen, keeping current tab view');
                            
                            // Restore scroll position immediately after opening split screen
                            showSplitScreen(appHtml);
                            
                            // Force scroll position restoration
                            if (container) {
                                container.scrollTop = currentScrollTop;
                            }
                            
                            return false; // Exit early - don't switch tabs
                        }
                    }
                }
                
                // Normal tab switching for all other tabs (Answer, Sources, Steps, Assets)
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(tc => tc.classList.remove('active'));
                
                tab.classList.add('active');
                const targetContent = messageDiv.querySelector(`#${targetTab}-tab-${uniqueId}`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
                
                // Restore scroll position after tab switch
                if (container) {
                    container.scrollTop = currentScrollTop;
                }
                
                return false;
            });
        });
        
        // Add export menu handlers
        if (messageId) {
            const exportBtn = messageDiv.querySelector(`#export-btn-${messageId}`);
            const dropdown = messageDiv.querySelector(`#dropdown-${messageId}`);
            
            if (exportBtn && dropdown) {
                exportBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('show');
                });
                
                document.addEventListener('click', (e) => {
                    if (!exportBtn.contains(e.target)) {
                        dropdown.classList.remove('show');
                    }
                });
                
                dropdown.querySelectorAll('.export-option').forEach(option => {
                    option.addEventListener('click', () => {
                        const format = option.dataset.format;
                        const msgId = option.dataset.messageId;
                        downloadExport(msgId, format);
                        dropdown.classList.remove('show');
                    });
                });
            }
        }
        
    } else {
        // Simple message without tabs
        messageDiv.innerHTML = `
            <div class="message-content">
                ${displayContent}
            </div>
        `;
    }

    container.appendChild(messageDiv);
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
    
    toggleEmptyChat();
    
    return messageDiv;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// Update the download function to use the global storage
function downloadAssetMarkdown(index, type) {
    const markdown = window.assetMarkdownData ? window.assetMarkdownData[index] : null;
    if (!markdown) {
        alert('Markdown content not available');
        return;
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `asset-${type}-${index + 1}.md`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Add this helper function at the top level
async function loadAssetsFromDB(conversationId, messageDiv, responseContent) {
    try {

        console.log("conv id is " + conversationId)
        console.log('[ASSETS/APPS] Loading from DB...');
        
        const token = localStorage.getItem('access_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
            headers: headers
        });
        
        if (!response.ok) {
            console.error('[ASSETS/APPS] DB fetch failed:', response.status);
            return;
        }
        
        const messages = await response.json();
        const lastAssistantMsg = messages.filter(m => m.role === 'assistant').pop();
        
        if (!lastAssistantMsg) {
            console.log('[ASSETS/APPS] No assistant message found');
            return;
        }
        
        // Initialize variables first
        let assets = null;
        let apps = null;
        
        // Parse assets
        if (lastAssistantMsg.assets) {
             console.log('[APPS] Raw assets from DB:', typeof lastAssistantMsg.assets);
            if (typeof lastAssistantMsg.assets === 'string') {
                try {
                    assets = JSON.parse(lastAssistantMsg.assets);
                } catch (e) {
                    console.error('[ASSETS] Failed to parse assets:', e);
                }
            } else {
                assets = lastAssistantMsg.assets;
            }
        }
        
        // Parse apps
        if (lastAssistantMsg.app) {
            console.log('[APPS] Raw apps from DB:', typeof lastAssistantMsg.app);
            if (typeof lastAssistantMsg.app === 'string') {
                try {
                    apps = JSON.parse(lastAssistantMsg.app);
                    console.log('[APPS] Parsed apps:', apps);
                } catch (e) {
                    console.error('[APPS] Failed to parse apps:', e);
                }
            } else {
                apps = lastAssistantMsg.app;
            }
        }
        
        // Check what we have
        const hasAssets = assets && assets.length > 0;
        const hasApps = apps !== undefined
        
        if (!hasAssets && !hasApps) {
            console.log('[ASSETS/APPS] No assets or apps to display');
            return;
        }
        
        console.log('[ASSETS] ✓ Loaded', assets?.length || 0, 'assets');
        
        const messageContentDiv = messageDiv.querySelector('.message-content');
        const tabsContainer = messageContentDiv.querySelector('.response-tabs');
        
        if (!tabsContainer) {
            console.error('[ASSETS/APPS] No tabs container found');
            return;
        }
        
        const tabButtons = tabsContainer.querySelector('div');
        const uniqueId = Date.now();
        
        // ============================================
        // HANDLE ASSETS TAB
        // ============================================
        if (hasAssets) {
            let assetsTab = messageContentDiv.querySelector('[id^="assets-tab-"]');
            
            if (!assetsTab) {
                // Create Assets tab button
                const assetsBtn = document.createElement('button');
                assetsBtn.className = 'response-tab';
                assetsBtn.dataset.tab = 'assets';
                assetsBtn.textContent = 'Assets';
                tabButtons.appendChild(assetsBtn);
                
                // Create Assets tab content
                assetsTab = document.createElement('div');
                assetsTab.className = 'tab-content';
                assetsTab.id = `assets-tab-${uniqueId}`;
                assetsTab.innerHTML = renderAssetsTab(assets);
                messageContentDiv.appendChild(assetsTab);
                
                // Add click handler
                assetsBtn.addEventListener('click', () => {
                    messageContentDiv.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
                    messageContentDiv.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    assetsBtn.classList.add('active');
                    assetsTab.classList.add('active');
                });
                
                console.log('[ASSETS] ✓ Tab created');
            } else {
                // Update existing Assets tab
                assetsTab.innerHTML = renderAssetsTab(assets);
                console.log('[ASSETS] ✓ Tab updated');
            }
        }
        
        // ============================================
        // HANDLE APPS TAB
        // ============================================
        if (hasApps) {
            let appsTab = messageContentDiv.querySelector('[id^="apps-tab-"]');
            
            if (!appsTab) {
                // Create Apps tab button
                const appsBtn = document.createElement('button');
                appsBtn.className = 'response-tab';
                appsBtn.dataset.tab = 'apps';
                appsBtn.textContent = 'Apps';
                tabButtons.appendChild(appsBtn);
                
                // Create Apps tab content
                appsTab = document.createElement('div');
                appsTab.className = 'tab-content';
                appsTab.id = `apps-tab-${uniqueId}`;
                appsTab.innerHTML = renderAppsTab(apps);
                messageContentDiv.appendChild(appsTab);
                
                // Add click handler
                appsBtn.addEventListener('click', () => {
                    messageContentDiv.querySelectorAll('.response-tab').forEach(t => t.classList.remove('active'));
                    messageContentDiv.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                    appsBtn.classList.add('active');
                    appsTab.classList.add('active');
                });
                
                console.log('[APPS] ✓ Tab created');
            } else {
                // Update existing Apps tab
                appsTab.innerHTML = renderAppsTab(apps);
                console.log('[APPS] ✓ Tab updated');
            }
        }
        
    } catch (error) {
        console.error('[ASSETS/APPS] Error:', error);
        console.error('[ASSETS/APPS] Stack:', error.stack);
    }
}

// ============================================
// FILE UPLOAD VARIABLES AND HANDLERS
// ============================================

// File upload state
let attachedFiles = [];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
    'application/pdf': { ext: '.pdf', icon: '📄' },
    'text/csv': { ext: '.csv', icon: '📊' },
    'application/vnd.ms-excel': { ext: '.xls', icon: '📊' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', icon: '📊' },
    'text/plain': { ext: '.txt', icon: '📝' }
};

// File upload button click
document.getElementById('file-upload-btn')?.addEventListener('click', () => {
    document.getElementById('file-input').click();
});

// File selection handler
document.getElementById('file-input')?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFileSelection(files);
    e.target.value = ''; // Reset input
});

// Handle file selection
function handleFileSelection(files) {
    files.forEach(file => {
        // Validate file type
        if (!ALLOWED_TYPES[file.type]) {
            alert(`${file.name}: File type not supported. Use PDF, CSV, XLS, XLSX, or TXT.`);
            return;
        }
        
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
            alert(`${file.name}: File too large. Maximum size is 10MB.`);
            return;
        }
        
        // Check for duplicates
        if (attachedFiles.some(f => f.name === file.name && f.size === file.size)) {
            alert(`${file.name}: File already attached.`);
            return;
        }
        
        // Add file
        attachedFiles.push(file);
    });
    
    updateFilePreview();
}

// Update file preview display
function updateFilePreview() {
    const container = document.getElementById('attached-files');
    
    if (!container) return;
    
    if (attachedFiles.length === 0) {
        container.classList.remove('has-files');
        container.innerHTML = '';
        return;
    }
    
    container.classList.add('has-files');
    container.innerHTML = attachedFiles.map((file, index) => {
        const fileInfo = ALLOWED_TYPES[file.type];
        const sizeKB = (file.size / 1024).toFixed(1);
        
        return `
            <div class="attached-file">
                <span class="file-icon">${fileInfo.icon}</span>
                <div class="file-details">
                    <div class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                    <div class="file-size">${sizeKB} KB</div>
                </div>
                <button class="file-remove-btn" onclick="removeFile(${index})" title="Remove file">×</button>
            </div>
        `;
    }).join('');
}

// Remove file
function removeFile(index) {
    attachedFiles.splice(index, 1);
    updateFilePreview();
}

// Optional: Drag and drop support
const inputWrapper = document.querySelector('.input-wrapper');
if (inputWrapper) {
    inputWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        inputWrapper.style.borderColor = '#d4a574';
        inputWrapper.style.background = 'rgba(212, 165, 116, 0.05)';
    });

    inputWrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        inputWrapper.style.borderColor = '';
        inputWrapper.style.background = '';
    });

    inputWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        inputWrapper.style.borderColor = '';
        inputWrapper.style.background = '';
        
        const files = Array.from(e.dataTransfer.files);
        handleFileSelection(files);
    });
}

//  async function sendMessage() {
//     const input = document.getElementById('message-input');
//     const content = input.value.trim();

//     if (!content && attachedFiles.length === 0) return;

//     const sendBtn = document.getElementById('send-btn');
//     const fileBtn = document.getElementById('file-upload-btn');
//     sendBtn.disabled = true;
//     if (fileBtn) fileBtn.disabled = true;
    
//     input.value = '';

//     let userMessage = content || 'Analyzing attached files...';
//     if (attachedFiles.length > 0) {
//         const fileList = attachedFiles.map(f => `📎 ${f.name}`).join('\n');
//         userMessage = content ? `${content}\n\n${fileList}` : fileList;
//     }
    
//     appendMessage('user', userMessage);

//     const uploadedFiles = [...attachedFiles];
//     attachedFiles = [];
//     updateFilePreview();

//     const container = getActiveMessagesContainer();
//     if (!container) return;
    
//     const emptyState = container.querySelector('.empty-state');
//     if (emptyState) {
//         emptyState.remove();
//     }

//     const streamingDiv = document.createElement('div');
//     streamingDiv.className = 'message assistant streaming-message';
//     streamingDiv.innerHTML = `
//         <div class="message-content">
//             <div class="response-content">
//                 <div class="streaming-indicator">
//                     <div class="streaming-dot"></div>
//                     <div class="streaming-dot"></div>
//                     <div class="streaming-dot"></div>
               
//                 </div>
//             </div>
//         </div>
//     `;

//     container.appendChild(streamingDiv);
//     if (container) {
//         container.scrollTop = container.scrollHeight;
//     }
    
//     const messageContentDiv = streamingDiv.querySelector('.message-content');
//     const responseContent = streamingDiv.querySelector('.response-content');
    
//     let reasoningContent = null;
//     let reasoningHeader = null;
//     let collectedSources = [];
//     let collectedSteps = []; 
//     let collectedAssets = null;

//     try {
//         const headers = {};
//         const token = localStorage.getItem('access_token');
//         if (token) {
//             headers['Authorization'] = `Bearer ${token}`;
//         }
        
//         const formData = new FormData();
//         formData.append('content', content);
        
//         mode = localStorage.getItem('search_mode')

//         if (mode === "lab")
//         {
//             isLabModeEnabled = true
//             isDeepSearchEnabled = false
//         }
//         else if (mode === "deep")
//         {
//             isLabModeEnabled = false
//             isDeepSearchEnabled = true
//         }
//         else
//         {
//             isLabModeEnabled = false
//             isDeepSearchEnabled = false
//         }

//         formData.append('deep_search', isDeepSearchEnabled.toString());
//         formData.append('lab_mode', isLabModeEnabled.toString());
        
//         if (currentConversationId && currentConversationId !== 'null' && currentConversationId !== 'undefined') {
//             formData.append('conversation_id', currentConversationId);
//         }
        
//         uploadedFiles.forEach(file => {
//             formData.append('files', file);
//         });
        
//         console.log('[SEND] Sending FormData request');
        
//         const response = await fetch(`${API_URL}/chat/send/stream`, {
//             method: 'POST',
//             headers: headers,
//             body: formData
//         });

//         if (!response.ok) {
//             const errorText = await response.text();
//             console.error('[SEND] Error response:', response.status, errorText);
//             throw new Error(`Request failed: ${response.status}`);
//         }

//         console.log('[SEND] Stream started successfully');

//         const reader = response.body.getReader();
//         const decoder = new TextDecoder();
//         let accumulatedText = '';
//         let newConversationId = null;

//         while (true) {
//             const { done, value } = await reader.read();
            
//             if (done) break;
            
//             const chunk = decoder.decode(value);
//             const lines = chunk.split('\n');
            
//             for (const line of lines) {
//                 if (!line || line.trim() === '') continue;
                
//                 let parsed;
//                 try {
//                     parsed = JSON.parse(line);
//                 } catch (parseError) {
//                     console.error('JSON parse failed:', line);
//                     continue;
//                 }
                
//                 if (!parsed || !parsed.type) continue;
                
//                 if (parsed.type === 'metadata' && parsed.conversation_id) {
//                     newConversationId = parsed.conversation_id;
//                     console.log('Got conversation ID:', newConversationId);
//                 }
//                 else if (parsed.type === 'reasoning') {
//                     if (!reasoningContent) {
//                         const reasoningSection = document.createElement('div');
//                         reasoningSection.className = 'reasoning-section';
//                         reasoningSection.innerHTML = `
//                             <div class="reasoning-header">
//                                 <div class="reasoning-title">
//                                     <span class="reasoning-icon">⚙</span>
//                                     <span>Thinking...</span>
//                                 </div>
//                                 <span class="reasoning-toggle">▼</span>
//                             </div>
//                             <div class="reasoning-content expanded"></div>
//                         `;
                        
//                         messageContentDiv.insertBefore(reasoningSection, responseContent);
                        
//                         reasoningContent = reasoningSection.querySelector('.reasoning-content');
//                         reasoningHeader = reasoningSection.querySelector('.reasoning-header');
//                         const reasoningToggle = reasoningSection.querySelector('.reasoning-toggle');
                        
//                         reasoningHeader.addEventListener('click', () => {
//                             reasoningContent.classList.toggle('expanded');
//                             reasoningToggle.classList.toggle('expanded');
//                         });
//                     }
                    
//                     if (parsed.sources) {
//                         parsed.sources.forEach(sourceObj => {
//                             const sourceUrl = typeof sourceObj === 'string' ? sourceObj : sourceObj.url;
//                             const exists = collectedSources.find(s => {
//                                 const existingUrl = typeof s === 'string' ? s : s.url;
//                                 return existingUrl === sourceUrl;
//                             });
//                             if (!exists) {
//                                 collectedSources.push(sourceObj);
//                             }
//                         });
//                     }
                    
//                     const stepDiv = document.createElement('div');
//                     stepDiv.className = 'reasoning-step';
//                     stepDiv.innerHTML = `
//                         <div class="reasoning-step-content">${parsed.content || ''}</div>
//                     `;
//                     reasoningContent.appendChild(stepDiv);
//                 }
//                 else if (parsed.type === 'content') {
//                     accumulatedText += parsed.text;
//                     responseContent.innerHTML = renderMarkdown(accumulatedText);
//                     responseContent.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
//                         hljs.highlightElement(block);
//                     });
//                 }
//                 else if (parsed.type === 'done') {
//                     streamingDiv.classList.remove('streaming-message');
//                     setStreamingToDone(streamingDiv);  // <-- NEW LINE
//                 }
//                 else if (parsed.type === 'error') {
//                     responseContent.textContent = `Error: ${parsed.message || 'Unknown error'}`;
//                     setStreamingToDone(streamingDiv);  // <-- ALSO SET DONE ON ERROR
//                 }
//             }
            
//             if (container) {
//                 container.scrollTop = container.scrollHeight;
//             }
//         }

//         if (newConversationId) {
//             currentConversationId = newConversationId;
//             if (currentUser) {
//                 loadConversations();
//             }
//         }

//     } catch (error) {
//         console.error('Failed to send message:', error);
//         responseContent.textContent = 'Error: Failed to get response. Please check your connection.';
//         setStreamingToDone(streamingDiv);  // <-- ALSO SET DONE ON CATCH ERROR
        
//         attachedFiles = uploadedFiles;
//         updateFilePreview();
//     }

//     sendBtn.disabled = false;
//     if (fileBtn) fileBtn.disabled = false;
// }

// NEW HELPER FUNCTION

// Check if there are any incomplete messages (streaming/processing)
function hasIncompleteMessages() {
    const container = getActiveMessagesContainer();
    if (!container) return false;
    
    const streamingMessages = container.querySelectorAll('.message.assistant.streaming-message');
    return streamingMessages.length > 0;
}

// Monitor streaming state and update button
function updateSendButtonState() {
    const sendBtn = document.getElementById('send-btn');
    const input = document.getElementById('message-input');
    
    if (!sendBtn) return;
    
    if (hasIncompleteMessages()) {
        sendBtn.disabled = true;
        sendBtn.style.opacity = '0.5';
        // sendBtn.title = 'Please wait for current response to complete';
        if (input) input.disabled = true;
    } else {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '';
        // sendBtn.title = 'Send message';
        if (input) input.disabled = false;
    }
}

// Check every 500ms
setInterval(updateSendButtonState, 500);
async function sendMessage() {

    const input = document.getElementById('message-input');
    const content = input.value.trim();
 
    let isIncomplete = hasIncompleteMessages()
    if (isIncomplete) {
        alert('⚠️ Cannot send - there is already a message in progress');
        
        // Show visual feedback
        const sendBtn = document.getElementById('send-btn');
        sendBtn.style.opacity = '0.5';
        sendBtn.style.cursor = 'not-allowed';
        
        setTimeout(() => {
            sendBtn.style.opacity = '';
            sendBtn.style.cursor = '';
        }, 500);
        
        return;
    }

    if (!content && attachedFiles.length === 0) return;
    const sendBtn = document.getElementById('send-btn');
    const fileBtn = document.getElementById('file-upload-btn');
    sendBtn.disabled = true;
    if (fileBtn) fileBtn.disabled = true;
    
    input.value = '';

    let userMessage = content || 'Analyzing attached files...';
    if (attachedFiles.length > 0) {
        const fileList = attachedFiles.map(f => `📎 ${f.name}`).join('\n');
        userMessage = content ? `${content}\n\n${fileList}` : fileList;
    }
    
    appendMessage('user', userMessage);

    const uploadedFiles = [...attachedFiles];
    attachedFiles = [];
    updateFilePreview();

    const container = getActiveMessagesContainer();
    if (!container) return;
    
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const streamingDiv = document.createElement('div');
    streamingDiv.className = 'message assistant streaming-message';
    streamingDiv.innerHTML = `
        <div class="message-content">
            <div class="response-content">
                <div class="streaming-indicator">
                    <div class="streaming-dot"></div>
                    <div class="streaming-dot"></div>
                    <div class="streaming-dot"></div>
                </div>
            </div>
        </div>
    `;

    container.appendChild(streamingDiv);
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
    
    const messageContentDiv = streamingDiv.querySelector('.message-content');
    const responseContent = streamingDiv.querySelector('.response-content');
    
    let reasoningContent = null;
    let reasoningHeader = null;
    let collectedSources = [];
    let collectedSteps = []; 
    let collectedAssets = null;
    let newConversationId = null;
    let conversationListUpdated = false;

    console.log('');
    console.log('🚀🚀🚀 SEND MESSAGE STARTED 🚀🚀🚀');
    console.log('═══════════════════════════════════════');
    console.log('Initial State:');
    console.log('   - currentUser:', currentUser);
    console.log('   - currentUser exists?', !!currentUser);
    
    console.log('   - currentUser.token:', currentUser?.token?.substring(0, 20) + '...');
    console.log('   - currentConversationId:', currentConversationId);
    console.log('   - conversationListUpdated:', conversationListUpdated);
    console.log('═══════════════════════════════════════');

    try {
        const headers = {};
        const token = localStorage.getItem('access_token');
        console.log(token)
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('✅ Authorization token added to headers');
        } else {
            console.log('⚠️ No authorization token found');
        }
        
        const formData = new FormData();
        formData.append('content', content);
        
        mode = localStorage.getItem('search_mode');

        if (mode === "lab") {
            isLabModeEnabled = true;
            isDeepSearchEnabled = false;
        } else if (mode === "deep") {
            isLabModeEnabled = false;
            isDeepSearchEnabled = true;
        } else {
            isLabModeEnabled = false;
            isDeepSearchEnabled = false;
        }

        formData.append('deep_search', isDeepSearchEnabled.toString());
        formData.append('lab_mode', isLabModeEnabled.toString());
        
        console.log('📤 Request settings:');
        console.log('   - Mode:', mode);
        console.log('   - Deep search:', isDeepSearchEnabled);
        console.log('   - Lab mode:', isLabModeEnabled);
        
        if (currentConversationId && currentConversationId !== 'null' && currentConversationId !== 'undefined') {
            formData.append('conversation_id', currentConversationId);
            console.log('   - Using existing conversation:', currentConversationId);
        } else {
            console.log('   - Creating new conversation');
        }
        
        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });
        
        console.log('[SEND] Sending FormData request to:', `${API_URL}/chat/send/stream`);
        
        const response = await fetch(`${API_URL}/chat/send/stream`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[SEND] Error response:', response.status, errorText);
            throw new Error(`Request failed: ${response.status}`);
        }

        console.log('[SEND] ✅ Stream started successfully');
        console.log('');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                console.log('');
                console.log('🏁 Stream finished (done=true)');
                break;
            }
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (!line || line.trim() === '') continue;
                
                let parsed;
                try {
                    parsed = JSON.parse(line);
                } catch (parseError) {
                    console.error('❌ JSON parse failed for line:', line);
                    continue;
                }
                
                if (!parsed || !parsed.type) continue;
                
                // ═══════════════════════════════════════
                // HANDLE METADATA - CAPTURE CONVERSATION ID
                // ═══════════════════════════════════════
                if (parsed.type === 'metadata' && parsed.conversation_id) {
                    console.log('');
                    console.log('═══════════════════════════════════════');
                    console.log('📋 METADATA EVENT RECEIVED');
                    console.log('═══════════════════════════════════════');
                    console.log('   - Conversation ID from server:', parsed.conversation_id);
                    console.log('   - Previous newConversationId:', newConversationId);
                    console.log('   - Previous currentConversationId:', currentConversationId);
                    console.log('   - conversationListUpdated:', conversationListUpdated);
                    
                    newConversationId = parsed.conversation_id;
                    currentConversationId = newConversationId;
                    
                    console.log('✅ Updated conversation IDs:');
                    console.log('   - newConversationId:', newConversationId);
                    console.log('   - currentConversationId:', currentConversationId);
                    console.log('═══════════════════════════════════════');
                }
                
                // ═══════════════════════════════════════
                // HANDLE REASONING - REFRESH LIST ON FIRST REASONING STEP
                // ═══════════════════════════════════════
                else if (parsed.type === 'reasoning') {
                    
                    if (!reasoningContent) {
                        console.log('🆕 Creating NEW reasoning section (first reasoning step)');
                        
                        const reasoningSection = document.createElement('div');
                        reasoningSection.className = 'reasoning-section';
                        reasoningSection.innerHTML = `
                            <div class="reasoning-header">
                                <div class="reasoning-title">
                                    <span class="reasoning-icon">⚙</span>
                                    <span>Thinking...</span>
                                </div>
                                <span class="reasoning-toggle">▼</span>
                            </div>
                            <div class="reasoning-content expanded"></div>
                        `;
                        
                        messageContentDiv.insertBefore(reasoningSection, responseContent);
                        
                        reasoningContent = reasoningSection.querySelector('.reasoning-content');
                        reasoningHeader = reasoningSection.querySelector('.reasoning-header');
                        const reasoningToggle = reasoningSection.querySelector('.reasoning-toggle');
                        
                        reasoningHeader.addEventListener('click', () => {
                            reasoningContent.classList.toggle('expanded');
                            reasoningToggle.classList.toggle('expanded');
                        });
                        
                        console.log('✅ Reasoning section created in DOM');
                        
                        // ═══════════════════════════════════════
                        // CRITICAL: Check if we should refresh conversation list
                        // ═══════════════════════════════════════
                        console.log('');
                        console.log('🔍 CHECKING IF WE SHOULD REFRESH CONVERSATION LIST:');
                        console.log('   Condition 1 - currentUser exists:', !!currentUser, '(need: true)');
                        console.log('   Condition 2 - newConversationId exists:', !!newConversationId, '(need: true)');
                        console.log('   Condition 3 - conversationListUpdated is false:', !conversationListUpdated, '(need: true)');
                        console.log('   Combined check result:', !!(currentUser && newConversationId && !conversationListUpdated));
                        
                        if (currentUser && newConversationId && !conversationListUpdated) {
                            console.log('');
                            console.log('✅ ✅ ✅ ALL CONDITIONS MET - WILL REFRESH CONVERSATION LIST');
                            console.log('🔄 Setting conversationListUpdated = true to prevent duplicate refreshes');
                            conversationListUpdated = true;
                            
                            console.log('⏱️ Waiting 500ms before refreshing (to allow backend to save conversation)...');
                            setTimeout(async () => {
                                console.log('');
                                console.log('═══════════════════════════════════════');
                                console.log('🔄 EXECUTING CONVERSATION LIST REFRESH');
                                console.log('═══════════════════════════════════════');
                                console.log('   - Target conversation ID:', newConversationId);
                                console.log('   - User token:', currentUser.token?.substring(0, 20) + '...');
                                console.log('   - API URL:', `${API_URL}/conversations`);
                                
                                try {
                                    console.log('📞 Calling loadConversations()...');
                                    await loadConversations();
                                    console.log('✅ loadConversations() completed successfully');
                                    
                                    // Debug: Check what conversations were loaded
                                    const conversationItems = document.querySelectorAll('.conversation-item');
                                    console.log('');
                                    console.log('📊 Conversations in sidebar after refresh:');
                                    console.log('   - Total count:', conversationItems.length);
                                    console.log('   - Conversation details:', Array.from(conversationItems).map((item, idx) => ({
                                        index: idx,
                                        id: item.dataset.id,
                                        title: item.querySelector('.conversation-title')?.textContent,
                                        isActive: item.classList.contains('active')
                                    })));
                                    
                                    // Mark the new conversation as active
                                    console.log('');
                                    console.log('🎯 Attempting to mark conversation as active...');
                                    console.log('   Looking for conversation with ID:', newConversationId);
                                    
                                    setTimeout(() => {
                                        let found = false;
                                        let totalItems = 0;
                                        
                                        document.querySelectorAll('.conversation-item').forEach(item => {
                                            totalItems++;
                                            const itemId = item.dataset.id;
                                            const itemTitle = item.querySelector('.conversation-title')?.textContent;
                                            
                                            console.log(`   Checking item ${totalItems}:`, {
                                                id: itemId,
                                                title: itemTitle,
                                                matches: itemId === newConversationId
                                            });
                                            
                                            item.classList.remove('active');
                                            
                                            if (itemId === newConversationId) {
                                                item.classList.add('active');
                                                found = true;
                                                console.log('   ✅ MATCH FOUND! Marked as active:', {
                                                    id: itemId,
                                                    title: itemTitle
                                                });
                                            }
                                        });
                                        
                                        console.log('');
                                        console.log('📈 Search Results:');
                                        console.log('   - Total items checked:', totalItems);
                                        console.log('   - Target ID found?', found);
                                        
                                        if (!found) {
                                            console.error('❌ ❌ ❌ CONVERSATION NOT FOUND IN SIDEBAR');
                                            console.error('   - Looking for ID:', newConversationId);
                                            console.error('   - Available IDs:', 
                                                Array.from(document.querySelectorAll('.conversation-item'))
                                                    .map(item => item.dataset.id)
                                            );
                                            console.error('   - Possible reasons:');
                                            console.error('     1. Backend hasn\'t saved the conversation yet');
                                            console.error('     2. loadConversations() didn\'t fetch the new conversation');
                                            console.error('     3. Conversation ID mismatch between frontend and backend');
                                        } else {
                                            console.log('✅ ✅ ✅ CONVERSATION SUCCESSFULLY MARKED AS ACTIVE');
                                        }
                                        
                                        console.log('═══════════════════════════════════════');
                                    }, 100);
                                    
                                } catch (error) {
                                    console.error('');
                                    console.error('❌ ❌ ❌ ERROR DURING CONVERSATION LIST REFRESH');
                                    console.error('   Error message:', error.message);
                                    console.error('   Error stack:', error.stack);
                                    console.error('═══════════════════════════════════════');
                                }
                                
                            }, 500);
                        } else {
                            console.log('');
                            console.log('❌ ❌ ❌ CONDITIONS NOT MET - SKIPPING REFRESH');
                            
                            if (!currentUser) {
                                console.log('   ❌ Failure reason: currentUser is', currentUser);
                                console.log('      - This means the user is not logged in');
                            }
                            if (!newConversationId) {
                                console.log('   ❌ Failure reason: newConversationId is', newConversationId);
                                console.log('      - This means metadata event hasn\'t arrived yet');
                            }
                            if (conversationListUpdated) {
                                console.log('   ❌ Failure reason: conversationListUpdated is already true');
                                console.log('      - This means we already refreshed the list');
                            }
                        }
                        
                        console.log('═══════════════════════════════════════');
                    } else {
                        console.log('📝 Adding step to EXISTING reasoning section (not first reasoning)');
                        console.log('   - reasoningContent already exists, skipping refresh logic');
                    }
                    
                    // Collect sources
                    if (parsed.sources) {
                        console.log('📚 Collecting sources from reasoning step:', parsed.sources.length);
                        parsed.sources.forEach(sourceObj => {
                            const sourceUrl = typeof sourceObj === 'string' ? sourceObj : sourceObj.url;
                            const exists = collectedSources.find(s => {
                                const existingUrl = typeof s === 'string' ? s : s.url;
                                return existingUrl === sourceUrl;
                            });
                            if (!exists) {
                                collectedSources.push(sourceObj);
                            }
                        });
                        console.log('   Total unique sources collected so far:', collectedSources.length);
                    }
                    
                    
                    // Add reasoning step to UI
                    const stepDiv = document.createElement('div');
                    stepDiv.className = 'reasoning-step';
                    stepDiv.innerHTML = `
                        <div class="reasoning-step-content">${parsed.content || ''}</div>
                    `;
                    reasoningContent.appendChild(stepDiv);
                    console.log('✅ Reasoning step added to UI');
                    console.log('   Content preview:', (parsed.content || '').substring(0, 80) + '...');
                }
                
                // Handle content streaming
                else if (parsed.type === 'content') {
                    accumulatedText += parsed.text;
                    responseContent.innerHTML = renderMarkdown(accumulatedText);
                    responseContent.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                }
                
                // Handle done
                else if (parsed.type === 'done') {
                    console.log('');
                    console.log('🏁 DONE event received');
                    streamingDiv.classList.remove('streaming-message');
                    setStreamingToDone(streamingDiv);
                    
                    // ✅ FINAL REFRESH: In case no reasoning was sent (normal mode)
                    if (currentUser && newConversationId && !conversationListUpdated) {
                        console.log('');
                        console.log('🔄 Stream complete - final conversation list refresh (no reasoning was sent)...');
                        console.log('   This happens in normal mode without deep search');
                        await loadConversations();
                        
                        setTimeout(() => {
                            document.querySelectorAll('.conversation-item').forEach(item => {
                                item.classList.remove('active');
                                if (item.dataset.id === newConversationId) {
                                    item.classList.add('active');
                                    console.log('✅ Marked conversation as active (from done event)');
                                }
                            });
                        }, 100);
                    }
                }
                
                // Handle error
                // Handle error
                // else if (parsed.type === 'error') {
                //     console.error('❌ Error event received:', parsed.message);
                    
                //     // ✅ CHECK FOR MESSAGE LIMIT
                //     if (parsed.limit_reached === true) {
                //         console.log('🔒 Anonymous message limit reached');
                        
                //         // Remove streaming indicator
                //         streamingDiv.classList.remove('streaming-message');
                //         setStreamingToDone(streamingDiv);
                        
                //         // Clear the streaming message
                //         responseContent.textContent = 'Please sign in to continue.';
                        
                //         // Open login panel
                //         openLoginPanel();
                        
                //         // Show message
                //         showAuthError('Free message limit reached. Please sign in to continue with 50 messages per day!');
                        
                //     } else {
                //         // Regular error handling
                //         responseContent.textContent = `Error: ${parsed.message || 'Unknown error'}`;
                //         setStreamingToDone(streamingDiv);
                //     }
                // }

                // Handle error
                    else if (parsed.type === 'error') {
                        console.error('❌ Error event received:', parsed.message);
                        
                        if (parsed.limit_reached === true) {
                            console.log('🔒 Message limit reached');
                            
                            streamingDiv.classList.remove('streaming-message');
                            setStreamingToDone(streamingDiv);
                            
                            // responseContent.textContent = 'Message limit reached.';
                            
                            // ✅ Different handling for logged-in vs anonymous
                            if (parsed.user_limit === true) {
                                // ✅ Logged-in user hit their limit - SHOW UPGRADE POPUP
                                console.log('💎 Showing upgrade prompt for logged-in user');
                                openPremiumPopup();
                                showAuthError('Daily limit reached (10 messages/day). Upgrade to Premium for unlimited messages!');
                            } else {
                                // Anonymous user hit their limit - show login
                                openLoginPanel();
                                showAuthError('Free message limit reached. Please sign in to continue with 10 messages per day!');
                            }
                        } else {
                            streamingDiv.classList.remove('streaming-message');
                            responseContent.textContent = `Error: ${parsed.message || 'Unknown error'}`;
                            setStreamingToDone(streamingDiv);
                        }
                    }
            }
            
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }
            
        // ✅ BACKUP REFRESH: Final check after stream closes
        if (newConversationId && currentUser && !conversationListUpdated) {
            console.log('');
            console.log('🔄 Post-stream conversation list refresh (backup)...');
            await loadConversations();
            
            setTimeout(() => {
                const activeItem = document.querySelector(`.conversation-item[data-id="${newConversationId}"]`);
                if (activeItem) {
                    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
                    activeItem.classList.add('active');
                    console.log('✅ Marked conversation as active (from backup refresh)');
                }
            }, 100);
        }

        console.log('');
        console.log('🏁🏁🏁 SEND MESSAGE COMPLETED 🏁🏁🏁');
        console.log('');

    } catch (error) {
        console.error('');
        console.error('❌❌❌ FATAL ERROR IN sendMessage() ❌❌❌');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        console.error('');
            streamingDiv.classList.remove('streaming-message');
        responseContent.textContent = 'Error: Failed to get response. Please check your connection.';
        setStreamingToDone(streamingDiv);
        
        attachedFiles = uploadedFiles;
        updateFilePreview();
    }

    sendBtn.disabled = false;
    if (fileBtn) fileBtn.disabled = false;
}

function setStreamingToDone(streamingDiv) {
    
    const indicator = streamingDiv.querySelector('.streaming-indicator');
    if (indicator) {
        indicator.classList.add('done');
        
        const text = indicator.querySelector('.streaming-text');
        if (text) {
            text.textContent = 'Done';
        }
        
        indicator.querySelectorAll('.streaming-dot').forEach(dot => {
            dot.style.display = 'none';
        });
        
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => {
                indicator.remove();
            }, 300);
        }, 1000);
    }
}

document.getElementById('send-btn').addEventListener('click', sendMessage);

    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // document.getElementById('premium-btn').addEventListener('click', () => {
    //     alert('Premium upgrade coming soon!');
    // });

// Auth state management
const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn = document.getElementById('auth-logged-in');
// const loginForm = document.getElementById('login-form');
// const registerForm = document.getElementById('register-form');
// const authTabs = document.querySelectorAll('.auth-tab');
const guestButton = document.getElementById('guest-button');
const logoutButton = document.getElementById('logout-button');
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');
const displayUsername = document.getElementById('display-username');


function toggleEmptyChat() {
    const chatArea = document.querySelector('.chat-area');
    const messagesContainer = document.getElementById('messages');
    
    console.log('toggleEmptyChat called, message count:', messagesContainer.children.length);
    
    if (messagesContainer.children.length === 0) {
        console.log('Adding empty-chat class');
        chatArea.classList.add('empty-chat');
    } else {
        console.log('Removing empty-chat class');
        chatArea.classList.remove('empty-chat');
    }
}


// Logout
logoutButton.addEventListener('click', () => {
    hideAuthMessages(); 
    localStorage.clear();
    currentUser = null;
    conversations = [];
    currentConversationId = null;
    
    showLoggedOutState();
    
    document.getElementById('conversations').innerHTML = '';
    
    // Clear conversation title
    // const titleElement = document.getElementById('current-conversation-title');
    // if (titleElement) {
    //     titleElement.textContent = 'Select or start a conversation';
    //     titleElement.classList.add('empty');
    // }
});

function showLoggedInState(email) {
    displayUsername.textContent = email || 'User';
    authLoggedOut.classList.add('hidden');
    authLoggedIn.classList.remove('hidden');
    
    document.body.classList.add('logged-in');
    
    toggleEmptyChat();
}

function showLoggedOutState() {
    authLoggedOut.classList.remove('hidden');
    authLoggedIn.classList.add('hidden');
    
    document.body.classList.remove('logged-in');
    
    const container = getActiveMessagesContainer();
    if (container) {
        container.innerHTML = '';
    }
    toggleEmptyChat();
}

function showAuthError(msg) {
    authError.textContent = msg;
    authError.classList.remove('hidden');
    authSuccess.classList.add('hidden');
}

function showAuthSuccess(msg) {
    authSuccess.textContent = msg;
    authSuccess.classList.remove('hidden');
    authError.classList.add('hidden');
}

function hideAuthMessages() {
    authError.classList.add('hidden');
    authSuccess.classList.add('hidden');
}

// async function deleteConversation(conversationId, event) {
//     event.stopPropagation();
    
//     try {
//         const token = localStorage.getItem('access_token');
//         if (!token) {
//             alert('Please login to delete conversations');
//             return;
//         }
//         alert(token)
//         const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
//             method: 'DELETE',
//             headers: {
//                 'Authorization': `Bearer ${token}`
//             }
//         });
        
//         if (response.ok) {
//             // If deleting current conversation, clear the chat
//             if (currentConversationId === conversationId) {
//                 currentConversationId = null;
//                 const container = getActiveMessagesContainer();
//                 if (container) {
//                     container.innerHTML = '';
//                 }
//                 toggleEmptyChat();
//             }
            
//             // Reload conversations list
//             await loadConversations();
//         } else {
//             alert('Failed to delete conversation');
//         }
//     } catch (error) {
//         alert(error)
//         console.error('Error deleting conversation:', error);
//         alert('Error deleting conversation');
//     }
// }

// Add this where you initialize event listeners

async function deleteConversation(conversationId, event) {
    event.stopPropagation();
    
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            alert('Please login to delete conversations');
            return;
        }
        
        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            // If deleting current conversation, clear the chat
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                
                // **FIX: Close split screen if active**
                if (isSplitScreenActive) {
                    closeSplitScreen();
                }
                
                // Clear main messages container
                const container = getActiveMessagesContainer();
                if (container) {
                    container.innerHTML = '';
                }
                
                toggleEmptyChat();
            }
            
            // Reload conversations list
            await loadConversations();
        } else {
            alert('Failed to delete conversation');
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Error deleting conversation');
    }
}

const conversationFilter = document.getElementById('conversation-filter');
if (conversationFilter) {
    conversationFilter.addEventListener('change', () => {
        if (window.allConversations) {
            renderConversationsGrouped(window.allConversations);
        }
    });
}

// Initialize mode from localStorage
let searchMode = localStorage.getItem('search_mode') || 'normal';
let isDeepSearchEnabled = searchMode === 'deep' || searchMode === 'lab';

let isLabModeEnabled = searchMode === 'lab';
let isVoiceModeEnabled = searchMode === 'voice';
 
let voiceClient = null; 
class VoiceSearchClient {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.audioStream = null;
        this.audioWorklet = null;
        this.isListening = false;
        this.isConnected = false;
        this.playbackContext = null;
        this.nextPlayTime = 0;
        this.currentAudioSources = [];
        this.currentAssistantMessage = null;
        this.accumulatedText = '';
        this.pendingUserTranscript = null;
        
        this.waveContainer = document.getElementById('voice-indicator');
        
        this.setWaveState('idle');
    }
    
    setWaveState(state) {
        if (this.waveContainer) {
            this.waveContainer.className = `wave-container ${state}`;
        } else {
            console.warn('Wave container not found, attempting to re-initialize...');
            this.waveContainer = document.getElementById('voice-indicator');
            if (this.waveContainer) {
                this.waveContainer.className = `wave-container ${state}`;
            }
        }
    }

    async connect() {
        try {
            this.setWaveState('idle');
            
            const token = localStorage.getItem('access_token');
            
            let wsUrl;
            if (API_URL.startsWith('https://')) {
                wsUrl = API_URL.replace('https://', 'wss://') + '/ws/voice';
            } else if (API_URL.startsWith('http://')) {
                wsUrl = API_URL.replace('http://', 'ws://') + '/ws/voice';
            } else {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                wsUrl = `${protocol}//${API_URL}/ws/voice`;
            }
            
            if (token) {
                wsUrl += `?token=${token}`;
            }
            
            console.log('🔌 Connecting to:', wsUrl);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = async () => {
                this.isConnected = true;
                console.log('✅ Voice WebSocket connected');
                
                await this.startListening();
            };

            this.ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    await this.handleServerMessage(data);
                } catch (error) {
                    console.error('❌ Error handling message:', error);
                }
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.setWaveState('idle');
            };

            this.ws.onclose = () => {
                this.isConnected = false;
                this.setWaveState('idle');
                console.log('🔌 Voice disconnected');
                
                this.stopListening();
            };

        } catch (error) {
            console.error('❌ Voice connection failed:', error);
            alert('Failed to connect to voice service');
        }
    }

    async handleServerMessage(data) {
        const type = data.type;
        console.log('📨 Received:', type);

        switch(type) {
            case 'conversation.item.input_audio_transcription.completed':
                const transcript = data.transcript;
                console.log('👤 User said:', transcript);
                this.pendingUserTranscript = transcript;
                break;

            case 'response.audio_transcript.delta':
                if (!this.currentAssistantMessage) {
                    if (this.pendingUserTranscript) {
                        appendMessage('user', this.pendingUserTranscript);
                        this.pendingUserTranscript = null;
                    }
                    
                    this.currentAssistantMessage = this.createStreamingMessage();
                    this.accumulatedText = '';
                }
                
                this.accumulatedText += data.delta;
                
                this.currentAssistantMessage.innerHTML = marked.parse(this.accumulatedText);
                
                this.currentAssistantMessage.querySelectorAll('pre code:not(.hljs)').forEach((block) => {
                    hljs.highlightElement(block);
                });
                
                this.scrollToBottom();
                this.setWaveState('processing');
                break;

            case 'response.audio_transcript.done':
                if (this.currentAssistantMessage) {
                    const text = this.accumulatedText;
                    this.currentAssistantMessage.parentElement.parentElement.remove();
                    appendMessage('assistant', text);
                    this.currentAssistantMessage = null;
                    this.accumulatedText = '';
                }
                break;

            case 'response.audio.delta':
                await this.playAudioChunk(data.delta);
                this.setWaveState('processing');
                break;

            case 'input_audio_buffer.speech_started':
                this.setWaveState('listening');
                this.stopAllAudio();
                if (this.playbackContext) {
                    this.nextPlayTime = this.playbackContext.currentTime;
                }
                break;

            case 'input_audio_buffer.speech_stopped':
                this.setWaveState('processing');
                break;

            case 'response.done':
                setTimeout(() => {
                    this.nextPlayTime = 0;
                    this.currentAudioSources = [];
                    this.setWaveState('idle');
                }, 500);
                break;

            case 'conversation_created':
                if (data.conversation_id) {
                    currentConversationId = data.conversation_id;
                    console.log('✅ Voice conversation created:', currentConversationId);
                    if (currentUser) {
                        loadConversations();
                    }
                }
                break;

            case 'error':
                console.error('❌ Server error:', data.message);
                alert('Error: ' + data.message);
                break;

            default:
                break;
        }
    }

    createStreamingMessage() {
        const container = getActiveMessagesContainer();
        if (!container) return null;
        
        const streamingDiv = document.createElement('div');
        streamingDiv.className = 'message assistant streaming-message';
        streamingDiv.innerHTML = `
            <div class="message-content" style="text-align: left !important; width: 100% !important;">
                <div class="response-content" style="text-align: left !important; width: 100% !important; display: block !important;"></div>
            </div>
        `;
        container.appendChild(streamingDiv);
        this.scrollToBottom();
        const responseContent = streamingDiv.querySelector('.response-content');
        
        if (responseContent) {
            responseContent.style.textAlign = 'left';
            responseContent.style.width = '100%';
            responseContent.style.display = 'block';
        }
        
        return responseContent;
    }

    async startListening() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ 
                sampleRate: 24000 
            });
            
            this.audioStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 24000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });

            const source = this.audioContext.createMediaStreamSource(this.audioStream);
            
            const processor = this.audioContext.createScriptProcessor(2048, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (this.isListening && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    
                    const pcm16 = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }
                    
                    const audioMessage = {
                        type: 'input_audio_buffer.append',
                        audio: this.arrayBufferToBase64(pcm16.buffer)
                    };
                    
                    try {
                        this.ws.send(JSON.stringify(audioMessage));
                    } catch (error) {
                        console.error('❌ Send error:', error);
                    }
                }
            };

            source.connect(processor);
            processor.connect(this.audioContext.destination);
            this.audioWorklet = processor;

            this.isListening = true;
            this.setWaveState('idle');
            
            console.log('🎤 Microphone ready - speak now');

        } catch (error) {
            console.error('❌ Microphone error:', error);
            this.setWaveState('idle');
            alert('Microphone access required for voice mode. Please allow microphone access and try again.');
        }
    }

    stopListening() {
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        if (this.audioWorklet) {
            this.audioWorklet.disconnect();
            this.audioWorklet = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isListening = false;
        this.setWaveState('idle');
        
        console.log('🛑 Stopped listening');
    }

    async playAudioChunk(base64Audio) {
        try {
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            if (!this.playbackContext || this.playbackContext.state === 'closed') {
                this.playbackContext = new (window.AudioContext || window.webkitAudioContext)({ 
                    sampleRate: 24000 
                });
                this.nextPlayTime = this.playbackContext.currentTime;
                this.currentAudioSources = [];
            }

            const pcm16 = new Int16Array(bytes.buffer);
            const audioBuffer = this.playbackContext.createBuffer(1, pcm16.length, 24000);
            const channelData = audioBuffer.getChannelData(0);
            
            for (let i = 0; i < pcm16.length; i++) {
                channelData[i] = pcm16[i] / 32768.0;
            }

            const source = this.playbackContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.playbackContext.destination);
            
            const currentTime = this.playbackContext.currentTime;
            const startTime = Math.max(currentTime + 0.01, this.nextPlayTime);
            
            this.currentAudioSources.push(source);
            
            source.onended = () => {
                const index = this.currentAudioSources.indexOf(source);
                if (index > -1) {
                    this.currentAudioSources.splice(index, 1);
                }
            };
            
            source.start(startTime);
            this.nextPlayTime = startTime + audioBuffer.duration;

        } catch (error) {
            console.error('❌ Audio playback error:', error);
        }
    }

    stopAllAudio() {
        console.log('🛑 Stopping all audio playback');
        
        if (this.currentAudioSources && this.currentAudioSources.length > 0) {
            this.currentAudioSources.forEach(source => {
                try {
                    source.stop();
                    source.disconnect();
                } catch (e) {
                    // Already stopped
                }
            });
            this.currentAudioSources = [];
        }
        
        if (this.playbackContext) {
            try {
                this.playbackContext.close();
            } catch (e) {
                // Already closed
            }
            this.playbackContext = null;
            this.nextPlayTime = 0;
        }
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    scrollToBottom() {
        const container = getActiveMessagesContainer();
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    disconnect() {
        this.stopListening();
        this.stopAllAudio();
        
        if (this.playbackContext) {
            try {
                this.playbackContext.close();
            } catch (e) {
                // Already closed
            }
            this.playbackContext = null;
        }
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        this.isConnected = false;
        this.currentAssistantMessage = null;
        this.accumulatedText = '';
        this.pendingUserTranscript = null;
        this.setWaveState('idle');
        console.log('👋 Voice client disconnected');
    }
} 

if (isVoiceModeEnabled) {
    document.getElementById('voice-controls').classList.add('active');
    document.querySelector('.input-wrapper').classList.add('voice-hidden');
    if (!voiceClient) {
        voiceClient = new VoiceSearchClient();
        voiceClient.connect();
    }
}

// Set initial button states
document.querySelectorAll('.mode-btn').forEach(btn => {
    if (btn.dataset.mode === searchMode) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }
});

async function downloadPDF(messageId) {
    try {
        const token = localStorage.getItem('access_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`${API_URL}/messages/${messageId}/pdf`, {
            headers: headers
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `noir-ai-response-${messageId.substring(0, 8)}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } else {
            alert('Failed to generate PDF');
        }
    } catch (error) {
        console.error('PDF download error:', error);
        alert('Error downloading PDF');
    }
}

function renderMarkdown(text) {
    let html = marked.parse(text);
    
    html = html.replace(/(<p><img[^>]+><\/p>\s*)+/g, (match) => {
        const imgs = match.match(/<img[^>]+>/g) || [];
        return '<div class="image-gallery">' + imgs.join('') + '</div>';
    });
    
    return html;
}

function toggleChartCode(index, event) {
    event.stopPropagation();
    const codeSection = document.getElementById(`code-section-${index}`);
    const codeBlock = document.getElementById(`code-block-${index}`);
    const btn = event.currentTarget;
    
    console.log(`Code block ${index} content:`, codeBlock?.textContent?.substring(0, 100));
    console.log(`From storage:`, window.assetCodeData[index]?.substring(0, 100));
    
    if (codeSection.style.display === 'none') {
        codeSection.style.display = 'block';
        btn.classList.add('active');
    } else {
        codeSection.style.display = 'none';
        btn.classList.remove('active');
    }
}

function copyChartCode(index) {
    const code = window.assetCodeData[index];
    if (!code) {
        alert('Code not available');
        return;
    }
    
    navigator.clipboard.writeText(code).then(() => {
        const btn = event.target.closest('.code-copy-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span style="color: #00ff41;">✓ Copied!</span>';
        
        setTimeout(() => {
            btn.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy code');
    });
}

function renderAssetsTab(assets) {
    console.log('=== renderAssetsTab CALLED ===');
    console.log('Assets received:', assets);
    
    let parsedAssets = assets;
    if (typeof assets === 'string') {
        try {
            parsedAssets = JSON.parse(assets);
            console.log('Parsed JSON assets:', parsedAssets);
        } catch (e) {
            console.error('Failed to parse assets JSON:', e);
            return '<div style="padding: 20px; text-align: center; color: red;">Error parsing assets data</div>';
        }
    }
    
    if (!Array.isArray(parsedAssets)) {
        console.error('Assets is not an array');
        return '<div style="padding: 20px; text-align: center; color: #666;">Invalid assets format</div>';
    }
    
    if (parsedAssets.length === 0) {
        return '<div style="padding: 20px; text-align: center; color: #666;">No assets extracted</div>';
    }
    
    if (!window.pendingCharts) window.pendingCharts = [];
    
    let html = '<div class="assets-container">';
    
    parsedAssets.forEach((asset, index) => {
        console.log('Processing asset', index, ':', asset);
      
        if (!asset.x || !asset.y || !asset.name) {
            console.warn('Skipping invalid asset:', asset);
            return;
        }
        
        const chartTitle = asset.name;
        const chartType = asset.chartType || 'line';
        const canvasId = `chart-canvas-${index}-${Date.now()}`;
        
        const pythonCode = generatePythonCode(asset);
        
        html += `
            <div class="asset-item asset-chart">
                <div class="asset-header">
                    <div>
                        <span class="asset-type">📊 ${escapeHtml(chartType.toUpperCase())} CHART</span>
                        <span class="asset-title">${escapeHtml(chartTitle)}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="asset-download-btn" id="download-btn-${index}" onclick="downloadCanvasChart('${canvasId}', '${escapeHtml(chartTitle.replace(/'/g, "\\\'"))}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            PNG
                        </button>
                    </div>
                </div>
                
                <div class="chart-tabs" id="chart-tabs-${index}">
                    <button class="chart-tab active" data-index="${index}" onclick="switchChartTab(${index}, 'chart')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                        Chart
                    </button>
                    <button class="chart-tab" data-index="${index}" onclick="switchChartTab(${index}, 'code')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 18 22 12 16 6"></polyline>
                            <polyline points="8 6 2 12 8 18"></polyline>
                        </svg>
                        Python Code
                    </button>
                </div>
                
                <div class="chart-view active" id="chart-view-${index}">
                    <div class="chart-container" style="padding: 20px;">
                        <canvas id="${canvasId}" style="max-height: 400px; width: 100%;"></canvas>
                    </div>
                </div>
                
                <div class="chart-view" id="code-view-${index}" style="display: none;">
                    <div class="code-section">
                        <div class="code-header">
                            <span class="code-label">Python Code (Matplotlib)</span>
                            <button class="code-copy-btn" onclick="copyChartCode(${index})">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                Copy
                            </button>
                        </div>
                        <pre><code class="language-python" id="code-block-${index}">${escapeHtml(pythonCode)}</code></pre>
                    </div>
                </div>
            </div>
        `;
        
        window.pendingCharts.push({
            canvasId: canvasId,
            chartType: chartType,
            labels: asset.x,
            data: asset.y,
            label: chartTitle
        });
        
        if (!window.chartPythonCode) window.chartPythonCode = {};
        window.chartPythonCode[index] = pythonCode;
    });
    
    html += '</div>';
    
    console.log(`✅ Rendered ${parsedAssets.length} assets`);
    
    setTimeout(() => {
        if (window.pendingCharts && window.pendingCharts.length > 0) {
            console.log('Drawing pending charts:', window.pendingCharts.length);
            
            window.pendingCharts.forEach(chartInfo => {
                const canvas = document.getElementById(chartInfo.canvasId);
                if (canvas) {
                    console.log('Drawing chart on canvas:', chartInfo.canvasId);
                    drawChart(canvas, chartInfo);
                } else {
                    console.error('Canvas not found:', chartInfo.canvasId);
                }
            });
            
            window.pendingCharts = [];
        }
        
        if (typeof hljs !== 'undefined') {
            document.querySelectorAll('.code-section pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }, 200);
    
    return html;
}

function generatePythonCode(asset) {
    const chartType = asset.chartType || 'line';
    const title = asset.name;
    const xData = JSON.stringify(asset.x);
    const yData = JSON.stringify(asset.y);
    
    let code = `import matplotlib.pyplot as plt\nimport numpy as np\n\n`;
    code += `# Data\n`;
    code += `x_labels = ${xData}\n`;
    code += `y_values = ${yData}\n\n`;
    
    if (chartType === 'pie' || chartType === 'doughnut') {
        code += `# Create pie chart\n`;
        code+= `fig, ax = plt.subplots(figsize=(10, 6))\n`;
        code += `ax.pie(y_values, labels=x_labels, autopct='%1.1f%%', startangle=90)\n`;
        code += `ax.set_title('${title}')\n`;
        if (chartType === 'doughnut') {
            code += `# Create donut effect\n`;
            code += `centre_circle = plt.Circle((0, 0), 0.70, fc='white')\n`;
            code += `fig.gca().add_artist(centre_circle)\n`;
        }
    } else if (chartType === 'bar') {
        code += `# Create bar chart\n`;
        code += `fig, ax = plt.subplots(figsize=(12, 6))\n`;
        code += `x_pos = np.arange(len(x_labels))\n`;
        code += `ax.bar(x_pos, y_values, color='#667eea')\n`;
        code += `ax.set_xlabel('Categories')\n`;
        code += `ax.set_ylabel('Values')\n`;
        code += `ax.set_title('${title}')\n`;
        code += `ax.set_xticks(x_pos)\n`;
        code += `ax.set_xticklabels(x_labels, rotation=45, ha='right')\n`;
        code += `ax.grid(axis='y', alpha=0.3)\n`;
    } else {
        code += `# Create line chart\n`;
        code += `fig, ax = plt.subplots(figsize=(12, 6))\n`;
        code += `ax.plot(x_labels, y_values, marker='o', linewidth=2, color='#667eea')\n`;
        code += `ax.set_xlabel('Categories')\n`;
        code += `ax.set_ylabel('Values')\n`;
        code += `ax.set_title('${title}')\n`;
        code += `ax.grid(True, alpha=0.3)\n`;
        code += `plt.xticks(rotation=45, ha='right')\n`;
    }
    
    code += `\nplt.tight_layout()\n`;
    code += `plt.show()\n`;
    
    return code;
}

function switchChartTab(index, view) {
    const chartView = document.getElementById(`chart-view-${index}`);
    const codeView = document.getElementById(`code-view-${index}`);
    const downloadBtn = document.getElementById(`download-btn-${index}`);
    const tabs = document.querySelectorAll(`#chart-view-${index}`).length > 0 
        ? document.querySelectorAll(`#chart-view-${index}`)[0].closest('.asset-chart').querySelectorAll('.chart-tab')
        : [];
    
    if (view === 'chart') {
        chartView.style.display = 'block';
        codeView.style.display = 'none';
        tabs[0]?.classList.add('active');
        tabs[1]?.classList.remove('active');
        if (downloadBtn) downloadBtn.style.display = 'flex';
    } else {
        chartView.style.display = 'none';
        codeView.style.display = 'block';
        tabs[0]?.classList.remove('active');
        tabs[1]?.classList.add('active');
        if (downloadBtn) downloadBtn.style.display = 'none';
    }
}

function drawChart(canvas, chartInfo) {
    if (!canvas || typeof Chart === 'undefined') {
        console.error('Cannot draw chart: missing canvas or Chart.js');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    const { chartType, labels, data, label } = chartInfo;
    
    if (chartType === 'pie' || chartType === 'doughnut') {
        new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
                        '#E7E9ED', '#FF8A80', '#82B1FF', '#FFFF8D',
                        '#B2FF59', '#FF80AB', '#EA80FC', '#8C9EFF'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 10 } }
                    },
                    title: {
                        display: true,
                        text: label,
                        font: { size: 14, weight: 'bold' }
                    }
                }
            }
        });
    } else if (chartType === 'bar') {
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    backgroundColor: '#667eea',
                    borderColor: '#667eea',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: label,
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    } else {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: label,
                        font: { size: 14, weight: 'bold' }
                    }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

function downloadCanvasChart(canvasId, title) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.error('Canvas not found:', canvasId);
        return;
    }
    
    const link = document.createElement('a');
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function downloadChartImage(index, title, chartType) {
    const imageData = window.assetMarkdownData[index];
    if (!imageData) {
        console.error('No image data found for index:', index);
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_')}_${chartType}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Unified mode switching function
async function switchMode(mode) {
 
    console.log(`🔄 Switching to mode: ${mode}`);
    localStorage.setItem('search_mode', mode);
     

    modeelem = document.getElementById('mode')   
    modeelem.innerHTML = mode
 
    if (mode === 'voice') {
        isVoiceModeEnabled = true;
        isDeepSearchEnabled = false;
        isLabModeEnabled = false;
        searchMode = 'voice';
        
        document.getElementById('voice-controls').classList.add('active');
        document.querySelector('.input-wrapper').classList.add('voice-hidden');
        
        if (!voiceClient || !voiceClient.isConnected) {
            voiceClient = new VoiceSearchClient();
            await voiceClient.connect();
        } else if (!voiceClient.isListening) {
            await voiceClient.startListening();
        }
        
        console.log('✓ Voice mode enabled - listening started');
    } else {
        if (isVoiceModeEnabled && voiceClient) {
            voiceClient.disconnect();
            voiceClient = null;
        }
        isVoiceModeEnabled = false;
        
        document.getElementById('voice-controls').classList.remove('active');
        document.querySelector('.input-wrapper').classList.remove('voice-hidden');
        
        searchMode = mode;
        isDeepSearchEnabled = mode === 'deep' || mode === 'lab';
        isLabModeEnabled = mode === 'lab';
        
        console.log(`✓ ${mode.toUpperCase()} mode enabled`);
    }
    

}

// Event listeners for .mode-icon-btn (icon buttons)
// document.querySelectorAll('.mode-icon-btn').forEach(btn => {
//     btn.addEventListener('click', async function(e) {
//         e.preventDefault();
//         const mode = this.dataset.mode;
        
//         document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
//         document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
//         this.classList.add('active');
        
//         await switchMode(mode);
//     });
// });

document.querySelectorAll('.mode-icon-btn').forEach(btn => {

    btn.addEventListener('click', async function(e) {
    
        e.preventDefault();
        const mode = this.dataset.mode;

        // ✅ CHECK LOGIN STATUS FOR RESTRICTED MODES
        if ((mode === 'deep' || mode === 'lab' || mode === 'voice') && !isUserLoggedIn()) {
            console.log(`🔒 ${mode.toUpperCase()} mode requires login`);
            
            // Show login panel
            openLoginPanel();
            
            // Show a message
            showAuthError(`Please log in to use ${mode === 'deep' ? 'Deep Search' : mode === 'lab' ? 'Lab Mode' : 'Voice Mode'}`);
            
            // Don't switch mode
            return;
        }
        
        // Continue with mode switch for normal mode or logged-in users
        document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        await switchMode(mode);
    });
});

// Event listeners for .mode-btn (text buttons) - if you have them
// document.querySelectorAll('.mode-btn').forEach(btn => {
//     btn.addEventListener('click', async function(e) {
//         e.preventDefault();
//         const mode = this.dataset.mode;
        
//         document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
//         document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
//         this.classList.add('active');
        
//         await switchMode(mode);
//     });
// });

document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async function(e) {
        e.preventDefault();
        const mode = this.dataset.mode;
        
        // ✅ CHECK LOGIN STATUS FOR RESTRICTED MODES
        if ((mode === 'deep' || mode === 'lab' || mode === 'voice') && !isUserLoggedIn()) {
            console.log(`🔒 ${mode.toUpperCase()} mode requires login`);
            
            // Show login panel
            openLoginPanel();
            
            // Show a message
            showAuthError(`Please log in to use ${mode === 'deep' ? 'Deep Search' : mode === 'lab' ? 'Lab Mode' : 'Voice Mode'}`);
            
            // Don't switch mode
            return;
        }
        
        // Continue with mode switch for normal mode or logged-in users
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        
        await switchMode(mode);
    });
});

// Initialize from localStorage on page load
const savedMode = localStorage.getItem('search_mode') || 'normal';
if (savedMode === 'voice') {
    const voiceModeBtn = document.querySelector('.mode-icon-btn[data-mode="voice"]') || 
                         document.querySelector('.mode-btn[data-mode="voice"]');
    if (voiceModeBtn) {
        voiceModeBtn.click();
    }
} else {
    document.querySelectorAll('.mode-icon-btn, .mode-btn').forEach(btn => {
        if (btn.dataset.mode === savedMode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    searchMode = savedMode;
    isDeepSearchEnabled = savedMode === 'deep' || savedMode === 'lab';
    isLabModeEnabled = savedMode === 'lab';
    
    document.getElementById('voice-controls')?.classList.remove('active');
    document.querySelector('.input-wrapper')?.classList.remove('voice-hidden');
}

// Voice stop button
document.getElementById('voice-stop-btn')?.addEventListener('click', () => {
    if (voiceClient) {
        voiceClient.disconnect();
    }
    
    isVoiceModeEnabled = false;
    searchMode = 'normal';
    isDeepSearchEnabled = false;
    isLabModeEnabled = false;
    
    document.getElementById('voice-controls').classList.remove('active');
    document.querySelector('.input-wrapper').classList.remove('voice-hidden');
    
    document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-mode="normal"]').classList.add('active');
    
    localStorage.setItem('search_mode', 'normal');
    console.log('✓ Exited voice mode');
});

// Google OAuth Handler
document.getElementById('google-auth-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('google-auth-btn');
    btn.disabled = true;
    btn.innerHTML = '<span style="color: #666;">Loading...</span>';
    
    try {
        window.location.href = `${API_URL}/auth/login`;
    } catch (error) {
        console.error('Google auth error:', error);
        showAuthError('Connection error');
        btn.disabled = false;
        btn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
        `;
    }
});

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

window.addEventListener('load', async () => { 
     
    document.querySelectorAll('.mode-icon-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));

    let normalSearchBtn = document.querySelectorAll('.mode-icon-btn')[1]
    normalSearchBtn.classList.add('active');

    let normalSearchBtn2 = document.querySelectorAll('.mode-btn')[1]
    normalSearchBtn2.classList.add('active');
    
    mode = 'normal'
    await switchMode(mode);
});

// Handle OAuth callback
window.addEventListener('load', async () => { 

    const urlParams = new URLSearchParams(window.location.search);
    // alert('laod')
    console.log('🔍 Page loaded, checking OAuth wizardState...');
    console.log('URL params:', window.location.search);
    
    const error = urlParams.get('error');
    if (error) {
        console.error('❌ OAuth error:', error);
        showAuthError('Google sign-in failed: ' + error);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    
    const oauthSuccess = urlParams.get('oauth_success');
    const token = urlParams.get('token');
    
    const userId = urlParams.get('user_id');
    const username = urlParams.get('username');
    const email = urlParams.get('email');

    if (oauthSuccess === 'true' && token && userId) {
        console.log('✅ OAuth success detected!');
        console.log('Token:', token.substring(0, 20) + '...');
        console.log('User ID:', userId);
        console.log('Username:', username);
        console.log('Email:', email);
         
        localStorage.setItem('access_token', token);
        localStorage.setItem('user_id', userId);
        localStorage.setItem('username', username);
        localStorage.setItem('email', email);
         
        currentUser = {
            user_id: userId,
            email: email,
            token: token
        };
        
        console.log('✅ User logged in:', currentUser);
        
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
         
        showLoggedInState(email);
        await loadConversations();
        toggleEmptyChat();
        
        showAuthSuccess('Welcome! Signed in with Google');
        setTimeout(() => hideAuthMessages(), 2000);


        return;
    }
    
    const existingToken = localStorage.getItem('access_token');
    const existingUserId = localStorage.getItem('user_id');
    const existingUsername = localStorage.getItem('username');
    const existingUsermail = localStorage.getItem('email');

    if (existingToken && existingUserId) {
        console.log('📋 Restoring existing session...');
        
        currentUser = {
            user_id: existingUserId,
            email: localStorage.getItem('email') || '',
            token: existingToken
        };
        
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
        showLoggedInState(existingUsermail);
        await loadConversations();
        toggleEmptyChat();
    } else {
        console.log('👤 No active session, showing logged out state');
        showLoggedOutState();
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
        toggleEmptyChat();
    }
    
    hideAuthMessages();
});

// News functionality
const API_BASE_URL = API_URL;
let currentNewsCategory = 'general';
let userLocation = { country: 'US', city: 'Unknown', countryName: 'United States' };

const categoryData = {
    'general': { icon: '🌐', name: 'General' },
    'sports': { icon: '⚽', name: 'Sports' },
    'technology': { icon: '💻', name: 'Technology' },
    'business': { icon: '💼', name: 'Finance' },
    'entertainment': { icon: '🎬', name: 'Entertainment' },
    'politics': { icon: '🏛️', name: 'Politics' }
};

async function detectUserLocation() {
    try {
        const response = await fetch(`${API_BASE_URL}/detect-country`);
        const data = await response.json();
        
        userLocation = {
            country: data.country_code || 'US',
            countryName: data.country_name || 'United States',
            city: data.country_name || 'United States'
        };
        
        const locationHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>${userLocation.countryName}</span>
        `;
        
        document.getElementById('news-panel-location').innerHTML = locationHTML;
        console.log('📍 Location detected:', userLocation);
    } catch (error) {
        console.error('Location detection failed:', error);
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            userLocation = {
                country: data.country_code || 'US',
                city: data.city || 'Unknown',
                countryName: data.country_name || 'United States'
            };
            
            const locationHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${userLocation.city}, ${userLocation.countryName}</span>
            `;
            
            document.getElementById('news-panel-location').innerHTML = locationHTML;
        } catch (e) {
            console.error('Fallback location detection failed:', e);
        }
    }
}

async function fetchNews(category = 'general') {
    const contentEl = document.getElementById('news-content');
    
    try {
        contentEl.innerHTML = '<div class="news-loading">Please wait...</div>';
        
        const country = userLocation.country.toUpperCase();
        const url = `${API_BASE_URL}/news?category=${category}&country=${country}`;
        
        console.log(`📡 Fetching: ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, { 
            signal: controller.signal,
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && data.articles && data.articles.length > 0) {
            console.log(`✅ Received ${data.articles.length} articles`);
            console.log(`📦 Cached at: ${data.cached_at}`);
            renderNews(data.articles, category);
        } else {
            throw new Error('No articles received from server');
        }
        
    } catch (error) {
        console.error('❌ Error fetching news:', error);
        
        let errorMessage = '';
        
        if (error.name === 'AbortError') {
            errorMessage = `
                <div style="text-align: center; padding: 40px; color: #ff4444;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⏱️</div>
                    <div style="font-size: 18px; margin-bottom: 12px;">Request Timeout</div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 20px;">
                        The server took too long to respond
                    </div>
                    <button onclick="fetchNews('${category}')" style="
                        padding: 10px 20px;
                        background: #3a3a3a;
                        border: 1px solid #555;
                        color: #fff;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Roboto Mono', monospace;
                    ">Try Again</button>
                </div>
            `;
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage = `
                <div style="text-align: center; padding: 40px; color: #ff4444;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔌</div>
                    <div style="font-size: 18px; margin-bottom: 12px;">Cannot Connect to Server</div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">
                        Make sure the FastAPI backend is running
                    </div>
                    <div style="font-size: 12px; color: rgba(255,255,255,0.5);">
                        Expected at: <span style="color: #d4a574;">${API_BASE_URL}</span>
                    </div>
                    <button onclick="fetchNews('${category}')" style="
                        margin-top: 20px;
                        padding: 10px 20px;
                        background: #3a3a3a;
                        border: 1px solid #555;
                        color: #fff;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Roboto Mono', monospace;
                    ">Retry Connection</button>
                </div>
            `;
        } else {
            errorMessage = `
                <div style="text-align: center; padding: 40px; color: #ff4444;">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div style="font-size: 18px; margin-bottom: 12px;">Error Loading News</div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 20px;">
                        ${error.message || 'Unknown error occurred'}
                    </div>
                    <button onclick="fetchNews('${category}')" style="
                        padding: 10px 20px;
                        background: #3a3a3a;
                        border: 1px solid #555;
                        color: #fff;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Roboto Mono', monospace;
                    ">Try Again</button>
                </div>
            `;
        }
        
        contentEl.innerHTML = errorMessage;
    }
}

function renderNews(articles, category) {
    const contentEl = document.getElementById('news-content');
    
    if (!articles || articles.length === 0) {
        contentEl.innerHTML = '<div class="news-loading">No news available</div>';
        return;
    }
    
    const newsGrid = document.createElement('div');
    newsGrid.className = 'news-grid';
    
    articles.forEach(article => {
        const card = createNewsCard(article, category);
        if(card)
        {
            newsGrid.appendChild(card);
        }
    });
    
    contentEl.innerHTML = '';
    contentEl.appendChild(newsGrid);
}

// function createNewsCard(article, category) {
//     const card = document.createElement('div');
//     card.className = 'news-card';
    
//     let domain = 'Unknown Source';
//     try {
//         const url = new URL(article.link);
//         domain = url.hostname.replace('www.', '');
//     } catch (e) {}
    
//     const timeAgo = getTimeAgo(new Date(article.pubDate));
//     const imageUrl = article.thumbnail || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"%3E%3Crect fill="%23242424" width="400" height="200"/%3E%3C/svg%3E';
    
//     card.innerHTML = `
//         <img src="${imageUrl}" alt="${escapeHtml(article.title)}" class="news-image">
//         <div class="news-card-content">
//             <div class="news-card-header">
//                 <div class="news-provider">${escapeHtml(domain)}</div>
//                 <div class="news-time">${timeAgo}</div>
//             </div>
//             <div class="news-title">${escapeHtml(article.title)}</div>
//             <div class="news-snippet">${escapeHtml(article.description || '')}</div>
//             <div class="news-footer">
//                 <span class="news-category-tag">${categoryData[category].name}</span>
//                 <button class="news-read-btn" onclick="window.open('${escapeHtml(article.link)}', '_blank')">
//                     Read More →
//                 </button>
//             </div>
//         </div>
//     `;
    
//     return card;
// }

function createNewsCard(article, category) {
    if (!article.thumbnail || !article.title) {
        return null;
    }
    
    const card = document.createElement('div');
    card.className = 'news-card';
    
    let domain = 'Unknown Source';
    try {
        const url = new URL(article.link);
        domain = url.hostname.replace('www.', '');
    } catch (e) {}
    
    const timeAgo = getTimeAgo(new Date(article.pubDate));
    const imageUrl = article.thumbnail;
    
    card.innerHTML = `
        <img src="${imageUrl}" 
             alt="${escapeHtml(article.title)}" 
             class="news-image"
             style="display: none;">
        <div class="news-card-content">
            <div class="news-card-header">
                <div class="news-provider">${escapeHtml(domain)}</div>
                <div class="news-time">${timeAgo}</div>
            </div>
            <div class="news-title">${escapeHtml(article.title)}</div>
            <div class="news-snippet">${escapeHtml(article.description || '')}</div>
            <div class="news-footer">
                <span class="news-category-tag">${categoryData[category].name}</span>
                <button class="news-read-btn" onclick="window.open('${escapeHtml(article.link)}', '_blank')">
                    Read More →
                </button>
            </div>
        </div>
    `;
    
    const img = card.querySelector('.news-image');
    
    // Timeout to remove card if image doesn't load in 8 seconds
    const timeout = setTimeout(() => {
        card.remove();
    }, 8000);
    
    img.onload = function() {
        clearTimeout(timeout);
        
        // Check if image has reasonable dimensions
        if (this.naturalWidth < 100 || this.naturalHeight < 100) {
            card.remove();
            return;
        }
        
        // Check aspect ratio (avoid weird shapes)
        const aspectRatio = this.naturalWidth / this.naturalHeight;
        if (aspectRatio > 10 || aspectRatio < 0.1) {
            card.remove();
            return;
        }
        
        // Image is good - show it
        this.style.display = 'block';
    };
    
    img.onerror = function() {
        clearTimeout(timeout);
        card.remove();
    };
    
    return card;
}
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [name, secondsInInterval] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInInterval);
        if (interval >= 1) {
            return `${interval}${name[0]} ago`;
        }
    }
    return 'Just now';
}

// Event listeners
document.getElementById('news-btn')?.addEventListener('click', async () => {
    document.getElementById('news-selection-panel').classList.add('active');
    document.getElementById('news-panel-backdrop').classList.add('active');
    
    if (userLocation.city === 'Unknown') {
        await detectUserLocation();
    }
});

function closeNewsPanel() {
    document.getElementById('news-selection-panel').classList.remove('active');
    document.getElementById('news-panel-backdrop').classList.remove('active');
    document.getElementById('news-overlay').classList.remove('active');
}

document.getElementById('news-panel-close-btn')?.addEventListener('click', closeNewsPanel);
document.getElementById('news-panel-backdrop')?.addEventListener('click', closeNewsPanel);
document.getElementById('news-overlay-close')?.addEventListener('click', closeNewsPanel);

document.querySelectorAll('.news-category-item').forEach(item => {
    item.addEventListener('click', async function() {
        document.querySelectorAll('.news-category-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        
        currentNewsCategory = this.dataset.category;
        document.getElementById('news-overlay').classList.add('active');
        
        await fetchNews(currentNewsCategory);
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNewsPanel();
    }
});

window.addEventListener('load', () => {
    detectUserLocation();
});

function renderCategorizedSources(reasoningSteps) {
    if (!reasoningSteps || reasoningSteps.length === 0) {
        return '<div class="no-content">No sources found</div>';
    }
    
    const stepsWithSources = reasoningSteps.filter(step => 
        step.sources && step.sources.length > 0 && step.query
    );
    
    if (stepsWithSources.length === 0) {
        return '<div class="no-content">No sources found</div>';
    }
    
    let html = '<div class="categorized-sources-container">';
    
    stepsWithSources.forEach((step, index) => {
        html += `
            <div class="query-sources-group">
                <div class="query-header-simple">
                    <span class="query-number">${index + 1}</span>
                    <span class="query-text">${escapeHtml(step.query || step.step)}</span>
                    <span class="query-source-count">${step.sources.length} sources</span>
                </div>
                <div class="query-sources-grid">
                    ${renderSourcesList(step.sources)}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    return html;
}

function renderSourcesList(sources) {
    return sources.map(source =>{
        const url = typeof source === 'string' ? source : source.url;
        const title = typeof source === 'object' ? source.title || '' : '';
        // const snippet = typeof source === 'object' ? source.snippet || '' : '';
        
        let domain = '';
        let displayUrl = url;
        try {
            const urlObj = new URL(url);
            domain = urlObj.hostname;
            displayUrl = urlObj.hostname + urlObj.pathname;
            if (displayUrl.length > 60) {
                displayUrl = displayUrl.substring(0, 60) + '...';
            }
        } catch (e) {
            domain = '';
        }
        
        return `
     
                <div class="source-card">
                    <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" 
                            class="source-favicon" 
                            alt=""
                            onerror="this.style.display='none'">
                    <div class="source-details">
                        <span id="title"> ${escapeHtml(title || domain || 'Source')} </span> 
                        <a class="source-url" href="${url}" target="_blank" > ${escapeHtml(displayUrl)}  </a>
                    </div>
                </div>
        `;
    }).join('');
}

function toggleQuerySources(headerElement) {
    const group = headerElement.closest('.query-sources-group');
    const sourcesDiv = group.querySelector('.query-sources');
    const toggle = headerElement.querySelector('.query-toggle');
    
    sourcesDiv.classList.toggle('collapsed');
    toggle.classList.toggle('expanded');
}

const fullscreenDownloadCSS = `
.app-fullscreen-download {
    padding: 8px 16px;
    background: rgba(212, 165, 116, 0.1);
    border: 1px solid rgba(212, 165, 116, 0.3);
    color: #d4a574;
    border-radius: 6px;
    cursor: pointer;
    font-family: 'Roboto Mono', monospace;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
}

.app-fullscreen-download:hover {
    background: rgba(212, 165, 116, 0.2);
    border-color: rgba(212, 165, 116, 0.5);
    transform: translateY(-1px);
}

.app-fullscreen-download svg {
    width: 14px;
    height: 14px;
}
`;

// Inject the CSS
const style = document.createElement('style');
style.textContent = fullscreenDownloadCSS;
document.head.appendChild(style);   
// function toggleConversationsPanel() {
//     const panel = document.querySelector('.conversations-panel');
//     if (panel) {
//         console.log('Toggling panel, current state:', panel.classList.contains('collapsed'));
//         panel.classList.toggle('collapsed');
        
//         // Save state to localStorage
//         const isCollapsed = panel.classList.contains('collapsed');
//         localStorage.setItem('conversations_panel_collapsed', isCollapsed);
//         console.log('Panel collapsed:', isCollapsed);
//     } else {
//         console.error('Conversations panel not found!');
//     }
// }

function updateConversationTooltips() {
    const panel = document.querySelector('.conversations-panel');
    if (panel) {
        const conversations = panel.querySelectorAll('.conversation-item');
        conversations.forEach(conv => {
            const title = conv.querySelector('.conversation-title');
            if (title) {
                conv.setAttribute('data-tooltip', title.textContent);
            }
        });
    }
}
document.addEventListener('DOMContentLoaded', () => {
 
    const toggleBtn = document.createElement('button');
    toggleBtn.id = "toggleBtn"
    toggleBtn.className = 'panel-toggle-btn';
    toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
        </svg>
    `;

    // toggleBtn.style.position = 'fixed';
    // toggleBtn.style.top = '10px';
    // toggleBtn.style.left = '10px';
    // toggleBtn.style.padding = '10px';
    // toggleBtn.style.backgroundColor = '#333';
    // toggleBtn.style.color = 'white';
    // toggleBtn.style.zIndex = '1000';

    toggleBtn.addEventListener('click', toggleConversationsPanel);
    const chat_area = document.getElementById('chat-area');

    // document.body.appendChild(toggleBtn)
    chat_area.appendChild(toggleBtn)
    toggleEmptyChat();
    
    // Initialize panel toggle button
    const panel = document.querySelector('.conversations-panel');
    if (panel) {
        // Create toggle button
        // const toggleBtn = document.createElement('button');
        // toggleBtn.id = "toggleBtn"
        // toggleBtn.className = 'panel-toggle-btn';
        // toggleBtn.innerHTML = `
        //     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        //         <path d="M15 18l-6-6 6-6"/>
        //     </svg>
        // `;
        // toggleBtn.addEventListener('click', toggleConversationsPanel);
        // panel.appendChild(toggleBtn);
        
        // Restore saved state
        const savedState = localStorage.getItem('conversations_panel_collapsed');
        if (savedState === 'true') {
            panel.classList.add('collapsed');
        }
        
        // Add tooltips to conversation items
        const conversations = panel.querySelectorAll('.conversation-item');
        conversations.forEach(conv => {
            const title = conv.querySelector('.conversation-title');
            if (title) {
                conv.setAttribute('data-tooltip', title.textContent);
            }
        });
        
        // Add tooltip to new conversation button
        const newBtn = panel.querySelector('.new-conversation-btn');
        if (newBtn) {
            newBtn.setAttribute('data-tooltip', 'New Conversation');
        }
        
        // Add tooltip to logout button
        const logoutBtn = panel.querySelector('.auth-logout-button');
        if (logoutBtn) {
            logoutBtn.setAttribute('data-tooltip', 'Logout');
        }
    }
});

// Initialize from localStorage on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedMode = localStorage.getItem('search_mode') || 'normal';
    
    // ✅ FORCE NORMAL MODE IF NOT LOGGED IN
    let modeToActivate = savedMode;
    if ((savedMode === 'deep' || savedMode === 'lab' || savedMode === 'voice') && !isUserLoggedIn()) {
        console.log('🔒 Restricted mode detected without login, switching to normal mode');
        modeToActivate = 'normal';
        localStorage.setItem('search_mode', 'normal');
    }
    
    if (modeToActivate === 'voice') {
        const voiceModeBtn = document.querySelector('.mode-icon-btn[data-mode="voice"]') || 
                             document.querySelector('.mode-btn[data-mode="voice"]');
        if (voiceModeBtn) {
            voiceModeBtn.click();
        }
    } else {
        document.querySelectorAll('.mode-icon-btn, .mode-btn').forEach(btn => {
            if (btn.dataset.mode === modeToActivate) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        searchMode = modeToActivate;
        isDeepSearchEnabled = modeToActivate === 'deep' || modeToActivate === 'lab';
        isLabModeEnabled = modeToActivate === 'lab';
        
        document.getElementById('voice-controls')?.classList.remove('active');
        document.querySelector('.input-wrapper')?.classList.remove('voice-hidden');
    }
});

// Toggle conversations panel function
// function toggleConversationsPanel() {
//     const panel = document.querySelector('.conversations-panel');
//     if (panel) {
//         panel.classList.toggle('collapsed');
        
//         // Save state to localStorage
//         const isCollapsed = panel.classList.contains('collapsed');
//         localStorage.setItem('conversations_panel_collapsed', isCollapsed);
//     }
// }

// Update tooltips when conversations change
function updateConversationTooltips() {
    const panel = document.querySelector('.conversations-panel');
    if (panel) {
        const conversations = panel.querySelectorAll('.conversation-item');
        conversations.forEach(conv => {
            const title = conv.querySelector('.conversation-title');
            if (title) {
                conv.setAttribute('data-tooltip', title.textContent);
            }
        });
    }
}

// function renderAppsTab(apps) {
//     if (!apps || (Array.isArray(apps) && apps.length === 0)) {
//         return '<div class="no-content">No apps available</div>';
//     }
    
//     // Convert single app to array format for backwards compatibility
//     const appsArray = Array.isArray(apps) ? apps : [apps];
    
//     // Store all apps globally
//     if (!window.appsData) {
//         window.appsData = {};
//     }
    
//     const messageId = Date.now(); // Use a unique ID for this message
//     window.appsData[messageId] = appsArray;
    
//     // Current selected version (default to latest - last in array)
//     let currentVersion = appsArray.length - 1;
    
//     return `
//         <div class="apps-container">
//             ${appsArray.length > 1 ? `
//                 <div class="app-versions-selector">
//                     <div class="versions-header">
//                         <span class="versions-label">
//                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <circle cx="12" cy="12" r="10"></circle>
//                                 <polyline points="12 6 12 12 16 14"></polyline>
//                             </svg>
//                             Version History
//                         </span>
//                         <span class="versions-count">${appsArray.length} version${appsArray.length > 1 ? 's' : ''}</span>
//                     </div>
//                     <div class="versions-list" id="versions-list-${messageId}">
//                         ${appsArray.map((app, index) => `
//                             <div class="version-item ${index === currentVersion ? 'active' : ''}" 
//                                  onclick="switchAppVersion(${messageId}, ${index})"
//                                  data-version="${index}">
//                                 <div class="version-number">v${index}</div>
//                                 <div class="version-info">
//                                     <div class="version-title">Version ${index}</div>
//                                     ${index === appsArray.length - 1 ? '<div class="version-latest">Latest</div>' : ''}
//                                 </div>
//                                 ${index === currentVersion ? '<div class="version-current-badge">●</div>' : ''}
//                             </div>
//                         `).join('')}
//                     </div>
//                 </div>
//             ` : ''}
            
//             <div class="app-preview-container" id="app-preview-${messageId}">
//                 <div class="app-preview-header">
//                     <div class="app-preview-title">
//                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                             <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
//                             <line x1="9" y1="3" x2="9" y2="21"></line>
//                         </svg>
//                         <span id="app-title-${messageId}">Version ${currentVersion}</span>
//                         ${appsArray.length > 1 ? `<span class="app-version-badge">v${currentVersion}</span>` : ''}
//                     </div>
//                     <div class="app-preview-actions">
//                         <button class="action-btn" onclick="showSplitScreenVersion(${messageId}, ${currentVersion})">
//                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <rect x="3" y="3" width="7" height="7"></rect>
//                                 <rect x="14" y="3" width="7" height="7"></rect>
//                                 <rect x="14" y="14" width="7" height="7"></rect>
//                                 <rect x="3" y="14" width="7" height="7"></rect>
//                             </svg>
//                             Split View
//                         </button>
//                         <button class="action-btn" onclick="openAppFullscreenVersion(${messageId}, ${currentVersion})">
//                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
//                             </svg>
//                             Fullscreen
//                         </button>
//                         <button class="action-btn" onclick="downloadAppVersion(${messageId}, ${currentVersion})">
//                             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
//                                 <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
//                                 <polyline points="7 10 12 15 17 10"/>
//                                 <line x1="12" y1="15" x2="12" y2="3"/>
//                             </svg>
//                             Download
//                         </button>
//                     </div>
//                 </div>
//                 <div class="app-preview-iframe-container">
//                     <iframe 
//                         id="app-preview-iframe-${messageId}"
//                         sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
//                         class="app-preview-iframe"
//                     ></iframe>
//                 </div>
//             </div>
//         </div>
//     `;
// }



function switchAppVersion(messageId, versionIndex) {
    
    const apps = window.appsData[messageId];
    if (!apps || !apps[versionIndex]) {
        console.error('App version not found:', messageId, versionIndex);
        console.log('Available apps:', window.appsData);
        return;
    }
    
    console.log(`🔄 Switching to version ${versionIndex} for message ${messageId}`);
    console.log('Total versions available:', apps.length);
    
    // Update iframe with new version
    const iframe = document.getElementById(`app-preview-iframe-${messageId}`);
    if (iframe) {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(apps[versionIndex]);
        iframeDoc.close();
        console.log('✓ Iframe updated with version', versionIndex);
    } else {
        console.error('Iframe not found:', `app-preview-iframe-${messageId}`);
    }
    
    // Update dropdown selection
    const dropdown = document.getElementById(`version-select-${messageId}`);
    if (dropdown && dropdown.value !== versionIndex.toString()) {
        dropdown.value = versionIndex.toString();
        console.log('✓ Dropdown updated to:', versionIndex);
    }
    
    // Update title to show current version
    const title = document.getElementById(`app-title-${messageId}`);
    if (title) {
        const versionText = versionIndex === apps.length - 1 ? 
            `Interactive App (v${versionIndex} - Latest)` : 
            `Interactive App (v${versionIndex})`;
        title.querySelector('span').textContent = versionText;
    }
    
    console.log(`✅ Successfully switched to version ${versionIndex}`);
}

function showSplitScreenVersion(messageId, versionIndex) {
    const apps = window.appsData[messageId];
    if (!apps || !apps[versionIndex]) {
        alert('App version not available');
        return;
    }
    showSplitScreen(apps[versionIndex]);
}

function openAppFullscreenVersion(messageId, versionIndex) {
    const apps = window.appsData[messageId];
    if (!apps || !apps[versionIndex]) {
        alert('App version not available');
        return;
    }
    
    const overlay = document.createElement('div');
    overlay.className = 'app-fullscreen-overlay';
    overlay.innerHTML = `
        <div class="app-fullscreen-container">
            <div class="app-fullscreen-header">
                <span class="app-fullscreen-title">Version ${versionIndex}</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="app-fullscreen-download" onclick="event.stopPropagation(); downloadAppVersion(${messageId}, ${versionIndex})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download HTML
                    </button>
                    <button class="app-fullscreen-close" onclick="this.closest('.app-fullscreen-overlay').remove()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Close
                    </button>
                </div>
            </div>
            <iframe 
                id="fullscreen-app-iframe"
                class="app-fullscreen-iframe" 
                sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            ></iframe>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    setTimeout(() => {
        const iframe = document.getElementById('fullscreen-app-iframe');
        if (iframe) {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write(apps[versionIndex]);
            iframeDoc.close();
        }
    }, 0);
}

function downloadAppVersion(messageId, versionIndex) {
    const apps = window.appsData[messageId];
    if (!apps || !apps[versionIndex]) {
        alert('App version not available');
        return;
    }
    
    const htmlContent = apps[versionIndex];
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app_v${versionIndex}.html`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function updateModeIndicator(mode) {
    const inputWrapper = document.querySelector('.input-wrapper');
    const modeLabels = {
        'normal': 'NORMAL',
        'deep': 'DEEP SEARCH',
        'lab': 'LAB MODE',
        'voice': 'VOICE'
    };

    if(isUserLoggedIn())
    { 
        inputWrapper.setAttribute('data-mode-label', modeLabels[mode] || 'NORMAL');
    }
    else
    {
         inputWrapper.setAttribute('data-mode-label',  'NORMAL');
    }
}


// Add this to your existing mode button click handlers
document.querySelectorAll('.mode-icon-btn[data-mode]').forEach(btn => {
    btn.addEventListener('click', function() {
        const mode = this.getAttribute('data-mode');
        
        // Remove active class from all
        document.querySelectorAll('.mode-icon-btn[data-mode]').forEach(b => 
            b.classList.remove('active')
        );
        
        // Add active to clicked
        this.classList.add('active');
        
        // Update indicator
        updateModeIndicator(mode);
    });
});

// Initialize on page load
updateModeIndicator('normal');

// Conversations Panel Functions
function openConversationsPanel() {
    document.getElementById('conversations-selection-panel').classList.add('active');
    document.getElementById('conversations-panel-backdrop').classList.add('active');
    
    // Render conversations in the panel
    renderConversationsInPanel();
}

function closeConversationsPanel() {
 
    document.getElementById('conversations-selection-panel').classList.remove('active');
    document.getElementById('conversations-panel-backdrop').classList.remove('active');

      const panel = document.getElementById('conversations-selection-panel');
    const backdrop = document.getElementById('conversations-panel-backdrop');
    
    if (panel && backdrop) {
        panel.classList.remove('active');
        backdrop.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }
}

document.getElementById('panel-toggle-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('conversations-selection-panel');
    const backdrop = document.getElementById('conversations-panel-backdrop');
    
    if (panel && backdrop) {
        panel.classList.add('active');
        backdrop.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll
    }
});

function renderConversationsInPanel() {
  

    const groups = groupConversationsByDate(window.allConversations || []);
    const container = document.getElementById('panel-conversations-list');
    const filterSelect = document.getElementById('panel-conversation-filter');
    const selectedFilter = filterSelect ? filterSelect.value : 'all';
    
    container.innerHTML = '';
    
    if (selectedFilter === 'all') {
        // Show all, grouped by date with headers
        Object.entries(groups).forEach(([key, group]) => {
            if (group.conversations.length === 0) return;
            
            // Add date header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'date-header-simple';
            headerDiv.innerHTML = `
                <span>${group.label}</span>
                <span class="date-count">${group.conversations.length}</span>
            `;
            // container.appendChild(headerDiv);
            
            // Add conversations
            group.conversations.forEach(conv => {
                const div = createPanelConversationItem(conv);
                container.appendChild(div);
            });
        });
    } else {
        // Show only selected time period
        const selectedGroup = groups[selectedFilter];
        if (selectedGroup && selectedGroup.conversations.length > 0) {
            selectedGroup.conversations.forEach(conv => {
                const div = createPanelConversationItem(conv);
                container.appendChild(div);
            });
        } else {
            container.innerHTML = '<div style="padding: 20px; text-align: center; color: #666; font-size: 11px;">No conversations in this period</div>';
        }
    }
}

function createPanelConversationItem(conv) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    
    if (conv.id === currentConversationId) {
        div.classList.add('active');
    }
    
    div.dataset.id = conv.id;
    
    div.innerHTML = `
        <span class="conversation-title">${escapeHtml(conv.title).substring(0,35) + "..."}</span>
        <button class="delete-btn" onclick="deleteConversationFromPanel('${conv.id}', event)">×</button>
    `;
    
    div.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-btn')) {
            selectConversation(conv.id);
            closeConversationsPanel();
        }
    });
    
    return div;
}

// async function deleteConversationFromPanel(conversationId, event) { 
    
//     event.stopPropagation();
 
//     try {
//         const token = localStorage.getItem('access_token');
//         if (!token) {
//             alert('Please login to delete conversations');
//             return;
//         } 
 
//         const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
//             method: 'DELETE',
//             headers: {
//                 'Authorization': `Bearer ${token}`
//             }
//         });
        
//         if (response.ok) {
//             if (currentConversationId === conversationId) {
//                 currentConversationId = null;
//                 const container = getActiveMessagesContainer();
//                 if (container) {
//                     container.innerHTML = '';
//                 }
//                 toggleEmptyChat();
//             }
            
//             await loadConversations();
//             renderConversationsInPanel();
//         } else {
//             alert('Failed to delete conversation');
//         }
//     } catch (error) {
//         console.error('Error deleting conversation:', error);
//         alert('Error deleting conversation');
//     }
// }

// Event Listeners

async function deleteConversationFromPanel(conversationId, event) { 
    event.stopPropagation();
 
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            alert('Please login to delete conversations');
            return;
        } 
 
        const response = await fetch(`${API_URL}/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                
                // **FIX: Close split screen if active**
                if (isSplitScreenActive) {
                    closeSplitScreen();
                }
                
                const container = getActiveMessagesContainer();
                if (container) {
                    container.innerHTML = '';
                }
                toggleEmptyChat();
            }
            
            await loadConversations();
            renderConversationsInPanel();
        } else {
            alert('Failed to delete conversation');
        }
    } catch (error) {
        console.error('Error deleting conversation:', error);
        alert('Error deleting conversation');
    }
}

document.getElementById('conversations-toggle-btn')?.addEventListener('click', openConversationsPanel);
document.getElementById('conversations-panel-close-btn')?.addEventListener('click', closeConversationsPanel);
document.getElementById('conversations-panel-backdrop')?.addEventListener('click', closeConversationsPanel);

// Filter change handler for panel
document.getElementById('panel-conversation-filter')?.addEventListener('change', () => {
    renderConversationsInPanel();
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeConversationsPanel();
    }
});

// Premium Popup Functions
function openPremiumPopup() {
    document.getElementById('premium-popup-modal').classList.add('active');
    document.getElementById('premium-popup-backdrop').classList.add('active');
}

function closePremiumPopup() {
    document.getElementById('premium-popup-modal').classList.remove('active');
    document.getElementById('premium-popup-backdrop').classList.remove('active');
}

// Event Listeners for Premium Popup
document.getElementById('premium-icon-btn')?.addEventListener('click', openPremiumPopup);
document.getElementById('premium-popup-close-btn')?.addEventListener('click', closePremiumPopup);
document.getElementById('premium-popup-backdrop')?.addEventListener('click', closePremiumPopup);

// Replace the old premium button handler
document.getElementById('premium-upgrade-btn')?.addEventListener('click', () => {
    alert('Premium upgrade coming soon!');
    closePremiumPopup();
});

// Close popup on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closePremiumPopup();
    }
});
 

// ===================================
// MAGIC LINK AUTHENTICATION
// ===================================

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    initMagicLinkAuth();
});

function initMagicLinkAuth() {
    console.log('🔐 Initializing magic link authentication...');
    
    // Magic Link Form Handler
    const magicLinkForm = document.getElementById('magic-link-form');
    if (magicLinkForm) {
        console.log('✅ Magic link form found');
 
        magicLinkForm.addEventListener('submit', handleMagicLinkSubmit);
    } else {
        console.warn('⚠️ Magic link form not found');
    }
    
    // Resend Magic Link Button
    const resendBtn = document.getElementById('resend-magic-link');
    if (resendBtn) {
        console.log('✅ Resend button found');
        resendBtn.addEventListener('click', handleResendMagicLink);
    }
    
    // Change Email Button
    const changeEmailBtn = document.getElementById('change-email-btn');
    if (changeEmailBtn) {
        console.log('✅ Change email button found');
        changeEmailBtn.addEventListener('click', handleChangeEmail);
    }
}

// ===================================
// MAGIC LINK FORM SUBMIT
// ===================================
async function handleMagicLinkSubmit(e) {
 
    e.preventDefault();
    hideAuthMessages();
   
    const emailInput = document.getElementById('magic-email');
    const submitBtn = document.getElementById('magic-submit-btn');
    const btnText = document.getElementById('magic-btn-text');
    const btnLoading = document.getElementById('magic-btn-loading');
    
    if (!emailInput || !submitBtn || !btnText || !btnLoading) {
        console.error('❌ Missing form elements');
        showAuthError('Form error. Please refresh the page.');
        return;
    }
    
    const email = emailInput.value.trim();
    
    if (!email) {
        showAuthError('Please enter your email');
        return;
    }
    
    // Disable button and show loading
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    
    console.log('📧 Requesting magic link for:', email);
    
    try {
        const response = await fetch(`${API_URL}/magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Magic link sent successfully');
            
            // Hide form, show verification state
            const magicForm = document.getElementById('magic-link-form');
            const verificationState = document.getElementById('magic-verification-state');
            const sentEmailEl = document.getElementById('sent-email');
            
            if(sentEmailEl) sentEmailEl.classList.add('sent-email')
            if (magicForm) magicForm.classList.add('hidden');
            if (verificationState) verificationState.classList.remove('hidden');
            if (sentEmailEl) sentEmailEl.textContent = email;
            
            // Store email for resend functionality
            localStorage.setItem('magic_link_email', email);
            
            // showAuthSuccess('Magic link sent! Check your email.');
        } else {
            console.error('❌ Magic link request failed:', data);
            showAuthError(data.detail || 'Failed to send magic link');
        }
    } catch (error) {
        console.error('❌ Magic link error:', error);
        showAuthError('Connection error. Please check your internet and try again.');
    } finally {
        // Re-enable button
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
}

// ===================================
// RESEND MAGIC LINK
// ===================================
async function handleResendMagicLink() {
    const email = localStorage.getItem('magic_link_email');
    
    if (!email) {
        showAuthError('Email not found. Please start over.');
        return;
    }
    
    hideAuthMessages();
    
    const resendBtn = document.getElementById('resend-magic-link');
    if (!resendBtn) return;
    
    const originalText = resendBtn.textContent;
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';
    
    console.log('📧 Resending magic link to:', email);
    
    try {
        const response = await fetch(`${API_URL}/magic-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        if (response.ok) {
            console.log('✅ Magic link resent successfully');
            // showAuthSuccess('New magic link sent! Check your email.');
        } else {
            const data = await response.json();
            console.error('❌ Resend failed:', data);
            showAuthError(data.detail || 'Failed to resend link');
        }
    } catch (error) {
        console.error('❌ Resend error:', error);
        showAuthError('Connection error');
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = originalText;
    }
}

// ===================================
// CHANGE EMAIL
// ===================================
function handleChangeEmail() {
    console.log('🔄 Changing email...');
    
    const verificationState = document.getElementById('magic-verification-state');
    const magicForm = document.getElementById('magic-link-form');
    const emailInput = document.getElementById('magic-email');
    
    if (verificationState) verificationState.classList.add('hidden');
    if (magicForm) magicForm.classList.remove('hidden');
    
    if (emailInput) {
        emailInput.value = '';
        emailInput.focus();
    }
    
    hideAuthMessages();
}

// ===================================
// VERIFY MAGIC LINK TOKEN
// ===================================
async function verifyMagicLinkToken(token) {
    console.log('🔐 Verifying magic link token...');
    
    try {
        // Show verifying state
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = `
                <div class="verifying-container">
                    <div class="verifying-spinner"></div>
                    <div class="verifying-text">Verifying your login...</div>
                    <div class="verifying-subtext">Please wait a moment</div>
                </div>
            `;
        }
         
        // Call backend to verify token
        const response = await fetch(`${API_URL}/verify?token=${token}`);
        const data = await response.json();
        
        if (response.ok) {
            console.log('✅ Magic link verified successfully!');
            console.log('User data:', data);
            
            // Store authentication data
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('user_id', data.user_id);
            localStorage.setItem('username', data.username);
            localStorage.setItem('email', data.email);
            
            // Set current user
            currentUser = {
                user_id: data.user_id,
                email: data.email,
                token: data.access_token
            };
            
            console.log('✅ User logged in:', currentUser);
            
            // Clean up URL (remove token from address bar)
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Show logged in state
            showLoggedInState(data.email);
            
            // Load user's conversations
            await loadConversations();
            
            // Clear messages container
            if (container) {
                container.innerHTML = '';
            }
            toggleEmptyChat();
            
            // Show success message
            showAuthSuccess('Successfully logged in! Welcome back.');
            setTimeout(() => hideAuthMessages(), 3000);
            
        } else {
            console.error('❌ Magic link verification failed:', data);
            
            // Show error state
            if (container) {
                container.innerHTML = `
                    <div class="verifying-container">
                        <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                        <div class="verifying-text" style="color: #ff4444;">Login Failed</div>
                        <div class="verifying-subtext">${data.detail || 'Invalid or expired link'}</div>
                        <button onclick="location.reload()" style="
                            margin-top: 20px;
                            padding: 12px 24px;
                            background: rgba(255, 68, 68, 0.2);
                            border: 1px solid rgba(255, 68, 68, 0.4);
                            color: #ff4444;
                            border-radius: 6px;
                            cursor: pointer;
                            font-family: 'Roboto Mono', monospace;
                            font-size: 13px;
                        ">Try Again</button>
                    </div>
                `;
            }
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            showAuthError(data.detail || 'Verification failed. Please request a new link.');
        }
    } catch (error) {
        console.error('❌ Verification error:', error);
        
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = `
                <div class="verifying-container">
                    <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                    <div class="verifying-text" style="color: #ff9900;">Connection Error</div>
                    <div class="verifying-subtext">Failed to verify login link</div>
                    <button onclick="location.reload()" style="
                        margin-top: 20px;
                        padding: 12px 24px;
                        background: rgba(255, 153, 0, 0.2);
                        border: 1px solid rgba(255, 153, 0, 0.4);
                        color: #ff9900;
                        border-radius: 6px;
                        cursor: pointer;
                        font-family: 'Roboto Mono', monospace;
                        font-size: 13px;
                    ">Try Again</button>
                </div>
            `;
        }
        
        showAuthError('Connection error during verification. Please try again.');
    }
}

// ===================================
// PAGE LOAD - CHECK FOR TOKENS
// ===================================
window.addEventListener('load', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    
    // ===================================
    // 1. CHECK FOR MAGIC LINK TOKEN
    // ===================================
    const magicToken = urlParams.get('token');
    if (magicToken) {
        console.log('🔐 Magic link token detected in URL');
        // await verifyMagicLinkToken(magicToken);
        return; // Exit early, don't check other auth methods
    }
    
    // ===================================
    // 2. CHECK FOR OAUTH CALLBACK
    // ===================================
    const error = urlParams.get('error');
    if (error) {
        console.error('❌ OAuth error:', error);
        showAuthError('Google sign-in failed: ' + error);
        window.history.replaceState({}, document.title, window.location.pathname);
        showLoggedOutState();
        return;
    }
    
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthToken = urlParams.get('token');
    const userId = urlParams.get('user_id');
    const username = urlParams.get('username');
    const email = urlParams.get('email');

    if (oauthSuccess === 'true' && oauthToken && userId) {
        console.log('✅ OAuth success detected');
        
        localStorage.setItem('access_token', oauthToken);
        localStorage.setItem('user_id', userId);
        localStorage.setItem('username', username);
        localStorage.setItem('email', email);
        
        currentUser = {
            user_id: userId,
            email: email,
            token: oauthToken
        };
        
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
        showLoggedInState(email);
        await loadConversations();
        toggleEmptyChat();
        
        showAuthSuccess('Welcome! Signed in with Google');
        setTimeout(() => hideAuthMessages(), 2000);
        
        return;
    }
    
    // ===================================
    // 3. CHECK FOR EXISTING SESSION
    // ===================================
    const existingToken = localStorage.getItem('access_token');
    const existingUserId = localStorage.getItem('user_id');
    const existingUsername = localStorage.getItem('username');
    const existingUsermail = localStorage.getItem('email');

    if (existingToken && existingUserId) {
        console.log('📋 Restoring existing session...');
        
        currentUser = {
            user_id: existingUserId,
            email: localStorage.getItem('email') || '',
            token: existingToken
        };
        
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
        showLoggedInState(existingUsermail);
        await loadConversations();
        toggleEmptyChat();
    } else {
        console.log('👤 No active session, showing logged out state');
        showLoggedOutState();
        const container = getActiveMessagesContainer();
        if (container) {
            container.innerHTML = '';
        }
        toggleEmptyChat();
    }
    
    hideAuthMessages();
});



// Login Panel Controls - with debugging
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing login panel...');
    
    const loginIconBtn = document.getElementById('login-icon-btn');
    const loginPanel = document.getElementById('login-panel');
    const loginPanelBackdrop = document.getElementById('login-panel-backdrop');
    const loginPanelCloseBtn = document.getElementById('login-panel-close-btn');
    
    // Debug: Check if elements exist
    console.log('Login Icon Button:', loginIconBtn);
    console.log('Login Panel:', loginPanel);
    console.log('Login Backdrop:', loginPanelBackdrop);
    
    // Show login panel
    if (loginIconBtn) {
        loginIconBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Login icon clicked!');
            clearUseCasesOnLogin()
            if (loginPanel && loginPanelBackdrop) {
                loginPanel.classList.add('active');
                loginPanelBackdrop.classList.add('active');
                console.log('Panel should be visible now');
            } else {
                console.error('Panel elements not found!');
            }
        });
    } else {
        console.error('Login icon button not found!');
    }
    
    // Hide login panel
    function hideLoginPanel() {
        console.log('Hiding login panel');
        if (loginPanel) loginPanel.classList.remove('active');
        if (loginPanelBackdrop) loginPanelBackdrop.classList.remove('active');
    }
    
    if (loginPanelCloseBtn) {
        loginPanelCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            hideLoginPanel();
        });
    }
    
    if (loginPanelBackdrop) {
        loginPanelBackdrop.addEventListener('click', function(e) {
            if (e.target === loginPanelBackdrop) {
                hideLoginPanel();
            }
        });
    }
    
    // Close panel on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && loginPanel && loginPanel.classList.contains('active')) {
            hideLoginPanel();
        }
    });
    
    // Hide login icon when user is logged in
    function updateLoginIconVisibility() {
       
        const authLoggedIn = document.getElementById('auth-logged-in');
    
        const authLoggedOutContainer = document.getElementById('auth-logged-out-container');
        const isLoggedIn = authLoggedIn && !authLoggedIn.classList.contains('hidden');
        
        let username = document.getElementById('display-username').innerText
        
        if( username !== undefined && len(username) !== 0)
        {
            let loginIcon = document.getElementById('login-icon-btn')
        
            if(loginIcon)
            {
                loginIcon.style.display = "none"
            }
        }

        if(isLoggedIn)
        {
             const loginIcon = document.getElementById('login-icon-btn');            
        }
        console.log('Updating login icon visibility. Logged in:', isLoggedIn);
        
        if (authLoggedOutContainer) {
            if (isLoggedIn) {
                authLoggedOutContainer.style.display = 'none';
            } else {
                authLoggedOutContainer.style.display = 'block';
            }
        }
    }
    
    // Call on load
    updateLoginIconVisibility();
});
const messageInput = document.getElementById('message-input');
 
messageInput.addEventListener('input', function() {
 
    // Reset height to recalculate
    this.style.height = '60px'; // Changed from 24px
    this.style.overflowY = 'hidden';
    
    // Set new height based on content, capped at max-height
    const newHeight = Math.min(this.scrollHeight, 150);
    this.style.height = newHeight + 'px';
    
    // Show scrollbar if max height reached
    if (this.scrollHeight > 150) {
 
        this.style.overflowY = 'auto';
    }
});

// Also handle on page load if there's initial content
window.addEventListener('load', function() {
    messageInput.dispatchEvent(new Event('input'));
});
 
// Cloud Wizard Panel - Slides from Left
(function() {
    const cloudBtn = document.getElementById('cloud-button');
    const wizardPanel = document.getElementById('cloud-wizard-panel');
    const wizardBackdrop = document.getElementById('cloud-wizard-backdrop');
    const wizardCloseBtn = document.getElementById('cloud-wizard-close-btn');
    const wizardIframe = document.getElementById('wizard-iframe');

    // Open wizard panel (slide from left)
    function openWizard() {  

        console.log('Opening Cloud Wizard...');
        
        // Load wizard.html into iframe
        wizardIframe.src = 'wizard.html';
        
        // Show panel and backdrop
        wizardPanel.classList.add('active');
        wizardBackdrop.classList.add('active');
        wizardCloseBtn.style.display = "inline"
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    // Close wizard panel
    function closeWizard() {
        console.log('Closing Cloud Wizard...');
        
        // Hide panel and backdrop
        wizardPanel.classList.remove('active');
        wizardBackdrop.classList.remove('active');
        
        wizardCloseBtn.style.display = "none"
        // Clear iframe src (stop any running scripts)
        setTimeout(() => {
            wizardIframe.src = '';
        }, 400); // Wait for slide-out animation to complete
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Event Listeners
    if (cloudBtn) {
        cloudBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Cloud button clicked');
            openWizard();
        });
    }

    if (wizardCloseBtn) {
        wizardCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeWizard();
        });
    }

    if (wizardBackdrop) {
        wizardBackdrop.addEventListener('click', function(e) {
            e.preventDefault();
            closeWizard();
        });
    }

    // Close on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && wizardPanel.classList.contains('active')) {
            closeWizard();
        }
    });

    // Debug: Log when script loads
    console.log('Cloud Wizard script loaded');
})(); 


(function() {
    const newsBtn = document.getElementById('news-btn');
    const newsPanel = document.getElementById('news-selection-panel');
    const newsBackdrop = document.getElementById('news-panel-backdrop');
    const newsOverlay = document.getElementById('news-overlay');
    const newsCloseBtn = document.getElementById('news-overlay-close');
    const newsPanelCloseBtn = document.getElementById('news-panel-close-btn');

    function openNews() {
        console.log('Opening News Panel...');
        
        // CRITICAL: Close cloud wizard if open
        const wizardPanel = document.getElementById('cloud-wizard-panel');
        const wizardBackdrop = document.getElementById('cloud-wizard-backdrop');
        if (wizardPanel && wizardPanel.classList.contains('active')) {
            wizardPanel.classList.remove('active');
            wizardBackdrop.classList.remove('active');
            // Clear wizard iframe
            const wizardIframe = document.getElementById('wizard-iframe');
            if (wizardIframe) {
                wizardIframe.src = '';
            }
        }
        
        // CRITICAL: Hide cloud wizard backdrop completely
        if (wizardBackdrop) {
            wizardBackdrop.style.display = 'none';
        }
        
        // Show news panel
        if (newsPanel) {
            newsPanel.classList.add('active');
        }
        if (newsBackdrop) {
            newsBackdrop.classList.add('active');
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    function closeNews() {
        console.log('Closing News Panel...');
        
        // Hide news panel
        if (newsPanel) {
            newsPanel.classList.remove('active');
        }
        if (newsBackdrop) {
            newsBackdrop.classList.remove('active');
        }
        if (newsOverlay) {
            newsOverlay.classList.remove('active');
        }
        
        // Restore cloud wizard backdrop (if it exists)
        const wizardBackdrop = document.getElementById('cloud-wizard-backdrop');
        if (wizardBackdrop) {
            wizardBackdrop.style.display = '';
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Event Listeners
    if (newsBtn) {
        newsBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openNews();
        });
    }

    if (newsPanelCloseBtn) {
        newsPanelCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeNews();
        });
    }

    if (newsCloseBtn) {
        newsCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeNews();
        });
    }

    if (newsBackdrop) {
        newsBackdrop.addEventListener('click', function(e) {
            e.preventDefault();
            closeNews();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (newsOverlay && newsOverlay.classList.contains('active')) {
                closeNews();
            } else if (newsPanel && newsPanel.classList.contains('active')) {
                closeNews();
            }
        }
    });

    console.log('News Panel script loaded');
})();

 
// Cloud Wizard Panel - SAME FOLDER
(function() {
    const cloudBtn = document.getElementById('cloud-button');
    const wizardPanel = document.getElementById('cloud-wizard-panel');
    const wizardBackdrop = document.getElementById('cloud-wizard-backdrop');
    const wizardCloseBtn = document.getElementById('cloud-wizard-close-btn');
    const wizardIframe = document.getElementById('wizard-iframe');
    const convsPanel = document.querySelector('.conversations-panel');

    function openWizard() {
        console.log('Opening Cloud Wizard...');
        
        // Close news panel if open
        const newsPanel = document.getElementById('news-selection-panel');
        const newsBackdrop = document.getElementById('news-panel-backdrop');
        const newsOverlay = document.getElementById('news-overlay');
        
        if (newsPanel && newsPanel.classList.contains('active')) {
            newsPanel.classList.remove('active');
        }
        if (newsBackdrop && newsBackdrop.classList.contains('active')) {
            newsBackdrop.classList.remove('active');
        }
        if (newsOverlay && newsOverlay.classList.contains('active')) {
            newsOverlay.classList.remove('active');
        }
        
        // wizard.html is in same folder as index.html
        wizardIframe.src = 'wizard.html';
        
        console.log('Loading wizard from:', wizardIframe.src);
        
        // Show wizard
        wizardPanel.classList.add('active');
        wizardBackdrop.classList.add('active');
        wizardBackdrop.style.display = '';
        
        // Boost conversations panel z-index
        if (convsPanel) {
            convsPanel.style.zIndex = '10002';
        }
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    function closeWizard() {
        console.log('Closing Cloud Wizard...');
        
        // Hide wizard
        wizardPanel.classList.remove('active');
        wizardBackdrop.classList.remove('active');
        
        // Reset conversations panel z-index
        if (convsPanel) {
            convsPanel.style.zIndex = '';
        }
        
        // Clear iframe
        setTimeout(() => {
            wizardIframe.src = '';
        }, 400);
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // Event Listeners
    if (cloudBtn) {
        cloudBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openWizard();
        });
    }

    if (wizardCloseBtn) {
        wizardCloseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeWizard();
        });
    }

    if (wizardBackdrop) {
        wizardBackdrop.addEventListener('click', function(e) {
            e.preventDefault();
            closeWizard();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && wizardPanel.classList.contains('active')) {
            closeWizard();
        }
    });

    console.log('Cloud Wizard script loaded');
})(); 


// ============================================
// USE CASES FUNCTIONALITY
// Add this to your main JavaScript file (app.js or script.js)
// 
// NOTE: Use Cases are PUBLIC and available to ALL users
// No authentication required!
// ============================================

let currentUseCaseCategory = 'all';
let allUseCases = [];

// ============================================
// FETCH CATEGORIES
// ============================================

async function fetchUseCaseCategories() {
    try {
        const response = await fetch(`${API_URL}/use_cases/categories/list`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch categories: ${response.status}`);
        }
        
        const data = await response.json();
        
        console.log('📂 Loaded categories:', data.categories);
        
        renderUseCaseCategories(data.categories);
        
    } catch (error) {
        console.error('❌ Error fetching use case categories:', error);
        
        const container = document.getElementById('use-cases-categories');
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #ff4444;">
                    <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                    <div style="font-size: 14px; margin-bottom: 8px;">Failed to load categories</div>
                    <div style="font-size: 12px; opacity: 0.7;">${error.message}</div>
                    <button onclick="fetchUseCaseCategories()" style="
                        margin-top: 16px;
                        padding: 8px 16px;
                        background: rgba(255, 68, 68, 0.2);
                        border: 1px solid rgba(255, 68, 68, 0.3);
                        color: #ff4444;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 12px;
                    ">Retry</button>
                </div>
            `;
        }
    }
}

// ============================================
// RENDER CATEGORIES
// ============================================

function renderUseCaseCategories(categories) {
    const container = document.getElementById('use-cases-categories');
    
    if (!container || !categories || categories.length === 0) {
        if (container) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <div style="font-size: 14px;">No categories available</div>
                </div>
            `;
        }
        return;
    }
    
    container.innerHTML = '';
    
    categories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'use-case-category-card';
        card.onclick = () => openUseCaseCategory(category.key, category.name, category.icon);
        
        card.innerHTML = `
            <div class="use-case-category-icon">${category.icon}</div>
            <div class="use-case-category-name">${category.name}</div>
            <div class="use-case-category-count">${category.count} example${category.count !== 1 ? 's' : ''}</div>
        `;
        
        container.appendChild(card);
    });
}

// ============================================
// OPEN CATEGORY (FETCH USE CASES)
// ============================================

async function openUseCaseCategory(categoryKey, categoryName, categoryIcon) {
    console.log(`📂 Opening category: ${categoryKey}`);
    
    currentUseCaseCategory = categoryKey;
    
    // Update overlay header
    document.getElementById('use-cases-category-icon').textContent = categoryIcon;
    document.getElementById('use-cases-category-name').textContent = categoryName;
    
    // Show overlay
    document.getElementById('use-cases-overlay').classList.add('active');
    
    // Fetch and render use cases
    await fetchUseCases(categoryKey);
}

// ============================================
// FETCH USE CASES
// ============================================

async function fetchUseCases(category = 'all') {
    const contentEl = document.getElementById('use-cases-content');
    
    try {
        contentEl.innerHTML = '<div class="use-cases-loading">Loading examples...</div>';
        
        let url = `${API_URL}/use_cases`;
        
        // Add category filter if not "all"
        if (category !== 'all') {
            url += `?category=${category}`;
        }
        
        console.log(`📡 Fetching: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // DEBUG: Log the full response
        console.log('📦 Full API Response:', data);
        console.log('📊 Response structure:', {
            hasStatus: 'status' in data,
            statusValue: data.status,
            hasUseCases: 'use_cases' in data,
            useCasesType: Array.isArray(data.use_cases) ? 'array' : typeof data.use_cases,
            useCasesLength: data.use_cases ? data.use_cases.length : 0
        });
        
        if (data.status === 'success' && data.use_cases && data.use_cases.length > 0) {
            console.log(`✅ Received ${data.use_cases.length} use cases`);
            allUseCases = data.use_cases;
            renderUseCases(data.use_cases);
        } else {
            console.warn('⚠️  No use cases in response or invalid structure');
            console.log('   Checking for alternative structures...');
            
            // Maybe the response is just an array?
            if (Array.isArray(data) && data.length > 0) {
                console.log('✅ Found array directly in response');
                allUseCases = data;
                renderUseCases(data);
                return;
            }
            
            throw new Error('No use cases received from server');
        }
        
    } catch (error) {
        console.error('❌ Error fetching use cases:', error);
        
        contentEl.innerHTML = `
            <div class="use-cases-empty">
                <div class="use-cases-empty-icon">📭</div>
                <div class="use-cases-empty-text">No Examples Available</div>
                <div class="use-cases-empty-subtext">
                    ${category === 'all' ? 'No use cases have been added yet' : 'No examples in this category yet'}
                </div>
            </div>
        `;
    }
}

// ============================================
// RENDER USE CASES
// ============================================

function renderUseCases(useCases) {
    const contentEl = document.getElementById('use-cases-content');
    
    if (!useCases || useCases.length === 0) {
        contentEl.innerHTML = `
            <div class="use-cases-empty">
                <div class="use-cases-empty-icon">📭</div>
                <div class="use-cases-empty-text">No Examples Found</div>
                <div class="use-cases-empty-subtext">Check back later for new examples</div>
            </div>
        `;
        return;
    }
    
    const grid = document.createElement('div');
    grid.className = 'use-cases-grid';
    
    useCases.forEach(useCase => {
        const card = createUseCaseCard(useCase);
        grid.appendChild(card);
    });
    
    contentEl.innerHTML = '';
    contentEl.appendChild(grid);
}

// ============================================
// CREATE USE CASE CARD
// ============================================

function createUseCaseCard(useCase) {
    const card = document.createElement('div');
    card.className = 'use-case-card';
    card.onclick = () => openUseCaseDetail(useCase.id);
    
    // Get category info
    const categoryInfo = USE_CASE_CATEGORIES[useCase.category] || { icon: '📁', name: useCase.category };
    
    // Parse tags if it's a JSON string
    let tags = useCase.tags;
    if (typeof tags === 'string') {
        try {
            tags = JSON.parse(tags);
        } catch (e) {
            console.warn('Failed to parse tags:', e);
            tags = [];
        }
    }
    if (!Array.isArray(tags)) {
        tags = [];
    }
    
    // Format tags
    const tagsHTML = tags && tags.length > 0
        ? `<div class="use-case-card-tags">
            ${tags.slice(0, 3).map(tag => 
                `<span class="use-case-tag">${escapeHtml(tag)}</span>`
            ).join('')}
           </div>`
        : '';
    
    // Featured badge
    const featuredBadge = useCase.featured
        ? '<span class="use-case-featured-badge">⭐ Featured</span>'
        : '';
    
    card.innerHTML = `
        <div class="use-case-card-header">
            <span class="use-case-card-icon">${categoryInfo.icon}</span>
            ${featuredBadge}
        </div>
        <div class="use-case-card-title">${escapeHtml(useCase.title)}</div>
        <div class="use-case-card-description">${escapeHtml(useCase.description)}</div>
        ${tagsHTML}
        <div class="use-case-card-footer">
            <div class="use-case-stats">
                <div class="use-case-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    ${useCase.view_count || 0}
                </div>
                <div class="use-case-stat">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    ${useCase.message_count || 0}
                </div>
            </div>
            <span class="use-case-difficulty ${useCase.difficulty_level}">
                ${useCase.difficulty_level || 'beginner'}
            </span>
        </div>
    `;
    
    return card;
}

// ============================================
// OPEN USE CASE DETAIL (SHOW CONVERSATION)
// ============================================

async function openUseCaseDetail(useCaseId) {
    console.log(`📖 Opening use case: ${useCaseId}`);
    
    try {
        // Increment view count
        await fetch(`${API_URL}/use_cases/${useCaseId}/increment-views`, {
            method: 'POST'
        });
        
        // Fetch use case with messages
        const response = await fetch(`${API_URL}/use_cases/${useCaseId}/messages`);
        
        if (!response.ok) {
            throw new Error('Failed to load use case');
        }
        
        const data = await response.json();
        
        console.log('✅ Loaded use case:', data.use_case.title);
        console.log('✅ Messages:', data.messages.length);
        
        // Close use cases panel
        closeUseCasesPanel();
        
        // Display in chat area
        displayUseCaseInChat(data.use_case, data.messages);
        
    } catch (error) {
        console.error('❌ Error opening use case:', error);
        alert('Failed to load use case. Please try again.');
    }
}

// ============================================
// DISPLAY USE CASE IN CHAT
// ============================================

function displayUseCaseInChat(useCase, messages) {
    // Clear current conversation
    currentConversationId = null;
    
    const container = getActiveMessagesContainer();
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Add use case header
    const header = document.createElement('div');
    header.className = 'use-case-header';
    // header.style.cssText = `
    //     background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    //     border: 1px solid rgba(102, 126, 234, 0.2);
    //     border-radius: 12px;
    //     padding: 20px;
    //     margin-bottom: 20px;
    // `;
    
        header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="font-size: 24px;">💡</span>
            <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Use Case Example</span>
        </div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; margin:15px">${escapeHtml(useCase.title)}</div>
        <div style="font-size: 15px; line-height: 1.6;; margin:15px">${escapeHtml(useCase.description)}</div>
    `;
    
    container.appendChild(header);
    
    // Render messages
    messages.forEach(msg => {
        // Parse JSON fields
        let sources = null;
        let reasoningSteps = null;
        let assets = null;
        let app = null;
        
        if (msg.sources) {
            try {
                sources = typeof msg.sources === 'string' ? JSON.parse(msg.sources) : msg.sources;
            } catch (e) { console.error('Failed to parse sources:', e); }
        }
        
        if (msg.reasoning_steps) {
            try {
                reasoningSteps = typeof msg.reasoning_steps === 'string' ? JSON.parse(msg.reasoning_steps) : msg.reasoning_steps;
            } catch (e) { console.error('Failed to parse reasoning_steps:', e); }
        }
        
        if (msg.assets) {
            try {
                assets = typeof msg.assets === 'string' ? JSON.parse(msg.assets) : msg.assets;
            } catch (e) { console.error('Failed to parse assets:', e); }
        }
        
        if (msg.app) {
            app = msg.app;
        }
        
        // Use existing appendMessage function
        appendMessage(msg.role, msg.content, false, sources, reasoningSteps, msg.id, assets, app);
    });
    
    // Scroll to top
    if (container) {
        container.scrollTop = 0;
    }
}

// ============================================
// PANEL CONTROLS
// ============================================

function openUseCasesPanel() {
    toggleConversationsPanel()
    console.log('📂 Opening Use Cases Panel...');
    
    // Show panel regardless of login status - use cases are public!
    document.getElementById('use-cases-selection-panel').classList.add('active');
    document.getElementById('use-cases-panel-backdrop').classList.add('active');
    
    // Load categories
    fetchUseCaseCategories();
}

function closeUseCasesPanel() {
    console.log('📂 Closing Use Cases Panel...');
    
    document.getElementById('use-cases-selection-panel').classList.remove('active');
    document.getElementById('use-cases-overlay').classList.remove('active');
    document.getElementById('use-cases-panel-backdrop').classList.remove('active');
}

function backToCategories() {
    document.getElementById('use-cases-overlay').classList.remove('active');
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Open panel
    document.getElementById('use-cases-btn')?.addEventListener('click', () => {
        openUseCasesPanel();
    });
    
    // Close buttons
    document.getElementById('use-cases-panel-close-btn')?.addEventListener('click', () => {
        closeUseCasesPanel();
    });
    
    document.getElementById('use-cases-overlay-close')?.addEventListener('click', () => {
        closeUseCasesPanel();
    });
    
    // Back button
    document.getElementById('use-cases-back-btn')?.addEventListener('click', () => {
        backToCategories();
    });
    
    // Backdrop click
    document.getElementById('use-cases-panel-backdrop')?.addEventListener('click', () => {
        closeUseCasesPanel();
    });
    
    // ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('use-cases-overlay');
            const panel = document.getElementById('use-cases-selection-panel');
            
            if (overlay && overlay.classList.contains('active')) {
                backToCategories();
            } else if (panel && panel.classList.contains('active')) {
                closeUseCasesPanel();
            }
        }
    });
});

// ============================================
// CATEGORY DATA (Same as backend)
// ============================================

const USE_CASE_CATEGORIES = {
    'writing': { icon: '✍️', name: 'Writing & Content' },
    'coding': { icon: '💻', name: 'Coding & Development' },
    'research': { icon: '🔬', name: 'Research & Analysis' },
    'data': { icon: '📊', name: 'Data & Charts' },
    'creative': { icon: '🎨', name: 'Creative Projects' },
    'business': { icon: '💼', name: 'Business & Finance' },
    'learning': { icon: '📚', name: 'Learning & Education' },
    'apps': { icon: '🚀', name: 'Interactive Apps' }
};

console.log('✅ Use Cases module loaded');

function clearUseCasesOnLogin() {
    console.log('🔐 Clearing use cases for login...');
    
    // Close panels
    document.getElementById('use-cases-selection-panel')?.classList.remove('active');
    document.getElementById('use-cases-overlay')?.classList.remove('active');
    document.getElementById('use-cases-panel-backdrop')?.classList.remove('active');
    
    // Smart clear: only clear if use case is displayed
    const messagesContainer = document.getElementById('messages');
    const useCaseHeader = messagesContainer?.querySelector('.use-case-header');
    
    if (useCaseHeader) {
        // Only clear if showing a use case
        messagesContainer.innerHTML = '';
        currentConversationId = null;
        console.log('✅ Use case cleared from chat');
    } else {
        console.log('ℹ️  No use case displayed, keeping current chat');
    }
    
    // Remove viewing state
    document.body.classList.remove('viewing-use-case');
    
    console.log('✅ Ready for login');
}

// ============================================
// PAYMENT FUNCTIONS
// ============================================

async function handleUpgrade(packageType) {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
        alert('Please login first');
        return;
    }

    try {
        // Create order
 
        const response = await fetch(`${API_URL}/payment/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ package: packageType })
        });

        if (!response.ok) {
            throw new Error('Failed to create order');
        }

        const orderData = await response.json();

        // Open Razorpay Checkout
        const options = {
            key: orderData.key_id,
            amount: orderData.amount,
            currency: orderData.currency,
            name: 'AI Chat Premium',
            description: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Package`,
            order_id: orderData.order_id,
            handler: async function (response) {
                await verifyPayment(response);
            },
            prefill: {
                email: orderData.email || ''
            },
            theme: {
                color: '#F6F5EF'
            }
        };

        const razorpay = new Razorpay(options);
        razorpay.open();

    } catch (error) {
        console.error('Error:', error);
        alert('Failed to initiate payment. Please try again.');
    }
}

async function verifyPayment(paymentResponse) {
    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch(`${API_URL}/payment/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                razorpay_order_id: paymentResponse.razorpay_order_id,
                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                razorpay_signature: paymentResponse.razorpay_signature
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Close popup
            closePremiumPopup();
            
            // Show success message
            alert(`Payment successful! ${result.credits_added} credits added to your account.`);
            
            // Refresh credits display
            await fetchUserCredits();
        } else {
            alert('Payment verification failed. Please contact support.');
        }

    } catch (error) {
        console.error('Error:', error);
        alert('Error verifying payment. Please contact support.');
    }
}

async function fetchUserCredits() {
    const token = localStorage.getItem('access_token');
    
    if (!token) return;

    try {
        const response = await fetch(`${API_URL}/user/credits`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Update credits display in your UI
            console.log('Current credits:', data.message_credits);
            // You can update a credits counter in your UI here
        }
    } catch (error) {
        console.error('Error fetching credits:', error);
    }
}
function showPaymentSuccess(creditsAdded, totalCredits) {
    const container = getActiveMessagesContainer();
    if (!container) return;
    
    const successBanner = document.createElement('div');
    successBanner.className = 'payment-success-banner';
    successBanner.style.cssText = `
        background: linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 255, 136, 0.05) 100%);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        margin: 20px;
        animation: slideIn 0.3s ease-out;
    `;
    successBanner.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 16px;">🎉</div>
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 12px; color: #00ff88;">
            Payment Successful!
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
            ${creditsAdded} messages have been added to your account.<br>
            You now have <strong>${totalCredits} total messages</strong> available.
        </div>
        <button onclick="this.closest('.payment-success-banner').remove()" style="
            margin-top: 16px;
            padding: 8px 16px;
            background: rgba(0, 255, 136, 0.2);
            border: 1px solid rgba(0, 255, 136, 0.3);
            color: #00ff88;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        ">Got it!</button>
    `;
    
    container.appendChild(successBanner);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
        if (successBanner.parentNode) {
            successBanner.remove();
        }
    }, 10000);
}

async function refreshUserCredits() {
    if (!currentUser || !currentUser.token) return;
    
    try {
        const response = await fetch(`${API_URL}/user/credits`, {
            headers: {
                'Authorization': `Bearer ${currentUser.token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('💎 User credits:', data.credits);
            
            // Update credits display in UI (if you have one)
            updateCreditsDisplay(data.credits);
        }
    } catch (error) {
        console.error('Failed to refresh credits:', error);
    }
}

function updateCreditsDisplay(credits) {
    // If you have a credits display in your UI, update it here
    // For example:
    const creditsEl = document.getElementById('user-credits-display');
    if (creditsEl) {
        creditsEl.textContent = `💎 ${credits} credits`;
    }
} 

// ===================================================
// MOBILE ICON BUTTONS - COMPLETE JAVASCRIPT
// ===================================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Close all panels function
    function closeAllPanels() {
         const panel = document.querySelector('.conversations-panel');
        if (panel) {
            const wasCollapsed = panel.classList.contains('collapsed');
            if(!wasCollapsed)
            {
                panel.classList.toggle('collapsed');
            }
        }
        document.querySelectorAll('.news-selection-panel, .news-overlay, .login-panel, .conversations-selection-panel, .use-cases-selection-panel, .use-cases-overlay, .cloud-wizard-panel, .premium-popup-modal, .control-panel').forEach(panel => {
            panel.classList.remove('active', 'mobile-active');
        });
        
        document.querySelectorAll('.news-panel-backdrop, .login-panel-backdrop, .conversations-panel-backdrop, .use-cases-panel-backdrop, .cloud-wizard-backdrop, .premium-popup-backdrop').forEach(backdrop => {
            backdrop.classList.remove('active');
        });
    }
    
    // Close on page load
    closeAllPanels();
    
    // Conversations Icon
    const conversationsBtn = document.querySelector('.conversations-icon-btn');
    if (conversationsBtn) {
        conversationsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.conversations-selection-panel')?.classList.add('active');
            document.querySelector('.conversations-panel-backdrop')?.classList.add('active');
        });
    }
 
    
    // New Chat Icon
    const newChatBtn = document.querySelector('.new-chat-icon-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            // Your new chat logic here
            console.log('New chat clicked');
        });
    }
    
    // News Icon
    const newsBtn = document.querySelector('.news-icon-btn');
    if (newsBtn) {
        newsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.news-selection-panel')?.classList.add('active');
            document.querySelector('.news-panel-backdrop')?.classList.add('active');
        });
    }
    
    // Login Icon
    const loginBtn = document.querySelector('.login-icon-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.login-panel')?.classList.add('active');
            document.querySelector('.login-panel-backdrop')?.classList.add('active');
        });
    }
    
    // Logout Icon
    const logoutBtn = document.querySelector('.logout-icon-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Your logout logic here
            console.log('Logout clicked');
        });
    }
    
    // Premium Icon
    const premiumBtn = document.querySelector('.premium-icon-btn');
    if (premiumBtn) {
        premiumBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.premium-popup-modal')?.classList.add('active');
            document.querySelector('.premium-popup-backdrop')?.classList.add('active');
        });
    }
    
    // Cloud Icon
    const cloudBtn = document.querySelector('.cloud-icon-btn');
    if (cloudBtn) {
        cloudBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.cloud-wizard-panel')?.classList.add('active');
            document.querySelector('.cloud-wizard-backdrop')?.classList.add('active');
        });
    }
    
    // Use Cases Icon
    const useCasesBtn = document.querySelector('.use-cases-icon-btn');
    if (useCasesBtn) {
        useCasesBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            closeAllPanels();
            document.querySelector('.use-cases-selection-panel')?.classList.add('active');
            document.querySelector('.use-cases-panel-backdrop')?.classList.add('active');
        });
    }
    
    // Close buttons
    document.querySelectorAll('[class*="close-btn"], [class*="-close"]').forEach(btn => {
        btn.addEventListener('click', function() {
            closeAllPanels();
        });
    });
    
    // Click backdrops to close
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('news-panel-backdrop') ||
            e.target.classList.contains('login-panel-backdrop') ||
            e.target.classList.contains('conversations-panel-backdrop') ||
            e.target.classList.contains('use-cases-panel-backdrop') ||
            e.target.classList.contains('cloud-wizard-backdrop') ||
            e.target.classList.contains('premium-popup-backdrop')) {
            closeAllPanels();
        }
    });
    
    // ESC key closes panels
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllPanels();
        }
    });
});
 

document.addEventListener('paste', function(e) {
    const textarea = document.querySelector('.input-container textarea');
    if (!textarea || e.target !== textarea) return;
    
    const pastedText = e.clipboardData.getData('text');
    
    // If text is longer than 1000 characters, convert to file
    if (pastedText.length > 1000) {
        e.preventDefault(); // Stop normal paste
        
        // Create a text file using File API
        const blob = new Blob([pastedText], { type: 'text/plain' });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const file = new File([blob], `pasted-text-${timestamp}.txt`, { 
            type: 'text/plain',
            lastModified: Date.now()
        });
        
        // Use existing file handling system
        handleFileSelection([file]);
        
        console.log('Large text converted to file:', pastedText.length, 'characters');
    }
});

// Force close conversations panel when any other icon is clicked
document.addEventListener('DOMContentLoaded', function() {
    // All icon buttons except conversations
    const otherIcons = document.querySelectorAll(`
        .news-icon-btn,
        .login-icon-btn,
        .use-cases-icon-btn,
        .premium-icon-btn,
        .cloud-icon-btn,
        .new-chat-icon-btn,
        .logout-icon-btn,
        closeSplitScreen,
        .conversations-icon-btn
    `);
    
    otherIcons.forEach(icon => {
        icon.addEventListener('click', function() {
            if (window.innerWidth <= 1024) {
                const panel = document.querySelector('.conversations-panel');
                if (panel) { 
                    const wasCollapsed = panel.classList.contains('collapsed');
                    
                    if(!wasCollapsed)
                        panel.classList.toggle('collapsed');
                }
            }
        });
    });
});

 