const SUPABASE_URL = "https://maypmuwxpqepijufjhhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MPnN42PeTl9MkGK1T1qeQ_nOx_3Q1L";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let grades = [];

let navigationReady = false;
let buttonsReady = false;
let authReady = false;

const main = document.querySelector("main");


/* =========================
   DÉMARRAGE
========================= */

async function startApp() {

    bindAuthUI();

    const {
        data: { session },
        error
    } = await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        showAuth();
        return;
    }

    if (!session) {
        showAuth();
        return;
    }

    await enterApp(session);
}


/* =========================
   AUTH — AFFICHAGE
========================= */

function showAuth() {

    const authScreen =
        document.getElementById("auth-screen");

    const app =
        document.getElementById("app");

    if (authScreen) {
        authScreen.style.display = "flex";
    }

    if (app) {
        app.style.display = "none";
    }
}


async function enterApp(session) {

    if (!session) {
        showAuth();
        return;
    }

    currentUser = session.user;

    const authScreen =
        document.getElementById("auth-screen");

    const app =
        document.getElementById("app");

    if (authScreen) {
        authScreen.style.display = "none";
    }

    if (app) {
        app.style.display = "block";
    }

    await loadProfile();
    await loadGrades();
    loadTarget();

    setupNavigation();
    setupButtons();
}


/* =========================
   PROFIL
========================= */

async function loadProfile() {

    if (!currentUser) return;

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

    if (error) {
        console.error(error);
        return;
    }

    const name =
        data?.name ||
        currentUser.user_metadata?.name ||
        currentUser.email?.split("@")[0] ||
        "toi";

    const welcome =
        document.getElementById("welcome");

    if (welcome) {
        welcome.textContent =
            `Bonjour ${name}`;
    }

    const avatar =
        document.getElementById("avatar");

    if (avatar) {
        avatar.textContent =
            name.charAt(0).toUpperCase();
    }
}


/* =========================
   NOTES
========================= */

async function loadGrades() {

    if (!currentUser) return;

    const {
        data,
        error
    } = await supabaseClient
        .from("grades")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("grade_date", {
            ascending: false
        });

    if (error) {
        console.error(error);
        return;
    }

    grades = data || [];

    displayGrades(grades);
    calculateAverage(grades);
}


function displayGrades(list) {

    const container =
        document.getElementById("grades-list");

    const count =
        document.getElementById("grades-count");

    if (!container) return;

    if (count) {
        count.textContent = list.length;
    }

    if (list.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>

                <h3>
                    Aucune note
                </h3>

                <p>
                    Ajoute ta première note pour commencer.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        list.map(grade => {

            const date =
                grade.grade_date
                    ? new Date(
                        grade.grade_date
                    ).toLocaleDateString("fr-FR")
                    : "—";

            return `
                <div class="grade-row">

                    <strong>
                        ${escapeHTML(
                            grade.subject
                        )}
                    </strong>

                    <div class="grade-value">
                        ${grade.grade}/20
                    </div>

                    <div>
                        Coef.
                        ${grade.coefficient || 1}
                    </div>

                    <div class="grade-type">
                        ${escapeHTML(
                            grade.grade_type || "Note"
                        )}
                    </div>

                    <div class="grade-date">
                        ${date}
                    </div>

                    <button
                        class="delete-grade"
                        data-delete-grade="${grade.id}"
                    >
                        Supprimer
                    </button>

                </div>
            `;

        }).join("");

    document
        .querySelectorAll("[data-delete-grade]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    deleteGrade(
                        button.dataset.deleteGrade
                    );

                }
            );

        });
}


/* =========================
   MOYENNE
========================= */

