const repo = "ZacBytes/clayfold";
const commandField = document.querySelector("[data-npm-install]");
const copyButton = document.querySelector('[data-copy-field="npm-command"]');

async function updateInstallCommand() {
  if (copyButton) copyButton.disabled = true;
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return;

    const release = await response.json();
    const archive = release.assets.find(asset =>
      asset.state === "uploaded" && /^clayfold-icons-\d[\w.+-]*\.tgz$/.test(asset.name));
    if (!archive) return;

    // The download URL becomes part of a shell command, so accept only safe path characters.
    const { origin, pathname, search, hash } = new URL(archive.browser_download_url);
    if (origin !== "https://github.com" || !pathname.startsWith(`/${repo}/releases/download/`) ||
        !/^[\w%+./-]+$/.test(pathname) || search || hash) return;

    const command = `npm install ${origin}${pathname}`;
    if (commandField instanceof HTMLTextAreaElement) commandField.value = command;
    else commandField.textContent = command;
  } catch {
    // The pinned archive in the HTML remains usable if GitHub is unavailable.
  } finally {
    if (copyButton) copyButton.disabled = false;
  }
}

updateInstallCommand();
