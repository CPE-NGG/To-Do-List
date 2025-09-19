document.addEventListener("DOMContentLoaded", () => {
    const taskForm = document.getElementById("taskForm");
    const taskInput = document.getElementById("taskInput");
    const prioritySelect = document.getElementById("prioritySelect");
    const dueDateInput = document.getElementById("dueDate");
    const dueTimeInput = document.getElementById("dueTime");
    const searchInput = document.getElementById("searchInput");
    const taskList = document.getElementById("taskList");
    const taskCounter = document.getElementById("taskCounter");
    const statsPanel = document.getElementById("statsPanel");
    const undoBtn = document.getElementById("undoBtn");
    const exportBtn = document.getElementById("exportBtn");
    const importBtn = document.getElementById("importBtn");
    const clearAllBtn = document.getElementById("clearAllBtn");
    const notification = document.getElementById("notification");
    const notesBtn = document.getElementById("notesBtn");
    const notesPanel = document.getElementById("notesPanel");
    const notesContent = document.getElementById("notesContent");
    const todoContainer = document.querySelector(".todo-container");

    let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    let undoStack = [];
    let currentSort = { key: null, asc: true };
    let activeEditor = null;

    const todayISO = new Date().toISOString().split("T")[0];
    dueDateInput.setAttribute("min", todayISO);

    function showModal(title, message, onConfirm, showCancel = true) {
    const modal = document.getElementById("appModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalMessage = document.getElementById("modalMessage");
    const confirmBtn = document.getElementById("modalConfirmBtn");
    const cancelBtn = document.getElementById("modalCancelBtn");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add("active");

    cancelBtn.style.display = showCancel ? "inline-block" : "none";

    const closeModal = () => modal.classList.remove("active");

    confirmBtn.onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
    cancelBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    function showInfoModal(title, message, onOk = null) {
    const modal = document.getElementById("infoModal");
    const modalTitle = document.getElementById("infoModalTitle");
    const modalMessage = document.getElementById("infoModalMessage");
    const okBtn = document.getElementById("infoModalOkBtn");

    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modal.classList.add("active");

    const closeModal = () => modal.classList.remove("active");

    okBtn.onclick = () => { closeModal(); if (onOk) onOk(); };
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    }

    const saveState = () => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
    renderTasks();
    };

    const formatTimeLeft = (ms) => {
    if (ms == null) return "-";
    const totalSeconds = Math.floor(ms / 1000);
    const absSeconds = Math.abs(totalSeconds);
    const days = Math.floor(absSeconds / (60 * 60 * 24));
    const hours = Math.floor((absSeconds % (60 * 60 * 24)) / 3600);
    const minutes = Math.floor((absSeconds % 3600) / 60);
    const seconds = absSeconds % 60;
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(" ");
    };

    const renderTasks = () => {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredTasks = tasks.filter(task => task.text.toLowerCase().includes(searchTerm));

    if (currentSort.key) {
        if (currentSort.key === "priority") {
        const order = { hard: 1, medium: 2, easy: 3 };
        filteredTasks.sort((a, b) =>
            currentSort.asc ? order[a.priority] - order[b.priority] : order[b.priority] - order[a.priority]
        );
        } else if (currentSort.key === "deadline") {
        filteredTasks.sort((a, b) => {
            const da = a.due ? new Date(a.due) : null;
            const db = b.due ? new Date(b.due) : null;
            if (!da && !db) return 0;
            if (!da) return 1;
            if (!db) return -1;
            return currentSort.asc ? da - db : db - da;
        });
        } else if (currentSort.key === "timeLeft") {
        const now = new Date();
        filteredTasks.sort((a, b) => {
            const ta = a.completed && a.frozenTime != null ? a.frozenTime : a.due ? new Date(a.due) - now : Infinity;
            const tb = b.completed && b.frozenTime != null ? b.frozenTime : b.due ? new Date(b.due) - now : Infinity;
            return currentSort.asc ? ta - tb : tb - ta;
        });
        } else if (currentSort.key === "task") {
        filteredTasks.sort((a, b) =>
            currentSort.asc ? a.text.localeCompare(b.text) : b.text.localeCompare(a.text)
        );
        }
    }

    taskList.innerHTML = "";
    const now = new Date();
    filteredTasks.forEach(task => {
        const row = document.createElement("tr");
        row.dataset.id = task.id;

        const dueDate = task.due ? new Date(task.due) : null;
        let timeLeftText = "-";
        let timeLeftClass = "";
        let overdueRow = false;

        if (dueDate) {
        if (task.completed && task.frozenTime != null) {
            timeLeftText = formatTimeLeft(task.frozenTime) + (task.frozenTime < 0 ? " overdue" : "");
        } else {
            const diff = dueDate - now;
            if (diff < 0) {
            timeLeftText = formatTimeLeft(diff) + " overdue";
            timeLeftClass = "overdue";
            overdueRow = true;
            } else {
            timeLeftText = formatTimeLeft(diff);
            task.remaining = diff;
            }
        }
        }

        if (task.completed) {
        row.classList.add("completed-row");
        } else if (overdueRow) {
        row.classList.add("overdue-row");
        }

        row.innerHTML = `
        <td><input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}></td>
        <td class="task-text ${task.completed ? "completed" : ""}">${escapeHtml(task.text)}</td>
        <td class="priority-cell ${task.completed ? "completed" : ""}">
            <div class="priority-stripe ${task.completed ? "priority-gray" : `priority-${task.priority}`}"></div>
            <span>${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}</span>
        </td>
        <td><span class="due-date ${task.completed ? "completed" : (dueDate && dueDate < now ? "overdue" : "")}">${task.due ? dueDate.toLocaleString() : "-"}</span></td>
        <td><span class="time-left ${task.completed ? "completed" : timeLeftClass}">${timeLeftText}</span></td>
        <td><button class="delete-btn">🗑️</button></td>
        `;
        taskList.appendChild(row);
    });

    updateStats();
    };

    function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
    }

    const updateStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const upcoming = tasks.filter(t => t.due && new Date(t.due) >= new Date()).length;
    taskCounter.textContent = `${completed}/${total} completed`;
    statsPanel.textContent = `📊 Total: ${total} | ✅ Completed: ${completed} | 📅 Upcoming: ${upcoming}`;
    };

    const addTask = (e) => {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;

    let due = null;
    if (dueDateInput.value) {
        due = dueDateInput.value;
        if (dueTimeInput.value) due += "T" + dueTimeInput.value;
        else due += "T00:00";
    }

    if (!due) {
        showModal("No Deadline", "No deadline set. Do you want to add this task without a deadline?", () => {
        proceedAddTask(text, due);
        showInfoModal("Task Added", "Your task has been added successfully!");
        });
        return;
    }
    proceedAddTask(text, due);
    showInfoModal("Task Added", "Your task has been added successfully!");
    };

    function proceedAddTask(text, due) {
    const newTask = {
        id: Date.now(),
        text,
        completed: false,
        priority: prioritySelect.value,
        due,
        frozenTime: null
    };
    undoStack.push({ type: 'add', task: JSON.parse(JSON.stringify(newTask)) });
    tasks.push(newTask);
    taskForm.reset();
    prioritySelect.value = "medium";
    saveState();
    }

    const handleTaskListClick = (e) => {
    const target = e.target;
    const tr = target.closest("tr");
    if (!tr) return;
    const taskId = Number(tr.dataset.id);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (target.classList.contains("delete-btn")) {
        showModal("Delete Task", `Are you sure you want to delete "${task.text}"?`, () => {
        undoStack.push({ type: 'delete', task: JSON.parse(JSON.stringify(task)) });
        tasks = tasks.filter(t => t.id !== taskId);
        saveState();
        showInfoModal("Task Deleted", "The task was successfully deleted.");
        });
        return;
    }

    if (target.classList.contains("task-checkbox")) {
        const previousState = JSON.parse(JSON.stringify(task));
        task.completed = target.checked;
        if (task.completed && task.due) task.frozenTime = new Date(task.due) - new Date();
        else task.frozenTime = null;
        undoStack.push({ type: 'toggle', task: previousState });
        saveState();
        if (task.completed) {
        showInfoModal("Task Completed", `"${task.text}" has been marked as done.`);
        } else {
        showInfoModal("Task Unchecked", `"${task.text}" has been marked as not completed.`);
        }
        return;
    }

    if (target.classList.contains("task-text")) {
        startInlineEdit(tr, task);
        return;
    }
    };

    function startInlineEdit(tr, task) {
    if (activeEditor) return;
    const cell = tr.querySelector(".task-text");
    if (!cell) return;

    const originalText = task.text;
    const input = document.createElement("input");
    input.type = "text";
    input.value = originalText;

    Object.assign(input.style, {
        background: "white",
        border: "2px solid #007bff",
        width: "100%",
        font: "inherit",
        textAlign: "inherit",
        padding: "4px 8px",
        margin: "0",
        outline: "none",
        boxSizing: "border-box",
        borderRadius: "4px"
    });

    const originalContent = cell.innerHTML;
    cell.innerHTML = "";
    cell.appendChild(input);
    input.focus();
    input.select();
    activeEditor = { input, cell, originalContent, task, originalText };

    notification.textContent = "Editing: Press Enter to save or Esc to cancel";
    notification.style.display = "block";

    let finished = false;

    const cleanup = () => {
        if (finished) return;
        finished = true;
        activeEditor = null;
        notification.style.display = "none";
        document.removeEventListener("click", outsideClickListener);
        document.removeEventListener("keydown", escapeHandler);
    };

    const saveEdit = () => {
        if (finished) return;
        const newText = input.value.trim();
        if (newText && newText !== originalText) {
        const previousState = JSON.parse(JSON.stringify(task));
        task.text = newText;
        undoStack.push({ type: 'edit', task: previousState });
        saveState();
        showInfoModal("Task Updated", `Task changed to "${task.text}".`);
        } else {
        cell.innerHTML = originalContent;
        }
        cleanup();
        renderTasks();
    };

    const cancelEdit = () => {
        if (finished) return;
        cell.innerHTML = originalContent;
        cleanup();
        renderTasks();
    };

    const escapeHandler = (ev) => {
        if (ev.key === "Escape") {
        ev.preventDefault();
        cancelEdit();
        }
    };

    const outsideClickListener = (ev) => {
        if (!cell.contains(ev.target)) {
        saveEdit();
        }
    };

    input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
        ev.preventDefault();
        saveEdit();
        }
    });

    document.addEventListener("click", outsideClickListener);
    document.addEventListener("keydown", escapeHandler);
    }

    const undoLastAction = () => {
    if (undoStack.length > 0) {
        const lastAction = undoStack.pop();
        if (lastAction.type === 'clearAll') {
        tasks = lastAction.tasks;
        saveState();
        return;
        }
        if (lastAction.type === 'delete') {
        const exists = tasks.some(t => t.id === lastAction.task.id);
        if (exists) lastAction.task.id = Date.now();
        tasks.push(lastAction.task);
        } else if (lastAction.type === 'add') {
        tasks = tasks.filter(t => t.id !== lastAction.task.id);
        } else if (lastAction.type === 'edit') {
        const t = tasks.find(tt => tt.id === lastAction.task.id);
        if (t) t.text = lastAction.task.text;
        } else if (lastAction.type === 'toggle') {
        const t = tasks.find(tt => tt.id === lastAction.task.id);
        if (t) {
            t.completed = lastAction.task.completed;
            t.frozenTime = lastAction.task.frozenTime;
        }
        }
        saveState();
    } else {
        notification.textContent = "Nothing to undo.";
        notification.style.display = "block";
        setTimeout(() => { notification.style.display = "none"; }, 1800);
    }
    };

    const clearAll = () => {
        if (tasks.length === 0) {
            showInfoModal("Nothing to Clear", "There are no tasks to clear.");
            return;
        }

        showModal("Clear All Tasks", "Are you sure you want to delete all tasks?", () => {
            undoStack.push({ type: 'clearAll', tasks: JSON.parse(JSON.stringify(tasks)) });
            tasks = [];
            saveState();
            showInfoModal("All Cleared", "All tasks have been successfully deleted.");
        });
    };


    const exportTasks = () => {
    if (tasks.length === 0) {
        showModal("Export Tasks", "No tasks to export.", null, false);
        return;
    }
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.json";
    a.click();
    URL.revokeObjectURL(url);
    showInfoModal("Exported", "Your tasks have been exported successfully!");
    };

    const importTasks = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
        try {
            const importedTasks = JSON.parse(event.target.result);
            if (Array.isArray(importedTasks)) {
            undoStack.push({ type: 'clearAll', tasks: JSON.parse(JSON.stringify(tasks)) });
            const clean = importedTasks.filter(t => t && t.text);
            tasks = clean.map(t => { if (!t.id) t.id = Date.now() + Math.floor(Math.random() * 1000); return t; });
            saveState();
            showInfoModal("Import Successful", "Tasks have been imported successfully!");
            } else showModal("Import Error", "Invalid file format.", null, false);
        } catch { showModal("Import Error", "Error parsing file.", null, false); }
        };
        reader.readAsText(file);
    };
    input.click();
    };

    const handleSort = (e) => {
    const th = e.target.closest("th");
    if (!th) return;
    const key = th.dataset.sort;
    if (!key) return;
    if (currentSort.key === key) currentSort.asc = !currentSort.asc;
    else currentSort = { key, asc: true };
    renderTasks();
    };

    notesContent.value = localStorage.getItem("notes") || "";

    notesContent.addEventListener("input", () => {
    localStorage.setItem("notes", notesContent.value);
    });

    notesBtn.addEventListener("click", () => {
    const isActive = notesPanel.classList.toggle("active");
    todoContainer.classList.toggle("shrink", isActive);
    });

    taskForm.addEventListener("submit", addTask);
    taskForm.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); taskForm.requestSubmit(); } });
    taskList.addEventListener("click", handleTaskListClick);
    searchInput.addEventListener("input", renderTasks);
    undoBtn.addEventListener("click", (e) => { e.preventDefault(); undoLastAction(); });
    clearAllBtn.addEventListener("click", (e) => { e.preventDefault(); clearAll(); });
    exportBtn.addEventListener("click", (e) => { e.preventDefault(); exportTasks(); });
    importBtn.addEventListener("click", (e) => { e.preventDefault(); importTasks(); });
    document.querySelectorAll("#taskTable th[data-sort]").forEach(th => th.addEventListener("click", handleSort));

    setInterval(() => {
        if (!activeEditor) {
            renderTasks();
        }
    }, 1000);
    renderTasks();
});