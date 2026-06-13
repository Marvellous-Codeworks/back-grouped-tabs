chrome.action.onClicked.addListener(async (activeTab) => {
  console.log("[BackGrouped] Click received");

  await chrome.action.setBadgeText({ text: "..." });
  await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });

  let ok = 0, skipped = 0;

  try {
    const tabs = await chrome.tabs.query({});
    const STUCK_URL = /^(chrome:\/\/newtab|about:blank|about:newtab)/i;
    const grouped = tabs.filter(
      (t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        (t.discarded || STUCK_URL.test(t.url || t.pendingUrl || ''))
    );
    console.log(`[BackGrouped] Tabs in groups: ${grouped.length}`);

    // Remember the collapsed state of every involved group
    const groupIds = [...new Set(grouped.map((t) => t.groupId))];
    const groupStates = {};
    for (const gid of groupIds) {
      const group = await chrome.tabGroups.get(gid);
      groupStates[gid] = group.collapsed;
    }

    for (const tab of grouped) {
      // Skip the tab the user is currently looking at
      if (activeTab && tab.id === activeTab.id) {
        console.log(`[BackGrouped] Skipping active tab ${tab.id} - ${tab.url}`);
        skipped++;
        continue;
      }

      try {
        // Activate the tab to force history to load
        await chrome.tabs.update(tab.id, { active: true });

        // Wait until the tab is fully loaded/ready
        await new Promise((resolve) => {
          const check = setInterval(async () => {
            const t = await chrome.tabs.get(tab.id);
            if (t.status === "complete") {
              clearInterval(check);
              resolve();
            }
          }, 50);
          // 2-second max timeout to avoid getting stuck
          setTimeout(() => { clearInterval(check); resolve(); }, 2000);
        });

        await chrome.tabs.goBack(tab.id);
        console.log(`[BackGrouped] Back OK on tab ${tab.id} - ${tab.url}`);
        ok++;
      } catch (e) {
        console.warn(`[BackGrouped] Skipped tab ${tab.id} (${tab.url}): ${e.message}`);
        skipped++;
      }
    }

    // Restore the previously active tab
    if (activeTab) {
      await chrome.tabs.update(activeTab.id, { active: true });
    }

    // Restore the collapsed state of each group
    for (const gid of groupIds) {
      if (groupStates[gid]) {
        await chrome.tabGroups.update(gid, { collapsed: true });
      }
    }

  } catch (e) {
    console.error(`[BackGrouped] General error: ${e.message}`);
  }

  console.log(`[BackGrouped] Done — ok: ${ok}, skipped: ${skipped}`);

  await chrome.action.setBadgeText({ text: `${ok}` });
  await chrome.action.setBadgeBackgroundColor({ color: ok > 0 ? "#16a34a" : "#dc2626" });

  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: "" });
  }, 3000);
});
