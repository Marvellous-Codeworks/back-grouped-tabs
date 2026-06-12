chrome.action.onClicked.addListener(async () => {
  console.log("[BackGrouped] Click ricevuto");

  await chrome.action.setBadgeText({ text: "..." });
  await chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" });

  let ok = 0, skipped = 0;

  try {
    const tabs = await chrome.tabs.query({});
    const grouped = tabs.filter(
      (t) => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE
    );
    console.log(`[BackGrouped] Tab nei gruppi: ${grouped.length}`);

    // Ricorda quale tab era attivo nella finestra corrente
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Ricorda lo stato collapsed di ogni gruppo coinvolto
    const groupIds = [...new Set(grouped.map((t) => t.groupId))];
    const groupStates = {};
    for (const gid of groupIds) {
      const group = await chrome.tabGroups.get(gid);
      groupStates[gid] = group.collapsed;
    }

    for (const tab of grouped) {
      try {
        // Attiva il tab per forzare il caricamento della history
        await chrome.tabs.update(tab.id, { active: true });

        // Aspetta che il tab sia completamente caricato/pronto
        await new Promise((resolve) => {
          const check = setInterval(async () => {
            const t = await chrome.tabs.get(tab.id);
            if (t.status === "complete") {
              clearInterval(check);
              resolve();
            }
          }, 50);
          // Timeout massimo 2 secondi per non bloccarsi
          setTimeout(() => { clearInterval(check); resolve(); }, 2000);
        });

        await chrome.tabs.goBack(tab.id);
        console.log(`[BackGrouped] Back OK su tab ${tab.id} - ${tab.url}`);
        ok++;
      } catch (e) {
        console.warn(`[BackGrouped] Skipped tab ${tab.id} (${tab.url}): ${e.message}`);
        skipped++;
      }
    }

    // Ripristina il tab che era attivo in precedenza
    if (activeTab) {
      await chrome.tabs.update(activeTab.id, { active: true });
    }

    // Ripristina lo stato collapsed dei gruppi
    for (const gid of groupIds) {
      if (groupStates[gid]) {
        await chrome.tabGroups.update(gid, { collapsed: true });
      }
    }

  } catch (e) {
    console.error(`[BackGrouped] Errore generale: ${e.message}`);
  }

  console.log(`[BackGrouped] Done — ok: ${ok}, skipped: ${skipped}`);

  await chrome.action.setBadgeText({ text: `${ok}` });
  await chrome.action.setBadgeBackgroundColor({ color: ok > 0 ? "#16a34a" : "#dc2626" });

  setTimeout(async () => {
    await chrome.action.setBadgeText({ text: "" });
  }, 3000);
});