function calculateAverage(list) {

    if (list.length === 0) {

        setAverage("—");

        const brevetEstimate =
            document.getElementById(
                "brevet-estimate"
            );

        const brevetBig =
            document.getElementById(
                "brevet-big"
            );

        if (brevetEstimate) {
            brevetEstimate.textContent = "—";
        }

        if (brevetBig) {
            brevetBig.textContent = "—";
        }

        updateProgress(NaN);

        return;
    }

    let total = 0;
    let coefficients = 0;

    list.forEach(grade => {

        const coefficient =
            Number(grade.coefficient) || 1;

        total +=
            Number(grade.grade) *
            coefficient;

        coefficients += coefficient;

    });

    const average =
        total / coefficients;

    const formatted =
        average.toFixed(2);

    setAverage(formatted);

    const brevetEstimate =
        document.getElementById(
            "brevet-estimate"
        );

    const brevetBig =
        document.getElementById(
            "brevet-big"
        );

    if (brevetEstimate) {
        brevetEstimate.textContent =
            formatted;
    }

    if (brevetBig) {
        brevetBig.textContent =
            formatted;
    }

    updateProgress(average);
}


function setAverage(value) {

    const generalAverage =
        document.getElementById(
            "general-average"
        );

    const averageCard =
        document.getElementById(
            "average-card"
        );

    if (generalAverage) {
        generalAverage.textContent =
            value;
    }

    if (averageCard) {
        averageCard.textContent =
            value;
    }
}


/* =========================
   OBJECTIF
========================= */

function loadTarget() {

    if (!currentUser) return;

    const target =
        localStorage.getItem(
            `brevettrack_target_${currentUser.id}`
        );

    if (!target) return;

    const value =
        Number(target).toFixed(1);

    const targetAverage =
        document.getElementById(
            "target-average"
        );

    const targetCircle =
        document.getElementById(
            "target-circle-value"
        );

    const targetInput =
        document.getElementById(
            "target-input"
        );

    if (targetAverage) {
        targetAverage.textContent =
            value;
    }

    if (targetCircle) {
        targetCircle.textContent =
            value;
    }

    if (targetInput) {
        targetInput.value =
            target;
    }

    const average =
        Number(
            document.getElementById(
                "average-card"
            )?.textContent
        );

    updateProgress(average);
}


function saveTarget() {

    if (!currentUser) return;

    const input =
        document.getElementById(
            "target-input"
        );

    if (!input) return;

    const target =
        Number(input.value);

    if (
        isNaN(target) ||
        target < 0 ||
        target > 20
    ) {

        alert(
            "Entre une moyenne entre 0 et 20."
        );

        return;
    }

    localStorage.setItem(
        `brevettrack_target_${currentUser.id}`,
        target
    );

    const targetAverage =
        document.getElementById(
            "target-average"
        );

    const targetCircle =
        document.getElementById(
            "target-circle-value"
        );

    if (targetAverage) {
        targetAverage.textContent =
            target.toFixed(1);
    }

    if (targetCircle) {
        targetCircle.textContent =
            target.toFixed(1);
    }

    const average =
        Number(
            document.getElementById(
                "average-card"
            )?.textContent
        );

    updateProgress(average);
}


function updateProgress(average) {

    if (!currentUser) return;

    const target =
        Number(
            localStorage.getItem(
                `brevettrack_target_${currentUser.id}`
            )
        );

    const progressBar =
        document.getElementById(
            "progress-bar"
        );

    const progressText =
        document.getElementById(
            "progress-text"
        );

    if (!progressBar || !progressText) {
        return;
    }

    if (
        !target ||
        isNaN(average)
    ) {

        progressBar.style.width =
            "0%";

        progressText.textContent =
            "—";

        return;
    }

    const percentage =
        Math.min(
            (average / target) * 100,
            100
        );

    progressBar.style.width =
        `${percentage}%`;

    progressText.textContent =
        `${Math.round(percentage)}%`;
}


/* =========================
   MODALE NOTE
========================= */

function openGradeModal() {

    const modal =
        document.getElementById(
            "grade-modal"
        );

    if (!modal) return;

    modal.classList.remove(
        "hidden"
    );

    const dateInput =
        document.getElementById(
            "date-input"
        );

    if (dateInput) {

        dateInput.value =
            new Date()
                .toISOString()
                .split("T")[0];

    }
}


function closeGradeModal() {

    const modal =
        document.getElementById(
            "grade-modal"
        );

    if (!modal) return;

    modal.classList.add(
        "hidden"
    );
}


/* =========================
   ENREGISTRER NOTE
========================= */

