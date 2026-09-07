const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "..", "data", "downloads.json");

const SOURCES = {
  unlocktool: "https://file.unlocktool.net/",
  software_fix:
    "https://es-es.support.motorola.com/app/answers/detail/a_id/164170",
  samfw: "https://samfw.com/blog/samfwtool",
  primetoolx: "https://www.gsmprime.online/",
  tsm: "https://tsm-tool.com/download",
  borneo: "https://updateborneo.com/",
  iremoval: "https://iremovalpro.com/"
};

/* =========================================================
   UTILIDADES
   ========================================================= */

function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function compareVersions(a, b) {
  const pa = String(a)
    .split(".")
    .map(Number);

  const pb = String(b)
    .split(".")
    .map(Number);

  const length = Math.max(pa.length, pb.length);

  for (let i = 0; i < length; i++) {
    const av = Number.isFinite(pa[i]) ? pa[i] : 0;
    const bv = Number.isFinite(pb[i]) ? pb[i] : 0;

    if (av !== bv) {
      return av - bv;
    }
  }

  return 0;
}

async function fetchPage(url) {
  console.log(`Consultando: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    },
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al consultar ${url}`);
  }

  return await response.text();
}

function extractHrefs(html, base) {
  const links = [];

  for (const match of html.matchAll(
    /href\s*=\s*["']([^"']+)["']/gi
  )) {
    links.push(absoluteUrl(match[1], base));
  }

  return unique(links);
}

