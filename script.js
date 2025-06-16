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
        const cleanUnits = units.map(u => ({...u, image: u.image || null}));
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
    const ROUTINE_DEFINITION = [ /* ... */ ]; 
    const getGameDay = (date = new Date()) => { /* ... */ }; 
    const checkRoutineReset = () => { /* ... */ }; 
    const renderRoutineTracker = () => { /* ... */ }; 
    // #endregion 

    // #region --- NAVIGATION PRINCIPALE --- 
    const switchView = (viewToShow) => { /* ... */ }; 
    // #endregion 
    
    // #region --- MODULE GESTIONNAIRE D'OBJECTIFS --- 
    const addObjectiveForm = document.getElementById('add-objective-form');
    const renderManualObjectives = () => { /* ... */ }; 
    // #endregion 

    // #region --- MODULE GESTIONNAIRE D'UNITÉS --- 
    const elementIconMap = {
        'Rouge': 'reason.webp',
        'Bleu': 'odd.webp',
        'Vert': 'hollow.webp',
        'Dark': 'disorder.webp',
        'Light': 'constant.webp'
    };

    function normalizeStringForFilename(str) {
        if (!str) return '';
        return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ /g, '');
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
    
    const renderSkillLevel = (level) => { /* ... */ }; 
    const renderStars = (count) => { /* ... */ }; 
    const renderDoublons = (count) => { /* ... */ }; 

    const displayUnits = () => { 
        // ... (Logique de filtrage et tri inchangée)
        renderTable(processedUnits); 
        updateSortHeaders(); 
    }; 

    const renderTable = (unitsToDisplay) => { 
        unitListBody.innerHTML = ''; 
        if (unitsToDisplay.length === 0) { /* ... */ return; } 
        unitsToDisplay.forEach(unit => { 
            // ... (création de la ligne)
            const img = rowFragment.querySelector('.unit-image-cell img');
            if (unit.image) {
                img.src = unit.image;
            } else {
                const formattedName = normalizeStringForFilename(unit.name);
                img.src = formattedName ? `${imageBaseUrl}${formattedName}.webp` : 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?';
                img.onerror = () => { img.src = 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?'; img.onerror = null; };
            }
            // ... (le reste du remplissage de la ligne avec les icônes)
        }); 
    }; 

    const updateSortHeaders = () => { /* ... */ }; 
    function openEditModal(index) { /* ... */ } 
    function closeEditModal() { /* ... */ } 
    const updateSelectionState = () => { /* ... */ }; 
    // #endregion 

    // #region --- MODULE TEAM BUILDER --- 
    // ... (toute la logique du team builder reste identique)
    // #endregion 

    // #region --- MODULES DASHBOARD & IMPORT/EXPORT --- 
    const updateDashboard = () => { /* ... */ }; 
    // #endregion 

    // #region --- GESTION DES ÉVÉNEMENTS --- 
    addForm.addEventListener('submit', async (event) => { 
        event.preventDefault(); 
        const newUnit = { /* ... */ }; 
        units.push(newUnit); 
        await saveDataToFirebase(); 
        resetAddForm(); 
        showToast(`'${newUnit.name}' a été ajouté.`, 'success'); 
    }); 
    
    clearFormBtn.addEventListener('click', resetAddForm); 

    unitNameInput.addEventListener('blur', () => findUnitImage(unitNameInput.value));
    
    // ... (tous les autres listeners, en remplaçant les `save...()` par `saveDataToFirebase()`)
    // #endregion 

    // #region --- INITIALISATION --- 
    const fullAppRefresh = () => { 
        const activeView = document.querySelector('.view.active')?.id.replace('-view','');
        refreshUI(); 
        renderTeamSelect(); 
        renderActiveTeam(); 
        if(activeView) switchView(activeView);
    }; 

    const refreshUI = () => { 
        renderRoutineTracker(); 
        displayUnits(); 
        updateDashboard(); 
        updateSelectionState(); 
    }; 
    
    switchView('manager'); 
    // #endregion 
});