async function saveGrade() {

    if (!currentUser) return;

    const subject =
        document
            .getElementById(
                "subject-input"
            )
            ?.value
            .trim();

    const grade =
        Number(
            document.getElementById(
                "grade-input"
            )?.value
        );

    const coefficient =
        Number(
            document.getElementById(
                "coefficient-input"
            )?.value
        );

    const type =
        document.getElementById(
            "type-input"
        )?.value || "Note";

    const date =
        document.getElementById(
            "date-input"
        )?.value;

    const message =
        document.getElementById(
            "grade-message"
        );

    if (
        !subject ||
        isNaN(grade) ||
        grade < 0 ||
        grade > 20
    ) {

        if (message) {
            message.textContent =
                "Vérifie la matière et la note.";
        }

        return;
    }

    const {
        error
    } = await supabaseClient
        .from("grades")
        .insert({

            user_id: currentUser.id,
            subject,
            grade,
            coefficient:
                coefficient || 1,
            grade_type: type,
            grade_date:
                date || null

        });

    if (error) {

        console.error(error);

        if (message) {
            message.textContent =
                "Erreur : " +
                error.message;
        }

        return;
    }

    if (message) {
        message.textContent =
            "Note ajoutée !";
    }

    const subjectInput =
        document.getElementById(
            "subject-input"
        );

    const gradeInput =
        document.getElementById(
            "grade-input"
        );

    const coefficientInput =
        document.getElementById(
            "coefficient-input"
        );

    if (subjectInput) {
        subjectInput.value = "";
    }

    if (gradeInput) {
        gradeInput.value = "";
    }

    if (coefficientInput) {
        coefficientInput.value = "1";
    }

    await loadGrades();

    setTimeout(
        closeGradeModal,
        500
    );
}


/* =========================
   SUPPRIMER NOTE
========================= */

