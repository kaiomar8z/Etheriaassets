document.addEventListener('DOMContentLoaded', () => {

    // === CONFIGURATION FIREBASE SÉCURISÉE ===
    let firebaseConfig;
    try {
        firebaseConfig = window.getFirebaseConfig ? window.getFirebaseConfig() : {
            // Configuration de fallback (à remplacer par vos vraies clés)
            apiKey: "AIzaSyDVVTPm80W3K0ebutcPlh-OAR28kJiaMjE",
            authDomain: "etheria-manager.firebaseapp.com",
            projectId: "etheria-manager",
            storageBucket: "etheria-manager.appspot.com",
            messagingSenderId: "247321381553",
            appId: "1:247321381553:web:517f4fb1989ad14a8e3090"
        };
    } catch (error) {
        console.error('Erreur lors du chargement de la configuration Firebase:', error);
        firebaseConfig = {}; // Configuration vide pour éviter les erreurs
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const db = firebase.firestore();
    const storage = firebase.storage();

    // Collection references
    const unitsCol = db.collection('units');
    const teamsCol = db.collection('teams');
    const manualObjectivesCol = db.collection('manualObjectives');
    const dailyRoutineDoc = db.collection('settings').doc('dailyRoutine');

    // === SYSTÈME DE NOTIFICATIONS AMÉLIORÉ ===
    class NotificationManager {
        constructor() {
            this.container = document.getElementById('notification-container');
            this.notificationId = 0;
        }

        show(type = 'info', title = '', message = '', duration = 4000) {
            const id = ++this.notificationId;
            const notification = this.createNotification(id, type, title, message);
            
            this.container.appendChild(notification);
            
            if (duration > 0) {
                setTimeout(() => this.remove(id), duration);
            }
            
            return id;
        }

        createNotification(id, type, title, message) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.id = `notification-${id}`;
            
            const icons = {
                success: 'fas fa-check-circle',
                error: 'fas fa-times-circle',
                info: 'fas fa-info-circle',
                warning: 'fas fa-exclamation-triangle',
                loading: 'fas fa-spinner'
            };

            notification.innerHTML = `
                <div class="notification-icon">
                    <i class="${icons[type]}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="notificationManager.remove(${id})">
                    <i class="fas fa-times"></i>
                </button>
                <div class="notification-progress"></div>
            `;

            return notification;
        }

        remove(id) {
            const notification = document.getElementById(`notification-${id}`);
            if (notification) {
                notification.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }

        loading(title, message) {
            return this.show('loading', title, message, 0);
        }

        success(title, message) {
            return this.show('success', title, message);
        }

        error(title, message) {
            return this.show('error', title, message);
        }

        warning(title, message) {
            return this.show('warning', title, message);
        }

        info(title, message) {
            return this.show('info', title, message);
        }
    }

    // Instance globale du gestionnaire de notifications
    const notificationManager = new NotificationManager();
    window.notificationManager = notificationManager;

    // === GESTION DES THÈMES AMÉLIORÉE ===
    const ThemeManager = {
        themes: ['dark', 'light', 'gaming', 'minimal'],
        currentTheme: 'dark',

        init() {
            this.currentTheme = localStorage.getItem('etheriaTheme') || 'dark';
            this.applyTheme(this.currentTheme);
            this.setupEventListeners();
        },

        applyTheme(themeName) {
            // Supprimer toutes les classes de thème
            this.themes.forEach(theme => {
                document.body.classList.remove(`${theme}-theme`);
            });

            // Appliquer le nouveau thème
            if (themeName !== 'dark') {
                document.body.classList.add(`${themeName}-theme`);
            }

            this.currentTheme = themeName;
            localStorage.setItem('etheriaTheme', themeName);
            
            // Mettre à jour l'interface
            this.updateThemeControls();
        },

        updateThemeControls() {
            const themeToggle = document.getElementById('theme-toggle-btn');
            const themeSelect = document.getElementById('theme-selector');
            
            if (themeSelect) {
                themeSelect.value = this.currentTheme;
            }

            if (themeToggle) {
                const icons = {
                    dark: 'fa-sun',
                    light: 'fa-moon',
                    gaming: 'fa-gamepad',
                    minimal: 'fa-circle'
                };
                themeToggle.innerHTML = `<i class="fas ${icons[this.currentTheme]}"></i>`;
            }
        },

        setupEventListeners() {
            const themeToggle = document.getElementById('theme-toggle-btn');
            const themeSelect = document.getElementById('theme-selector');

            if (themeToggle) {
                themeToggle.addEventListener('click', () => {
                    const currentIndex = this.themes.indexOf(this.currentTheme);
                    const nextIndex = (currentIndex + 1) % this.themes.length;
                    this.applyTheme(this.themes[nextIndex]);
                });
            }

            if (themeSelect) {
                themeSelect.addEventListener('change', (e) => {
                    this.applyTheme(e.target.value);
                });
            }
        }
    };

    // === GESTIONNAIRE DE FILTRES AVANCÉS ===
    class FilterManager {
        constructor() {
            this.activeFilters = {
                search: '',
                element: '',
                rarity: '',
                sort: 'name-asc',
                quickFilters: new Set(),
                levelMin: null,
                levelMax: null,
                starsMin: null,
                starsMax: null,
                doublonMin: null,
                doublonMax: null,
                skillFilter: ''
            };
            this.debounceTimer = null;
            this.init();
        }

        init() {
            this.setupEventListeners();
            this.setupDebouncing();
        }

        setupEventListeners() {
            // Recherche avec debouncing
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.debouncedApplyFilters();
                    this.updateClearButton();
                });
            }

            // Filtres de base
            ['filter-element', 'filter-rarity', 'sort-select'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('change', () => this.applyFilters());
                }
            });

            // Filtres rapides
            document.querySelectorAll('.quick-filter-btn').forEach(btn => {
                btn.addEventListener('click', () => this.toggleQuickFilter(btn));
            });

            // Filtres avancés
            ['level-min', 'level-max', 'stars-min', 'stars-max', 'doublon-min', 'doublon-max', 'skill-filter'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('change', () => this.applyFilters());
                }
            });

            // Toggle des filtres avancés
            const toggleBtn = document.getElementById('toggle-advanced-filters');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => this.toggleAdvancedFilters());
            }

            // Actions des filtres
            const clearBtn = document.getElementById('clear-all-filters');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this.clearAllFilters());
            }

            // Bouton de nettoyage de la recherche
            const clearSearchBtn = document.getElementById('clear-search');
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => this.clearSearch());
            }
        }

        setupDebouncing() {
            this.debouncedApplyFilters = this.debounce(() => {
                this.applyFilters();
            }, 300);
        }

        debounce(func, wait) {
            return (...args) => {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => func.apply(this, args), wait);
            };
        }

        toggleQuickFilter(button) {
            const filterType = button.dataset.filter;
            
            if (this.activeFilters.quickFilters.has(filterType)) {
                this.activeFilters.quickFilters.delete(filterType);
                button.classList.remove('active');
            } else {
                this.activeFilters.quickFilters.add(filterType);
                button.classList.add('active');
            }
            
            this.applyFilters();
        }

        toggleAdvancedFilters() {
            const advancedFilters = document.getElementById('advanced-filters');
            if (advancedFilters) {
                const isVisible = advancedFilters.style.display !== 'none';
                advancedFilters.style.display = isVisible ? 'none' : 'grid';
            }
        }

        updateClearButton() {
            const clearBtn = document.getElementById('clear-search');
            const searchInput = document.getElementById('search-input');
            
            if (clearBtn && searchInput) {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
        }

        clearSearch() {
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = '';
                this.updateClearButton();
                this.applyFilters();
            }
        }

        clearAllFilters() {
            // Réinitialiser tous les champs
            document.getElementById('search-input').value = '';
            document.getElementById('filter-element').value = '';
            document.getElementById('filter-rarity').value = '';
            document.getElementById('sort-select').value = 'name-asc';
            
            // Filtres avancés
            ['level-min', 'level-max', 'stars-min', 'stars-max', 'doublon-min', 'doublon-max'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.value = '';
            });
            
            document.getElementById('skill-filter').value = '';

            // Filtres rapides
            this.activeFilters.quickFilters.clear();
            document.querySelectorAll('.quick-filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });

            this.updateClearButton();
            this.applyFilters();
        }

        collectFilterValues() {
            return {
                search: document.getElementById('search-input')?.value.toLowerCase() || '',
                element: document.getElementById('filter-element')?.value || '',
                rarity: document.getElementById('filter-rarity')?.value || '',
                sort: document.getElementById('sort-select')?.value || 'name-asc',
                quickFilters: this.activeFilters.quickFilters,
                levelMin: parseInt(document.getElementById('level-min')?.value) || null,
                levelMax: parseInt(document.getElementById('level-max')?.value) || null,
                starsMin: parseInt(document.getElementById('stars-min')?.value) || null,
                starsMax: parseInt(document.getElementById('stars-max')?.value) || null,
                doublonMin: parseInt(document.getElementById('doublon-min')?.value) || null,
                doublonMax: parseInt(document.getElementById('doublon-max')?.value) || null,
                skillFilter: document.getElementById('skill-filter')?.value || ''
            };
        }

        applyFilters() {
            this.activeFilters = this.collectFilterValues();
            displayUnits();
        }

        filterUnits(units) {
            return units.filter(unit => {
                // Recherche textuelle
                const matchesSearch = !this.activeFilters.search || 
                    unit.name.toLowerCase().includes(this.activeFilters.search);

                // Filtres de base
                const matchesElement = !this.activeFilters.element || unit.element === this.activeFilters.element;
                const matchesRarity = !this.activeFilters.rarity || unit.rarity === this.activeFilters.rarity;

                // Filtres rapides
                let matchesQuickFilters = true;
                this.activeFilters.quickFilters.forEach(filter => {
                    switch (filter) {
                        case 'favorites':
                            matchesQuickFilters = matchesQuickFilters && unit.isFavorite;
                            break;
                        case 'max-level':
                            matchesQuickFilters = matchesQuickFilters && unit.level === 50;
                            break;
                        case 'high-stars':
                            matchesQuickFilters = matchesQuickFilters && unit.stars >= 5;
                            break;
                        case 'has-notes':
                            matchesQuickFilters = matchesQuickFilters && unit.notes && unit.notes.trim() !== '';
                            break;
                        case 'ssr-only':
                            matchesQuickFilters = matchesQuickFilters && unit.rarity === 'SSR';
                            break;
                    }
                });

                // Filtres de plage
                const matchesLevelRange = (!this.activeFilters.levelMin || unit.level >= this.activeFilters.levelMin) &&
                                         (!this.activeFilters.levelMax || unit.level <= this.activeFilters.levelMax);

                const matchesStarsRange = (!this.activeFilters.starsMin || unit.stars >= this.activeFilters.starsMin) &&
                                         (!this.activeFilters.starsMax || unit.stars <= this.activeFilters.starsMax);

                const matchesDoublonRange = (!this.activeFilters.doublonMin || unit.doublon >= this.activeFilters.doublonMin) &&
                                           (!this.activeFilters.doublonMax || unit.doublon <= this.activeFilters.doublonMax);

                // Filtre de compétences
                let matchesSkillFilter = true;
                if (this.activeFilters.skillFilter) {
                    const avgSkill = (unit.s1 + unit.s2 + unit.s3) / 3;
                    switch (this.activeFilters.skillFilter) {
                        case 'maxed':
                            matchesSkillFilter = unit.s1 === 5 && unit.s2 === 5 && unit.s3 === 5;
                            break;
                        case 'high':
                            matchesSkillFilter = avgSkill >= 4;
                            break;
                        case 'low':
                            matchesSkillFilter = avgSkill <= 3;
                            break;
                    }
                }

                return matchesSearch && matchesElement && matchesRarity && matchesQuickFilters && 
                       matchesLevelRange && matchesStarsRange && matchesDoublonRange && matchesSkillFilter;
            });
        }

        sortUnits(units) {
            const [column, direction] = this.activeFilters.sort.split('-');
            
            return units.sort((a, b) => {
                // Favoris toujours en premier
                if (a.isFavorite && !b.isFavorite) return -1;
                if (!a.isFavorite && b.isFavorite) return 1;

                const valA = a[column];
                const valB = b[column];
                const multiplier = direction === 'asc' ? 1 : -1;

                if (typeof valA === 'string') {
                    return valA.localeCompare(valB) * multiplier;
                } else {
                    return (valA - valB) * multiplier;
                }
            });
        }

        updateResultsInfo(filteredCount, totalCount) {
            const resultsInfo = document.getElementById('results-info');
            const resultsCount = document.getElementById('results-count');
            
            if (resultsCount) {
                resultsCount.textContent = filteredCount;
            }
            
            if (resultsInfo && filteredCount !== totalCount) {
                resultsInfo.style.display = 'flex';
            } else if (resultsInfo) {
                resultsInfo.style.display = 'none';
            }
        }
    }

    // === ANALYSEUR DE SYNERGIES POUR LE TEAM BUILDER ===
    class SynergyAnalyzer {
        calculateTeamScore(team) {
            const filledSlots = team.filter(unit => unit !== null);
            
            if (filledSlots.length === 0) return 0;

            let score = 30; // Score de base

            // Bonus diversité élémentaire
            const elements = [...new Set(filledSlots.map(unit => unit.element))];
            score += elements.length * 12;

            // Bonus nombre d'unités
            score += filledSlots.length * 8;

            // Bonus rareté
            const ssrCount = filledSlots.filter(unit => unit.rarity === 'SSR').length;
            const srCount = filledSlots.filter(unit => unit.rarity === 'SR').length;
            score += ssrCount * 8 + srCount * 4;

            // Bonus niveau moyen
            const avgLevel = filledSlots.reduce((sum, unit) => sum + unit.level, 0) / filledSlots.length;
            if (avgLevel >= 40) score += 10;
            else if (avgLevel >= 30) score += 5;

            // Bonus compétences
            const avgSkills = filledSlots.reduce((sum, unit) => sum + (unit.s1 + unit.s2 + unit.s3) / 3, 0) / filledSlots.length;
            if (avgSkills >= 4) score += 8;
            else if (avgSkills >= 3) score += 4;

            // Malus déséquilibre (si trop du même élément)
            const maxElementCount = Math.max(...elements.map(el => filledSlots.filter(unit => unit.element === el).length));
            if (maxElementCount > 3) score -= 10;

            return Math.min(100, Math.max(0, Math.round(score)));
        }

        getScoreDescription(score) {
            if (score >= 85) return 'Excellente synergie';
            if (score >= 70) return 'Bonne composition';
            if (score >= 50) return 'Synergie correcte';
            if (score >= 30) return 'Amélioration possible';
            return 'Équipe à retravailler';
        }

        getScoreClass(score) {
            if (score >= 85) return 'excellent';
            if (score >= 70) return 'good';
            return 'poor';
        }

        getTeamDetails(team) {
            const filledSlots = team.filter(unit => unit !== null);
            const details = [];

            if (filledSlots.length > 0) {
                // Diversité élémentaire
                const elements = [...new Set(filledSlots.map(unit => unit.element))];
                details.push({
                    label: 'Diversité élémentaire',
                    value: `+${elements.length * 12}`,
                    type: 'bonus'
                });

                // Rareté moyenne
                const ssrCount = filledSlots.filter(unit => unit.rarity === 'SSR').length;
                if (ssrCount > 0) {
                    details.push({
                        label: `${ssrCount} unité(s) SSR`,
                        value: `+${ssrCount * 8}`,
                        type: 'bonus'
                    });
                }

                // Niveau moyen
                const avgLevel = Math.round(filledSlots.reduce((sum, unit) => sum + unit.level, 0) / filledSlots.length);
                details.push({
                    label: `Niveau moyen: ${avgLevel}`,
                    value: avgLevel >= 40 ? '+10' : avgLevel >= 30 ? '+5' : '0',
                    type: avgLevel >= 30 ? 'bonus' : 'neutral'
                });

                // Déséquilibre d'éléments
                const maxElementCount = Math.max(...elements.map(el => filledSlots.filter(unit => unit.element === el).length));
                if (maxElementCount > 3) {
                    details.push({
                        label: 'Déséquilibre élémentaire',
                        value: '-10',
                        type: 'malus'
                    });
                }
            }

            return details;
        }
    }

    // === OPTIMISATION DES PERFORMANCES ===
    class PerformanceOptimizer {
        constructor() {
            this.lazyImageObserver = null;
            this.init();
        }

        init() {
            this.setupLazyLoading();
        }

        setupLazyLoading() {
            if ('IntersectionObserver' in window) {
                this.lazyImageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.classList.add('loaded');
                                img.removeAttribute('data-src');
                                this.lazyImageObserver.unobserve(img);
                            }
                        }
                    });
                });
            }
        }

        observeImage(img) {
            if (this.lazyImageObserver && img.dataset.src) {
                this.lazyImageObserver.observe(img);
            }
        }

        // Fonction utilitaire pour optimiser les grandes listes
        virtualizeList(container, items, renderItem, itemHeight = 60) {
            const containerHeight = container.clientHeight;
            const visibleCount = Math.ceil(containerHeight / itemHeight) + 2;
            
            let scrollTop = container.scrollTop;
            let startIndex = Math.floor(scrollTop / itemHeight);
            let endIndex = Math.min(startIndex + visibleCount, items.length);
            
            // Nettoyer le container
            container.innerHTML = '';
            
            // Créer un spacer pour maintenir la hauteur de défilement
            const spacer = document.createElement('div');
            spacer.style.height = `${items.length * itemHeight}px`;
            spacer.style.position = 'relative';
            container.appendChild(spacer);
            
            // Rendre seulement les éléments visibles
            for (let i = startIndex; i < endIndex; i++) {
                const element = renderItem(items[i], i);
                element.style.position = 'absolute';
                element.style.top = `${i * itemHeight}px`;
                element.style.width = '100%';
                element.style.height = `${itemHeight}px`;
                spacer.appendChild(element);
            }
        }
    }

    // === VARIABLES GLOBALES ===
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

    // Instances des gestionnaires
    const filterManager = new FilterManager();
    const synergyAnalyzer = new SynergyAnalyzer();
    const performanceOptimizer = new PerformanceOptimizer();

    // === SÉLECTION DES ÉLÉMENTS DU DOM ===
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
    
    const backToTopBtn = document.getElementById('back-to-top-btn');

    // === ROUTINE QUOTIDIENNE ===
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
        if (!routineTrackerContent) return;
        
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

    // === NAVIGATION ===
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
            updateSynergyAnalysis();
        } else if (viewToShow === 'objectives') {
            objectivesView.classList.add('active');
            showObjectivesBtn.classList.add('active');
            renderManualObjectives();
        }
    };

    // === OBJECTIFS ===
    const addObjectiveForm = document.getElementById('add-objective-form');
    const newObjectiveInput = document.getElementById('new-objective-input');
    const objectivesListContainer = document.getElementById('objectives-list');

    const renderManualObjectives = () => {
        if (!objectivesListContainer) return;
        
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

    // === GESTION DES UNITÉS ===
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
                notificationManager.success('Données chargées', `Informations pour ${foundUnit.name} trouvées !`);
            }
        } catch (error) {
            console.error("Erreur lors de la récupération de la base de données d'unités:", error);
            notificationManager.error("Erreur", "Impossible de charger la base de données des unités.");
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
        const filteredUnits = filterManager.filterUnits(units);
        const sortedUnits = filterManager.sortUnits(filteredUnits);
        
        renderTable(sortedUnits);
        updateSortHeaders();
        filterManager.updateResultsInfo(filteredUnits.length, units.length);
    };

    const renderTable = (unitsToDisplay) => {
        if (!unitListBody) return;
        
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
            checkbox.checked = document.getElementById('select-all-checkbox')?.checked || false;

            if (checkbox.checked) {
                row.classList.add('selected-row');
            }

            const img = rowFragment.querySelector('.unit-image-cell img');
            img.alt = unit.name;

            if (unit.image) {
                img.dataset.src = unit.image;
                performanceOptimizer.observeImage(img);
            } else {
                const formattedName = unit.name.trim().replace(/ /g, '_').toLowerCase();
                img.dataset.src = `${imageBaseUrl}${formattedName}.webp`;
                performanceOptimizer.observeImage(img);
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
        if (!table) return;
        
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
            notificationManager.error('Erreur', 'Unité introuvable pour édition.');
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

    function closeEditModal() { 
        if (editModal) editModal.style.display = 'none'; 
    }

    const updateSelectionState = () => {
        const allCheckboxes = document.querySelectorAll('.unit-checkbox');
        const checkedCheckboxes = document.querySelectorAll('.unit-checkbox:checked');

        if (checkedCheckboxes.length > 0) {
            deleteSelectedBtn.style.display = 'inline-flex';
            deleteSelectedBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i> Supprimer (${checkedCheckboxes.length})`;
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

    // === TEAM BUILDER ===
    const renderTeamBuilderUnitList = () => {
        if (!teamBuilderUnitList) return;
        
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
        if (!teamSlotsContainer) return;
        
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
        if (!teamSelect) return;
        
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

    // === ANALYSE DE SYNERGIES ===
    const updateSynergyAnalysis = () => {
        const activeTeam = teams.find(team => team.id === activeTeamId);
        if (!activeTeam) return;

        const teamUnits = activeTeam.units || [null, null, null, null, null];
        const score = synergyAnalyzer.calculateTeamScore(teamUnits);
        const details = synergyAnalyzer.getTeamDetails(teamUnits);

        // Mettre à jour le score
        const scoreCircle = document.getElementById('synergy-score-circle');
        const scoreValue = document.getElementById('synergy-score-value');
        const scoreDescription = document.getElementById('synergy-description');

        if (scoreCircle && scoreValue && scoreDescription) {
            scoreValue.textContent = score;
            scoreDescription.textContent = synergyAnalyzer.getScoreDescription(score);
            
            scoreCircle.className = `score-circle ${synergyAnalyzer.getScoreClass(score)}`;
            
            // Mettre à jour la progression circulaire
            const percentage = Math.min(100, score);
            scoreCircle.style.background = `conic-gradient(var(--primary-color) ${percentage}%, rgba(255,255,255,0.2) 0%)`;
        }

        // Mettre à jour les détails
        const detailsContainer = document.getElementById('synergy-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = '';
            
            details.forEach(detail => {
                const item = document.createElement('div');
                item.className = 'synergy-item';
                item.innerHTML = `
                    <span>${detail.label}</span>
                    <span class="synergy-${detail.type}">${detail.value}</span>
                `;
                detailsContainer.appendChild(item);
            });
        }
    };

    // === DASHBOARD ===
    const updateDashboard = () => {
        const totalUnits = units.length;
        const totalUnitsEl = document.getElementById('stat-total-units');
        if (totalUnitsEl) totalUnitsEl.innerText = totalUnits;
        
        const rarityCounts = units.reduce((acc, unit) => {
            acc[unit.rarity] = (acc[unit.rarity] || 0) + 1;
            return acc;
        }, {});
        
        const ssrCountEl = document.getElementById('stat-ssr-count');
        const srCountEl = document.getElementById('stat-sr-count');
        const rCountEl = document.getElementById('stat-r-count');
        
        if (ssrCountEl) ssrCountEl.innerText = rarityCounts['SSR'] || 0;
        if (srCountEl) srCountEl.innerText = rarityCounts['SR'] || 0;
        if (rCountEl) rCountEl.innerText = rarityCounts['R'] || 0;

        // Nouvelles statistiques moyennes
        if (totalUnits > 0) {
            const avgLevel = Math.round(units.reduce((sum, unit) => sum + unit.level, 0) / totalUnits);
            const avgStars = Math.round((units.reduce((sum, unit) => sum + unit.stars, 0) / totalUnits) * 10) / 10;
            const avgPower = Math.round(units.reduce((sum, unit) => sum + (unit.level * unit.stars * 100), 0) / totalUnits);

            const avgLevelEl = document.getElementById('avg-level');
            const avgStarsEl = document.getElementById('avg-stars');
            const avgPowerEl = document.getElementById('avg-power');

            if (avgLevelEl) avgLevelEl.innerText = avgLevel;
            if (avgStarsEl) avgStarsEl.innerText = avgStars;
            if (avgPowerEl) avgPowerEl.innerText = avgPower.toLocaleString();
        }
        
        const elementCounts = units.reduce((acc, unit) => {
            acc[unit.element] = (acc[unit.element] || 0) + 1;
            return acc;
        }, {});
        
        const elementDistributionDiv = document.getElementById('stat-element-distribution');
        if (elementDistributionDiv) {
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
        }
    };

    // === CONFIRMATIONS ===
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

    // === EVENT LISTENERS ===
    
    // Initialisation des thèmes
    ThemeManager.init();

    // Navigation
    showManagerBtn?.addEventListener('click', () => switchView('manager'));
    showBuilderBtn?.addEventListener('click', () => switchView('builder'));
    showObjectivesBtn?.addEventListener('click', () => switchView('objectives'));

    // Bouton retour en haut
    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('active');
            } else {
                backToTopBtn.classList.remove('active');
            }
        });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    // Formulaire d'ajout
    addForm?.addEventListener('submit', async (event) => {
        event.preventDefault();

        const unitName = document.getElementById('unit-name').value;
        const loadingId = notificationManager.loading('Ajout en cours', 'Sauvegarde de l\'unité...');

        let imageUrl = unitImageData;
        if (currentImageFile) {
            const storageRef = storage.ref(`unit_images/${unitName}_${Date.now()}_${currentImageFile.name}`);
            try {
                notificationManager.remove(loadingId);
                const uploadId = notificationManager.loading("Téléchargement", "Upload de l'image en cours...");
                const snapshot = await storageRef.put(currentImageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
                notificationManager.remove(uploadId);
                notificationManager.success("Image uploadée", "L'image a été téléchargée avec succès !");
            } catch (error) {
                console.error("Error uploading image:", error);
                notificationManager.remove(loadingId);
                notificationManager.error("Erreur d'upload", "Impossible de télécharger l'image.");
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
            notificationManager.remove(loadingId);
            notificationManager.success('Unité ajoutée', `${newUnit.name} a été ajouté avec succès !`);
            resetAddForm();
        } catch (e) {
            console.error("Error adding document: ", e);
            notificationManager.remove(loadingId);
            notificationManager.error("Erreur", "Impossible d'ajouter l'unité.");
        }
    });

    clearFormBtn?.addEventListener('click', resetAddForm);

    unitNameInput?.addEventListener('blur', () => {
        const name = unitNameInput.value;
        findUnitImage(name);
        fetchAndFillUnitData(name);
    });

    imagePlaceholder?.addEventListener('click', () => imageInput?.click());
    imageInput?.addEventListener('change', (event) => {
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

    // Contrôles numériques
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

    // Actions sur les unités
    unitListBody?.addEventListener('click', async (event) => {
        const button = event.target.closest('button');
        const checkbox = event.target.closest('.unit-checkbox');

        if (button && button.dataset.id) {
            const unitId = button.dataset.id;

            if (button.classList.contains('favorite-btn')) {
                const unitToUpdate = units.find(u => u.id === unitId);
                if (unitToUpdate) {
                    try {
                        await unitsCol.doc(unitId).update({ isFavorite: !unitToUpdate.isFavorite });
                        notificationManager.info("Favori", `${unitToUpdate.name} ${unitToUpdate.isFavorite ? 'retiré des' : 'ajouté aux'} favoris.`);
                    } catch (e) {
                        console.error("Error updating favorite status: ", e);
                        notificationManager.error("Erreur", "Impossible de mettre à jour le statut favori.");
                    }
                }
            } else if (button.classList.contains('edit-btn')) {
                openEditModal(unitId);
            } else if (button.classList.contains('delete-btn')) {
                const unitName = units.find(u => u.id === unitId)?.name || 'cette unité';
                if (await showConfirm('Supprimer', `Êtes-vous sûr de vouloir supprimer ${unitName} ?`)) {
                    try {
                        await unitsCol.doc(unitId).delete();
                        notificationManager.info('Suppression', `${unitName} a été supprimé.`);
                    } catch (e) {
                        console.error("Error deleting document: ", e);
                        notificationManager.error("Erreur", "Impossible de supprimer l'unité.");
                    }
                }
            }
        }

        if (checkbox) {
            updateSelectionState();
        }
    });

    // Tri des colonnes
    table?.querySelector('thead')?.addEventListener('click', (event) => {
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

    // Sélection multiple
    selectAllCheckbox?.addEventListener('change', () => {
        document.querySelectorAll('.unit-checkbox').forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        updateSelectionState();
    });

    deleteSelectedBtn?.addEventListener('click', async () => {
        const selectedIds = Array.from(document.querySelectorAll('.unit-checkbox:checked')).map(cb => cb.dataset.id);
        if (selectedIds.length === 0) return;
        if(await showConfirm('Suppression en masse', `Êtes-vous sûr de vouloir supprimer ${selectedIds.length} unité(s) ?`)) {
            const loadingId = notificationManager.loading('Suppression', 'Suppression en cours...');
            try {
                const batch = db.batch();
                selectedIds.forEach(id => {
                    const docRef = unitsCol.doc(id);
                    batch.delete(docRef);
                });
                await batch.commit();
                notificationManager.remove(loadingId);
                notificationManager.success('Suppression terminée', `${selectedIds.length} unité(s) supprimée(s).`);
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
                deleteSelectedBtn.style.display = 'none';
            } catch (e) {
                console.error("Error batch deleting documents: ", e);
                notificationManager.remove(loadingId);
                notificationManager.error("Erreur", "Impossible de supprimer les unités sélectionnées.");
            }
        }
    });

    // Édition des unités
    editForm?.addEventListener('submit', async (event) => {
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
            notificationManager.success('Modification', 'Les modifications ont été sauvegardées.');
            closeEditModal();
        } catch (e) {
            console.error("Error updating document: ", e);
            notificationManager.error("Erreur", "Impossible de sauvegarder les modifications.");
        }
    });

    closeModalBtn?.addEventListener('click', closeEditModal);
    window.addEventListener('click', (event) => { if (event.target == editModal) closeEditModal(); });

    // Import/Export
    exportBtn?.addEventListener('click', () => {
        if (units.length === 0 && teams.length === 0 && manualObjectives.length === 0 && Object.keys(dailyRoutine).length === 0) {
            notificationManager.warning("Aucune donnée", "Il n'y a aucune donnée à exporter.");
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
        notificationManager.success('Export', 'Sauvegarde créée avec succès !');
    });

    importInput?.addEventListener('change', (event) => {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                if (await showConfirm('Import JSON', "Voulez-vous vraiment remplacer vos données par celles importées ? Cette action est irréversible.")) {
                    const loadingId = notificationManager.loading("Import", "Importation en cours...");
                    
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
                    
                    notificationManager.remove(loadingId);
                    notificationManager.success("Import réussi", "Toutes les données ont été importées !");
                }
            } catch (error) {
                console.error("Error during import:", error);
                notificationManager.error("Erreur d'import", "Le fichier est invalide ou corrompu.");
            } finally { importInput.value = ''; }
        };
        reader.readAsText(file);
    });

    importCsvInput?.addEventListener('change', (event) => {
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
                const loadingId = notificationManager.loading("Import CSV", "Traitement du fichier CSV...");

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
                notificationManager.remove(loadingId);
                notificationManager.success("Import CSV réussi", `${addedCount} unité(s) ajoutée(s), ${updatedCount} mise(s) à jour.`);
            } catch (error) {
                notificationManager.error("Erreur CSV", "Impossible de traiter le fichier CSV. Vérifiez le format.");
                console.error(error);
            } finally {
                importCsvInput.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    });

    // === FIREBASE LISTENERS ===
    const setupFirestoreListeners = () => {
        unitsCol.onSnapshot(snapshot => {
            units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            refreshUI();
            renderTeamBuilderUnitList();
            renderActiveTeam();
            updateSynergyAnalysis();
        }, error => {
            console.error("Error listening to units collection:", error);
            notificationManager.error("Erreur de sync", "Problème de synchronisation des unités.");
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
                            notificationManager.info("Équipe créée", "Équipe par défaut créée.");
                        })
                        .catch(e => console.error("Error creating default team: ", e));
                }
            }
            renderTeamSelect();
            renderActiveTeam();
            updateSynergyAnalysis();
        }, error => {
            console.error("Error listening to teams collection:", error);
            notificationManager.error("Erreur de sync", "Problème de synchronisation des équipes.");
        });

        manualObjectivesCol.orderBy('text').onSnapshot(snapshot => {
            manualObjectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderManualObjectives();
        }, error => {
            console.error("Error listening to objectives collection:", error);
            notificationManager.error("Erreur de sync", "Problème de synchronisation des objectifs.");
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
            notificationManager.error("Erreur de sync", "Problème de synchronisation de la routine.");
        });
    };

    const refreshUI = () => {
        displayUnits();
        updateDashboard();
        updateSelectionState();
    };

    // === INITIALISATION ===
    setupFirestoreListeners();
    switchView('manager');
    notificationManager.success('Application prête', 'Etheria Manager est démarré !');

    // Log de démarrage pour debugging
    console.log('🚀 Etheria Restart Manager - Version Améliorée');
    console.log('✅ Notifications améliorées');
    console.log('✅ Filtres avancés');
    console.log('✅ Thèmes personnalisés');
    console.log('✅ Analyse de synergies');
    console.log('✅ Optimisations de performance');
    console.log('✅ Configuration Firebase sécurisée');
});
