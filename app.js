const SUPABASE_URL = "https://maypmuwxpqepijufjhhb.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_1MPnN42PeTl9MkGK1T1qeQ_nOx_3Q1L";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let grades = [];
let todos = [];
let moneyTransactions = [];

let currentPage = "dashboard";

const main = document.getElementById("main");
const modal = document.getElementById("grade-modal");


/* =========================================================
   DÉMARRAGE
   ========================================================= */

async function startApp() {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();

    if (!session) {

        document.getElementById("auth-screen").classList.remove("hidden");
        document.getElementById("app").classList.add("hidden");

        setupAuth();

        return;
    }

    currentUser = session.user;

    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");

    await loadProfile();
    await loadGrades();
    await loadTodos();
    await loadMoney();

    setupNavigation();
    setupButtons();
    setupMobileMenu();
    setupGradeRewardPreview();

    showPage("dashboard");

    registerServiceWorker();

}


/* =========================================================
   AUTH
   ========================================================= */

let signupMode = false;

function setupAuth() {

    const loginTab = document.getElementById("login-tab");
    const signupTab = document.getElementById("signup-tab");
    const authForm = document.getElementById("auth-form");
    const nameField = document.getElementById("name-field");
    const authTitle = document.getElementById("auth-title");
    const authSubtitle = document.getElementById("auth-subtitle");
    const authSubmit = document.getElementById("auth-submit");

    if (!loginTab || !signupTab || !authForm) return;

    loginTab.onclick = () => {

        signupMode = false;

        loginTab.classList.add("active");
        signupTab.classList.remove("active");

        nameField.classList.add("hidden");

        authTitle.textContent = "Connexion";

        authSubtitle.textContent =
            "Connecte-toi à ton espace BrevetTrack.";

        authSubmit.textContent =
            "Se connecter";

    };


    signupTab.onclick = () => {

        signupMode = true;

        signupTab.classList.add("active");
        loginTab.classList.remove("active");

        nameField.classList.remove("hidden");

        authTitle.textContent =
            "Créer un compte";

        authSubtitle.textContent =
            "Crée ton espace personnel BrevetTrack.";

        authSubmit.textContent =
            "Créer mon compte";

    };


    authForm.onsubmit = async event => {

        event.preventDefault();

        const email =
            document.getElementById("auth-email").value.trim();

        const password =
            document.getElementById("auth-password").value;

        const name =
            document.getElementById("auth-name").value.trim();

        const message =
            document.getElementById("auth-message");

        message.textContent = "";

        if (!email || !password) {

            message.textContent =
                "Entre ton email et ton mot de passe.";

            return;
        }


        authSubmit.disabled = true;

        if (signupMode) {

            const {
                data,
                error
            } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name
                    }
                }
            });


            if (error) {

                message.textContent =
                    error.message;

                authSubmit.disabled = false;

                return;
            }


            if (data.user) {

                await supabaseClient
                    .from("profiles")
                    .upsert({
                        id: data.user.id,
                        name: name || "Toi"
                    });

            }

            message.style.color = "#16a34a";

            message.textContent =
                "Compte créé. Connexion en cours...";

        } else {

            const {
                error
            } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });


            if (error) {

                message.textContent =
                    "Email ou mot de passe incorrect.";

                authSubmit.disabled = false;

                return;
            }

        }

        authSubmit.disabled = false;

    };

}


/* =========================================================
   PROFIL
   ========================================================= */

async function loadProfile() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();


    let name = "Toi";

    if (!error && data) {

        name =
            data.name ||
            data.first_name ||
            "Toi";

    }


    if (
        !name ||
        name === "Toi"
    ) {

        name =
            currentUser.user_metadata?.name ||
            currentUser.user_metadata?.first_name ||
            "Toi";

    }


    document.getElementById("welcome").textContent =
        `Bonjour ${name}`;


    const sidebarName =
        document.getElementById("sidebar-name");

    const sidebarEmail =
        document.getElementById("sidebar-email");

    if (sidebarName) {
        sidebarName.textContent = name;
    }

    if (sidebarEmail) {
        sidebarEmail.textContent =
            currentUser.email || "—";
    }


    const firstLetter =
        name
            .trim()
            .charAt(0)
            .toUpperCase() || "B";


    const topAvatar =
        document.getElementById("top-avatar");

    const sidebarAvatar =
        document.getElementById("sidebar-avatar");

    if (topAvatar) {
        topAvatar.textContent = firstLetter;
    }

    if (sidebarAvatar) {
        sidebarAvatar.textContent = firstLetter;
    }

}