async function deleteGrade(id) {

    if (!currentUser) return;

    if (
        !confirm(
            "Supprimer cette note ?"
        )
    ) {
        return;
    }

    const {
        error
    } = await supabaseClient
        .from("grades")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

    if (error) {

        console.error(error);

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadGrades();
}


/* =========================
   NAVIGATION
========================= */

function setupNavigation() {

    if (navigationReady) return;

    const buttons =
        document.querySelectorAll(
            ".nav-item"
        );

    if (!buttons.length) return;

    navigationReady = true;

    buttons.forEach(
        (button, index) => {

            button.addEventListener(
                "click",
                () => {

                    buttons.forEach(
                        btn =>
                            btn.classList.remove(
                                "active"
                            )
                    );

                    button.classList.add(
                        "active"
                    );

                    if (index === 0) {
                        showDashboard();
                    }

                    if (index === 1) {
                        showNotes();
                    }

                    if (index === 2) {
                        showTodo();
                    }

                    if (index === 3) {
                        showBrevet();
                    }

                    if (index === 4) {
                        showCalendar();
                    }

                }
            );

        }
    );
}


/* =========================
   DASHBOARD
========================= */

async function showDashboard() {

    if (!currentUser) return;

    /*
       On recharge uniquement le contenu
       du dashboard sans recharger toute
       la page.
    */

    main.innerHTML = `

        <section class="hero-card">

            <div>

                <p class="hero-label">
                    TA PROGRESSION
                </p>

                <h2>
                    Continue comme ça.
                </h2>

                <p class="hero-text">
                    Suis tes résultats et prépare ton brevet sereinement.
                </p>

            </div>

            <div class="hero-score">

                <span id="general-average">
                    —
                </span>

                <small>/20</small>

                <p>
                    Moyenne actuelle
                </p>

            </div>

        </section>


        <section class="stats-grid">

            <div class="stat-card">

                <div class="stat-top">
                    <span>Moyenne générale</span>
                    <span class="stat-icon">↗</span>
                </div>

                <strong id="average-card">
                    —
                </strong>

                <p>
                    sur 20
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Notes</span>
                    <span class="stat-icon">▤</span>
                </div>

                <strong id="grades-count">
                    0
                </strong>

                <p>
                    notes enregistrées
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Objectif</span>
                    <span class="stat-icon">◎</span>
                </div>

                <strong id="target-average">
                    —
                </strong>

                <p>
                    moyenne visée
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Brevet</span>
                    <span class="stat-icon">★</span>
                </div>

                <strong id="brevet-estimate">
                    —
                </strong>

                <p>
                    estimation actuelle
                </p>

            </div>

        </section>


        <section class="dashboard-grid">

            <div class="card notes-card">

                <div class="card-header">

                    <div>

                        <h2>
                            Mes dernières notes
                        </h2>

                        <p>
                            Ton historique de résultats
                        </p>

                    </div>

                    <button
                        id="add-grade-btn"
                        class="primary-btn"
                    >
                        + Ajouter
                    </button>

                </div>

                <div id="grades-list"></div>

            </div>


            <div class="card target-card">

                <div class="card-header">

                    <div>

                        <h2>
                            Objectif
                        </h2>

                        <p>
                            Ta moyenne cible
                        </p>

                    </div>

                </div>


                <div class="target-circle">

                    <span id="target-circle-value">
                        —
                    </span>

                    <small>/20</small>

                </div>


                <label>
                    Nouvel objectif
                </label>

                <div class="target-input">

                    <input
                        id="target-input"
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="15"
                    >

                    <button id="target-btn">
                        OK
                    </button>

                </div>


                <div class="progress-area">

                    <div class="progress-label">

                        <span>
                            Progression
                        </span>

                        <strong id="progress-text">
                            —
                        </strong>

                    </div>

                    <div class="progress">

                        <div id="progress-bar"></div>

                    </div>

                </div>

            </div>

        </section>


        <section class="card brevet-card">

            <div class="brevet-left">

                <div class="brevet-icon">
                    ★
                </div>

                <div>

                    <p class="eyebrow">
                        OBJECTIF BREVET
                    </p>

                    <h2>
                        Prépare ton diplôme
                    </h2>

                    <p>
                        Ton estimation évoluera automatiquement avec tes notes.
                    </p>

                </div>

            </div>


            <div class="brevet-result">

                <strong id="brevet-big">
                    —
                </strong>

                <span>
                    /20
                </span>

            </div>

        </section>

    `;

    displayGrades(grades);
    calculateAverage(grades);
    loadTarget();

    document
        .getElementById(
            "add-grade-btn"
        )
        ?.addEventListener(
            "click",
            openGradeModal
        );

    document
        .getElementById(
            "target-btn"
        )
        ?.addEventListener(
            "click",
            saveTarget
        );
}


/* =========================
   PAGE NOTES
========================= */

function showNotes() {

    main.innerHTML = `

        <section class="card">

            <div class="card-header">

                <div>

                    <h2>
                        Toutes mes notes
                    </h2>

                    <p>
                        ${grades.length}
                        note(s) enregistrée(s)
                    </p>

                </div>

                <button
                    id="notes-add-btn"
                    class="primary-btn"
                >
                    + Ajouter une note
                </button>

            </div>

            <div id="notes-page-list"></div>

        </section>

    `;

    const container =
        document.getElementById(
            "notes-page-list"
        );

    if (!container) return;

    if (grades.length === 0) {

        container.innerHTML = `

            <div class="empty">

                <div class="empty-icon">
                    ▤
                </div>

                <h3>
                    Aucune note
                </h3>

                <p>
                    Ajoute une note pour commencer.
                </p>

            </div>

        `;

    } else {

        container.innerHTML =
            grades.map(grade => {

                const date =
                    grade.grade_date
                        ? new Date(
                            grade.grade_date
                        ).toLocaleDateString(
                            "fr-FR"
                        )
                        : "—";

                return `

                    <div class="grade-row">

                        <strong>
                            ${escapeHTML(
                                grade.subject
                            )}
                        </strong>

                        <div class="grade-value">
                            ${grade.grade}/20
                        </div>

                        <div>
                            Coef.
                            ${grade.coefficient || 1}
                        </div>

                        <div class="grade-type">
                            ${escapeHTML(
                                grade.grade_type ||
                                "Note"
                            )}
                        </div>

                        <div class="grade-date">
                            ${date}
                        </div>

                        <button
                            class="delete-grade"
                            data-delete-grade="${grade.id}"
                        >
                            Supprimer
                        </button>

                    </div>

                `;

            }).join("");

    }

    document
        .getElementById(
            "notes-add-btn"
        )
        ?.addEventListener(
            "click",
            openGradeModal
        );

    document
        .querySelectorAll(
            "[data-delete-grade]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    await deleteGrade(
                        button.dataset.deleteGrade
                    );

                    showNotes();

                }
            );

        });
}


