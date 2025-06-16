document.addEventListener('DOMContentLoaded', () => { 

    // --- Initialisation de Firebase ---
    // !!! COLLEZ VOTRE OBJET DE CONFIGURATION PERSONNEL ICI !!!
    const firebaseConfig = {
      apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
      authDomain: "etheria-manager.firebaseapp.com",
      projectId: "etheria-manager",
      storageBucket: "etheria-manager.firebasestorage.app",
      messagingSenderId: "247321381553",
      appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
    };

    const app = firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    // On va tout stocker dans un seul document pour faire simple.
    const dataDocRef = db.collection('managerData').doc('mainCollection');
    // --- Fin de l'initialisation ---

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

    // #region --- MODULES UTILITAIRES --- 
    const toastContainer = document.getElementById('toast-container'); 
    const showToast = (message, type = 'info', duration = 3500) => { 
        const toast = document.createElement('div'); 
        toast.className = `toast ${type}`; 
        toast.textContent = message; 
        toastContainer.appendChild(toast); 
        setTimeout(() => { toast.remove(); }, duration); 
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
    const updateImagesBtn = document.getElementById('update-images-btn');
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
    // #endregion 

    // #region --- ÉTAT LOCAL DE L'APPLICATION --- 
    let units = []; 
    let teams = []; 
    let manualObjectives = []; 
    let dailyRoutine = {};
    let activeTeamIndex = 0; 
    let currentSort = { column: 'level', direction: 'desc' }; 
    let favoritesFilterActive = false; 
    let selectionModeSlotIndex = null; 
    let unitImageData = null; 
    // #endregion 

    // #region --- LOGIQUE DE DONNÉES FIREBASE ---
    async function saveDataToFirebase() {
        const cleanUnits = units.map(u => {
            const unitCopy = {...u};
            if (!(unitCopy.image && unitCopy.image.startsWith("data:image"))) {
                unitCopy.image = null;
            }
            return unitCopy;
        });
        
        try {
            await dataDocRef.set({
                units: cleanUnits,
                teams: teams,
                manualObjectives: manualObjectives,
                dailyRoutine: dailyRoutine
            });
            console.log("Données sauvegardées sur Firebase !");
        } catch (error) {
            console.error("Erreur de sauvegarde sur Firebase: ", error);
            showToast("Erreur de sauvegarde des données.", "error");
        }
    }

    dataDocRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            units = data.units || [];
            teams = data.teams || [];
            manualObjectives = data.manualObjectives || [];
            dailyRoutine = data.dailyRoutine || {};
            console.log("Données locales synchronisées depuis Firebase.");
            fullAppRefresh();
        } else {
            console.log("Aucune donnée trouvée, initialisation de la base de données.");
            saveDataToFirebase();
        }
    }, (error) => {
        console.error("Erreur de connexion à la base de données: ", error);
        showToast("Erreur de connexion à la base de données.", "error");
    });
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
    
    const checkRoutineReset = () => {
        const currentGameDay = getGameDay();
        let changed = false;
        if (!dailyRoutine.tasks) { 
            dailyRoutine.tasks = {}; 
            changed = true;
        } 
        ROUTINE_DEFINITION.forEach(taskDef => { 
            const taskName = taskDef.name; 
            if (!dailyRoutine.tasks[taskName]) {
                 if(taskDef.type === 'checkbox') dailyRoutine.tasks[taskName] = { completedOn: null };
                 else if (taskDef.type === 'counter') dailyRoutine.tasks[taskName] = { count: 0, updatedOn: null };
                 changed = true;
            }
            const taskState = dailyRoutine.tasks[taskName]; 
            if (taskDef.type === 'checkbox') { 
                if (taskState.completedOn && taskState.completedOn !== currentGameDay) { 
                    taskState.completedOn = null;
                    changed = true;
                } 
            } else if (taskDef.type === 'counter') { 
                if (taskState.updatedOn && taskState.updatedOn !== currentGameDay) { 
                    taskState.count = 0; 
                    taskState.updatedOn = null; 
                    changed = true;
                } 
            } 
        });
        if(changed) saveDataToFirebase();
    }; 

    const renderRoutineTracker = () => {
        routineTrackerContent.innerHTML = '';
        if (!dailyRoutine.tasks) return;
        const currentGameDay = getGameDay();
        ROUTINE_DEFINITION.forEach(taskDef => { 
            const taskState = dailyRoutine.tasks[taskDef.name];
            if(!taskState) return; 
            const item = document.createElement('div'); 
            item.className = 'routine-item'; 
            item.dataset.taskName = taskDef.name; 
            item.dataset.taskType = taskDef.type; 
            if (taskDef.type === 'checkbox') { 
                const isCompleted = taskState.completedOn === currentGameDay; 
                if (isCompleted) item.classList.add('completed'); 
                item.innerHTML = `<label><input type="checkbox" ${isCompleted ? 'checked' : ''}><span>${taskDef.name}</span></label>`; 
            } else if (taskDef.type === 'counter') { 
                const count = taskState.count || 0; 
                if (count >= taskDef.max) item.classList.add('completed'); 
                item.innerHTML = `<label><span>${taskDef.name}</span></label><div class="hydra-controls"><button class="hydra-btn" data-action="minus">-</button><span class="hydra-count">${count}</span><button class="hydra-btn" data-action="plus">+</button></div>`; 
            } 
            routineTrackerContent.appendChild(item); 
        }); 
    }; 
    // #endregion 

    // #region --- NAVIGATION PRINCIPALE --- 
    const switchView = (viewToShow) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active', 'flex'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const view = document.getElementById(`${viewToShow}-view`);
        const btn = document.getElementById(`show-${viewToShow}-btn`);

        if(view && btn) {
            view.classList.add('active');
            btn.classList.add('active');
            if(view.id === 'builder-view') view.classList.add('flex');
        }
    };
    // #endregion 
    
    // #region --- MODULE GESTIONNAIRE D'OBJECTIFS --- 
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
            li.innerHTML = `<input type="checkbox" class="objective-checkbox" ${obj.completed ? 'checked' : ''}><span class="objective-text">${obj.text}</span><button class="delete-objective-btn" title="Supprimer l'objectif"><i class="fa-solid fa-trash-can"></i></button>`; 
            objectivesListContainer.appendChild(li); 
        }); 
    }; 
    // #endregion 

    // #region --- MODULE GESTIONNAIRE D'UNITÉS --- 
    const elementIconMap = { 'Rouge': 'reason.webp', 'Bleu': 'odd.webp', 'Vert': 'hollow.webp', 'Dark': 'disorder.webp', 'Light': 'constant.webp' };

    function normalizeStringForFilename(str) {
        if (!str) return '';
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '').replace(/'/g, '');
    }

    const resetAddForm = () => { 
        addForm.reset();
        unitImageData = null; 
        imagePlaceholder.innerHTML = '<span>Cliquez pour ajouter une image</span>'; 
        imageInput.value = ''; 
        unitNameInput.focus(); 
    }; 
    
    const findUnitImage = async (unitName) => { 
        if (!unitName || !unitName.trim()) return;
        const formattedName = normalizeStringForFilename(unitName);
        const extensions = ['webp', 'png', 'jpg']; 
        imagePlaceholder.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Recherche...</span>'; 
        for (const ext of extensions) { 
            const potentialUrl = `${imageBaseUrl}${formattedName}.${ext}`; 
            try { 
                const response = await fetch(potentialUrl, { method: 'HEAD' }); 
                if (response.ok) { 
                    const imageResponse = await fetch(potentialUrl);
                    const blob = await imageResponse.blob();
                    const reader = new FileReader(); 
                    reader.onload = (e) => { 
                        unitImageData = e.target.result; 
                        imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="${unitName}">`; 
                    }; 
                    reader.readAsDataURL(blob); 
                    return; 
                } 
            } catch (error) { /* Ignore */ } 
        } 
        unitImageData = null; 
        imagePlaceholder.innerHTML = '<span>Image non trouvée.<br>Cliquez pour uploader.</span>'; 
    }; 

    const fetchImageForUnit = async (unitName) => {
        if (!unitName || !unitName.trim()) return null;
        const formattedName = normalizeStringForFilename(unitName);
        const extensions = ['webp', 'png', 'jpg'];
        for (const ext of extensions) {
            const potentialUrl = `${imageBaseUrl}${formattedName}.${ext}`;
            try {
                const response = await fetch(potentialUrl, { method: 'HEAD', cache: 'no-cache' });
                if (response.ok) {
                    const imageResponse = await fetch(potentialUrl);
                    const blob = await imageResponse.blob();
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }
            } catch (error) { /* Ignore */ }
        }
        return null;
    };

    const updateAllMissingImages = async () => {
        const unitsToUpdate = units.filter(u => !u.image);
        if (unitsToUpdate.length === 0) {
            showToast("Toutes les unités ont déjà une image.", "info");
            return;
        }
        updateImagesBtn.disabled = true;
        showToast(`Mise à jour de ${unitsToUpdate.length} image(s) en cours...`, 'info');
        let updatedCount = 0;
        for (const unit of unitsToUpdate) {
            const imageData = await fetchImageForUnit(unit.name);
            if (imageData) {
                unit.image = imageData;
                updatedCount++;
            }
        }
        showToast(`${updatedCount} image(s) mise(s) à jour. Sauvegarde en cours...`, 'success');
        await saveDataToFirebase();
        updateImagesBtn.disabled = false;
    };
    
    const renderSkillLevel = (level) => { return '<span class="filled">●</span>'.repeat(parseInt(level, 10) || 0) + '<span class="empty">●</span>'.repeat(5 - (parseInt(level, 10) || 0)); }; 
    const renderStars = (count) => { return Array(parseInt(count, 10) || 0).fill('<i class="fa-solid fa-star"></i>').join(''); }; 
    const renderDoublons = (count) => { const num = parseInt(count, 10) || 0; return `<span style="color: hsl(${(num * 20)}, 100%, 60%); font-weight: bold; font-size: 1.5em">${'●'.repeat(num)}</span><span style="opacity:0.3;">${'●'.repeat(5 - num)}</span>`; }; 

    const displayUnits = () => { 
        const searchTerm = searchInput.value.toLowerCase(); 
        const selectedElement = filterElement.value; 
        const selectedRarity = filterRarity.value;
        let processedUnits = units.filter(unit => { 
            return (!searchTerm || unit.name.toLowerCase().includes(searchTerm)) &&
                   (!selectedElement || unit.element === selectedElement) &&
                   (!selectedRarity || unit.rarity === selectedRarity) &&
                   (!favoritesFilterActive || unit.isFavorite);
        }); 
        processedUnits.sort((a, b) => { 
            if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
            const valA = a[currentSort.column]; 
            const valB = b[currentSort.column]; 
            const direction = currentSort.direction === 'asc' ? 1 : -1; 
            return typeof valA === 'string' ? valA.localeCompare(valB) * direction : (valA - valB) * direction; 
        }); 
        renderTable(processedUnits); 
        updateSortHeaders(); 
    }; 

    const renderTable = (unitsToDisplay) => { 
        unitListBody.innerHTML = ''; 
        if (unitsToDisplay.length === 0) { unitListBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-color-muted);">Aucune unité.</td></tr>`; return; } 
        unitsToDisplay.forEach(unit => { 
            const originalIndex = units.findIndex(u => u.name === unit.name && u.level === unit.level);
            const rowFragment = unitRowTemplate.content.cloneNode(true); 
            rowFragment.querySelector('.unit-checkbox').dataset.index = originalIndex; 
            const img = rowFragment.querySelector('.unit-image-cell img'); 
            img.alt = unit.name;
            if (unit.image) {
                img.src = unit.image;
            } else {
                const formattedName = normalizeStringForFilename(unit.name);
                img.src = formattedName ? `${imageBaseUrl}${formattedName}.webp` : 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?';
                img.onerror = () => { img.src = 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?'; img.onerror = null; };
            }
            if (unit.rarity) { img.classList.add(`rarity-border-${unit.rarity.toLowerCase()}`); } 
            const nameCell = rowFragment.querySelector('.unit-name-cell'); 
            nameCell.textContent = unit.name; 
            nameCell.title = unit.name; 
            if (unit.notes && unit.notes.trim()) { 
                const noteIcon = document.createElement('span'); 
                noteIcon.className = 'unit-has-notes-icon'; 
                noteIcon.title = unit.notes; 
                noteIcon.innerHTML = '<i class="fa-solid fa-note-sticky"></i>'; 
                nameCell.appendChild(noteIcon); 
            } 
            const elementCell = rowFragment.querySelector('.unit-element-cell');
            const elementIcon = elementIconMap[unit.element];
            elementCell.innerHTML = elementIcon ? `<img src="${elementIcon}" alt="${unit.element}" class="table-icon" />` : unit.element;
            const rarityCell = rowFragment.querySelector('.unit-rarity-cell');
            rarityCell.innerHTML = unit.rarity ? `<img src="${unit.rarity.toLowerCase()}.webp" alt="${unit.rarity}" class="table-icon" />` : '';
            rowFragment.querySelector('.stars').innerHTML = renderStars(unit.stars); 
            rowFragment.querySelector('.unit-level-cell').textContent = unit.level; 
            rowFragment.querySelector('.unit-doublon-cell').innerHTML = renderDoublons(unit.doublon); 
            rowFragment.querySelector('.unit-s1-cell').innerHTML = renderSkillLevel(unit.s1); 
            rowFragment.querySelector('.unit-s2-cell').innerHTML = renderSkillLevel(unit.s2); 
            rowFragment.querySelector('.unit-s3-cell').innerHTML = renderSkillLevel(unit.s3); 
            const favoriteBtn = rowFragment.querySelector('.favorite-btn'); 
            if (unit.isFavorite) { 
                favoriteBtn.classList.add('is-favorite'); 
                favoriteBtn.innerHTML = '<i class="fa-solid fa-star"></i>'; 
                favoriteBtn.title = "Retirer des favoris"; 
            } else {
                favoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
                favoriteBtn.title = "Mettre en favori";
            }
            favoriteBtn.dataset.index = originalIndex; 
            rowFragment.querySelector('.edit-btn').dataset.index = originalIndex; 
            rowFragment.querySelector('.delete-btn').dataset.index = originalIndex; 
            unitListBody.appendChild(rowFragment); 
        }); 
    }; 

    const updateSortHeaders = () => { /* ... (logique inchangée) ... */ }; 
    function openEditModal(index) { /* ... (logique inchangée) ... */ } 
    function closeEditModal() { editModal.style.display = 'none'; } 
    const updateSelectionState = () => { /* ... (logique inchangée) ... */ }; 
    // #endregion 

    // #region --- MODULE TEAM BUILDER --- 
    const renderTeamBuilderUnitList = () => { /* ... (logique inchangée) ... */ }; 
    const updateSelectionModeUI = () => { /* ... (logique inchangée) ... */ }; 
    const renderActiveTeam = () => { /* ... (logique inchangée) ... */ }; 
    const renderTeamSelect = () => { /* ... (logique inchangée) ... */ }; 
    // #endregion 

    // #region --- MODULES DASHBOARD & IMPORT/EXPORT --- 
    const updateDashboard = () => { /* ... (logique inchangée) ... */ }; 
    // #endregion 

    // #region --- GESTION DES ÉVÉNEMENTS --- 
    showManagerBtn.addEventListener('click', () => switchView('manager'));
    showBuilderBtn.addEventListener('click', () => switchView('builder'));
    showObjectivesBtn.addEventListener('click', () => switchView('objectives'));

    addForm.addEventListener('submit', (event) => { 
        event.preventDefault(); 
        const newUnit = { name: unitNameInput.value, image: unitImageData, element: document.getElementById('unit-element').value, rarity: document.getElementById('unit-rarity').value, stars: parseInt(document.getElementById('unit-stars').value, 10), level: parseInt(document.getElementById('unit-level').value, 10), doublon: parseInt(document.getElementById('unit-doublon').value, 10), s1: parseInt(document.getElementById('unit-s1').value, 10), s2: parseInt(document.getElementById('unit-s2').value, 10), s3: parseInt(document.getElementById('unit-s3').value, 10), isFavorite: false, notes: '' }; 
        units.push(newUnit); 
        saveDataToFirebase();
        resetAddForm(); 
        showToast(`'${newUnit.name}' a été ajouté.`, 'success'); 
    }); 
    
    clearFormBtn.addEventListener('click', resetAddForm); 
    unitNameInput.addEventListener('blur', () => findUnitImage(unitNameInput.value));
    imagePlaceholder.addEventListener('click', () => imageInput.click()); 
    imageInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = (e) => { unitImageData = e.target.result; imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="Aperçu de l'unité">`; }; reader.readAsDataURL(file); } }); 
    
    unitListBody.addEventListener('click', async (event) => { 
        const button = event.target.closest('button'); 
        if (button && button.dataset.index !== undefined) { 
            const index = parseInt(button.dataset.index); 
            if(index < 0 || index >= units.length) return;

            if (button.classList.contains('favorite-btn')) { 
                units[index].isFavorite = !units[index].isFavorite; 
                saveDataToFirebase();
            } else if (button.classList.contains('edit-btn')) { 
                openEditModal(index); 
            } else if (button.classList.contains('delete-btn')) { 
                if (await showConfirm('Supprimer l\'unité', `Êtes-vous sûr de vouloir supprimer ${units[index].name} ?`)) { 
                    units.splice(index, 1); 
                    saveDataToFirebase();
                    showToast('Unité supprimée.', 'info'); 
                } 
            } 
        } 
        if (event.target.classList.contains('unit-checkbox')) { 
            updateSelectionState(); 
        } 
    }); 
    
    searchInput.addEventListener('input', displayUnits); 
    filterElement.addEventListener('change', displayUnits); 
    filterRarity.addEventListener('change', displayUnits);
    filterFavoritesBtn.addEventListener('click', () => { favoritesFilterActive = !favoritesFilterActive; filterFavoritesBtn.classList.toggle('active', favoritesFilterActive); displayUnits(); }); 
    updateImagesBtn.addEventListener('click', updateAllMissingImages);
    table.querySelector('thead').addEventListener('click', (event) => { const header = event.target.closest('th'); if (!header || !header.classList.contains('sortable')) return; const sortKey = header.dataset.sort; if (currentSort.column === sortKey) { currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc'; } else { currentSort.column = sortKey; currentSort.direction = 'asc'; } displayUnits(); }); 
    selectAllCheckbox.addEventListener('change', () => { document.querySelectorAll('.unit-checkbox').forEach(checkbox => { checkbox.checked = selectAllCheckbox.checked; }); updateSelectionState(); }); 
    
    deleteSelectedBtn.addEventListener('click', async () => { 
        const selectedIndices = Array.from(document.querySelectorAll('.unit-checkbox:checked')).map(cb => parseInt(cb.dataset.index));
        if (selectedIndices.length === 0) return;
        if (await showConfirm('Suppression en masse', `Êtes-vous sûr de vouloir supprimer ${selectedIndices.length} unité(s) ?`)) {
            const newUnits = units.filter((_, index) => !selectedIndices.includes(index));
            units = newUnits;
            saveDataToFirebase();
            showToast(`${selectedIndices.length} unité(s) supprimée(s).`, 'success');
        }
    }); 
    
    editForm.addEventListener('submit', (event) => { 
        event.preventDefault(); 
        const index = parseInt(document.getElementById('edit-unit-index').value); 
        units[index] = { ...units[index], name: document.getElementById('edit-unit-name').value, element: document.getElementById('edit-unit-element').value, rarity: document.getElementById('edit-unit-rarity').value, stars: parseInt(document.getElementById('edit-unit-stars').value, 10), level: parseInt(document.getElementById('edit-unit-level').value, 10), doublon: parseInt(document.getElementById('edit-unit-doublon').value, 10), s1: parseInt(document.getElementById('edit-unit-s1').value, 10), s2: parseInt(document.getElementById('edit-unit-s2').value, 10), s3: parseInt(document.getElementById('edit-unit-s3').value, 10), notes: document.getElementById('edit-unit-notes').value }; 
        saveDataToFirebase();
        closeEditModal(); 
        showToast('Modifications enregistrées.', 'success'); 
    }); 

    closeModalBtn.addEventListener('click', closeEditModal); 
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); }); 
    
    exportBtn.addEventListener('click', () => { 
        if (units.length === 0 && teams.length === 0 && manualObjectives.length === 0) { 
            showToast("Il n'y a aucune donnée à exporter.", 'info'); 
            return; 
        } 
        const backupData = { units, teams, manualObjectives, dailyRoutine }; 
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
                if (await showConfirm('Importer et écraser les données en ligne ?', "Cette action est irréversible.")) { 
                    units = importedData.units || []; 
                    teams = importedData.teams || []; 
                    manualObjectives = importedData.manualObjectives || []; 
                    dailyRoutine = importedData.dailyRoutine || {}; 
                    await saveDataToFirebase();
                    showToast("Importation et synchronisation réussies !", 'success'); 
                } 
            } catch (error) { showToast("Fichier invalide.", 'error'); } 
            finally { importInput.value = ''; } 
        }; 
        reader.readAsText(file); 
    }); 
    
    importCsvInput.addEventListener('change', (event) => { /* ... */ saveDataToFirebase(); /* ... */ }); 
    
    teamBuilderUnitList.addEventListener('dragstart', (e) => { if(e.target.tagName === 'IMG') e.dataTransfer.setData('text/plain', e.target.dataset.unitIndex); }); 
    teamSlotsContainer.addEventListener('dragover', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if (slot) slot.classList.add('drag-over'); }); 
    teamSlotsContainer.addEventListener('dragleave', (e) => { const slot = e.target.closest('.team-slot'); if (slot) slot.classList.remove('drag-over'); }); 
    teamSlotsContainer.addEventListener('drop', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if(slot) { slot.classList.remove('drag-over'); const unitIndex = e.dataTransfer.getData('text/plain'); const slotIndex = slot.dataset.slotIndex; teams[activeTeamIndex].units[slotIndex] = units[unitIndex]; saveDataToFirebase(); }}); 
    teamSlotsContainer.addEventListener('click', (e) => { const target = e.target; const slot = target.closest('.team-slot'); if (target.classList.contains('remove-from-team-btn')) { const slotIndex = target.dataset.slotIndex; teams[activeTeamIndex].units[slotIndex] = null; saveDataToFirebase(); } else if (slot) { const clickedSlotIndex = parseInt(slot.dataset.slotIndex); if (selectionModeSlotIndex === clickedSlotIndex) { selectionModeSlotIndex = null; } else { selectionModeSlotIndex = clickedSlotIndex; } updateSelectionModeUI(); }}); 
    teamBuilderUnitList.addEventListener('click', (e) => { if (e.target.tagName === 'IMG' && selectionModeSlotIndex !== null) { const unitIndex = e.target.dataset.unitIndex; teams[activeTeamIndex].units[selectionModeSlotIndex] = units[unitIndex]; saveDataToFirebase(); selectionModeSlotIndex = null; updateSelectionModeUI(); }}); 
    teamSelect.addEventListener('change', () => { activeTeamIndex = parseInt(teamSelect.value); renderActiveTeam(); }); 
    saveTeamBtn.addEventListener('click', () => { const newName = teamNameInput.value.trim(); if (newName) { teams[activeTeamIndex].name = newName; saveDataToFirebase(); renderTeamSelect(); showToast('Nom de l\'équipe sauvegardé !', 'success'); } else { showToast('Veuillez donner un nom à votre équipe.', 'info'); }}); 
    newTeamBtn.addEventListener('click', () => { teams.push({ name: 'Nouvelle Équipe', units: [null, null, null, null, null], notes: '' }); activeTeamIndex = teams.length - 1; saveDataToFirebase(); }); 
    deleteTeamBtn.addEventListener('click', async () => { if(teams.length <= 1) { showToast("Vous ne pouvez pas supprimer votre dernière équipe.", 'info'); return; } if(await showConfirm('Supprimer l\'équipe', `...`)) { teams.splice(activeTeamIndex, 1); activeTeamIndex = 0; saveDataToFirebase(); showToast('Équipe supprimée.', 'success'); }}); 
    teamNotesTextarea.addEventListener('input', () => { if(teams[activeTeamIndex]) { teams[activeTeamIndex].notes = teamNotesTextarea.value; saveDataToFirebase(); }}); 
    
    addObjectiveForm.addEventListener('submit', (e) => { e.preventDefault(); const text = newObjectiveInput.value.trim(); if (text) { manualObjectives.push({ id: Date.now(), text: text, completed: false }); saveDataToFirebase(); newObjectiveInput.value = ''; showToast("Objectif ajouté !", 'success'); } }); 
    objectivesListContainer.addEventListener('click', (e) => { const li = e.target.closest('.objective-item'); if (!li) return; const objectiveId = Number(li.dataset.id); const objective = manualObjectives.find(obj => obj.id === objectiveId); if (e.target.classList.contains('objective-checkbox')) { if(objective) objective.completed = e.target.checked; } if (e.target.closest('.delete-objective-btn')) { manualObjectives = manualObjectives.filter(obj => obj.id !== objectiveId); showToast("Objectif supprimé.", 'info'); } saveDataToFirebase(); }); 
    
    routineTrackerContent.addEventListener('click', (e) => { const item = e.target.closest('.routine-item'); if (!item) return; const taskName = item.dataset.taskName; const taskDef = ROUTINE_DEFINITION.find(t => t.name === taskName); if (!taskDef) return; const taskState = dailyRoutine.tasks[taskName]; const currentGameDay = getGameDay(); if (taskDef.type === 'checkbox') { taskState.completedOn = e.target.checked ? currentGameDay : null; } else if (taskDef.type === 'counter') { let count = taskState.count || 0; if (e.target.dataset.action === 'plus') count = Math.min(taskDef.max, count + 1); else if (e.target.dataset.action === 'minus') count = Math.max(0, count - 1); taskState.count = count; taskState.updatedOn = currentGameDay; } saveDataToFirebase(); }); 
    // #endregion 

    // #region --- INITIALISATION --- 
    const fullAppRefresh = () => { 
        const activeViewId = document.querySelector('.view.active')?.id;
        const activeView = activeViewId ? activeViewId.replace('-view', '') : 'manager';
        refreshUI(); 
        renderTeamSelect(); 
        renderActiveTeam(); 
        renderManualObjectives();
        switchView(activeView);
    }; 

    const refreshUI = () => { 
        checkRoutineReset();
        renderRoutineTracker(); 
        displayUnits(); 
        updateDashboard(); 
        updateSelectionState(); 
    }; 
    
    switchView('manager'); 
    // #endregion 
});