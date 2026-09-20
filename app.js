const SUPABASE_URL = "https://maypmuwxpqepijufjhhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_1MPnN42PeTl9MkGK1T1qeQ_nOx_3Q1L";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let grades = [];
let moneyTransactions = [];
let todos = [];

const main = document.querySelector("main");
const modal = document.getElementById("grade-modal");


// =========================================================
// DÉMARRAGE
// =========================================================

document.addEventListener("DOMContentLoaded", startApp);

async function startApp() {

    setupAuthUI();

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        showLoginScreen();
        return;
    }

    await initializeApp(session.user);

    supabaseClient.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession?.user) {
            if (!currentUser || currentUser.id !== nextSession.user.id) {
                await initializeApp(nextSession.user);
            }
        } else {
            currentUser = null;
            showLoginScreen();
        }
    });
}

async function initializeApp(user) {

    currentUser = user;

    showAppScreen();

    await loadProfile();
    await loadGrades();
    await loadMoney();
    await loadTodos();

    loadTarget();

    setupNavigation();
    setupButtons();
    setupMobileMenu();
    setupGradeMoneyPreview();

    registerServiceWorker();

    updateMoneyDashboard();
}

function setupAuthUI() {

    const loginButton = document.getElementById("login-btn");
    const signupButton = document.getElementById("signup-btn");
    const logoutButton = document.getElementById("logout-btn");

    if (loginButton && !loginButton.dataset.bound) {
        loginButton.dataset.bound = "1";
        loginButton.addEventListener("click", loginUser);
    }

    if (signupButton && !signupButton.dataset.bound) {
        signupButton.dataset.bound = "1";
        signupButton.addEventListener("click", signupUser);
    }

    if (logoutButton && !logoutButton.dataset.bound) {
        logoutButton.dataset.bound = "1";
        logoutButton.addEventListener("click", logout);
    }
}

async function loginUser() {

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    const message = document.getElementById("auth-message");

    if (!email || !password) {
        if (message) message.textContent = "Remplis tous les champs.";
        return;
    }

    if (message) message.textContent = "Connexion...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        if (message) message.textContent = error.message;
        return;
    }

    await initializeApp(data.user);
}

async function signupUser() {

    const email = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value;
    const message = document.getElementById("auth-message");

    if (!email || !password) {
        if (message) message.textContent = "Remplis tous les champs.";
        return;
    }

    if (password.length < 6) {
        if (message) {
            message.textContent =
                "Le mot de passe doit contenir au moins 6 caractères.";
        }
        return;
    }

    if (message) message.textContent = "Création du compte...";

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
    });

    if (error) {
        if (message) message.textContent = error.message;
        return;
    }

    if (data.session) {
        await initializeApp(data.user);
    } else if (message) {
        message.textContent =
            "Compte créé. Tu peux maintenant te connecter.";
    }
}

function showLoginScreen() {

    const loginScreen = document.getElementById("login-screen");
    const app = document.getElementById("app");

    if (loginScreen) {
        loginScreen.classList.remove("hidden");
    }

    if (app) {
        app.classList.add("hidden");
        app.style.display = "none";
    }
}

function showAppScreen() {

    const loginScreen = document.getElementById("login-screen");
    const app = document.getElementById("app");

    if (loginScreen) {
        loginScreen.classList.add("hidden");
    }

    if (app) {
        app.classList.remove("hidden");
        app.style.display = "";
    }
}


// =========================================================
// PROFIL
// =========================================================

async function loadProfile() {

    const { data, error } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

    if (error) {
        console.error("Erreur profil :", error);
        return;
    }

    const name =
        data?.name ||
        currentUser.user_metadata?.name ||
        "toi";

    const welcome =
        document.getElementById("welcome");

    if (welcome) {
        welcome.textContent = `Bonjour ${name} 👋`;
    }

    const sidebarName =
        document.getElementById("sidebar-name");

    if (sidebarName) {
        sidebarName.textContent = name;
    }

    const sidebarEmail =
        document.getElementById("sidebar-email");

    if (sidebarEmail) {
        sidebarEmail.textContent =
            currentUser.email || "—";
    }

    const initial =
        name.charAt(0).toUpperCase();

    const avatars =
        document.querySelectorAll(".avatar");

    avatars.forEach(avatar => {
        avatar.textContent = initial;
    });
}


// =========================================================
// NOTES
// =========================================================

async function loadGrades() {

    const { data, error } = await supabaseClient
        .from("grades")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("grade_date", {
            ascending: false
        });

    if (error) {
        console.error("Erreur notes :", error);
        return;
    }

    grades = data || [];

    displayGrades(grades);
    calculateAverage(grades);
    updateMoneyDashboard();
}


