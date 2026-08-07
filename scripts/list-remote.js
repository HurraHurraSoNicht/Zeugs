const { Client } = require('basic-ftp');

async function main() {
  const { FTP_HOST, FTP_USER, FTP_PASSWORD, FTP_REMOTE_DIR } = process.env;
  console.log(`Verbinde zu ${FTP_HOST} als ${FTP_USER} ...`);
  const client = new Client();
  try {
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASSWORD, secure: true });
    console.log('Verbunden. Wechsle Verzeichnis ...');
    await client.cd(FTP_REMOTE_DIR);
    console.log('Liste Inhalt ...');
    const list = await client.list();
    console.log(`${list.length} Einträge gefunden:`);
    for (const item of list) {
      console.log(`${item.type === 2 ? 'DIR ' : 'FILE'}  ${item.name}`);
    }
  } finally {
    client.close();
  }
}

main()
  .catch((err) => {
    console.error('Fehler:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
