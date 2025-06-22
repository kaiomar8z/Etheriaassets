document.addEventListener('DOMContentLoaded', () => {

    // Firebase Configuration
    const firebaseConfig = {
        apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
        authDomain: "etheria-manager.firebaseapp.com",
        projectId: "etheria-manager",
        storageBucket: "etheria-manager.appspot.com",
        messagingSenderId: "247321381553",
        appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
    };

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Collection references
    const unitsCol = db.collection('units');
    const teamsCol = db.collection('teams');
    const manualObjectivesCol = db.collection('manualObjectives');
    const dailyRoutineDoc = db.collection('settings').doc('dailyRoutine');

    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = '<i class="fa-solid fa-sun"></i>';
    const moonIcon = '<i class="fa-solid fa-moon"></i>';

    const applyTheme = (theme) => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            themeToggleBtn.innerHTML = moonIcon;
        } else {
            document.body.classList.remove('light-theme');
            themeToggleBtn.innerHTML = sunIcon;
        }
    };

    const savedTheme = localStorage.getItem('etheriaTheme') || 'dark';
    applyTheme(savedTheme);

    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        const newTheme = isLight ? 'dark' : 'light';
        localStorage.setItem('etheriaTheme', newTheme);
        applyTheme(newTheme);
    });

    // #region --- MODULES UTILITAIRES (Notifications, Confirmations) ---
    const toastContainer = document.getElementById('toast-container');
    const showToast = (message, type = 'info', duration = 3500) => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, duration);
    };

    const confirmModal = document.getElementById('confirm-modal');
    const showConfirm = (title, message) => {
        return new Promise((resolve) => {
            const confirmTitle = document.getElementById('confirm-title');
            const confirmMessage = document.getElementById('confirm-message');
            const confirmOkBtn = document.getElementById('confirm-ok-btn');
            const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
            const confirmCloseBtn = document.getElementById('confirm-close-btn');

            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            confirmModal.style.display = 'block';

            const close = (value) => {
                confirmModal.style.display = 'none';
                confirmOkBtn.onclick = null;
                confirmCancelBtn.onclick = null;
                confirmCloseBtn.onclick = null;
                resolve(value);
            };

            confirmOkBtn.onclick = () => close(true);
            confirmCancelBtn.onclick = () => close(false);
            confirmCloseBtn.onclick = () => close(false);
        });
    };
    // #endregion

    // #region --- SÉLECTION DES ÉLÉMENTS DU DOM ---
    const imageBaseUrl = 'https://raw.githubusercontent.com/kaiomar8z/Etheriaassets/main/';
    const addForm = document.getElementById('add-unit-form');
    const unitListBody = document.getElementById('unit-list-body');
    const imageInput = document.getElementById('unit-image-input');
    const imagePlaceholder = document.getElementById('image-placeholder');
    const unitNameInput = document.getElementById('unit-name');
    const editModal = document.getElementById('edit-modal');
    const editForm = document.getElementById('edit-unit-form');
    const closeModalBtn = document.querySelector('#edit-modal .close-btn');

    const searchInput = document.getElementById('search-input');
    const filterElement = document.getElementById('filter-element');
    const filterRarity = document.getElementById('filter-rarity');
    const filterFavoritesBtn = document.getElementById('filter-favorites-btn');
    const table = document.getElementById('units-table');

    const importInput = document.getElementById('import-input');
    const importCsvInput = document.getElementById('import-csv-input');
    const exportBtn = document.getElementById('export-btn');

    const showManagerBtn = document.getElementById('show-manager-btn');
    const showBuilderBtn = document.getElementById('show-builder-btn');
    const showObjectivesBtn = document.getElementById('show-objectives-btn');
    const managerView = document.getElementById('manager-view');
    const builderView = document.getElementById('builder-view');
    const objectivesView = document.getElementById('objectives-view');
    
    const teamBuilderUnitList = document.getElementById('team-builder-unit-list');
    const teamSlotsContainer = document.querySelector('.team-slots');
    const teamSelect = document.getElementById('team-select');
    const teamNameInput = document.getElementById('team-name-input');
    const saveTeamBtn = document.getElementById('save-team-btn');
    const newTeamBtn = document.getElementById('new-team-btn');
    const deleteTeamBtn = document.getElementById('delete-team-btn');
    const teamNotesTextarea = document.getElementById('team-notes-textarea');

    const clearFormBtn = document.getElementById('clear-form-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const deleteSelectedBtn = document.getElementById('delete-selected-btn');

    const unitRowTemplate = document.getElementById('unit-row-template');
    const routineTrackerContent = document.getElementById('routine-tracker-content');
    
    // AJOUT : Sélection du nouveau bouton
    const backToTopBtn = document.getElementById('back-to-top-btn');
    // #endregion

    // #region --- ÉTAT DE L'APPLICATION (State) et variables Firestore ---
    let units = [];
    let teams = [];
    let manualObjectives = [];
    let dailyRoutine = {};
    let unitsDB = null;

    let activeTeamId = null;
    let currentSort = { column: 'level', direction: 'desc' };
    let favoritesFilterActive = false;
    let selectionModeSlotIndex = null;
    let unitImageData = null;
    let currentImageFile = null;
    // #endregion

    // #region --- GESTIONNAIRE D'ÉVÉNEMENTS "Retour en Haut" ---
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) { // Le bouton apparaît après avoir scrollé de 300px
                backToTopBtn.classList.add('active');
            } else {
                backToTopBtn.classList.remove('active');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth' // Défilement fluide
            });
        });
    }
    // #endregion

    // #region --- MODULE DE GESTION DE LA ROUTINE ---
    const ROUTINE_DEFINITION = [
        { name: "Arène", type: "checkbox" },
        { name: "Event Train de l'infini", type: "checkbox" },
        { name: "Echo (multi-combat)", type: "checkbox" },
        { name: "Event Rassemblement Ethernet", type: "checkbox" },
        { name: "Don/récolte fragment Union", type: "checkbox" },
        { name: "Boss d'Union", type: "checkbox" },
        { name: "Pari Appel du Champion", type: "checkbox" },
        { name: "Refill Hydra", type: "counter", max: 10 }
    ];

    const getGameDay = (date = new Date()) => {
        const resetHour = 5;
        const gameDate = new Date(date);
        if (date.getHours() < resetHour) {
            gameDate.setDate(date.getDate() - 1);
        }
        return gameDate.toISOString().split('T')[0];
    };

    const checkRoutineReset = async () => {
        const currentGameDay = getGameDay();
        let routineToSave = { ...dailyRoutine };

        if (!routineToSave.tasks) {
            routineToSave.tasks = {};
        }

        let needsSave = false;

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            const taskState = routineToSave.tasks[taskName];

            if (!taskState) {
                if (taskDef.type === 'checkbox') {
                    routineToSave.tasks[taskName] = { completedOn: null };
                } else if (taskDef.type === 'counter') {
                    routineToSave.tasks[taskName] = { count: 0, updatedOn: null };
                }
                needsSave = true;
                return;
            }

            if (taskDef.type === 'checkbox') {
                if (taskState.completedOn && taskState.completedOn !== currentGameDay) {
                    taskState.completedOn = null;
                    needsSave = true;
                }
            } else if (taskDef.type === 'counter') {
                if (taskState.updatedOn && taskState.updatedOn !== currentGameDay) {
                    taskState.count = 0;
                    taskState.updatedOn = null;
                    needsSave = true;
                }
            }
        });

        if (needsSave || Object.keys(dailyRoutine).length === 0) {
             try {
                await dailyRoutineDoc.set(routineToSave);
                console.log("Daily routine reset/initialized in Firestore.");
            } catch (e) {
                console.error("Error setting daily routine to Firestore: ", e);
            }
        }
    };

    const renderRoutineTracker = () => {
        routineTrackerContent.innerHTML = '';
        const currentGameDay = getGameDay();

        if (!dailyRoutine || !dailyRoutine.tasks) {
            routineTrackerContent.innerHTML = `<p style="text-align: center; color: var(--text-color-muted);">Chargement de la routine quotidienne...</p>`;
            return;
        }

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            const taskState = dailyRoutine.tasks[taskName];
            const item = document.createElement('div');
            item.className = 'routine-item';
            item.dataset.taskName = taskName;
            item.dataset.taskType = taskDef.type;

            if (taskDef.type === 'checkbox') {
                const isCompleted = taskState && taskState.completedOn === currentGameDay;
                if (isCompleted) item.classList.add('completed');
                item.innerHTML = `
                    <label>
                        <input type="checkbox" ${isCompleted ? 'checked' : ''}>
                        <span>${taskName}</span>
                    </label>
                `;
            } else if (taskDef.type === 'counter') {
                const count = (taskState && taskState.count) || 0;
                if (count >= taskDef.max) item.classList.add('completed');
                item.innerHTML = `
                    <label><span>${taskName}</span></label>
                    <div class="hydra-controls">
                        <button class="hydra-btn" data-action="minus">-</button>
                        <span class="hydra-count">${count}</span>
                        <button class="hydra-btn" data-action="plus">+</button>
                    </div>
                `;
            }
            routineTrackerContent.appendChild(item);
        });
    };
    // #endregion

    // #region --- NAVIGATION PRINCIPALE ---
    const switchView = (viewToShow) => {
        managerView.classList.remove('active');
        builderView.classList.remove('active', 'flex');
        objectivesView.classList.remove('active');

        showManagerBtn.classList.remove('active');
        showBuilderBtn.classList.remove('active');
        showObjectivesBtn.classList.remove('active');

        if (viewToShow === 'manager') {
            managerView.classList.add('active');
            showManagerBtn.classList.add('active');
        } else if (viewToShow === 'builder') {
            builderView.classList.add('active', 'flex');
            showBuilderBtn.classList.add('active');
            renderTeamBuilderUnitList();
            renderActiveTeam();
        } else if (viewToShow === 'objectives') {
            objectivesView.classList.add('active');
            showObjectivesBtn.classList.add('active');
            renderManualObjectives();
        }
    };
    // #endregion

    // #region --- MODULE GESTIONNAIRE D'OBJECTIFS (To-Do List) ---
    const addObjectiveForm = document.getElementById('add-objective-form');
    const newObjectiveInput = document.getElementById('new-objective-input');
    const objectivesListContainer = document.getElementById('objectives-list');

    const renderManualObjectives = () => {
        objectivesListContainer.innerHTML = '';

        if (manualObjectives.length === 0) {
            objectivesListContainer.innerHTML = `<p style="text-align: center; color: var(--text-color-muted);">Vous n'avez aucun objectif. Ajoutez-en un !</p>`;
            return;
        }

        manualObjectives.forEach(obj => {
            const li = document.createElement('li');
            li.className = `objective-item ${obj.completed ? 'completed' : ''}`;
            li.dataset.id = obj.id;

            li.innerHTML = `
                <input type="checkbox" class="objective-checkbox" ${obj.completed ? 'checked' : ''}>
                <span class="objective-text">${obj.text}</span>
                <button class="delete-objective-btn" title="Supprimer l'objectif">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;
            objectivesListContainer.appendChild(li);
        });
    };
    // #endregion

    // #region --- MODULE GESTIONNAIRE D'UNITÉS ---
    const elementIconMap = {
        'Rouge': 'reason.webp',
        'Bleu': 'odd.webp',
        'Vert': 'hollow.webp',
        'Dark': 'disorder.webp',
        'Light': 'constant.webp'
    };

    const resetAddForm = () => {
        addForm.reset();
        unitImageData = null;
        currentImageFile = null;
        imagePlaceholder.innerHTML = '<span>Cliquez pour ajouter une image</span>';
        imageInput.value = '';
        unitNameInput.focus();
        document.getElementById('unit-stars').value = 3;
        document.getElementById('unit-level').value = 1;
        document.getElementById('unit-doublon').value = 0;
        document.getElementById('unit-s1').value = 1;
        document.getElementById('unit-s2').value = 1;
        document.getElementById('unit-s3').value = 1;
    };

    const findUnitImage = async (unitName) => {
        if (!unitName || !unitName.trim()) {
            unitImageData = null;
            imagePlaceholder.innerHTML = '<span>Cliquez pour ajouter une image</span>';
            return;
        }

        const formattedName = unitName.trim().replace(/ /g, '_').toLowerCase();
        const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        let foundImageUrl = null;
        imagePlaceholder.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Recherche...</span>';

        for (const ext of extensions) {
            const potentialUrl = `${imageBaseUrl}${formattedName}.${ext}`;
            try {
                const response = await fetch(potentialUrl, { method: 'HEAD', cache: 'no-cache' });
                if (response.ok) { foundImageUrl = potentialUrl; break; }
            } catch (error) { /* Ignore fetch errors */ }
        }

        if (foundImageUrl) {
            unitImageData = foundImageUrl;
            imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="${unitName}">`;
            currentImageFile = null;
        } else {
            unitImageData = null;
            imagePlaceholder.innerHTML = '<span>Image non trouvée.<br>Cliquez pour uploader.</span>';
        }
    };

    const fetchAndFillUnitData = async (unitName) => {
        if (!unitName.trim()) return;

        const dbUrl = './units_db.json';

        try {
            if (!unitsDB) {
                const response = await fetch(dbUrl);
                if (!response.ok) throw new Error('Erreur réseau lors de la récupération de la DB.');
                unitsDB = await response.json();
            }

            const foundUnit = unitsDB.find(u => u.name.toLowerCase() === unitName.toLowerCase());

            if (foundUnit) {
                document.getElementById('unit-element').value = foundUnit.element;
                document.getElementById('unit-rarity').value = foundUnit.rarity;
                showToast(`Données pour ${foundUnit.name} chargées !`, 'success');
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de la base de données d'unités:", error);
            showToast("Impossible de charger la base de données des unités.", "error");
        }
    };

    const renderSkillLevel = (level) => {
        const numericLevel = parseInt(level, 10) || 0;
        const dots = '<span class="filled">●</span>'.repeat(numericLevel) + '<span class="empty">●</span>'.repeat(5 - numericLevel);
        return `<div class="skills-wrapper">${dots}</div>`;
    };

    const renderStars = (count) => {
        const numericCount = parseInt(count, 10) || 0;
        const stars = Array(numericCount).fill('<i class="fa-solid fa-star"></i>').join('');
        return `<div class="stars-wrapper">${stars}</div>`;
    };

    const renderDoublons = (count) => {
        const numericCount = parseInt(count, 10) || 0;
        let html = '';
        for (let i = 0; i < 5; i++) {
            html += `<div class="doublon-node ${i < numericCount ? 'filled' : ''}"></div>`;
        }
        return html;
    };


    const displayUnits = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const selectedElement = filterElement.value;
        const selectedRarity = filterRarity.value;

        let processedUnits = units.filter(unit => {
            const matchesSearch = unit.name.toLowerCase().includes(searchTerm);
            const matchesElement = !selectedElement || unit.element === selectedElement;
            const matchesRarity = !selectedRarity || unit.rarity === selectedRarity;
            const matchesFavorite = !favoritesFilterActive || unit.isFavorite;
            return matchesSearch && matchesElement && matchesRarity && matchesFavorite;
        });

        processedUnits.sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;

            const valA = a[currentSort.column];
            const valB = b[currentSort.column];
            const direction = currentSort.direction === 'asc' ? 1 : -1;

            if (typeof valA === 'string') {
                return valA.localeCompare(valB) * direction;
            } else {
                return (valA - valB) * direction;
            }
        });

        renderTable(processedUnits);
        updateSortHeaders();
    };

    const renderTable = (unitsToDisplay) => {
        unitListBody.innerHTML = '';
        if (unitsToDisplay.length === 0) {
            unitListBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-color-muted);">Aucune unité ne correspond à vos critères.</td></tr>`;
            return;
        }
        unitsToDisplay.forEach(unit => {
            const rowFragment = unitRowTemplate.content.cloneNode(true);
            const row = rowFragment.querySelector('tr');

            const checkbox = rowFragment.querySelector('.unit-checkbox');
            checkbox.dataset.id = unit.id;
            checkbox.checked = document.getElementById('select-all-checkbox').checked || (
                Array.from(document.querySelectorAll('.unit-checkbox')).some(cb => cb.dataset.id === unit.id && cb.checked)
            );

            if (checkbox.checked) {
                row.classList.add('selected-row');
            } else {
                row.classList.remove('selected-row');
            }

            const img = rowFragment.querySelector('.unit-image-cell img');
            img.alt = unit.name;

            if (unit.image) {
                img.src = unit.image;
            } else {
                const formattedName = unit.name.trim().replace(/ /g, '_').toLowerCase();
                img.src = `${imageBaseUrl}${formattedName}.webp`;
                img.onerror = () => {
                    img.src = 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?';
                    img.onerror = null;
                };
            }

            if (unit.rarity) {
                img.classList.add(`rarity-border-${unit.rarity.toLowerCase()}`);
            }

            const nameCell = rowFragment.querySelector('.unit-name-cell');
            nameCell.textContent = unit.name;
            nameCell.title = unit.name;

            if (unit.notes && unit.notes.trim() !== '') {
                const noteIcon = document.createElement('span');
                noteIcon.className = 'unit-has-notes-icon';
                noteIcon.title = unit.notes;
                noteIcon.innerHTML = '<i class="fa-solid fa-note-sticky"></i>';
                nameCell.appendChild(noteIcon);
            }

            const elementCell = rowFragment.querySelector('.unit-element-cell');
            const elementIcon = elementIconMap[unit.element];
            if (elementIcon) {
                elementCell.innerHTML = `<img src="${elementIcon}" alt="${unit.element}" class="table-icon" />`;
            } else {
                elementCell.textContent = unit.element;
            }

            const rarityCell = rowFragment.querySelector('.unit-rarity-cell');
            if (unit.rarity) {
                rarityCell.innerHTML = `<img src="${unit.rarity.toLowerCase()}.webp" alt="${unit.rarity}" class="table-icon" />`;
            } else {
                rarityCell.textContent = '';
            }

            rowFragment.querySelector('.stars').innerHTML = renderStars(unit.stars);
            rowFragment.querySelector('.unit-level-cell').textContent = unit.level;
            rowFragment.querySelector('.doublon-display-cell').innerHTML = renderDoublons(unit.doublon);
            
            rowFragment.querySelector('.unit-s1-cell').innerHTML = renderSkillLevel(unit.s1);
            rowFragment.querySelector('.unit-s2-cell').innerHTML = renderSkillLevel(unit.s2);
            rowFragment.querySelector('.unit-s3-cell').innerHTML = renderSkillLevel(unit.s3);

            const favoriteBtn = rowFragment.querySelector('.favorite-btn');
            if (unit.isFavorite) {
                favoriteBtn.classList.add('is-favorite');
                favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i>';
                favoriteBtn.title = "Retirer des favoris";
            } else {
                favoriteBtn.classList.remove('is-favorite');
                favoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
                favoriteBtn.title = "Mettre en favori";
            }

            favoriteBtn.dataset.id = unit.id;
            rowFragment.querySelector('.edit-btn').dataset.id = unit.id;
            rowFragment.querySelector('.delete-btn').dataset.id = unit.id;

            unitListBody.appendChild(rowFragment);
        });
    };

    const updateSortHeaders = () => {
        table.querySelectorAll('thead th.sortable').forEach(th => {
            const sortKey = th.dataset.sort;
            th.classList.remove('sorted', 'asc', 'desc');
            const arrow = th.querySelector('.sort-arrow');
            if (sortKey === currentSort.column) {
                th.classList.add('sorted', currentSort.direction);
                arrow.innerHTML = currentSort.direction === 'asc' ? '<i class="fa-solid fa-arrow-up"></i>' : '<i class="fa-solid fa-arrow-down"></i>';
            } else {
                 arrow.innerHTML = '';
            }
        });
    };

    async function openEditModal(unitId) {
        const unit = units.find(u => u.id === unitId);
        if (!unit) {
            showToast('Unité introuvable pour édition.', 'error');
            return;
        }

        document.getElementById('edit-unit-id').value = unit.id;
        document.getElementById('edit-unit-name').value = unit.name;
        document.getElementById('edit-unit-element').value = unit.element;
        document.getElementById('edit-unit-rarity').value = unit.rarity;
        document.getElementById('edit-unit-stars').value = unit.stars;
        document.getElementById('edit-unit-level').value = unit.level;
        document.getElementById('edit-unit-doublon').value = unit.doublon;
        document.getElementById('edit-unit-s1').value = unit.s1;
        document.getElementById('edit-unit-s2').value = unit.s2;
        document.getElementById('edit-unit-s3').value = unit.s3;
        document.getElementById('edit-unit-notes').value = unit.notes || '';
        editModal.style.display = 'block';
    }

    function closeEditModal() { editModal.style.display = 'none'; }

    const updateSelectionState = () => {
        const allCheckboxes = document.querySelectorAll('.unit-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.unit-checkbox:checked');

        if (checkedCheckboxes.length > 0) {
            deleteSelectedBtn.style.display = 'inline-flex';
            deleteSelectedBtn.textContent = `Supprimer (${checkedCheckboxes.length})`;
        } else {
            deleteSelectedBtn.style.display = 'none';
        }

        if(allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else if (checkedCheckboxes.length > 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }

        allCheckboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            if (checkbox.checked) {
                row.classList.add('selected-row');
            } else {
                row.classList.remove('selected-row');
            }
        });
    };
    // #endregion

    // #region --- MODULE TEAM BUILDER ---
    const renderTeamBuilderUnitList = () => {
        teamBuilderUnitList.innerHTML = '';
        units.forEach((unit) => {
            const img = document.createElement('img');
            img.src = unit.image || `https://via.placeholder.com/60x60/304065/e0e0e0?text=?`;
            img.title = unit.name;
            img.draggable = true;
            img.dataset.unitId = unit.id;
            teamBuilderUnitList.appendChild(img);
        });
    };

    const updateSelectionModeUI = () => {
        document.querySelectorAll('.team-slot').forEach(slot => {
            slot.classList.remove('is-selecting');
            if (slot.dataset.slotIndex == selectionModeSlotIndex) {
                slot.classList.add('is-selecting');
            }
        });
    };

    const renderActiveTeam = () => {
        teamSlotsContainer.innerHTML = '';
        const activeTeam = teams.find(team => team.id === activeTeamId);

        if (!activeTeam && teams.length > 0) {
            activeTeamId = teams[0].id;
            renderActiveTeam();
            return;
        }
        if (!activeTeam) {
            teamNameInput.value = '';
            teamNotesTextarea.value = '';
            for(let i=0; i<5; i++) {
                const slot = document.createElement('div');
                slot.classList.add('team-slot');
                slot.dataset.slotIndex = i;
                slot.innerText = `Slot ${i + 1}`;
                teamSlotsContainer.appendChild(slot);
            }
            return;
        }

        teamNameInput.value = activeTeam.name;
        teamNotesTextarea.value = activeTeam.notes || '';
        const currentTeamUnits = activeTeam.units || [null, null, null, null, null];

        for(let i=0; i<5; i++) {
            const slot = document.createElement('div');
            slot.classList.add('team-slot');
            slot.dataset.slotIndex = i;

            const unitData = currentTeamUnits[i];
            if (unitData) {
                slot.innerHTML = `
                    <img src="${unitData.image || `https://via.placeholder.com/100x100/304065/e0e0e0?text=?`}" title="${unitData.name}">
                    <button class="remove-from-team-btn" data-slot-index="${i}">&times;</button>
                `;
            } else {
                slot.innerText = `Slot ${i + 1}`;
            }
            teamSlotsContainer.appendChild(slot);
        }
        updateSelectionModeUI();
    };

    const renderTeamSelect = () => {
        teamSelect.innerHTML = '';
        if(teams.length === 0) {
            return;
        }
        teams.forEach((team) => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            if(team.id === activeTeamId) {
                option.selected = true;
            }
            teamSelect.appendChild(option);
        });
    };
    // #endregion

    // #region --- MODULES DASHBOARD & IMPORT/EXPORT ---
    const updateDashboard = () => {
        const totalUnits = units.length;
        document.getElementById('stat-total-units').innerText = totalUnits;
        const rarityCounts = units.reduce((acc, unit) => {
            acc[unit.rarity] = (acc[unit.rarity] || 0) + 1;
            return acc;
        }, {});
        document.getElementById('stat-ssr-count').innerText = rarityCounts['SSR'] || 0;
        document.getElementById('stat-sr-count').innerText = rarityCounts['SR'] || 0;
        document.getElementById('stat-r-count').innerText = rarityCounts['R'] || 0;
        const elementCounts = units.reduce((acc, unit) => {
            acc[unit.element] = (acc[unit.element] || 0) + 1;
            return acc;
        }, {});
        const elementDistributionDiv = document.getElementById('stat-element-distribution');
        elementDistributionDiv.innerHTML = '';
        const elementOrder = ['Rouge', 'Bleu', 'Vert', 'Light', 'Dark'];
        elementOrder.forEach(element => {
            const count = elementCounts[element] || 0;
            if(count > 0 || totalUnits === 0) {
                const percentage = totalUnits > 0 ? (count / totalUnits) * 100 : 0;
                const barHtml = `
                    <div class="element-bar">
                        <span class="element-label">${element}</span>
                        <div class="element-progress-bar">
                            <div class="element-progress progress-${element}" style="width: ${percentage}%;"></div>
                        </div>
                        <span class="element-count">${count}</span>
                    </div>`;
                elementDistributionDiv.innerHTML += barHtml;
            }
        });
    };
    // #endregion

    // #region --- GESTION DES ÉVÉNEMENTS (Event Listeners) ---
    // Navigation
    showManagerBtn.addEventListener('click', () => switchView('manager'));
    showBuilderBtn.addEventListener('click', () => switchView('builder'));
    showObjectivesBtn.addEventListener('click', () => switchView('objectives'));

    // Formulaire d'ajout
    addForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const unitName = document.getElementById('unit-name').value;

        let imageUrl = unitImageData;
        if (currentImageFile) {
            const storageRef = storage.ref(`unit_images/${unitName}_${Date.now()}_${currentImageFile.name}`);
            try {
                showToast("Téléchargement de l'image...", 'info', 5000);
                const snapshot = await storageRef.put(currentImageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
                showToast("Image téléchargée !", 'success');
            } catch (error) {
                console.error("Error uploading image:", error);
                showToast("Erreur lors du téléchargement de l'image.", 'error');
                imageUrl = null;
            }
        }

        const newUnit = {
            name: unitName,
            image: imageUrl,
            element: document.getElementById('unit-element').value,
            rarity: document.getElementById('unit-rarity').value,
            stars: parseInt(document.getElementById('unit-stars').value, 10),
            level: parseInt(document.getElementById('unit-level').value, 10),
            doublon: parseInt(document.getElementById('unit-doublon').value, 10),
            s1: parseInt(document.getElementById('unit-s1').value, 10),
            s2: parseInt(document.getElementById('unit-s2').value, 10),
            s3: parseInt(document.getElementById('unit-s3').value, 10),
            isFavorite: false,
            notes: ''
        };

        try {
            await unitsCol.add(newUnit);
            showToast(`'${newUnit.name}' a été ajouté.`, 'success');
            resetAddForm();
        } catch (e) {
            console.error("Error adding document: ", e);
            showToast("Erreur lors de l'ajout de l'unité.", 'error');
        }
    });

    clearFormBtn.addEventListener('click', resetAddForm);

    unitNameInput.addEventListener('blur', () => {
        const name = unitNameInput.value;
        findUnitImage(name);
        fetchAndFillUnitData(name);
    });

    imagePlaceholder.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            currentImageFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                unitImageData = e.target.result;
                imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="Aperçu de l'unité">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('.number-controls button').forEach(button => {
        button.addEventListener('click', (event) => {
            const targetInputId = event.target.dataset.targetInput;
            if (!targetInputId) return;

            const targetElement = document.getElementById(targetInputId);
            if (!targetElement) return;

            let currentValue;
            let min, max;

            if (targetElement.tagName === 'INPUT') {
                currentValue = parseInt(targetElement.value, 10);
                if (isNaN(currentValue)) {
                    currentValue = parseInt(targetElement.min, 10);
                }
                min = parseInt(targetElement.min, 10);
                max = parseInt(targetElement.max, 10);
            } else if (targetElement.tagName === 'SELECT') {
                currentValue = parseInt(targetElement.value, 10);
                const options = Array.from(targetElement.options).map(opt => parseInt(opt.value, 10));
                min = Math.min(...options);
                max = Math.max(...options);
            } else {
                return;
            }

            if (event.target.classList.contains('minus-btn')) {
                currentValue = Math.max(min, currentValue - 1);
            } else if (event.target.classList.contains('plus-btn')) {
                currentValue = Math.min(max, currentValue + 1);
            }

            targetElement.value = currentValue;
        });
    });

    unitListBody.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        const checkbox = event.target.closest('.unit-checkbox');

        if (button && button.dataset.id) {
            const unitId = button.dataset.id;

            if (button.classList.contains('favorite-btn')) {
                const unitToUpdate = units.find(u => u.id === unitId);
                if (unitToUpdate) {
                    try {
                        await unitsCol.doc(unitId).update({ isFavorite: !unitToUpdate.isFavorite });
                        showToast("Statut favori mis à jour.", 'success');
                    } catch (e) {
                        console.error("Error updating favorite status: ", e);
                        showToast("Erreur lors de la mise à jour du favori.", 'error');
                    }
                }
            } else if (button.classList.contains('edit-btn')) {
                openEditModal(unitId);
            } else if (button.classList.contains('delete-btn')) {
                const unitName = units.find(u => u.id === unitId)?.name || 'cette unité';
                if (await showConfirm('Supprimer', `Êtes-vous sûr de vouloir supprimer ${unitName} ?`)) {
                    try {
                        await unitsCol.doc(unitId).delete();
                        showToast('Unité supprimée.', 'info');
                    } catch (e) {
                        console.error("Error deleting document: ", e);
                        showToast("Erreur lors de la suppression de l'unité.", 'error');
                    }
                }
            }
        }

        if (checkbox) {
            updateSelectionState();
        }
    });

    searchInput.addEventListener('input', displayUnits);
    filterElement.addEventListener('change', displayUnits);
    filterRarity.addEventListener('change', displayUnits);

    filterFavoritesBtn.addEventListener('click', () => {
        favoritesFilterActive = !favoritesFilterActive;
        filterFavoritesBtn.classList.toggle('active', favoritesFilterActive);
        displayUnits();
    });

    table.querySelector('thead').addEventListener('click', (event) => {
        const header = event.target.closest('th');
        if (!header || !header.classList.contains('sortable')) return;
        const sortKey = header.dataset.sort;
        if (currentSort.column === sortKey) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.column = sortKey;
            currentSort.direction = 'asc';
        }
        displayUnits();
    });

    selectAllCheckbox.addEventListener('change', () => {
        document.querySelectorAll('.unit-checkbox').forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateSelectionState();
    });

    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.unit-checkbox:checked')).map(cb => cb.dataset.id);
        if (selectedIds.length === 0) return;
        if(await showConfirm('Supprimer en masse', `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} unité(s) ?`)) {
            try {
                const batch = db.batch();
                selectedIds.forEach(id => {
                    const docRef = unitsCol.doc(id);
                    batch.delete(docRef);
                });
                await batch.commit();
                showToast(`${selectedIds.length} unité(s) supprimée(s).`, 'success');
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                deleteSelectedBtn.style.display = 'none';
            } catch (e) {
                console.error("Error batch deleting documents: ", e);
                showToast("Erreur lors de la suppression en masse.", 'error');
            }
        }
    });

    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const unitId = document.getElementById('edit-unit-id').value;

        const updatedUnitData = {
            name: document.getElementById('edit-unit-name').value,
            element: document.getElementById('edit-unit-element').value,
            rarity: document.getElementById('edit-unit-rarity').value,
            stars: parseInt(document.getElementById('edit-unit-stars').value, 10),
            level: parseInt(document.getElementById('edit-unit-level').value, 10),
            doublon: parseInt(document.getElementById('edit-unit-doublon').value, 10),
            s1: parseInt(document.getElementById('edit-unit-s1').value, 10),
            s2: parseInt(document.getElementById('edit-unit-s2').value, 10),
            s3: parseInt(document.getElementById('edit-unit-s3').value, 10),
            notes: document.getElementById('edit-unit-notes').value
        };

        try {
            await unitsCol.doc(unitId).update(updatedUnitData);
            showToast('Modifications enregistrées.', 'success');
            closeEditModal();
        } catch (e) {
            console.error("Error updating document: ", e);
            showToast("Erreur lors de l'enregistrement des modifications.", 'error');
        }
    });
    closeModalBtn.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); });

    exportBtn.addEventListener('click', () => {
        if (units.length === 0 && teams.length === 0 && manualObjectives.length === 0 && Object.keys(dailyRoutine).length === 0) {
            showToast("Il n'y a aucune donnée à exporter.", 'info');
            return;
        }
        const unitsExport = units.map(({ id, ...rest }) => rest);
        const teamsExport = teams.map(({ id, ...rest }) => ({...rest, units: rest.units.filter(u => u != null) }));
        const objectivesExport = manualObjectives.map(({ id, ...rest }) => rest);

        const backupData = { units: unitsExport, teams: teamsExport, manualObjectives: objectivesExport, dailyRoutine };
        const dataStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `etheria_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Exportation réussie !', 'success');
    });

    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (await showConfirm('Importer un fichier JSON', "Voulez-vous vraiment remplacer vos données par celles importées ? Cette action est irréversible et écrasera les données sur Firebase.")) {
                    showToast("Importation en cours... Veuillez patienter.", 'info', 5000);
                    const deleteBatch = db.batch();
                    const existingUnits = await unitsCol.get();
                    existingUnits.forEach(doc => deleteBatch.delete(doc.ref));
                    const existingTeams = await teamsCol.get();
                    existingTeams.forEach(doc => deleteBatch.delete(doc.ref));
                    const existingObjectives = await manualObjectivesCol.get();
                    existingObjectives.forEach(doc => deleteBatch.delete(doc.ref));
                    deleteBatch.delete(dailyRoutineDoc);

                    await deleteBatch.commit();

                    const addBatch = db.batch();
                    importedData.units.forEach(unit => addBatch.set(unitsCol.doc(), unit));
                    importedData.teams.forEach(team => addBatch.set(teamsCol.doc(), team));
                    importedData.manualObjectives.forEach(obj => addBatch.set(manualObjectivesCol.doc(), obj));
                    if (importedData.dailyRoutine) {
                        addBatch.set(dailyRoutineDoc, importedData.dailyRoutine);
                    }
                    await addBatch.commit();
                    showToast("Importation complète réussie !", 'success');
                }
            } catch (error) {
                console.error("Error during import:", error);
                showToast("Erreur : Le fichier est invalide ou corrompu ou un problème avec Firebase.", 'error');
            } finally { importInput.value = ''; }
        };
        reader.readAsText(file);
    });

    importCsvInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const csvContent = e.target.result;
                const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
                if (lines.length <= 1) throw new Error("Le fichier CSV est vide ou ne contient que l'en-tête.");

                const header = lines[0];
                const delimiter = header.includes(';') ? ';' : ',';
                const dataLines = lines.slice(1);

                let updatedCount = 0;
                let addedCount = 0;
                const batch = db.batch();

                for (const line of dataLines) {
                    const columns = line.split(delimiter);
                    if (columns.length < 9) continue;

                    const unitData = {
                        name: columns[0].trim(),
                        element: columns[1].trim(),
                        rarity: columns[2].trim(),
                        stars: parseInt(columns[3].trim(), 10) || 3,
                        level: parseInt(columns[4].trim(), 10) || 1,
                        doublon: parseInt(columns[5].trim(), 10) || 0,
                        s1: parseInt(columns[6].trim(), 10) || 1,
                        s2: parseInt(columns[7].trim(), 10) || 1,
                        s3: parseInt(columns[8].trim(), 10) || 1,
                        image: null,
                        isFavorite: false,
                        notes: ''
                    };

                    const existingUnit = units.find(u => u.name.toLowerCase() === unitData.name.toLowerCase());
                    if (existingUnit) {
                        unitData.notes = existingUnit.notes || '';
                        unitData.isFavorite = existingUnit.isFavorite || false;
                        unitData.image = existingUnit.image || null;

                        batch.update(unitsCol.doc(existingUnit.id), unitData);
                        updatedCount++;
                    } else {
                        batch.set(unitsCol.doc(), unitData);
                        addedCount++;
                    }
                }

                await batch.commit();
                showToast(`Importation CSV : ${addedCount} ajouté(s), ${updatedCount} mis à jour.`, 'success');
            } catch (error) {
                showToast("Erreur lors de l'importation du CSV. Vérifiez le format.", 'error');
                console.error(error);
            } finally {
                importCsvInput.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    });

    teamBuilderUnitList.addEventListener('dragstart', (e) => {
        if(e.target.tagName === 'IMG') {
            e.dataTransfer.setData('text/plain', e.target.dataset.unitId);
            e.dataTransfer.effectAllowed = 'copy';
        }
    });

    teamSlotsContainer.addEventListener('dragover', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if (slot) slot.classList.add('drag-over'); });
    teamSlotsContainer.addEventListener('dragleave', (e) => { const slot = e.target.closest('.team-slot'); if (slot) slot.classList.remove('drag-over'); });
    teamSlotsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        const slot = e.target.closest('.team-slot');
        if(slot) {
            slot.classList.remove('drag-over');
            const unitId = e.dataTransfer.getData('text/plain');
            const targetSlot = e.target.classList.contains('team-slot') ? e.target : e.target.closest('.team-slot');
            const slotIndex = parseInt(targetSlot.dataset.slotIndex);
            const unitToAdd = units.find(u => u.id === unitId);
            if (unitToAdd && activeTeamId) {
                const activeTeam = teams.find(t => t.id === activeTeamId);
                if (activeTeam) {
                    const newUnits = [...(activeTeam.units || [null, null, null, null, null])];
                    newUnits[slotIndex] = { ...unitToAdd, id: unitId };
                    try {
                        await teamsCol.doc(activeTeamId).update({ units: newUnits });
                        showToast("Unité ajoutée à l'équipe.", 'success');
                    } catch (e) {
                        console.error("Error adding unit to team: ", e);
                        showToast("Erreur lors de l'ajout de l'unité à l'équipe.", 'error');
                    }
                }
            }
        }
    });

    teamSlotsContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const slot = target.closest('.team-slot');
        if (target.classList.contains('remove-from-team-btn')) {
            const slotIndex = parseInt(target.dataset.slotIndex);
            if (activeTeamId) {
                const activeTeam = teams.find(t => t.id === activeTeamId);
                if (activeTeam) {
                    const newUnits = [...(activeTeam.units || [null, null, null, null, null])];
                    newUnits[slotIndex] = null;
                    try {
                        await teamsCol.doc(activeTeamId).update({ units: newUnits });
                        showToast("Unité retirée de l'équipe.", 'info');
                    } catch (e) {
                        console.error("Error removing unit from team: ", e);
                        showToast("Erreur lors du retrait de l'unité.", 'error');
                    }
                }
            }
            selectionModeSlotIndex = null;
            updateSelectionModeUI();
        } else if (slot) {
            const clickedSlotIndex = parseInt(slot.dataset.slotIndex);
            if (selectionModeSlotIndex === clickedSlotIndex) {
                selectionModeSlotIndex = null;
            } else {
                selectionModeSlotIndex = clickedSlotIndex;
            }
            updateSelectionModeUI();
        }
    });

    teamBuilderUnitList.addEventListener('click', async (e) => {
        if (e.target.tagName === 'IMG' && selectionModeSlotIndex !== null) {
            const unitId = e.target.dataset.unitId;
            const unitToAdd = units.find(u => u.id === unitId);

            if (unitToAdd && activeTeamId) {
                const activeTeam = teams.find(t => t.id === activeTeamId);
                if (activeTeam) {
                    const newUnits = [...(activeTeam.units || [null, null, null, null, null])];
                    newUnits[selectionModeSlotIndex] = { ...unitToAdd, id: unitId };
                    try {
                        await teamsCol.doc(activeTeamId).update({ units: newUnits });
                        showToast("Unité ajoutée à l'équipe.", 'success');
                    } catch (e) {
                        console.error("Error adding unit to team: ", e);
                        showToast("Erreur lors de l'ajout de l'unité à l'équipe.", 'error');
                    }
                }
            }
            selectionModeSlotIndex = null;
            updateSelectionModeUI();
        }
    });

    teamSelect.addEventListener('change', (event) => {
        activeTeamId = event.target.value;
        renderActiveTeam();
    });

    saveTeamBtn.addEventListener('click', async () => {
        const newName = teamNameInput.value.trim();
        if (newName && activeTeamId) {
            try {
                await teamsCol.doc(activeTeamId).update({ name: newName });
                showToast('Nom de l\'équipe sauvegardé !', 'success');
            } catch (e) {
                console.error("Error saving team name: ", e);
                showToast("Erreur lors de la sauvegarde du nom de l'équipe.", 'error');
            }
        } else {
            showToast('Veuillez donner un nom à votre équipe.', 'info');
        }
    });

    newTeamBtn.addEventListener('click', async () => {
        const newTeamData = { name: 'Nouvelle Équipe', units: [null, null, null, null, null], notes: '' };
        try {
            const docRef = await teamsCol.add(newTeamData);
            activeTeamId = docRef.id;
            showToast('Nouvelle équipe créée !', 'success');
        } catch (e) {
            console.error("Error adding new team: ", e);
            showToast("Erreur lors de la création de la nouvelle équipe.", 'error');
        }
    });

    deleteTeamBtn.addEventListener('click', async () => {
        if(teams.length <= 1) {
            showToast("Vous ne pouvez pas supprimer votre dernière équipe.", 'info');
            return;
        }
        const teamToDelete = teams.find(t => t.id === activeTeamId);
        if(teamToDelete && await showConfirm('Supprimer l\'équipe', `Êtes-vous sûr de vouloir supprimer l'équipe "${teamToDelete.name}" ?`)) {
            try {
                await teamsCol.doc(activeTeamId).delete();
                showToast('Équipe supprimée.', 'success');
            } catch (e) {
                console.error("Error deleting team: ", e);
                showToast("Erreur lors de la suppression de l'équipe.", 'error');
            }
        }
    });

    teamNotesTextarea.addEventListener('input', async () => {
        if (activeTeamId) {
            try {
                await teamsCol.doc(activeTeamId).update({ notes: teamNotesTextarea.value });
            } catch (e) {
                console.error("Error updating team notes: ", e);
                showToast("Erreur lors de la sauvegarde des notes.", 'error');
            }
        }
    });

    addObjectiveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = newObjectiveInput.value.trim();
        if (text) {
            try {
                await manualObjectivesCol.add({ text: text, completed: false });
                showToast("Objectif ajouté !", 'success');
                newObjectiveInput.value = '';
            } catch (error) {
                console.error("Error adding objective: ", error);
                showToast("Erreur lors de l'ajout de l'objectif.", 'error');
            }
        }
    });

    objectivesListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const li = target.closest('.objective-item');
        if (!li) return;
        const objectiveId = li.dataset.id;

        if (target.classList.contains('objective-checkbox')) {
            const currentStatus = target.checked;
            try {
                await manualObjectivesCol.doc(objectiveId).update({ completed: currentStatus });
            } catch (error) {
                console.error("Error updating objective status: ", error);
                showToast("Erreur lors de la mise à jour de l'objectif.", 'error');
            }
        }
        if (target.closest('.delete-objective-btn')) {
            try {
                await manualObjectivesCol.doc(objectiveId).delete();
                showToast("Objectif supprimé.", 'info');
            } catch (error) {
                console.error("Error deleting objective: ", error);
                showToast("Erreur lors de la suppression de l'objectif.", 'error');
            }
        }
    });

    routineTrackerContent.addEventListener('click', async (e) => {
        const item = e.target.closest('.routine-item');
        if (!item) return;

        const taskName = item.dataset.taskName;
        const taskType = item.dataset.taskType;
        const taskDef = ROUTINE_DEFINITION.find(t => t.name === taskName);
        if (!taskDef) return;

        let updatedTasks = { ...dailyRoutine.tasks };
        let taskState = updatedTasks[taskName];

        const currentGameDay = getGameDay();

        if (taskType === 'checkbox') {
            const checkbox = item.querySelector('input[type="checkbox"]');
            taskState = { completedOn: checkbox.checked ? currentGameDay : null };
        } else if (taskDef.type === 'counter') {
            const action = e.target.dataset.action;
            let count = (taskState && taskState.count) || 0;
            if (action === 'plus') {
                count = Math.min(taskDef.max, count + 1);
            } else if (action === 'minus') {
                count = Math.max(0, count - 1);
            }
            taskState = { count: count, updatedOn: currentGameDay };
        }
        updatedTasks[taskName] = taskState;

        try {
            await dailyRoutineDoc.update({ tasks: updatedTasks });
        } catch (error) {
            console.error("Error updating routine task: ", error);
            showToast("Erreur lors de la mise à jour de la routine.", 'error');
        }
    });

    // #endregion

    // #region --- INITIALISATION DE L'APPLICATION (Firebase Listeners) ---

    const setupFirestoreListeners = () => {
        unitsCol.onSnapshot(snapshot => {
            units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI();
            renderTeamBuilderUnitList();
            renderActiveTeam();
        }, error => {
            console.error("Error listening to units collection:", error);
            showToast("Erreur de synchronisation des unités.", 'error');
        });

        teamsCol.orderBy('name').onSnapshot(snapshot => {
            teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (!activeTeamId || !teams.some(team => team.id === activeTeamId)) {
                if (teams.length > 0) {
                    activeTeamId = teams[0].id;
                } else {
                    teamsCol.add({ name: 'Mon Équipe', units: [null, null, null, null, null], notes: '' })
                        .then(docRef => {
                            activeTeamId = docRef.id;
                            showToast("Équipe par défaut créée.", 'info');
                        })
                        .catch(e => console.error("Error creating default team: ", e));
                }
            }
            renderTeamSelect();
            renderActiveTeam();
        }, error => {
            console.error("Error listening to teams collection:", error);
            showToast("Erreur de synchronisation des équipes.", 'error');
        });

        manualObjectivesCol.orderBy('text').onSnapshot(snapshot => {
            manualObjectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderManualObjectives();
        }, error => {
            console.error("Error listening to objectives collection:", error);
            showToast("Erreur de synchronisation des objectifs.", 'error');
        });

        dailyRoutineDoc.onSnapshot(doc => {
            if (doc.exists) {
                dailyRoutine = doc.data();
            } else {
                dailyRoutine = { tasks: {} };
            }
            checkRoutineReset();
            renderRoutineTracker();
        }, error => {
            console.error("Error listening to daily routine document:", error);
            showToast("Erreur de synchronisation de la routine quotidienne.", 'error');
        });
    };

    const refreshUI = () => {
        displayUnits();
        updateDashboard();
        updateSelectionState();
    };

    setupFirestoreListeners();
    switchView('manager');
    // #endregion
});