/* =========================================================
   NOTES
   ========================================================= */

async function loadGrades() {

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

        console.error(
            "Erreur chargement notes :",
            error
        );

        grades = [];

        return;
    }


    grades = data || [];

    calculateAverage();

    displayDashboardGrades();

}


function calculateAverage() {

    if (!grades.length) {

        setAverage("—");

        updateBrevet();

        return;
    }


    let total = 0;
    let coefficients = 0;


    grades.forEach(grade => {

        const value =
            Number(grade.grade);

        const coefficient =
            Number(grade.coefficient) || 1;


        if (!Number.isNaN(value)) {

            total +=
                value * coefficient;

            coefficients +=
                coefficient;

        }

    });


    if (!coefficients) {

        setAverage("—");

        return;
    }


    const average =
        total / coefficients;


    setAverage(
        average.toFixed(2)
    );

    updateProgress(average);
    updateBrevet(average);

}


function setAverage(value) {

    const ids = [
        "general-average",
        "average-card"
    ];


    ids.forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = value;
        }

    });

}


function displayDashboardGrades() {

    const container =
        document.getElementById("grades-list");

    const count =
        document.getElementById("grades-count");


    if (count) {
        count.textContent =
            grades.length;
    }


    if (!container) return;


    if (!grades.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>
                <h3>Aucune note</h3>
                <p>Ajoute ta première note pour commencer.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        grades
            .slice(0, 8)
            .map(createGradeHTML)
            .join("");


    attachGradeDeleteButtons();

}


function createGradeHTML(grade) {

    const subject =
        escapeHTML(
            grade.subject || "Matière"
        );


    const type =
        escapeHTML(
            grade.grade_type || "Note"
        );


    const coefficient =
        Number(grade.coefficient) || 1;


    const date =
        formatDate(grade.grade_date);


    return `
        <div class="grade-row">

            <strong>
                ${subject}
            </strong>

            <div class="grade-value">
                ${Number(grade.grade).toFixed(2)}/20
            </div>

            <div>
                Coef. ${coefficient}
            </div>

            <div class="grade-type">
                ${type}
            </div>

            <div class="grade-date">
                ${date}
            </div>

            <button
                class="delete-grade"
                data-delete-grade="${grade.id}"
                type="button"
            >
                Supprimer
            </button>

        </div>
    `;

}


function attachGradeDeleteButtons() {

    document
        .querySelectorAll("[data-delete-grade]")
        .forEach(button => {

            button.onclick = async () => {

                await deleteGrade(
                    button.dataset.deleteGrade
                );

            };

        });

}


async function deleteGrade(id) {

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

        alert(
            "Erreur : " +
            error.message
        );

        return;
    }


    await loadGrades();

    if (currentPage === "notes") {
        showNotes();
    }

}


/* =========================================================
   RÉCOMPENSES DES NOTES
   ========================================================= */

function getGradeReward(grade) {

    const value =
        Number(grade);


    if (Number.isNaN(value)) {
        return 0;
    }


    if (value < 10) {
        return -500;
    }

    if (value < 14) {
        return -250;
    }

    if (value < 16) {
        return -150;
    }

    if (value < 17) {
        return 0;
    }

    if (value < 18.5) {
        return 250;
    }

    if (value < 19.5) {
        return 300;
    }

    return 350;

}


function getRewardLabel(amount) {

    if (amount > 0) {
        return `+${amount} DH`;
    }

    if (amount < 0) {
        return `${amount} DH`;
    }

    return "0 DH";

}


function setupGradeRewardPreview() {

    const gradeInput =
        document.getElementById("grade-input");

    const preview =
        document.getElementById(
            "grade-money-preview"
        );


    if (!gradeInput || !preview) {
        return;
    }


    const update = () => {

        const value =
            Number(gradeInput.value);


        if (
            Number.isNaN(value) ||
            gradeInput.value === ""
        ) {

            preview.textContent =
                "Récompense : 0 DH";

            return;
        }


        const reward =
            getGradeReward(value);


        preview.textContent =
            `Récompense : ${getRewardLabel(reward)}`;

    };


    gradeInput.addEventListener(
        "input",
        update
    );

}