// =========================================================
// AFFICHAGE NOTES
// =========================================================

function displayGrades(list) {

    const container =
        document.getElementById("grades-list");

    const count =
        document.getElementById("grades-count");

    if (count) {
        count.textContent = list.length;
    }

    if (!container) return;

    if (list.length === 0) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>

                <h3>Aucune note</h3>

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
                        ${escapeHTML(grade.subject)}
                    </strong>

                    <div class="grade-value">
                        ${Number(grade.grade).toLocaleString("fr-FR")}/20
                    </div>

                    <div>
                        Coef. ${grade.coefficient || 1}
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
                () => deleteGrade(
                    button.dataset.deleteGrade
                )
            );

        });
}


// =========================================================
// MOYENNE
// =========================================================

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

        const gradeValue =
            Number(grade.grade);

        const coefficient =
            Number(grade.coefficient) || 1;

        total +=
            gradeValue * coefficient;

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
        brevetEstimate.textContent = formatted;
    }

    if (brevetBig) {
        brevetBig.textContent = formatted;
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
        generalAverage.textContent = value;
    }

    if (averageCard) {
        averageCard.textContent = value;
    }
}


// =========================================================
// RÉCOMPENSE DES NOTES
// =========================================================

function getGradeReward(grade) {

    const value = Number(grade);

    if (isNaN(value)) {
        return 0;
    }

    if (value >= 0 && value < 10) {
        return -500;
    }

    if (value >= 10 && value < 14) {
        return -250;
    }

    if (value >= 14 && value < 16) {
        return -150;
    }

    if (value >= 16 && value < 17) {
        return 0;
    }

    if (value >= 17 && value < 18.5) {
        return 250;
    }

    if (value >= 18.5 && value < 19.5) {
        return 300;
    }

    if (value >= 19.5 && value <= 20) {
        return 350;
    }

    return 0;
}


// =========================================================
// APERÇU RÉCOMPENSE
// =========================================================

function setupGradeMoneyPreview() {

    const gradeInput =
        document.getElementById(
            "grade-input"
        );

    if (!gradeInput) return;

    gradeInput.addEventListener(
        "input",
        updateGradeMoneyPreview
    );

    addMoneyAccountFieldIfMissing();

    updateGradeMoneyPreview();
}


function addMoneyAccountFieldIfMissing() {

    const gradeInput =
        document.getElementById(
            "grade-input"
        );

    const modalCard =
        document.querySelector(
            "#grade-modal .modal-card"
        );

    if (!gradeInput || !modalCard) {
        return;
    }

    if (
        document.getElementById(
            "grade-money-account"
        )
    ) {
        return;
    }

    const dateInput =
        document.getElementById(
            "date-input"
        );

    if (!dateInput) return;

    const wrapper =
        document.createElement("div");

    wrapper.id =
        "grade-money-account-wrapper";

    wrapper.innerHTML = `
        <label>
            Compte pour la récompense
        </label>

        <select id="grade-money-account">

            <option value="bank">
                Banque
            </option>

            <option value="savings">
                Épargne
            </option>

            <option value="cash">
                Espèces
            </option>

        </select>

        <div
            id="grade-money-preview"
            class="money-preview"
        >
            Récompense : 0 DH
        </div>
    `;

    dateInput.insertAdjacentElement(
        "beforebegin",
        wrapper
    );
}


function updateGradeMoneyPreview() {

    const input =
        document.getElementById(
            "grade-input"
        );

    const preview =
        document.getElementById(
            "grade-money-preview"
        );

    if (!input || !preview) {
        return;
    }

    const value =
        Number(input.value);

    if (isNaN(value)) {

        preview.textContent =
            "Récompense : 0 DH";

        return;
    }

    const reward =
        getGradeReward(value);

    preview.textContent =
        `Récompense : ${formatDH(reward)}`;
}


// =========================================================
// AJOUT NOTE
// =========================================================

function openGradeModal() {

    const currentModal =
        document.getElementById("grade-modal");

    if (!currentModal) return;

    currentModal.classList.remove("hidden");

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

    const message =
        document.getElementById(
            "grade-message"
        );

    if (message) {
        message.textContent = "";
    }

    updateGradeMoneyPreview();
}


function closeGradeModal() {

    const currentModal =
        document.getElementById("grade-modal");

    if (!currentModal) return;

    currentModal.classList.add("hidden");
}


