const STORAGE_KEY = 'praktisk-dag-kalender';
const today = new Date();
const journalData = loadEntries();
const searchParams = new URLSearchParams(window.location.search);

const currentMonthLabel = document.getElementById('current-month');
const calendarSummary = document.getElementById('calendar-summary');
const calendarGrid = document.getElementById('calendar-grid');
const prevMonthButton = document.getElementById('prev-month');
const nextMonthButton = document.getElementById('next-month');

const backToCalendarLink = document.getElementById('back-to-calendar');
const form = document.getElementById('journal-form');
const selectedDateHeading = document.getElementById('selected-date-heading');
const selectedDateSubtitle = document.getElementById('selected-date-subtitle');
const textInput = document.getElementById('journal-text');
const imageInput = document.getElementById('journal-images');
const chooseImageButton = document.getElementById('choose-image-button');
const imagePreview = document.getElementById('image-preview');
const submitButton = document.getElementById('submit-button');

if (calendarGrid && currentMonthLabel && calendarSummary && prevMonthButton && nextMonthButton) {
    initializeCalendarPage();
}

if (form && selectedDateHeading && selectedDateSubtitle && textInput && imageInput && imagePreview && submitButton) {
    initializeDayPage();
}

function initializeCalendarPage() {
    let selectedDate = isValidDateKey(searchParams.get('selected')) ? searchParams.get('selected') : null;
    let visibleMonth = parseMonthKey(searchParams.get('month'))
        ?? (selectedDate
            ? new Date(getDateParts(selectedDate).year, getDateParts(selectedDate).month - 1, 1)
            : new Date(today.getFullYear(), today.getMonth(), 1));

    prevMonthButton.addEventListener('click', () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
        renderCalendar();
        syncCalendarUrl();
    });

    nextMonthButton.addEventListener('click', () => {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
        renderCalendar();
        syncCalendarUrl();
    });

    calendarGrid.addEventListener('click', (event) => {
        const dayButton = event.target.closest('[data-date]');

        if (!dayButton) {
            return;
        }

        const dayUrl = new URL('./day.html', window.location.href);
        dayUrl.searchParams.set('date', dayButton.dataset.date);
        dayUrl.searchParams.set('month', formatMonthKey(visibleMonth));
        window.location.href = dayUrl.toString();
    });

    renderCalendar();
    syncCalendarUrl();

    function renderCalendar() {
        const year = visibleMonth.getFullYear();
        const month = visibleMonth.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const firstWeekday = (firstDay.getDay() + 6) % 7;
        const totalCells = Math.ceil((firstWeekday + lastDay.getDate()) / 7) * 7;

        currentMonthLabel.textContent = new Intl.DateTimeFormat('da-DK', {
            month: 'long',
            year: 'numeric'
        }).format(firstDay);

        const daysWithContent = countDaysWithContent();
        calendarSummary.textContent = daysWithContent === 0
            ? 'Ingen dage med indhold endnu.'
            : `${daysWithContent} dage har gemt indhold.`;

        calendarGrid.innerHTML = '';

        for (let index = 0; index < totalCells; index += 1) {
            const dayNumber = index - firstWeekday + 1;
            const cellDate = new Date(year, month, dayNumber);
            const dateKey = formatDateKey(cellDate);
            const isCurrentMonth = cellDate.getMonth() === month;
            const isToday = dateKey === formatDateKey(today);
            const hasContent = hasDayContent(dateKey);

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'calendar-day';
            button.dataset.date = dateKey;
            button.setAttribute('role', 'gridcell');

            if (!isCurrentMonth) {
                button.classList.add('muted');
            }

            if (isToday) {
                button.classList.add('today');
            }

            if (dateKey === selectedDate) {
                button.classList.add('selected');
            }

            if (hasContent) {
                button.classList.add('has-entries');
            }

            button.innerHTML = `
                <span class="day-number">${cellDate.getDate()}</span>
                <small>${hasContent ? 'Gemt' : ''}</small>
                ${hasContent ? '<span class="entry-dot">✓</span>' : ''}
            `;

            calendarGrid.appendChild(button);
        }
    }

    function syncCalendarUrl() {
        const url = new URL(window.location.href);
        url.searchParams.set('month', formatMonthKey(visibleMonth));

        if (selectedDate) {
            url.searchParams.set('selected', selectedDate);
        } else {
            url.searchParams.delete('selected');
        }

        window.history.replaceState({}, '', url);
    }
}