function resetGradeModal() {

    document.getElementById(
        "subject-input"
    ).value = "";

    document.getElementById(
        "grade-input"
    ).value = "";

    document.getElementById(
        "coefficient-input"
    ).value = "1";

    document.getElementById(
        "date-input"
    ).value =
        getTodayISO();


    document.getElementById(
        "grade-money-account"
    ).value = "bank";


    document.getElementById(
        "grade-message"
    ).textContent = "";

    document.getElementById(
        "grade-money-preview"
    ).textContent =
        "Récompense : 0 DH";

}


function openGradeModal() {

    resetGradeModal();

    modal.classList.remove(
        "hidden"
    );

}


function closeGradeModal() {

    modal.classList.add(
        "hidden"
    );

}


async function saveGrade() {

    const subject =
        document
            .getElementById("subject-input")
            .value
            .trim();


    const grade =
        Number(
            document
                .getElementById("grade-input")
                .value
        );


    const coefficient =
        Number(
            document
                .getElementById("coefficient-input")
                .value
        ) || 1;


    const type =
        document
            .getElementById("type-input")
            .value;


    const date =
        document
            .getElementById("date-input")
            .value;


    const account =
        document
            .getElementById(
                "grade-money-account"
            )
            .value;


    const message =
        document.getElementById(
            "grade-message"
        );


    message.style.color =
        "#dc2626";


    if (
        !subject ||
        Number.isNaN(grade) ||
        grade < 0 ||
        grade > 20
    ) {

        message.textContent =
            "Vérifie la matière et la note.";

        return;
    }


    if (
        coefficient <= 0
    ) {

        message.textContent =
            "Le coefficient doit être supérieur à 0.";

        return;
    }


    const reward =
        getGradeReward(grade);


    const {
        data: insertedGrade,
        error
    } = await supabaseClient
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


    if (error) {

        console.error(error);

        message.textContent =
            "Erreur : " +
            error.message;

        return;
    }


    if (reward !== 0) {

        const {
            error: moneyError
        } = await addMoneyTransaction({

            amount: reward,

            accountType:
                account,

            transactionType:
                "grade",

            description:
                `Récompense note : ${subject} — ${grade}/20`,

            transactionDate:
                date || getTodayISO(),

            silent: true

        });


        if (moneyError) {

            console.error(
                moneyError
            );

            message.textContent =
                "La note a été ajoutée, mais la récompense n'a pas pu être enregistrée.";

            await loadGrades();

            return;
        }

    }


    message.style.color =
        "#16a34a";

    message.textContent =
        `Note ajoutée. Récompense : ${getRewardLabel(reward)}`;


    await loadGrades();
    await loadMoney();


    setTimeout(
        closeGradeModal,
        700
    );

}


/* =========================================================
   OBJECTIF
   ========================================================= */

function loadTarget() {

    if (!currentUser) return;


    const target =
        localStorage.getItem(
            `brevettrack_target_${currentUser.id}`
        );


    if (!target) {

        updateProgress(
            Number(
                document.getElementById(
                    "average-card"
                ).textContent
            )
        );

        return;
    }


    const value =
        Number(target);


    const targetAverage =
        document.getElementById(
            "target-average"
        );

    const circle =
        document.getElementById(
            "target-circle-value"
        );

    const input =
        document.getElementById(
            "target-input"
        );


    if (targetAverage) {
        targetAverage.textContent =
            value.toFixed(1);
    }

    if (circle) {
        circle.textContent =
            value.toFixed(1);
    }

    if (input) {
        input.value = value;
    }


    const average =
        Number(
            document.getElementById(
                "average-card"
            ).textContent
        );


    updateProgress(
        average
    );

}


