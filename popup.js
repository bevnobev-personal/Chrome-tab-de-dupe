class TabDeDupe {
  constructor() {
    this.duplicateGroups = [];
    this.recentlyClosed = [];
    this.selectedTabs = new Set();
    this.isFirstRun = true;
    
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    
    if (this.isFirstRun) {
      this.showOnboarding();
    } else {
      this.showMainScreen();
      this.scanForDuplicates();
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['isFirstRun', 'recentlyClosed']);
      this.isFirstRun = result.isFirstRun !== false;
      this.recentlyClosed = result.recentlyClosed || [];
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({
        isFirstRun: false,
        recentlyClosed: this.recentlyClosed
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  setupEventListeners() {
    try {
      const startBtn = document.getElementById('start-btn');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          this.isFirstRun = false;
          this.saveSettings();
          this.showMainScreen();
          this.scanForDuplicates();
        });
      }

      const skipBtn = document.getElementById('skip-onboarding');
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          this.isFirstRun = false;
          this.saveSettings();
          this.showMainScreen();
          this.scanForDuplicates();
        });
      }

      const helpBtn = document.getElementById('help-btn');
      if (helpBtn) {
        helpBtn.addEventListener('click', () => {
          this.showOnboarding();
        });
      }

      const scanAgainBtn = document.getElementById('scan-again-btn');
      if (scanAgainBtn) {
        scanAgainBtn.addEventListener('click', () => {
          this.scanForDuplicates();
        });
      }

      const closeSelectedBtn = document.getElementById('close-selected-btn');
      if (closeSelectedBtn) {
        closeSelectedBtn.addEventListener('click', () => {
          this.closeSelectedTabs();
        });
      }

      const cancelBtn = document.getElementById('cancel-btn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          window.close();
        });
      }

      const undoBtn = document.getElementById('undo-btn');
      if (undoBtn) {
        undoBtn.addEventListener('click', () => {
          this.undoLastClosure();
        });
      }

      const doneBtn = document.getElementById('done-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', () => {
          this.showMainScreen();
          this.scanForDuplicates();
        });
      }

      const clearRecentBtn = document.getElementById('clear-recent-btn');
      if (clearRecentBtn) {
        clearRecentBtn.addEventListener('click', () => {
          this.clearRecentlyClosed();
        });
      }
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
  }

  showState(stateId) {
    document.querySelectorAll('.state').forEach(state => {
      state.classList.add('hidden');
    });
    document.getElementById(stateId).classList.remove('hidden');
  }

  showOnboarding() {
    this.showScreen('onboarding');
  }

  showMainScreen() {
    this.showScreen('main');
    this.updateRecentlyClosedSection();
  }

  async scanForDuplicates() {
    this.showState('scanning');
    
    try {
      const tabs = await chrome.tabs.query({});
      
      const domainGroups = {};
      
      tabs.forEach(tab => {
        try {
          const url = new URL(tab.url);
          const domain = url.hostname;
          
          if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
            return;
          }
          
          if (!domainGroups[domain]) {
            domainGroups[domain] = [];
          }
          
          domainGroups[domain].push(tab);
        } catch (error) {
          console.warn('Invalid URL:', tab.url);
        }
      });
      
      this.duplicateGroups = Object.entries(domainGroups)
        .filter(([domain, tabs]) => tabs.length > 1)
        .map(([domain, tabs]) => ({
          domain,
          tabs: tabs.sort((a, b) => b.lastAccessed - a.lastAccessed) // Most recent first
        }));
      
      if (this.duplicateGroups.length === 0) {
        this.showNoDuplicates();
      } else {
        this.showDuplicates();
      }
    } catch (error) {
      console.error('Error scanning for duplicates:', error);
      this.showError('Failed to scan for duplicate tabs');
    }
  }

  showNoDuplicates() {
    this.showState('no-duplicates');
  }

  showDuplicates() {
    this.showState('duplicates-found');
    this.renderDuplicateGroups();
    this.updateDuplicatesSummary();
  }

  updateDuplicatesSummary() {
    const totalDuplicates = this.duplicateGroups.reduce((sum, group) => sum + group.tabs.length, 0);
    const totalGroups = this.duplicateGroups.length;
    
    document.getElementById('duplicates-summary').textContent = 
      `Found ${totalDuplicates} duplicate tabs across ${totalGroups} domain${totalGroups > 1 ? 's' : ''}`;
  }

  renderDuplicateGroups() {
    const container = document.getElementById('duplicate-groups');
    container.innerHTML = '';
    
    this.duplicateGroups.forEach((group, groupIndex) => {
      const groupElement = this.createGroupElement(group, groupIndex);
      container.appendChild(groupElement);
    });
    
    this.updateCloseButton();
  }

  createGroupElement(group, groupIndex) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'duplicate-group';
    
    const header = document.createElement('div');
    header.className = 'group-header';
    
    const domainSpan = document.createElement('span');
    domainSpan.className = 'group-domain';
    domainSpan.textContent = group.domain;
    
    const controls = document.createElement('div');
    controls.className = 'group-controls';
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', () => this.selectAllInGroup(groupIndex));
    
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.addEventListener('click', () => this.deselectAllInGroup(groupIndex));
    
    controls.appendChild(selectAllBtn);
    controls.appendChild(deselectAllBtn);
    
    header.appendChild(domainSpan);
    header.appendChild(controls);
    
    const tabList = document.createElement('div');
    tabList.className = 'tab-list';
    
    group.tabs.forEach((tab, tabIndex) => {
      const tabElement = this.createTabElement(tab, groupIndex, tabIndex);
      tabList.appendChild(tabElement);
    });
    
    groupDiv.appendChild(header);
    groupDiv.appendChild(tabList);
    
    return groupDiv;
  }

  createTabElement(tab, groupIndex, tabIndex) {
    const tabDiv = document.createElement('div');
    tabDiv.className = 'tab-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tab-checkbox';
    checkbox.id = `tab-${groupIndex}-${tabIndex}`;
    
    if (tabIndex > 0) {
      checkbox.checked = true;
      this.selectedTabs.add(tab.id);
    }
    
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        this.selectedTabs.add(tab.id);
      } else {
        this.selectedTabs.delete(tab.id);
      }
      this.updateCloseButton();
    });
    
    const favicon = document.createElement('img');
    favicon.className = 'tab-favicon';
    
    const defaultFavicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    
    if (tab.favIconUrl && this.isValidUrl(tab.favIconUrl)) {
      favicon.src = tab.favIconUrl;
    } else {
      favicon.src = defaultFavicon;
    }
    
    favicon.onerror = () => {
      favicon.src = defaultFavicon;
    };
    
    const tabInfo = document.createElement('div');
    tabInfo.className = 'tab-info';
    
    const title = document.createElement('div');
    title.className = 'tab-title';
    title.textContent = tab.title || 'Untitled';
    title.title = tab.title || 'Untitled';
    
    const url = document.createElement('div');
    url.className = 'tab-url';
    url.textContent = this.formatUrl(tab.url);
    url.title = tab.url;
    
    tabInfo.appendChild(title);
    tabInfo.appendChild(url);
    
    tabDiv.appendChild(checkbox);
    tabDiv.appendChild(favicon);
    tabDiv.appendChild(tabInfo);
    
    return tabDiv;
  }

  formatUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  }

  isValidUrl(url) {
    try {
      new URL(url);
      
      if (url.startsWith('data:image/')) {
        const dataUrlPattern = /^data:image\/[a-zA-Z]+;base64,([A-Za-z0-9+/=]+)$/;
        return dataUrlPattern.test(url);
      }
      
      return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome://');
    } catch {
      return false;
    }
  }

  selectAllInGroup(groupIndex) {
    const group = this.duplicateGroups[groupIndex];
    group.tabs.forEach((tab, tabIndex) => {
      const checkbox = document.getElementById(`tab-${groupIndex}-${tabIndex}`);
      checkbox.checked = true;
      this.selectedTabs.add(tab.id);
    });
    this.updateCloseButton();
  }

  deselectAllInGroup(groupIndex) {
    const group = this.duplicateGroups[groupIndex];
    group.tabs.forEach((tab, tabIndex) => {
      const checkbox = document.getElementById(`tab-${groupIndex}-${tabIndex}`);
      checkbox.checked = false;
      this.selectedTabs.delete(tab.id);
    });
    this.updateCloseButton();
  }

  updateCloseButton() {
    const button = document.getElementById('close-selected-btn');
    const count = this.selectedTabs.size;
    
    if (count === 0) {
      button.disabled = true;
      button.textContent = 'Close Selected Tabs';
    } else {
      button.disabled = false;
      button.textContent = `Close ${count} Selected Tab${count > 1 ? 's' : ''}`;
    }
  }

  async closeSelectedTabs() {
    if (this.selectedTabs.size === 0) return;
    
    const tabsToClose = [];
    
    for (const tabId of this.selectedTabs) {
      try {
        const tab = await chrome.tabs.get(tabId);
        tabsToClose.push({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          windowId: tab.windowId,
          index: tab.index
        });
      } catch (error) {
        console.warn('Tab no longer exists:', tabId);
      }
    }
    
    const closedTabs = [];
    for (const tab of tabsToClose) {
      try {
        await chrome.tabs.remove(tab.id);
        closedTabs.push(tab);
      } catch (error) {
        console.warn('Failed to close tab:', tab.id, error);
      }
    }
    
    this.recentlyClosed.unshift(...closedTabs);
    
    this.recentlyClosed = this.recentlyClosed.slice(0, 20);
    
    await this.saveSettings();
    
    this.lastClosedTabs = closedTabs;
    
    this.showSuccess(closedTabs.length);
  }

  showSuccess(count) {
    this.showState('success');
    document.getElementById('success-message').textContent = 
      `Successfully closed ${count} duplicate tab${count > 1 ? 's' : ''}!`;
  }

  async undoLastClosure() {
    if (!this.lastClosedTabs || this.lastClosedTabs.length === 0) return;
    
    const restoredTabs = [];
    
    for (const tab of this.lastClosedTabs) {
      try {
        const newTab = await chrome.tabs.create({
          url: tab.url,
          windowId: tab.windowId,
          index: tab.index
        });
        restoredTabs.push(newTab);
        
        this.recentlyClosed = this.recentlyClosed.filter(recent => recent.id !== tab.id);
      } catch (error) {
        console.warn('Failed to restore tab:', tab.url, error);
      }
    }
    
    await this.saveSettings();
    this.lastClosedTabs = [];
    
    this.showMainScreen();
    this.scanForDuplicates();
  }

  updateRecentlyClosedSection() {
    const section = document.getElementById('recently-closed-section');
    const list = document.getElementById('recently-closed-list');
    
    if (this.recentlyClosed.length === 0) {
      section.classList.add('hidden');
      return;
    }
    
    section.classList.remove('hidden');
    list.innerHTML = '';
    
    this.recentlyClosed.forEach((tab, index) => {
      const item = this.createRecentTabElement(tab, index);
      list.appendChild(item);
    });
  }

  createRecentTabElement(tab, index) {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'recent-tab-item';
    
    const favicon = document.createElement('img');
    favicon.className = 'recent-tab-favicon';
    
    const defaultFavicon = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
    
    if (tab.favIconUrl && this.isValidUrl(tab.favIconUrl)) {
      favicon.src = tab.favIconUrl;
    } else {
      favicon.src = defaultFavicon;
    }
    
    favicon.onerror = () => {
      favicon.src = defaultFavicon;
    };
    
    const tabInfo = document.createElement('div');
    tabInfo.className = 'recent-tab-info';
    
    const title = document.createElement('div');
    title.className = 'recent-tab-title';
    title.textContent = tab.title || 'Untitled';
    title.title = tab.title || 'Untitled';
    
    const url = document.createElement('div');
    url.className = 'recent-tab-url';
    url.textContent = this.formatUrl(tab.url);
    url.title = tab.url;
    
    tabInfo.appendChild(title);
    tabInfo.appendChild(url);
    
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'restore-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.addEventListener('click', () => this.restoreTab(index));
    
    itemDiv.appendChild(favicon);
    itemDiv.appendChild(tabInfo);
    itemDiv.appendChild(restoreBtn);
    
    return itemDiv;
  }

  async restoreTab(index) {
    const tab = this.recentlyClosed[index];
    if (!tab) return;
    
    try {
      await chrome.tabs.create({
        url: tab.url,
        windowId: tab.windowId
      });
      
      this.recentlyClosed.splice(index, 1);
      await this.saveSettings();
      
      this.updateRecentlyClosedSection();
    } catch (error) {
      console.error('Failed to restore tab:', error);
      this.showError('Failed to restore tab');
    }
  }

  async clearRecentlyClosed() {
    this.recentlyClosed = [];
    await this.saveSettings();
    this.updateRecentlyClosedSection();
  }

  showError(message) {
    alert(message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new TabDeDupe();
});
