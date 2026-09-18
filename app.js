const SUPABASE_URL = "https://maypmuwxpqepijufjhhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MPnN42PeTl9MkGK1T1qeQ_nOx_3Q1L";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let grades = [];

const main = document.querySelector("main");
const modal = document.getElementById("grade-modal");


// =========================
// DÉMARRAGE
// =========================

async function startApp() {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        window.location.href = "index.html";
        return;
    }

    currentUser = session.user;

    await loadProfile();
    await loadGrades();
    loadTarget();

    setupNavigation();
    setupButtons();

}


// =========================
// PROFIL
// =========================

async function loadProfile() {

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {
        console.error(error);
        return;
    }

    const name = data.name || "toi";

    document.getElementById("welcome").textContent =
        `Bonjour ${name} 👋`;

}


// =========================
// NOTES
// =========================

async function loadGrades() {

    const { data, error } = await supabaseClient
        .from("grades")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("grade_date", { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    grades = data || [];

    displayGrades(grades);
    calculateAverage(grades);

}


function displayGrades(list) {

    const container = document.getElementById("grades-list");

    document.getElementById("grades-count").textContent =
        list.length;

    if (list.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>
                <h3>Aucune note</h3>
                <p>Ajoute ta première note pour commencer.</p>
            </div>
        `;

        return;
    }

    container.innerHTML = list.map(grade => {

        const date = grade.grade_date
            ? new Date(grade.grade_date)
                .toLocaleDateString("fr-FR")
            : "—";

        return `
            <div class="grade-row">

                <strong>${escapeHTML(grade.subject)}</strong>

                <div class="grade-value">
                    ${grade.grade}/20
                </div>

                <div>
                    Coef. ${grade.coefficient}
                </div>

                <div class="grade-type">
                    ${escapeHTML(grade.grade_type || "Note")}
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

            button.addEventListener("click", () => {

                deleteGrade(
                    button.dataset.deleteGrade
                );

            });

        });

}


function calculateAverage(list) {

    if (list.length === 0) {

        setAverage("—");

        document.getElementById("brevet-estimate").textContent = "—";
        document.getElementById("brevet-big").textContent = "—";

        return;
    }

    let total = 0;
    let coefficients = 0;

    list.forEach(grade => {

        const coefficient =
            Number(grade.coefficient) || 1;

        total +=
            Number(grade.grade) * coefficient;

        coefficients += coefficient;

    });

    const average =
        total / coefficients;

    setAverage(average.toFixed(2));

    document.getElementById("brevet-estimate").textContent =
        average.toFixed(2);

    document.getElementById("brevet-big").textContent =
        average.toFixed(2);

    updateProgress(average);

}


function setAverage(value) {

    document.getElementById("general-average").textContent = value;

    document.getElementById("average-card").textContent = value;

}


// =========================
// OBJECTIF
// =========================

function loadTarget() {

    const target =
        localStorage.getItem(
            `brevettrack_target_${currentUser.id}`
        );

    if (!target) return;

    document.getElementById("target-average").textContent =
        Number(target).toFixed(1);

    document.getElementById("target-circle-value").textContent =
        Number(target).toFixed(1);

    document.getElementById("target-input").value = target;

    updateProgress(
        Number(document.getElementById("average-card").textContent)
    );

}


function saveTarget() {

    const target =
        Number(document.getElementById("target-input").value);

    if (
        isNaN(target) ||
        target < 0 ||
        target > 20
    ) {
        alert("Entre une moyenne entre 0 et 20.");
        return;
    }

    localStorage.setItem(
        `brevettrack_target_${currentUser.id}`,
        target
    );

    document.getElementById("target-average").textContent =
        target.toFixed(1);

    document.getElementById("target-circle-value").textContent =
        target.toFixed(1);

    const average =
        Number(document.getElementById("average-card").textContent);

    updateProgress(average);

}


function updateProgress(average) {

    const target =
        Number(
            localStorage.getItem(
                `brevettrack_target_${currentUser.id}`
            )
        );

    if (!target || isNaN(average)) {

        document.getElementById("progress-bar").style.width = "0%";
        document.getElementById("progress-text").textContent = "—";

        return;
    }

    const percentage =
        Math.min((average / target) * 100, 100);

    document.getElementById("progress-bar").style.width =
        `${percentage}%`;

    document.getElementById("progress-text").textContent =
        `${Math.round(percentage)}%`;

}


// =========================
// AJOUT NOTE
// =========================

function openGradeModal() {

    modal.classList.remove("hidden");

    document.getElementById("date-input").value =
        new Date().toISOString().split("T")[0];

}


function closeGradeModal() {

    modal.classList.add("hidden");

}


async function saveGrade() {

    const subject =
        document.getElementById("subject-input")
            .value
            .trim();

    const grade =
        Number(
            document.getElementById("grade-input").value
        );

    const coefficient =
        Number(
            document.getElementById("coefficient-input").value
        );

    const type =
        document.getElementById("type-input").value;

    const date =
        document.getElementById("date-input").value;

    const message =
        document.getElementById("grade-message");

    if (
        !subject ||
        isNaN(grade) ||
        grade < 0 ||
        grade > 20
    ) {

        message.textContent =
            "Vérifie la matière et la note.";

        return;
    }

    const { error } =
        await supabaseClient
            .from("grades")
            .insert({

                user_id: currentUser.id,
                subject,
                grade,
                coefficient: coefficient || 1,
                grade_type: type,
                grade_date: date || null

            });

    if (error) {

        console.error(error);

        message.textContent =
            "Erreur : " + error.message;

        return;
    }

    message.textContent = "Note ajoutée !";

    document.getElementById("subject-input").value = "";
    document.getElementById("grade-input").value = "";
    document.getElementById("coefficient-input").value = "1";

    await loadGrades();

    setTimeout(closeGradeModal, 500);

}


// =========================
// SUPPRIMER NOTE
// =========================

async function deleteGrade(id) {

    if (!confirm("Supprimer cette note ?")) return;

    const { error } =
        await supabaseClient
            .from("grades")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

    if (error) {

        alert("Erreur : " + error.message);
        return;

    }

    await loadGrades();

}


// =========================
// NAVIGATION
// =========================

function setupNavigation() {

    const buttons =
        document.querySelectorAll(".nav-item");

    buttons.forEach((button, index) => {

        button.addEventListener("click", () => {

            buttons.forEach(btn =>
                btn.classList.remove("active")
            );

            button.classList.add("active");

            if (index === 0) showDashboard();
            if (index === 1) showNotes();
            if (index === 2) showTodo();
            if (index === 3) showBrevet();
            if (index === 4) showCalendar();

        });

    });

}


// =========================
// DASHBOARD
// =========================

function showDashboard() {

    location.reload();

}


// =========================
// PAGE NOTES
// =========================

function showNotes() {

    main.innerHTML = `

        <section class="card">

            <div class="card-header">

                <div>
                    <h2>Toutes mes notes</h2>
                    <p>${grades.length} note(s) enregistrée(s)</p>
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
        document.getElementById("notes-page-list");

    if (grades.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>
                <h3>Aucune note</h3>
                <p>Ajoute une note pour commencer.</p>
            </div>
        `;

    } else {

        container.innerHTML =
            grades.map(grade => `

                <div class="grade-row">

                    <strong>
                        ${escapeHTML(grade.subject)}
                    </strong>

                    <div class="grade-value">
                        ${grade.grade}/20
                    </div>

                    <div>
                        Coef. ${grade.coefficient}
                    </div>

                    <div class="grade-type">
                        ${escapeHTML(
                            grade.grade_type || "Note"
                        )}
                    </div>

                    <div class="grade-date">
                        ${grade.grade_date || "—"}
                    </div>

                    <button
                        class="delete-grade"
                        data-delete-grade="${grade.id}"
                    >
                        Supprimer
                    </button>

                </div>

            `).join("");

    }

    document
        .getElementById("notes-add-btn")
        .addEventListener("click", openGradeModal);

    document
        .querySelectorAll("[data-delete-grade]")
        .forEach(button => {

            button.addEventListener("click", async () => {

                await deleteGrade(
                    button.dataset.deleteGrade
                );

                showNotes();

            });

        });

}


