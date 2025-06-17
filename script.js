import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    onSnapshot, 
    addDoc, 
    deleteDoc, 
    doc, 
    updateDoc,
    writeBatch,
    getDocs,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously,
    signInWithCustomToken 
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";


document.addEventListener('DOMContentLoaded', () => { 

    // #region --- CONFIGURATION FIREBASE ---
    // Ces variables sont fournies par l'environnement d'exécution
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'etheria-manager-local';
    const firebaseConfig =  {
        apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
        authDomain: "etheria-manager.firebaseapp.com",
        projectId: "etheria-manager",
        storageBucket: "etheria-manager.firebasestorage.app", // Corrigé pour correspondre à la configuration d'origine
        messagingSenderId: "247321381553",
        appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
    };

    // Initialisation Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    let userId = null;
    let dbReady = false;

    // Références aux collections
    let unitsCollection, teamsCollection, objectivesCollection, routineDoc;

    const authStatus = document.getElementById('auth-status');
    const userIdDisplay = document.getElementById('user-id-display');

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Utilisateur connecté:", userId);
            authStatus.textContent = 'Connecté';
            userIdDisplay.textContent = `UID: ${userId.substring(0, 8)}...`;
            
            // Définir les chemins des collections une fois l'UID connu
            unitsCollection = collection(db, `artifacts/${appId}/users/${userId}/units`);
            teamsCollection = collection(db, `artifacts/${appId}/users/${userId}/teams`);
            objectivesCollection = collection(db, `artifacts/${appId}/users/${userId}/objectives`);
            routineDoc = doc(db, `artifacts/${appId}/users/${userId}/data/dailyRoutine`);

            dbReady = true;
            initializeAppLogic(); // Lancer la logique de l'appli
        } else {
            console.log("Aucun utilisateur connecté, tentative de connexion anonyme.");
            authStatus.textContent = 'Connexion...';
            try {
                 if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Erreur de connexion anonyme:", error);
                authStatus.textContent = 'Échec de la connexion';
            }
        }
    });
    
    // Rendre la copie de l'ID plus robuste
    userIdDisplay.addEventListener('click', () => {
        if(userId) {
            const textArea = document.createElement("textarea");
            textArea.value = userId;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showToast("User ID copié dans le presse-papiers!", 'success');
            } catch (err) {
                showToast("Erreur lors de la copie de l'ID", 'error');
            }
            document.body.removeChild(textArea);
        }
    });

    // #endregion

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
    
    // Le thème est toujours stocké localement, pas besoin de le synchroniser
    const savedTheme = localStorage.getItem('etheriaTheme') || 'dark'; 
    applyTheme(savedTheme); 

    themeToggleBtn.addEventListener('click', () => { 
        const isLight = document.body.classList.contains('light-theme'); 
        const newTheme = isLight ? 'dark' : 'light'; 
        localStorage.setItem('etheriaTheme', newTheme); 
        applyTheme(newTheme); 
    }); 

    // #region --- MODULES UTILITAIRES (Notifications, Confirmations, Debounce) --- 
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
    
    // Fonction Debounce pour éviter les écritures excessives dans la DB
    function debounce(func, timeout = 800){
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
      };
    }
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

    // #region --- ÉTAT DE L'APPLICATION (State) --- 
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
        if (!dbReady) return;
        const currentGameDay = getGameDay();
        let needsUpdate = false;
        let routineData = { ...dailyRoutine }; // Copie locale

        if (!routineData.tasks) {
            routineData.tasks = {};
            needsUpdate = true;
        }

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            let taskState = routineData.tasks[taskName];

            if (!taskState) {
                 if (taskDef.type === 'checkbox') {
                    routineData.tasks[taskName] = { completedOn: null };
                } else if (taskDef.type === 'counter') {
                    routineData.tasks[taskName] = { count: 0, updatedOn: null };
                }
                needsUpdate = true;
                return;
            }

            if (taskDef.type === 'checkbox') {
                if (taskState.completedOn && taskState.completedOn !== currentGameDay) {
                    taskState.completedOn = null;
                    needsUpdate = true;
                }
            } else if (taskDef.type === 'counter') {
                if (taskState.updatedOn && taskState.updatedOn !== currentGameDay) {
                    taskState.count = 0;
                    taskState.updatedOn = null;
                    needsUpdate = true;
                }
            }
        });

        if (needsUpdate) {
            await setDoc(routineDoc, routineData, { merge: true });
        }
    };

    const renderRoutineTracker = () => { 
        routineTrackerContent.innerHTML = ''; 
        const currentGameDay = getGameDay(); 

        ROUTINE_DEFINITION.forEach(taskDef => { 
            const taskName = taskDef.name; 
            const taskState = dailyRoutine.tasks ? dailyRoutine.tasks[taskName] : null; 
            const item = document.createElement('div'); 
            item.className = 'routine-item'; 
            item.dataset.taskName = taskName; 
            item.dataset.taskType = taskDef.type; 

            if (!taskState) return;

            if (taskDef.type === 'checkbox') { 
                const isCompleted = taskState.completedOn === currentGameDay; 
                if (isCompleted) item.classList.add('completed'); 
                item.innerHTML = ` 
                    <label> 
                        <input type="checkbox" ${isCompleted ? 'checked' : ''}> 
                        <span>${taskName}</span> 
                    </label> 
                `; 
            } else if (taskDef.type === 'counter') { 
                  const count = taskState.count || 0; 
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
        imagePlaceholder.innerHTML = '<span>Cliquez pour ajouter une image</span>'; 
        imageInput.value = ''; 
        unitNameInput.focus(); 
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

    const findUnitImage = async (unitName) => { 
        if (!unitName || !unitName.trim()) return;
        
        const formattedName = unitName.trim().replace(/ /g, '_').toLowerCase();
        const extensions = ['webp', 'png', 'jpg', 'jpeg', 'gif']; 
        let foundImageUrl = null; 
        
        imagePlaceholder.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin"></i> Recherche...</span>'; 
        
        for (const ext of extensions) { 
            const potentialUrl = `${imageBaseUrl}${formattedName}.${ext}`; 
            try { 
                const response = await fetch(potentialUrl, { method: 'HEAD', cache: 'no-cache' }); 
                if (response.ok) { 
                    foundImageUrl = potentialUrl; 
                    break; 
                } 
            } catch (error) { /* Ignore */ } 
        } 

        if (foundImageUrl) { 
            const response = await fetch(foundImageUrl); 
            const blob = await response.blob(); 
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                unitImageData = e.target.result; 
                imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="${unitName}">`; 
            }; 
            reader.readAsDataURL(blob); 
        } else { 
            unitImageData = null; 
            imagePlaceholder.innerHTML = '<span>Image non trouvée.<br>Cliquez pour uploader.</span>'; 
        } 
    }; 
    
    const fetchImageForUnit = async (unitName) => {
        if (!unitName || !unitName.trim()) return null;
        const formattedName = unitName.trim().replace(/ /g, '_').toLowerCase();
        const extensions = ['webp', 'png', 'jpg', 'jpeg', 'gif'];
        
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

        const batch = writeBatch(db);
        let updatedCount = 0;
        for (const unit of unitsToUpdate) {
            const imageData = await fetchImageForUnit(unit.name);
            if (imageData) {
                const unitRef = doc(unitsCollection, unit.id);
                batch.update(unitRef, { image: imageData });
                updatedCount++;
            }
        }
        
        await batch.commit();
        
        updateImagesBtn.disabled = false;
        showToast(`${updatedCount} image(s) mise(s) à jour avec succès !`, 'success');
    };

    const renderSkillLevel = (level) => { 
        const numericLevel = parseInt(level, 10) || 0; 
        return '<span class="filled">●</span>'.repeat(numericLevel) + '<span class="empty">●</span>'.repeat(5 - numericLevel); 
    }; 

    const renderStars = (count) => { 
        const numericCount = parseInt(count, 10) || 0; 
        return Array(numericCount).fill('<i class="fa-solid fa-star"></i>').join(''); 
    }; 

    const renderDoublons = (count) => { 
        const numericCount = parseInt(count, 10) || 0; 
        return `<span style="color: hsl(${(numericCount * 20)}, 100%, 60%); font-weight: bold; font-size: 1.5em">${'●'.repeat(numericCount)}</span><span style="opacity:0.3;">${'●'.repeat(5 - numericCount)}</span>`; 
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
            row.dataset.id = unit.id;
            
            rowFragment.querySelector('.unit-checkbox').dataset.id = unit.id; 
            const img = rowFragment.querySelector('.unit-image-cell img'); 
            img.alt = unit.name;

            if (unit.image) {
                img.src = unit.image;
            } else {
                const formattedName = unit.name.trim().replace(/ /g, '_').toLowerCase();
                if (formattedName) {
                    img.src = `${imageBaseUrl}${formattedName}.webp`;
                } else {
                    img.src = 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?';
                }
                
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
                favoriteBtn.classList.remove('is-favorite'); 
                favoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>'; 
                favoriteBtn.title = "Mettre en favori"; 
            } 

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

    function openEditModal(unitId) { 
        const unit = units.find(u => u.id === unitId); 
        if (!unit) return;
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
    }; 
    // #endregion 

    // #region --- MODULE TEAM BUILDER --- 
    const renderTeamBuilderUnitList = () => { 
        teamBuilderUnitList.innerHTML = ''; 
        units.forEach(unit => { 
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
        const activeTeam = teams.find(t => t.id === activeTeamId);

        if (!activeTeam) {
            teamNameInput.value = '';
            teamNotesTextarea.value = '';
            // Afficher des slots vides
            for (let i = 0; i < 5; i++) {
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
        const currentTeamUnitIds = activeTeam.units;

        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.classList.add('team-slot');
            slot.dataset.slotIndex = i;

            const unitId = currentTeamUnitIds[i];
            const unit = units.find(u => u.id === unitId); // Correction de la race condition ici

            if (unit) {
                slot.innerHTML = ` 
                    <img src="${unit.image || `https://via.placeholder.com/100x100/304065/e0e0e0?text=?`}" title="${unit.name}"> 
                    <button class="remove-from-team-btn" data-slot-index="${i}">&times;</button> 
                `;
            } else {
                slot.innerText = `Slot ${i + 1}`;
            }
            teamSlotsContainer.appendChild(slot);
        }
        updateSelectionModeUI();
    };

    const renderTeamSelect = async () => {
        teamSelect.innerHTML = '';
        if (teams.length === 0 && dbReady) {
            // Uniquement si on a la confirmation de la DB qu'il n'y a rien
            const newTeam = { name: 'Mon Équipe', units: [null, null, null, null, null], notes: '' };
            const docRef = await addDoc(teamsCollection, newTeam);
            // activeTeamId = docRef.id; // onSnapshot mettra à jour l'UI
            return;
        }

        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            teamSelect.appendChild(option);
        });

        if (activeTeamId && teams.some(t => t.id === activeTeamId)) {
            teamSelect.value = activeTeamId;
        } else if (teams.length > 0) {
            activeTeamId = teams[0].id;
            teamSelect.value = activeTeamId;
        }
        renderActiveTeam();
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
        if (!dbReady) {
            showToast("La base de données n'est pas prête.", "error");
            return;
        }
        const newUnit = { 
            name: document.getElementById('unit-name').value, 
            image: unitImageData, 
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
            await addDoc(unitsCollection, newUnit);
            resetAddForm(); 
            showToast(`'${newUnit.name}' a été ajouté.`, 'success'); 
        } catch (error) {
            console.error("Erreur d'ajout de l'unité: ", error);
            showToast("Erreur lors de l'ajout de l'unité.", "error");
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
            const reader = new FileReader(); 
            reader.onload = (e) => { 
                unitImageData = e.target.result; 
                imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="Aperçu de l'unité">`; 
            }; 
            reader.readAsDataURL(file); 
        } 
    }); 

    // Tableau des unités (Actions, Filtres, Tri, Sélection) 
    unitListBody.addEventListener('click', async (event) => { 
        if (!dbReady) return;

        const button = event.target.closest('button'); 
        const row = event.target.closest('tr');
        const unitId = row ? row.dataset.id : null;
        const unit = unitId ? units.find(u => u.id === unitId) : null;
        
        if (button && unit) { 
            const unitRef = doc(unitsCollection, unit.id);

            if (button.classList.contains('favorite-btn')) { 
                await updateDoc(unitRef, { isFavorite: !unit.isFavorite });
            } else if (button.classList.contains('edit-btn')) { 
                openEditModal(unit.id); 
            } else if (button.classList.contains('delete-btn')) { 
                if (await showConfirm('Supprimer l\'unité', `Êtes-vous sûr de vouloir supprimer ${unit.name} ?`)) { 
                    await deleteDoc(unitRef);
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
    
    filterFavoritesBtn.addEventListener('click', () => { 
        favoritesFilterActive = !favoritesFilterActive; 
        filterFavoritesBtn.classList.toggle('active', favoritesFilterActive); 
        displayUnits(); 
    }); 

    updateImagesBtn.addEventListener('click', updateAllMissingImages);

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
        if(await showConfirm('Suppression en masse', `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} unité(s) ?`)) { 
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(unitsCollection, id));
            });
            await batch.commit();
            showToast(`${selectedIds.length} unité(s) supprimée(s).`, 'success'); 
        } 
    }); 

    // Modale d'édition 
    editForm.addEventListener('submit', async (event) => { 
        event.preventDefault(); 
        const unitId = document.getElementById('edit-unit-id').value;
        if (!unitId) return;

        const updatedData = { 
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
        
        await updateDoc(doc(unitsCollection, unitId), updatedData);
        closeEditModal(); 
        showToast('Modifications enregistrées.', 'success'); 
    }); 
    closeModalBtn.addEventListener('click', closeEditModal); 
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); }); 

    // Import / Export 
    exportBtn.addEventListener('click', () => { 
        if (units.length === 0 && teams.length === 0 && manualObjectives.length === 0) { 
            showToast("Il n'y a aucune donnée à exporter.", 'info'); 
            return; 
        } 
        // L'exportation n'exporte que les données locales actuelles
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
                if (await showConfirm('Importer un fichier JSON', "Voulez-vous vraiment remplacer vos données par celles importées ? Cette action est irréversible.")) { 
                    
                    const batch = writeBatch(db);

                    // Supprimer anciennes données
                    const oldUnits = await getDocs(unitsCollection);
                    oldUnits.forEach(doc => batch.delete(doc.ref));
                    const oldTeams = await getDocs(teamsCollection);
                    oldTeams.forEach(doc => batch.delete(doc.ref));
                    const oldObjectives = await getDocs(objectivesCollection);
                    oldObjectives.forEach(doc => batch.delete(doc.ref));
                    
                    // Ajouter nouvelles données
                    (importedData.units || []).forEach(unit => {
                        const newUnitRef = doc(unitsCollection); // Crée un doc avec un ID auto
                        batch.set(newUnitRef, unit);
                    });
                    (importedData.teams || []).forEach(team => {
                        const newTeamRef = doc(teamsCollection);
                        batch.set(newTeamRef, team);
                    });
                    (importedData.manualObjectives || []).forEach(obj => {
                        const newObjRef = doc(objectivesCollection);
                        batch.set(newObjRef, obj);
                    });
                    if (importedData.dailyRoutine) {
                         batch.set(routineDoc, importedData.dailyRoutine, { merge: true });
                    }
                    
                    await batch.commit();
                    showToast("Importation complète réussie !", 'success'); 
                } 
            } catch (error) { 
                showToast("Erreur : Le fichier est invalide ou corrompu.", 'error'); 
                console.error("Import error:", error);
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
                
                const batch = writeBatch(db);

                dataLines.forEach(line => { 
                    const columns = line.split(delimiter); 
                    if (columns.length < 9) return;  

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
                        const unitRef = doc(unitsCollection, existingUnit.id);
                        batch.update(unitRef, unitData);
                        updatedCount++; 
                    } else { 
                        const newUnitRef = doc(unitsCollection);
                        batch.set(newUnitRef, unitData);
                        addedCount++; 
                    } 
                }); 
                
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

    // Team Builder 
    teamBuilderUnitList.addEventListener('dragstart', (e) => { if(e.target.tagName === 'IMG') e.dataTransfer.setData('text/plain', e.target.dataset.unitId); }); 
    teamSlotsContainer.addEventListener('dragover', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if (slot) slot.classList.add('drag-over'); }); 
    teamSlotsContainer.addEventListener('dragleave', (e) => { const slot = e.target.closest('.team-slot'); if (slot) slot.classList.remove('drag-over'); }); 
    teamSlotsContainer.addEventListener('drop', async (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if(slot) { slot.classList.remove('drag-over'); const unitId = e.dataTransfer.getData('text/plain'); const slotIndex = slot.dataset.slotIndex; const activeTeam = teams.find(t => t.id === activeTeamId); if (activeTeam) { activeTeam.units[slotIndex] = unitId; await updateDoc(doc(teamsCollection, activeTeamId), { units: activeTeam.units }); } }}); 
    teamSlotsContainer.addEventListener('click', async (e) => { const target = e.target; const slot = target.closest('.team-slot'); const activeTeam = teams.find(t => t.id === activeTeamId); if (!activeTeam) return; if (target.classList.contains('remove-from-team-btn')) { const slotIndex = target.dataset.slotIndex; activeTeam.units[slotIndex] = null; await updateDoc(doc(teamsCollection, activeTeamId), { units: activeTeam.units }); selectionModeSlotIndex = null; updateSelectionModeUI(); } else if (slot) { const clickedSlotIndex = parseInt(slot.dataset.slotIndex); if (selectionModeSlotIndex === clickedSlotIndex) { selectionModeSlotIndex = null; } else { selectionModeSlotIndex = clickedSlotIndex; } updateSelectionModeUI(); }}); 
    teamBuilderUnitList.addEventListener('click', async (e) => { const activeTeam = teams.find(t => t.id === activeTeamId); if (e.target.tagName === 'IMG' && selectionModeSlotIndex !== null && activeTeam) { const unitId = e.target.dataset.unitId; activeTeam.units[selectionModeSlotIndex] = unitId; await updateDoc(doc(teamsCollection, activeTeamId), { units: activeTeam.units }); selectionModeSlotIndex = null; updateSelectionModeUI(); }}); 
    teamSelect.addEventListener('change', () => { activeTeamId = teamSelect.value; renderActiveTeam(); }); 
    saveTeamBtn.addEventListener('click', async () => { const newName = teamNameInput.value.trim(); if (newName && activeTeamId) { await updateDoc(doc(teamsCollection, activeTeamId), { name: newName }); showToast('Nom de l\'équipe sauvegardé !', 'success'); } else { showToast('Veuillez donner un nom à votre équipe.', 'info'); }}); 
    newTeamBtn.addEventListener('click', async () => { await addDoc(teamsCollection, { name: 'Nouvelle Équipe', units: [null, null, null, null, null], notes: '' }); }); 
    deleteTeamBtn.addEventListener('click', async () => { if(teams.length <= 1) { showToast("Vous ne pouvez pas supprimer votre dernière équipe.", 'info'); return; } const activeTeam = teams.find(t => t.id === activeTeamId); if(activeTeam && await showConfirm('Supprimer l\'équipe', `Êtes-vous sûr de vouloir supprimer l'équipe "${activeTeam.name}" ?`)) { await deleteDoc(doc(teamsCollection, activeTeamId)); showToast('Équipe supprimée.', 'success'); }}); 
    
    const saveTeamNotes = debounce(async () => {
        if (activeTeamId) { 
            const activeTeam = teams.find(t => t.id === activeTeamId);
            if(activeTeam && activeTeam.notes !== teamNotesTextarea.value) {
                await updateDoc(doc(teamsCollection, activeTeamId), { notes: teamNotesTextarea.value });
            }
        } 
    });
    teamNotesTextarea.addEventListener('input', saveTeamNotes);

    // Objectifs (To-Do List) 
    addObjectiveForm.addEventListener('submit', async (e) => { 
        e.preventDefault(); 
        const text = newObjectiveInput.value.trim(); 
        if (text) { 
            await addDoc(objectivesCollection, { text: text, completed: false });
            newObjectiveInput.value = ''; 
            showToast("Objectif ajouté !", 'success'); 
        } 
    }); 
    objectivesListContainer.addEventListener('click', async (e) => { 
        const target = e.target; 
        const li = target.closest('.objective-item'); 
        if (!li) return; 
        const objectiveId = li.dataset.id;
        const objectiveRef = doc(objectivesCollection, objectiveId);
        
        if (target.classList.contains('objective-checkbox')) { 
            const objective = manualObjectives.find(obj => obj.id === objectiveId); 
            if (objective) { 
                await updateDoc(objectiveRef, { completed: target.checked });
            } 
        } 
        if (target.closest('.delete-objective-btn')) { 
            await deleteDoc(objectiveRef);
            showToast("Objectif supprimé.", 'info'); 
        } 
    }); 

    // Gestionnaire d'événements pour le tracker de routine 
    routineTrackerContent.addEventListener('click', async (e) => { 
        const item = e.target.closest('.routine-item'); 
        if (!item) return; 

        const taskName = item.dataset.taskName; 
        const taskType = item.dataset.taskType; 
        const taskDef = ROUTINE_DEFINITION.find(t => t.name === taskName); 
        if (!taskDef) return; 

        const taskState = dailyRoutine.tasks[taskName]; 
        const currentGameDay = getGameDay(); 
        let updatedTaskState = {...taskState};

        if (taskType === 'checkbox') { 
            const checkbox = item.querySelector('input[type="checkbox"]'); 
            updatedTaskState.completedOn = checkbox.checked ? currentGameDay : null; 
        } else if (taskType === 'counter') { 
            const action = e.target.dataset.action; 
            let count = updatedTaskState.count || 0; 
            if (action === 'plus') { 
                count = Math.min(taskDef.max, count + 1); 
            } else if (action === 'minus') { 
                count = Math.max(0, count - 1); 
            } 
            updatedTaskState.count = count; 
            updatedTaskState.updatedOn = currentGameDay; 
        } 
        
        const update = {};
        update[`tasks.${taskName}`] = updatedTaskState;
        await setDoc(routineDoc, update, { merge: true });
    }); 

    // #endregion 

    // #region --- INITIALISATION DE L'APPLICATION --- 
    function initializeAppLogic() {
        if (!dbReady) return;

        onSnapshot(unitsCollection, (snapshot) => {
            units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI();
            renderTeamBuilderUnitList();
            // ** CORRECTION CRITIQUE **
            // Re-render l'équipe active quand les unités changent pour résoudre la race condition
            renderActiveTeam(); 
        });

        onSnapshot(teamsCollection, (snapshot) => {
            let justCreatedFirstTeam = teams.length === 0 && snapshot.docs.length > 0;
            teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Logique pour sélectionner l'équipe active
            if (justCreatedFirstTeam) {
                 activeTeamId = teams[0].id;
            } else if (!activeTeamId || !teams.some(t => t.id === activeTeamId)) {
                activeTeamId = teams.length > 0 ? teams[0].id : null;
            }
            
            renderTeamSelect();
        });

        onSnapshot(objectivesCollection, (snapshot) => {
            manualObjectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderManualObjectives();
        });

        onSnapshot(routineDoc, (doc) => {
            dailyRoutine = doc.exists() ? doc.data() : {};
            checkRoutineReset().then(renderRoutineTracker);
        });
        
        switchView('manager'); 
    }
    
    const refreshUI = () => { 
        displayUnits(); 
        updateDashboard(); 
        updateSelectionState(); 
    }; 
    // #endregion 
});