function initializeDayPage() {
    const selectedDate = isValidDateKey(searchParams.get('date')) ? searchParams.get('date') : formatDateKey(today);
    const visibleMonth = parseMonthKey(searchParams.get('month'))
        ?? new Date(getDateParts(selectedDate).year, getDateParts(selectedDate).month - 1, 1);

    if (backToCalendarLink) {
        backToCalendarLink.href = `./index.html?month=${formatMonthKey(visibleMonth)}&selected=${selectedDate}`;
    }

    selectedDateHeading.textContent = formatLongDate(selectedDate);
    selectedDateSubtitle.textContent = 'Her kan du tilføje og rette teksten og billederne for denne dag.';

    if (chooseImageButton) {
        chooseImageButton.addEventListener('click', () => {
            imageInput.click();
        });
    }

    const existingDay = normalizeDayRecord(journalData[selectedDate]);
    let currentImages = [...existingDay.images];
    let autosaveTimer = null;

    textInput.value = existingDay.text;
    renderImagePreview(currentImages, true);

    imageInput.addEventListener('change', async () => {
        const newImages = await readFilesAsDataUrls(imageInput.files);

        if (newImages.length === 0) {
            return;
        }

        currentImages = [...currentImages, ...newImages];
        imageInput.value = '';
        renderImagePreview(currentImages, true);
        saveCurrentDay('Gemt automatisk.');
    });

    textInput.addEventListener('input', () => {
        if (autosaveTimer) {
            clearTimeout(autosaveTimer);
        }

        autosaveTimer = window.setTimeout(() => {
            saveCurrentDay();
        }, 500);
    });

    imagePreview.addEventListener('click', (event) => {
        const removeButton = event.target.closest('button[data-remove-image]');

        if (!removeButton) {
            return;
        }

        const imageIndex = Number(removeButton.dataset.removeImage);

        if (Number.isNaN(imageIndex)) {
            return;
        }

        currentImages = currentImages.filter((_, index) => index !== imageIndex);
        renderImagePreview(currentImages, true);
        saveCurrentDay();
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        saveCurrentDay();
    });

    function saveCurrentDay() {
        const text = textInput.value.trim();
        const hasContent = text.length > 0 || currentImages.length > 0;

        if (!hasContent) {
            delete journalData[selectedDate];
            saveEntries();
            return;
        }

        const updatedAt = new Date().toISOString();
        journalData[selectedDate] = {
            text,
            images: [...currentImages],
            updatedAt
        };

        saveEntries();
    }
}

function normalizeDayRecord(value) {
    if (Array.isArray(value) && value.length > 0) {
        const firstEntry = value[0];
        return {
            text: typeof firstEntry?.text === 'string' ? firstEntry.text : '',
            images: Array.isArray(firstEntry?.images) ? firstEntry.images : [],
            updatedAt: firstEntry?.createdAt ?? null
        };
    }

    if (value && typeof value === 'object') {
        return {
            text: typeof value.text === 'string' ? value.text : '',
            images: Array.isArray(value.images) ? value.images : [],
            updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null
        };
    }

    return {
        text: '',
        images: [],
        updatedAt: null
    };
}

function hasDayContent(dateKey) {
    const record = normalizeDayRecord(journalData[dateKey]);
    return record.text.trim().length > 0 || record.images.length > 0;
}

function countDaysWithContent() {
    return Object.keys(journalData).filter((dateKey) => hasDayContent(dateKey)).length;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function getDateParts(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return { year, month, day };
}

function formatMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey ?? '')) {
        return null;
    }

    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month - 1, 1);
}

function isValidDateKey(dateKey) {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateKey ?? '');
}

function createDateFromKey(dateKey) {
    const { year, month, day } = getDateParts(dateKey);
    return new Date(year, month - 1, day);
}

function formatLongDate(dateKey) {
    return new Intl.DateTimeFormat('da-DK', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }).format(createDateFromKey(dateKey));
}

function formatShortTimestamp(isoString) {
    return new Intl.DateTimeFormat('da-DK', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(isoString));
}

function loadEntries() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journalData));
}

async function readFilesAsDataUrls(fileList) {
    const files = Array.from(fileList ?? []);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    return Promise.all(imageFiles.map(readFileAsDataUrl));
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(String(reader.result)));
        reader.addEventListener('error', () => reject(new Error('Kunne ikke læse billedet.')));
        reader.readAsDataURL(file);
    });
}

function renderImagePreview(images, allowRemove = false) {
    imagePreview.innerHTML = '';
    imagePreview.hidden = images.length === 0;

    images.forEach((image, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'preview-item';

        const img = document.createElement('img');
        img.src = image;
        img.alt = `Valgt billede ${index + 1}`;
        img.className = 'preview-image';
        wrapper.appendChild(img);

        if (allowRemove) {
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'remove-image-btn';
            removeBtn.dataset.removeImage = String(index);
            removeBtn.setAttribute('aria-label', `Fjern billede ${index + 1}`);
            removeBtn.textContent = '×';
            wrapper.appendChild(removeBtn);
        }

        imagePreview.appendChild(wrapper);
    });
}