async function saveGrade() {

    const subject =
        document.getElementById(
            "subject-input"
        )?.value.trim();

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
        )?.value || "Contrôle";

    const date =
        document.getElementById(
            "date-input"
        )?.value;

    const account =
        document.getElementById(
            "grade-money-account"
        )?.value || "bank";

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

    if (
        isNaN(coefficient) ||
        coefficient <= 0
    ) {

        if (message) {
            message.textContent =
                "Le coefficient doit être supérieur à 0.";
        }

        return;
    }

    const reward =
        getGradeReward(grade);

    if (message) {
        message.textContent =
            "Enregistrement...";
    }

    const {
        data: insertedGrade,
        error: gradeError
    } =
        await supabaseClient
            .from("grades")
            .insert({
                user_id: currentUser.id,
                subject,
                grade,
                coefficient,
                grade_type: type,
                grade_date: date || null
            })
            .select()
            .single();

    if (gradeError) {

        console.error(
            "Erreur ajout note :",
            gradeError
        );

        if (message) {
            message.textContent =
                "Erreur : " +
                gradeError.message;
        }

        return;
    }

    if (reward !== 0) {

        const {
            error: moneyError
        } =
            await supabaseClient
                .from("money_transactions")
                .insert({
                    user_id: currentUser.id,
                    amount: reward,
                    account_type: account,
                    transaction_type: "grade",
                    description:
                        `Récompense note ${grade}/20 - ${subject}`,
                    transaction_date:
                        date || null
                });

        if (moneyError) {

            console.error(
                "Erreur récompense :",
                moneyError
            );

            if (message) {
                message.textContent =
                    "Note ajoutée, mais la récompense n'a pas pu être enregistrée.";
            }

        }
    }

    if (message) {

        if (reward > 0) {

            message.textContent =
                `Note ajoutée ! +${formatDH(reward)} automatiquement ajoutés.`;

        } else if (reward < 0) {

            message.textContent =
                `Note ajoutée ! ${formatDH(reward)} automatiquement retirés.`;

        } else {

            message.textContent =
                "Note ajoutée ! Aucun changement d'argent.";

        }
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

    updateGradeMoneyPreview();

    await loadGrades();
    await loadMoney();

    setTimeout(
        closeGradeModal,
        800
    );
}


// =========================================================
// SUPPRIMER NOTE
// =========================================================

async function deleteGrade(id) {

    const grade =
        grades.find(
            item => String(item.id) === String(id)
        );

    if (!grade) return;

    const confirmed =
        confirm(
            "Supprimer cette note ?\n\nLa récompense liée à cette note sera également supprimée."
        );

    if (!confirmed) return;

    const description =
        `Récompense note ${grade.grade}/20 - ${grade.subject}`;

    const {
        error: moneyError
    } =
        await supabaseClient
            .from("money_transactions")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("transaction_type", "grade")
            .eq("description", description);

    if (moneyError) {
        console.error(
            "Erreur suppression récompense :",
            moneyError
        );
    }

    const {
        error
    } =
        await supabaseClient
            .from("grades")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadGrades();
    await loadMoney();

    if (
        document.getElementById(
            "notes-page-list"
        )
    ) {
        showNotes();
    }
}


// =========================================================
// ARGENT
// =========================================================

async function loadMoney() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("money_transactions")
            .select("*")
            .eq("user_id", currentUser.id)
            .order(
                "transaction_date",
                {
                    ascending: false
                }
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Erreur argent :",
            error
        );

        moneyTransactions = [];

        updateMoneyDashboard();

        return;
    }

    moneyTransactions =
        data || [];

    updateMoneyDashboard();
}


// =========================================================
// FORMAT DH
// =========================================================

function formatDH(amount) {

    const value =
        Number(amount) || 0;

    const sign =
        value > 0
            ? "+"
            : "";

    return (
        sign +
        value.toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ) +
        " DH"
    );
}


