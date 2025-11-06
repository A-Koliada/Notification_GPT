// ============================================
// STATISTICS DASHBOARD
// Version: 2.0.0
// ============================================

// State
const state = {
    notifications: [],
    timeRange: 7, // days
    stats: {}
  };
  
  // DOM Elements
  const elements = {
    backBtn: document.getElementById('backBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    rangeBtns: document.querySelectorAll('.range-btn'),
    
    // Stats
    statTotal: document.getElementById('statTotal'),
    statUnread: document.getElementById('statUnread'),
    statResponseTime: document.getElementById('statResponseTime'),
    statReadRate: document.getElementById('statReadRate'),
    
    statTotalChange: document.getElementById('statTotalChange'),
    statUnreadChange: document.getElementById('statUnreadChange'),
    statResponseChange: document.getElementById('statResponseChange'),
    statRateChange: document.getElementById('statRateChange'),
    
    // Charts
    timelineChart: document.getElementById('timelineChart'),
    typesChart: document.getElementById('typesChart'),
    responseBars: document.getElementById('responseBars'),
    hoursChart: document.getElementById('hoursChart'),
    
    // Insights
    insightsGrid: document.getElementById('insightsGrid'),
    
    // Export
    exportPdfBtn: document.getElementById('exportPdfBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    
    toastContainer: document.getElementById('toastContainer')
  };
  
  // ============================================
  // INITIALIZATION
  // ============================================
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Statistics] 🚀 Initializing...');
    
    initializeEventListeners();
    await loadData();
    
    console.log('[Statistics] ✅ Initialized');
  });
  
  function initializeEventListeners() {
    elements.backBtn.addEventListener('click', () => {
      window.close();
    });
    
    elements.refreshBtn.addEventListener('click', refresh);
    
    elements.rangeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        elements.rangeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.timeRange = btn.dataset.range === 'all' ? 365 : parseInt(btn.dataset.range);
        calculateStatistics();
        renderCharts();
      });
    });
    
    elements.exportPdfBtn.addEventListener('click', exportPdf);
    elements.exportCsvBtn.addEventListener('click', exportCsv);
  }
  
  // ============================================
  // DATA LOADING
  // ============================================
  async function loadData() {
    try {
      const response = await sendMessage({ action: 'getNotifications' });
      
      if (response.success) {
        state.notifications = response.notifications || [];
        calculateStatistics();
        renderCharts();
        renderInsights();
      } else {
        throw new Error(response.error || 'Failed to load data');
      }
    } catch (error) {
      console.error('[Statistics] ❌ Load error:', error);
      showToast('error', 'Error', 'Failed to load statistics');
    }
  }
  
  async function refresh() {
    elements.refreshBtn.classList.add('spinning');
    
    try {
      await sendMessage({ action: 'syncNow' });
      await loadData();
      showToast('success', 'Refreshed', 'Statistics updated');
    } catch (error) {
      showToast('error', 'Refresh Failed', error.message);
    } finally {
      elements.refreshBtn.classList.remove('spinning');
    }
  }
  
  // ============================================
  // STATISTICS CALCULATION
  // ============================================
  function calculateStatistics() {
    const now = new Date();
    const rangeMs = state.timeRange * 24 * 60 * 60 * 1000;
    const rangeStart = new Date(now - rangeMs);
    
    // Filter notifications by time range
    const filtered = state.notifications.filter(n => {
      const date = new Date(n.date);
      return date >= rangeStart;
    });
    
    // Total
    const total = filtered.length;
    
    // Unread
    const unread = filtered.filter(n => !n.isRead).length;
    
    // Read Rate
    const read = total - unread;
    const readRate = total > 0 ? Math.round((read / total) * 100) : 0;
    
    // Average Response Time (hours)
    let totalResponseTime = 0;
    let responseCount = 0;
    
    filtered.forEach(n => {
      if (n.isRead && n.dataRead) {
        const created = new Date(n.date);
        const readDate = new Date(n.dataRead);
        const diff = readDate - created;
        if (diff > 0) {
          totalResponseTime += diff;
          responseCount++;
        }
      }
    });
    
    const avgResponseMs = responseCount > 0 ? totalResponseTime / responseCount : 0;
    const avgResponseHours = Math.round(avgResponseMs / (1000 * 60 * 60));
    
    // Update UI
    elements.statTotal.textContent = total;
    elements.statUnread.textContent = unread;
    elements.statResponseTime.textContent = avgResponseHours + 'h';
    elements.statReadRate.textContent = readRate + '%';
    
    // Calculate changes (compared to previous period)
    const prevPeriodStart = new Date(rangeStart - rangeMs);
    const prevFiltered = state.notifications.filter(n => {
      const date = new Date(n.date);
      return date >= prevPeriodStart && date < rangeStart;
    });
    
    const prevTotal = prevFiltered.length;
    const totalChange = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
    
    updateChangeIndicator(elements.statTotalChange, totalChange);
    
    // Store for later use
    state.stats = {
      total,
      unread,
      read,
      readRate,
      avgResponseHours,
      filtered
    };
  }
  
  function updateChangeIndicator(element, change) {
    element.textContent = (change > 0 ? '+' : '') + change + '%';
    element.className = 'stat-change';
    if (change > 0) element.classList.add('positive');
    if (change < 0) element.classList.add('negative');
  }
  
  // ============================================
  // CHARTS RENDERING
  // ============================================
  function renderCharts() {
    renderTimelineChart();
    renderTypesChart();
    renderResponseBars();
    renderHoursChart();
  }
  
  function renderTimelineChart() {
    const canvas = elements.timelineChart;
    const ctx = canvas.getContext('2d');
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Prepare data - group by day
    const days = state.timeRange === 365 ? 30 : state.timeRange; // Show last 30 days for "all time"
    const dayData = new Array(days).fill(0).map(() => ({ received: 0, read: 0 }));
    
    const now = new Date();
    state.stats.filtered.forEach(n => {
      const date = new Date(n.date);
      const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      const index = days - 1 - daysDiff;
      
      if (index >= 0 && index < days) {
        dayData[index].received++;
        if (n.isRead) dayData[index].read++;
      }
    });
    
    // Draw chart
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxValue = Math.max(...dayData.map(d => d.received), 1);
    
    // Axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Bars
    const barWidth = chartWidth / days;
    const barGap = 2;
    
    dayData.forEach((data, i) => {
      const x = padding + i * barWidth;
      const receivedHeight = (data.received / maxValue) * chartHeight;
      const readHeight = (data.read / maxValue) * chartHeight;
      
      // Received bar (background)
      ctx.fillStyle = '#1976d2';
      ctx.fillRect(
        x + barGap,
        canvas.height - padding - receivedHeight,
        barWidth - barGap * 2,
        receivedHeight
      );
      
      // Read bar (overlay)
      ctx.fillStyle = '#43a047';
      ctx.fillRect(
        x + barGap,
        canvas.height - padding - readHeight,
        barWidth - barGap * 2,
        readHeight
      );
    });
    
    // Y-axis labels
    ctx.fillStyle = '#718096';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const value = Math.round((maxValue / 5) * i);
      const y = canvas.height - padding - (chartHeight / 5) * i;
      ctx.fillText(value, padding - 10, y + 4);
    }
  }
  
  function renderTypesChart() {
    const canvas = elements.typesChart;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Count by type
    const typeCounts = {};
    state.stats.filtered.forEach(n => {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    });
    
    // Convert to array and sort
    const types = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5
    
    if (types.length === 0) {
      ctx.fillStyle = '#718096';
      ctx.font = '14px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
      return;
    }
    
    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    
    const total = types.reduce((sum, [, count]) => sum + count, 0);
    const colors = ['#1976d2', '#43a047', '#fb8c00', '#e53935', '#039be5'];
    
    let currentAngle = -Math.PI / 2;
    
    types.forEach(([type, count], i) => {
      const sliceAngle = (count / total) * 2 * Math.PI;
      
      // Draw slice
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fill();
      
      // Draw label
      const labelAngle = currentAngle + sliceAngle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius + 25);
      const labelY = centerY + Math.sin(labelAngle) * (radius + 25);
      
      ctx.fillStyle = '#1a202c';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(type, labelX, labelY);
      ctx.fillText(count, labelX, labelY + 14);
      
      currentAngle += sliceAngle;
    });
  }
  
  function renderResponseBars() {
    // Calculate response times by type
    const responseByType = {};
    
    state.stats.filtered.forEach(n => {
      if (n.isRead && n.dataRead) {
        const created = new Date(n.date);
        const readDate = new Date(n.dataRead);
        const hours = (readDate - created) / (1000 * 60 * 60);
        
        if (hours > 0) {
          if (!responseByType[n.type]) {
            responseByType[n.type] = { total: 0, count: 0 };
          }
          responseByType[n.type].total += hours;
          responseByType[n.type].count++;
        }
      }
    });
    
    // Convert to array and calculate averages
    const bars = Object.entries(responseByType)
      .map(([type, data]) => ({
        type,
        avg: data.total / data.count
      }))
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5);
    
    const maxAvg = Math.max(...bars.map(b => b.avg), 1);
    
    // Render
    elements.responseBars.innerHTML = bars.map(bar => {
      const percentage = (bar.avg / maxAvg) * 100;
      const hours = Math.round(bar.avg * 10) / 10;
      
      return `
        <div class="response-bar">
          <div class="response-label">${bar.type}</div>
          <div class="response-progress">
            <div class="response-fill" style="width: ${percentage}%">
              ${hours}h
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  function renderHoursChart() {
    const canvas = elements.hoursChart;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Count by hour of day
    const hourCounts = new Array(24).fill(0);
    
    state.stats.filtered.forEach(n => {
      const date = new Date(n.date);
      const hour = date.getHours();
      hourCounts[hour]++;
    });
    
    // Draw chart
    const padding = 40;
    const chartWidth = canvas.width - padding * 2;
    const chartHeight = canvas.height - padding * 2;
    const maxCount = Math.max(...hourCounts, 1);
    
    // Axes
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Bars
    const barWidth = chartWidth / 24;
    
    hourCounts.forEach((count, hour) => {
      const x = padding + hour * barWidth;
      const height = (count / maxCount) * chartHeight;
      
      ctx.fillStyle = '#1976d2';
      ctx.fillRect(
        x + 2,
        canvas.height - padding - height,
        barWidth - 4,
        height
      );
    });
    
    // X-axis labels (every 3 hours)
    ctx.fillStyle = '#718096';
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let h = 0; h < 24; h += 3) {
      const x = padding + h * barWidth + barWidth / 2;
      ctx.fillText(h + 'h', x, canvas.height - padding + 20);
    }
  }
  
  // ============================================
  // INSIGHTS GENERATION
  // ============================================
  function renderInsights() {
    const insights = generateInsights();
    
    elements.insightsGrid.innerHTML = insights.map((insight, i) => `
      <div class="insight-card ${insight.type}" style="animation-delay: ${800 + i * 100}ms">
        <div class="insight-title">${insight.title}</div>
        <div class="insight-description">${insight.description}</div>
      </div>
    `).join('');
  }
  
  function generateInsights() {
    const insights = [];
    const { filtered, readRate, avgResponseHours } = state.stats;
    
    // Read rate insight
    if (readRate >= 90) {
      insights.push({
        type: 'success',
        title: '🎯 Excellent Response Rate',
        description: `You're reading ${readRate}% of notifications. Keep up the great work!`
      });
    } else if (readRate < 50) {
      insights.push({
        type: 'warning',
        title: '⚠️ Low Response Rate',
        description: `Only ${readRate}% of notifications are being read. Consider prioritizing important ones.`
      });
    }
    
    // Response time insight
    if (avgResponseHours < 2) {
      insights.push({
        type: 'success',
        title: '⚡ Fast Response Time',
        description: `Average response time is ${avgResponseHours}h. You're very responsive!`
      });
    } else if (avgResponseHours > 24) {
      insights.push({
        type: 'info',
        title: '🕐 Slow Response Time',
        description: `Average response time is ${avgResponseHours}h. Enable push notifications for faster responses.`
      });
    }
    
    // Volume insight
    const avgPerDay = Math.round(filtered.length / state.timeRange);
    if (avgPerDay > 10) {
      insights.push({
        type: 'info',
        title: '📊 High Volume',
        description: `You receive ~${avgPerDay} notifications per day. Consider filtering less important types.`
      });
    }
    
    // Peak time insight
    const hourCounts = new Array(24).fill(0);
    filtered.forEach(n => {
      const hour = new Date(n.date).getHours();
      hourCounts[hour]++;
    });
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
    
    insights.push({
      type: 'info',
      title: '🕐 Peak Activity',
      description: `Most notifications arrive at ${peakHour}:00. Plan your work accordingly.`
    });
    
    return insights;
  }
  
  // ============================================
  // EXPORT FUNCTIONS
  // ============================================
  function exportCsv() {
    const csv = ['Date,Type,Title,Status,Response Time (hours)'];
    
    state.stats.filtered.forEach(n => {
      const date = new Date(n.date).toISOString();
      const type = n.type;
      const title = n.title.replace(/,/g, ';');
      const status = n.isRead ? 'Read' : 'Unread';
      
      let responseTime = '';
      if (n.isRead && n.dataRead) {
        const diff = new Date(n.dataRead) - new Date(n.date);
        responseTime = Math.round(diff / (1000 * 60 * 60));
      }
      
      csv.push(`${date},${type},"${title}",${status},${responseTime}`);
    });
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creatio-stats-${Date.now()}.csv`;
    a.click();
    
    showToast('success', 'Exported', 'CSV file downloaded');
  }
  
  function exportPdf() {
    // Simple HTML export (browser's print to PDF)
    window.print();
    showToast('info', 'Print Dialog', 'Use Print to PDF to save');
  }
  
  // ============================================
  // HELPERS
  // ============================================
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response || {});
        }
      });
    });
  }
  
  function showToast(type, title, message = '') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = `${title}: ${message}`;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
  
  console.log('[Statistics] ✅ Script loaded');