/* =========================
   PAGE À FAIRE
========================= */

function showTodo() {

    const key =
        `brevettrack_todos_${currentUser.id}`;

    let todos =
        JSON.parse(
            localStorage.getItem(key) ||
            "[]"
        );

    main.innerHTML = `

        <section class="card">

            <div class="card-header">

                <div>

                    <h2>
                        À faire
                    </h2>

                    <p>
                        Organise tes devoirs et révisions.
                    </p>

                </div>

                <button
                    id="add-todo"
                    class="primary-btn"
                >
                    + Ajouter
                </button>

            </div>

            <div id="todo-list"></div>

        </section>

    `;

    function renderTodos() {

        const list =
            document.getElementById(
                "todo-list"
            );

        if (!list) return;

        if (todos.length === 0) {

            list.innerHTML = `

                <div class="empty">

                    <div class="empty-icon">
                        ✓
                    </div>

                    <h3>
                        Rien à faire
                    </h3>

                    <p>
                        Ajoute un devoir ou une révision.
                    </p>

                </div>

            `;

            return;
        }

        list.innerHTML =
            todos.map(
                (todo, index) => `

                    <div class="grade-row">

                        <strong>
                            ${escapeHTML(
                                todo.text
                            )}
                        </strong>

                        <div>
                            ${escapeHTML(
                                todo.date ||
                                "Sans date"
                            )}
                        </div>

                        <div>
                            ${escapeHTML(
                                todo.priority ||
                                "Normal"
                            )}
                        </div>

                        <button
                            class="delete-grade"
                            data-todo="${index}"
                        >
                            Terminé
                        </button>

                    </div>

                `
            ).join("");

        document
            .querySelectorAll(
                "[data-todo]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    () => {

                        todos.splice(
                            Number(
                                button.dataset.todo
                            ),
                            1
                        );

                        localStorage.setItem(
                            key,
                            JSON.stringify(
                                todos
                            )
                        );

                        renderTodos();

                    }
                );

            });
    }

    document
        .getElementById(
            "add-todo"
        )
        ?.addEventListener(
            "click",
            () => {

                const text =
                    prompt(
                        "Quel est le devoir ?"
                    );

                if (!text) return;

                const date =
                    prompt(
                        "Date limite ?"
                    );

                todos.push({

                    text,
                    date: date || "",
                    priority: "Normal"

                });

                localStorage.setItem(
                    key,
                    JSON.stringify(todos)
                );

                renderTodos();

            }
        );

    renderTodos();
}


/* =========================
   PAGE BREVET
========================= */

function showBrevet() {

    const average =
        document.getElementById(
            "average-card"
        )?.textContent || "—";

    const target =
        localStorage.getItem(
            `brevettrack_target_${currentUser.id}`
        ) || "—";

    main.innerHTML = `

        <section class="hero-card">

            <div>

                <p class="hero-label">
                    ESTIMATION
                </p>

                <h2>
                    Ton brevet
                </h2>

                <p class="hero-text">
                    Cette estimation évoluera avec tes résultats.
                </p>

            </div>

            <div class="hero-score">

                <span>
                    ${average}
                </span>

                <small>
                    /20
                </small>

                <p>
                    moyenne actuelle
                </p>

            </div>

        </section>


        <section class="stats-grid">

            <div class="stat-card">

                <div class="stat-top">
                    <span>Moyenne</span>
                    <span>↗</span>
                </div>

                <strong>
                    ${average}
                </strong>

                <p>
                    /20
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Objectif</span>
                    <span>◎</span>
                </div>

                <strong>
                    ${target}
                </strong>

                <p>
                    /20
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Notes</span>
                    <span>▤</span>
                </div>

                <strong>
                    ${grades.length}
                </strong>

                <p>
                    enregistrées
                </p>

            </div>

        </section>


        <section class="card">

            <h2>
                Simulation
            </h2>

            <p
                style="
                    color:#7b8190;
                    margin-top:8px;
                "
            >
                Ajoute davantage de notes pour obtenir
                une estimation plus représentative.
            </p>

        </section>

    `;
}


