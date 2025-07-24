
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ isFirstRun: true });
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ recentlyClosed: [] });
});

chrome.action.onClicked.addListener((tab) => {
  chrome.action.openPopup();
});
