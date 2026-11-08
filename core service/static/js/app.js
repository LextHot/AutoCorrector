document.addEventListener("DOMContentLoaded", () => {
    const inputText = document.getElementById("input-text");
    const charCounter = document.getElementById("char-counter");
    const submitBtn = document.getElementById("submit-btn");
    const clearBtn = document.getElementById("clear-btn");

    // Элементы статуса LLM
    const statusDot = document.getElementById("status-dot");
    const statusLabel = document.getElementById("status-label");

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

    // Управление статусом LLM
    function setLlmStatus(isBusy) {
        // Выполнение процесса анализа
        if (isBusy) {
            statusDot.classList.remove("hidden");
            statusLabel.textContent = "LLM: Processing... (макс. время ожидания: 150с)";
            statusLabel.style.color = "var(--mint-bright)";
        }
        // Ожидание начала работы
        else {
            statusDot.classList.add("hidden");
            statusLabel.textContent = "LLM: —";
            statusLabel.style.color = "var(--text-secondary)";
        }
    }

    // Сброс кнопки копирования
    function resetCopyButton() {
        if (copyTimeout) clearTimeout(copyTimeout);
        copyBtnText.textContent = "Скопировать";
        copyBtn.disabled = true;
    }

    // Возврат буфера результатов в исходное пустое состояние
    function resetResultView() {
        resetCopyButton();
        idleSplash.classList.remove("hidden");
        resultData.classList.add("hidden");
        correctedOutput.textContent = "";
        explanationOutput.textContent = "";
        runtimeBadge.classList.add("hidden");
    }

    // Отображение данных в области результата
    function renderResult(corrected, explanation, duration = null) {
        if (copyTimeout) clearTimeout(copyTimeout);
        copyBtnText.textContent = "Скопировать";
        copyBtn.disabled = false;

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

    // Обрезка текста до первых N слов для компактного отображения в карточке
    function truncateWords(str, wordLimit = 4) {
        if (!str) return "";
        const cleanStr = str.replace(/\s+/g, " ").trim();
        const words = cleanStr.split(" ");
        if (words.length <= wordLimit) {
            return cleanStr;
        }
        return words.slice(0, wordLimit).join(" ") + "...";
    }

    // Отправка текста на проверку
    async function executeCorrection() {
        const text = inputText.value.trim();
        if (!text) return;

        loader.classList.remove("hidden");
        submitBtn.disabled = true;
        setLlmStatus(true);
        const start = startStopwatch();

        try {
            const res = await fetch("/api/corrections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: text })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Ошибка обращения к сервису");
            }

            const totalDuration = stopStopwatch(start);
            const data = await res.json();

            renderResult(data.corrected_text, data.explanation, totalDuration);
            fetchHistory();
        } catch (err) {
            clearInterval(timerInterval);
            alert(`Ошибка: ${err.message}`);
        } finally {
            loader.classList.add("hidden");
            submitBtn.disabled = false;
            setLlmStatus(false);
        }
    }

    // Слушатели событий
    submitBtn.addEventListener("click", executeCorrection);

    inputText.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            executeCorrection();
        }
    });

    // Очистка по кнопке-крестику
    clearBtn.addEventListener("click", () => {
        inputText.value = "";
        charCounter.textContent = "0 / 1000";
        resetResultView();
        inputText.focus();
    });

    // Изменение текста, обновление счетчика и окна результатов
    inputText.addEventListener("input", () => {
        charCounter.textContent = `${inputText.value.length} / 1000`;
        if (!resultData.classList.contains("hidden")) {
            resetResultView();
        }
    });

    copyBtn.addEventListener("click", () => {
        const text = correctedOutput.textContent;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            copyBtnText.textContent = "Скопировано!";
            copyTimeout = setTimeout(() => {
                copyBtnText.textContent = "Скопировать";
            }, 2000);
        });
    });

    // Получение истории
    async function fetchHistory() {
        try {
            const res = await fetch("/api/corrections");
            if (!res.ok) return;
            const records = await res.json();

            historyList.innerHTML = "";
            if (!records.length) {
                historyList.innerHTML = `<span style="font-family: var(--font-code); font-size: 0.75rem; color: var(--text-faint); padding: 0.5rem;">История запросов пуста</span>`;
                return;
            }

            records.forEach(item => {
                const chip = document.createElement("div");
                chip.className = "history-chip";

                const date = new Date(item.created_at);
                // Форматирование времени и даты
                const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
                const shortPreview = truncateWords(item.original_text, 4);

                chip.innerHTML = `
                    <div class="chip-preview" title="${escapeHtml(item.original_text)}">${escapeHtml(shortPreview)}</div>
                    <div class="chip-meta">
                        <span class="chip-date">${dateStr}</span>
                        <span class="chip-time">${timeStr}</span>
                    </div>
                    <button class="chip-delete" title="Удалить">×</button>
                `;

                // Детальное отображение элемента истории
                chip.addEventListener("click", async (e) => {
                    if (e.target.classList.contains("chip-delete")) return;

                    try {
                        loader.classList.remove("hidden");
                        const fullRes = await fetch(`/api/corrections/${item.id}`);
                        if (!fullRes.ok) throw new Error("Не удалось загрузить");
                        const record = await fullRes.json();

                        inputText.value = record.original_text;
                        charCounter.textContent = `${inputText.value.length} / 1000`;
                        renderResult(record.corrected_text, record.explanation, null);
                        runtimeBadge.classList.add("hidden");
                    } catch (err) {
                        alert(err.message);
                    } finally {
                        loader.classList.add("hidden");
                    }
                });

                // Удаление карточки
                chip.querySelector(".chip-delete").addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (confirm("Удалить эту запись?")) {
                        await fetch(`/api/corrections/${item.id}`, { method: "DELETE" });
                        fetchHistory();
                    }
                });

                historyList.appendChild(chip);
            });
        } catch (e) {
            console.error("Ошибка обновления истории:", e);
        }
    }

    function escapeHtml(str) {
        return str.replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    refreshHistoryBtn.addEventListener("click", fetchHistory);

    // Начальное состояние
    setLlmStatus(false);
    resetResultView();
    fetchHistory();
});