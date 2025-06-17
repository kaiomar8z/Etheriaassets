document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // NOUVEAU : CONFIGURATION ET INITIALISATION DE FIREBASE
    // =================================================================
    // Remplacez ceci par la configuration de VOTRE projet Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
        authDomain: "etheria-manager.firebaseapp.com",
        projectId: "etheria-manager",
        storageBucket: "etheria-manager.firebasestorage.app",
        messagingSenderId: "247321381553",
        appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
    };

    // Initialisation de Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore(); // Service de base de données Firestore
    const auth = firebase.auth(); // Service d'authentification

    // =================================================================
    // SÉLECTION DES ÉLÉMENTS DU DOM (inchangé)
    // =================================================================
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const sunIcon = '<i class="fa-solid fa-sun"></i>';
    const moonIcon = '<i class="fa-solid fa-moon"></i>';
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
    const addObjectiveForm = document.getElementById('add-objective-form');
    const newObjectiveInput = document.getElementById('new-objective-input');
    const objectivesListContainer = document.getElementById('objectives-list');

    // =================================================================
    // SUPPRESSION DE L'ANCIENNE GESTION D'ÉTAT (localStorage)
    // Les variables `units`, `teams`, etc., sont maintenant chargées
    // de manière asynchrone depuis Firebase.
    // =================================================================
    let units = [];
    let teams = [];
    let manualObjectives = [];
    let dailyRoutine = {};
    let settings = {}; // Pour le thème

    let userId = null; // ID de l'utilisateur connecté
    let unitsDB = null;
    let activeTeamIndex = 0;
    let currentSort = { column: 'level', direction: 'desc' };
    let favoritesFilterActive = false;
    let selectionModeSlotIndex = null;
    let unitImageData = null;

    // Références aux documents et collections dans Firestore
    let userDocRef = null;
    let unitsCollectionRef = null;

    // =================================================================
    // NOUVEAU : GESTION DE L'AUTHENTIFICATION
    // Pour sécuriser les données, chaque utilisateur doit être authentifié.
    // On utilise ici une connexion anonyme, simple à mettre en place.
    // =================================================================
    auth.onAuthStateChanged(user => {
        if (user) {
            // L'utilisateur est connecté (anonymement ou non)
            console.log("Utilisateur connecté, UID:", user.uid);
            userId = user.uid;

            // Définir les chemins vers les données de cet utilisateur dans Firestore
            userDocRef = db.collection('users').doc(userId);
            unitsCollectionRef = userDocRef.collection('units');

            // Lancer l'écoute des données en temps réel
            listenToData();
        } else {
            // L'utilisateur n'est pas connecté
            console.log("Aucun utilisateur connecté, tentative de connexion anonyme...");
            auth.signInAnonymously().catch(error => {
                console.error("Erreur de connexion anonyme:", error);
                showToast("Impossible de se connecter à la base de données.", "error");
            });
        }
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


    // =================================================================
    // NOUVEAU : ÉCOUTE DES DONNÉES FIREBASE EN TEMPS RÉEL
    // La fonction onSnapshot s'exécute à chaque modification dans la base de données.
    // =================================================================
    function listenToData() {
        if (!userId) return;

        // Écoute des unités
        unitsCollectionRef.onSnapshot(snapshot => {
            console.log("Mise à jour des unités reçue de Firebase.");
            units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI(); // On rafraîchit l'interface à chaque mise à jour
        }, error => {
            console.error("Erreur d'écoute des unités:", error);
            showToast("Erreur de synchronisation des unités.", "error");
        });

        // Écoute des autres données (groupées dans un seul document pour simplifier)
        userDocRef.onSnapshot(doc => {
            if (doc.exists) {
                console.log("Mise à jour des données utilisateur (équipes, etc.) reçue.");
                const data = doc.data();
                teams = data.teams || [];
                manualObjectives = data.manualObjectives || [];
                dailyRoutine = data.dailyRoutine || {};
                settings = data.settings || {};

                // Appliquer le thème sauvegardé
                applyTheme(settings.theme || 'dark');
                // Rafraîchir l'interface (sauf les unités déjà gérées)
                checkRoutineReset();
                renderRoutineTracker();
                renderTeamSelect();
                renderActiveTeam();
                renderManualObjectives();

            } else {
                // Si le document n'existe pas, on le crée avec des valeurs par défaut
                console.log("Création du document utilisateur initial.");
                userDocRef.set({
                    teams: [{ name: 'Mon Équipe', units: [null, null, null, null, null], notes: '' }],
                    manualObjectives: [],
                    dailyRoutine: {},
                    settings: { theme: 'dark' }
                });
            }
        }, error => {
            console.error("Erreur d'écoute des données utilisateur:", error);
            showToast("Erreur de synchronisation des données.", "error");
        });
    }

    // =================================================================
    // MODIFICATION : Les fonctions `save...` écrivent maintenant sur Firestore
    // au lieu de `localStorage`.
    // =================================================================
    const saveDataToFirebase = () => {
        if (!userDocRef) return;
        userDocRef.update({
            teams: teams,
            manualObjectives: manualObjectives,
            dailyRoutine: dailyRoutine
        }).catch(error => {
            console.error("Erreur de sauvegarde des données:", error);
            showToast("La sauvegarde des données a échoué.", "error");
        });
    };

    const saveSettingsToFirebase = () => {
        if (!userDocRef) return;
        userDocRef.update({
            settings: settings
        }).catch(error => console.error("Erreur de sauvegarde des paramètres:", error));
    };

    // --- Gestion du Thème ---
    const applyTheme = (theme) => {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            themeToggleBtn.innerHTML = moonIcon;
        } else {
            document.body.classList.remove('light-theme');
            themeToggleBtn.innerHTML = sunIcon;
        }
    };

    themeToggleBtn.addEventListener('click', () => {
        const isLight = document.body.classList.contains('light-theme');
        const newTheme = isLight ? 'dark' : 'light';
        settings.theme = newTheme;
        applyTheme(newTheme);
        saveSettingsToFirebase(); // On sauvegarde sur Firebase
    });


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
        let hasChanged = false;

        if (!dailyRoutine.tasks) {
            dailyRoutine.tasks = {};
            hasChanged = true;
        }

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            const taskState = dailyRoutine.tasks[taskName];

            if (!taskState) {
                if (taskDef.type === 'checkbox') {
                    dailyRoutine.tasks[taskName] = { completedOn: null };
                } else if (taskDef.type === 'counter') {
                    dailyRoutine.tasks[taskName] = { count: 0, updatedOn: null };
                }
                hasChanged = true;
                return;
            }

            if (taskDef.type === 'checkbox') {
                if (taskState.completedOn && taskState.completedOn !== currentGameDay) {
                    taskState.completedOn = null;
                    hasChanged = true;
                }
            } else if (taskDef.type === 'counter') {
                if (taskState.updatedOn && taskState.updatedOn !== currentGameDay) {
                    taskState.count = 0;
                    taskState.updatedOn = null;
                    hasChanged = true;
                }
            }
        });

        if (hasChanged) {
            saveDataToFirebase();
        }
    };

    const renderRoutineTracker = () => {
        routineTrackerContent.innerHTML = '';
        const currentGameDay = getGameDay();
        if (!dailyRoutine.tasks) return; // Sécurité

        ROUTINE_DEFINITION.forEach(taskDef => {
            const taskName = taskDef.name;
            const taskState = dailyRoutine.tasks[taskName];
            if (!taskState) return; // Sécurité

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
    const renderManualObjectives = () => {
        objectivesListContainer.innerHTML = '';

        if (!manualObjectives || manualObjectives.length === 0) {
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
        'Rouge': 'reason.webp', 'Bleu': 'odd.webp', 'Vert': 'hollow.webp',
        'Dark': 'disorder.webp', 'Light': 'constant.webp'
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
                if (!response.ok) throw new Error('Erreur réseau.');
                unitsDB = await response.json();
            }
            const foundUnit = unitsDB.find(u => u.name.toLowerCase() === unitName.toLowerCase());
            if (foundUnit) {
                document.getElementById('unit-element').value = foundUnit.element;
                document.getElementById('unit-rarity').value = foundUnit.rarity;
                showToast(`Données pour ${foundUnit.name} chargées !`, 'success');
            }
        } catch (error) {
            console.error("Erreur DB unités:", error);
        }
    };
    
    const findUnitImage = async (unitName) => { 
        if (!unitName || !unitName.trim()) return;
        const formattedName = unitName.trim().replace(/ /g, '_').toLowerCase();
        const extensions = ['webp', 'png', 'jpg'];
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
        showToast(`Mise à jour de ${unitsToUpdate.length} image(s)...`, 'info');

        let updatedCount = 0;
        const promises = unitsToUpdate.map(async (unit) => {
            const imageData = await fetchImageForUnit(unit.name);
            if (imageData) {
                // MODIFICATION : Mise à jour du document dans Firebase
                await unitsCollectionRef.doc(unit.id).update({ image: imageData });
                updatedCount++;
            }
        });

        await Promise.all(promises);

        updateImagesBtn.disabled = false;
        showToast(`${updatedCount} image(s) mise(s) à jour !`, 'success');
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
            unitListBody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-color-muted);">Aucune unité ne correspond.</td></tr>`;
            return;
        }
        unitsToDisplay.forEach(unit => {
            const rowFragment = unitRowTemplate.content.cloneNode(true);

            // MODIFICATION : On utilise l'ID de Firebase pour identifier la ligne
            rowFragment.querySelector('tr').dataset.id = unit.id;
            rowFragment.querySelector('.unit-checkbox').dataset.id = unit.id;

            const img = rowFragment.querySelector('.unit-image-cell img');
            img.alt = unit.name;
            if (unit.image) {
                img.src = unit.image;
            } else {
                const formattedName = unit.name.trim().replace(/ /g, '_').toLowerCase();
                img.src = formattedName ? `${imageBaseUrl}${formattedName}.webp` : 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?';
                img.onerror = () => { img.src = 'https://via.placeholder.com/50x50/304065/e0e0e0?text=?'; img.onerror = null; };
            }
            if (unit.rarity) img.classList.add(`rarity-border-${unit.rarity.toLowerCase()}`);

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
            elementCell.innerHTML = elementIconMap[unit.element] ? `<img src="${elementIconMap[unit.element]}" alt="${unit.element}" class="table-icon" />` : unit.element;
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
                favoriteBtn.classList.remove('is-favorite');
                favoriteBtn.innerHTML = '<i class="fa-regular fa-star"></i>';
                favoriteBtn.title = "Mettre en favori";
            }
            unitListBody.appendChild(rowFragment);
        });
    };

    const updateSortHeaders = () => { /* ... (inchangé) ... */ };
    function openEditModal(unitId) {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        // MODIFICATION : On stocke l'ID Firebase dans le formulaire
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
    const updateSelectionState = () => { /* ... (inchangé) ... */ };
    // #endregion

    // #region --- MODULE TEAM BUILDER ---
    const renderTeamBuilderUnitList = () => {
        teamBuilderUnitList.innerHTML = '';
        units.forEach((unit) => {
            const img = document.createElement('img');
            img.src = unit.image || `https://via.placeholder.com/60x60/304065/e0e0e0?text=?`;
            img.title = unit.name;
            img.draggable = true;
            // MODIFICATION : on utilise l'ID de l'unité
            img.dataset.unitId = unit.id;
            teamBuilderUnitList.appendChild(img);
        });
    };
    const updateSelectionModeUI = () => { /* ... (inchangé) ... */ };
    const renderActiveTeam = () => {
        teamSlotsContainer.innerHTML = '';
        if (!teams || teams.length === 0) return;
        if (!teams[activeTeamIndex]) activeTeamIndex = 0;

        teamNameInput.value = teams[activeTeamIndex].name;
        teamNotesTextarea.value = teams[activeTeamIndex].notes || '';
        const currentTeamUnits = teams[activeTeamIndex].units;

        for (let i = 0; i < 5; i++) {
            const slot = document.createElement('div');
            slot.classList.add('team-slot');
            slot.dataset.slotIndex = i;

            const unitId = currentTeamUnits[i];
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
        teamSelect.innerHTML = '';
        if (!teams || teams.length === 0) {
             teams.push({ name: 'Mon Équipe', units: [null, null, null, null, null], notes: '' });
             activeTeamIndex = 0;
             saveDataToFirebase();
        }
        teams.forEach((team, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = team.name;
            if (index === activeTeamIndex) option.selected = true;
            teamSelect.appendChild(option);
        });
    };
    // #endregion

    // #region --- MODULES DASHBOARD & IMPORT/EXPORT ---
    const updateDashboard = () => { /* ... (inchangé) ... */ };
    // #endregion

    // #region --- GESTION DES ÉVÉNEMENTS (Event Listeners) ---
    // Navigation
    showManagerBtn.addEventListener('click', () => switchView('manager'));
    showBuilderBtn.addEventListener('click', () => switchView('builder'));
    showObjectivesBtn.addEventListener('click', () => switchView('objectives'));

    // Formulaire d'ajout
    addForm.addEventListener('submit', (event) => {
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
        // MODIFICATION : Ajout à Firestore
        unitsCollectionRef.add(newUnit).then(() => {
            showToast(`'${newUnit.name}' a été ajouté.`, 'success');
            resetAddForm();
            // Pas besoin de rafraîchir, onSnapshot le fera automatiquement
        }).catch(error => {
            console.error("Erreur d'ajout:", error);
            showToast("L'ajout a échoué.", "error");
        });
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
                imagePlaceholder.innerHTML = `<img src="${unitImageData}" alt="Aperçu">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Tableau des unités (Actions, Filtres, Tri, Sélection)
    unitListBody.addEventListener('click', async (event) => {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.id) return;

        const unitId = row.dataset.id;
        const unit = units.find(u => u.id === unitId);
        if (!unit) return;

        const button = event.target.closest('button');
        if (button) {
             if (button.classList.contains('favorite-btn')) {
                // MODIFICATION : Mise à jour dans Firestore
                unitsCollectionRef.doc(unitId).update({ isFavorite: !unit.isFavorite });
            } else if (button.classList.contains('edit-btn')) {
                openEditModal(unitId);
            } else if (button.classList.contains('delete-btn')) {
                if (await showConfirm('Supprimer l\'unité', `Supprimer ${unit.name} ?`)) {
                    // MODIFICATION : Suppression dans Firestore
                    unitsCollectionRef.doc(unitId).delete().then(() => {
                         showToast('Unité supprimée.', 'info');
                    });
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
    table.querySelector('thead').addEventListener('click', (event) => { /* ... (inchangé) ... */ });
    selectAllCheckbox.addEventListener('change', () => { /* ... (inchangé) ... */ });

    deleteSelectedBtn.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.unit-checkbox:checked')).map(cb => cb.dataset.id);
        if (selectedIds.length === 0) return;
        if (await showConfirm('Suppression en masse', `Supprimer ${selectedIds.length} unité(s) ?`)) {
            // MODIFICATION : Suppression en masse dans Firestore
            const batch = db.batch();
            selectedIds.forEach(id => {
                batch.delete(unitsCollectionRef.doc(id));
            });
            batch.commit().then(() => {
                showToast(`${selectedIds.length} unité(s) supprimée(s).`, 'success');
            });
        }
    });

    // Modale d'édition
    editForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const unitId = document.getElementById('edit-unit-id').value;
        const unitData = {
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
        // MODIFICATION : Mise à jour dans Firestore
        unitsCollectionRef.doc(unitId).update(unitData).then(() => {
            showToast('Modifications enregistrées.', 'success');
            closeEditModal();
        });
    });
    closeModalBtn.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); });

    // Import / Export
    exportBtn.addEventListener('click', () => { /* ... (La logique d'export est conservée telle quelle) ... */ });
    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (await showConfirm('Importer JSON', "Remplacer vos données par celles importées ? Cette action est IRREVERSIBLE.")) {
                    const batch = db.batch();
                    // Supprimer anciennes unités
                    units.forEach(unit => batch.delete(unitsCollectionRef.doc(unit.id)));
                    // Ajouter nouvelles unités
                    if (importedData.units) {
                         importedData.units.forEach(unit => batch.set(unitsCollectionRef.doc(), unit));
                    }
                    // Mettre à jour le reste
                    batch.set(userDocRef, {
                        teams: importedData.teams || [],
                        manualObjectives: importedData.manualObjectives || [],
                        dailyRoutine: importedData.dailyRoutine || {},
                        settings: importedData.settings || { theme: 'dark' }
                    });
                    await batch.commit();
                    showToast("Importation complète réussie !", 'success');
                }
            } catch (error) { showToast("Erreur : Le fichier est invalide.", 'error'); }
            finally { importInput.value = ''; }
        };
        reader.readAsText(file);
    });
    importCsvInput.addEventListener('change', (event) => { /* ... (Non modifié pour rester simple, mais pourrait être adapté) ... */ });

    // Team Builder
    teamBuilderUnitList.addEventListener('dragstart', (e) => { if(e.target.tagName === 'IMG') e.dataTransfer.setData('text/plain', e.target.dataset.unitId); });
    teamSlotsContainer.addEventListener('drop', (e) => { e.preventDefault(); const slot = e.target.closest('.team-slot'); if(slot) { slot.classList.remove('drag-over'); const unitId = e.dataTransfer.getData('text/plain'); const slotIndex = slot.dataset.slotIndex; teams[activeTeamIndex].units[slotIndex] = unitId; saveDataToFirebase(); }});
    teamSlotsContainer.addEventListener('click', (e) => { const target = e.target; const slot = target.closest('.team-slot'); if (target.classList.contains('remove-from-team-btn')) { const slotIndex = target.dataset.slotIndex; teams[activeTeamIndex].units[slotIndex] = null; saveDataToFirebase(); selectionModeSlotIndex = null; updateSelectionModeUI(); } else if (slot) { const clickedSlotIndex = parseInt(slot.dataset.slotIndex); selectionModeSlotIndex = selectionModeSlotIndex === clickedSlotIndex ? null : clickedSlotIndex; updateSelectionModeUI(); }});
    teamBuilderUnitList.addEventListener('click', (e) => { if (e.target.tagName === 'IMG' && selectionModeSlotIndex !== null) { const unitId = e.target.dataset.unitId; teams[activeTeamIndex].units[selectionModeSlotIndex] = unitId; saveDataToFirebase(); selectionModeSlotIndex = null; updateSelectionModeUI(); }});
    teamSelect.addEventListener('change', () => { activeTeamIndex = parseInt(teamSelect.value); renderActiveTeam(); });
    saveTeamBtn.addEventListener('click', () => { const newName = teamNameInput.value.trim(); if (newName) { teams[activeTeamIndex].name = newName; saveDataToFirebase(); showToast('Nom sauvegardé !', 'success'); } else { showToast('Donnez un nom à votre équipe.', 'info'); }});
    newTeamBtn.addEventListener('click', () => { teams.push({ name: 'Nouvelle Équipe', units: [null, null, null, null, null], notes: '' }); activeTeamIndex = teams.length - 1; saveDataToFirebase(); });
    deleteTeamBtn.addEventListener('click', async () => { if(teams.length <= 1) { showToast("Vous ne pouvez pas supprimer votre dernière équipe.", 'info'); return; } if(await showConfirm('Supprimer l\'équipe', `Supprimer "${teams[activeTeamIndex].name}" ?`)) { teams.splice(activeTeamIndex, 1); activeTeamIndex = 0; saveDataToFirebase(); showToast('Équipe supprimée.', 'success'); }});
    teamNotesTextarea.addEventListener('input', () => { if (teams[activeTeamIndex]) { teams[activeTeamIndex].notes = teamNotesTextarea.value; saveDataToFirebase(); } });

    // Objectifs
    addObjectiveForm.addEventListener('submit', (e) => { e.preventDefault(); const text = newObjectiveInput.value.trim(); if (text) { manualObjectives.push({ id: Date.now(), text: text, completed: false }); saveDataToFirebase(); newObjectiveInput.value = ''; showToast("Objectif ajouté !", 'success'); } });
    objectivesListContainer.addEventListener('click', (e) => {
        const li = e.target.closest('.objective-item'); if (!li) return; const objectiveId = Number(li.dataset.id); const objective = manualObjectives.find(obj => obj.id === objectiveId);
        if (e.target.classList.contains('objective-checkbox') && objective) { objective.completed = e.target.checked; saveDataToFirebase(); }
        if (e.target.closest('.delete-objective-btn')) { manualObjectives = manualObjectives.filter(obj => obj.id !== objectiveId); saveDataToFirebase(); showToast("Objectif supprimé.", 'info'); }
    });

    // Routine
    routineTrackerContent.addEventListener('click', (e) => {
        const item = e.target.closest('.routine-item'); if (!item) return; const taskName = item.dataset.taskName; const taskType = item.dataset.taskType; const taskDef = ROUTINE_DEFINITION.find(t => t.name === taskName); if (!taskDef) return; const taskState = dailyRoutine.tasks[taskName]; const currentGameDay = getGameDay();
        if (taskType === 'checkbox') { taskState.completedOn = item.querySelector('input[type="checkbox"]').checked ? currentGameDay : null; }
        else if (taskType === 'counter') { let count = taskState.count || 0; if (e.target.dataset.action === 'plus') count = Math.min(taskDef.max, count + 1); else if (e.target.dataset.action === 'minus') count = Math.max(0, count - 1); taskState.count = count; taskState.updatedOn = currentGameDay; }
        saveDataToFirebase();
    });
    // #endregion

    // #region --- INITIALISATION DE L'APPLICATION ---
    const refreshUI = () => {
        displayUnits();
        updateDashboard();
        updateSelectionState();
        // Le reste est géré par les listeners
    };

    switchView('manager'); // Vue par défaut
    // #endregion
});