function saveTarget() {

    const target =
        Number(
            document.getElementById(
                "target-input"
            ).value
        );


    if (
        Number.isNaN(target) ||
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

    const circle =
        document.getElementById(
            "target-circle-value"
        );


    targetAverage.textContent =
        target.toFixed(1);

    circle.textContent =
        target.toFixed(1);


    const average =
        Number(
            document.getElementById(
                "average-card"
            ).textContent
        );


    updateProgress(
        average
    );

}


function updateProgress(average) {

    const target =
        Number(
            localStorage.getItem(
                `brevettrack_target_${currentUser.id}`
            )
        );


    const bar =
        document.getElementById(
            "progress-bar"
        );

    const text =
        document.getElementById(
            "progress-text"
        );


    if (
        !bar ||
        !text ||
        !target ||
        Number.isNaN(average)
    ) {

        if (bar) {
            bar.style.width = "0%";
        }

        if (text) {
            text.textContent = "—";
        }

        return;
    }


    const percentage =
        Math.min(
            (average / target) * 100,
            100
        );


    bar.style.width =
        `${percentage}%`;

    text.textContent =
        `${Math.round(percentage)}%`;

}


/* =========================================================
   BREVET
   ========================================================= */

function updateBrevet(average) {

    if (
        average === undefined
    ) {

        const raw =
            document.getElementById(
                "average-card"
            )?.textContent;

        average =
            Number(raw);

    }


    const estimate =
        document.getElementById(
            "brevet-estimate"
        );

    const big =
        document.getElementById(
            "brevet-big"
        );


    if (
        Number.isNaN(average)
    ) {

        if (estimate) {
            estimate.textContent = "—";
        }

        if (big) {
            big.textContent = "—";
        }

        return;
    }


    if (estimate) {
        estimate.textContent =
            average.toFixed(2);
    }

    if (big) {
        big.textContent =
            average.toFixed(2);
    }


    const pageEstimate =
        document.getElementById(
            "brevet-estimate-page"
        );

    const points =
        document.getElementById(
            "brevet-points"
        );


    if (pageEstimate) {
        pageEstimate.textContent =
            average.toFixed(2);
    }

    if (points) {
        points.textContent =
            Math.round(
                (average / 20) * 800
            );
    }

}


/* =========================================================
   ARGENT — SUPABASE
   ========================================================= */

async function loadMoney() {

    const {
        data,
        error
    } = await supabaseClient
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
            "Erreur chargement argent :",
            error
        );

        moneyTransactions = [];

        updateMoneyUI();

        return;
    }


    moneyTransactions =
        data || [];


    updateMoneyUI();

}


function accountLabel(account) {

    if (account === "bank") {
        return "Banque";
    }

    if (account === "savings") {
        return "Épargne";
    }

    if (account === "cash") {
        return "Espèces";
    }

    return "Autre";

}


function transactionTypeLabel(type) {

    if (type === "grade") {
        return "Récompense de note";
    }

    if (type === "encouragement") {
        return "Encouragement";
    }

    if (type === "observation") {
        return "Observation";
    }

    if (type === "initial_balance") {
        return "Solde initial";
    }

    return "Opération manuelle";

}


function calculateMoneyBalances() {

    const balances = {
        bank: 0,
        savings: 0,
        cash: 0
    };


    moneyTransactions.forEach(transaction => {

        const account =
            transaction.account_type;


        if (
            Object.prototype.hasOwnProperty.call(
                balances,
                account
            )
        ) {

            balances[account] +=
                Number(
                    transaction.amount
                ) || 0;

        }

    });


    balances.total =
        balances.bank +
        balances.savings +
        balances.cash;


    return balances;

}


