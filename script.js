document.addEventListener("DOMContentLoaded", () => {
  // --- Global State & Elements ---
  const commandInput = document.getElementById("command-input");
  const output = document.getElementById("output");
  const editorModal = document.getElementById("note-editor-modal");
  const editorTextarea = document.getElementById("note-editor-textarea");
  const saveButton = document.getElementById("note-editor-save");
  const cancelButton = document.getElementById("note-editor-cancel");
  const commandForm = document.getElementById("command-form");
  const terminal = document.getElementById("terminal");

  // Alert Modal Elements
  const alertModal = document.getElementById("alert-modal");
  const alertModalTitle = document.getElementById("alert-modal-title");
  const alertModalMessage = document.getElementById("alert-modal-message");
  const alertModalClose = document.getElementById("alert-modal-close");

  let currentEditingIndex = null;
  let commandHistory = [];
  let historyIndex = 0;

  // Timer State
  let pomoTimeout = null;
  let simpleTimerTimeout = null;
  let notificationPermission = "default";

  // --- Initial Setup ---
  printToOutput(
    "Welcome to TermTask! Type 'help' for a list of commands.",
    "help",
  );
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js");
  }
  Notification.requestPermission().then((perm) => {
    notificationPermission = perm;
  });

  // --- Core Event Listeners ---

  commandForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const commandStr = commandInput.value.trim();
    if (commandStr) {
      printToOutput(`> ${commandStr}`, "command-echo");
      processCommand(commandStr);
      if (commandStr !== commandHistory[commandHistory.length - 1]) {
        commandHistory.push(commandStr);
      }
      historyIndex = commandHistory.length;
      commandInput.value = "";
      output.scrollTop = output.scrollHeight;
    }
  });

  commandInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        commandInput.value = commandHistory[historyIndex];
        commandInput.setSelectionRange(
          commandInput.value.length,
          commandInput.value.length,
        );
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        commandInput.value = commandHistory[historyIndex];
      } else {
        historyIndex = commandHistory.length;
        commandInput.value = "";
      }
    }
  });

  terminal.addEventListener("click", () => {
    commandInput.focus();
  });

  saveButton.addEventListener("click", () => {
    const notes = getData("notes");
    notes[currentEditingIndex - 1] = editorTextarea.value;
    setData("notes", notes);
    editorModal.style.display = "none";
    printToOutput(`Note ${currentEditingIndex} saved.`, "note");
    commandInput.focus();
  });

  cancelButton.addEventListener("click", () => {
    editorModal.style.display = "none";
    printToOutput("Edit cancelled.", "response");
    commandInput.focus();
  });

  alertModalClose.addEventListener("click", () => {
    alertModal.style.display = "none";
    commandInput.focus();
  });

  /**
   * Parses a command string, respecting quoted sections.
   * @param {string} str The command string to parse.
   * @returns {string[]} An array of command parts.
   */
  function parseCommandStr(str) {
    const matches = str.match(/"[^"]+"|[^"\s]+/g) || [];
    return matches.map((arg) => {
      if (arg.startsWith('"') && arg.endsWith('"')) {
        return arg.substring(1, arg.length - 1);
      }
      return arg;
    });
  }

  // --- Command Processor ---
  function processCommand(commandStr) {
    const [tool, ...args] = parseCommandStr(commandStr);
    const action = args[0];
    const params = args.slice(1);

    if (tool.startsWith("http")) {
      window.open(tool, "_blank");
      return;
    }

    switch (tool) {
      case "help":
        printHelp(action);
        break;
      case "clear":
        output.innerHTML = "";
        break;

      case "note":
      case "notes": {
        const knownActions = ["add", "edit", "del", "save", "open"];
        const content = params.join(" ");

        if (!action) {
          listData("notes", "note", (item) => item);
        } else if (knownActions.includes(action)) {
          switch (action) {
            case "add":
              saveData("notes", content);
              printToOutput("Note saved.", "note");
              break;
            case "edit":
              editNoteByName(content);
              break;
            case "del":
              deleteNoteByName(content);
              break;
            case "save":
              saveDataToFile("notes", "notes.txt");
              break;
            case "open":
              openDataFromFile("notes");
              break;
          }
        } else {
          saveData("notes", args.join(" "));
          printToOutput("Note saved.", "note");
        }
        break;
      }

      case "todo":
      case "todos": {
        const knownActions = ["add", "done", "save", "open"];
        if (!action) {
          listTodos();
        } else if (knownActions.includes(action)) {
          switch (action) {
            case "add":
              saveData("todos", { text: params.join(" "), done: false });
              printToOutput("Todo added.", "todo");
              break;
            case "done":
              markTodoDone(parseInt(params[0], 10));
              break;
            case "save":
              saveDataToFile("todos", "todos.txt");
              break;
            case "open":
              openDataFromFile("todos");
              break;
          }
        } else {
          saveData("todos", { text: args.join(" "), done: false });
          printToOutput("Todo added.", "todo");
        }
        break;
      }

      case "cal": {
        if (action && /^\d{4}$/.test(action) && params.length === 0) {
          showMonthCalendar(action);
          break;
        }

        switch (action) {
          case "add":
            addCalendarEvent(params[0], params.slice(1).join(" "));
            break;
          case "view":
            if (!params[0] || params[0] === "all") {
              viewAllCalendarEvents();
            } else {
              viewCalendarEvents(params[0]);
            }
            break;
          case "save":
            saveCalendarData();
            break;
          case "open":
            openCalendarData();
            break;
          default:
            if (!action) {
              showMonthCalendar();
              break;
            }
            printToOutput(
              "Error: 'cal' action not found. Use: add, view, save, open, or YYMM.",
              "error",
            );
            break;
        }
        break;
      }

      case "contact":
      case "contacts": {
        if (!action) {
          listData("contacts", "note", (item) => `${item.name}: ${item.info}`);
        } else {
          switch (action) {
            case "add":
              addContact(params[0], params.slice(1).join(" "));
              break;
            case "find":
              findContact(params.join(" "));
              break;
            case "del":
              deleteContact(params.join(" "));
              break;
            case "save":
              saveDataToFile("contacts", "contacts.txt");
              break;
            case "open":
              openDataFromFile("contacts");
              break;
            default:
              printToOutput(
                "Error: Unknown 'contact' action. Use: add, find, del, save, open.",
                "error",
              );
              break;
          }
        }
        break;
      }

      case "link":
      case "links": {
        const knownActions = ["add", "del", "edit", "go", "save", "open"];
        if (!action) {
          listLinks();
        } else if (knownActions.includes(action)) {
          switch (action) {
            case "add":
              addLink(params[0], params.slice(1).join(" "));
              break;
            case "del":
              deleteLink(params.join(" "));
              break;
            case "edit":
              editLink(params[0], params[1]);
              break;
            case "go":
              openLink(params.join(" "));
              break;
            case "save":
              saveDataToFile("links", "links.txt");
              break;
            case "open":
              openDataFromFile("links");
              break;
          }
        } else {
          const url = args[0];
          const name = args.slice(1).join(" ");
          addLink(url, name);
        }
        break;
      }

      case "pomo": {
        switch (action) {
          case "start":
            startPomo(parseInt(params[0]), parseInt(params[1]));
            break;
          case "stop":
            stopPomo();
            break;
          default:
            printToOutput(
              "Error: 'pomo' requires an action (start, stop).",
              "error",
            );
            break;
        }
        break;
      }

      case "calc":
        const result = calculate(args.join(" "));
        printToOutput(
          result,
          result.startsWith("Error") ? "error" : "response",
        );
        break;

      case "time":
        printToOutput(new Date().toLocaleString(), "response");
        break;

      case "timer":
        if (!action || !isNaN(parseInt(action, 10))) {
          startSimpleTimer(parseInt(action, 10), args.slice(1).join(" "));
        } else if (action === "stop") {
          stopSimpleTimer();
        } else {
          printToOutput(
            'Usage: timer [minutes] "[message]" or timer stop',
            "error",
          );
        }
        break;

      case "remind":
        setReminder(action, params.join(" "));
        break;

      default:
        printToOutput(`Error: Command not found '${tool}'.`, "error");
    }
  }

  // --- Helper Functions ---
  function printToOutput(message, className = "response") {
    output.innerHTML += `<div class="${className}">${message}</div>`;
    output.scrollTop = output.scrollHeight;
  }

  function showAlertModal(title, message) {
    alertModalTitle.textContent = title;
    alertModalMessage.textContent = message;
    alertModal.style.display = "flex";
    showNotification(title, message);
  }

  const getData = (key) => JSON.parse(localStorage.getItem(key)) || [];
  const setData = (key, data) =>
    localStorage.setItem(key, JSON.stringify(data));

  function saveData(key, value) {
    if (!value || (typeof value === "string" && !value.trim())) {
      printToOutput("Error: No content provided.", "error");
      return;
    }
    const data = getData(key);
    data.push(value);
    setData(key, data);
  }

  function listData(key, className, formatter) {
    const data = getData(key);
    if (data.length === 0) {
      printToOutput(`No ${key} found.`, "response");
      return;
    }
    let listHtml = data
      .map((item, index) => `${index + 1}. ${formatter(item)}`)
      .join("\n");
    printToOutput(listHtml, className);
  }

  function deleteDataItem(key, index) {
    if (isNaN(index)) {
      printToOutput("Error: Please provide a valid number.", "error");
      return;
    }
    const data = getData(key);
    if (index > 0 && index <= data.length) {
      data.splice(index - 1, 1);
      setData(key, data);
      printToOutput(`Item ${index} from ${key} deleted.`, "note");
    } else {
      printToOutput(`Error: Invalid index ${index}.`, "error");
    }
  }

  // --- File I/O ---
  function saveDataToFile(storageKey, fileName) {
    const data = getData(storageKey);
    if (data.length === 0) {
      printToOutput(`No data in ${storageKey} to save.`, "response");
      return;
    }
    const textToSave = JSON.stringify(data, null, 2);
    const blob = new Blob([textToSave], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    printToOutput(`Data saved to ${fileName}.`, "note");
  }

  function openDataFromFile(storageKey) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) {
        printToOutput("File selection cancelled.", "response");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newNotes = JSON.parse(event.target.result);
          if (!Array.isArray(newNotes))
            throw new Error("File is not a valid JSON array.");
          setData(storageKey, newNotes);
          printToOutput(
            `Loaded ${newNotes.length} items into ${storageKey} from ${file.name}.`,
            "note",
          );
        } catch (err) {
          printToOutput(
            `Error: Could not parse file. Make sure it's a valid JSON array file.`,
            "error",
          );
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // --- Feature-Specific Functions ---

  // Notes
  function openNoteEditor(index) {
    if (isNaN(index)) {
      printToOutput("Error: Please provide a note number to edit.", "error");
      return;
    }
    const notes = getData("notes");
    if (index > 0 && index <= notes.length) {
      currentEditingIndex = index;
      editorTextarea.value = notes[index - 1];
      editorModal.style.display = "flex";
      editorTextarea.focus();
    } else {
      printToOutput(`Error: Invalid note index ${index}.`, "error");
    }
  }

  function editNoteByName(searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      printToOutput(
        "Error: Please provide text from the note to edit.",
        "error",
      );
      return;
    }
    const notes = getData("notes");
    const noteIndexToEdit = notes.findIndex((note) =>
      note.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (noteIndexToEdit !== -1) {
      openNoteEditor(noteIndexToEdit + 1);
    } else {
      printToOutput(`Error: No note found matching "${searchTerm}".`, "error");
    }
  }

  function deleteNoteByName(searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      printToOutput(
        "Error: Please provide text from the note to delete.",
        "error",
      );
      return;
    }
    let notes = getData("notes");
    const noteIndexToDelete = notes.findIndex((note) =>
      note.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    if (noteIndexToDelete !== -1) {
      const [deletedNoteText] = notes.splice(noteIndexToDelete, 1);
      setData("notes", notes);
      printToOutput(`Note deleted: "${deletedNoteText}"`, "note");
    } else {
      printToOutput(`Error: No note found matching "${searchTerm}".`, "error");
    }
  }

  // Todos
  function listTodos() {
    listData(
      "todos",
      "todo",
      (item) => `[${item.done ? "x" : " "}] ${item.text}`,
    );
  }
  function markTodoDone(index) {
    if (isNaN(index)) {
      printToOutput("Error: Please provide a valid number.", "error");
      return;
    }
    const todos = getData("todos");
    if (index > 0 && index <= todos.length) {
      todos[index - 1].done = true;
      setData("todos", todos);
      printToOutput(`Todo ${index} marked as done.`, "todo");
      listTodos();
    } else {
      printToOutput(`Error: Invalid todo index ${index}.`, "error");
    }
  }

  // Links
  function listLinks() {
    listData("links", "link", (item) => {
      const safeName = item.name.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `${safeName} - <a href="${item.url}" target="_blank" style="color: #9cdcfe;">${item.url}</a>`;
    });
  }

  function addLink(url, name) {
    if (!url || !url.trim()) {
      printToOutput(
        'Error: URL is required. Use: link add <url> "[name]"',
        "error",
      );
      return;
    }
    let fullUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      fullUrl = "http://" + url;
    }
    const linkName = name && name.trim() ? name.trim() : url;
    saveData("links", { name: linkName, url: fullUrl });
    printToOutput(`Link saved: "${linkName}"`, "link");
  }

  function findLinkIndex(searchTerm) {
    if (!searchTerm || !searchTerm.trim()) {
      printToOutput("Error: Please provide a name to search for.", "error");
      return -1;
    }
    const links = getData("links");
    const index = links.findIndex((b) =>
      b.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    return index;
  }

  function openLink(searchTerm) {
    const index = findLinkIndex(searchTerm);
    if (index !== -1) {
      const link = getData("links")[index];
      printToOutput(`Opening "${link.name}"...`, "link");
      window.open(link.url, "_blank");
    } else {
      printToOutput(`Error: No link found matching "${searchTerm}".`, "error");
    }
  }

  function deleteLink(searchTerm) {
    const index = findLinkIndex(searchTerm);
    if (index !== -1) {
      let links = getData("links");
      const [deletedLink] = links.splice(index, 1);
      setData("links", links);
      printToOutput(`Link deleted: "${deletedLink.name}"`, "link");
    } else {
      printToOutput(`Error: No link found matching "${searchTerm}".`, "error");
    }
  }

  function editLink(searchTerm, newName) {
    if (!newName || !newName.trim()) {
      printToOutput(
        'Error: Please provide a new name. Use: link edit "<old name>" "<new name>"',
        "error",
      );
      return;
    }
    const index = findLinkIndex(searchTerm);
    if (index !== -1) {
      let links = getData("links");
      const oldName = links[index].name;
      links[index].name = newName;
      setData("links", links);
      printToOutput(`Link renamed from "${oldName}" to "${newName}".`, "link");
    } else {
      printToOutput(`Error: No link found matching "${searchTerm}".`, "error");
    }
  }

  // Calendar
  function showMonthCalendar(yymm) {
    let date;
    if (yymm) {
      const year = 2000 + parseInt(yymm.substring(0, 2), 10);
      const month = parseInt(yymm.substring(2, 4), 10) - 1;
      if (month < 0 || month > 11) {
        printToOutput(`Error: Invalid month in '${yymm}'.`, "error");
        return;
      }
      date = new Date(year, month, 1);
    } else {
      date = new Date();
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = monthNames[month];
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay();
    const numDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const currentDay =
      today.getFullYear() === year && today.getMonth() === month
        ? today.getDate()
        : 0;

    let calendarHtml = `   ${monthName} ${year}\n`;
    calendarHtml += " Su Mo Tu We Th Fr Sa\n";

    let day = 1;
    for (let i = 0; i < 6; i++) {
      let weekStr = "";
      for (let j = 0; j < 7; j++) {
        if (i === 0 && j < startingDay) {
          weekStr += "   ";
        } else if (day > numDays) {
          break;
        } else {
          let dayStr = day.toString().padStart(2, " ");
          if (day === currentDay) {
            weekStr += `<span class="current-day">${dayStr}</span> `;
          } else {
            weekStr += `${dayStr} `;
          }
          day++;
        }
      }
      if (weekStr.trim() !== "") {
        calendarHtml += weekStr.trimEnd() + "\n";
      }
      if (day > numDays) {
        break;
      }
    }
    printToOutput(calendarHtml.trim(), "calendar");
  }

  function addCalendarEvent(dateStr, eventText) {
    if (!dateStr || !/^\d{6}$/.test(dateStr)) {
      printToOutput(
        `Error: Invalid format. Use: cal add YYMMDD "event"`,
        "error",
      );
      return;
    }
    if (!eventText || !eventText.trim()) {
      printToOutput("Error: Event text cannot be empty.", "error");
      return;
    }
    const key = `cal-${dateStr}`;
    saveData(key, eventText);
    printToOutput(`Event added for ${dateStr}.`, "calendar");
  }
  function viewCalendarEvents(dateStr) {
    if (!dateStr || !/^\d{6}$/.test(dateStr)) {
      printToOutput(`Error: Invalid date format. Use YYMMDD.`, "error");
      return;
    }
    const key = `cal-${dateStr}`;
    listData(key, "calendar", (item) => item);
  }
  function viewAllCalendarEvents() {
    const allEvents = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("cal-")) {
        const dateStr = key.substring(4);
        const eventsOnDate = getData(key);
        if (eventsOnDate.length > 0) {
          allEvents.push({ date: dateStr, events: eventsOnDate });
        }
      }
    }

    if (allEvents.length === 0) {
      printToOutput("No calendar events found.", "response");
      return;
    }

    allEvents.sort((a, b) => a.date.localeCompare(b.date));

    let outputHtml = "";
    allEvents.forEach((day) => {
      const year = `20${day.date.substring(0, 2)}`;
      const month = day.date.substring(2, 4);
      const date = day.date.substring(4, 6);
      const formattedDate = `${year}-${month}-${date}`;

      outputHtml += `\n<span class="calendar-date">${formattedDate}:</span>\n`;
      day.events.forEach((event, index) => {
        outputHtml += `  ${index + 1}. ${event}\n`;
      });
    });

    printToOutput(outputHtml.trim(), "calendar");
  }
  function saveCalendarData() {
    const calData = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith("cal-")) {
        calData[key] = getData(key);
      }
    }
    if (Object.keys(calData).length === 0) {
      printToOutput("No calendar data to save.", "response");
      return;
    }
    const textToSave = JSON.stringify(calData, null, 2);
    const blob = new Blob([textToSave], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "calendar.txt";
    a.click();
    URL.revokeObjectURL(a.href);
    printToOutput("Calendar data saved.", "calendar");
  }
  function openCalendarData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.json";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const newCalData = JSON.parse(event.target.result);
          for (const key in newCalData) {
            if (key.startsWith("cal-") && Array.isArray(newCalData[key])) {
              setData(key, newCalData[key]);
            }
          }
          printToOutput(`Calendar data loaded from ${file.name}.`, "calendar");
        } catch (err) {
          printToOutput(`Error: Could not parse calendar file.`, "error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // Contacts
  function addContact(name, info) {
    if (!name || !info) {
      printToOutput(
        'Error: Contact requires a name and info. Use: contact add "name" "info"',
        "error",
      );
      return;
    }
    saveData("contacts", { name, info });
    printToOutput(`Contact ${name} added.`, "note");
  }
  function findContact(searchTerm) {
    const contacts = getData("contacts");
    const results = contacts.filter((c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    if (results.length > 0) {
      let listHtml = results
        .map((item) => `${item.name}: ${item.info}`)
        .join("\n");
      printToOutput(listHtml, "note");
    } else {
      printToOutput(`No contact found matching "${searchTerm}".`, "response");
    }
  }
  function deleteContact(name) {
    let contacts = getData("contacts");
    const initialLength = contacts.length;
    contacts = contacts.filter(
      (c) => c.name.toLowerCase() !== name.toLowerCase(),
    );
    if (contacts.length < initialLength) {
      setData("contacts", contacts);
      printToOutput(`Contact(s) named "${name}" deleted.`, "note");
    } else {
      printToOutput(`No contact named "${name}" found.`, "error");
    }
  }

  // Timers and Notifications
  function startPomo(workMins = 25, breakMins = 5) {
    if (pomoTimeout) {
      printToOutput("A Pomodoro timer is already running.", "error");
      return;
    }
    printToOutput(
      `Pomodoro started: ${workMins} min work, ${breakMins} min break.`,
      "help",
    );
    runPomoSession("work", workMins, breakMins);
  }
  function stopPomo() {
    if (!pomoTimeout) {
      printToOutput("No Pomodoro timer is running.", "error");
      return;
    }
    clearTimeout(pomoTimeout);
    pomoTimeout = null;
    printToOutput("Pomodoro timer stopped.", "help");
  }
  function runPomoSession(type, workMins, breakMins) {
    const isWork = type === "work";
    const mins = isWork ? workMins : breakMins;
    const nextType = isWork ? "break" : "work";

    pomoTimeout = setTimeout(
      () => {
        showAlertModal(
          `${type.charAt(0).toUpperCase() + type.slice(1)} Session Over!`,
          `Time for your ${nextType} session.`,
        );
        runPomoSession(nextType, workMins, breakMins);
      },
      mins * 60 * 1000,
    );
  }

  function startSimpleTimer(minutes = 10, message = "Timer finished!") {
    if (simpleTimerTimeout) {
      printToOutput(
        "A timer is already running. Use 'timer stop' first.",
        "error",
      );
      return;
    }
    if (isNaN(minutes) || minutes <= 0) {
      printToOutput("Please provide a valid number of minutes.", "error");
      return;
    }
    printToOutput(`Timer started for ${minutes} minute(s).`, "help");

    simpleTimerTimeout = setTimeout(
      () => {
        showAlertModal("Timer Complete!", message);
        simpleTimerTimeout = null;
      },
      minutes * 60 * 1000,
    );
  }

  function stopSimpleTimer() {
    if (!simpleTimerTimeout) {
      printToOutput("No timer is running.", "error");
      return;
    }
    clearTimeout(simpleTimerTimeout);
    simpleTimerTimeout = null;
    printToOutput("Timer stopped.", "help");
  }

  function setReminder(timeStr, message) {
    if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) {
      printToOutput("Error: Invalid time format. Use HH:MM.", "error");
      return;
    }
    if (!message || !message.trim()) {
      printToOutput("Error: Please provide a reminder message.", "error");
      return;
    }

    const [hours, minutes] = timeStr.split(":").map(Number);
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);

    let delay = targetTime.getTime() - Date.now();

    if (delay < 0) {
      // If time is in the past, set it for the next day
      targetTime.setDate(targetTime.getDate() + 1);
      delay = targetTime.getTime() - Date.now();
    }

    setTimeout(() => {
      showAlertModal("Reminder", message);
    }, delay);

    printToOutput(
      `Reminder set for ${targetTime.toLocaleTimeString()}.`,
      "help",
    );
  }

  function showNotification(title, body) {
    if (notificationPermission === "granted") {
      new Notification(title, { body });
    }
  }

  // Calculator
  function calculate(expression) {
    if (!expression) return "Error: No expression provided.";
    const safeExpressionRegex = /^[0-9+\-*/%().\s**]+$/;
    if (!safeExpressionRegex.test(expression))
      return "Error: Invalid characters in expression.";
    try {
      return `› ${new Function("return " + expression)()}`;
    } catch (e) {
      return `Error: Invalid mathematical expression.`;
    }
  }

  // --- Help ---
  const helpData = {
    help: {
      description:
        "Shows a list of commands or details for a specific command.",
      usage: `<span class="help">help [command]</span><br>Provides details for a specific command.<br>Example: <code>help note</code>`,
    },
    clear: {
      description: "Clears all output from the terminal screen.",
      usage: `<span class="help">clear</span><br>Clears the terminal. No arguments.`,
    },
    note: {
      description: "Create, edit, and manage text notes.",
      usage: `<span class="note">note (alias: notes)</span><br>
- <code>note</code>: Lists all notes.<br>
- <code>note [text]</code>: Adds a new note.<br>
- <code>note edit [search term]</code>: Edits a note containing the term.<br>
- <code>note del [search term]</code>: Deletes a note containing the term.<br>
- <code>note save/open</code>: Saves or loads notes to/from a file.`,
    },
    todo: {
      description: "Manage your to-do list.",
      usage: `<span class="todo">todo (alias: todos)</span><br>
- <code>todo</code>: Lists all to-do items.<br>
- <code>todo [text]</code>: Adds a new to-do item.<br>
- <code>todo done [number]</code>: Marks an item as done.<br>
- <code>todo save/open</code>: Saves or loads the list to/from a file.`,
    },
    link: {
      description: "Manage saved website links.",
      usage: `<span class="link">link (alias: links)</span><br>
- <code>link</code>: Lists all links.<br>
- <code>link [url] [name]</code>: Adds a new link.<br>
- <code>link go [name]</code>: Opens a saved link in a new tab.<br>
- <code>link edit "[name]" "[new name]"</code>: Renames a link.<br>
- <code>link del [name]</code>: Deletes a link.<br>
- <code>link save/open</code>: Saves or loads links to/from a file.`,
    },
    cal: {
      description: "Display calendars and manage events.",
      usage: `<span class="calendar">cal</span><br>
- <code>cal</code>: Shows the current month's calendar.<br>
- <code>cal [YYMM]</code>: Shows calendar for a specific month (e.g., <code>cal 2512</code>).<br>
- <code>cal view [YYMMDD|all]</code>: Views events for a day or all events.<br>
- <code>cal add YYMMDD "event"</code>: Adds an event to a specific date.<br>
- <code>cal save/open</code>: Saves or loads events to/from a file.`,
    },
    contact: {
      description: "Manage your contact list.",
      usage: `<span class="note">contact (alias: contacts)</span><br>
- <code>contact</code>: Lists all contacts.<br>
- <code>contact add "[name]" "[info]"</code>: Adds a new contact.<br>
- <code>contact find [name]</code>: Searches for a contact.<br>
- <code>contact del [name]</code>: Deletes a contact.<br>
- <code>contact save/open</code>: Saves or loads contacts to/from a file.`,
    },
    pomo: {
      description: "Start or stop a Pomodoro productivity timer.",
      usage: `<span class="help">pomo</span><br>
- <code>pomo start [work_mins] [break_mins]</code>: Starts the timer. Defaults to 25/5.<br>
- <code>pomo stop</code>: Stops the current timer.`,
    },
    timer: {
      description: "Start or stop a simple countdown timer.",
      usage: `<span class="help">timer</span><br>
- <code>timer [minutes] "[message]"</code>: Starts a countdown. Message is optional.<br>
- <code>timer stop</code>: Stops the current countdown.`,
    },
    time: {
      description: "Displays the current local date and time.",
      usage: `<span class="help">time</span><br>Displays the current time. No arguments.`,
    },
    remind: {
      description: "Set a one-time reminder for a specific time.",
      usage: `<span class="help">remind HH:MM "[message]"</span><br>Sets a reminder that will fire at the next instance of the specified time.`,
    },
    calc: {
      description: "Evaluates a mathematical expression.",
      usage: `<span class="todo">calc [expression]</span><br>Example: <code>calc (5 + 3) * 2</code>`,
    },
  };

  const commandAliases = {
    notes: "note",
    todos: "todo",
    links: "link",
    contacts: "contact",
  };

  function printHelp(topic) {
    if (topic) {
      const commandKey = commandAliases[topic] || topic;
      const commandHelp = helpData[commandKey];
      if (commandHelp) {
        printToOutput(
          commandHelp.usage.replace(/<code>/g, '<code class="command-echo">'),
          "response",
        );
      } else {
        printToOutput(`Error: No help found for command '${topic}'.`, "error");
      }
    } else {
      printToOutput(
        '<span class="help">Available Commands:</span>',
        "response",
      );
      let helpText = '<table style="width: 100%; border-collapse: collapse;">';
      for (const cmd in helpData) {
        helpText += `<tr style="border-bottom: 1px solid #333;"><td style="padding: 5px 15px 5px 0; vertical-align: top;"><span class="help">${cmd}</span></td><td style="padding: 5px 0;">${helpData[cmd].description}</td></tr>`;
      }
      helpText += "</table>";
      printToOutput(helpText, "response");
      printToOutput(
        `\nType <code class="command-echo">help [command]</code> for more details.`,
        "note",
      );
    }
  }
});
