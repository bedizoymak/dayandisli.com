const appShell = document.getElementById('appShell');
const sidebarCollapse = document.getElementById('sidebarCollapse');
const menuButton = document.getElementById('menuButton');
const quickActionButton = document.getElementById('quickActionButton');
const quickPopover = document.getElementById('quickPopover');
const globalSearch = document.getElementById('globalSearch');
const searchResults = document.getElementById('searchResults');
const calendarButton = document.getElementById('calendarButton');
const calendarModal = document.getElementById('calendarModal');
const closeCalendar = document.getElementById('closeCalendar');
const calendarGrid = document.getElementById('calendarGrid');
const todayText = document.getElementById('todayText');
const welcomeCard = document.getElementById('welcomeCard');
const logoButton = document.getElementById('logoButton');

const features = [
  'Fatura Oluştur', 'Fatura Listesi', 'Tahsilatlar', 'Ödemeler',
  'Müşteri Kartı', 'Müşteriler', 'Teklif Oluştur', 'Teklif Listesi',
  'Gelir/Gider Raporu', 'Üretim İş Emirleri', 'Kalite Kontrol',
  'Bakım Planları', 'Web Sitesi İçerikleri', 'Ayarlar'
];

const events = {
  3: 'Tahsilat',
  7: 'Ödeme',
  12: 'Tahsilat',
  17: 'Tahsilat',
  18: 'Ödeme',
  21: 'Tahsilat',
  25: 'Personel Ödemesi'
};

function toggleSidebar() {
  appShell.classList.toggle('collapsed');
}

function toggleQuickPopover() {
  quickPopover.classList.toggle('show');
}

function closeQuickPopover() {
  quickPopover.classList.remove('show');
}

function populateSearch(query) {
  const value = query.trim().toLocaleLowerCase('tr-TR');
  if (!value) {
    searchResults.classList.remove('show');
    searchResults.innerHTML = '';
    return;
  }
  const matches = features
    .filter(item => item.toLocaleLowerCase('tr-TR').includes(value))
    .slice(0, 8);

  searchResults.innerHTML = matches
    .map(item => `<button type="button">${item}</button>`)
    .join('');

  searchResults.classList.toggle('show', matches.length > 0);
}

function openCalendar() {
  calendarModal.classList.add('show');
}

function closeCalendarModal() {
  calendarModal.classList.remove('show');
}

function buildCalendar() {
  calendarGrid.innerHTML = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return `
      <div class="calendar-day">
        <b>${day}</b>
        ${events[day] ? `<small>${events[day]}</small>` : ''}
      </div>
    `;
  }).join('');
}

function setTodayText() {
  const formatter = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long'
  });
  todayText.textContent = formatter.format(new Date());
}

function setHeroBackground() {
  const hour = new Date().getHours();
  if (hour >= 19 || hour < 6) {
    welcomeCard.classList.add('night');
  } else {
    welcomeCard.classList.remove('night');
  }
}

sidebarCollapse.addEventListener('click', toggleSidebar);
menuButton.addEventListener('click', toggleSidebar);
quickActionButton.addEventListener('click', toggleQuickPopover);
globalSearch.addEventListener('input', (event) => populateSearch(event.target.value));
calendarButton.addEventListener('click', openCalendar);
closeCalendar.addEventListener('click', closeCalendarModal);
logoButton.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

document.addEventListener('click', (event) => {
  if (!event.target.closest('.quick-menu-wrap')) closeQuickPopover();
  if (!event.target.closest('.global-search')) {
    searchResults.classList.remove('show');
  }
  if (event.target === calendarModal) closeCalendarModal();
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    globalSearch.focus();
  }
  if (event.key === 'Escape') {
    closeCalendarModal();
    closeQuickPopover();
    searchResults.classList.remove('show');
  }
});

buildCalendar();
setTodayText();
setHeroBackground();