function extractMediaFireLinks(html, base) {
  const links = [];

  for (const match of html.matchAll(
    /href\s*=\s*["']([^"']*mediafire\.com[^"']*)["']/gi
  )) {
    links.push(absoluteUrl(match[1], base));
  }

  for (const match of html.matchAll(
    /https?:\/\/[^"'<> \s]+mediafire\.com[^"'<> \s]*/gi
  )) {
    links.push(match[0]);
  }

  return unique(links);
}

function extractMegaLinks(html) {
  return unique([
    ...[...html.matchAll(
      /href\s*=\s*["'](https?:\/\/mega\.nz\/[^"']+)["']/gi
    )].map((m) => m[1]),

    ...[...html.matchAll(
      /https?:\/\/mega\.nz\/[^"'<> \s]+/gi
    )].map((m) => m[0])
  ]);
}

function extractGoogleDriveLinks(html) {
  return unique([
    ...[...html.matchAll(
      /href\s*=\s*["'](https?:\/\/drive\.google\.com\/[^"']+)["']/gi
    )].map((m) => m[1]),

    ...[...html.matchAll(
      /https?:\/\/drive\.google\.com\/[^"'<> \s]+/gi
    )].map((m) => m[0])
  ]);
}

function extractDropboxLinks(html) {
  return unique([
    ...[...html.matchAll(
      /href\s*=\s*["'](https?:\/\/(?:www\.)?dropbox\.com\/[^"']+)["']/gi
    )].map((m) => m[1]),

    ...[...html.matchAll(
      /https?:\/\/(?:www\.)?dropbox\.com\/[^"'<> \s]+/gi
    )].map((m) => m[0])
  ]);
}

/* =========================================================
   UNLOCKTOOL
   ========================================================= */

async function updateUnlockTool() {
  const html = await fetchPage(SOURCES.unlocktool);

  const versions = unique(
    [...html.matchAll(
      /UnlockTool-(\d{4}-\d{2}-\d{2}-\d+)/gi
    )].map((m) => m[1])
  );

  if (!versions.length) {
    throw new Error("No se encontró versión de UnlockTool");
  }

  const version = versions.sort().at(-1);

  const versionPattern = `UnlockTool-${version}`;

  const links = [];

  const hrefRegex = new RegExp(
    `<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*${versionPattern}[^<]*</a>`,
    "gi"
  );

  for (const match of html.matchAll(hrefRegex)) {
    links.push(
      absoluteUrl(match[1], SOURCES.unlocktool)
    );
  }

  const broadRegex = new RegExp(
    `https?://[^"'\\s<>]+${versionPattern}[^"'\\s<>]*`,
    "gi"
  );

  for (const match of html.matchAll(broadRegex)) {
    links.push(match[0]);
  }

  const downloads = {};

  for (const link of unique(links)) {
    const lower = link.toLowerCase();

    if (lower.includes("mediafire")) {
      downloads.mediafire = link;
    } else if (lower.includes("mega.nz")) {
      downloads.mega = link;
    } else if (lower.includes("drive.google.com")) {
      downloads.google_drive = link;
    } else if (lower.includes("dropbox")) {
      downloads.dropbox = link;
    }
  }

  if (!Object.keys(downloads).length) {
    throw new Error(
      "No se encontraron enlaces de descarga de UnlockTool"
    );
  }

  return {
    name: "UnlockTool",
    version,
    description: "Herramienta completa para desbloqueo",
    source: SOURCES.unlocktool,
    downloads
  };
}

/* =========================================================
   MOTOROLA SOFTWARE FIX
   ========================================================= */

async function updateSoftwareFix() {
  const html = await fetchPage(SOURCES.software_fix);

  const versions = [
    ...html.matchAll(
      /Rescue_and_Smart_Assistant_v(\d+\.\d+\.\d+\.\d+)_prod_setup\.exe/gi
    )
  ].map((m) => m[1]);

  if (!versions.length) {
    throw new Error(
      "No se encontró versión de Software Fix"
    );
  }

  const version = versions.at(-1);

  const installerMatches = [
    ...html.matchAll(
      /https?:\/\/[^"'<> \s]*Rescue_and_Smart_Assistant_v\d+\.\d+\.\d+\.\d+_prod_setup\.exe/gi
    )
  ].map((m) => m[0]);

  if (!installerMatches.length) {
    throw new Error(
      "No se encontró instalador de Software Fix"
    );
  }

  return {
    name: "Software Fix - Lenovo/Motorola",
    version,
    description: "Herramienta para reparación de software",
    source: SOURCES.software_fix,
    downloads: {
      installer: installerMatches.at(-1)
    }
  };
}

/* =========================================================
   SAMFW
   ========================================================= */

async function updateSamfw() {
  const html = await fetchPage(SOURCES.samfw);

  const versions = [
    ...html.matchAll(
      /SamFw\s*Tool\s*(?:Setup[_\s-]*)?v?(\d+\.\d+)/gi
    )
  ].map((m) => m[1]);

  const zipMatches = [
    ...html.matchAll(
      /https?:\/\/samfw\.com\/SamFwToolSetup_v(\d+\.\d+)\.zip/gi
    )
  ];

  if (!versions.length && !zipMatches.length) {
    throw new Error(
      "No se encontró versión de SamFw Tool"
    );
  }

  let candidates = [...versions];

  for (const match of zipMatches) {
    candidates.push(match[1]);
  }

  candidates = unique(candidates);

  const version = candidates
    .sort(compareVersions)
    .at(-1);

  return {
    name: "SamFw Tool",
    version,
    description: "Herramienta para dispositivos Samsung",
    source: SOURCES.samfw,
    downloads: {
      zip: `https://samfw.com/SamFwToolSetup_v${version}.zip`
    }
  };
}

/* =========================================================
   PRIMETOOLX
   ========================================================= */

/*
   IMPORTANTE:

   GSM Prime puede mostrar números como:

       PrimeToolX 26.6.2

   Ese número NO representa la versión que queremos.

   Las versiones reales que buscamos son del tipo:

       8.8
       8.9
       9
       9.1
       9.2
       etc.

   Por eso la versión se obtiene del archivo/enlace de descarga
   y no del título "PrimeToolX 26.6.2".
*/

function extractPrimeVersion(text) {
  const candidates = [];

  const patterns = [
    /PrimeToolX\s*(\d+\.\d+(?:\.\d+)?)/gi,
    /PrimeToolX(\d+\.\d+(?:\.\d+)?)/gi,
    /PrimeTool\s*X\s*(\d+\.\d+(?:\.\d+)?)/gi,
    /PrimeToolX[_\s-]*(\d+\.\d+(?:\.\d+)?)/gi,
    /PrimeToolX(?:[_\s-]*)v?(\d+(?:\.\d+)+)/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const version = match[1];

      /*
         El 26.x.x de la página no nos interesa.
      */
      if (!version.startsWith("26.")) {
        candidates.push(version);
      }
    }
  }

  return unique(candidates);
}

async function updatePrimeToolX() {
  const homeHtml = await fetchPage(SOURCES.primetoolx);

  /*
     Primero buscamos la página específica de PrimeToolX.
  */
  const hrefs = extractHrefs(
    homeHtml,
    SOURCES.primetoolx
  );

  let productUrl = hrefs.find((url) =>
    /software-primetoolx26/i.test(url)
  );

  /*
     Si no encontramos el enlace, usamos la URL conocida.
  */
  if (!productUrl) {
    productUrl =
      "https://www.gsmprime.online/software-primetoolx26";
  }

  console.log(
    `Página PrimeToolX: ${productUrl}`
  );

  const productHtml = await fetchPage(productUrl);

  const combinedHtml =
    homeHtml + "\n" + productHtml;

  /*
     Buscamos específicamente descargas de PrimeToolX.
  */
  const mediafireLinks = extractMediaFireLinks(
    productHtml,
    productUrl
  );

  const primeDownloads = mediafireLinks.filter(
    (link) =>
      /PrimeToolX/i.test(link) ||
      /PrimeTool/i.test(link)
  );

  if (!primeDownloads.length) {
    throw new Error(
      "No se encontró descarga de PrimeToolX"
    );
  }

  /*
     Extraemos versiones directamente de los nombres
     de los archivos/enlaces.

     Ejemplo:

     PrimeToolX8.8.rar
     PrimeToolX8.9.rar
     PrimeToolX9.rar
     PrimeToolX9.1.rar
  */

  const downloadCandidates = [];

  for (const link of primeDownloads) {
    const versions = extractPrimeVersion(link);

    for (const version of versions) {
      downloadCandidates.push({
        version,
        link
      });
    }
  }

  /*
     También miramos el texto alrededor de los enlaces,
     por si la versión está escrita como "Versión 8.8".
  */

  for (const link of primeDownloads) {
    const index = productHtml.indexOf(link);

    if (index === -1) {
      continue;
    }

    const context = productHtml.slice(
      Math.max(0, index - 1000),
      Math.min(productHtml.length, index + 1000)
    );

    const versions = [
      ...context.matchAll(
        /(?:versi[oó]n|version)\s*(?:de\s*)?v?\s*(\d+(?:\.\d+)+)/gi
      )
    ].map((m) => m[1]);

    for (const version of versions) {
      if (version.startsWith("26.")) {
        continue;
      }

      downloadCandidates.push({
        version,
        link
      });
    }
  }

  /*
     Si tenemos candidatos, elegimos la versión más alta.
  */
  if (!downloadCandidates.length) {
    throw new Error(
      "No se pudo determinar la versión real de PrimeToolX"
    );
  }

  downloadCandidates.sort((a, b) =>
    compareVersions(a.version, b.version)
  );

  const selected =
    downloadCandidates.at(-1);

  return {
    name: "PrimeToolX",
    version: selected.version,
    description: "Herramienta para técnicos",
    source: SOURCES.primetoolx,
    downloads: {
      mediafire: selected.link
    }
  };
}

/* =========================================================
   TSM TOOL
   ========================================================= */

async function updateTSM() {
  const html = await fetchPage(SOURCES.tsm);

  const googleDriveLinks =
    extractGoogleDriveLinks(html);

  const megaLinks =
    extractMegaLinks(html);

  const mediafireLinks =
    extractMediaFireLinks(html, SOURCES.tsm);

  const dropboxLinks =
    extractDropboxLinks(html);

  /*
     -------------------------------------------------------
     TSM-TOOL PRO
     -------------------------------------------------------
  */

  let tsmProVersion = null;

  const tsmProMatches = [
    ...html.matchAll(
      /TSM[_\s-]*SetupV?(\d+\.\d+\.\d+)/gi
    )
  ];

  if (tsmProMatches.length) {
    tsmProVersion =
      tsmProMatches
        .map((m) => m[1])
        .sort(compareVersions)
        .at(-1);
  }

  if (!tsmProVersion) {
    const genericMatches = [
      ...html.matchAll(
        /TSM[\s-]*TOOL[\s-]*PRO[\s\S]{0,1500}?v?(\d+\.\d+\.\d+)/gi
      )
    ];

    if (genericMatches.length) {
      tsmProVersion =
        genericMatches
          .map((m) => m[1])
          .sort(compareVersions)
          .at(-1);
    }
  }

  if (!tsmProVersion) {
    throw new Error(
      "No se encontró versión de TSM-TOOL PRO"
    );
  }

  const tsmToolDownloads = {};

  for (const link of googleDriveLinks) {
    if (
      /1aFaZe_PAZP2IbrUiJH6UPf6fE4-1H1Vb/i.test(
        link
      )
    ) {
      tsmToolDownloads.google_drive = link;
    }
  }

  for (const link of megaLinks) {
    if (
      /r3pxBBzY/i.test(link)
    ) {
      tsmToolDownloads.mega = link;
    }
  }

  for (const link of mediafireLinks) {
    if (
      /TSM_SetupV?2\.4\.1/i.test(link)
    ) {
      tsmToolDownloads.mediafire = link;
    }
  }

  for (const link of dropboxLinks) {
    if (
      /TSM_SetupV?2\.4\.1/i.test(link)
    ) {
      tsmToolDownloads.dropbox = link;
    }
  }

  /*
     Si los enlaces no fueron detectados por su nombre,
     buscamos por los identificadores conocidos.
  */

  if (!tsmToolDownloads.google_drive) {
    tsmToolDownloads.google_drive =
      "https://drive.google.com/file/d/1aFaZe_PAZP2IbrUiJH6UPf6fE4-1H1Vb/view?usp=sharing";
  }

  if (!tsmToolDownloads.mega) {
    tsmToolDownloads.mega =
      "https://mega.nz/file/r3pxBBzY#0C8VOouqDxy0B30HEJtYHwNi9_0DfWo9OnmTuGoojBk";
  }

  if (!tsmToolDownloads.mediafire) {
    tsmToolDownloads.mediafire =
      "https://www.mediafire.com/file/vqh1h1uhwq9s2xo/TSM_SetupV2.4.1.7z/file";
  }

  if (!tsmToolDownloads.dropbox) {
    tsmToolDownloads.dropbox =
      "https://www.dropbox.com/scl/fi/ieg1lxay7kc5olcu1ocmt/TSM_SetupV2.4.1.7z?rlkey=iclglr7e9itkyw2snfyqdcw9w&st=57r203qn&dl=0";
  }

  /*
     -------------------------------------------------------
     TSM-PRO EDITION
     -------------------------------------------------------
  */

  const editionMatches = [
    ...html.matchAll(
      /TSM[\s-]*Pro[\s-]*Edition[\s\S]{0,2000}?(\d{4}\.\d{2}\.\d{2})/gi
    )
  ];

  let editionVersion = null;

  if (editionMatches.length) {
    editionVersion =
      editionMatches
        .map((m) => m[1])
        .sort(compareVersions)
        .at(-1);
  }

  /*
     También buscamos directamente el nombre del archivo.
  */

  const editionFileMatches = [
    ...html.matchAll(
      /TSM[\s-]*Pro[\s-]*Edition[\s-]*Setup[-_\s]*(\d{4}\.\d{2}\.\d{2})/gi
    )
  ];

  if (editionFileMatches.length) {
    const versions =
      editionFileMatches.map((m) => m[1]);

    editionVersion =
      versions
        .sort(compareVersions)
        .at(-1);
  }

  if (!editionVersion) {
    throw new Error(
      "No se encontró versión de TSM-PRO EDITION"
    );
  }

  const editionDownloads = {};

  for (const link of googleDriveLinks) {
    if (
      /1bQobh0t6WP2d5ynOhbLV2iL1nLvtf--B/i.test(
        link
      )
    ) {
      editionDownloads.google_drive = link;
    }
  }

  for (const link of megaLinks) {
    if (/vuZgXDoQ/i.test(link)) {
      editionDownloads.mega = link;
    }
  }

  for (const link of mediafireLinks) {
    if (
      /TSM.*Pro.*Edition.*2026\.09\.06/i.test(
        link
      )
    ) {
      editionDownloads.mediafire = link;
    }
  }

  for (const link of dropboxLinks) {
    if (
      /TSM-Pro-Edition-Setup-2026\.09\.06/i.test(
        link
      )
    ) {
      editionDownloads.dropbox = link;
    }
  }

  if (!editionDownloads.google_drive) {
    editionDownloads.google_drive =
      "https://drive.google.com/file/d/1bQobh0t6WP2d5ynOhbLV2iL1nLvtf--B/view?usp=sharing";
  }

  if (!editionDownloads.mega) {
    editionDownloads.mega =
      "https://mega.nz/file/vuZgXDoQ#YRzSIqR68AnmPUiBgS0NNMxWk1NVa4E2h2gRHi6deWM";
  }

  if (!editionDownloads.mediafire) {
    editionDownloads.mediafire =
      "https://www.mediafire.com/file/exj3eualafj71g9/TSM+Pro+Edition+Setup[2026.09.06].7z/file";
  }

  if (!editionDownloads.dropbox) {
    editionDownloads.dropbox =
      "https://www.dropbox.com/scl/fi/tc2mge33dktascscj2eo6/TSM-Pro-Edition-Setup-2026.09.06.7z?rlkey=3cuekeu8n6m5b5bh6m2jrnozp&st=gxiiim6l&dl=0";
  }

  return {
    tsm_tool_pro: {
      name: "TSM-TOOL PRO",
      version: tsmProVersion,
      description: "Funciones avanzadas para técnicos",
      source: SOURCES.tsm,
      downloads: tsmToolDownloads
    },

    tsm_pro_edition: {
      name: "TSM-PRO EDITION",
      version: editionVersion,
      description: "Interfaz simple para tareas básicas",
      source: SOURCES.tsm,
      downloads: editionDownloads
    }
  };
}

/* =========================================================
   BORNEO SCHEMATICS
   ========================================================= */

async function updateBorneo() {
  const html = await fetchPage(SOURCES.borneo);

  const versionMatches = [
    ...html.matchAll(
      /Borneo[\s\S]{0,1500}?v?(\d+\.\d+\.\d+\.\d+)/gi
    )
  ];

  let version = null;

  if (versionMatches.length) {
    version =
      versionMatches
        .map((m) => m[1])
        .sort(compareVersions)
        .at(-1);
  }

  /*
     Buscamos directamente el nombre del instalador.
  */

  const installerMatches = [
    ...html.matchAll(
      /Borneo[_\s-]*Installer[_\s-]*v?(\d+\.\d+\.\d+\.\d+)[^"'<> ]*/gi
    )
  ];

  if (installerMatches.length) {
    const versions =
      installerMatches.map((m) => m[1]);

    version =
      versions
        .sort(compareVersions)
        .at(-1);
  }

  if (!version) {
    throw new Error(
      "No se encontró versión de Borneo Schematics"
    );
  }

  const mediafireLinks =
    extractMediaFireLinks(
      html,
      SOURCES.borneo
    );

  const megaLinks =
    extractMegaLinks(html);

  const googleDriveLinks =
    extractGoogleDriveLinks(html);

  const downloads = {};

  const mediafire = mediafireLinks.find(
    (link) =>
      /Borneo/i.test(link) &&
      version.replace(/\./g, "\\.") &&
      new RegExp(
        version.replace(/\./g, "\\.")
      ).test(link)
  );

  if (mediafire) {
    downloads.mediafire = mediafire;
  }

  const mega = megaLinks.find((link) =>
    /wI90nTDY/i.test(link)
  );

  if (mega) {
    downloads.mega = mega;
  }

  const drive = googleDriveLinks.find((link) =>
    /1ASviLm1pJHVrA3wJ9wzTLopHF_0SY_xY/i.test(
      link
    )
  );

  if (drive) {
    downloads.google_drive = drive;
  }

  /*
     Links conocidos como respaldo.
  */

  if (!downloads.mediafire) {
    downloads.mediafire =
      "https://www.mediafire.com/file/bfrwsjojh24b7oh/Borneo_Installer_v1.0.9659.13774_-_New.rar/file";
  }

  if (!downloads.mega) {
    downloads.mega =
      "https://mega.nz/file/wI90nTDY#yD_ta3VjpxP1lmBj-QA4y-YA1S9QtkVDxABZCfQMKg";
  }

  if (!downloads.google_drive) {
    downloads.google_drive =
      "https://drive.google.com/file/d/1ASviLm1pJHVrA3wJ9wzTLopHF_0SY_xY/view?usp=sharing";
  }

  return {
    name: "Borneo Schematics",
    version,
    description: "Herramienta de esquemas para técnicos",
    source: SOURCES.borneo,
    downloads
  };
}

/* =========================================================
   IREMOVAL PRO
   ========================================================= */

async function updateIRemoval() {
  const html = await fetchPage(SOURCES.iremoval);

  /*
     -------------------------------------------------------
     iREMOVAL PRO X
     -------------------------------------------------------
  */

  let proXVersion = null;

  const proXMatches = [
    ...html.matchAll(
      /iREMOVAL\s*PRO[\s\S]{0,1500}?v?(\d+\.\d+)/gi
    )
  ];

  if (proXMatches.length) {
    proXVersion =
      proXMatches
        .map((m) => m[1])
        .sort(compareVersions)
        .at(-1);
  }

  /*
     -------------------------------------------------------
     PREMIUM
     -------------------------------------------------------
  */

  let premiumVersion = null;

  const premiumMatches = [
    ...html.matchAll(
      /Premium[\s\S]{0,1500}?v?(\d+\.\d+\.\d+)/gi
    )
  ];

  if (premiumMatches.length) {
    premiumVersion =
      premiumMatches
        .map((m) => m[1])
        .sort(compareVersions)
        .at(-1);
  }

  /*
     En caso de que el HTML no exponga claramente
     las versiones, usamos las que corresponden
     a los enlaces de descarga.
  */

  if (!proXVersion) {
    proXVersion = "7.2";
  }

  if (!premiumVersion) {
    premiumVersion = "5.2.1";
  }

  return {
    iremoval_pro_x: {
      name: "iRemoval PRO X",
      version: proXVersion,
      description: "Herramienta iRemoval PRO",
      source: SOURCES.iremoval,
      downloads: {
        mega:
          "https://mega.nz/file/C4VWUBAD#Mtj11jqRhIhJi9IwQsxEtmW6QCjUOm3iO2KFbI2P324"
      }
    },

    iremoval_pro_premium: {
      name: "iRemoval PRO Premium",
      version: premiumVersion,
      description: "Edición Premium de iRemoval PRO",
      source: SOURCES.iremoval,
      downloads: {
        mega:
          "https://mega.nz/file/e1dgxSaY#5dY9rJcg4iJo70GsHxNmLsuIMJ9vgx9TJVVENjVQ3qc"
      }
    }
  };
}

/* =========================================================
   MAIN
   ========================================================= */

async function main() {
  console.log("");
  console.log("======================================");
  console.log(" GSMPoint - Actualizador de descargas ");
  console.log("======================================");
  console.log("");

  const result = {
    updated_at: new Date().toISOString(),
    tools: {}
  };

  /*
     Cada herramienta se actualiza por separado.
     Si una falla, detenemos todo para no escribir
     información incompleta en downloads.json.
  */

  console.log("1/7 - UnlockTool");
  result.tools.unlocktool =
    await updateUnlockTool();

  console.log("2/7 - Software Fix");
  result.tools.software_fix =
    await updateSoftwareFix();

  console.log("3/7 - SamFw Tool");
  result.tools.samfw =
    await updateSamfw();

  console.log("4/7 - PrimeToolX");
  result.tools.primetoolx =
    await updatePrimeToolX();

  console.log("5/7 - TSM");
  const tsm =
    await updateTSM();

  result.tools.tsm_tool_pro =
    tsm.tsm_tool_pro;

  result.tools.tsm_pro_edition =
    tsm.tsm_pro_edition;

  console.log("6/7 - Borneo Schematics");
  result.tools.borneo_schematics =
    await updateBorneo();

  console.log("7/7 - iRemoval PRO");
  const iremoval =
    await updateIRemoval();

  result.tools.iremoval_pro_x =
    iremoval.iremoval_pro_x;

  result.tools.iremoval_pro_premium =
    iremoval.iremoval_pro_premium;

  /*
     Crear carpeta data si no existe.
  */

  const dataDir = path.dirname(OUTPUT);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {
      recursive: true
    });
  }

  /*
     Guardar JSON.
  */

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(result, null, 2) + "\n",
    "utf8"
  );

  console.log("");
  console.log("======================================");
  console.log(" downloads.json actualizado correctamente");
  console.log("======================================");
  console.log("");

  console.log(
    `Archivo: ${OUTPUT}`
  );

  console.log(
    `Fecha: ${result.updated_at}`
  );

  console.log("");
}

/* =========================================================
   EJECUCIÓN
   ========================================================= */

main().catch((error) => {
  console.error("");
  console.error("======================================");
  console.error(" ERROR AL ACTUALIZAR DESCARGAS");
  console.error("======================================");
  console.error("");
  console.error(error);
  console.error("");

  process.exit(1);
});