// =========================
// PAGE À FAIRE
// =========================

function showTodo() {

    const key =
        `brevettrack_todos_${currentUser.id}`;

    let todos =
        JSON.parse(localStorage.getItem(key) || "[]");

    main.innerHTML = `

        <section class="card">

            <div class="card-header">

                <div>
                    <h2>À faire</h2>
                    <p>Organise tes devoirs et révisions.</p>
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
            document.getElementById("todo-list");

        if (todos.length === 0) {

            list.innerHTML = `
                <div class="empty">
                    <div class="empty-icon">✓</div>
                    <h3>Rien à faire</h3>
                    <p>Ajoute un devoir ou une révision.</p>
                </div>
            `;

            return;
        }

        list.innerHTML =
            todos.map((todo, index) => `

                <div class="grade-row">

                    <strong>
                        ${escapeHTML(todo.text)}
                    </strong>

                    <div>
                        ${todo.date || "Sans date"}
                    </div>

                    <div>
                        ${todo.priority}
                    </div>

                    <button
                        class="delete-grade"
                        data-todo="${index}"
                    >
                        Terminé
                    </button>

                </div>

            `).join("");

        document
            .querySelectorAll("[data-todo]")
            .forEach(button => {

                button.addEventListener("click", () => {

                    todos.splice(
                        Number(button.dataset.todo),
                        1
                    );

                    localStorage.setItem(
                        key,
                        JSON.stringify(todos)
                    );

                    renderTodos();

                });

            });

    }

    document
        .getElementById("add-todo")
        .addEventListener("click", () => {

            const text =
                prompt("Quel est le devoir ?");

            if (!text) return;

            const date =
                prompt("Date limite ?");

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

        });

    renderTodos();

}


// =========================
// PAGE BREVET
// =========================

function showBrevet() {

    const average =
        document.getElementById("average-card").textContent;

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

                <span>${average}</span>
                <small>/20</small>

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

                <strong>${average}</strong>
                <p>/20</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Objectif</span>
                    <span>◎</span>
                </div>

                <strong>${target}</strong>
                <p>/20</p>
            </div>

            <div class="stat-card">
                <div class="stat-top">
                    <span>Notes</span>
                    <span>▤</span>
                </div>

                <strong>${grades.length}</strong>
                <p>enregistrées</p>
            </div>

        </section>

        <section class="card">

            <h2>Simulation</h2>

            <p style="color:#7b8190;margin-top:8px;">
                Ajoute davantage de notes pour obtenir une estimation plus représentative.
            </p>

        </section>

    `;

}


// =========================
// CALENDRIER
// =========================

function showCalendar() {

    const today =
        new Date().toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long"
        });

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
                        Organise tes contrôles, devoirs et révisions.
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
                    La prochaine étape sera d'ajouter les événements scolaires.
                </p>

            </div>

        </section>

    `;

}


// =========================
// BOUTONS
// =========================

function setupButtons() {

    document
        .getElementById("add-grade-btn")
        .addEventListener("click", openGradeModal);

    document
        .getElementById("close-modal")
        .addEventListener("click", closeGradeModal);

    document
        .getElementById("save-grade-btn")
        .addEventListener("click", saveGrade);

    document
        .getElementById("target-btn")
        .addEventListener("click", saveTarget);

    document
        .getElementById("logout-btn")
        .addEventListener("click", async () => {

            await supabaseClient.auth.signOut();

            window.location.href = "index.html";

        });

}


// =========================
// UTILITAIRE
// =========================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// =========================
// AUTH
// =========================

supabaseClient.auth.onAuthStateChange(
    (event, session) => {

        if (!session) {
            window.location.href = "index.html";
        }

    }
);


startApp();