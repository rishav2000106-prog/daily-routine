export function initCharts(routines) {
  const weeklyCtx = document.getElementById('weeklyChart').getContext('2d');
  const categoryCtx = document.getElementById('categoryChart').getContext('2d');
  const trendCtx = document.getElementById('trendChart').getContext('2d');

  // Helper to get last 7 days
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const last7Days = Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return days[d.getDay()];
  });

  new Chart(weeklyCtx, {
    type: 'bar',
    data: {
      labels: last7Days,
      datasets: [{
        label: 'Completion %',
        data: [65, 80, 45, 90, 75, 85, 0], // Mock data, replace with real analytics
        backgroundColor: '#7c5cfc',
        borderRadius: 10,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });

  const categories = routines.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {});

  new Chart(categoryCtx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#7c5cfc', '#00d2ff', '#ff0080', '#fbbf24'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '70%',
      plugins: { legend: { position: 'bottom' } }
    }
  });

  new Chart(trendCtx, {
    type: 'line',
    data: {
      labels: Array.from({length: 30}, (_, i) => i + 1),
      datasets: [{
        label: 'Daily Progress',
        data: Array.from({length: 30}, () => Math.floor(Math.random() * 100)),
        borderColor: '#7c5cfc',
        tension: 0.4,
        fill: true,
        backgroundColor: 'rgba(124, 92, 252, 0.1)'
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { display: false } }
    }
  });
}