function formatAbsoluteDH(amount) {

    const value =
        Math.abs(
            Number(amount) || 0
        );

    return (
        value.toLocaleString(
            "fr-FR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        ) +
        " DH"
    );
}


// =========================================================
// CALCUL SOLDES
// =========================================================

function getMoneyBalances() {

    const balances = {
        bank: 0,
        savings: 0,
        cash: 0
    };

    moneyTransactions.forEach(
        transaction => {

            const account =
                transaction.account_type;

            if (
                Object.prototype.hasOwnProperty
                    .call(
                        balances,
                        account
                    )
            {

                balances[account] +=
                    Number(
                        transaction.amount
                    ) || 0;
            }

        }
    );

    balances.total =
        balances.bank +
        balances.savings +
        balances.cash;

    return balances;
}


// =========================================================
// TOTAL DU TABLEAU DE BORD
// =========================================================

function updateMoneyDashboard() {

    const balances =
        getMoneyBalances();

    const total =
        document.getElementById(
            "money-total"
        );

    if (total) {

        total.textContent =
            `${balances.total.toLocaleString(
                "fr-FR",
                {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2
                }
            )} DH`;
    }

    const bank =
        document.getElementById(
            "money-bank"
        );

    const savings =
        document.getElementById(
            "money-savings"
        );

    const cash =
        document.getElementById(
            "money-cash"
        );

    if (bank) {
        bank.textContent =
            formatAbsoluteDH(
                balances.bank
            );
    }

    if (savings) {
        savings.textContent =
            formatAbsoluteDH(
                balances.savings
            );
    }

    if (cash) {
        cash.textContent =
            formatAbsoluteDH(
                balances.cash
            );
    }
}


// =========================================================
// PAGE ARGENT
// =========================================================

function showMoney() {

    const balances =
        getMoneyBalances();

    main.innerHTML = `

        <section class="hero-card">

            <div>

                <p class="hero-label">
                    ARGENT
                </p>

                <h2>
                    Mon argent
                </h2>

                <p class="hero-text">
                    Tes récompenses liées à tes notes et tes opérations.
                </p>

            </div>

            <div class="hero-score">

                <span>
                    ${balances.total.toLocaleString(
                        "fr-FR",
                        {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                        }
                    )}
                </span>

                <small>
                    DH
                </small>

                <p>
                    Total
                </p>

            </div>

        </section>


        <section class="stats-grid">

            <div class="stat-card">

                <div class="stat-top">
                    <span>Banque</span>
                    <span class="stat-icon">B</span>
                </div>

                <strong>
                    ${formatAbsoluteDH(
                        balances.bank
                    )}
                </strong>

                <p>
                    Compte bancaire
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Épargne</span>
                    <span class="stat-icon">S</span>
                </div>

                <strong>
                    ${formatAbsoluteDH(
                        balances.savings
                    )}
                </strong>

                <p>
                    Épargne
                </p>

            </div>


            <div class="stat-card">

                <div class="stat-top">
                    <span>Espèces</span>
                    <span class="stat-icon">D</span>
                </div>

                <strong>
                    ${formatAbsoluteDH(
                        balances.cash
                    )}
                </strong>

                <p>
                    Argent liquide
                </p>

            </div>

        </section>


        <section class="card">

            <div class="card-header">

                <div>

                    <h2>
                        Opérations
                    </h2>

                    <p>
                        Historique de ton argent
                    </p>

                </div>

                <div>

                    <button
                        id="money-add-page-btn"
                        class="primary-btn"
                    >
                        + Ajouter
                    </button>

                    <button
                        id="balance-page-btn"
                        class="secondary-btn"
                    >
                        Soldes
                    </button>

                </div>

            </div>


            <div id="money-history">
            </div>

        </section>
    `;

    renderMoneyHistory();

    document
        .getElementById(
            "money-add-page-btn"
        )
        ?.addEventListener(
            "click",
            openMoneyModal
        );

    document
        .getElementById(
            "balance-page-btn"
        )
        ?.addEventListener(
            "click",
            openBalanceModal
        );
}


// =========================================================
// HISTORIQUE ARGENT
// =========================================================

function renderMoneyHistory() {

    const container =
        document.getElementById(
            "money-history"
        );

    if (!container) return;

    if (
        moneyTransactions.length === 0
    ) {

        container.innerHTML = `
            <div class="empty">

                <div class="empty-icon">
                    DH
                </div>

                <h3>
                    Aucun mouvement
                </h3>

                <p>
                    Tes récompenses apparaîtront ici.
                </p>

            </div>
        `;

        return;
    }

    container.innerHTML =
        moneyTransactions
            .map(transaction => {

                const amount =
                    Number(
                        transaction.amount
                    ) || 0;

                const positive =
                    amount > 0;

                const date =
                    transaction.transaction_date
                        ? new Date(
                            transaction.transaction_date
                        ).toLocaleDateString(
                            "fr-FR"
                        )
                        : "—";

                const account =
                    getAccountLabel(
                        transaction.account_type
                    );

                const type =
                    getTransactionLabel(
                        transaction.transaction_type
                    );

                return `
                    <div class="grade-row">

                        <strong>
                            ${escapeHTML(
                                transaction.description ||
                                type
                            )}
                        </strong>

                        <div>
                            ${type}
                        </div>

                        <div>
                            ${account}
                        </div>

                        <div>
                            ${date}
                        </div>

                        <div class="grade-value">
                            ${positive ? "+" : ""}
                            ${amount.toLocaleString(
                                "fr-FR",
                                {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 2
                                }
                            )}
                            DH
                        </div>

                        <button
                            class="delete-grade"
                            data-delete-money="${transaction.id}"
                        >
                            Supprimer
                        </button>

                    </div>
                `;

            })
            .join("");

    document
        .querySelectorAll(
            "[data-delete-money]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => deleteMoneyTransaction(
                    button.dataset.deleteMoney
                )
            );

        });
}


