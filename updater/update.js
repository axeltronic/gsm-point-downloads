const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "..", "data", "downloads.json");

const SOURCES = {
  unlocktool: "https://file.unlocktool.net/",

  software_fix:
    "https://es-es.support.motorola.com/app/answers/detail/a_id/164170",

  samfw: "https://samfw.com/blog/samfwtool",

  primetoolx:
    "https://www.gsmprime.online/software-primetoolx26",

  tsm:
    "https://tsm-tool.com/download",

  borneo:
    "https://updateborneo.com/",

  iremoval:
    "https://iremovalpro.com/"
};


/* =========================================================
   UTILIDADES
   ========================================================= */

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}


function absoluteUrl(url, base) {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}


function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);

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

      "Accept-Language":
        "es-ES,es;q=0.9,en;q=0.8"
    },

    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} al consultar ${url}`
    );
  }

  return await response.text();
}


function extractHrefs(html, base) {
  const links = [];

  for (const match of html.matchAll(
    /href\s*=\s*["']([^"']+)["']/gi
  )) {
    links.push(
      absoluteUrl(match[1], base)
    );
  }

  return unique(links);
}


function extractMediaFireLinks(html, base) {
  const links = [];

  for (const match of html.matchAll(
    /href\s*=\s*["']([^"']*mediafire\.com[^"']*)["']/gi
  )) {
    links.push(
      absoluteUrl(match[1], base)
    );
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
  const html = await fetchPage(
    SOURCES.unlocktool
  );

  const versions = unique(
    [...html.matchAll(
      /UnlockTool-(\d{4}-\d{2}-\d{2}-\d+)/gi
    )].map((m) => m[1])
  );

  if (!versions.length) {
    throw new Error(
      "No se encontró versión de UnlockTool"
    );
  }

  const version =
    versions.sort().at(-1);

  const versionPattern =
    `UnlockTool-${version}`;

  const links = [];

  const regex = new RegExp(
    `<a[^>]+href=["']([^"']+)["'][^>]*>[^<]*${versionPattern}[^<]*</a>`,
    "gi"
  );

  for (const match of html.matchAll(regex)) {
    links.push(
      absoluteUrl(
        match[1],
        SOURCES.unlocktool
      )
    );
  }

  const broadRegex = new RegExp(
    `https?://[^"'\\s<>]+${versionPattern}[^"'\\s<>]*`,
    "gi"
  );

  for (const match of html.matchAll(
    broadRegex
  )) {
    links.push(match[0]);
  }

  const downloads = {};

  for (const link of unique(links)) {
    const lower =
      link.toLowerCase();

    if (lower.includes("mediafire")) {
      downloads.mediafire = link;
    }

    else if (lower.includes("mega.nz")) {
      downloads.mega = link;
    }

    else if (
      lower.includes("drive.google.com")
    ) {
      downloads.google_drive = link;
    }

    else if (
      lower.includes("dropbox")
    ) {
      downloads.dropbox = link;
    }
  }

  if (!Object.keys(downloads).length) {
    throw new Error(
      "No se encontraron enlaces de descarga de UnlockTool"
    );
  }

  return {
    name:
      "UnlockTool",

    version,

    description:
      "Herramienta completa para desbloqueo",

    source:
      SOURCES.unlocktool,

    downloads
  };
}


/* =========================================================
   SOFTWARE FIX - LENOVO / MOTOROLA - CORREGIDO DEFINITIVO
   ========================================================= */