/* =========================
   CALENDRIER
========================= */

function showCalendar() {

    const today =
        new Date().toLocaleDateString(
            "fr-FR",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );

    main.innerHTML = `

        <section class="card">

            <div class="card-header">

                <div>

                    <p class="eyebrow">
                        CALENDRIER
                    </p>

                    <h2>
                        ${today}
                    </h2>

                    <p>
                        Organise tes contrôles,
                        devoirs et révisions.
                    </p>

                </div>

            </div>


            <div class="empty">

                <div class="empty-icon">
                    ◷
                </div>

                <h3>
                    Ton calendrier arrive
                </h3>

                <p>
                    La prochaine étape sera
                    d'ajouter les événements scolaires.
                </p>

            </div>

        </section>

    `;
}


/* =========================
   BOUTONS
========================= */

function setupButtons() {

    if (buttonsReady) return;

    const addGrade =
        document.getElementById(
            "add-grade-btn"
        );

    const closeModal =
        document.getElementById(
            "close-modal"
        );

    const saveGradeButton =
        document.getElementById(
            "save-grade-btn"
        );

    const targetButton =
        document.getElementById(
            "target-btn"
        );

    const logoutButton =
        document.getElementById(
            "logout-btn"
        );

    if (
        !addGrade ||
        !closeModal ||
        !saveGradeButton ||
        !targetButton ||
        !logoutButton
    ) {
        return;
    }

    buttonsReady = true;

    addGrade.addEventListener(
        "click",
        openGradeModal
    );

    closeModal.addEventListener(
        "click",
        closeGradeModal
    );

    saveGradeButton.addEventListener(
        "click",
        saveGrade
    );

    targetButton.addEventListener(
        "click",
        saveTarget
    );

    logoutButton.addEventListener(
        "click",
        async () => {

            await supabaseClient.auth.signOut();

        }
    );
}


/* =========================
   AUTHENTIFICATION
========================= */