function getAccountLabel(account) {

    if (account === "bank") {
        return "Banque";
    }

    if (account === "savings") {
        return "Épargne";
    }

    if (account === "cash") {
        return "Espèces";
    }

    return "—";
}


function getTransactionLabel(type) {

    if (type === "grade") {
        return "Note";
    }

    if (type === "encouragement") {
        return "Encouragement";
    }

    if (type === "observation") {
        return "Observation";
    }

    if (type === "manual") {
        return "Manuel";
    }

    if (type === "initial_balance") {
        return "Solde initial";
    }

    return "Opération";
}


// =========================================================
// OPÉRATION ARGENT
// =========================================================

function openMoneyModal() {

    const moneyModal =
        document.getElementById(
            "money-modal"
        );

    if (!moneyModal) return;

    moneyModal.classList.remove(
        "hidden"
    );

    const message =
        document.getElementById(
            "money-message"
        );

    if (message) {
        message.textContent = "";
    }
}


function closeMoneyModal() {

    const moneyModal =
        document.getElementById(
            "money-modal"
        );

    if (!moneyModal) return;

    moneyModal.classList.add(
        "hidden"
    );
}


async function saveMoney() {

    const amountInput =
        document.getElementById(
            "money-amount"
        );

    const accountInput =
        document.getElementById(
            "money-account"
        );

    const typeInput =
        document.getElementById(
            "money-type"
        );

    const descriptionInput =
        document.getElementById(
            "money-description"
        );

    const message =
        document.getElementById(
            "money-message"
        );

    let amount =
        Number(
            amountInput?.value
        );

    const account =
        accountInput?.value ||
        "bank";

    const type =
        typeInput?.value ||
        "manual";

    let description =
        descriptionInput?.value.trim();

    if (
        type === "encouragement"
    ) {

        amount = 100;

        description =
            description ||
            "Encouragement";
    }

    if (
        type === "observation"
    ) {

        amount = -150;

        description =
            description ||
            "Observation";
    }

    if (
        isNaN(amount) ||
        amount === 0
    ) {

        if (message) {
            message.textContent =
                "Entre un montant différent de 0.";
        }

        return;
    }

    if (!description) {
        description =
            "Opération manuelle";
    }

    const {
        error
    } =
        await supabaseClient
            .from("money_transactions")
            .insert({
                user_id: currentUser.id,
                amount,
                account_type: account,
                transaction_type: type,
                description,
                transaction_date:
                    new Date()
                        .toISOString()
                        .split("T")[0]
            });

    if (error) {

        console.error(
            "Erreur argent :",
            error
        );

        if (message) {
            message.textContent =
                "Erreur : " +
                error.message;
        }

        return;
    }

    if (message) {
        message.textContent =
            "Opération ajoutée !";
    }

    if (amountInput) {
        amountInput.value = "";
    }

    if (descriptionInput) {
        descriptionInput.value = "";
    }

    await loadMoney();

    setTimeout(
        closeMoneyModal,
        500
    );
}


// =========================================================
// SUPPRIMER ARGENT
// =========================================================

async function deleteMoneyTransaction(
    id
) {

    const confirmed =
        confirm(
            "Supprimer cette opération ?"
        );

    if (!confirmed) return;

    const {
        error
    } =
        await supabaseClient
            .from("money_transactions")
            .delete()
            .eq("id", id)
            .eq(
                "user_id",
                currentUser.id
            );

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadMoney();

    showMoney();
}


// =========================================================
// SOLDES INITIAUX
// =========================================================

function openBalanceModal() {

    const balanceModal =
        document.getElementById(
            "balance-modal"
        );

    if (!balanceModal) return;

    balanceModal.classList.remove(
        "hidden"
    );

    loadInitialBalanceInputs();
}


function closeBalanceModal() {

    const balanceModal =
        document.getElementById(
            "balance-modal"
        );

    if (!balanceModal) return;

    balanceModal.classList.add(
        "hidden"
    );
}


function loadInitialBalanceInputs() {

    const bank =
        document.getElementById(
            "initial-bank"
        );

    const savings =
        document.getElementById(
            "initial-savings"
        );

    const cash =
        document.getElementById(
            "initial-cash"
        );

    if (bank) {
        bank.value =
            getInitialBalance(
                "bank"
            );
    }

    if (savings) {
        savings.value =
            getInitialBalance(
                "savings"
            );
    }

    if (cash) {
        cash.value =
            getInitialBalance(
                "cash"
            );
    }
}