function formatMoney(amount) {

    const value =
        Number(amount) || 0;


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


function updateMoneyUI() {

    const balances =
        calculateMoneyBalances();


    const values = {

        "money-total":
            balances.total,

        "money-page-total":
            balances.total,

        "money-bank":
            balances.bank,

        "money-savings":
            balances.savings,

        "money-cash":
            balances.cash

    };


    Object.entries(values)
        .forEach(([id, value]) => {

            const element =
                document.getElementById(id);

            if (element) {
                element.textContent =
                    formatMoney(value);
            }

        });


    const dashboardMoney =
        document.getElementById(
            "money-total"
        );

    if (dashboardMoney) {
        dashboardMoney.textContent =
            formatMoney(
                balances.total
            );
    }


    renderMoneyHistory();

}


function renderMoneyHistory() {

    const container =
        document.getElementById(
            "money-list"
        );


    if (!container) return;


    if (!moneyTransactions.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">€</div>
                <h3>Aucun mouvement</h3>
                <p>Ton historique apparaîtra ici.</p>
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


                const amountClass =
                    amount > 0
                        ? "money-positive"
                        : amount < 0
                            ? "money-negative"
                            : "money-neutral";


                const sign =
                    amount > 0
                        ? "+"
                        : "";


                return `
                    <div class="money-row">

                        <div>

                            <div class="money-description">
                                ${escapeHTML(
                                    transaction.description ||
                                    transactionTypeLabel(
                                        transaction.transaction_type
                                    )
                                )}
                            </div>

                            <div class="money-meta">
                                ${transactionTypeLabel(
                                    transaction.transaction_type
                                )}
                                ·
                                ${formatDate(
                                    transaction.transaction_date
                                )}
                            </div>

                        </div>


                        <div class="money-account">
                            ${accountLabel(
                                transaction.account_type
                            )}
                        </div>


                        <div class="money-amount ${amountClass}">
                            ${sign}${formatMoney(amount)}
                        </div>

                    </div>
                `;

            })
            .join("");

}


async function addMoneyTransaction({

    amount,
    accountType,
    transactionType,
    description,
    transactionDate,
    silent = false

}) {

    const {
        data,
        error
    } = await supabaseClient
        .from("money_transactions")
        .insert({

            user_id:
                currentUser.id,

            amount:
                Number(amount),

            account_type:
                accountType,

            transaction_type:
                transactionType,

            description:
                description || null,

            transaction_date:
                transactionDate ||
                getTodayISO()

        })
        .select()
        .single();


    if (error) {

        if (!silent) {

            console.error(error);

        }

        return {
            data: null,
            error
        };

    }


    moneyTransactions.unshift(
        data
    );


    updateMoneyUI();


    return {
        data,
        error: null
    };

}


/* =========================================================
   OPÉRATIONS ARGENT
   ========================================================= */

function openMoneyModal() {

    const modal =
        document.getElementById(
            "money-modal"
        );


    if (!modal) return;


    document.getElementById(
        "money-amount"
    ).value = "";


    document.getElementById(
        "money-account"
    ).value = "bank";


    document.getElementById(
        "money-type"
    ).value = "manual";


    document.getElementById(
        "money-description"
    ).value = "";


    document.getElementById(
        "money-message"
    ).textContent = "";


    modal.classList.remove(
        "hidden"
    );

}


function closeMoneyModal() {

    document
        .getElementById(
            "money-modal"
        )
        ?.classList.add(
            "hidden"
        );

}


async function saveMoney() {

    const amount =
        Number(
            document.getElementById(
                "money-amount"
            ).value
        );


    const account =
        document.getElementById(
            "money-account"
        ).value;


    const type =
        document.getElementById(
            "money-type"
        ).value;


    const description =
        document.getElementById(
            "money-description"
        ).value.trim();


    const message =
        document.getElementById(
            "money-message"
        );


    if (
        Number.isNaN(amount) ||
        amount === 0
    ) {

        message.textContent =
            "Entre un montant différent de 0.";

        return;
    }


    let finalAmount =
        amount;


    if (
        type === "encouragement"
    ) {

        finalAmount = 100;

    } else if (
        type === "observation"
    ) {

        finalAmount = -150;

    }


    let finalDescription =
        description;


    if (!finalDescription) {

        finalDescription =
            transactionTypeLabel(type);

    }


    const result =
        await addMoneyTransaction({

            amount:
                finalAmount,

            accountType:
                account,

            transactionType:
                type,

            description:
                finalDescription,

            transactionDate:
                getTodayISO(),

            silent: false

        });


    if (result.error) {

        message.textContent =
            "Erreur : " +
            result.error.message;

        return;
    }


    message.style.color =
        "#16a34a";

    message.textContent =
        "Opération ajoutée.";


    await loadMoney();


    setTimeout(
        closeMoneyModal,
        500
    );

}


/* =========================================================
   SOLDES INITIAUX
   ========================================================= */

function openBalanceModal() {

    const balances =
        calculateMoneyBalances();


    document.getElementById(
        "initial-bank"
    ).value =
        balances.bank;


    document.getElementById(
        "initial-savings"
    ).value =
        balances.savings;


    document.getElementById(
        "initial-cash"
    ).value =
        balances.cash;


    document.getElementById(
        "balance-message"
    ).textContent = "";


    document
        .getElementById(
            "balance-modal"
        )
        .classList.remove(
            "hidden"
        );

}