async function updateSoftwareFix() {
  const html = await fetchPage(SOURCES.software_fix);
  
  console.log("🔍 Buscando instalador de Software Fix...");
  
  // Buscar SOLO el enlace que contiene "consumer/mobiles/software_fix_v"
  // Este es el formato CORRECTO de la versión 7.6.2.10
  const match = html.match(/https?:\/\/[^"'\s<>]*download\.lenovo\.com\/consumer\/mobiles\/software_fix_v(\d+\.\d+\.\d+\.\d+)_setup\.exe/);

  if (match) {
    const version = match[1];
    const installerUrl = match[0];
    
    console.log(`✅ Versión encontrada: ${version}`);
    console.log(`📥 URL: ${installerUrl}`);
    
    return {
      name: "Software Fix - Lenovo/Motorola",
      version: version,
      description: "Herramienta para reparación de software",
      source: SOURCES.software_fix,
      downloads: {
        installer: installerUrl
      }
    };
  }

  // Si no encuentra el patrón correcto, buscar como respaldo
  const backupMatch = html.match(/https?:\/\/[^"'\s<>]*download\.lenovo\.com\/[^"'\s<>]*software_fix_v(\d+\.\d+\.\d+\.\d+)_setup\.exe/);
  if (backupMatch) {
    const version = backupMatch[1];
    const installerUrl = backupMatch[0];
    
    console.log(`✅ Versión encontrada (backup): ${version}`);
    console.log(`📥 URL: ${installerUrl}`);
    
    return {
      name: "Software Fix - Lenovo/Motorola",
      version: version,
      description: "Herramienta para reparación de software",
      source: SOURCES.software_fix,
      downloads: {
        installer: installerUrl
      }
    };
  }

  throw new Error("No se encontró el instalador de Software Fix en la página");
}


/* =========================================================
   SAMFW
   ========================================================= */

async function updateSamfw() {
  const html =
    await fetchPage(
      SOURCES.samfw
    );

  const versions = [
    ...html.matchAll(
      /SamFw\s*Tool\s*(?:Setup[_\s-]*)?v?(\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  const zipMatches = [
    ...html.matchAll(
      /https?:\/\/samfw\.com\/SamFwToolSetup_v(\d+\.\d+)\.zip/gi
    )
  ];

  const candidates =
    unique([
      ...versions,
      ...zipMatches.map(
        (m) => m[1]
      )
    ]);

  if (!candidates.length) {
    throw new Error(
      "No se encontró versión de SamFw Tool"
    );
  }

  const version =
    candidates
      .sort(compareVersions)
      .at(-1);

  return {
    name:
      "SamFw Tool",

    version,

    description:
      "Herramienta para dispositivos Samsung",

    source:
      SOURCES.samfw,

    downloads: {
      zip:
        `https://samfw.com/SamFwToolSetup_v${version}.zip`
    }
  };
}


/* =========================================================
   PRIMETOOLX
   ========================================================= */

function extractPrimeVersions(text) {
  const candidates = [];

  const patterns = [
    /PrimeToolX\s*(\d+\.\d+(?:\.\d+)?)/gi,

    /PrimeToolX(\d+\.\d+(?:\.\d+)?)/gi,

    /PrimeTool\s*X\s*(\d+\.\d+(?:\.\d+)?)/gi,

    /PrimeToolX[_\s-]*v?(\d+(?:\.\d+)+)/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(
      pattern
    )) {
      const version =
        match[1];

      if (
        version.startsWith("26.")
      ) {
        continue;
      }

      candidates.push(version);
    }
  }

  return unique(
    candidates
  );
}


async function updatePrimeToolX() {
  const html =
    await fetchPage(
      SOURCES.primetoolx
    );

  const mediafireLinks =
    extractMediaFireLinks(
      html,
      SOURCES.primetoolx
    );

  const primeDownloads =
    mediafireLinks.filter(
      (link) =>
        /PrimeToolX/i.test(link) ||
        /PrimeTool/i.test(link)
    );

  if (!primeDownloads.length) {
    throw new Error(
      "No se encontró descarga de PrimeToolX"
    );
  }

  const candidates = [];

  for (const link of primeDownloads) {
    const versions =
      extractPrimeVersions(
        link
      );

    for (const version of versions) {
      candidates.push({
        version,
        link
      });
    }
  }

  for (const link of primeDownloads) {
    const index =
      html.indexOf(link);

    if (index === -1) {
      continue;
    }

    const context =
      html.slice(
        Math.max(
          0,
          index - 2000
        ),
        Math.min(
          html.length,
          index + 2000
        )
      );

    const versions = [
      ...context.matchAll(
        /(?:versi[oó]n|version)\s*v?\s*(\d+(?:\.\d+)+)/gi
      )
    ].map(
      (m) => m[1]
    );

    for (const version of versions) {
      if (
        version.startsWith("26.")
      ) {
        continue;
      }

      candidates.push({
        version,
        link
      });
    }
  }

  if (!candidates.length) {
    throw new Error(
      "No se pudo determinar la versión real de PrimeToolX"
    );
  }

  candidates.sort(
    (a, b) =>
      compareVersions(
        a.version,
        b.version
      )
  );

  const selected =
    candidates.at(-1);

  return {
    name:
      "PrimeToolX",

    version:
      selected.version,

    description:
      "Herramienta para técnicos",

    source:
      SOURCES.primetoolx,

    downloads: {
      mediafire:
        selected.link
    }
  };
}


/* =========================================================
   TSM
   ========================================================= */

async function updateTSM() {
  const html =
    await fetchPage(
      SOURCES.tsm
    );

  const proVersions = [
    ...html.matchAll(
      /TSM[_\s-]*SetupV?(\d+\.\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  let tsmProVersion =
    null;

  if (proVersions.length) {
    tsmProVersion =
      proVersions
        .sort(compareVersions)
        .at(-1);
  }

  if (!tsmProVersion) {
    const generic = [
      ...html.matchAll(
        /TSM[\s-]*TOOL[\s-]*PRO[\s\S]{0,1500}?v?(\d+\.\d+\.\d+)/gi
      )
    ].map(
      (m) => m[1]
    );

    if (generic.length) {
      tsmProVersion =
        generic
          .sort(compareVersions)
          .at(-1);
    }
  }

  if (!tsmProVersion) {
    tsmProVersion =
      "2.4.1";
  }


  const editionVersions = [
    ...html.matchAll(
      /TSM[\s-]*Pro[\s-]*Edition[\s\S]{0,2000}?(\d{4}\.\d{2}\.\d{2})/gi
    )
  ].map(
    (m) => m[1]
  );

  const editionFileVersions = [
    ...html.matchAll(
      /TSM[\s-]*Pro[\s-]*Edition[\s-]*Setup[-_\s]*(\d{4}\.\d{2}\.\d{2})/gi
    )
  ].map(
    (m) => m[1]
  );

  const editionCandidates =
    unique([
      ...editionVersions,
      ...editionFileVersions
    ]);

  let editionVersion =
    null;

  if (editionCandidates.length) {
    editionVersion =
      editionCandidates
        .sort(compareVersions)
        .at(-1);
  }

  if (!editionVersion) {
    editionVersion =
      "2026.09.06";
  }


  const googleDriveLinks =
    extractGoogleDriveLinks(
      html
    );

  const megaLinks =
    extractMegaLinks(
      html
    );

  const mediafireLinks =
    extractMediaFireLinks(
      html,
      SOURCES.tsm
    );

  const dropboxLinks =
    extractDropboxLinks(
      html
    );


  const tsmToolDownloads = {};

  tsmToolDownloads.google_drive =
    googleDriveLinks.find(
      (link) =>
        /1aFaZe_PAZP2IbrUiJH6UPf6fE4-1H1Vb/i.test(
          link
        )
    ) ||
    "https://drive.google.com/file/d/1aFaZe_PAZP2IbrUiJH6UPf6fE4-1H1Vb/view?usp=sharing";


  tsmToolDownloads.mega =
    megaLinks.find(
      (link) =>
        /r3pxBBzY/i.test(
          link
        )
    ) ||
    "https://mega.nz/file/r3pxBBzY#0C8VOouqDxy0B30HEJtYHwNi9_0DfWo9OnmTuGoojBk";


  tsmToolDownloads.mediafire =
    mediafireLinks.find(
      (link) =>
        /TSM_SetupV?2\.4\.1/i.test(
          link
        )
    ) ||
    "https://www.mediafire.com/file/vqh1h1uhwq9s2xo/TSM_SetupV2.4.1.7z/file";


  tsmToolDownloads.dropbox =
    dropboxLinks.find(
      (link) =>
        /TSM_SetupV?2\.4\.1/i.test(
          link
        )
    ) ||
    "https://www.dropbox.com/scl/fi/ieg1lxay7kc5olcu1ocmt/TSM_SetupV2.4.1.7z?rlkey=iclglr7e9itkyw2snfyqdcw9w&st=57r203qn&dl=0";


  const editionDownloads = {};

  editionDownloads.google_drive =
    googleDriveLinks.find(
      (link) =>
        /1bQobh0t6WP2d5ynOhbLV2iL1nLvtf--B/i.test(
          link
        )
    ) ||
    "https://drive.google.com/file/d/1bQobh0t6WP2d5ynOhbLV2iL1nLvtf--B/view?usp=sharing";


  editionDownloads.mega =
    megaLinks.find(
      (link) =>
        /vuZgXDoQ/i.test(
          link
        )
    ) ||
    "https://mega.nz/file/vuZgXDoQ#YRzSIqR68AnmPUiBgS0NNMxWk1NVa4E2h2gRHi6deWM";


  editionDownloads.mediafire =
    mediafireLinks.find(
      (link) =>
        /TSM.*Pro.*Edition.*2026\.09\.06/i.test(
          link
        )
    ) ||
    "https://www.mediafire.com/file/exj3eualafj71g9/TSM+Pro+Edition+Setup[2026.09.06].7z/file";


  editionDownloads.dropbox =
    dropboxLinks.find(
      (link) =>
        /TSM-Pro-Edition-Setup-2026\.09\.06/i.test(
          link
        )
    ) ||
    "https://www.dropbox.com/scl/fi/tc2mge33dktascscj2eo6/TSM-Pro-Edition-Setup-2026.09.06.7z?rlkey=3cuekeu8n6m5b5bh6m2jrnozp&st=gxiiim6l&dl=0";


  return {
    tsm_tool_pro: {
      name:
        "TSM-TOOL PRO",

      version:
        tsmProVersion,

      description:
        "Funciones avanzadas para técnicos",

      source:
        SOURCES.tsm,

      downloads:
        tsmToolDownloads
    },

    tsm_pro_edition: {
      name:
        "TSM-PRO EDITION",

      version:
        editionVersion,

      description:
        "Interfaz simple para tareas básicas",

      source:
        SOURCES.tsm,

      downloads:
        editionDownloads
    }
  };
}


/* =========================================================
   BORNEO
   ========================================================= */

async function updateBorneo() {
  const html =
    await fetchPage(
      SOURCES.borneo
    );

  const versionMatches = [
    ...html.matchAll(
      /Borneo[\s\S]{0,1500}?v?(\d+\.\d+\.\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  const installerMatches = [
    ...html.matchAll(
      /Borneo[_\s-]*Installer[_\s-]*v?(\d+\.\d+\.\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  const candidates =
    unique([
      ...versionMatches,
      ...installerMatches
    ]);

  if (!candidates.length) {
    throw new Error(
      "No se encontró versión de Borneo Schematics"
    );
  }

  const version =
    candidates
      .sort(compareVersions)
      .at(-1);

  const mediafireLinks =
    extractMediaFireLinks(
      html,
      SOURCES.borneo
    );

  const megaLinks =
    extractMegaLinks(
      html
    );

  const googleDriveLinks =
    extractGoogleDriveLinks(
      html
    );

  const downloads = {};

  const versionRegex =
    new RegExp(
      version.replace(
        /\./g,
        "\\."
      )
    );

  downloads.mediafire =
    mediafireLinks.find(
      (link) =>
        /Borneo/i.test(link) &&
        versionRegex.test(link)
    ) ||
    "https://www.mediafire.com/file/bfrwsjojh24b7oh/Borneo_Installer_v1.0.9659.13774_-_New.rar/file";


  downloads.mega =
    megaLinks.find(
      (link) =>
        /wI90nTDY/i.test(
          link
        )
    ) ||
    "https://mega.nz/file/wI90nTDY#yD_ta3VjpxP1lmBj-QA4y-YA1S9QtkVDxABZCfQMKg";


  downloads.google_drive =
    googleDriveLinks.find(
      (link) =>
        /1ASviLm1pJHVrA3wJ9wzTLopHF_0SY_xY/i.test(
          link
        )
    ) ||
    "https://drive.google.com/file/d/1ASviLm1pJHVrA3wJ9wzTLopHF_0SY_xY/view?usp=sharing";


  return {
    name:
      "Borneo Schematics",

    version,

    description:
      "Herramienta de esquemas para técnicos",

    source:
      SOURCES.borneo,

    downloads
  };
}


/* =========================================================
   IREMOVAL
   ========================================================= */

async function updateIRemoval() {
  const html =
    await fetchPage(
      SOURCES.iremoval
    );

  let proXVersion =
    null;

  const proXMatches = [
    ...html.matchAll(
      /iREMOVAL\s*PRO[\s\S]{0,1500}?v?(\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  if (proXMatches.length) {
    proXVersion =
      proXMatches
        .sort(compareVersions)
        .at(-1);
  }


  let premiumVersion =
    null;

  const premiumMatches = [
    ...html.matchAll(
      /Premium[\s\S]{0,1500}?v?(\d+\.\d+\.\d+)/gi
    )
  ].map(
    (m) => m[1]
  );

  if (premiumMatches.length) {
    premiumVersion =
      premiumMatches
        .sort(compareVersions)
        .at(-1);
  }


  if (!proXVersion) {
    proXVersion =
      "7.2";
  }

  if (!premiumVersion) {
    premiumVersion =
      "5.2.1";
  }


  return {
    iremoval_pro_x: {
      name:
        "iRemoval PRO X",

      version:
        proXVersion,

      description:
        "Herramienta iRemoval PRO",

      source:
        SOURCES.iremoval,

      downloads: {
        mega:
          "https://mega.nz/file/C4VWUBAD#Mtj11jqRhIhJi9IwQsxEtmW6QCjUOm3iO2KFbI2P324"
      }
    },


    iremoval_pro_premium: {
      name:
        "iRemoval PRO Premium",

      version:
        premiumVersion,

      description:
        "Edición Premium de iRemoval PRO",

      source:
        SOURCES.iremoval,

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
  console.log(
    "======================================"
  );
  console.log(
    " GSMPoint - Actualizador de descargas "
  );
  console.log(
    "======================================"
  );
  console.log("");


  let previous = {
    updated_at: null,
    tools: {}
  };


  if (
    fs.existsSync(OUTPUT)
  ) {
    try {
      previous =
        JSON.parse(
          fs.readFileSync(
            OUTPUT,
            "utf8"
          )
        );
    } catch {
      console.log(
        "Aviso: no se pudo leer el downloads.json anterior."
      );
    }
  }


  const result = {
    updated_at:
      new Date().toISOString(),

    tools: {
      ...(previous.tools || {})
    }
  };


  console.log(
    "1/7 - UnlockTool"
  );

  try {

    result.tools.unlocktool =
      await updateUnlockTool();

    console.log(
      `OK - UnlockTool: ${result.tools.unlocktool.version}`
    );

  } catch (error) {

    console.error(
      `WARN - UnlockTool: ${error.message}`
    );

  }


  console.log(
    "2/7 - Software Fix"
  );

  try {

    result.tools.software_fix =
      await updateSoftwareFix();

    console.log(
      `OK - Software Fix: ${result.tools.software_fix.version}`
    );

  } catch (error) {

    console.error(
      `WARN - Software Fix: ${error.message}`
    );

  }


  console.log(
    "3/7 - SamFw Tool"
  );

  try {

    result.tools.samfw =
      await updateSamfw();

    console.log(
      `OK - SamFw: ${result.tools.samfw.version}`
    );

  } catch (error) {

    console.error(
      `WARN - SamFw: ${error.message}`
    );

  }


  console.log(
    "4/7 - PrimeToolX"
  );

  try {

    result.tools.primetoolx =
      await updatePrimeToolX();

    console.log(
      `OK - PrimeToolX: ${result.tools.primetoolx.version}`
    );

  } catch (error) {

    console.error(
      `WARN - PrimeToolX: ${error.message}`
    );

  }


  console.log(
    "5/7 - TSM"
  );

  try {

    const tsm =
      await updateTSM();

    result.tools.tsm_tool_pro =
      tsm.tsm_tool_pro;

    result.tools.tsm_pro_edition =
      tsm.tsm_pro_edition;

    console.log(
      `OK - TSM-TOOL PRO: ${tsm.tsm_tool_pro.version}`
    );

    console.log(
      `OK - TSM-PRO EDITION: ${tsm.tsm_pro_edition.version}`
    );

  } catch (error) {

    console.error(
      `WARN - TSM: ${error.message}`
    );

  }


  console.log(
    "6/7 - Borneo Schematics"
  );

  try {

    result.tools.borneo_schematics =
      await updateBorneo();

    console.log(
      `OK - Borneo: ${result.tools.borneo_schematics.version}`
    );

  } catch (error) {

    console.error(
      `WARN - Borneo: ${error.message}`
    );

  }


  console.log(
    "7/7 - iRemoval PRO"
  );

  try {

    const iremoval =
      await updateIRemoval();

    result.tools.iremoval_pro_x =
      iremoval.iremoval_pro_x;

    result.tools.iremoval_pro_premium =
      iremoval.iremoval_pro_premium;

    console.log(
      `OK - iRemoval PRO X: ${iremoval.iremoval_pro_x.version}`
    );

    console.log(
      `OK - iRemoval PRO Premium: ${iremoval.iremoval_pro_premium.version}`
    );

  } catch (error) {

    console.error(
      `WARN - iRemoval: ${error.message}`
    );

  }


  const dataDir =
    path.dirname(OUTPUT);


  if (!fs.existsSync(dataDir)) {

    fs.mkdirSync(
      dataDir,
      {
        recursive: true
      }
    );

  }


  fs.writeFileSync(
    OUTPUT,

    JSON.stringify(
      result,
      null,
      2
    ) + "\n",

    "utf8"
  );


  console.log("");
  console.log(
    "======================================"
  );
  console.log(
    " downloads.json actualizado"
  );
  console.log(
    "======================================"
  );
  console.log("");

  console.log(
    `Archivo: ${OUTPUT}`
  );

  console.log(
    `Fecha: ${result.updated_at}`
  );

  console.log("");
}


main().catch((error) => {

  console.error("");
  console.error(
    "======================================"
  );
  console.error(
    " ERROR CRÍTICO"
  );
  console.error(
    "======================================"
  );
  console.error("");

  console.error(error);

  console.error("");

  process.exit(1);
});