function getInitialBalance(account) {

    const transaction =
        moneyTransactions.find(
            item =>
                item.account_type ===
                    account &&
                item.transaction_type ===
                    "initial_balance"
        );

    return transaction
        ? transaction.amount
        : 0;
}


async function saveBalances() {

    const values = {
        bank:
            Number(
                document.getElementById(
                    "initial-bank"
                )?.value
            ) || 0,

        savings:
            Number(
                document.getElementById(
                    "initial-savings"
                )?.value
            ) || 0,

        cash:
            Number(
                document.getElementById(
                    "initial-cash"
                )?.value
            ) || 0
    };

    const accounts = [
        "bank",
        "savings",
        "cash"
    ];

    for (const account of accounts) {

        const existing =
            moneyTransactions.find(
                item =>
                    item.account_type ===
                        account &&
                    item.transaction_type ===
                        "initial_balance"
            );

        if (existing) {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "money_transactions"
                    )
                    .update({
                        amount:
                            values[account],
                        description:
                            "Solde initial"
                    })
                    .eq(
                        "id",
                        existing.id
                    )
                    .eq(
                        "user_id",
                        currentUser.id
                    );

            if (error) {
                console.error(
                    error
                );
            }

        } else if (
            values[account] !== 0
        ) {

            const {
                error
            } =
                await supabaseClient
                    .from(
                        "money_transactions"
                    )
                    .insert({
                        user_id:
                            currentUser.id,
                        amount:
                            values[account],
                        account_type:
                            account,
                        transaction_type:
                            "initial_balance",
                        description:
                            "Solde initial",
                        transaction_date:
                            new Date()
                                .toISOString()
                                .split("T")[0]
                    });

            if (error) {
                console.error(
                    error
                );
            }
        }
    }

    await loadMoney();

    const message =
        document.getElementById(
            "balance-message"
        );

    if (message) {
        message.textContent =
            "Soldes enregistrés !";
    }

    setTimeout(
        closeBalanceModal,
        500
    );
}


// =========================================================
// À FAIRE
// =========================================================

async function loadTodos() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from("todos")
            .select("*")
            .eq(
                "user_id",
                currentUser.id
            )
            .order(
                "due_at",
                {
                    ascending: true,
                    nullsFirst: false
                }
            );

    if (error) {

        console.error(
            "Erreur tâches :",
            error
        );

        todos = [];

        return;
    }

    todos = data || [];
}


function showTodo() {

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

            <div id="todo-list">
            </div>

        </section>
    `;

    renderTodos();

    document
        .getElementById("add-todo")
        ?.addEventListener(
            "click",
            addTodo
        );
}


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
        todos
            .map(todo => {

                const due =
                    todo.due_at
                        ? new Date(
                            todo.due_at
                        ).toLocaleString(
                            "fr-FR"
                        )
                        : "Sans date";

                const overdue =
                    todo.due_at &&
                    new Date(
                        todo.due_at
                    ) < new Date() &&
                    !todo.completed;

                return `
                    <div
                        class="grade-row
                        ${todo.completed ? "todo-completed" : ""}
                        ${overdue ? "todo-overdue" : ""}"
                    >

                        <strong>
                            ${escapeHTML(
                                todo.title
                            )}
                        </strong>

                        <div>
                            ${overdue
                                ? "En retard"
                                : due}
                        </div>

                        <div>
                            ${todo.completed
                                ? "Terminé"
                                : "À faire"}
                        </div>

                        <button
                            class="delete-grade"
                            data-toggle-todo="${todo.id}"
                        >
                            ${todo.completed
                                ? "Rouvrir"
                                : "Terminé"}
                        </button>

                        <button
                            class="delete-grade"
                            data-delete-todo="${todo.id}"
                        >
                            Supprimer
                        </button>

                    </div>
                `;

            })
            .join("");

    document
        .querySelectorAll(
            "[data-toggle-todo]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    toggleTodo(
                        button.dataset.toggleTodo
                    )
            );

        });

    document
        .querySelectorAll(
            "[data-delete-todo]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () =>
                    deleteTodo(
                        button.dataset.deleteTodo
                    )
            );

        });
}


async function addTodo() {

    const title =
        prompt(
            "Quel est le devoir ou la tâche ?"
        );

    if (!title) return;

    const due =
        prompt(
            "Date et heure limite ?\nExemple : 25/09/2026 18:00\nTu peux laisser vide."
        );

    let dueAt = null;

    if (due) {

        const parsed =
            parseFrenchDateTime(
                due
            );

        if (!parsed) {

            alert(
                "Date invalide. Exemple : 25/09/2026 18:00"
            );

            return;
        }

        dueAt =
            parsed.toISOString();
    }

    const {
        error
    } =
        await supabaseClient
            .from("todos")
            .insert({
                user_id:
                    currentUser.id,
                title:
                    title.trim(),
                due_at:
                    dueAt,
                completed:
                    false
            });

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadTodos();

    showTodo();
}


async function toggleTodo(id) {

    const todo =
        todos.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!todo) return;

    const {
        error
    } =
        await supabaseClient
            .from("todos")
            .update({
                completed:
                    !todo.completed
            })
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                currentUser.id
            );

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadTodos();

    showTodo();
}


async function deleteTodo(id) {

    const confirmed =
        confirm(
            "Supprimer cette tâche ?"
        );

    if (!confirmed) return;

    const {
        error
    } =
        await supabaseClient
            .from("todos")
            .delete()
            .eq(
                "id",
                id
            )
            .eq(
                "user_id",
                currentUser.id
            );

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    await loadTodos();

    showTodo();
}


function parseFrenchDateTime(value) {

    const match =
        value.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
        );

    if (!match) {
        return null;
    }

    const day =
        Number(match[1]);

    const month =
        Number(match[2]) - 1;

    const year =
        Number(match[3]);

    const hour =
        Number(match[4] || 23);

    const minute =
        Number(match[5] || 59);

    const date =
        new Date(
            year,
            month,
            day,
            hour,
            minute,
            0
        );

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}


// =========================================================
// BREVET
// =========================================================

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
                Ajoute davantage de notes pour obtenir une estimation plus représentative.
            </p>

        </section>
    `;
}