function closeBalanceModal() {

    document
        .getElementById(
            "balance-modal"
        )
        ?.classList.add(
            "hidden"
        );

}


async function saveBalances() {

    const bank =
        Number(
            document.getElementById(
                "initial-bank"
            ).value
        ) || 0;


    const savings =
        Number(
            document.getElementById(
                "initial-savings"
            ).value
        ) || 0;


    const cash =
        Number(
            document.getElementById(
                "initial-cash"
            ).value
        ) || 0;


    if (
        bank < 0 ||
        savings < 0 ||
        cash < 0
    ) {

        document.getElementById(
            "balance-message"
        ).textContent =
            "Les soldes ne peuvent pas être négatifs.";

        return;
    }


    /*
       On calcule les soldes actuels puis on ajoute
       uniquement la différence.
    */

    const current =
        calculateMoneyBalances();


    const differences = [

        {
            account: "bank",
            difference:
                bank - current.bank
        },

        {
            account: "savings",
            difference:
                savings - current.savings
        },

        {
            account: "cash",
            difference:
                cash - current.cash
        }

    ];


    for (
        const item of differences
    ) {

        if (
            item.difference === 0
        ) {
            continue;
        }


        const result =
            await addMoneyTransaction({

                amount:
                    item.difference,

                accountType:
                    item.account,

                transactionType:
                    "initial_balance",

                description:
                    `Mise à jour du solde ${accountLabel(item.account)}`,

                transactionDate:
                    getTodayISO(),

                silent: true

            });


        if (result.error) {

            document.getElementById(
                "balance-message"
            ).textContent =
                "Erreur : " +
                result.error.message;

            return;
        }

    }


    await loadMoney();


    document.getElementById(
        "balance-message"
    ).style.color =
        "#16a34a";


    document.getElementById(
        "balance-message"
    ).textContent =
        "Soldes enregistrés.";


    setTimeout(
        closeBalanceModal,
        600
    );

}


/* =========================================================
   TODO — SUPABASE
   ========================================================= */

async function loadTodos() {

    const {
        data,
        error
    } = await supabaseClient
        .from("todos")
        .select("*")
        .eq("user_id", currentUser.id)
        .order(
            "completed",
            {
                ascending: true
            }
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
            "Erreur chargement tâches :",
            error
        );

        todos = [];

        return;
    }


    todos =
        data || [];

}