function bindAuthUI() {

    if (authReady) return;

    const loginTab =
        document.getElementById(
            "login-tab"
        );

    const signupTab =
        document.getElementById(
            "signup-tab"
        );

    const form =
        document.getElementById(
            "auth-form"
        );

    if (
        !loginTab ||
        !signupTab ||
        !form
    ) {
        return;
    }

    authReady = true;

    let mode = "login";


    function setMode(newMode) {

        mode = newMode;

        loginTab.classList.toggle(
            "active",
            mode === "login"
        );

        signupTab.classList.toggle(
            "active",
            mode === "signup"
        );

        const title =
            document.getElementById(
                "auth-title"
            );

        const subtitle =
            document.getElementById(
                "auth-subtitle"
            );

        const nameField =
            document.getElementById(
                "name-field"
            );

        const submit =
            document.getElementById(
                "auth-submit"
            );

        const password =
            document.getElementById(
                "auth-password"
            );

        if (mode === "login") {

            if (title) {
                title.textContent =
                    "Connexion";
            }

            if (subtitle) {
                subtitle.textContent =
                    "Connecte-toi à ton espace BrevetTrack.";
            }

            if (nameField) {
                nameField.classList.add(
                    "hidden"
                );
            }

            if (submit) {
                submit.textContent =
                    "Se connecter";
            }

            if (password) {
                password.autocomplete =
                    "current-password";
            }

        } else {

            if (title) {
                title.textContent =
                    "Créer un compte";
            }

            if (subtitle) {
                subtitle.textContent =
                    "Crée ton espace BrevetTrack.";
            }

            if (nameField) {
                nameField.classList.remove(
                    "hidden"
                );
            }

            if (submit) {
                submit.textContent =
                    "Créer mon compte";
            }

            if (password) {
                password.autocomplete =
                    "new-password";
            }

        }

        showAuthMessage(
            "",
            ""
        );
    }


    loginTab.addEventListener(
        "click",
        () => setMode("login")
    );

    signupTab.addEventListener(
        "click",
        () => setMode("signup")
    );


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const name =
                document
                    .getElementById(
                        "auth-name"
                    )
                    ?.value
                    .trim();

            const email =
                document
                    .getElementById(
                        "auth-email"
                    )
                    ?.value
                    .trim();

            const password =
                document
                    .getElementById(
                        "auth-password"
                    )
                    ?.value;

            const submit =
                document.getElementById(
                    "auth-submit"
                );

            if (!email || !password) {

                showAuthMessage(
                    "Remplis ton email et ton mot de passe.",
                    "error"
                );

                return;
            }

            if (
                mode === "signup" &&
                !name
            ) {

                showAuthMessage(
                    "Entre ton prénom.",
                    "error"
                );

                return;
            }

            if (password.length < 6) {

                showAuthMessage(
                    "Le mot de passe doit contenir au moins 6 caractères.",
                    "error"
                );

                return;
            }

            if (submit) {
                submit.disabled = true;
            }

            showAuthMessage(
                "Chargement...",
                ""
            );

            try {

                if (mode === "login") {

                    const {
                        data,
                        error
                    } =
                        await supabaseClient.auth
                            .signInWithPassword({

                                email,
                                password

                            });

                    if (error) {
                        throw error;
                    }

                    if (data.session) {

                        await enterApp(
                            data.session
                        );

                    }

                } else {

                    const {
                        data,
                        error
                    } =
                        await supabaseClient.auth
                            .signUp({

                                email,
                                password,

                                options: {
                                    data: {
                                        name
                                    }
                                }

                            });

                    if (error) {
                        throw error;
                    }

                    if (data.user) {

                        const {
                            error:
                            profileError
                        } =
                            await supabaseClient
                                .from("profiles")
                                .upsert({

                                    id:
                                        data.user.id,

                                    name

                                });

                        if (profileError) {

                            console.error(
                                profileError
                            );

                        }

                    }

                    if (data.session) {

                        await enterApp(
                            data.session
                        );

                    } else {

                        showAuthMessage(
                            "Compte créé. Connecte-toi pour continuer.",
                            "success"
                        );

                        setMode("login");

                    }

                }

            } catch (error) {

                console.error(error);

                showAuthMessage(
                    getAuthErrorMessage(
                        error
                    ),
                    "error"
                );

            } finally {

                if (submit) {
                    submit.disabled = false;
                }

            }

        }
    );


    setMode("login");
}


function showAuthMessage(
    message,
    type
) {

    const element =
        document.getElementById(
            "auth-message"
        );

    if (!element) return;

    element.textContent =
        message || "";

    element.className =
        "auth-message";

    if (type) {
        element.classList.add(type);
    }
}


function getAuthErrorMessage(error) {

    const message =
        error?.message || "";

    const lower =
        message.toLowerCase();

    if (
        lower.includes(
            "invalid login credentials"
        )
    ) {
        return "Email ou mot de passe incorrect.";
    }

    if (
        lower.includes(
            "email not confirmed"
        )
    ) {
        return "Ton email doit être confirmé.";
    }

    if (
        lower.includes(
            "user already registered"
        )
    ) {
        return "Ce compte existe déjà.";
    }

    if (
        lower.includes(
            "password"
        )
    ) {
        return "Le mot de passe doit contenir au moins 6 caractères.";
    }

    return message ||
        "Une erreur est survenue.";
}


/* =========================
   AUTH SUPABASE
========================= */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "SIGNED_IN" &&
            session
        ) {

            await enterApp(session);

            return;
        }

        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;
            grades = [];

            showAuth();

        }

    }
);


/* =========================
   UTILITAIRE
========================= */

function escapeHTML(text) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        String(text ?? "");

    return div.innerHTML;
}


/* =========================
   LANCEMENT
========================= */

startApp();