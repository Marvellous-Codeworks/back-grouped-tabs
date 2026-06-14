/* back-grouped-tabs - Version 1.2 */

chrome.action.onClicked.addListener(async (activeTab) => {
  console.log("[BackGrouped] Click received");

  try {
    const tabs = await chrome.tabs.query({});
    const STUCK_URL = /^(chrome:\/\/newtab|about:blank|about:newtab)/i;

    const grouped = tabs.filter(
      (t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE &&
        (t.discarded || STUCK_URL.test(t.url || t.pendingUrl || ''))
    );

    // Exclude tabs managed by third-party suspender extensions (e.g. The Great Suspender)
    const targetTabs = grouped.filter((t) => {
      const currentUrl = t.url || t.pendingUrl || "";
      return !currentUrl.includes("suspended.html");
    });

    // Early exit: nothing to do, skip badge/focus changes entirely
    if (targetTabs.length === 0) {
      console.log("[BackGrouped] No target tabs found; skipping execution.");
      return;
    }

    await chrome.action.setBadgeText({ text: "..." });
    await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });

    let ok = 0, skipped = 0;
    console.log(`[BackGrouped] Tabs to process: ${targetTabs.length}`);

    // Remember the collapsed state of every involved group
    const groupIds = [...new Set(targetTabs.map((t) => t.groupId))];
    const groupStates = {};
    for (const gid of groupIds) {
      try {
        const group = await chrome.tabGroups.get(gid);
        groupStates[gid] = group.collapsed;
      } catch (err) {
        console.warn(`[BackGrouped] Could not get state for group ${gid}; skipping.`);
      }
    }

    for (const tab of targetTabs) {
      // Skip the tab the user is currently looking at
      if (activeTab && tab.id === activeTab.id) {
        console.log(`[BackGrouped] Skipping active tab ${tab.id}`);
        skipped++;
        continue;
      }

      try {
        // Guard against the tab being closed between query and activation
        const tabVerify = await chrome.tabs.get(tab.id).catch(() => null);
        if (!tabVerify) {
          skipped++;
          continue;
        }

        // Activate the tab to force history to load
        await chrome.tabs.update(tab.id, { active: true });

        // Wait until the tab is fully loaded/ready
        await new Promise((resolve) => {
          let checkInterval;

          const timeoutKill = setTimeout(() => {
            if (checkInterval) clearInterval(checkInterval);
            resolve();
          }, 2000);

          checkInterval = setInterval(async () => {
            try {
              const t = await chrome.tabs.get(tab.id);
              if (!t || t.status === "complete") {
                clearInterval(checkInterval);
                clearTimeout(timeoutKill);
                resolve();
              }
            } catch (e) {
              clearInterval(checkInterval);
              clearTimeout(timeoutKill);
              resolve();
            }
          }, 50);
        });

        await chrome.tabs.goBack(tab.id);
        console.log(`[BackGrouped] Back OK on tab ${tab.id}`);
        ok++;
      } catch (e) {
        console.warn(`[BackGrouped] Failed processing tab ${tab.id}: ${e.message}`);
        skipped++;
      }
    }

    // Restore the previously active tab
    if (activeTab) {
      await chrome.tabs.update(activeTab.id, { active: true }).catch(() => {
        console.warn("[BackGrouped] Original active tab no longer available.");
      });
    }

    // Restore the collapsed state of each group
    for (const gid of groupIds) {
      if (groupStates[gid]) {
        await chrome.tabGroups.update(gid, { collapsed: true }).catch(() => {});
      }
    }

    console.log(`[BackGrouped] Done — ok: ${ok}, skipped: ${skipped}`);

    await chrome.action.setBadgeText({ text: `${ok}` });
    await chrome.action.setBadgeBackgroundColor({ color: ok > 0 ? "#16a34a" : "#dc2626" });

    setTimeout(async () => {
      await chrome.action.setBadgeText({ text: "" });
    }, 3000);

  } catch (e) {
    console.error(`[BackGrouped] General execution failure: ${e.message}`);
  }
});