function renderTodos() {

    const container =
        document.getElementById(
            "todo-list"
        );


    if (!container) return;


    if (!todos.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">✓</div>
                <h3>Rien à faire</h3>
                <p>Ajoute ton premier devoir ou ta première tâche.</p>
            </div>
        `;

        return;
    }


    const now =
        Date.now();


    container.innerHTML =
        todos.map(todo => {

            const due =
                todo.due_at
                    ? new Date(todo.due_at)
                    : null;


            const overdue =
                due &&
                due.getTime() < now &&
                !todo.completed;


            return `
                <div class="
                    todo-item
                    ${todo.completed ? "completed" : ""}
                    ${overdue ? "overdue" : ""}
                ">

                    <input
                        class="todo-check"
                        type="checkbox"
                        data-todo-toggle="${todo.id}"
                        ${todo.completed ? "checked" : ""}
                    >


                    <div class="todo-content">

                        <div class="todo-title">
                            ${escapeHTML(
                                todo.title
                            )}
                        </div>

                        <div class="todo-due">

                            ${
                                due
                                    ? formatDateTime(
                                        todo.due_at
                                    )
                                    : "Sans date"
                            }

                            ${
                                overdue
                                    ? " · En retard"
                                    : ""
                            }

                        </div>

                    </div>


                    <button
                        class="delete-todo"
                        data-todo-delete="${todo.id}"
                        type="button"
                    >
                        Supprimer
                    </button>

                </div>
            `;

        }).join("");


    document
        .querySelectorAll(
            "[data-todo-toggle]"
        )
        .forEach(input => {

            input.onchange = async () => {

                await toggleTodo(
                    input.dataset.todoToggle,
                    input.checked
                );

            };

        });


    document
        .querySelectorAll(
            "[data-todo-delete]"
        )
        .forEach(button => {

            button.onclick = async () => {

                await deleteTodo(
                    button.dataset.todoDelete
                );

            };

        });

}


async function addTodo() {

    const title =
        document.getElementById(
            "todo-title"
        ).value.trim();


    const dueAt =
        document.getElementById(
            "todo-date"
        ).value;


    if (!title) {

        alert(
            "Entre le nom de la tâche."
        );

        return;
    }


    const {
        error
    } = await supabaseClient
        .from("todos")
        .insert({

            user_id:
                currentUser.id,

            title,

            due_at:
                dueAt
                    ? new Date(
                        dueAt
                    ).toISOString()
                    : null,

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


    document.getElementById(
        "todo-title"
    ).value = "";

    document.getElementById(
        "todo-date"
    ).value = "";


    await loadTodos();

    renderTodos();

}


async function toggleTodo(
    id,
    completed
) {

    const {
        error
    } = await supabaseClient
        .from("todos")
        .update({
            completed
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

        console.error(error);

        return;
    }


    const todo =
        todos.find(
            item => item.id === id
        );


    if (todo) {
        todo.completed =
            completed;
    }


    renderTodos();

}


async function deleteTodo(id) {

    const {
        error
    } = await supabaseClient
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

    renderTodos();

}


/* =========================================================
   PAGES
   ========================================================= */

function showPage(page) {

    currentPage =
        page;


    document
        .querySelectorAll(".page")
        .forEach(section => {

            section.classList.add(
                "hidden"
            );

        });


    const target =
        document.getElementById(
            `page-${page}`
        );


    if (target) {

        target.classList.remove(
            "hidden"
        );

    }


    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });


    const labels = {

        dashboard:
            "TABLEAU DE BORD",

        notes:
            "NOTES",

        todo:
            "À FAIRE",

        brevet:
            "BREVET",

        calendar:
            "CALENDRIER",

        money:
            "ARGENT"

    };


    const eyebrow =
        document.getElementById(
            "page-eyebrow"
        );


    if (eyebrow) {

        eyebrow.textContent =
            labels[page] ||
            "BREVETTRACK";

    }


    if (page === "notes") {
        renderAllGrades();
    }

    if (page === "todo") {
        renderTodos();
    }

    if (page === "brevet") {
        updateBrevet();
    }

    if (page === "calendar") {
        renderCalendar();
    }

    if (page === "money") {
        updateMoneyUI();
    }


    closeMobileMenu();

}


function renderAllGrades() {

    const container =
        document.getElementById(
            "all-grades-list"
        );


    if (!container) return;


    if (!grades.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">▤</div>
                <h3>Aucune note</h3>
                <p>Ajoute ta première note pour commencer.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        grades
            .map(createGradeHTML)
            .join("");


    attachGradeDeleteButtons();

}


/* =========================================================
   CALENDRIER
   ========================================================= */

function renderCalendar() {

    const container =
        document.getElementById(
            "calendar-list"
        );


    if (!container) return;


    const input =
        document.getElementById(
            "calendar-date"
        );


    let selectedDate =
        input?.value ||
        getTodayISO();


    if (input) {
        input.value =
            selectedDate;
    }


    const events =
        todos
            .filter(todo => {

                if (!todo.due_at) {
                    return false;
                }

                return (
                    new Date(
                        todo.due_at
                    )
                    .toISOString()
                    .slice(0, 10)
                    === selectedDate
                );

            });


    if (!events.length) {

        container.innerHTML = `
            <div class="empty">
                <div class="empty-icon">◷</div>
                <h3>Aucun devoir ce jour</h3>
                <p>Tu n'as aucune tâche prévue pour cette date.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        events
            .map(todo => {

                return `
                    <div class="calendar-event">

                        <strong>
                            ${escapeHTML(
                                todo.title
                            )}
                        </strong>

                        <div class="money-meta">
                            ${formatDateTime(
                                todo.due_at
                            )}

                            ${
                                todo.completed
                                    ? " · Terminé"
                                    : ""
                            }
                        </div>

                    </div>
                `;

            })
            .join("");

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

    document
        .querySelectorAll(".nav-item")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    showPage(
                        button.dataset.page
                    );

                }
            );

        });

}


