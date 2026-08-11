// API endpoint configuration
const API_BASE = "http://localhost:4000";
const API_PATH = `${API_BASE}/api`;

let lastSaveTime = 0;
let lastSearchTime = 0;
let isLoading = false;

function toggleLoading(show) {
    console.log("[LOADER]", show ? "SHOWING" : "HIDING");
    const loader = document.getElementById("loader");
    if (loader) {
        loader.style.display = show ? "flex" : "none";
    }
    isLoading = show;
}

async function shownotes() {
    try {
        const res = await fetch(`${API_PATH}/notes`, {
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            }
        });
        const data = await res.json();
        const notes = document.getElementById("notes2");
        notes.innerText = "";
        
        if (!Array.isArray(data)) {
            notes.innerText = "No notes found";
            return;
        }
        
        data.forEach((e) => {
            const div = document.createElement('div');
            div.className = "card note-card";
            div.innerText = e.content.substring(0, 150);
            notes.append(div);
        });
    } catch (err) {
        console.log("Error loading notes: ", err);
        const notes = document.getElementById("notes2");
        if (notes) notes.innerText = "Error loading notes";
    }
}

async function addnotes() {
    if (isLoading) return;
    if (Date.now() - lastSaveTime < 1000) return;
    lastSaveTime = Date.now();
    
    let text = document.getElementById("input").value.trim();
    if (!text) {
        alert("Please enter some text to save");
        return;
    }
    
    try {
        toggleLoading(true);
        const res = await fetch(`${API_PATH}/write`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ text })
        });
        const msg = await res.json();
        if (res.ok) {
            document.getElementById("input").value = "";
            await shownotes();
            alert("Note saved successfully!");
        } else {
            alert("Error: " + (msg.error || "Failed to save note"));
        }
    } catch (err) {
        console.log("Error adding note:", err);
        alert("Connection error: " + err.message);
    } finally {
        toggleLoading(false);
    }
}

function typeText(element, text, speed = 5) {
    let i = 0;
    element.innerText = "";
    function typing() {
        if (i < text.length) {
            element.innerText += text[i];
            i++;
            setTimeout(typing, speed);
        } else {
            if (window.marked) {
                element.innerHTML = marked.parse(text);
            }
        }
    }
    typing();
}

async function querysearch() {
    if (isLoading) return;
    if (Date.now() - lastSearchTime < 1000) return;
    lastSearchTime = Date.now();

    let text = document.getElementById("query").value.trim();
    if (!text) {
        alert("Please enter a search query");
        return;
    }

    try {
        toggleLoading(true);
        let notes2 = document.getElementById("notes2");
        notes2.innerHTML = "";
        
        const loadingDiv = document.createElement("div");
        loadingDiv.className = "card";
        loadingDiv.innerText = "Thinking...";
        notes2.append(loadingDiv);

        const res = await fetch(`${API_PATH}/query`, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({ text })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        notes2.removeChild(loadingDiv);

        if (!data.answer) {
            notes2.innerHTML = "<div class='card'>No response received</div>";
            return;
        }

        const answerDiv = document.createElement("div");
        answerDiv.className = "card note-card";
        notes2.append(answerDiv);

        // answerDiv.innerText=data.answer;
        typeText(answerDiv, data.answer);
    } catch (err) {
        console.log("Search error:", err);
        let notes2 = document.getElementById("notes2");
        if (notes2) {
            notes2.innerHTML = `<div class='card' style='color: red;'>Error: ${err.message || 'Failed to search'}</div>`;
        }
    } finally {
        toggleLoading(false);
    }
}

async function clean() {
    await fetch(`${API_PATH}/reset`);
    alert("Reset Done");
    window.location.reload();
}

let currentTab = "login";

function switchTab(tab) {
    currentTab = tab;
    document.getElementById("authError").style.display = "none";
    if (tab === "login") {
        document.getElementById("nameField").style.display = "none";
        document.getElementById("tabLogin").style.borderBottom = "3px solid var(--ink)";
        document.getElementById("tabLogin").style.opacity = "1";
        document.getElementById("tabSignup").style.borderBottom = "3px solid transparent";
        document.getElementById("tabSignup").style.opacity = "0.5";
        document.getElementById("authSubmitBtn").innerText = "Enter the Archive";
    } else {
        document.getElementById("nameField").style.display = "block";
        document.getElementById("tabSignup").style.borderBottom = "3px solid var(--ink)";
        document.getElementById("tabSignup").style.opacity = "1";
        document.getElementById("tabLogin").style.borderBottom = "3px solid transparent";
        document.getElementById("tabLogin").style.opacity = "0.5";
        document.getElementById("authSubmitBtn").innerText = "Register";
    }
}

async function handleAuth() {
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    const name = document.getElementById("authName").value.trim();
    const errorEl = document.getElementById("authError");

    if (!email || !password) {
        errorEl.innerText = "Please fill in all fields.";
        errorEl.style.display = "block";
        return;
    }
    if (currentTab === "signup" && !name) {
        errorEl.innerText = "Please enter your name.";
        errorEl.style.display = "block";
        return;
    }

    try {
        const endpoint = currentTab === "login" ? "/auth/login" : "/auth/signup";
        const body = currentTab === "login" ? { email, password } : { name, email, password };
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) {
            errorEl.innerText = data.error || "Something went wrong.";
            errorEl.style.display = "block";
            return;
        }

        localStorage.setItem("token", data.token);
        localStorage.setItem("userId", data.userId);
        localStorage.setItem("userName", data.name);
        document.getElementById("authModal").style.display = "none";
    } catch (err) {
        errorEl.innerText = "Could not connect to server.";
        errorEl.style.display = "block";
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");

    const authModal = document.getElementById("authModal");
    if (authModal) authModal.style.display = "flex";

    const notes2 = document.getElementById("notes2");
    if (notes2) notes2.innerHTML = "";

    const queryInput = document.getElementById("query");
    if (queryInput) queryInput.value = "";

    const inputField = document.getElementById("input");
    if (inputField) inputField.value = "";

    const authError = document.getElementById("authError");
    if (authError) {
        authError.style.display = "none";
        authError.innerText = "";
    }

    const authEmail = document.getElementById("authEmail");
    const authPassword = document.getElementById("authPassword");
    const authName = document.getElementById("authName");
    if (authEmail) authEmail.value = "";
    if (authPassword) authPassword.value = "";
    if (authName) authName.value = "";

    switchTab("login");
}

async function uploadPdf() {
    if (isLoading) return;
    
    const fileInput = document.getElementById('pdfInput');
    if (!fileInput.files || !fileInput.files[0]) {
        alert("Please select a PDF file");
        return;
    }
    const file = fileInput.files[0];
    if (file.type !== 'application/pdf') {
        alert("Please select a PDF file");
        return;
    }

    try {
        toggleLoading(true);
        const formData = new FormData();
        formData.append('pdf', file);

        const res = await fetch(`${API_PATH}/upload-pdf`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem("token")}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) {
            alert("Error: " + (data.error || "Upload failed"));
            return;
        }

        alert(`${data.msg}\n\nText Length: ${data.textLength} chars\nChunks Created: ${data.chunksCreated}`);
        fileInput.value = "";
        await shownotes();
    } catch (err) {
        console.log("PDF upload error:", err);
        alert("Upload failed: " + err.message);
    } finally {
        toggleLoading(false);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    const authModal = document.getElementById("authModal");
    if (token) {
        if (authModal) authModal.style.display = "none";
    } else {
        if (authModal) authModal.style.display = "flex";
    }
});