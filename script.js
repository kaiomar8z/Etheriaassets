// Importations modulaires de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, setDoc, addDoc, onSnapshot, query, writeBatch, deleteDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

    // --- Initialisation de Firebase ---
    // Les variables __app_id, __firebase_config, et __initial_auth_token
    // sont injectées par l'environnement d'exécution si disponibles.
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'etheria-manager-app';
    const firebaseConfig = {
        apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
        authDomain: "etheria-manager.firebaseapp.com",
        projectId: "etheria-manager",
        storageBucket: "etheria-manager.appspot.com", // Correction du nom du bucket
        messagingSenderId: "247321381553",
        appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
    };

    // Initialiser l'application Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    let userId = null; // L'ID utilisateur sera défini après l'authentification

    // Références aux collections Firestore
    let unitsCollection, teamsCollection, objectivesCollection, settingsDoc;

    const loadingOverlay = document.getElementById('loading-overlay');

    // #region --- GESTION DU THÈME ---
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

    const saveThemePreference = async (theme) => {
        if (!userId) return; // Ne pas sauvegarder si l'utilisateur n'est pas connecté
        try {
            await setDoc(settingsDoc, { theme: theme }, { merge: true });
        } catch (error) {
            console.error("Erreur de sauvegarde du thème:", error);
            showToast("Impossible de sauvegarder le thème.", "error");
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        const newTheme = isLight ? 'dark' : 'light';
        applyTheme(newTheme);
        saveThemePreference(newTheme);
    });
    // #endregion

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

    // #region --- ÉTAT DE L'APPLICATION (State) - Données locales --- 
    // Remplacé par Firestore, mais on garde des copies locales pour le rendu UI
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

    // #region --- AUTHENTIFICATION ET INITIALISATION DES DONNÉES ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Utilisateur connecté (anonymement ou non)
            userId = user.uid;
            console.log("Utilisateur connecté avec UID:", userId);

            // Définir les chemins de la base de données pour cet utilisateur
            const userDocPath = `/artifacts/${appId}/users/${userId}`;
            unitsCollection = collection(db, `${userDocPath}/units`);
            teamsCollection = collection(db, `${userDocPath}/teams`);
            objectivesCollection = collection(db, `${userDocPath}/objectives`);
            settingsDoc = doc(db, `${userDocPath}/settings/doc`);

            // Commencer à écouter les changements de données
            listenToDataChanges();

        } else {
            // Pas d'utilisateur, essayons de nous connecter
            console.log("Aucun utilisateur, tentative de connexion...");
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    await signInWithCustomToken(auth, __initial_auth_token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Erreur de connexion anonyme:", error);
                loadingOverlay.innerHTML = "<p>Erreur de connexion. Veuillez rafraîchir.</p>";
            }
        }
    });

    function listenToDataChanges() {
        // Écouter les changements des paramètres (thème, routine)
        onSnapshot(settingsDoc, (docSnap) => {
            if (docSnap.exists()) {
                const settings = docSnap.data();
                // Appliquer le thème sauvegardé
                applyTheme(settings.theme || 'dark');
                // Charger la routine
                dailyRoutine = settings.dailyRoutine || {};
            } else {
                // Si pas de paramètres, initialiser
                applyTheme('dark');
                dailyRoutine = {};
            }
            // Mettre à jour l'UI de la routine
            checkRoutineReset();
            renderRoutineTracker();
        }, (error) => {
            console.error("Erreur d'écoute des settings:", error);
            loadingOverlay.style.display = 'none';
        });

        // Écouter les changements des unités
        onSnapshot(query(unitsCollection), (snapshot) => {
            units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI(); // Rafraîchit le tableau, dashboard etc.
            if(builderView.classList.contains('active')) {
                renderTeamBuilderUnitList();
            }
            loadingOverlay.style.display = 'none'; // Cacher l'overlay après le premier chargement
        }, (error) => {
            console.error("Erreur d'écoute des unités:", error);
            loadingOverlay.style.display = 'none';
        });

        // Écouter les changements des équipes
        onSnapshot(query(teamsCollection), (snapshot) => {
            teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (teams.length > 0 && !teams.find(t => t.id === activeTeamId)) {
                activeTeamId = teams[0].id;
            } else if (teams.length === 0) {
                activeTeamId = null;
            }
            renderTeamSelect();
            renderActiveTeam();
        }, (error) => console.error("Erreur d'écoute des équipes:", error));

        // Écouter les changements des objectifs
        onSnapshot(query(objectivesCollection), (snapshot) => {
            manualObjectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if(objectivesView.classList.contains('active')) {
                renderManualObjectives();
            }
        }, (error) => console.error("Erreur d'écoute des objectifs:", error));
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
    
    // Fonction pour sauvegarder la routine dans Firestore
    const saveDailyRoutine = async () => {
        if (!userId) return;
        try {
            await setDoc(settingsDoc, { dailyRoutine: dailyRoutine }, { merge: true });
        } catch (error) {
            console.error("Erreur de sauvegarde de la routine:", error);
            showToast("Impossible de sauvegarder la routine.", "error");
        }
    };

    const checkRoutineReset = () => {
        const currentGameDay = getGameDay();

        if (!dailyRoutine.tasks) {
            dailyRoutine.tasks = {};
        }

        let needsSave = false;
        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            let taskState = dailyRoutine.tasks[taskName];

            if (!taskState) {
                needsSave = true;
                if (taskDef.type === 'checkbox') {
                    dailyRoutine.tasks[taskName] = { completedOn: null };
                } else if (taskDef.type === 'counter') {
                    dailyRoutine.tasks[taskName] = { count: 0, updatedOn: null };
                }
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
        
        if (needsSave) {
            saveDailyRoutine();
        }
    };

    const renderRoutineTracker = () => {
        routineTrackerContent.innerHTML = '';
        const currentGameDay = getGameDay();

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            const taskState = dailyRoutine.tasks ? (dailyRoutine.tasks[taskName] || {}) : {};
            const item = document.createElement('div');
            item.className = 'routine-item';
            item.dataset.taskName = taskName;
            item.dataset.taskType = taskDef.type;

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

        let updatedCount = 0;
        const batch = writeBatch(db);

        for (const unit of unitsToUpdate) {
            const imageData = await fetchImageForUnit(unit.name);
            if (imageData) {
                const unitRef = doc(unitsCollection, unit.id);
                batch.update(unitRef, { image: imageData });
                updatedCount++;
            }
        }
        
        try {
            await batch.commit();
            showToast(`${updatedCount} image(s) mise(s) à jour avec succès !`, 'success');
        } catch (error) {
            console.error("Erreur de mise à jour des images:", error);
            showToast("Erreur lors de la mise à jour des images.", "error");
        } finally {
            updateImagesBtn.disabled = false;
        }
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
            row.dataset.id = unit.id; // Stocker l'ID firestore
            
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

        if (allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length) {
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
        units.forEach((unit) => {
            const img = document.createElement('img');
            img.src = unit.image || `https://via.placeholder.com/60x60/304065/e0e0e0?text=?`;
            img.title = unit.name;
            img.draggable = true;
            img.dataset.unitId = unit.id; // Utiliser l'ID firestore
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
            return;
        }

        teamNameInput.value = activeTeam.name;
        teamNotesTextarea.value = activeTeam.notes || '';
        const currentTeamUnitIds = activeTeam.units; // Contient les IDs des unités

        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.classList.add('team-slot');
            slot.dataset.slotIndex = i;

            const unitId = currentTeamUnitIds[i];
            const unit = unitId ? units.find(u => u.id === unitId) : null;
            
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

    const renderTeamSelect = () => {
        const previousActiveId = teamSelect.value;
        teamSelect.innerHTML = '';
        
        if (teams.length === 0) {
            // Si pas d'équipe, on en créera une à la volée si l'utilisateur interagit
            activeTeamId = null;
            return;
        }

        teams.forEach((team) => {
            const option = document.createElement('option');
            option.value = team.id;
            option.textContent = team.name;
            teamSelect.appendChild(option);
        });

        // Essayer de préserver l'équipe active
        if (teams.find(t => t.id === previousActiveId)) {
            teamSelect.value = previousActiveId;
            activeTeamId = previousActiveId;
        } else if (teams.length > 0) {
            teamSelect.value = teams[0].id;
            activeTeamId = teams[0].id;
        }
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
            if (count > 0 || totalUnits === 0) {
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
            console.error("Erreur d'ajout de l'unité:", error);
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
        const button = event.target.closest('button');
        const row = event.target.closest('tr');
        if (!row) return;

        const unitId = row.dataset.id;
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;
        const unitRef = doc(unitsCollection, unitId);

        if (button) {
            if (button.classList.contains('favorite-btn')) {
                try {
                    await setDoc(unitRef, { isFavorite: !unit.isFavorite }, { merge: true });
                } catch (e) { showToast("Erreur favori", "error"); }
            } else if (button.classList.contains('edit-btn')) {
                openEditModal(unitId);
            } else if (button.classList.contains('delete-btn')) {
                if (await showConfirm('Supprimer l\'unité', `Êtes-vous sûr de vouloir supprimer ${unit.name} ?`)) {
                    try {
                        await deleteDoc(unitRef);
                        showToast('Unité supprimée.', 'info');
                        // L'UI se mettra à jour via onSnapshot
                    } catch (e) { showToast("Erreur suppression", "error"); }
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
        if (await showConfirm('Suppression en masse', `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} unité(s) ?`)) {
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    batch.delete(doc(unitsCollection, id));
                });
                await batch.commit();
                showToast(`${selectedIds.length} unité(s) supprimée(s).`, 'success');
            } catch (error) {
                console.error("Erreur de suppression en masse:", error);
                showToast("Erreur lors de la suppression.", "error");
            }
        }
    });

    // Modale d'édition 
    editForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const unitId = document.getElementById('edit-unit-id').value;
        const unitRef = doc(unitsCollection, unitId);
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

        try {
            await setDoc(unitRef, updatedData, { merge: true });
            closeEditModal();
            showToast('Modifications enregistrées.', 'success');
        } catch (error) {
            console.error("Erreur de modification:", error);
            showToast("Erreur lors de la modification.", "error");
        }
    });
    closeModalBtn.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); });

    // Import / Export 
    exportBtn.addEventListener('click', async () => {
        // Pour l'export, on récupère les données fraîches de Firestore
        try {
            const unitsSnap = await getDocs(unitsCollection);
            const teamsSnap = await getDocs(teamsCollection);
            const objectivesSnap = await getDocs(objectivesCollection);
            const settingsSnap = await getDoc(settingsDoc);

            const backupData = {
                units: unitsSnap.docs.map(d => d.data()),
                teams: teamsSnap.docs.map(d => d.data()),
                manualObjectives: objectivesSnap.docs.map(d => d.data()),
                dailyRoutine: settingsSnap.exists() ? settingsSnap.data().dailyRoutine : {},
                theme: settingsSnap.exists() ? settingsSnap.data().theme : 'dark',
            };

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
        } catch (error) {
            console.error("Erreur d'exportation:", error);
            showToast("Erreur lors de l'exportation des données.", 'error');
        }
    });

    // L'importation devient plus complexe. On importe les unités pour l'instant.
    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (await showConfirm('Importer un fichier JSON', "Ceci AJOUTERA les unités du fichier à votre collection. Voulez-vous continuer ?")) {
                    if (importedData.units && Array.isArray(importedData.units)) {
                        const batch = writeBatch(db);
                        importedData.units.forEach(unit => {
                            const newUnitRef = doc(collection(db, `users/${userId}/units`));
                            batch.set(newUnitRef, unit);
                        });
                        await batch.commit();
                        showToast(`${importedData.units.length} unités importées avec succès !`, 'success');
                    } else {
                         showToast("Le fichier ne contient pas de tableau 'units' valide.", 'error');
                    }
                }
            } catch (error) {
                showToast("Erreur : Le fichier est invalide ou corrompu.", 'error');
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
                
                const batch = writeBatch(db);
                let addedCount = 0;

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
                    const newUnitRef = doc(unitsCollection);
                    batch.set(newUnitRef, unitData);
                    addedCount++;
                });

                await batch.commit();
                showToast(`Importation CSV : ${addedCount} ajouté(s).`, 'success');
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
    teamBuilderUnitList.addEventListener('dragstart', (e) => { if (e.target.tagName === 'IMG') e.dataTransfer.setData('text/plain', e.target.dataset.unitId); });
    teamSlotsContainer.addEventListener('dragover', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if (slot) slot.classList.add('drag-over'); });
    teamSlotsContainer.addEventListener('dragleave', (e) => { const slot = e.target.closest('.team-slot'); if (slot) slot.classList.remove('drag-over'); });
    
    teamSlotsContainer.addEventListener('drop', async (e) => {
        e.preventDefault();
        const slot = e.target.closest('.team-slot');
        if (slot) {
            slot.classList.remove('drag-over');
            const unitId = e.dataTransfer.getData('text/plain');
            const slotIndex = slot.dataset.slotIndex;
            const activeTeam = teams.find(t => t.id === activeTeamId);
            if(activeTeam) {
                activeTeam.units[slotIndex] = unitId;
                const teamRef = doc(teamsCollection, activeTeamId);
                await setDoc(teamRef, { units: activeTeam.units }, { merge: true });
            }
        }
    });

    teamSlotsContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const slot = target.closest('.team-slot');
        if (target.classList.contains('remove-from-team-btn')) {
            const slotIndex = target.dataset.slotIndex;
            const activeTeam = teams.find(t => t.id === activeTeamId);
            if(activeTeam) {
                activeTeam.units[slotIndex] = null;
                const teamRef = doc(teamsCollection, activeTeamId);
                await setDoc(teamRef, { units: activeTeam.units }, { merge: true });
                selectionModeSlotIndex = null;
                updateSelectionModeUI();
            }
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
            const activeTeam = teams.find(t => t.id === activeTeamId);
            if(activeTeam) {
                activeTeam.units[selectionModeSlotIndex] = unitId;
                const teamRef = doc(teamsCollection, activeTeamId);
                await setDoc(teamRef, { units: activeTeam.units }, { merge: true });
                selectionModeSlotIndex = null;
                updateSelectionModeUI();
            }
        }
    });

    teamSelect.addEventListener('change', () => {
        activeTeamId = teamSelect.value;
        renderActiveTeam();
    });

    saveTeamBtn.addEventListener('click', async () => {
        const newName = teamNameInput.value.trim();
        if (newName && activeTeamId) {
            const teamRef = doc(teamsCollection, activeTeamId);
            await setDoc(teamRef, { name: newName }, { merge: true });
            showToast('Nom de l\'équipe sauvegardé !', 'success');
        } else {
            showToast('Veuillez donner un nom à votre équipe.', 'info');
        }
    });

    newTeamBtn.addEventListener('click', async () => {
        const newTeam = { name: 'Nouvelle Équipe', units: [null, null, null, null, null], notes: '' };
        try {
            const docRef = await addDoc(teamsCollection, newTeam);
            activeTeamId = docRef.id; // Switch to the new team
            renderTeamSelect();
            renderActiveTeam();
        } catch (error) {
            showToast("Erreur création d'équipe", "error");
        }
    });

    deleteTeamBtn.addEventListener('click', async () => {
        if (teams.length <= 1) {
            showToast("Vous ne pouvez pas supprimer votre dernière équipe.", 'info');
            return;
        }
        const activeTeam = teams.find(t => t.id === activeTeamId);
        if (activeTeam && await showConfirm('Supprimer l\'équipe', `Êtes-vous sûr de vouloir supprimer l'équipe "${activeTeam.name}" ?`)) {
            try {
                await deleteDoc(doc(teamsCollection, activeTeamId));
                showToast('Équipe supprimée.', 'success');
                // L'UI se mettra à jour via onSnapshot
            } catch (error) {
                showToast("Erreur suppression d'équipe", "error");
            }
        }
    });

    teamNotesTextarea.addEventListener('input', async () => {
        const activeTeam = teams.find(t => t.id === activeTeamId);
        if (activeTeam) {
            const teamRef = doc(teamsCollection, activeTeamId);
            // Simple debounce pour ne pas surcharger firestore
            clearTimeout(teamNotesTextarea.timer);
            teamNotesTextarea.timer = setTimeout(async () => {
                 await setDoc(teamRef, { notes: teamNotesTextarea.value }, { merge: true });
            }, 500);
        }
    });

    // Objectifs (To-Do List) 
    addObjectiveForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = newObjectiveInput.value.trim();
        if (text) {
            try {
                await addDoc(objectivesCollection, { text: text, completed: false });
                newObjectiveInput.value = '';
                showToast("Objectif ajouté !", 'success');
            } catch (error) {
                showToast("Erreur ajout d'objectif", "error");
            }
        }
    });
    objectivesListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const li = target.closest('.objective-item');
        if (!li) return;
        const objectiveId = li.dataset.id;
        const objRef = doc(objectivesCollection, objectiveId);

        if (target.classList.contains('objective-checkbox')) {
            try {
                await setDoc(objRef, { completed: target.checked }, { merge: true });
            } catch(e) { showToast("Erreur modification objectif", "error"); }
        }
        if (target.closest('.delete-objective-btn')) {
             try {
                await deleteDoc(objRef);
                showToast("Objectif supprimé.", 'info');
            } catch(e) { showToast("Erreur suppression objectif", "error"); }
        }
    });

    // Gestionnaire d'événements pour le tracker de routine 
    routineTrackerContent.addEventListener('click', (e) => {
        const item = e.target.closest('.routine-item');
        if (!item) return;

        const taskName = item.dataset.taskName;
        const taskType = item.dataset.taskType;
        const taskDef = ROUTINE_DEFINITION.find(t => t.name === taskName);
        if (!taskDef) return;

        if (!dailyRoutine.tasks) dailyRoutine.tasks = {};
        const taskState = dailyRoutine.tasks[taskName] || {};
        const currentGameDay = getGameDay();

        if (taskType === 'checkbox') {
            const checkbox = item.querySelector('input[type="checkbox"]');
            taskState.completedOn = checkbox.checked ? currentGameDay : null;
        } else if (taskType === 'counter') {
            const action = e.target.dataset.action;
            let count = taskState.count || 0;
            if (action === 'plus') {
                count = Math.min(taskDef.max, count + 1);
            } else if (action === 'minus') {
                count = Math.max(0, count - 1);
            }
            taskState.count = count;
            taskState.updatedOn = currentGameDay;
        }
        dailyRoutine.tasks[taskName] = taskState;
        saveDailyRoutine(); // Sauvegarde après chaque changement
        renderRoutineTracker();
    });
    // #endregion 

    // #region --- INITIALISATION DE L'APPLICATION --- 
    const refreshUI = () => {
        // La routine est mise à jour via son propre onSnapshot
        displayUnits();
        updateDashboard();
        updateSelectionState();
    };

    switchView('manager');
    // #endregion 
});