// =========================================================
// CALENDRIER
// =========================================================

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
                        Organise tes contrôles, devoirs et révisions.
                    </p>

                </div>

            </div>


            <div class="empty">

                <div class="empty-icon">
                    ◷
                </div>

                <h3>
                    Ton calendrier
                </h3>

                <p>
                    Les événements scolaires pourront être ajoutés ici.
                </p>

            </div>

        </section>
    `;
}


// =========================================================
// NOTES — PAGE COMPLÈTE
// =========================================================

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


            <div id="notes-page-list">
            </div>

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
            grades
                .map(grade => {

                    const reward =
                        getGradeReward(
                            grade.grade
                        );

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

                            <div>
                                ${escapeHTML(
                                    grade.grade_type ||
                                    "Note"
                                )}
                            </div>

                            <div>
                                ${reward > 0
                                    ? "+" +
                                      reward +
                                      " DH"
                                    : reward < 0
                                        ? reward +
                                          " DH"
                                        : "0 DH"}
                            </div>

                            <button
                                class="delete-grade"
                                data-delete-grade="${grade.id}"
                            >
                                Supprimer
                            </button>

                        </div>
                    `;

                })
                .join("");
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
                () =>
                    deleteGrade(
                        button.dataset.deleteGrade
                    )
            );

        });
}


// =========================================================
// TABLEAU DE BORD
// =========================================================

