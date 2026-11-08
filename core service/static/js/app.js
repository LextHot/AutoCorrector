document.addEventListener("DOMContentLoaded", () => {
    const inputText = document.getElementById("input-text");
    const charCounter = document.getElementById("char-counter");
    const submitBtn = document.getElementById("submit-btn");
    const clearBtn = document.getElementById("clear-btn");

    const loader = document.getElementById("loader");
    const liveTimer = document.getElementById("live-timer");
    const runtimeBadge = document.getElementById("runtime-badge");
    const runtimeVal = document.getElementById("runtime-val");

    const idleSplash = document.getElementById("idle-splash");
    const resultData = document.getElementById("result-data");
    const correctedOutput = document.getElementById("corrected-output");
    const explanationOutput = document.getElementById("explanation-output");
    const copyBtn = document.getElementById("copy-btn");
    const copyBtnText = document.getElementById("copy-btn-text");

    const historyList = document.getElementById("history-list");
    const refreshHistoryBtn = document.getElementById("refresh-history-btn");

    let timerInterval = null;
    let copyTimeout = null;

    // Сброс кнопки копирования
    function resetCopyButton() {
        if (copyTimeout) clearTimeout(copyTimeout);
        copyBtnText.textContent = "Скопировать";
        copyBtn.disabled = false;
    }

    // Отображение данных в рабочей области
    function renderResult(corrected, explanation, duration = null) {
        resetCopyButton();
        idleSplash.classList.add("hidden");
        resultData.classList.remove("hidden");

        correctedOutput.textContent = corrected || "";
        explanationOutput.textContent = explanation || "";

        if (duration !== null) {
            runtimeVal.textContent = `${duration.toFixed(1)}s`;
            runtimeBadge.classList.remove("hidden");
        }
    }

    // Секундомер
    function startStopwatch() {
        const start = performance.now();
        liveTimer.textContent = "0.0s";
        timerInterval = setInterval(() => {
            const elapsed = (performance.now() - start) / 1000;
            liveTimer.textContent = `${elapsed.toFixed(1)}s`;
        }, 80);
        return start;
    }

    function stopStopwatch(start) {
        clearInterval(timerInterval);
        return (performance.now() - start) / 1000;
    }

    // Обработка запуска синтеза
    async function executeCorrection() {
        const text = inputText.value.trim();
        if (!text) return;

        loader.classList.remove("hidden");
        submitBtn.disabled = true;
        const start = startStopwatch();

        try {
            const res = await fetch("/api/corrections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Gateway Error");
            }

            const totalDuration = stopStopwatch(start);
            const data = await res.json();

            renderResult(data.corrected_text, data.explanation, totalDuration);
            fetchHistory();
        } catch (err) {
            clearInterval(timerInterval);
            alert(`Ошибка анализа: ${err.message}`);
        } finally {
            loader.classList.add("hidden");
            submitBtn.disabled = false;
        }
    }

    // Слушатели событий
    submitBtn.addEventListener("click", executeCorrection);

    // Поддержка хоткея Ctrl + Enter / Cmd + Enter
    inputText.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            executeCorrection();
        }
    });

    clearBtn.addEventListener("click", () => {
        inputText.value = "";
        charCounter.textContent = "0 / 1000";
        inputText.focus();
    });

    inputText.addEventListener("input", () => {
        charCounter.textContent = `${inputText.value.length} / 1000`;
    });

    copyBtn.addEventListener("click", () => {
        const text = correctedOutput.textContent;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            copyBtnText.textContent = "Готово!";
            copyTimeout = setTimeout(() => {
                copyBtnText.textContent = "Скопировать";
            }, 2000);
        });
    });

    // Загрузка ленты истории
    async function fetchHistory() {
        try {
            const res = await fetch("/api/corrections");
            if (!res.ok) return;
            const records = await res.json();

            historyList.innerHTML = "";
            if (!records.length) {
                historyList.innerHTML = `<span style="font-family: var(--font-code); font-size: 0.75rem; color: var(--text-faint); padding: 0.5rem;">Сессий пока нет</span>`;
                return;
            }

            records.forEach(item => {
                const chip = document.createElement("div");
                chip.className = "history-chip";

                const date = new Date(item.created_at);
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                chip.innerHTML = `
                    <div class="chip-preview">${escapeHtml(item.original_text)}</div>
                    <div class="chip-meta">
                        <span>#${item.id}</span>
                        <span>${timeStr}</span>
                    </div>
                    <button class="chip-delete" title="Удалить">×</button>
                `;

                // Загрузка по клику на чип
                chip.addEventListener("click", async (e) => {
                    if (e.target.classList.contains("chip-delete")) return;

                    try {
                        loader.classList.remove("hidden");
                        const fullRes = await fetch(`/api/corrections/${item.id}`);
                        if (!fullRes.ok) throw new Error("Не удалось загрузить");
                        const record = await fullRes.json();

                        inputText.value = record.original_text;
                        charCounter.textContent = `${inputText.value.length} / 5000`;
                        renderResult(record.corrected_text, record.explanation, null);
                        runtimeBadge.classList.add("hidden");
                    } catch (err) {
                        alert(err.message);
                    } finally {
                        loader.classList.add("hidden");
                    }
                });

                // Удаление чипа
                chip.querySelector(".chip-delete").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    await fetch(`/api/corrections/${item.id}`, { method: "DELETE" });
                    fetchHistory();
                });

                historyList.appendChild(chip);
            });
        } catch (e) {
            console.error("Ошибка синхронизации:", e);
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    refreshHistoryBtn.addEventListener("click", fetchHistory);
    fetchHistory();
});