/* =========================================================
   BOUTONS
   ========================================================= */

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
            "add-grade-btn-notes"
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
            "add-money-btn"
        )
        ?.addEventListener(
            "click",
            openMoneyModal
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
            "edit-balances-btn"
        )
        ?.addEventListener(
            "click",
            openBalanceModal
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
            "add-todo-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "todo-form"
                    )
                    ?.classList.toggle(
                        "hidden"
                    );

            }
        );


    document
        .getElementById(
            "save-todo-btn"
        )
        ?.addEventListener(
            "click",
            addTodo
        );


    document
        .getElementById(
            "calendar-date"
        )
        ?.addEventListener(
            "change",
            renderCalendar
        );


    document
        .getElementById(
            "logout-btn"
        )
        ?.addEventListener(
            "click",
            async () => {

                await supabaseClient
                    .auth
                    .signOut();

                location.reload();

            }
        );


    document
        .getElementById(
            "profile-btn"
        )
        ?.addEventListener(
            "click",
            () => {

                alert(
                    `Connecté avec : ${currentUser.email}`
                );

            }
        );


    document
        .getElementById(
            "type-input"
        )
        ?.addEventListener(
            "change",
            () => {}
        );


    document
        .getElementById(
            "money-type"
        )
        ?.addEventListener(
            "change",
            event => {

                const input =
                    document.getElementById(
                        "money-amount"
                    );

                if (
                    event.target.value ===
                    "encouragement"
                ) {

                    input.value = "100";

                } else if (
                    event.target.value ===
                    "observation"
                ) {

                    input.value = "-150";

                }

            }
        );


    /*
       Fermer les modales en cliquant
       sur le fond.
    */

    document
        .querySelectorAll(".modal")
        .forEach(modalElement => {

            modalElement.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modalElement
                    ) {

                        modalElement.classList.add(
                            "hidden"
                        );

                    }

                }
            );

        });

}


/* =========================================================
   MENU MOBILE
   ========================================================= */

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


    if (
        !button ||
        !sidebar ||
        !overlay
    ) {
        return;
    }


    button.onclick =
        toggleMobileMenu;


    overlay.onclick =
        closeMobileMenu;

}


function toggleMobileMenu() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "mobile-overlay"
        );

    const button =
        document.getElementById(
            "mobile-menu-btn"
        );


    const open =
        sidebar.classList.toggle(
            "mobile-open"
        );


    overlay.classList.toggle(
        "active",
        open
    );


    button.setAttribute(
        "aria-expanded",
        open
            ? "true"
            : "false"
    );

}


function closeMobileMenu() {

    const sidebar =
        document.getElementById(
            "sidebar"
        );

    const overlay =
        document.getElementById(
            "mobile-overlay"
        );

    const button =
        document.getElementById(
            "mobile-menu-btn"
        );


    sidebar?.classList.remove(
        "mobile-open"
    );

    overlay?.classList.remove(
        "active"
    );

    button?.setAttribute(
        "aria-expanded",
        "false"
    );

}


/* =========================================================
   NOTIFICATIONS / SERVICE WORKER
   ========================================================= */

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

    } catch (error) {

        console.error(
            "Service worker :",
            error
        );

    }

}


/* =========================================================
   UTILITAIRES
   ========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement(
            "div"
        );

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


function getTodayISO() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        )
        .padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        )
        .padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;

}


function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }


    return date.toLocaleDateString(
        "fr-FR"
    );

}


function formatDateTime(dateValue) {

    if (!dateValue) {
        return "Sans date";
    }


    const date =
        new Date(dateValue);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Sans date";
    }


    return date.toLocaleString(
        "fr-FR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    );

}


/* =========================================================
   AUTH STATE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {

        if (
            event === "SIGNED_OUT"
        ) {

            currentUser = null;

            location.reload();

            return;
        }


        if (
            session &&
            !currentUser
        ) {

            currentUser =
                session.user;

            document
                .getElementById(
                    "auth-screen"
                )
                ?.classList.add(
                    "hidden"
                );

            document
                .getElementById(
                    "app"
                )
                ?.classList.remove(
                    "hidden"
                );

        }

    }
);


/* =========================================================
   LANCEMENT
   ========================================================= */

startApp();