function showDashboard() {

    currentPage = "dashboard";

    const mainElement =
        document.querySelector("main");

    if (!mainElement) return;

    mainElement.innerHTML = `
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
                <span id="general-average">—</span>
                <small>/20</small>
                <p>Moyenne actuelle</p>
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
                    <span>Argent total</span>
                    <span class="stat-icon">€</span>
                </div>

                <strong id="money-total">
                    0 DH
                </strong>

                <p>
                    tous comptes
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

                <strong id="brevet-big">
                    —
                </strong>

                <p>
                    estimation
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

                <div id="grades-list">
                </div>

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

                    <small>
                        /20
                    </small>

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

                    <button
                        id="target-btn"
                    >
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

                        <div id="progress-bar">
                        </div>

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

                <strong id="brevet-estimate">
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
    updateMoneyDashboard();
    setupButtons();
    setupGradeMoneyPreview();
}


// =========================================================
// NAVIGATION
// =========================================================

function setupNavigation() {

    const buttons =
        document.querySelectorAll(
            ".nav-item"
        );

    buttons.forEach(button => {

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

                const page =
                    button.dataset.page;

                if (page === "dashboard") {
                    showDashboard();
                }

                if (page === "notes") {
                    showNotes();
                }

                if (page === "todo") {
                    showTodo();
                }

                if (page === "brevet") {
                    showBrevet();
                }

                if (page === "calendar") {
                    showCalendar();
                }

                if (page === "money") {
                    showMoney();
                }

                closeMobileMenu();
            }
        );

    });
}


// =========================================================
// BOUTONS
// =========================================================

function setupButtons() {

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
            "close-modal"
        )
        ?.addEventListener(
            "click",
            closeGradeModal
        );

    document
        .getElementById(
            "save-grade-btn"
        )
        ?.addEventListener(
            "click",
            saveGrade
        );

    document
        .getElementById(
            "target-btn"
        )
        ?.addEventListener(
            "click",
            saveTarget
        );

    document
        .getElementById(
            "logout-btn"
        )
        ?.addEventListener(
            "click",
            logout
        );

    document
        .getElementById(
            "close-money-modal"
        )
        ?.addEventListener(
            "click",
            closeMoneyModal
        );

    document
        .getElementById(
            "save-money-btn"
        )
        ?.addEventListener(
            "click",
            saveMoney
        );

    document
        .getElementById(
            "close-balance-modal"
        )
        ?.addEventListener(
            "click",
            closeBalanceModal
        );

    document
        .getElementById(
            "save-balances-btn"
        )
        ?.addEventListener(
            "click",
            saveBalances
        );

    document
        .getElementById(
            "money-type"
        )
        ?.addEventListener(
            "change",
            updateManualMoneyPreview
        );

    document
        .getElementById(
            "money-amount"
        )
        ?.addEventListener(
            "input",
            updateManualMoneyPreview
        );
}


// =========================================================
// APERÇU OPÉRATION MANUELLE
// =========================================================

function updateManualMoneyPreview() {

    const type =
        document.getElementById(
            "money-type"
        )?.value;

    const input =
        document.getElementById(
            "money-amount"
        );

    if (!input) return;

    if (type === "encouragement") {

        input.value = "100";
        input.disabled = true;

    } else if (
        type === "observation"
    ) {

        input.value = "-150";
        input.disabled = true;

    } else {

        input.disabled = false;

    }
}


// =========================================================
// OBJECTIF
// =========================================================

function loadTarget() {

    const target =
        localStorage.getItem(
            `brevettrack_target_${currentUser.id}`
        );

    if (!target) return;

    const targetValue =
        Number(target);

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
            targetValue.toFixed(1);
    }

    if (targetCircle) {
        targetCircle.textContent =
            targetValue.toFixed(1);
    }

    if (targetInput) {
        targetInput.value =
            targetValue;
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

    const target =
        Number(
            document.getElementById(
                "target-input"
            )?.value
        );

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

    if (
        !target ||
        isNaN(average)
    ) {

        if (progressBar) {
            progressBar.style.width =
                "0%";
        }

        if (progressText) {
            progressText.textContent =
                "—";
        }

        return;
    }

    const percentage =
        Math.min(
            (average / target) * 100,
            100
        );

    if (progressBar) {
        progressBar.style.width =
            `${percentage}%`;
    }

    if (progressText) {
        progressText.textContent =
            `${Math.round(percentage)}%`;
    }
}


// =========================================================
// MENU MOBILE
// =========================================================

function setupMobileMenu() {

    const button =
        document.getElementById(
            "mobile-menu-btn"
        );

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "mobile-overlay"
        );

    if (button) {

        button.addEventListener(
            "click",
            () => {

                sidebar?.classList.toggle(
                    "mobile-open"
                );

                overlay?.classList.toggle(
                    "visible"
                );

            }
        );
    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeMobileMenu
        );
    }
}


function closeMobileMenu() {

    document
        .getElementById(
            "sidebar"
        )
        ?.classList.remove(
            "mobile-open"
        );

    document
        .getElementById(
            "mobile-overlay"
        )
        ?.classList.remove(
            "visible"
        );
}


// =========================================================
// SERVICE WORKER
// =========================================================

async function registerServiceWorker() {

    if (
        !("serviceWorker" in navigator)
    ) {
        return;
    }

    try {

        await navigator.serviceWorker.register(
            "/sw.js"
        );

        console.log(
            "Service Worker enregistré."
        );

    } catch (error) {

        console.error(
            "Service Worker :",
            error
        );
    }
}


// =========================================================
// DÉCONNEXION
// =========================================================

async function logout() {

    const {
        error
    } =
        await supabaseClient.auth.signOut();

    if (error) {

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }

    currentUser = null;
    grades = [];
    moneyTransactions = [];
    todos = [];

    showLoginScreen();
}


// =========================================================
// UTILITAIRES
// =========================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// =========================================================
// FERMETURE MODALES EN CLIQUANT À L'EXTÉRIEUR
// =========================================================

document.addEventListener(
    "click",
    event => {

        if (
            event.target.classList.contains(
                "modal"
            )
        ) {

            event.target.classList.add(
                "hidden"
            );
        }

    }
);