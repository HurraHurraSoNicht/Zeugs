// Uploads the static Expo web export (./dist) to All-Inkl webspace via FTPS.
// Run `npm run export:web` first, then `npm run deploy:web`.
//
// Required env vars (set in the shell before running, never commit them):
//   FTP_HOST        e.g. "www.snakkers.de" or the FTP host from the KAS panel
//   FTP_USER        FTP login from the KAS panel
//   FTP_PASSWORD    FTP password from the KAS panel
//   FTP_REMOTE_DIR  target directory on the webspace, e.g. "/" or "/www.snakkers.de"

const { Client } = require('basic-ftp');
const path = require('path');

async function main() {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR } = process.env;
  const missing = ['FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'FTP_REMOTE_DIR'].filter(
    (name) => !process.env[name],
  );
  if (missing.length) {
    console.error(`Fehlende Umgebungsvariablen: ${missing.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const localDir = path.join(__dirname, '..', 'dist');
  const client = new Client();
  client.ftp.verbose = true;
  try {
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: true,
    });
    await client.ensureDir(FTP_REMOTE_DIR);
    const cwd = await client.pwd();
    const before = await client.list();
    console.log(`Arbeitsverzeichnis: ${cwd} (${before.length} vorhandene Einträge werden gelöscht)`);
    await client.clearWorkingDir();
    const after = await client.list();
    if (after.length > 0) {
      throw new Error(
        `clearWorkingDir hat ${after.length} Einträge übrig gelassen (${after.map((f) => f.name).join(', ')}) — Upload abgebrochen.`,
      );
    }
    await client.uploadFromDir(localDir);
    console.log('Upload abgeschlossen.');
  } finally {
    client.close();
  }
}

main()
  .catch((err) => {
    console.error('Deploy fehlgeschlagen:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    // basic-ftp's TLS control socket can linger after client.close(),
    // keeping the event loop alive — force the process to end.
    process.exit(process.exitCode ?? 0);
  });
